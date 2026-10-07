"use server";

// Ações dos Orçamentos — "Cliente aprovou" (D-24/P10, plano 06.5-27 — saiu de `acoes.ts`, que agora
// é o índice; separada do resto do ciclo, em `acoes-ciclo.ts`, só pelo tamanho).

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  categorias,
  documentoLinhas,
  documentos,
  orcamentoLinhas,
  orcamentoProjeto,
  orcamentos,
  parcelas,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { conferirParcelas } from "@/lib/financeiro/parcelas";
import {
  planejarAprovacao,
  type CustoDeProjetoParaAprovacao,
  type LinhaParaAprovacao,
} from "@/lib/orcamentos/aprovacao";
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";
import { diasDeValidadeRestantes } from "@/lib/orcamentos/situacao";
import { criarOrdemDoOrcamento } from "@/lib/producao/gravacao";

import { esquemaAprovacao } from "./esquemas";
import { lerDoSnapshot } from "./snapshot";
import {
  FRASE_FALHA_AO_APROVAR,
  FRASE_ORCAMENTO_NAO_ENVIADO_PARA_APROVAR,
} from "./textos";

import {
  CategoriaEncomendasIndisponivel,
  ConferenciaDeParcelasFalhou,
  OrcamentoExpirado,
  OrcamentoNaoEncontrado,
  primeiraMensagemDeErro,
  primeiroErroConhecido,
  type ResultadoDeAcao,
} from "./acoes-comum";
import { garantirTransicaoValida } from "./acoes-servidor";

// ---------------------------------------------------------------------------------------------
// "Cliente aprovou" (04.5-12-PLAN.md, D-25/ORC-11) — UMA transação cria a venda na parte 1 e, se
// marcado, a encomenda; os vínculos gravam nos dois sentidos, na MESMA instrução que aprova.
// ---------------------------------------------------------------------------------------------

export type ResultadoDaAprovacao = {
  id: string;
  documentoId: string;
  documentoNumero: number;
  encomendaId: string | null;
};

// `abrirOrdemDeProducao` já vem escolhido pelo dono no diálogo — nenhum valor, nenhuma descrição,
// nenhuma data vêm do cliente (T-04.5-61): a transação recalcula tudo a partir do orçamento
// gravado, lido DENTRO dela, com `planejarAprovacao` (a MESMA função que `DialogoAprovar` chamou
// para MOSTRAR). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function aprovarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<ResultadoDaAprovacao>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaAprovacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id, abrirOrdemDeProducao } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());
  // Lida FORA da transação (é configuração, não algo que a aprovação muda) — a MESMA leitura que
  // `lancarVenda` faz para `conferirParcelas` abaixo.
  const configuracao = await obterConfiguracaoFinanceira();

  try {
    const dados = await db.transaction(async (tx) => {
      // 1. trava o orçamento e exige status "enviado" — recusado e aprovado nunca chegam aqui
      // (a frase do caso "aprovado" sempre aponta para Duplicar, D-07); expirado (D-22, nunca
      // gravado) é conferido logo abaixo, à parte, porque o STATUS continua "enviado".
      const [orcamento] = await tx
        .select({
          status: orcamentos.status,
          ano: orcamentos.ano,
          sequencial: orcamentos.sequencial,
          clienteNome: orcamentos.clienteNome,
          titulo: orcamentos.titulo,
          data: orcamentos.data,
          validadeDias: orcamentos.validadeDias,
          entregaPrevista: orcamentos.entregaPrevista,
          plano: orcamentos.plano,
          sinalPercentual: orcamentos.sinalPercentual,
          freteCentavos: orcamentos.freteCentavos,
          snapshot: orcamentos.snapshot,
        })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação — a segunda tentativa de um duplo toque encontra status "aprovado" e recusa (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["enviado"], FRASE_ORCAMENTO_NAO_ENVIADO_PARA_APROVAR);

      const diasRestantes = diasDeValidadeRestantes(orcamento.data, orcamento.validadeDias, hoje);
      if (diasRestantes < 0) {
        throw new OrcamentoExpirado();
      }

      // 2. carrega as linhas e os custos de projeto DENTRO da transação — nunca confiado do
      // cliente. A ordem (`ordem asc`) é a MESMA de `obterOrcamentoParaEdicao`, para alinhar por
      // índice com as linhas do snapshot logo abaixo (mesma disciplina de `EditorOrcamento`).
      const linhasDoBanco = await tx
        .select({
          fichaId: orcamentoLinhas.fichaId,
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
          cor: orcamentoLinhas.cor,
          personalizacao: orcamentoLinhas.personalizacao,
        })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, id))
        .orderBy(asc(orcamentoLinhas.ordem));

      const custosDoBanco = await tx
        .select({
          descricao: orcamentoProjeto.descricao,
          valorCentavos: orcamentoProjeto.valorCentavos,
        })
        .from(orcamentoProjeto)
        .where(eq(orcamentoProjeto.orcamentoId, id))
        .orderBy(asc(orcamentoProjeto.ordem));

      // 3. a categoria "Encomendas" pela MESMA regra que a parte 1 usa (existe, ativa, do grupo
      // de receita) — carregada do banco, nunca confiada do cliente (nem vem dele). Achada pelo
      // NOME (a única chave de sistema que `categorias.chave_do_sistema` aceita é 'diferenca',
      // db/schema.ts) — se um dia renomearem "Encomendas" em Cadastros, a aprovação passa a falhar
      // com a mesma frase genérica de qualquer outra falha da transação (D-25), nunca uma venda
      // pela metade.
      const [categoriaEncomendas] = await tx
        .select({ id: categorias.id })
        .from(categorias)
        .where(
          and(
            eq(categorias.nome, "Encomendas"),
            eq(categorias.ativa, true),
            eq(categorias.grupo, "receita"),
          ),
        )
        .limit(1);
      if (!categoriaEncomendas) {
        throw new CategoriaEncomendasIndisponivel();
      }

      // 4. monta o plano com `planejarAprovacao` — a MESMA função que `DialogoAprovar` chamou
      // para MOSTRAR. O nome de cada peça vem do SNAPSHOT (congelado em "Marcar como enviado"),
      // nunca da ficha viva — ela pode ter mudado de nome depois do envio.
      const leituraCongelada = lerDoSnapshot(orcamento.snapshot);
      const linhasParaAprovacao: LinhaParaAprovacao[] = linhasDoBanco.map((linha, indice) => ({
        fichaId: linha.fichaId,
        nome: leituraCongelada.linhas[indice]?.nome || "",
        quantidade: linha.quantidade,
        precoUnitarioCentavos: linha.precoUnitarioCentavos,
        cor: linha.cor,
        personalizacao: linha.personalizacao,
      }));
      const custosParaAprovacao: CustoDeProjetoParaAprovacao[] = custosDoBanco.map((custo) => ({
        descricao: custo.descricao,
        valorCentavos: custo.valorCentavos,
      }));

      const plano = planejarAprovacao(
        {
          numero: numeroDeOrcamento(orcamento.ano, orcamento.sequencial),
          titulo: orcamento.titulo,
          plano: orcamento.plano,
          sinalPercentual: orcamento.sinalPercentual,
          freteCentavos: orcamento.freteCentavos,
          entregaPrevista: orcamento.entregaPrevista,
        },
        linhasParaAprovacao,
        custosParaAprovacao,
        hoje,
      );

      // 5. confere a soma das parcelas com a MESMA função que `lancarVenda` usa — a frase de
      // recusa é a mesma em todo o sistema, mesmo que aqui ela nunca chegue à tela (qualquer
      // divergência aqui é defeito do próprio servidor, D-25: "nada foi criado").
      const conferencia = conferirParcelas({
        totalCentavos: plano.totalCentavos,
        parcelas: plano.parcelas.map((parcela) => ({
          vencimento: parcela.vencimento,
          valorCentavos: parcela.valorCentavos,
          pago: false,
        })),
        hoje,
        dataSaldoInicial: configuracao.dataSaldoInicial,
      });
      if (!conferencia.ok) {
        throw new ConferenciaDeParcelasFalhou();
      }

      // 6. grava o documento de venda, as linhas e as parcelas — NENHUMA paga, o sinal vencendo
      // hoje (D-25). `forma: "pix"` é só o valor INICIAL da parcela em aberto — o dono escolhe a
      // forma de verdade em "Recebi" no Caixa, que sobrescreve este campo quando o dinheiro cai
      // (lib/financeiro/acoes.ts::registrarPagamento).
      const [documento] = await tx
        .insert(documentos)
        .values({
          tipo: "venda",
          data: hoje,
          pessoaNome: orcamento.clienteNome,
          criadoPor: usuario.id,
        })
        .returning({ id: documentos.id, numero: documentos.numero });

      await tx.insert(documentoLinhas).values(
        plano.linhasDaVenda.map((linha, indice) => ({
          documentoId: documento.id,
          ordem: indice,
          descricao: linha.descricao,
          categoriaId: categoriaEncomendas.id,
          quantidade: linha.quantidade,
          valorCentavos: linha.valorCentavos,
        })),
      );

      await tx.insert(parcelas).values(
        plano.parcelas.map((parcela, indice) => ({
          documentoId: documento.id,
          numero: indice + 1,
          vencimento: parcela.vencimento,
          valorCentavos: parcela.valorCentavos,
          forma: "pix" as const,
          pagoEm: null,
          pagoPor: null,
        })),
      );

      // 7. se marcado, abre a ORDEM DE PRODUÇÃO (Fase 06.1, PRD-10/PRD-11) na MESMA transação —
      // aguardando o sinal, sem início, com as peças na ordem das linhas (ficha, cor e
      // personalização de cada uma) e as seis etapas do caminho completo. Mora em
      // `lib/producao/gravacao.ts`, arquivo SEM a diretiva de Server Action: se morasse aqui,
      // viraria endpoint chamável pelo navegador. Aprovar de novo não cria segunda ordem: o
      // orçamento está travado acima e só sai de "enviado" uma vez, e `orcamentos.encomenda_id` é
      // único (`orcamentos_encomenda_id_uk`).
      const encomendaId = abrirOrdemDeProducao
        ? await criarOrdemDoOrcamento(tx, {
            nome: plano.nomeDaOrdem,
            clienteNome: orcamento.clienteNome,
            entregaPrometida: orcamento.entregaPrevista,
            pecas: plano.pecasDaOrdem,
            criadoPor: usuario.id,
          })
        : null;

      // 8. grava `status = 'aprovado'`, `documentoId` e `encomendaId` na MESMA instrução — nunca
      // existe um instante em que a venda existe e o orçamento não sabe, ou vice-versa.
      await tx
        .update(orcamentos)
        .set({ status: "aprovado", documentoId: documento.id, encomendaId })
        .where(eq(orcamentos.id, id));

      return {
        id,
        documentoId: documento.id,
        documentoNumero: documento.numero,
        encomendaId,
      };
    });

    return { ok: true, dados };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    // Qualquer outra falha (categoria indisponível, conferência de parcelas, erro de banco) —
    // SEMPRE a mesma frase (D-25): "nada foi criado", nunca um detalhe que sugeriria uma venda
    // pela metade.
    console.error("Falha ao aprovar orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_APROVAR };
  }
}

"use server";

// Ações dos Orçamentos — o CICLO: enviar, recusar, voltar a rascunho, duplicar e atualizar preços
// (D-24/P10, plano 06.5-27 — saíram de `acoes.ts`, que agora é o índice). A aprovação, o maior
// pedaço do ciclo, mora em `acoes-aprovacao.ts` para este arquivo ficar abaixo de 800 linhas.

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  fichasPrecificacao,
  orcamentoLinhas,
  orcamentoProjeto,
  orcamentoRevisoes,
  orcamentos,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";
import { calcularPeca } from "@/lib/precificacao/calculo";
import { parametrosVigentes } from "@/lib/precificacao/consultas";
import { quantasCabem } from "@/lib/precificacao/forno";

import {
  esquemaAtualizacaoDePrecos,
  esquemaDuplicarOrcamento,
  esquemaMarcarComoEnviado,
  esquemaRecusarOrcamento,
  esquemaVoltarParaRascunho,
} from "./esquemas";
import { proximoSequencialDeOrcamento, type TransacaoDoBanco } from "./numero";
import { montarSnapshot, type LinhaParaMontarSnapshot } from "./snapshot";
import {
  FRASE_FALHA_AO_CRIAR,
  FRASE_FALHA_AO_SALVAR,
  FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR,
  FRASE_ORCAMENTO_JA_E_RASCUNHO,
  FRASE_ORCAMENTO_NAO_E_RASCUNHO,
  FRASE_ORCAMENTO_NAO_ENVIADO_PARA_RECUSAR,
} from "./textos";

import {
  FaltaClienteOuPeca,
  ListaDePrecosDivergente,
  OrcamentoNaoEncontrado,
  ParametrosIndisponiveis,
  primeiraMensagemDeErro,
  primeiroErroConhecido,
  type ResultadoDeAcao,
} from "./acoes-comum";
import { garantirTransicaoValida } from "./acoes-servidor";

// ---------------------------------------------------------------------------------------------
// O ciclo de vida do orçamento (04.5-08-PLAN.md, Tarefa 2) — congelar, recusar, reabrir, duplicar
// ---------------------------------------------------------------------------------------------

// "Marcar como enviado" (D-21) — a promessa central da fase: grava, na MESMA instrução, `status`,
// `snapshot`, `congeladoEm` e `data`, para o invariante de banco `(status='rascunho') = (snapshot
// is null)` nunca ficar violado no meio. `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function marcarComoEnviado(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaMarcarComoEnviado.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({ status: orcamentos.status, clienteNome: orcamentos.clienteNome })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["rascunho"], FRASE_ORCAMENTO_NAO_E_RASCUNHO);

      const linhas = await tx
        .select({
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
          fichaNome: fichasPrecificacao.nome,
          argilaMiligramas: fichasPrecificacao.argilaMiligramas,
          esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
          horasMilesimos: fichasPrecificacao.horasMilesimos,
          larguraMm: fichasPrecificacao.larguraMm,
          profundidadeMm: fichasPrecificacao.profundidadeMm,
          alturaMm: fichasPrecificacao.alturaMm,
          embalagemCentavos: fichasPrecificacao.embalagemCentavos,
          cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
          cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
        })
        .from(orcamentoLinhas)
        .innerJoin(fichasPrecificacao, eq(orcamentoLinhas.fichaId, fichasPrecificacao.id))
        .where(eq(orcamentoLinhas.orcamentoId, id))
        // 🔴 SEM este `orderBy` o snapshot sai desalinhado. Todo leitor casa
        // `snapshot.linhas[indice]` com as linhas ordenadas por `ordem` (consultas.ts:190,
        // documento-cliente.ts, editor-orcamento.tsx, e a aprovação em ~1135 — que até comenta
        // "a ordem é a MESMA"). Sem cláusula de ordenação o Postgres devolve a ordem FÍSICA da
        // tabela, que deixa de bater com a coluna `ordem` assim que uma linha é editada (o
        // `update` grava uma versão nova da tupla, que vai para o fim da heap).
        //
        // Se desalinhar, o estrago não é cosmético: nome congelado, custo e mínimo da peça A
        // colados na peça B — no painel "Só para você", no PDF QUE VAI AO CLIENTE e nas linhas
        // da venda criada na aprovação.
        //
        // 🔴 HONESTIDADE SOBRE A GRAVIDADE, medida nesta sessão (2026-09-27), com o `orderBy`
        // removido de propósito: **não consegui reproduzir o desalinhamento pela interface**.
        // Tentei seis edições de quantidade em duas linhas e a remoção de uma linha do meio —
        // os dois cenários continuaram alinhados. O motivo é que todo caminho de escrita deste
        // módulo preserva a ordem por construção: editar quantidade é HOT update (a versão nova
        // fica na mesma página e reaproveita o ponteiro), e a renumeração de `removerLinha`
        // percorre as linhas em ordem CRESCENTE de `ordem`, de modo que as versões novas são
        // anexadas no fim já na ordem certa.
        //
        // Ou seja: defeito LATENTE, não bug observável hoje. O que o torna real é o futuro —
        // um recurso de reordenar linha, um orçamento grande o bastante para o planejador
        // escolher outra varredura, ou qualquer mudança nesse laço de renumeração. Depender de
        // ordem não especificada é errado mesmo quando dá certo por acidente, e a cláusula custa
        // zero.
        //
        // `UNIQUE(orcamento_id, ordem)` (0017, "orcamento_linhas_orcamento_ordem_uk") torna esta
        // uma ordem TOTAL — não precisa de critério de desempate.
        //
        // Apontado pela verificação independente do Cowork em 2026-09-27, sobre `bb39df4` (era a
        // única consulta de linha do módulo sem ordenação). A gravidade acima é correção minha:
        // o relatório dele descrevia o desalinhamento como consequência provável de editar uma
        // linha, e a medição não sustenta isso.
        .orderBy(asc(orcamentoLinhas.ordem));

      if (!orcamento.clienteNome?.trim() || linhas.length === 0) {
        throw new FaltaClienteOuPeca();
      }

      const parametros = await parametrosVigentes(hoje);
      if (!parametros.ok) {
        throw new ParametrosIndisponiveis();
      }

      // Cada linha, calculada com os parâmetros de HOJE (canal "direto" — a mesma leitura que o
      // rascunho já mostrava um instante antes de enviar) — uma peça que não calcula (D-11/D-12)
      // entra com zero em todos os campos de dinheiro/forno, nunca interrompe o congelamento
      // inteiro (a mesma tolerância que o rascunho já tinha para essa peça).
      const linhasParaSnapshot: LinhaParaMontarSnapshot[] = linhas.map((linha) => {
        const cabem = quantasCabem(
          { larguraMm: linha.larguraMm, profundidadeMm: linha.profundidadeMm, alturaMm: linha.alturaMm },
          parametros.forno,
          { biscoito: linha.cabemBiscoitoInformado, esmalte: linha.cabemEsmalteInformado },
        );
        const resultadoDaLinha = calcularPeca({
          ficha: {
            argilaMiligramas: linha.argilaMiligramas,
            esmalteMiligramas: linha.esmalteMiligramas,
            horasMilesimos: linha.horasMilesimos,
            embalagemCentavos: linha.embalagemCentavos,
          },
          cabem,
          parametros: parametros.calculo,
          taxaCartaoPontosBase: parametros.taxaCartaoPontosBase,
          canal: "direto",
        });

        return {
          nome: linha.fichaNome,
          custoCentavos: resultadoDaLinha.ok ? resultadoDaLinha.custoCentavos : 0,
          minimoCentavos: resultadoDaLinha.ok ? resultadoDaLinha.minimoCentavos : 0,
          zeroCentavos: resultadoDaLinha.ok ? resultadoDaLinha.zeroCentavos : 0,
          horasMilesimos: linha.horasMilesimos,
          quantasCabemBiscoito: resultadoDaLinha.ok ? cabem.biscoito : 0,
          quantasCabemEsmalte: resultadoDaLinha.ok ? cabem.esmalte : 0,
        };
      });

      const snapshot = montarSnapshot({
        linhas: linhasParaSnapshot,
        impostoETaxaPontosBase: parametros.calculo.impostoPontosBase + parametros.taxaCartaoPontosBase,
        parametrosEstimados: Object.values(parametros.porChave).filter((p) => !p.medido).length,
        congeladoEm: new Date().toISOString(),
      });

      await tx
        .update(orcamentos)
        .set({ status: "enviado", snapshot, congeladoEm: new Date(), data: hoje })
        .where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao marcar orçamento como enviado:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Recusou" — marca como recusado SEM tocar em snapshot/congeladoEm (o número, a revisão e o
// congelamento ficam, D-06). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function recusarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaRecusarOrcamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({ status: orcamentos.status })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["enviado"], FRASE_ORCAMENTO_NAO_ENVIADO_PARA_RECUSAR);

      await tx.update(orcamentos).set({ status: "recusado" }).where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao recusar orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Voltar para rascunho" — descongela: `status`, `snapshot` e `congeladoEm` gravam juntos na
// MESMA instrução (o invariante de banco nunca fica violado no meio). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function voltarParaRascunho(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaVoltarParaRascunho.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({ status: orcamentos.status })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["enviado", "recusado"], FRASE_ORCAMENTO_JA_E_RASCUNHO);

      await tx
        .update(orcamentos)
        .set({ status: "rascunho", snapshot: null, congeladoEm: null })
        .where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao voltar orçamento para rascunho:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Duplicar" (D-07) — aceita QUALQUER status (a única das quatro sem `garantirTransicaoValida`):
// pede um sequencial NOVO ao contador (D-06, dentro da mesma transação que copia tudo) e cria um
// rascunho com as mesmas peças, quantidades, preços, cor, personalização, custos de projeto e
// frete — sem snapshot, sem revisão herdada, sem vínculo de venda/encomenda e sem fotos (a coluna
// nasce com o padrão da tabela em todos os quatro casos, nunca copiada). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function duplicarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ano: number; sequencial: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDuplicarOrcamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    const { novoId, ano, sequencial } = await db.transaction(async (tx) => {
      const [original] = await tx
        .select({
          clienteNome: orcamentos.clienteNome,
          titulo: orcamentos.titulo,
          entregaPrevista: orcamentos.entregaPrevista,
          validadeDias: orcamentos.validadeDias,
          plano: orcamentos.plano,
          sinalPercentual: orcamentos.sinalPercentual,
          freteCentavos: orcamentos.freteCentavos,
          observacoes: orcamentos.observacoes,
        })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava o original enquanto lê — nenhuma edição concorrente decide o que foi copiado (for update)

      if (!original) {
        throw new OrcamentoNaoEncontrado();
      }

      const linhasOriginais = await tx
        .select({
          fichaId: orcamentoLinhas.fichaId,
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
          cor: orcamentoLinhas.cor,
          personalizacao: orcamentoLinhas.personalizacao,
          ordem: orcamentoLinhas.ordem,
        })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, id))
        .orderBy(asc(orcamentoLinhas.ordem));

      const custosOriginais = await tx
        .select({
          descricao: orcamentoProjeto.descricao,
          valorCentavos: orcamentoProjeto.valorCentavos,
          ordem: orcamentoProjeto.ordem,
        })
        .from(orcamentoProjeto)
        .where(eq(orcamentoProjeto.orcamentoId, id))
        .orderBy(asc(orcamentoProjeto.ordem));

      const anoNovo = Number(hoje.slice(0, 4));
      const sequencialNovo = await proximoSequencialDeOrcamento(tx, anoNovo);

      const [novo] = await tx
        .insert(orcamentos)
        .values({
          ano: anoNovo,
          sequencial: sequencialNovo,
          status: "rascunho",
          clienteNome: original.clienteNome,
          titulo: original.titulo,
          data: hoje,
          validadeDias: original.validadeDias,
          entregaPrevista: original.entregaPrevista,
          plano: original.plano,
          sinalPercentual: original.sinalPercentual,
          freteCentavos: original.freteCentavos,
          observacoes: original.observacoes,
          criadoPor: usuario.id,
        })
        .returning({ id: orcamentos.id });

      if (linhasOriginais.length > 0) {
        await tx.insert(orcamentoLinhas).values(
          linhasOriginais.map((linha) => ({
            orcamentoId: novo.id,
            fichaId: linha.fichaId,
            quantidade: linha.quantidade,
            precoUnitarioCentavos: linha.precoUnitarioCentavos,
            cor: linha.cor,
            personalizacao: linha.personalizacao,
            ordem: linha.ordem,
          })),
        );
      }

      if (custosOriginais.length > 0) {
        await tx.insert(orcamentoProjeto).values(
          custosOriginais.map((custo) => ({
            orcamentoId: novo.id,
            descricao: custo.descricao,
            valorCentavos: custo.valorCentavos,
            ordem: custo.ordem,
          })),
        );
      }

      return { novoId: novo.id, ano: anoNovo, sequencial: sequencialNovo };
    });

    return { ok: true, dados: { id: novoId, ano, sequencial } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
    }
    console.error("Falha ao duplicar orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
  }
}

// ---------------------------------------------------------------------------------------------
// "Atualizar preços" (04.5-09-PLAN.md, Tarefa 2) — compara o mínimo CONGELADO com o de HOJE e
// guarda a revisão anterior antes de reabrir (D-23)
// ---------------------------------------------------------------------------------------------

// O "total de então" que a revisão guarda é peças + projeto + frete — a MESMA fórmula de
// `lib/orcamentos/contas.ts::contasDoOrcamento`, só que somada direto no banco (aqui só o número
// final interessa, não o resultado por peça que aquele módulo também devolve). Separada de
// `atualizarPrecos` de propósito: é a ÚNICA parte desta ação que lê o que um custo de projeto e o
// frete valem agora, para gravar um total histórico — nunca os altera (a ação em si nunca toca em
// nenhum dos dois, T-04.5-42/T-04.5-44).
async function somaDoQueNaoEhPeca(tx: TransacaoDoBanco, orcamentoId: string): Promise<number> {
  const custos = await tx
    .select({ valor: orcamentoProjeto.valorCentavos })
    .from(orcamentoProjeto)
    .where(eq(orcamentoProjeto.orcamentoId, orcamentoId));
  const somaDosCustos = custos.reduce((soma, custo) => soma + custo.valor, 0);

  const [cabecalho] = await tx
    .select({ valor: orcamentos.freteCentavos })
    .from(orcamentos)
    .where(eq(orcamentos.id, orcamentoId));

  return somaDosCustos + (cabecalho?.valor ?? 0);
}

// "Atualizar preços" — dois caminhos, na MESMA transação, com a linha do orçamento e as linhas de
// peça travadas antes de decidir:
// - CONGELADO (enviado ou recusado — "expirado" é só "enviado" com validade vencida, D-22): (1)
//   guarda a revisão ATUAL em `orcamento_revisoes` (revisão, `enviado_em` = `congelado_em` de
//   então, total de então, snapshot de então) ANTES de tocar em qualquer outra coisa — a ordem
//   importa (T-04.5-43): se algo falhar depois, a transação inteira desfaz, e a revisão nunca
//   chega a existir pela metade; (2) grava os preços novos nas linhas; (3) sobe `revisao` em 1;
//   (4) volta a rascunho com `snapshot`/`congeladoEm` zerados e a data de hoje — a validade
//   renova a partir dela.
// - RASCUNHO: só grava os preços novos. Nenhuma revisão, nenhuma mudança de status ou de data.
// Em nenhum dos dois esta ação toca custos de projeto, frete ou o número do orçamento, e ela
// nunca chama o contador de sequencial (D-06). Aprovado é recusado com a frase que manda usar
// Duplicar (D-07), a mesma guarda comum das demais transições. `exigirUsuario()` é a PRIMEIRA
// instrução do corpo.
export async function atualizarPrecos(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDePrecos.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, linhas } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({
          status: orcamentos.status,
          revisao: orcamentos.revisao,
          congeladoEm: orcamentos.congeladoEm,
          snapshot: orcamentos.snapshot,
        })
        .from(orcamentos)
        .where(eq(orcamentos.id, orcamentoId))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(
        orcamento.status,
        ["rascunho", "enviado", "recusado"],
        FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR,
      );

      const linhasDoOrcamento = await tx
        .select({
          id: orcamentoLinhas.id,
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
        })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, orcamentoId))
        .for("update"); // trava as linhas do orçamento antes de gravar os preços novos (for update)

      // A lista enviada precisa cobrir EXATAMENTE as linhas do orçamento — nem mais, nem menos
      // (T-04.5-42): divergir é sinal de que a tela ficou desatualizada, nunca um preço para uma
      // linha de outro orçamento.
      const idsDoOrcamento = new Set(linhasDoOrcamento.map((linha) => linha.id));
      const idsEnviados = new Set(linhas.map((linha) => linha.linhaId));
      const listaBate =
        idsDoOrcamento.size === idsEnviados.size &&
        [...idsDoOrcamento].every((id) => idsEnviados.has(id));
      if (!listaBate) {
        throw new ListaDePrecosDivergente();
      }

      if (orcamento.status !== "rascunho") {
        const pecasCentavos = linhasDoOrcamento.reduce(
          (soma, linha) => soma + linha.quantidade * linha.precoUnitarioCentavos,
          0,
        );
        const totalDeEntao = pecasCentavos + (await somaDoQueNaoEhPeca(tx, orcamentoId));

        await tx.insert(orcamentoRevisoes).values({
          orcamentoId,
          revisao: orcamento.revisao,
          enviadoEm: orcamento.congeladoEm,
          totalCentavos: totalDeEntao,
          snapshot: orcamento.snapshot,
        });
      }

      for (const linha of linhas) {
        await tx
          .update(orcamentoLinhas)
          .set({ precoUnitarioCentavos: linha.precoCentavos })
          .where(and(eq(orcamentoLinhas.id, linha.linhaId), eq(orcamentoLinhas.orcamentoId, orcamentoId)));
      }

      if (orcamento.status !== "rascunho") {
        await tx
          .update(orcamentos)
          .set({
            revisao: orcamento.revisao + 1,
            status: "rascunho",
            snapshot: null,
            congeladoEm: null,
            data: hoje,
          })
          .where(eq(orcamentos.id, orcamentoId));
      }
    });

    return { ok: true, dados: { id: orcamentoId } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao atualizar preços do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

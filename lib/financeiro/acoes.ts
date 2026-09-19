"use server";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { categorias, documentoLinhas, documentos, parcelas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { obterConfiguracaoFinanceira } from "./consultas";
import { totalDasLinhas } from "./documento";
import { TETO_CENTAVOS } from "./dinheiro";
import { dataDentroDoIntervaloPermitido, esquemaVenda } from "./esquemas";
import { formatarReais, hojeEmBrasilia } from "./formato";
import { FRASE_FALHA_AO_SALVAR } from "./textos";

// Mesma forma de `lib/abertura/acoes.ts`/`lib/cotacoes/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// SQLSTATE 23503 = foreign_key_violation — mesmo helper de `lib/abertura/acoes.ts`/
// `lib/queimas/acoes.ts`: quando a categoria escolhida foi removida entre a montagem do
// formulário e o envio, a chave estrangeira barra a escrita e este erro vira frase humana.
function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "23503";
}

// A venda de "valor livre" à vista do traçado (Tarefa 1). `exigirUsuario()` é a PRIMEIRA
// instrução do corpo (verificado por `npm run verificar-acoes`, decidido por árvore sintática).
//
// Duas camadas independentes de defesa da soma (D-chave desta fase): esta função recalcula o
// total a partir das linhas e confere a soma das parcelas ANTES de gravar, devolvendo a frase
// humana "faltam/sobram"; a restrição adiada `conferir_soma_do_documento()` (migração 0015)
// confere de novo no fim da transação — pega defeito do próprio servidor, não só do cliente.
export async function lancarVenda(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; numero: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaVenda.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  const hoje = hojeEmBrasilia(new Date());
  if (!dataDentroDoIntervaloPermitido(dados.data, hoje)) {
    return { ok: false, erro: "Essa data não é válida." };
  }

  const totalCentavos = totalDasLinhas(dados.linhas);
  if (totalCentavos <= 0 || totalCentavos > TETO_CENTAVOS) {
    return {
      ok: false,
      erro: "O total da venda precisa ser maior que zero e até R$ 10.000.000.",
    };
  }

  const totalDasParcelas = dados.parcelas.reduce((total, parcela) => total + parcela.valorCentavos, 0);
  if (totalDasParcelas !== totalCentavos) {
    const diferenca = totalCentavos - totalDasParcelas;
    const verbo = diferenca > 0 ? "Faltam" : "Sobram";
    return {
      ok: false,
      erro: `As parcelas somam ${formatarReais(totalDasParcelas)}. ${verbo} ${formatarReais(Math.abs(diferenca))} para fechar com o total.`,
    };
  }

  for (const parcela of dados.parcelas) {
    if (parcela.pago && parcela.vencimento > hoje) {
      return {
        ok: false,
        erro:
          "Uma parcela que vence depois de hoje não pode estar paga — desmarque e registre no Caixa quando o dinheiro entrar.",
      };
    }
  }

  const configuracao = await obterConfiguracaoFinanceira();
  if (configuracao.dataSaldoInicial) {
    for (const parcela of dados.parcelas) {
      if (parcela.pago && parcela.vencimento < configuracao.dataSaldoInicial) {
        return {
          ok: false,
          erro: "Essa parcela vence antes do saldo inicial do Financeiro — confira a data.",
        };
      }
    }
  }

  // Categoria de linha livre carregada do banco: precisa existir, estar ATIVA e ser do grupo
  // `receita` (T-04.4-05 do threat model) — a categoria vinda do cliente nunca é confiada sem
  // conferência.
  const idsDeCategorias = [...new Set(dados.linhas.map((linha) => linha.categoriaId))];
  const categoriasCarregadas = await db
    .select({ id: categorias.id, ativa: categorias.ativa, grupo: categorias.grupo })
    .from(categorias)
    .where(inArray(categorias.id, idsDeCategorias));
  const categoriaPorId = new Map(categoriasCarregadas.map((categoria) => [categoria.id, categoria]));

  for (const linha of dados.linhas) {
    const categoria = categoriaPorId.get(linha.categoriaId);
    if (!categoria || !categoria.ativa || categoria.grupo !== "receita") {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não está mais disponível. Recarregue a página e tente de novo.",
      };
    }
  }

  try {
    const { id, numero } = await db.transaction(async (tx) => {
      const [documento] = await tx
        .insert(documentos)
        .values({
          tipo: "venda",
          data: dados.data,
          pessoaNome: dados.pessoa,
          criadoPor: usuario.id,
        })
        .returning({ id: documentos.id, numero: documentos.numero });

      await tx.insert(documentoLinhas).values(
        dados.linhas.map((linha, indice) => ({
          documentoId: documento.id,
          ordem: indice,
          descricao: linha.descricao,
          categoriaId: linha.categoriaId,
          valorCentavos: linha.valorCentavos,
        })),
      );

      await tx.insert(parcelas).values(
        dados.parcelas.map((parcela, indice) => {
          // Parcela paga no cartão de VENDA congela a taxa da configuração no momento do
          // pagamento (BRIEFING §5) — mudar a taxa em Cadastros depois não reescreve o passado.
          const pagaNoCartao = parcela.pago && parcela.forma === "cartao";
          return {
            documentoId: documento.id,
            numero: indice + 1,
            vencimento: parcela.vencimento,
            valorCentavos: parcela.valorCentavos,
            forma: parcela.forma,
            pagoEm: parcela.pago ? parcela.vencimento : null,
            pagoPor: parcela.pago ? usuario.id : null,
            taxaPontosBase: pagaNoCartao ? configuracao.taxaCartaoPontosBase : null,
          };
        }),
      );

      return { id: documento.id, numero: documento.numero };
    });

    return { ok: true, dados: { id, numero } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao lançar venda:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

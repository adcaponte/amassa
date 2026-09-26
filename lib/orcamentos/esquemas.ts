// Ponto único de validação do módulo Orçamentos — molde de `lib/financeiro/esquemas.ts`,
// REDECLARADO aqui (nunca importado de `@/lib/financeiro`, mesma disciplina de D-15 do projeto:
// cada módulo tem sua própria cópia).
import { z } from "zod";

import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";

import { PLANOS_DE_PAGAMENTO_DO_ORCAMENTO, type PlanoDePagamentoDoOrcamento } from "./plano";
import {
  FRASE_CLIENTE_MUITO_LONGO,
  FRASE_COR_MUITO_LONGA,
  FRASE_DESCRICAO_DO_CUSTO_MUITO_LONGA,
  FRASE_DESCRICAO_DO_CUSTO_OBRIGATORIA,
  FRASE_OBSERVACOES_MUITO_LONGAS,
  FRASE_PERSONALIZACAO_MUITO_LONGA,
  FRASE_PLANO_INVALIDO,
  FRASE_PRECO_OBRIGATORIO,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_SINAL_INVALIDO,
  FRASE_TITULO_MUITO_LONGO,
  FRASE_VALIDADE_INVALIDA,
  FRASE_VALOR_DO_CUSTO_OBRIGATORIO,
} from "./textos";

// Usado por toda ação que recebe um identificador.
export const esquemaId = z
  .string()
  .uuid("Esse identificador não é válido — recarregue a página e tente de novo.");

// "Novo orçamento" (D-06/D-21): o rascunho nasce vazio — sem cliente, sem título, sem peça — e
// esta validação só confirma que a entrada é um objeto (nenhum campo obrigatório ainda). Os
// planos seguintes (edição do rascunho) acrescentam campos aqui, sempre opcionais até "Marcar
// como enviado" exigir cliente e ao menos uma peça (D-21).
export const esquemaNovoOrcamento = z.object({});

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 — é assim que o
// `length()` do Postgres conta as restrições de `db/schema.ts` (mesma disciplina de
// `lib/financeiro/esquemas.ts`, redeclarada aqui — D-15).
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

// Ausente, vazio ou só com espaços vira `null`, nunca cadeia vazia.
function normalizarOpcional(valor: string): string | null {
  const normalizado = valor.normalize("NFC").trim();
  return normalizado === "" ? null : normalizado;
}

// Data civil `YYYY-MM-DD` — validada por regex E por reconstrução (`2026-02-30` é recusada mesmo
// tendo o formato certo). Cópia local de `lib/financeiro/esquemas.ts::dataCivilValida` (D-15).
function dataCivilValida(valor: string): boolean {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!casamento) {
    return false;
  }
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  if (mes < 1 || mes > 12 || dia < 1) {
    return false;
  }
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia <= diasNoMes;
}

const esquemaDataCivil = z.string().refine(dataCivilValida, "Essa data não é válida.");

// "Para quem e para quando" (Tarefa 2): cliente e título ficam opcionais ENQUANTO rascunho — só
// "Marcar como enviado" (plano futuro) vai exigi-los (D-21). Entrega prevista e validade são
// sempre exigidas (o rascunho já nasce com as duas, `criarOrcamento`).
export const esquemaCabecalhoDoOrcamento = z
  .object({
    id: esquemaId,
    clienteTexto: z.string(),
    tituloTexto: z.string(),
    entregaTexto: esquemaDataCivil,
    validadeTexto: z.string(),
  })
  .transform((dados, ctx) => {
    const clienteNome = normalizarOpcional(dados.clienteTexto);
    if (clienteNome && contarPontosDeCodigo(clienteNome) > 160) {
      ctx.addIssue({ code: "custom", message: FRASE_CLIENTE_MUITO_LONGO, path: ["clienteTexto"] });
      return z.NEVER;
    }
    const titulo = normalizarOpcional(dados.tituloTexto);
    if (titulo && contarPontosDeCodigo(titulo) > 160) {
      ctx.addIssue({ code: "custom", message: FRASE_TITULO_MUITO_LONGO, path: ["tituloTexto"] });
      return z.NEVER;
    }
    const validadeNormalizada = dados.validadeTexto.trim();
    const validadeDias = Number(validadeNormalizada);
    if (
      !/^\d+$/.test(validadeNormalizada) ||
      !Number.isInteger(validadeDias) ||
      validadeDias < 1 ||
      validadeDias > 365
    ) {
      ctx.addIssue({ code: "custom", message: FRASE_VALIDADE_INVALIDA, path: ["validadeTexto"] });
      return z.NEVER;
    }
    return {
      id: dados.id,
      clienteNome,
      titulo,
      entregaPrevista: dados.entregaTexto,
      validadeDias,
    };
  });

export type EntradaDeCabecalhoDoOrcamento = z.infer<typeof esquemaCabecalhoDoOrcamento>;

// "+ Peça da lista" / "+ Peça exclusiva deste pedido" (Tarefa 3, `acrescentarLinha`): só os dois
// identificadores — quantidade (sempre 1) e preço (praticado da peça, ou mínimo arredondado) são
// decididos pelo SERVIDOR dentro da transação, nunca recebidos do cliente aqui (T-04.5-29).
export const esquemaAcrescentarLinha = z.object({
  orcamentoId: esquemaId,
  fichaId: esquemaId,
});

export type EntradaDeAcrescentarLinha = z.infer<typeof esquemaAcrescentarLinha>;

// Editar uma linha já existente (`atualizarLinha`): quantidade, preço, cor e personalização — a
// ficha nunca muda de linha (é outra linha, criada por `acrescentarLinha`), então a identifica
// pelo PRÓPRIO id da linha, não pela ficha (uma mesma peça pode aparecer em mais de uma linha do
// mesmo orçamento, cada uma com cor/personalização diferente).
export const esquemaLinhaDeOrcamento = z
  .object({
    orcamentoId: esquemaId,
    id: esquemaId,
    quantidadeTexto: z.string(),
    precoTexto: z.string(),
    corTexto: z.string(),
    personalizacaoTexto: z.string(),
  })
  .transform((dados, ctx) => {
    const quantidadeNormalizada = dados.quantidadeTexto.trim();
    const quantidade = Number(quantidadeNormalizada);
    if (
      !/^\d+$/.test(quantidadeNormalizada) ||
      !Number.isInteger(quantidade) ||
      quantidade < 1 ||
      quantidade > 100000
    ) {
      ctx.addIssue({ code: "custom", message: FRASE_QUANTIDADE_INVALIDA, path: ["quantidadeTexto"] });
      return z.NEVER;
    }

    const preco = converterReaisParaCentavos(dados.precoTexto);
    if (!preco.ok) {
      ctx.addIssue({ code: "custom", message: preco.erro, path: ["precoTexto"] });
      return z.NEVER;
    }
    if (preco.centavos === null) {
      ctx.addIssue({ code: "custom", message: FRASE_PRECO_OBRIGATORIO, path: ["precoTexto"] });
      return z.NEVER;
    }

    const cor = normalizarOpcional(dados.corTexto);
    if (cor && contarPontosDeCodigo(cor) > 80) {
      ctx.addIssue({ code: "custom", message: FRASE_COR_MUITO_LONGA, path: ["corTexto"] });
      return z.NEVER;
    }
    const personalizacao = normalizarOpcional(dados.personalizacaoTexto);
    if (personalizacao && contarPontosDeCodigo(personalizacao) > 200) {
      ctx.addIssue({
        code: "custom",
        message: FRASE_PERSONALIZACAO_MUITO_LONGA,
        path: ["personalizacaoTexto"],
      });
      return z.NEVER;
    }

    return {
      orcamentoId: dados.orcamentoId,
      id: dados.id,
      quantidade,
      precoCentavos: preco.centavos,
      cor,
      personalizacao,
    };
  });

export type EntradaDeLinhaDeOrcamento = z.infer<typeof esquemaLinhaDeOrcamento>;

// "tirar" (`removerLinha`): só os dois identificadores.
export const esquemaRemoverLinha = z.object({
  orcamentoId: esquemaId,
  id: esquemaId,
});

export type EntradaDeRemoverLinha = z.infer<typeof esquemaRemoverLinha>;

// ---------------------------------------------------------------------------------------------
// "Custos do projeto e frete" / "Total e pagamento" (04.5-07-PLAN.md, Tarefa 2)
// ---------------------------------------------------------------------------------------------

// Compartilhado por `acrescentarCustoDeProjeto` (`id` ausente — a linha ainda não existe) e
// `atualizarCustoDeProjeto` (`id` presente — a linha já existe). Uma peça de custo de projeto é
// texto livre do dono (molde, protótipo, carimbo…), nunca uma entidade com nome/custo vindos de
// outra tabela — ao contrário de uma linha de peça, aqui NÃO há segunda fonte para conferir.
export const esquemaCustoDeProjeto = z
  .object({
    orcamentoId: esquemaId,
    id: esquemaId.optional(),
    descricaoTexto: z.string(),
    valorTexto: z.string(),
  })
  .transform((dados, ctx) => {
    const descricao = normalizarOpcional(dados.descricaoTexto);
    if (!descricao) {
      ctx.addIssue({ code: "custom", message: FRASE_DESCRICAO_DO_CUSTO_OBRIGATORIA, path: ["descricaoTexto"] });
      return z.NEVER;
    }
    if (contarPontosDeCodigo(descricao) > 120) {
      ctx.addIssue({ code: "custom", message: FRASE_DESCRICAO_DO_CUSTO_MUITO_LONGA, path: ["descricaoTexto"] });
      return z.NEVER;
    }

    const valor = converterReaisParaCentavos(dados.valorTexto);
    if (!valor.ok) {
      ctx.addIssue({ code: "custom", message: valor.erro, path: ["valorTexto"] });
      return z.NEVER;
    }
    if (valor.centavos === null) {
      ctx.addIssue({ code: "custom", message: FRASE_VALOR_DO_CUSTO_OBRIGATORIO, path: ["valorTexto"] });
      return z.NEVER;
    }

    return {
      orcamentoId: dados.orcamentoId,
      id: dados.id ?? null,
      descricao,
      valorCentavos: valor.centavos,
    };
  });

export type EntradaDeCustoDeProjeto = z.infer<typeof esquemaCustoDeProjeto>;

// "tirar" um custo de projeto: só os dois identificadores (mesma forma de `esquemaRemoverLinha`,
// redeclarada aqui porque `orcamento_projeto` é outra tabela, com outra guarda de recusa —
// `FRASE_CUSTO_DE_PROJETO_NAO_EXISTE_MAIS`, não `FRASE_LINHA_NAO_EXISTE_MAIS`).
export const esquemaRemoverCustoDeProjeto = z.object({
  orcamentoId: esquemaId,
  id: esquemaId,
});

export type EntradaDeRemoverCustoDeProjeto = z.infer<typeof esquemaRemoverCustoDeProjeto>;

// "Como o cliente paga" + "Sinal (%)" (`definirPlanoDePagamento`, que também grava o frete): as
// duas telas que editam plano/sinal/frete ("Total e pagamento" e "Custos do projeto e frete")
// sempre enviam o TRIO inteiro — cada componente conhece os três valores correntes do próprio
// `orcamento` (mesma disciplina de `esquemaCabecalhoDoOrcamento`, que também sempre recebe os
// quatro campos juntos) — nenhuma escrita parcial, nenhuma necessidade de "campo omitido = mantém
// o valor antigo".
export const esquemaPlanoDePagamento = z
  .object({
    orcamentoId: esquemaId,
    planoTexto: z.string(),
    sinalTexto: z.string().optional(),
    freteTexto: z.string(),
  })
  .transform((dados, ctx) => {
    if (!PLANOS_DE_PAGAMENTO_DO_ORCAMENTO.includes(dados.planoTexto as PlanoDePagamentoDoOrcamento)) {
      ctx.addIssue({ code: "custom", message: FRASE_PLANO_INVALIDO, path: ["planoTexto"] });
      return z.NEVER;
    }
    const plano = dados.planoTexto as PlanoDePagamentoDoOrcamento;

    // O sinal só faz sentido (e só é EXIGIDO) quando o plano é "sinal" — nos outros dois planos,
    // o valor enviado é ignorado (a coluna `sinal_percentual` fica como estava).
    let sinalPercentual: number | null = null;
    if (plano === "sinal") {
      const sinalNormalizado = (dados.sinalTexto ?? "").trim();
      const valor = Number(sinalNormalizado);
      if (!/^\d+$/.test(sinalNormalizado) || !Number.isInteger(valor) || valor < 1 || valor > 100) {
        ctx.addIssue({ code: "custom", message: FRASE_SINAL_INVALIDO, path: ["sinalTexto"] });
        return z.NEVER;
      }
      sinalPercentual = valor;
    }

    const frete = converterReaisParaCentavos(dados.freteTexto);
    if (!frete.ok) {
      ctx.addIssue({ code: "custom", message: frete.erro, path: ["freteTexto"] });
      return z.NEVER;
    }

    return {
      orcamentoId: dados.orcamentoId,
      plano,
      sinalPercentual,
      // Vazio vira zero (frete não é obrigatório — nem toda encomenda viaja), nunca `null`: a
      // coluna `frete_centavos` é `not null default 0`.
      freteCentavos: frete.centavos ?? 0,
    };
  });

export type EntradaDePlanoDePagamento = z.infer<typeof esquemaPlanoDePagamento>;

// "Observações para o cliente": até 300 caracteres, campo próprio — ação SEPARADA de
// `definirPlanoDePagamento` (vive num bloco de tela diferente do "Como o cliente paga"/sinal, e
// grava sozinha no próprio `onBlur`, mesma disciplina de todo campo isolado deste módulo).
export const esquemaObservacoes = z
  .object({
    orcamentoId: esquemaId,
    observacoesTexto: z.string(),
  })
  .transform((dados, ctx) => {
    const observacoes = normalizarOpcional(dados.observacoesTexto);
    if (observacoes && contarPontosDeCodigo(observacoes) > 300) {
      ctx.addIssue({ code: "custom", message: FRASE_OBSERVACOES_MUITO_LONGAS, path: ["observacoesTexto"] });
      return z.NEVER;
    }
    return { orcamentoId: dados.orcamentoId, observacoes };
  });

export type EntradaDeObservacoes = z.infer<typeof esquemaObservacoes>;

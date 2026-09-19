// Ponto único de validação do módulo Financeiro — todo caminho de escrita desta fase importa
// daqui, nenhum reimplementa a regra por conta própria (CLAUDE.md §Validação). Molde de
// `lib/abertura/esquemas.ts`/`lib/cotacoes/esquemas.ts` — REDECLARADO aqui (nunca importado de
// `@/lib/abertura` nem `@/lib/cotacoes`, D-15 do projeto: cada módulo tem sua própria cópia,
// mesma disciplina de `lib/encomendas`/`lib/queimas`).
import { z } from "zod";

import type { Desconto } from "./desconto";
import {
  converterPercentualParaPontosBase,
  converterQuantidade,
  converterReaisParaCentavos,
} from "./dinheiro";

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 (`String.length`) — é
// assim que o `length()` do Postgres conta as restrições de `db/schema.ts`.
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

function normalizarTexto(valor: string): string {
  return valor.normalize("NFC").trim();
}

// Ausente, vazio ou só com espaços vira `null`, nunca cadeia vazia.
function normalizarOpcional(valor: string | undefined | null): string | null {
  const normalizado = (valor ?? "").normalize("NFC").trim();
  return normalizado === "" ? null : normalizado;
}

// Usado por toda ação que recebe um identificador.
export const esquemaId = z
  .string()
  .uuid("Esse identificador não é válido — recarregue a página e tente de novo.");

// Data civil `YYYY-MM-DD` — validada por regex E por reconstrução (`2026-02-30` é recusada mesmo
// tendo o formato certo).
export function dataCivilValida(valor: string): boolean {
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

export const esquemaDataCivil = z.string().refine(dataCivilValida, "Essa data não é válida.");

// Datas reais entre 2020-01-01 e hoje + 366 dias — "hoje" chega por argumento (nunca lido de
// dentro de um módulo puro nem de um schema construído uma vez no import do módulo); conferido na
// AÇÃO (`lancarVenda`), não aqui, porque o esquema Zod é montado antes de qualquer requisição.
export function dataDentroDoIntervaloPermitido(data: string, hoje: string): boolean {
  if (data < "2020-01-01") {
    return false;
  }
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const limiteFuturo = new Date(Date.UTC(ano, mes - 1, dia + 366));
  const limiteFuturoIso = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(
    limiteFuturo,
  );
  return data <= limiteFuturoIso;
}

const FORMAS = ["dinheiro", "pix", "cartao"] as const;

// Formato de entrada CRU de uma linha "valor livre" — o membro original do plano 01, intocado
// pela extensão do plano 03 abaixo.
export const esquemaLinhaLivreBase = z.object({
  tipo: z.literal("livre"),
  descricao: z
    .string()
    .transform((valor) => normalizarTexto(valor))
    .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Descreva o que foi vendido.")
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 160,
      "Descrição muito longa — no máximo 160 caracteres.",
    ),
  categoriaId: esquemaId,
  valorTexto: z.string(),
});

// Formato de entrada CRU de uma linha de item do catálogo (plano 03): o servidor NUNCA confia no
// cliente para descrição/categoria — só o identificador do item, a quantidade e o texto do
// "cada" chegam daqui; `lancarVenda` (lib/financeiro/acoes.ts) busca o resto no banco.
export const esquemaLinhaItemBase = z.object({
  tipo: z.literal("item"),
  itemId: esquemaId,
  quantidade: z
    .number()
    .int("Quantidade precisa ser um número inteiro.")
    .min(1, "Quantidade mínima é 1.")
    .max(9999, "Quantidade máxima é 9999."),
  valorUnitarioTexto: z.string(),
});

// União discriminada por `tipo` — `livre` (plano 01) e `item` (plano 03).
export const esquemaLinhaDeVenda = z.discriminatedUnion("tipo", [
  esquemaLinhaLivreBase,
  esquemaLinhaItemBase,
]);

// O formato de UMA parcela — o mesmo, não importa o plano escolhido em `BlocoPagamento`
// (04.4-06-PLAN.md): à vista manda um array de 1; sinal e Nx mandam de 2 a 12; "+ outra forma"
// (D-08) manda 2 parcelas pagas na mesma data, cada uma com a própria forma. O servidor nunca
// confia no array recebido para decidir SE ele fecha com o total — isso é
// `lib/financeiro/parcelas.ts::conferirParcelas`, chamada de novo em `lancarVenda`.
export const esquemaParcelaDeVenda = z.object({
  vencimento: esquemaDataCivil,
  valorTexto: z.string(),
  forma: z.enum(FORMAS, { message: "Essa forma de pagamento não é válida." }),
  pago: z.boolean(),
});

// Desconto do total (D-09/D-10, plano 03 Tarefa 3) — opcional; ausente = sem desconto. O texto é
// convertido pela MESMA função pura usada no cliente para mostrar (`lib/financeiro/dinheiro.ts`),
// nunca uma segunda conversão.
export const esquemaDescontoEntrada = z.object({
  modo: z.enum(["reais", "percentual"], { message: "Esse tipo de desconto não é válido." }),
  texto: z.string().min(1, "Informe um valor de desconto."),
});

// Formato de entrada CRU da venda — antes da conversão de texto para centavos.
export const esquemaVendaEntrada = z.object({
  data: esquemaDataCivil,
  pessoa: z.string().optional(),
  linhas: z
    .array(esquemaLinhaDeVenda)
    .min(1, "Adicione pelo menos uma linha.")
    .max(100, "No máximo 100 linhas por venda."),
  parcelas: z
    .array(esquemaParcelaDeVenda)
    .min(1, "Adicione pelo menos uma parcela.")
    .max(12, "No máximo 12 parcelas."),
  desconto: esquemaDescontoEntrada.optional(),
});

// `valorCentavos` é o SUBTOTAL da linha (quantidade × unitário, antes de qualquer desconto) nos
// dois membros — é o campo que `lancarVenda` soma para conferir o total e que
// `lib/financeiro/desconto.ts::repartirDesconto` reparte quando há desconto.
export type LinhaDeVendaConvertida =
  | { tipo: "livre"; descricao: string; categoriaId: string; valorCentavos: number }
  | {
      tipo: "item";
      itemId: string;
      quantidade: number;
      valorUnitarioCentavos: number;
      valorCentavos: number;
    };

export type ParcelaDeVendaConvertida = {
  vencimento: string;
  valorCentavos: number;
  forma: (typeof FORMAS)[number];
  pago: boolean;
};

// O esquema COMPLETO: o texto de dinheiro vira centavos AQUI, pela função pura de
// `lib/financeiro/dinheiro.ts` — nunca uma segunda conversão em componente ou Server Action.
export const esquemaVenda = esquemaVendaEntrada.transform((dados, ctx) => {
  const pessoa = normalizarOpcional(dados.pessoa);

  const linhas: (LinhaDeVendaConvertida | null)[] = dados.linhas.map((linha, indice) => {
    if (linha.tipo === "livre") {
      const resultado = converterReaisParaCentavos(linha.valorTexto);
      if (!resultado.ok) {
        ctx.addIssue({
          code: "custom",
          message: resultado.erro,
          path: ["linhas", indice, "valorTexto"],
        });
        return null;
      }
      if (resultado.centavos === null || resultado.centavos <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Informe um valor maior que zero para esta linha.",
          path: ["linhas", indice, "valorTexto"],
        });
        return null;
      }
      return {
        tipo: "livre",
        descricao: linha.descricao,
        categoriaId: linha.categoriaId,
        valorCentavos: resultado.centavos,
      };
    }

    // `tipo === "item"`: o texto do "cada" (unitário) é convertido AQUI — quantidade já chega
    // como número validado pelo esquema (1 a 9999).
    const resultado = converterReaisParaCentavos(linha.valorUnitarioTexto);
    if (!resultado.ok) {
      ctx.addIssue({
        code: "custom",
        message: resultado.erro,
        path: ["linhas", indice, "valorUnitarioTexto"],
      });
      return null;
    }
    if (resultado.centavos === null || resultado.centavos <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o valor de cada linha.",
        path: ["linhas", indice, "valorUnitarioTexto"],
      });
      return null;
    }
    return {
      tipo: "item",
      itemId: linha.itemId,
      quantidade: linha.quantidade,
      valorUnitarioCentavos: resultado.centavos,
      valorCentavos: resultado.centavos * linha.quantidade,
    };
  });

  const parcelas: (ParcelaDeVendaConvertida | null)[] = dados.parcelas.map((parcela, indice) => {
    const resultado = converterReaisParaCentavos(parcela.valorTexto);
    if (!resultado.ok) {
      ctx.addIssue({
        code: "custom",
        message: resultado.erro,
        path: ["parcelas", indice, "valorTexto"],
      });
      return null;
    }
    if (resultado.centavos === null || resultado.centavos <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um valor maior que zero para esta parcela.",
        path: ["parcelas", indice, "valorTexto"],
      });
      return null;
    }
    return {
      vencimento: parcela.vencimento,
      valorCentavos: resultado.centavos,
      forma: parcela.forma,
      pago: parcela.pago,
    };
  });

  let desconto: Desconto | undefined;
  if (dados.desconto) {
    if (dados.desconto.modo === "reais") {
      const resultado = converterReaisParaCentavos(dados.desconto.texto);
      if (!resultado.ok) {
        ctx.addIssue({ code: "custom", message: resultado.erro, path: ["desconto", "texto"] });
      } else if (resultado.centavos === null) {
        ctx.addIssue({
          code: "custom",
          message: "Informe um valor de desconto.",
          path: ["desconto", "texto"],
        });
      } else {
        desconto = { modo: "reais", centavos: resultado.centavos };
      }
    } else {
      const resultado = converterPercentualParaPontosBase(dados.desconto.texto);
      if (!resultado.ok) {
        ctx.addIssue({ code: "custom", message: resultado.erro, path: ["desconto", "texto"] });
      } else {
        desconto = { modo: "percentual", pontosBase: resultado.pontosBase };
      }
    }
  }

  if (
    linhas.some((linha) => linha === null) ||
    parcelas.some((parcela) => parcela === null) ||
    (dados.desconto && !desconto)
  ) {
    return z.NEVER;
  }

  return {
    data: dados.data,
    pessoa,
    linhas: linhas as LinhaDeVendaConvertida[],
    parcelas: parcelas as ParcelaDeVendaConvertida[],
    desconto,
  };
});

export type EntradaDeVenda = z.infer<typeof esquemaVenda>;

// A Despesa (04.4-07-PLAN.md): dois modos, discriminados por `modo` — "compra" (linhas de
// material que controla estoque, quantos + custou ao todo) e "outra" (descrição + categoria +
// valor). `pessoa`/`parcelas` no mesmo formato da Venda (D-07/D-08 valem para as duas). O servidor
// NUNCA confia em descrição/categoria/estoque de uma linha de compra vindas do cliente — só o
// `itemId`, os textos de quantidade e valor chegam por aqui; `lancarDespesa`
// (lib/financeiro/acoes.ts) busca nome/categoria-de-compra/controla-estoque no banco.
export const esquemaLinhaDeCompra = z.object({
  itemId: esquemaId,
  quantidadeEstoqueTexto: z.string(),
  valorTotalTexto: z.string(),
});

export const esquemaDespesaCompraEntrada = z.object({
  modo: z.literal("compra"),
  data: esquemaDataCivil,
  pessoa: z.string().optional(),
  linhas: z
    .array(esquemaLinhaDeCompra)
    .min(1, "Toque em pelo menos um material que chegou.")
    .max(100, "No máximo 100 linhas por compra."),
  parcelas: z
    .array(esquemaParcelaDeVenda)
    .min(1, "Adicione pelo menos uma parcela.")
    .max(12, "No máximo 12 parcelas."),
});

export const esquemaDespesaOutraEntrada = z.object({
  modo: z.literal("outra"),
  data: esquemaDataCivil,
  pessoa: z.string().optional(),
  descricao: z
    .string()
    .transform((valor) => normalizarTexto(valor))
    .refine((valor) => contarPontosDeCodigo(valor) >= 1, "Descreva a despesa.")
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 160,
      "Descrição muito longa — no máximo 160 caracteres.",
    ),
  categoriaId: esquemaId,
  valorTexto: z.string(),
  parcelas: z
    .array(esquemaParcelaDeVenda)
    .min(1, "Adicione pelo menos uma parcela.")
    .max(12, "No máximo 12 parcelas."),
});

export const esquemaDespesaEntrada = z.discriminatedUnion("modo", [
  esquemaDespesaCompraEntrada,
  esquemaDespesaOutraEntrada,
]);

export type LinhaDeCompraConvertida = {
  itemId: string;
  quantidadeEstoque: string;
  valorCentavos: number;
};

export type EntradaDeDespesaConvertida =
  | {
      modo: "compra";
      data: string;
      pessoa: string | null;
      linhas: LinhaDeCompraConvertida[];
      parcelas: ParcelaDeVendaConvertida[];
    }
  | {
      modo: "outra";
      data: string;
      pessoa: string | null;
      descricao: string;
      categoriaId: string;
      valorCentavos: number;
      parcelas: ParcelaDeVendaConvertida[];
    };

// O esquema COMPLETO da despesa: mesma disciplina de `esquemaVenda` — texto vira centavos/
// quantidade AQUI, nunca uma segunda conversão em componente ou Server Action.
export const esquemaDespesa = esquemaDespesaEntrada.transform((dados, ctx) => {
  const pessoa = normalizarOpcional(dados.pessoa);

  const parcelas: (ParcelaDeVendaConvertida | null)[] = dados.parcelas.map((parcela, indice) => {
    const resultado = converterReaisParaCentavos(parcela.valorTexto);
    if (!resultado.ok) {
      ctx.addIssue({
        code: "custom",
        message: resultado.erro,
        path: ["parcelas", indice, "valorTexto"],
      });
      return null;
    }
    if (resultado.centavos === null || resultado.centavos <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um valor maior que zero para esta parcela.",
        path: ["parcelas", indice, "valorTexto"],
      });
      return null;
    }
    return {
      vencimento: parcela.vencimento,
      valorCentavos: resultado.centavos,
      forma: parcela.forma,
      pago: parcela.pago,
    };
  });

  if (dados.modo === "compra") {
    const linhas: (LinhaDeCompraConvertida | null)[] = dados.linhas.map((linha, indice) => {
      const resultadoQuantidade = converterQuantidade(linha.quantidadeEstoqueTexto);
      if (!resultadoQuantidade.ok) {
        ctx.addIssue({
          code: "custom",
          message: resultadoQuantidade.erro,
          path: ["linhas", indice, "quantidadeEstoqueTexto"],
        });
        return null;
      }
      const resultadoValor = converterReaisParaCentavos(linha.valorTotalTexto);
      if (!resultadoValor.ok) {
        ctx.addIssue({
          code: "custom",
          message: resultadoValor.erro,
          path: ["linhas", indice, "valorTotalTexto"],
        });
        return null;
      }
      if (resultadoValor.centavos === null || resultadoValor.centavos <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Informe quanto essa compra custou ao todo.",
          path: ["linhas", indice, "valorTotalTexto"],
        });
        return null;
      }
      return {
        itemId: linha.itemId,
        quantidadeEstoque: resultadoQuantidade.quantidade,
        valorCentavos: resultadoValor.centavos,
      };
    });

    if (linhas.some((linha) => linha === null) || parcelas.some((parcela) => parcela === null)) {
      return z.NEVER;
    }

    return {
      modo: "compra" as const,
      data: dados.data,
      pessoa,
      linhas: linhas as LinhaDeCompraConvertida[],
      parcelas: parcelas as ParcelaDeVendaConvertida[],
    };
  }

  let valorCentavos: number | null = null;
  const resultadoValor = converterReaisParaCentavos(dados.valorTexto);
  if (!resultadoValor.ok) {
    ctx.addIssue({ code: "custom", message: resultadoValor.erro, path: ["valorTexto"] });
  } else if (resultadoValor.centavos === null || resultadoValor.centavos <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Informe um valor maior que zero.",
      path: ["valorTexto"],
    });
  } else {
    valorCentavos = resultadoValor.centavos;
  }

  if (valorCentavos === null || parcelas.some((parcela) => parcela === null)) {
    return z.NEVER;
  }

  return {
    modo: "outra" as const,
    data: dados.data,
    pessoa,
    descricao: dados.descricao,
    categoriaId: dados.categoriaId,
    valorCentavos,
    parcelas: parcelas as ParcelaDeVendaConvertida[],
  };
});

export type EntradaDeDespesa = z.infer<typeof esquemaDespesa>;

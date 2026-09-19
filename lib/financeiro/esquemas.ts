// Ponto único de validação do módulo Financeiro — todo caminho de escrita desta fase importa
// daqui, nenhum reimplementa a regra por conta própria (CLAUDE.md §Validação). Molde de
// `lib/abertura/esquemas.ts`/`lib/cotacoes/esquemas.ts` — REDECLARADO aqui (nunca importado de
// `@/lib/abertura` nem `@/lib/cotacoes`, D-15 do projeto: cada módulo tem sua própria cópia,
// mesma disciplina de `lib/encomendas`/`lib/queimas`).
import { z } from "zod";

import { converterReaisParaCentavos } from "./dinheiro";

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

// Formato de entrada CRU de uma linha "valor livre" — só o tipo desta tarefa; o plano 03
// acrescenta o tipo `item` na mesma união discriminada por `tipo`, sem reescrever este membro.
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

// União discriminada por `tipo` — hoje com um membro só; o plano 03 estende com `item` sem
// reescrever `esquemaLinhaLivreBase`.
export const esquemaLinhaDeVenda = z.discriminatedUnion("tipo", [esquemaLinhaLivreBase]);

export const esquemaParcelaDeVenda = z.object({
  vencimento: esquemaDataCivil,
  valorTexto: z.string(),
  forma: z.enum(FORMAS, { message: "Essa forma de pagamento não é válida." }),
  pago: z.boolean(),
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
});

export type LinhaDeVendaConvertida = {
  tipo: "livre";
  descricao: string;
  categoriaId: string;
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
    const resultado = converterReaisParaCentavos(linha.valorTexto);
    if (!resultado.ok) {
      ctx.addIssue({ code: "custom", message: resultado.erro, path: ["linhas", indice, "valorTexto"] });
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
      tipo: linha.tipo,
      descricao: linha.descricao,
      categoriaId: linha.categoriaId,
      valorCentavos: resultado.centavos,
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

  if (linhas.some((linha) => linha === null) || parcelas.some((parcela) => parcela === null)) {
    return z.NEVER;
  }

  return {
    data: dados.data,
    pessoa,
    linhas: linhas as LinhaDeVendaConvertida[],
    parcelas: parcelas as ParcelaDeVendaConvertida[],
  };
});

export type EntradaDeVenda = z.infer<typeof esquemaVenda>;

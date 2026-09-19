// Módulo puro: o extrato do Caixa e o resumo dos tiles saem da MESMA função sobre a MESMA lista
// de movimentos — é isso que torna "o tile bate com o saldo depois do movimento mais recente"
// verdadeiro por construção (critério 7 do ROADMAP), não coincidência. Único import: `taxa.ts`,
// também puro (sem React, sem banco, sem `new Date()`).
import { liquidoDaParcela, type TipoDeDocumentoParaTaxa } from "@/lib/financeiro/taxa";

export type FormaDeMovimento = "dinheiro" | "pix" | "cartao";

export type MovimentoParaExtrato = {
  parcelaId: string;
  documentoId: string;
  numeroDocumento: number;
  numeroParcela: number;
  deQuantas: number;
  tipo: TipoDeDocumentoParaTaxa;
  // Só parcelas PAGAS entram aqui — `pagoEm` é sempre uma data civil `YYYY-MM-DD`, nunca nulo.
  pagoEm: string;
  forma: FormaDeMovimento;
  valorCentavos: number;
  taxaPontosBase?: number | null;
  cancelado: boolean;
  titulo: string;
};

export type LinhaDoExtrato = MovimentoParaExtrato & {
  liquidoCentavos: number;
  // Nulo para movimento cancelado (D-25/FNC-10): riscado no extrato, fora do saldo.
  saldoDepoisCentavos: number | null;
};

export type ExtratoMontado = {
  linhas: LinhaDoExtrato[];
  saldoAtualCentavos: number;
};

// Ordena por (pagoEm, número do documento, número da parcela) crescente — desempate determinístico
// no mesmo dia, sem depender da ordem de chegada do banco (BRIEFING §5). Acumula o líquido com
// sinal (venda soma, despesa subtrai) só dos movimentos NÃO cancelados. Nunca muta a lista
// recebida — devolve uma lista nova, ordenada, com os campos calculados.
export function montarExtrato(
  movimentos: readonly MovimentoParaExtrato[],
  saldoInicialCentavos: number,
): ExtratoMontado {
  const ordenados = [...movimentos].sort((a, b) => {
    if (a.pagoEm !== b.pagoEm) {
      return a.pagoEm < b.pagoEm ? -1 : 1;
    }
    if (a.numeroDocumento !== b.numeroDocumento) {
      return a.numeroDocumento - b.numeroDocumento;
    }
    return a.numeroParcela - b.numeroParcela;
  });

  let saldoCorrente = saldoInicialCentavos;
  const linhas = ordenados.map((movimento): LinhaDoExtrato => {
    const liquidoCentavos = liquidoDaParcela({
      tipo: movimento.tipo,
      valorCentavos: movimento.valorCentavos,
      taxaPontosBase: movimento.taxaPontosBase,
    });

    if (movimento.cancelado) {
      return { ...movimento, liquidoCentavos, saldoDepoisCentavos: null };
    }

    saldoCorrente += movimento.tipo === "venda" ? liquidoCentavos : -liquidoCentavos;
    return { ...movimento, liquidoCentavos, saldoDepoisCentavos: saldoCorrente };
  });

  return { linhas, saldoAtualCentavos: saldoCorrente };
}

export type ParcelaEmAbertoParaResumo = {
  tipo: TipoDeDocumentoParaTaxa;
  valorCentavos: number;
};

export type ResumoDoCaixa = {
  saldoCentavos: number;
  aReceberCentavos: number;
  aPagarCentavos: number;
  seTudoSeCumprirCentavos: number;
};

// Os quatro tiles do Caixa: saldo (a mesma saída de `montarExtrato`), a receber (só parcelas em
// aberto de venda), a pagar (só de despesa), "se tudo se cumprir" = saldo + a receber − a pagar.
export function resumoDoCaixa({
  saldoAtualCentavos,
  abertas,
}: {
  saldoAtualCentavos: number;
  abertas: readonly ParcelaEmAbertoParaResumo[];
}): ResumoDoCaixa {
  const aReceberCentavos = abertas
    .filter((parcela) => parcela.tipo === "venda")
    .reduce((total, parcela) => total + parcela.valorCentavos, 0);
  const aPagarCentavos = abertas
    .filter((parcela) => parcela.tipo === "despesa")
    .reduce((total, parcela) => total + parcela.valorCentavos, 0);

  return {
    saldoCentavos: saldoAtualCentavos,
    aReceberCentavos,
    aPagarCentavos,
    seTudoSeCumprirCentavos: saldoAtualCentavos + aReceberCentavos - aPagarCentavos,
  };
}

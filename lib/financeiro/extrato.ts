// Módulo puro: o extrato do Caixa e o resumo dos tiles saem da MESMA função sobre a MESMA lista
// de movimentos — é isso que torna "o tile bate com o saldo depois do movimento mais recente"
// verdadeiro por construção (critério 7 do ROADMAP), não coincidência. Único import: `taxa.ts`,
// também puro (sem React, sem banco, sem instanciar data nenhuma).
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

export type FormaDoFiltroDoExtrato = "todas" | FormaDeMovimento;

export type FiltroDoExtrato = { mes: string; forma: FormaDoFiltroDoExtrato };

// `null` quando há linha para mostrar; senão, qual dos dois vazios da cópia usar (D-11 UI-SPEC) —
// "sem-movimento" quando o mês inteiro está vazio, "sem-movimento-na-forma" quando o mês tem
// linhas mas nenhuma bate com a forma escolhida.
export type MotivoDoExtratoVazio = "sem-movimento" | "sem-movimento-na-forma" | null;

export type ExtratoFiltrado = {
  // Só as linhas do mês/forma pedidos, da mais recente para a mais antiga — `saldoDepoisCentavos`
  // de cada uma INTACTO (D-12): este módulo só ESCOLHE quais linhas mostrar, nunca recalcula saldo
  // (a filtragem acontece depois de `montarExtrato` já ter decidido o saldo global de cada linha).
  linhas: LinhaDoExtrato[];
  // Entradas líquidas − saídas das linhas visíveis não canceladas — SEMPRE numérico, inclusive em
  // "todas" (04.4-13-PLAN.md, Tarefa 2: resposta ao item 13 da conferência do dono, 26/09/2026—
  // "aparece a frase com a soma em todas categorias, mas nao na 'todas'"). Este campo nunca é
  // `null`; a POLÍTICA de esconder a frase quando não há nenhuma linha é da TELA
  // (`extrato-caixa.tsx`), nunca deste módulo — não confundir com `saldoDepoisCentavos`, que
  // continua `null` na linha cancelada (D-25/FNC-10), campo diferente com motivo diferente.
  totalFiltradoCentavos: number;
  motivoVazio: MotivoDoExtratoVazio;
};

// Recebe as linhas JÁ com o saldo global de `montarExtrato` (key_link do 04.4-09-PLAN.md) — só
// escolhe quais mostrar, na ordem inversa da entrada (que chega ascendente por `pagoEm`, o mesmo
// formato de `montarExtrato`).
export function filtrarExtrato(
  linhas: readonly LinhaDoExtrato[],
  { mes, forma }: FiltroDoExtrato,
): ExtratoFiltrado {
  const doMes = linhas.filter((linha) => linha.pagoEm.slice(0, 7) === mes);
  const filtradas = forma === "todas" ? doMes : doMes.filter((linha) => linha.forma === forma);

  // A MESMA soma vale para uma forma escolhida ou para "todas" — a única diferença é o conjunto
  // de linhas somado (`filtradas`), que já reflete o filtro de forma acima.
  const totalFiltradoCentavos = filtradas.reduce((total, linha) => {
    if (linha.cancelado) {
      return total;
    }
    return total + (linha.tipo === "venda" ? linha.liquidoCentavos : -linha.liquidoCentavos);
  }, 0);

  const motivoVazio: MotivoDoExtratoVazio =
    doMes.length === 0 ? "sem-movimento" : filtradas.length === 0 ? "sem-movimento-na-forma" : null;

  return { linhas: [...filtradas].reverse(), totalFiltradoCentavos, motivoVazio };
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

// Módulo puro: recebe dados, devolve dados. Zero imports — mesma disciplina de
// `lib/encomendas/gantt.ts` e `lib/encomendas/cronograma.ts`: nenhuma instância de `Date` entra
// nesta conta, e "hoje" nunca é lido do relógio por dentro — entra sempre como argumento. A
// aritmética de calendário (dias desde a época, algoritmo de Howard Hinnant) é duplicada aqui
// pela mesma razão que `gantt.ts` já duplica — dois módulos puros sem import não podem
// compartilhar função nenhuma.
//
// Este módulo calcula onde "hoje" cai, em percentual, dentro do período desenhado pela trilha
// do cartão mobile (`components/amassa/encomendas/trilha-segmentos.tsx`) — a marca de tempo que
// faltava na barra puramente proporcional (A2 do brief noturno).

export type FaixaDaTrilha = {
  readonly dias: number;
  readonly inicio: string;
  readonly fimExclusivo: string;
};

// Dias desde 1970-01-01 (proléptico gregoriano), a partir de ano/mês/dia civis. Mesmo algoritmo
// puro de `lib/encomendas/gantt.ts`/`lib/encomendas/cronograma.ts` (Howard Hinnant,
// "days_from_civil"), duplicado aqui porque este módulo não pode importar aquele — nenhuma
// instância de `Date` entra nesta conta.
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

function partesDeData(dataIso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return { ano, mes, dia };
}

// `dataMaisTarde` menos `dataMaisCedo`, em dias inteiros — mesma disciplina de `gantt.ts`/
// `cronograma.ts`: nunca `Date`, nunca `getTime()`.
function diferencaEmDias(dataMaisTarde: string, dataMaisCedo: string): number {
  const a = partesDeData(dataMaisTarde);
  const b = partesDeData(dataMaisCedo);
  return diasDesdeAEpoca(a.ano, a.mes, a.dia) - diasDesdeAEpoca(b.ano, b.mes, b.dia);
}

// Percentual (0 a 100) de onde "hoje" cai dentro do período desenhado pela trilha — `null`
// quando "hoje" está fora do período (ainda não começou, ou já passou do último dia
// desenhado), para o componente NUNCA grudar a marca numa ponta, o que mentiria a posição.
export function posicaoDeHojeNaTrilha(
  faixas: readonly FaixaDaTrilha[],
  hoje: string,
): number | null {
  const faixasDesenhadas = faixas.filter((faixa) => faixa.dias > 0);

  if (faixasDesenhadas.length === 0) {
    return null;
  }

  const duracaoTotal = faixasDesenhadas.reduce((total, faixa) => total + faixa.dias, 0);
  const decorridos = diferencaEmDias(hoje, faixasDesenhadas[0].inicio);

  if (decorridos < 0 || decorridos >= duracaoTotal) {
    return null;
  }

  return (decorridos / duracaoTotal) * 100;
}

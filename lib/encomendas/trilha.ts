// Módulo puro: recebe dados, devolve dados. Zero imports — mesma disciplina de
// `lib/encomendas/gantt.ts` e `lib/encomendas/cronograma.ts`: nenhuma instância de `Date` entra
// nesta conta, e "hoje" nunca é lido do relógio por dentro — entra sempre como argumento. A
// aritmética de calendário (dias desde a época, algoritmo de Howard Hinnant) é duplicada aqui
// pela mesma razão que `gantt.ts` já duplica — dois módulos puros sem import não podem
// compartilhar função nenhuma.
//
// Este módulo calcula onde "hoje" cai, em percentual, dentro do período desenhado pela trilha
// do cartão mobile (`components/amassa/encomendas/trilha-segmentos.tsx`) — a marca de tempo que
// faltava na barra puramente proporcional (A2 do brief noturno) — e, a partir da fase 04.1
// (D-09), a geometria proporcional dos SEGMENTOS e dos VÃOS de espera que essa mesma barra
// desenha: o vão é a ausência de pintura entre duas etapas, nunca um bloco tracejado ou
// hachurado próprio.

export type FaixaDaTrilha = {
  readonly etapa: string;
  readonly dias: number;
  // Quantos dias a peça ficou parada ANTES desta faixa começar (D-01/D-09) — 0 para etapa que
  // não é marco. Mesmo campo e mesmo significado de `FaixaDeEtapa.esperaDias`
  // (`lib/encomendas/cronograma.ts`), redeclarado aqui porque este módulo não importa aquele.
  readonly esperaDias: number;
  readonly inicio: string;
  readonly fimExclusivo: string;
};

// Um segmento da barra proporcional: ou uma etapa desenhada, ou o vão vazio de espera que
// antecede um marco. Discriminado por `tipo` para o componente nunca precisar adivinhar —
// mesma disciplina de `Situacao` em `cronograma.ts`.
export type SegmentoDaTrilha =
  | { tipo: "etapa"; etapa: string; dias: number; percentual: number }
  // `etapa` aqui é a etapa que o vão ANTECEDE (sempre um marco, D-03) — o vão em si não é uma
  // etapa, é o espaço entre o fim da faixa anterior e o início desta.
  | { tipo: "vao"; etapa: string; dias: number; percentual: number };

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

// A extensão de calendário do período desenhado: do `inicio` da primeira faixa desenhada ao
// `fimExclusivo` da última. Só as faixas com `dias > 0` contam como "desenhadas" — mesma regra
// de `gantt.ts`/`cronograma.ts` (etapa em 0 dias não ocupa espaço na trilha). `null` quando não
// há nenhuma faixa desenhada.
function extensaoDoPeriodo(
  faixas: readonly FaixaDaTrilha[],
): { faixasDesenhadas: readonly FaixaDaTrilha[]; extensaoTotal: number } | null {
  const faixasDesenhadas = faixas.filter((faixa) => faixa.dias > 0);

  if (faixasDesenhadas.length === 0) {
    return null;
  }

  const extensaoTotal = diferencaEmDias(
    faixasDesenhadas[faixasDesenhadas.length - 1].fimExclusivo,
    faixasDesenhadas[0].inicio,
  );

  return { faixasDesenhadas, extensaoTotal };
}

// Percentual (0 a 100) de onde "hoje" cai dentro do período desenhado pela trilha — `null`
// quando "hoje" está fora do período (ainda não começou, ou já passou do último dia
// desenhado), para o componente NUNCA grudar a marca numa ponta, o que mentiria a posição.
//
// O denominador é a EXTENSÃO DE CALENDÁRIO do período (fimExclusivo da última faixa desenhada
// menos inicio da primeira), NUNCA a soma de `dias` das faixas desenhadas — as duas coincidiam
// antes da fase 04.1, porque as faixas eram contíguas. Com os vãos de espera (D-01/D-09) a
// soma de `dias` deixou de ser o período: uma encomenda de 32 dias de calendário só soma 24
// dias de etapa (os outros 8 são espera), e um "hoje" no 27º dia — dentro de um vão — caía fora
// do denominador antigo e devolvia `null` por engano, sumindo a marca no meio da encomenda. Não
// "otimize" isto de volta para soma de `dias`.
export function posicaoDeHojeNaTrilha(
  faixas: readonly FaixaDaTrilha[],
  hoje: string,
): number | null {
  const periodo = extensaoDoPeriodo(faixas);

  if (periodo === null) {
    return null;
  }

  const { faixasDesenhadas, extensaoTotal } = periodo;
  const decorridos = diferencaEmDias(hoje, faixasDesenhadas[0].inicio);

  if (decorridos < 0 || decorridos >= extensaoTotal) {
    return null;
  }

  return (decorridos / extensaoTotal) * 100;
}

// A geometria proporcional inteira da barra da trilha, em ordem de calendário: um item de
// `tipo: "etapa"` por etapa desenhada, e um item de `tipo: "vao"` por espera maior que 0,
// imediatamente antes da etapa (sempre um marco) que ela antecede. O percentual de cada item é
// `dias do item / extensaoTotal × 100`, com a mesma extensão de `posicaoDeHojeNaTrilha` — soma
// sempre 100 (tolerância de ponto flutuante), sem sobreposição, porque cada dia do período
// pertence a exatamente um item (etapa OU vão, nunca os dois).
//
// O vão em si não recebe nenhum campo de cor/desenho — D-09 proíbe explicitamente inventar
// bloco tracejado ou hachurado próprio: é o componente que decide desenhá-lo como ausência de
// pintura, este módulo só devolve a proporção e a etapa que ele antecede.
export function segmentosDaTrilha(faixas: readonly FaixaDaTrilha[]): SegmentoDaTrilha[] {
  const periodo = extensaoDoPeriodo(faixas);

  if (periodo === null) {
    return [];
  }

  const { faixasDesenhadas, extensaoTotal } = periodo;
  const segmentos: SegmentoDaTrilha[] = [];

  for (const faixa of faixasDesenhadas) {
    if (faixa.esperaDias > 0) {
      segmentos.push({
        tipo: "vao",
        etapa: faixa.etapa,
        dias: faixa.esperaDias,
        percentual: (faixa.esperaDias / extensaoTotal) * 100,
      });
    }

    segmentos.push({
      tipo: "etapa",
      etapa: faixa.etapa,
      dias: faixa.dias,
      percentual: (faixa.dias / extensaoTotal) * 100,
    });
  }

  return segmentos;
}

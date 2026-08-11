// Módulo puro: recebe dados, devolve dados. Zero imports (regra de `lib/encomendas/cronograma.ts`,
// CLAUDE.md §Regras de negócio) — nem React, nem cliente de banco, nem `date-fns`, nem
// `lib/queimas/formato.ts`. Cada `diaCivil` chega JÁ convertido pelo chamador (`diaCivilEmBrasilia`,
// `lib/queimas/formato.ts`) — este módulo nunca lê `ocorrida_em` bruto nem toca em `Date`/`getDay()`,
// que é sensível ao fuso do runtime (04-CONTEXT.md §Specifics, a armadilha de fuso desta fase).
// "Hoje" nunca é lido do relógio por dentro — sempre chega como argumento (mesma disciplina de
// `cronograma.ts`).
//
// A semana começa na SEGUNDA em America/Sao_Paulo (04-CONTEXT.md, decisão já fechada:
// "semana começa na segunda ((getDay() + 6) % 7)"). "8 semanas" são 8 baldes de 7 dias a partir do
// início da semana de `hoje − 49 dias` (a semana de hoje é sempre o último balde, porque 49 = 7×7).
// "6 meses" são meses civis — o atual mais os cinco anteriores. Uma queima entra num balde quando
// `inicio <= diaCivil < fim` — o balde é SEMIABERTO (edge probe FOR-12/boundary).

export type TipoDeQueimaRelatorio = "biscoito" | "esmalte" | "ouro";

export type QueimaParaAgregacao = {
  readonly diaCivil: string; // YYYY-MM-DD, dia civil de Brasília — já convertido pelo chamador
  readonly tipo: TipoDeQueimaRelatorio;
};

export type LimiteDeBalde = {
  readonly inicio: string; // YYYY-MM-DD, inclusive
  readonly fimExclusivo: string; // YYYY-MM-DD, exclusivo
};

export type BaldeDeQueimas = {
  readonly inicio: string;
  readonly biscoito: number;
  readonly esmalte: number;
  readonly ouro: number;
  readonly total: number;
};

export type QueimaParaAgregacaoPorForno = {
  readonly fornoId: string;
  readonly fornoNome: string;
};

export type BarraDeForno = {
  readonly fornoId: string;
  readonly fornoNome: string;
  readonly total: number;
};

export type EstatisticasDeQueimas = {
  readonly total: number;
  readonly ultimos30Dias: number;
  readonly biscoito: number;
  readonly esmalte: number;
};

// Dias desde 1970-01-01 (proléptico gregoriano) — mesmo algoritmo de calendário puro
// (Howard Hinnant, "days_from_civil") de `lib/encomendas/cronograma.ts`, duplicado aqui em vez de
// importado (04-PATTERNS.md: "a disciplina de módulos puros duplica a aritmética de calendário em
// vez de importar o irmão" — mesma decisão de `lib/encomendas/filtros.ts`/`gantt.ts`). Nenhuma
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

// Inverso de `diasDesdeAEpoca`: de um número de dias desde a época devolve `{ano, mes, dia}` civis.
function civilDesdeDias(diasDesdeEpoca: number): { ano: number; mes: number; dia: number } {
  const z = diasDesdeEpoca + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const diaDoEra = z - era * 146097;
  const anoDoEra = Math.floor(
    (diaDoEra -
      Math.floor(diaDoEra / 1460) +
      Math.floor(diaDoEra / 36524) -
      Math.floor(diaDoEra / 146096)) /
      365,
  );
  const anoAjustado = anoDoEra + era * 400;
  const diaDoAno = diaDoEra - (365 * anoDoEra + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100));
  const mesProvisorio = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mesProvisorio + 2) / 5) + 1;
  const mes = mesProvisorio + (mesProvisorio < 10 ? 3 : -9);
  const ano = mes <= 2 ? anoAjustado + 1 : anoAjustado;
  return { ano, mes, dia };
}

function formatarDataCivil(ano: number, mes: number, dia: number): string {
  const anoTexto = String(ano).padStart(4, "0");
  const mesTexto = String(mes).padStart(2, "0");
  const diaTexto = String(dia).padStart(2, "0");
  return `${anoTexto}-${mesTexto}-${diaTexto}`;
}

function partesDeData(dataIso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return { ano, mes, dia };
}

function diasDesdeAEpocaDeTexto(diaCivil: string): number {
  const { ano, mes, dia } = partesDeData(diaCivil);
  return diasDesdeAEpoca(ano, mes, dia);
}

function civilDesdeDiasTexto(diasDesdeEpoca: number): string {
  const { ano, mes, dia } = civilDesdeDias(diasDesdeEpoca);
  return formatarDataCivil(ano, mes, dia);
}

// Soma `dias` dias de calendário (pode ser negativo) a uma data civil `YYYY-MM-DD`.
function somarDias(diaCivil: string, dias: number): string {
  return civilDesdeDiasTexto(diasDesdeAEpocaDeTexto(diaCivil) + dias);
}

// Dia da semana com SEGUNDA = 0 (04-CONTEXT.md: "(getDay() + 6) % 7", `getDay()` com domingo=0).
// `diasDesdeAEpoca` conta a partir de 1970-01-01, uma QUINTA — nunca `new Date(...).getDay()`,
// que é sensível ao fuso do processo (a armadilha desta fase). `((d + 3) % 7 + 7) % 7` deriva o
// índice segunda-zero diretamente da contagem de dias, com o duplo módulo cobrindo `d` negativo
// (datas antes da época).
function diaDaSemanaSegundaZero(diasDesdeEpoca: number): number {
  return (((diasDesdeEpoca + 3) % 7) + 7) % 7;
}

// A segunda-feira da semana à qual `diaCivil` pertence — "8 semanas" (Tarefa 2, FOR-12).
export function inicioDaSemana(diaCivil: string): string {
  const dias = diasDesdeAEpocaDeTexto(diaCivil);
  return civilDesdeDiasTexto(dias - diaDaSemanaSegundaZero(dias));
}

export function janelaDeOitoSemanas(hoje: string): LimiteDeBalde[] {
  const inicioDaSemanaDeHoje = diasDesdeAEpocaDeTexto(inicioDaSemana(hoje));
  const limites: LimiteDeBalde[] = [];
  for (let indice = 0; indice < 8; indice++) {
    // indice 0 = balde mais antigo (7 semanas atrás), indice 7 = semana de hoje.
    const inicioDoBalde = inicioDaSemanaDeHoje - (7 - indice) * 7;
    limites.push({
      inicio: civilDesdeDiasTexto(inicioDoBalde),
      fimExclusivo: civilDesdeDiasTexto(inicioDoBalde + 7),
    });
  }
  return limites;
}

// Subtrai `n` meses civis de `{ano, mes}`, devolvendo outro par `{ano, mes}` — sem `Date`, cobre
// virada de ano em qualquer direção (n negativo = somar meses).
function mesMenosN(ano: number, mes: number, n: number): { ano: number; mes: number } {
  const indiceZeroBase = mes - 1 - n;
  const anoAjustado = ano + Math.floor(indiceZeroBase / 12);
  const mesAjustado = (((indiceZeroBase % 12) + 12) % 12) + 1;
  return { ano: anoAjustado, mes: mesAjustado };
}

export function janelaDeSeisMeses(hoje: string): LimiteDeBalde[] {
  const { ano, mes } = partesDeData(hoje);
  const limites: LimiteDeBalde[] = [];
  for (let indice = 0; indice < 6; indice++) {
    // indice 0 = 5 meses atrás, indice 5 = mês de hoje.
    const distancia = 5 - indice;
    const { ano: anoDoBalde, mes: mesDoBalde } = mesMenosN(ano, mes, distancia);
    const { ano: anoDoProximo, mes: mesDoProximo } = mesMenosN(ano, mes, distancia - 1);
    limites.push({
      inicio: formatarDataCivil(anoDoBalde, mesDoBalde, 1),
      fimExclusivo: formatarDataCivil(anoDoProximo, mesDoProximo, 1),
    });
  }
  return limites;
}

// Acumulador mutável interno — `BaldeDeQueimas` é `readonly` no contrato público; esta função
// escreve nos campos enquanto agrega e devolve o resultado já congelado por estrutura.
type BaldeMutavel = { inicio: string; biscoito: number; esmalte: number; ouro: number; total: number };

function baldeVazio(inicio: string): BaldeMutavel {
  return { inicio, biscoito: 0, esmalte: 0, ouro: 0, total: 0 };
}

// Aplica as queimas aos limites já calculados — usada por `agregarPorSemana`/`agregarPorMes`.
// Uma queima fora de todos os limites (não deveria acontecer, já que `consultas.ts` carrega
// exatamente a janela mais longa) é simplesmente ignorada, nunca lança.
function agregarEmBaldes(
  queimas: readonly QueimaParaAgregacao[],
  limites: readonly LimiteDeBalde[],
): BaldeDeQueimas[] {
  const baldes: BaldeMutavel[] = limites.map((limite) => baldeVazio(limite.inicio));

  for (const queima of queimas) {
    const indice = limites.findIndex(
      (limite) => limite.inicio <= queima.diaCivil && queima.diaCivil < limite.fimExclusivo,
    );
    if (indice === -1) {
      continue;
    }
    const balde = baldes[indice];
    balde[queima.tipo] += 1;
    balde.total += 1;
  }

  return baldes;
}

export function agregarPorSemana(
  queimas: readonly QueimaParaAgregacao[],
  hoje: string,
): BaldeDeQueimas[] {
  return agregarEmBaldes(queimas, janelaDeOitoSemanas(hoje));
}

export function agregarPorMes(
  queimas: readonly QueimaParaAgregacao[],
  hoje: string,
): BaldeDeQueimas[] {
  return agregarEmBaldes(queimas, janelaDeSeisMeses(hoje));
}

// Barras horizontais por forno — soma total (todos os tipos), um item por forno distinto. A
// ordem não é uma garantia de contrato (o componente decide como ordenar as barras); esta função
// só agrupa.
export function agregarPorForno(
  queimas: readonly QueimaParaAgregacaoPorForno[],
): BarraDeForno[] {
  const mapa = new Map<string, BarraDeForno>();
  for (const queima of queimas) {
    const atual = mapa.get(queima.fornoId);
    if (atual) {
      mapa.set(queima.fornoId, { ...atual, total: atual.total + 1 });
    } else {
      mapa.set(queima.fornoId, { fornoId: queima.fornoId, fornoNome: queima.fornoNome, total: 1 });
    }
  }
  return [...mapa.values()];
}

// As quatro estatísticas do topo (E9): total geral, total dos últimos 30 dias civis (janela
// inclusiva de 30 dias terminando em `hoje`, ou seja `[hoje - 29, hoje]`) e a contagem dos dois
// primeiros tipos (biscoito, esmalte) — sobre TODO o conjunto recebido, não só a janela de 30
// dias (o mesmo conjunto que alimenta os gráficos, carregado uma vez por `consultas.ts`).
export function estatisticasDeQueimas(
  queimas: readonly QueimaParaAgregacao[],
  hoje: string,
): EstatisticasDeQueimas {
  const dataDeCorte = somarDias(hoje, -29);

  let ultimos30Dias = 0;
  let biscoito = 0;
  let esmalte = 0;

  for (const queima of queimas) {
    if (queima.diaCivil >= dataDeCorte && queima.diaCivil <= hoje) {
      ultimos30Dias += 1;
    }
    if (queima.tipo === "biscoito") {
      biscoito += 1;
    } else if (queima.tipo === "esmalte") {
      esmalte += 1;
    }
  }

  return { total: queimas.length, ultimos30Dias, biscoito, esmalte };
}

// Módulo puro: recebe dados, devolve dados. Zero imports — nem de `lib/encomendas/cronograma.ts`,
// que é o segundo módulo puro desta fase. Os tipos que ele precisa (uma faixa de etapa, um
// cronograma) entram como parâmetros estruturais compatíveis, redeclarados localmente; a
// aritmética de calendário (dias desde a época, algoritmo de Howard Hinnant) é duplicada aqui
// pela mesma razão — dois módulos puros sem import não podem compartilhar função nenhuma.
//
// A geometria do Gantt — 18px/dia, quinzenas, o limiar de 46px do rótulo, a posição da linha de
// "Hoje" — é a regra que `04-DESIGN-SYSTEM.md` §8 e `00-BRIEFING.md` §5 preservam do protótipo
// `gestor-ceramica.html` literalmente. `hoje` nunca é lido do relógio por dentro: entra sempre
// como argumento.

export const PIXELS_POR_DIA = 18;
export const LARGURA_MINIMA_PARA_ROTULO = 46;

export type IntervaloDaTimeline = {
  primeiroDia: string;
  ultimoDiaExclusivo: string;
  totalDeDias: number;
  larguraEmPixels: number;
};

export type CelulaDeQuinzena = {
  chave: string;
  rotulo: string;
  inicio: string;
  dias: number;
  esquerda: number;
  largura: number;
};

export type RetanguloDeEtapa = {
  esquerda: number;
  largura: number;
  mostrarRotulo: boolean;
};

// Dias desde 1970-01-01 (proléptico gregoriano), a partir de ano/mês/dia civis. Mesmo algoritmo
// puro de `lib/encomendas/cronograma.ts` (Howard Hinnant, "days_from_civil"), duplicado aqui
// porque este módulo não pode importar aquele — nenhuma instância de `Date` entra nesta conta.
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

// Inverso de `diasDesdeAEpoca` ("civil_from_days"), mesma ausência de `Date`.
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
  const diaDoAno =
    diaDoEra - (365 * anoDoEra + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100));
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

function somarDias(dataIso: string, dias: number): string {
  const { ano, mes, dia } = partesDeData(dataIso);
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(
    diasDesdeAEpoca(ano, mes, dia) + dias,
  );
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// `dataMaisTarde` menos `dataMaisCedo`, em dias inteiros — mesma disciplina de
// `lib/encomendas/cronograma.ts`: nunca `Date`, nunca `getTime()`.
function diferencaEmDias(dataMaisTarde: string, dataMaisCedo: string): number {
  const a = partesDeData(dataMaisTarde);
  const b = partesDeData(dataMaisCedo);
  return diasDesdeAEpoca(a.ano, a.mes, a.dia) - diasDesdeAEpoca(b.ano, b.mes, b.dia);
}

function ultimoDiaDoMes(ano: number, mes: number): string {
  const proximoMes = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  return somarDias(formatarDataCivil(proximoMes.ano, proximoMes.mes, 1), -1);
}

// A quinzena (1–15 ou 16–fim do mês) que contém `dataIso`, com seu primeiro e último dia
// civis. É a unidade que o cabeçalho do Gantt desenha e que a folga de abertura/fechamento do
// intervalo usa (00-BRIEFING.md §5).
function quinzenaQueContem(dataIso: string): { primeiroDia: string; ultimoDia: string } {
  const { ano, mes, dia } = partesDeData(dataIso);

  if (dia <= 15) {
    return { primeiroDia: formatarDataCivil(ano, mes, 1), ultimoDia: formatarDataCivil(ano, mes, 15) };
  }

  return { primeiroDia: formatarDataCivil(ano, mes, 16), ultimoDia: ultimoDiaDoMes(ano, mes) };
}

// A quinzena imediatamente anterior à que contém `dataIso` — segunda metade do mês anterior
// quando `dataIso` cai na primeira metade do seu mês; primeira metade do mesmo mês quando cai
// na segunda.
function quinzenaAnterior(dataIso: string): { primeiroDia: string; ultimoDia: string } {
  const { ano, mes, dia } = partesDeData(dataIso);

  if (dia <= 15) {
    const mesAnterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
    return {
      primeiroDia: formatarDataCivil(mesAnterior.ano, mesAnterior.mes, 16),
      ultimoDia: ultimoDiaDoMes(mesAnterior.ano, mesAnterior.mes),
    };
  }

  return { primeiroDia: formatarDataCivil(ano, mes, 1), ultimoDia: formatarDataCivil(ano, mes, 15) };
}

// A quinzena imediatamente posterior à que contém `dataIso` — segunda metade do mesmo mês
// quando `dataIso` cai na primeira metade; primeira metade do mês seguinte quando cai na
// segunda.
function quinzenaPosterior(dataIso: string): { primeiroDia: string; ultimoDia: string } {
  const { ano, mes, dia } = partesDeData(dataIso);

  if (dia <= 15) {
    return { primeiroDia: formatarDataCivil(ano, mes, 16), ultimoDia: ultimoDiaDoMes(ano, mes) };
  }

  const mesSeguinte = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  return {
    primeiroDia: formatarDataCivil(mesSeguinte.ano, mesSeguinte.mes, 1),
    ultimoDia: formatarDataCivil(mesSeguinte.ano, mesSeguinte.mes, 15),
  };
}

// Extensão automática do Gantt: cobre todas as encomendas desenhadas (`inicio`/`fimExclusivo`
// de cada `Cronograma`, passados estruturalmente) mais uma quinzena de folga em cada ponta
// (00-BRIEFING.md §5). Com a lista vazia, usa `hoje` no lugar das duas pontas — nunca largura 0.
export function calcularIntervalo(
  cronogramas: readonly { readonly inicio: string; readonly fimExclusivo: string }[],
  hoje: string,
): IntervaloDaTimeline {
  let menorInicio = hoje;
  let maiorFimExclusivo = hoje;

  for (const cronograma of cronogramas) {
    if (cronograma.inicio < menorInicio) {
      menorInicio = cronograma.inicio;
    }
    if (cronograma.fimExclusivo > maiorFimExclusivo) {
      maiorFimExclusivo = cronograma.fimExclusivo;
    }
  }

  const primeiroDia = quinzenaAnterior(menorInicio).primeiroDia;
  const posterior = quinzenaPosterior(maiorFimExclusivo);
  const ultimoDiaExclusivo = somarDias(posterior.ultimoDia, 1);
  const totalDeDias = diferencaEmDias(ultimoDiaExclusivo, primeiroDia);

  return {
    primeiroDia,
    ultimoDiaExclusivo,
    totalDeDias,
    larguraEmPixels: totalDeDias * PIXELS_POR_DIA,
  };
}

// Deslocamento em pixels de `dia` (data civil) desde `intervalo.primeiroDia` — a régua de
// 18px/dia que todo o resto do módulo usa para não multiplicar por 18 em lugar nenhum fora
// daqui.
export function deslocamentoEmPixels(intervalo: IntervaloDaTimeline, dia: string): number {
  return diferencaEmDias(dia, intervalo.primeiroDia) * PIXELS_POR_DIA;
}

// As células de quinzena que formam o cabeçalho do Gantt, cobrindo `intervalo` inteiro sem vão
// e sem sobreposição — a soma de `largura` de todas as células é sempre igual a
// `intervalo.larguraEmPixels`. A primeira e a última célula podem ser quinzenas parciais quando
// `intervalo.primeiroDia`/`ultimoDiaExclusivo` não caem exatamente em dia 1 ou 16.
//
// `formatarMes` é injetado (em vez de `gantt.ts` importar `lib/encomendas/formato.ts`) para
// manter este módulo sem import — a célula sai pronta para desenhar, com o rótulo já montado.
export function celulasDeQuinzena(
  intervalo: IntervaloDaTimeline,
  formatarMes: (dia: string) => string,
): CelulaDeQuinzena[] {
  const celulas: CelulaDeQuinzena[] = [];
  let cursor = intervalo.primeiroDia;
  let esquerda = 0;

  while (cursor < intervalo.ultimoDiaExclusivo) {
    const quinzena = quinzenaQueContem(cursor);
    const fimExclusivoDaQuinzena = somarDias(quinzena.ultimoDia, 1);
    const fimExclusivoDaCelula =
      fimExclusivoDaQuinzena < intervalo.ultimoDiaExclusivo
        ? fimExclusivoDaQuinzena
        : intervalo.ultimoDiaExclusivo;

    const dias = diferencaEmDias(fimExclusivoDaCelula, cursor);
    const largura = dias * PIXELS_POR_DIA;
    const { ano, mes, dia: diaInicio } = partesDeData(cursor);
    const { dia: diaFim } = partesDeData(somarDias(fimExclusivoDaCelula, -1));

    celulas.push({
      chave: `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${diaInicio <= 15 ? "1" : "2"}`,
      rotulo: `${diaInicio}–${diaFim} ${formatarMes(cursor)}`,
      inicio: cursor,
      dias,
      esquerda,
      largura,
    });

    esquerda += largura;
    cursor = fimExclusivoDaCelula;
  }

  return celulas;
}

// O retângulo (ou losango, na hora de desenhar) de uma etapa: posição e largura em pixels, e
// se o rótulo cabe dentro dela. `null` quando `faixa.dias === 0` — nem losango, nem retângulo,
// nem espaço reservado (etapa desligada não ocupa o Gantt).
export function retanguloDaEtapa(
  faixa: { readonly dias: number; readonly inicio: string },
  intervalo: IntervaloDaTimeline,
): RetanguloDeEtapa | null {
  if (faixa.dias === 0) {
    return null;
  }

  const esquerda = deslocamentoEmPixels(intervalo, faixa.inicio);
  const largura = faixa.dias * PIXELS_POR_DIA;

  return {
    esquerda,
    largura,
    // Estritamente "mais de 46px" (04-DESIGN-SYSTEM.md §8) — `>=` deixaria uma barra de
    // exatos 46px mostrar rótulo por engano, e passaria despercebido para sempre.
    mostrarRotulo: largura > LARGURA_MINIMA_PARA_ROTULO,
  };
}

// A rolagem horizontal inicial do Gantt: abre com "Hoje" aproximadamente centralizada, sem
// nunca rolar para um valor negativo nem além do máximo rolável (larguraEmPixels -
// larguraVisivel). Sempre um inteiro — `scrollLeft` fracionário produziria meia-coluna de
// deslocamento.
export function rolagemInicial(
  intervalo: IntervaloDaTimeline,
  hoje: string,
  larguraVisivel: number,
): number {
  const maximo = Math.max(0, intervalo.larguraEmPixels - larguraVisivel);
  const centralizado = Math.round(deslocamentoEmPixels(intervalo, hoje) - larguraVisivel / 2);

  return Math.min(Math.max(centralizado, 0), maximo);
}

// Ordena a lista de encomendas para o Gantt: `dataInicio` ascendente, desempatando por `nome`
// (`localeCompare('pt-BR')`) e, em último caso, por `id` — duas encomendas com a mesma data têm
// ordem determinística, nunca a ordem que o banco devolveu por acaso.
export function ordenarParaGantt<
  T extends { readonly dataInicio: string; readonly nome: string; readonly id: string },
>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.dataInicio !== b.dataInicio) {
      return a.dataInicio < b.dataInicio ? -1 : 1;
    }

    const porNome = a.nome.localeCompare(b.nome, "pt-BR");
    if (porNome !== 0) {
      return porNome;
    }

    return a.id.localeCompare(b.id);
  });
}

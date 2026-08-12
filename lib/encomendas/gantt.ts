// Módulo puro: recebe dados, devolve dados. Zero imports — nem de `lib/encomendas/cronograma.ts`,
// que é o segundo módulo puro desta fase. Os tipos que ele precisa (uma faixa de etapa, um
// cronograma) entram como parâmetros estruturais compatíveis, redeclarados localmente; a
// aritmética de calendário (dias desde a época, algoritmo de Howard Hinnant) é duplicada aqui
// pela mesma razão — dois módulos puros sem import não podem compartilhar função nenhuma.
//
// A geometria do Gantt — 18px/dia, semanas começando na SEGUNDA, o limiar de 46px do rótulo, a
// posição da linha de "Hoje" — é a regra que `04-DESIGN-SYSTEM.md` §8 e `00-BRIEFING.md` §5
// preservam do protótipo `gestor-ceramica.html`. `hoje` nunca é lido do relógio por dentro:
// entra sempre como argumento.
//
// A timeline abre em HOJE (brief noturno, item A3, DECIDIDO) — a parte passada de uma encomenda
// em curso fica fora do intervalo desenhado, com marca de corte na borda esquerda
// (`retanguloDaEtapa`/`cortadaNaEsquerda`). Não há mais folga na ponta inicial; a folga
// permanece só no fim (uma semana), para a timeline nunca terminar rente à última etapa.

export const PIXELS_POR_DIA = 18;
export const LARGURA_MINIMA_PARA_ROTULO = 46;

export type IntervaloDaTimeline = {
  primeiroDia: string;
  ultimoDiaExclusivo: string;
  totalDeDias: number;
  larguraEmPixels: number;
};

export type CelulaDeSemana = {
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
  // `true` quando a etapa começou antes de `intervalo.primeiroDia` (encomenda em curso cuja
  // parte passada não é desenhada) — o componente usa este campo para marcar a borda de corte,
  // visual e no `aria-label` (A3 do brief noturno).
  cortadaNaEsquerda: boolean;
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

// A segunda-feira da semana que contém `diasDesdeEpoca` — 1970-01-01 (dia 0) foi uma QUINTA, o
// que desloca a fórmula de "dia da semana" de um `Date` comum. Verificado: dia 0 → -3 (segunda,
// 29/12/1969); dia 4 → 4 (segunda, 05/01/1970). O resto do dobro-módulo (`% 7` seguido de outro
// `% 7`) garante um resultado sempre não negativo mesmo com `diasDesdeEpoca` negativo, onde o
// resto de JavaScript por si só devolveria um número negativo.
function segundaDaSemanaEmDias(diasDesdeEpoca: number): number {
  return diasDesdeEpoca - (((diasDesdeEpoca + 3) % 7) + 7) % 7;
}

// A semana (segunda a domingo) que contém `dataIso` — mesma convenção de início de semana que a
// Fase 4 usa nos relatórios de queima (FOR-12); duas definições de semana no mesmo sistema seria
// dívida imediata. `ultimoDia` é sempre `primeiroDia + 6`.
function semanaQueContem(dataIso: string): { primeiroDia: string; ultimoDia: string } {
  const { ano, mes, dia } = partesDeData(dataIso);
  const segunda = segundaDaSemanaEmDias(diasDesdeAEpoca(ano, mes, dia));
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(segunda);
  const primeiroDia = formatarDataCivil(anoSaida, mesSaida, diaSaida);
  return { primeiroDia, ultimoDia: somarDias(primeiroDia, 6) };
}

// A semana imediatamente posterior à que contém `dataIso`.
function semanaPosterior(dataIso: string): { primeiroDia: string; ultimoDia: string } {
  const semanaAtual = semanaQueContem(dataIso);
  const primeiroDia = somarDias(semanaAtual.ultimoDia, 1);
  return { primeiroDia, ultimoDia: somarDias(primeiroDia, 6) };
}

// Extensão automática do Gantt: a timeline ABRE EM HOJE (00-BRIEFING.md §5, A3 do brief
// noturno) — `primeiroDia` é sempre a segunda-feira da semana de `hoje`, independentemente de
// quão antiga seja a encomenda mais antiga; a parte passada de uma encomenda em curso fica fora
// do intervalo desenhado, com marca de corte (`retanguloDaEtapa`/`cortadaNaEsquerda`). O fim
// cobre todas as encomendas desenhadas (`fimExclusivo` de cada `Cronograma`, passado
// estruturalmente) mais uma semana de folga. Com a lista vazia, usa `hoje` no lugar da ponta
// final — nunca largura 0.
export function calcularIntervalo(
  cronogramas: readonly { readonly inicio: string; readonly fimExclusivo: string }[],
  hoje: string,
): IntervaloDaTimeline {
  let maiorFimExclusivo = hoje;

  for (const cronograma of cronogramas) {
    if (cronograma.fimExclusivo > maiorFimExclusivo) {
      maiorFimExclusivo = cronograma.fimExclusivo;
    }
  }

  const primeiroDia = semanaQueContem(hoje).primeiroDia;
  const posterior = semanaPosterior(maiorFimExclusivo);
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

// As células de semana que formam o cabeçalho do Gantt, cobrindo `intervalo` inteiro sem vão e
// sem sobreposição — a soma de `largura` de todas as células é sempre igual a
// `intervalo.larguraEmPixels`. A última célula pode ser uma semana parcial quando
// `intervalo.ultimoDiaExclusivo` não cai exatamente numa segunda-feira; a primeira nunca é
// parcial porque `intervalo.primeiroDia` já é sempre segunda (`calcularIntervalo`).
//
// `formatarMes` é injetado (em vez de `gantt.ts` importar `lib/encomendas/formato.ts`) para
// manter este módulo sem import — a célula sai pronta para desenhar, com o rótulo já montado.
export function celulasDeSemana(
  intervalo: IntervaloDaTimeline,
  formatarMes: (dia: string) => string,
): CelulaDeSemana[] {
  const celulas: CelulaDeSemana[] = [];
  let cursor = intervalo.primeiroDia;
  let esquerda = 0;

  while (cursor < intervalo.ultimoDiaExclusivo) {
    const semana = semanaQueContem(cursor);
    const fimExclusivoDaSemana = somarDias(semana.ultimoDia, 1);
    const fimExclusivoDaCelula =
      fimExclusivoDaSemana < intervalo.ultimoDiaExclusivo
        ? fimExclusivoDaSemana
        : intervalo.ultimoDiaExclusivo;

    const dias = diferencaEmDias(fimExclusivoDaCelula, cursor);
    const largura = dias * PIXELS_POR_DIA;
    const { ano: anoInicio, mes: mesInicio, dia: diaInicio } = partesDeData(cursor);
    const ultimoDiaDaCelula = somarDias(fimExclusivoDaCelula, -1);
    const { ano: anoFim, mes: mesFim, dia: diaFim } = partesDeData(ultimoDiaDaCelula);
    const mesmoMes = anoInicio === anoFim && mesInicio === mesFim;

    celulas.push({
      chave: cursor,
      rotulo: mesmoMes
        ? `${diaInicio}–${diaFim} ${formatarMes(ultimoDiaDaCelula)}`
        : `${diaInicio} ${formatarMes(cursor)}–${diaFim} ${formatarMes(ultimoDiaDaCelula)}`,
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

// O retângulo (ou losango, na hora de desenhar) de uma etapa: posição e largura em pixels, e se
// o rótulo cabe dentro dela. `null` quando `faixa.dias === 0` (nem losango, nem retângulo, nem
// espaço reservado) ou quando a etapa termina inteiramente antes de `intervalo.primeiroDia`
// (etapa toda no passado, fora da timeline que abre em hoje).
//
// Uma etapa iniciada ANTES de `intervalo.primeiroDia` é recortada: `esquerda` nunca fica
// negativo (a linha não tem `overflow-hidden`, a barra vazaria), a largura desenhada é reduzida
// e `cortadaNaEsquerda` avisa o componente para desenhar a marca de corte.
export function retanguloDaEtapa(
  faixa: { readonly dias: number; readonly inicio: string },
  intervalo: IntervaloDaTimeline,
): RetanguloDeEtapa | null {
  if (faixa.dias === 0) {
    return null;
  }

  const esquerdaBruta = deslocamentoEmPixels(intervalo, faixa.inicio);
  const direita = esquerdaBruta + faixa.dias * PIXELS_POR_DIA;

  if (direita <= 0) {
    return null;
  }

  if (esquerdaBruta < 0) {
    return {
      esquerda: 0,
      largura: direita,
      cortadaNaEsquerda: true,
      // Estritamente "mais de 46px" (04-DESIGN-SYSTEM.md §8), sobre a largura DESENHADA (a
      // reduzida pelo corte) — o rótulo precisa caber no que aparece na tela.
      mostrarRotulo: direita > LARGURA_MINIMA_PARA_ROTULO,
    };
  }

  const largura = faixa.dias * PIXELS_POR_DIA;

  return {
    esquerda: esquerdaBruta,
    largura,
    cortadaNaEsquerda: false,
    // Estritamente "mais de 46px" (04-DESIGN-SYSTEM.md §8) — `>=` deixaria uma barra de
    // exatos 46px mostrar rótulo por engano, e passaria despercebido para sempre.
    mostrarRotulo: largura > LARGURA_MINIMA_PARA_ROTULO,
  };
}

// A rolagem horizontal inicial do Gantt: abre com "Hoje" aproximadamente centralizada, sem
// nunca rolar para um valor negativo nem além do máximo rolável (larguraEmPixels -
// larguraVisivel). Sempre um inteiro — `scrollLeft` fracionário produziria meia-coluna de
// deslocamento. Com a timeline abrindo em hoje (A3), "hoje" fica perto da borda esquerda do
// intervalo — `Math.max(…, 0)` resolve para 0 na prática, sem precisar de tratamento especial.
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

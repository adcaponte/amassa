// Módulo puro da Produção (Fase 06.1, plano 09) — a LINHA DO TEMPO das ordens liberadas (PRD-07,
// D-06): o que aconteceu em cheio (datas reais: `inicio` e `feita_em`), o previsto em listrado (o que
// falta da etapa atual e as futuras, pelos dias previstos), a linha de hoje e o traço da entrega
// prometida. Só imports de módulos puros da própria pasta; nenhuma linha alcança React, Next,
// drizzle-orm, pg ou `@/db`. "Hoje" é sempre argumento (`YYYY-MM-DD`); toda posição é em dias civis
// inteiros × `PX_POR_DIA` — nenhuma hora entra na conta.
//
// Nada aqui deduz a etapa pelo calendário: é a leitura de `leituraDaOrdem`, desenhada.
//
// `deslocamentoEmPixels`, `rolagemInicial` e `ordenarLinhas` são CÓPIAS ADAPTADAS de
// `lib/encomendas/gantt.ts` (`deslocamentoEmPixels`, `rolagemInicial`, `ordenarParaGantt`) — sem
// nenhum import daquela pasta, que o plano 06.1-14 apaga. O intervalo é NOVO: o `calcularIntervalo`
// do Gantt abre em hoje e corta o passado; aqui o passado é justamente o trecho cheio.

import { diasEntre, somarDias } from "./calendario";
import type { EtapaProducao } from "./etapas";
import { etapasOrdenadas, leituraDaOrdem, type OrdemParaLeitura } from "./leitura";

// Escala fixa do UI-SPEC (protótipo 11px → 12, múltiplo de 4; pesquisa A8 "só visual").
export const PX_POR_DIA = 12;
// Um segmento de 0 dia (etapa feita no mesmo dia da anterior, ordem começando hoje) ainda aparece.
export const LARGURA_MINIMA_DO_SEGMENTO = 4;

// Folgas do protótipo (282): dois dias antes do menor início, cinco depois do maior fim.
const DIAS_ANTES = 2;
const DIAS_DEPOIS = 5;

export type IntervaloDaLinhaDoTempo = {
  primeiroDia: string;
  // O dia logo depois do último desenhado (o `fim` do protótipo, exclusivo).
  fimExclusivo: string;
  totalDeDias: number;
  larguraEmPixels: number;
};

export type SegmentoDaOrdem = {
  etapa: EtapaProducao;
  inicio: string;
  fimExclusivo: string;
  // Cheio = aconteceu; listrado = previsto.
  tipo: "cheio" | "listrado";
  // "feita" (cheio), "atual" (cheio até hoje + listrado pelo que falta) ou "prevista" (listrado).
  situacao: "feita" | "atual" | "prevista";
  dias: number;
  // 0 dia — desenhado com a largura mínima.
  minimo: boolean;
  diasPrevistos: number;
  // Só na feita: o dia em que foi marcada.
  feitaEm: string | null;
  // Só na atual: há quantos dias está nesta etapa (a leitura da ordem).
  diasNestaEtapa: number | null;
};

export type RetanguloDoSegmento = { esquerda: number; largura: number };

function soLiberadas<T extends OrdemParaLeitura>(ordens: readonly T[]): T[] {
  return ordens.filter((ordem) => ordem.status === "ativa" && ordem.inicio !== null);
}

// Do menor `inicio` − 2 dias até a maior entre previsão de conclusão e entrega prometida + 5 dias
// (protótipo 282), só com as ordens LIBERADAS — aguardando o sinal não aparece na linha do tempo e
// não estica o intervalo. `hoje` também entra nas duas pontas, para a linha de hoje nunca cair fora
// (uma ordem com início no futuro, que o fluxo normal não cria). Sem nenhuma liberada: `null` — a
// tela mostra o vazio.
export function intervaloDaLinhaDoTempo(
  ordens: readonly OrdemParaLeitura[],
  hoje: string,
): IntervaloDaLinhaDoTempo | null {
  const liberadas = soLiberadas(ordens);
  if (liberadas.length === 0) {
    return null;
  }

  // Datas civis `YYYY-MM-DD`: a comparação de texto é a de calendário.
  let menorInicio = hoje;
  let maiorFim = hoje;
  for (const ordem of liberadas) {
    const inicio = ordem.inicio as string;
    if (inicio < menorInicio) {
      menorInicio = inicio;
    }
    const leitura = leituraDaOrdem(ordem, hoje);
    if (leitura.tipo === "em-andamento" && leitura.previsaoDeConclusao > maiorFim) {
      maiorFim = leitura.previsaoDeConclusao;
    }
    if (ordem.entregaPrometida !== null && ordem.entregaPrometida > maiorFim) {
      maiorFim = ordem.entregaPrometida;
    }
  }

  const primeiroDia = somarDias(menorInicio, -DIAS_ANTES);
  const fimExclusivo = somarDias(maiorFim, DIAS_DEPOIS);
  const totalDeDias = diasEntre(primeiroDia, fimExclusivo);
  return { primeiroDia, fimExclusivo, totalDeDias, larguraEmPixels: totalDeDias * PX_POR_DIA };
}

// 1970-01-05 foi segunda-feira — referência para o dia da semana sem `Date`.
const UMA_SEGUNDA = "1970-01-05";

function ehSegunda(dia: string): boolean {
  return ((diasEntre(UMA_SEGUNDA, dia) % 7) + 7) % 7 === 0;
}

// As segundas-feiras dentro do intervalo — o cabeçalho marca "dd/mm" em cada uma (protótipo 283; a
// semana começa na segunda, a mesma convenção do resto do sistema).
export function segundasDoIntervalo(intervalo: IntervaloDaLinhaDoTempo): string[] {
  const segundas: string[] = [];
  let dia = intervalo.primeiroDia;
  while (!ehSegunda(dia)) {
    dia = somarDias(dia, 1);
  }
  for (; dia < intervalo.fimExclusivo; dia = somarDias(dia, 7)) {
    segundas.push(dia);
  }
  return segundas;
}

function segmento(
  dados: Omit<SegmentoDaOrdem, "fimExclusivo" | "minimo" | "dias"> & { dias: number },
): SegmentoDaOrdem {
  const dias = Math.max(0, dados.dias);
  return { ...dados, dias, fimExclusivo: somarDias(dados.inicio, dias), minimo: dias === 0 };
}

// Os segmentos de UMA ordem liberada, em sequência:
//   - etapa FEITA: cheio de `desde` (o `feita_em` da anterior, ou o início) até o `feita_em` dela;
//   - etapa ATUAL: cheio de `desde` até hoje + listrado de hoje pelo que falta do previsto (omitido
//     se a etapa já estourou);
//   - etapas FUTURAS: listrado pelo previsto, em sequência — o fim do último é a previsão de
//     conclusão da leitura.
// Aguardando, concluída e cancelada: nenhum segmento.
export function segmentosDaOrdem(ordem: OrdemParaLeitura, hoje: string): SegmentoDaOrdem[] {
  const leitura = leituraDaOrdem(ordem, hoje);
  if (leitura.tipo !== "em-andamento") {
    return [];
  }

  const etapas = etapasOrdenadas(ordem);
  const segmentos: SegmentoDaOrdem[] = [];
  let cursor = ordem.inicio as string;

  etapas.forEach((etapa, indice) => {
    const comum = { etapa: etapa.etapa, diasPrevistos: etapa.diasPrevistos };
    if (indice < leitura.indice) {
      const feitaEm = etapa.feitaEm as string;
      segmentos.push(
        segmento({
          ...comum,
          inicio: cursor,
          dias: diasEntre(cursor, feitaEm),
          tipo: "cheio",
          situacao: "feita",
          feitaEm,
          diasNestaEtapa: null,
        }),
      );
      cursor = feitaEm;
      return;
    }

    if (indice === leitura.indice) {
      const cheio = segmento({
        ...comum,
        inicio: leitura.desde,
        dias: leitura.diasNestaEtapa,
        tipo: "cheio",
        situacao: "atual",
        feitaEm: null,
        diasNestaEtapa: leitura.diasNestaEtapa,
      });
      segmentos.push(cheio);
      cursor = cheio.fimExclusivo;
      const falta = leitura.previstoDaEtapa - leitura.diasNestaEtapa;
      if (falta > 0) {
        const listrado = segmento({
          ...comum,
          inicio: cursor,
          dias: falta,
          tipo: "listrado",
          situacao: "atual",
          feitaEm: null,
          diasNestaEtapa: leitura.diasNestaEtapa,
        });
        segmentos.push(listrado);
        cursor = listrado.fimExclusivo;
      }
      return;
    }

    const prevista = segmento({
      ...comum,
      inicio: cursor,
      dias: etapa.diasPrevistos,
      tipo: "listrado",
      situacao: "prevista",
      feitaEm: null,
      diasNestaEtapa: null,
    });
    segmentos.push(prevista);
    cursor = prevista.fimExclusivo;
  });

  return segmentos;
}

// Deslocamento em pixels de `dia` desde `intervalo.primeiroDia` — a única multiplicação por
// `PX_POR_DIA` do desenho (cópia adaptada de `deslocamentoEmPixels` do Gantt).
export function deslocamentoEmPixels(intervalo: IntervaloDaLinhaDoTempo, dia: string): number {
  return diasEntre(intervalo.primeiroDia, dia) * PX_POR_DIA;
}

// Onde cada segmento é desenhado. Largura = dias × 12px, mínima de 4px; um segmento de largura
// mínima NUNCA sobrepõe o seguinte: o seguinte começa onde o anterior termina e continua terminando
// no dia dele (encolhe, até a mínima). Assim o fim de cada trecho — e o cheio da atual terminando na
// linha de hoje — fica no dia certo.
export function geometriaDosSegmentos(
  segmentos: readonly SegmentoDaOrdem[],
  intervalo: IntervaloDaLinhaDoTempo,
): RetanguloDoSegmento[] {
  const retangulos: RetanguloDoSegmento[] = [];
  let direitaAnterior = Number.NEGATIVE_INFINITY;
  for (const seg of segmentos) {
    const esquerda = Math.max(deslocamentoEmPixels(intervalo, seg.inicio), direitaAnterior);
    const direita = Math.max(
      deslocamentoEmPixels(intervalo, seg.fimExclusivo),
      esquerda + LARGURA_MINIMA_DO_SEGMENTO,
    );
    retangulos.push({ esquerda, largura: direita - esquerda });
    direitaAnterior = direita;
  }
  return retangulos;
}

// A linha vermelha de hoje: no começo do dia de hoje — onde o cheio da atual termina e o listrado
// começa.
export function posicaoDeHoje(intervalo: IntervaloDaLinhaDoTempo, hoje: string): number {
  return deslocamentoEmPixels(intervalo, hoje);
}

// O traço da entrega prometida, no dia prometido; sem entrega, não existe (`null`). Uma entrega já
// passada com a ordem em curso cai antes da linha de hoje — é o desenho de "vai atrasar".
export function posicaoDaEntrega(
  intervalo: IntervaloDaLinhaDoTempo,
  entregaPrometida: string | null,
): number | null {
  return entregaPrometida === null ? null : deslocamentoEmPixels(intervalo, entregaPrometida);
}

// A rolagem horizontal inicial: abre com hoje no centro da área visível, sem nunca rolar para um
// valor negativo nem além do máximo (`larguraEmPixels − larguraVisivel`). Sempre inteira. Cópia
// adaptada de `rolagemInicial` do Gantt (`lib/encomendas/gantt.ts:275-284`).
export function rolagemInicial(
  intervalo: IntervaloDaLinhaDoTempo,
  hoje: string,
  larguraVisivel: number,
): number {
  const maximo = Math.max(0, Math.round(intervalo.larguraEmPixels - larguraVisivel));
  const centralizado = Math.round(posicaoDeHoje(intervalo, hoje) - larguraVisivel / 2);
  return Math.min(Math.max(centralizado, 0), maximo);
}

// As linhas por `inicio`, nome (`localeCompare` pt-BR) e id — ordem determinística, nunca a que o
// banco devolveu por acaso (molde de `ordenarParaGantt`). Devolve uma cópia.
export function ordenarLinhas<
  T extends { readonly inicio: string | null; readonly nome: string; readonly id: string },
>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => {
    const inicioA = a.inicio ?? "";
    const inicioB = b.inicio ?? "";
    if (inicioA !== inicioB) {
      return inicioA < inicioB ? -1 : 1;
    }
    const porNome = a.nome.localeCompare(b.nome, "pt-BR");
    if (porNome !== 0) {
      return porNome;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";

import { formatarDiaMes } from "@/lib/producao/calendario";
import type { OrdemEmAndamento } from "@/lib/producao/consultas";
import { ORDEM_DAS_COLUNAS, rotuloDaColuna, rotuloDaEtapa, type EtapaProducao } from "@/lib/producao/etapas";
import type { LeituraDaOrdem, Selo } from "@/lib/producao/leitura";
import {
  deslocamentoEmPixels,
  geometriaDosSegmentos,
  intervaloDaLinhaDoTempo,
  ordenarLinhas,
  posicaoDaEntrega,
  posicaoDeHoje,
  PX_POR_DIA,
  rolagemInicial,
  segmentosDaOrdem,
  segundasDoIntervalo,
  type SegmentoDaOrdem,
} from "@/lib/producao/linha-do-tempo";
import {
  ARIA_LEGENDA_LINHA_DO_TEMPO,
  ARIA_LINHA_DO_TEMPO,
  ariaLabelEntregaPrometida,
  ariaLabelLinhaDaOrdem,
  ariaLabelSegmentoAtual,
  ariaLabelSegmentoFeito,
  ariaLabelSegmentoPrevisto,
  CORPO_LINHA_DO_TEMPO_VAZIA_COM_AGUARDANDO,
  CORPO_LINHA_DO_TEMPO_VAZIA_SEM_AGUARDANDO,
  LEGENDA_ENTREGA_PROMETIDA,
  LEGENDA_LINHA_DO_TEMPO,
  srLinhaDeHoje,
  textoSelo,
  TITULO_LINHA_DO_TEMPO_VAZIA,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { PontoDaEtapa } from "./quadro-producao";

// Geometria do UI-SPEC (§Spacing, exceção "Linha do tempo (desenho de dado)"): coluna fixa 160px no
// celular e 224px a partir de 768px (a variável `--coluna-fixa`, uma fonte só para a coluna, a
// largura total e a linha de hoje); cabeçalho 28px; linha 52px; trilho 24px com o segmento de 16px a
// 4px do topo; traço da entrega 4 × 32px; linha de hoje 2px. A escala (12px/dia) e toda posição saem
// de `lib/producao/linha-do-tempo.ts` — este componente nunca multiplica por 12 por conta própria.
// A largura da coluna aparece duas vezes, de propósito lado a lado: nas classes da coluna e na
// variável `--coluna-fixa` da região (que a largura total e a linha de hoje usam). Mudou uma, muda a
// outra.
const CLASSE_DA_COLUNA_FIXA =
  "sticky left-0 z-20 w-[160px] shrink-0 bg-superficie border-r border-borda md:w-[224px]";
const CLASSE_DA_VARIAVEL_DA_COLUNA = "[--coluna-fixa:160px] md:[--coluna-fixa:224px]";

export type LinhaNaLinhaDoTempo = {
  ordem: OrdemEmAndamento;
  leitura: Extract<LeituraDaOrdem, { tipo: "em-andamento" }>;
  selo: Selo;
};

export type LinhaDoTempoProps = {
  // As ordens LIBERADAS do filtro atual, com a leitura e o selo decididos no servidor.
  linhas: LinhaNaLinhaDoTempo[];
  // "Hoje" de Brasília, decidido no servidor — o cliente nunca decide o dia.
  hoje: string;
  // Há ordem aguardando o sinal no filtro atual (muda o corpo do vazio).
  temAguardando: boolean;
};

// Cheio = a cor da etapa; listrado = listras de 135° da cor a 55% + borda 1px da cor (protótipo
// `.sg.pl`). A 55% vai só nas listras — a borda fica na cor inteira, que é o par Q10 medido (≥ 3:1
// sobre `superficie`). Secagem: borda 1px `--color-tinta-fraca` nos dois (UI-D13 — o token sozinho
// dá 1,95:1 sobre branco).
function estiloDoSegmento(segmento: SegmentoDaOrdem): CSSProperties {
  const cor = `var(--color-${segmento.etapa})`;
  const borda = segmento.etapa === "secagem" ? "var(--color-tinta-fraca)" : cor;
  if (segmento.tipo === "cheio") {
    return {
      backgroundColor: cor,
      ...(segmento.etapa === "secagem" ? { border: `1px solid ${borda}` } : {}),
    };
  }
  const listra = `color-mix(in srgb, ${cor} 55%, transparent)`;
  return {
    backgroundImage: `repeating-linear-gradient(135deg, ${listra} 0 3px, transparent 3px 6px)`,
    border: `1px solid ${borda}`,
  };
}

function rotuloDoSegmento(segmento: SegmentoDaOrdem, rotulo: string): string {
  if (segmento.situacao === "feita") {
    return ariaLabelSegmentoFeito(rotulo, formatarDiaMes(segmento.feitaEm as string), segmento.dias);
  }
  if (segmento.situacao === "atual") {
    return ariaLabelSegmentoAtual(rotulo, segmento.diasNestaEtapa ?? 0, segmento.diasPrevistos);
  }
  return ariaLabelSegmentoPrevisto(rotulo, segmento.diasPrevistos);
}

function Legenda() {
  return (
    <ul
      aria-label={ARIA_LEGENDA_LINHA_DO_TEMPO}
      className="text-apoio text-tinta-fraca mt-2 flex flex-wrap gap-x-4 gap-y-2"
    >
      {ORDEM_DAS_COLUNAS.map((etapa: EtapaProducao) => (
        <li key={etapa} className="inline-flex items-center gap-1">
          <PontoDaEtapa etapa={etapa} />
          {rotuloDaColuna(etapa)}
        </li>
      ))}
      <li className="inline-flex items-center gap-1">
        <span aria-hidden="true" className="bg-tinta inline-block h-3 w-1 rounded-sm" />
        {LEGENDA_ENTREGA_PROMETIDA}
      </li>
      <li>{LEGENDA_LINHA_DO_TEMPO}</li>
    </ul>
  );
}

// A linha do tempo das ordens liberadas (UI-SPEC §"Linha do tempo"; PRD-07, D-06): do Gantt das
// Encomendas só a ESTRUTURA — coluna do nome fixa à esquerda, área rolável que abre com hoje no
// centro (`rolagemInicial`, aplicada uma vez), `sr-only` da linha de hoje; o desenho é o do
// protótipo — cheio = aconteceu, listrado = previsto, a linha vermelha de hoje por cima dos
// segmentos, o traço da entrega prometida. Aguardando o sinal nunca aparece aqui.
export function LinhaDoTempo({ linhas, hoje, temAguardando }: LinhaDoTempoProps) {
  const areaRolavelRef = useRef<HTMLDivElement>(null);
  const colunaFixaRef = useRef<HTMLDivElement>(null);

  const ordens = linhas.map((linha) => linha.ordem);
  const intervalo = intervaloDaLinhaDoTempo(ordens, hoje);

  useLayoutEffect(() => {
    const area = areaRolavelRef.current;
    if (!area || !intervalo) {
      return;
    }
    // A área visível do TRILHO: a largura da região menos a coluna fixa. Instantânea sempre (também
    // com `prefers-reduced-motion`) — é a posição de abertura, não uma animação.
    const visivel = area.clientWidth - (colunaFixaRef.current?.offsetWidth ?? 0);
    area.scrollLeft = rolagemInicial(intervalo, hoje, visivel);
    // Dependência vazia de propósito (molde do Gantt): a rolagem inicial roda uma vez na montagem —
    // nunca por cima de um gesto de rolagem que a pessoa já tenha feito. Trocar de filtro remonta
    // o componente (a `key` no painel) e recentra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!intervalo) {
    return (
      <EstadoVazio
        titulo={TITULO_LINHA_DO_TEMPO_VAZIA}
        corpo={
          temAguardando
            ? CORPO_LINHA_DO_TEMPO_VAZIA_COM_AGUARDANDO
            : CORPO_LINHA_DO_TEMPO_VAZIA_SEM_AGUARDANDO
        }
        testId="linha-do-tempo-vazia"
      />
    );
  }

  const largura = intervalo.larguraEmPixels;
  const segundas = segundasDoIntervalo(intervalo);
  const xHoje = posicaoDeHoje(intervalo, hoje);
  const porId = new Map(linhas.map((linha) => [linha.ordem.id, linha]));
  const ordenadas = ordenarLinhas(ordens).flatMap((ordem) => {
    const linha = porId.get(ordem.id);
    return linha ? [linha] : [];
  });

  return (
    <div
      data-testid="producao-linha-do-tempo"
      // O intervalo REAL deste render, para o e2e recalcular a posição da linha de hoje com a mesma
      // conta (nunca presumindo quantas ordens outras specs criaram).
      data-primeiro-dia={intervalo.primeiroDia}
      data-px-por-dia={PX_POR_DIA}
      data-hoje={hoje}
    >
      <div className="bg-superficie border-borda rounded-lg border">
        <div
          ref={areaRolavelRef}
          tabIndex={0}
          role="region"
          aria-label={ARIA_LINHA_DO_TEMPO}
          data-testid="linha-do-tempo-area"
          className={cn(
            "focus-visible:ring-ring overflow-x-auto rounded-lg py-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
            CLASSE_DA_VARIAVEL_DA_COLUNA,
          )}
        >
          <div className="relative" style={{ width: `calc(var(--coluna-fixa) + ${largura}px)` }}>
            {/* Cabeçalho (28px): a coluna fixa vazia com o texto da linha de hoje para o leitor
                de tela, e "dd/mm" em cada segunda-feira. */}
            <div className="flex h-7">
              <div ref={colunaFixaRef} className={CLASSE_DA_COLUNA_FIXA}>
                <span className="sr-only">{srLinhaDeHoje(formatarDiaMes(hoje))}</span>
              </div>
              <div
                aria-hidden="true"
                data-testid="linha-do-tempo-regua"
                className="relative shrink-0"
                style={{ width: largura }}
              >
                {segundas.map((segunda) => (
                  <span
                    key={segunda}
                    className="text-apoio text-tinta-fraca border-borda-forte absolute top-1 border-l pl-1 whitespace-nowrap"
                    style={{ left: deslocamentoEmPixels(intervalo, segunda) }}
                  >
                    {formatarDiaMes(segunda)}
                  </span>
                ))}
              </div>
            </div>

            {ordenadas.map(({ ordem, leitura, selo }) => {
              const segmentos = segmentosDaOrdem(ordem, hoje);
              const geometria = geometriaDosSegmentos(segmentos, intervalo);
              const xEntrega = posicaoDaEntrega(intervalo, ordem.entregaPrometida);
              const rotuloDaAtual = rotuloDaEtapa(leitura.etapa, ordem.tipo);
              const textoDoSelo = textoSelo(selo);
              return (
                <div
                  key={ordem.id}
                  data-testid={`linha-do-tempo-ordem-${ordem.id}`}
                  data-ordem-id={ordem.id}
                  className="border-borda flex h-[52px] border-t"
                >
                  <div className={CLASSE_DA_COLUNA_FIXA}>
                    <Link
                      href={rotaDeGestao(`/producao/${ordem.id}`)}
                      aria-label={ariaLabelLinhaDaOrdem(ordem.nome, rotuloDaAtual, textoDoSelo)}
                      data-testid="linha-do-tempo-link"
                      className="focus-visible:ring-ring flex h-full w-full flex-col justify-center px-3 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                    >
                      <span className="text-apoio text-tinta line-clamp-1 font-semibold [overflow-wrap:anywhere]">
                        {ordem.nome}
                      </span>
                      <span className="text-apoio text-tinta-fraca line-clamp-1 [overflow-wrap:anywhere]">
                        {rotuloDaAtual} ·{" "}
                        <span className={cn(selo.tipo === "vai-atrasar" && "text-erro font-semibold")}>
                          {textoDoSelo}
                        </span>
                      </span>
                    </Link>
                  </div>
                  <div className="relative flex shrink-0 items-center" style={{ width: largura }}>
                    <div className="relative h-6 w-full">
                      {segmentos.map((segmento, indice) => (
                        <div
                          key={`${segmento.etapa}-${segmento.tipo}`}
                          role="img"
                          aria-label={rotuloDoSegmento(
                            segmento,
                            rotuloDaEtapa(segmento.etapa, ordem.tipo),
                          )}
                          data-testid="linha-do-tempo-segmento"
                          data-etapa={segmento.etapa}
                          data-tipo={segmento.tipo}
                          data-situacao={segmento.situacao}
                          data-minimo={segmento.minimo ? "true" : "false"}
                          className="absolute top-1 h-4 rounded-sm"
                          style={{
                            left: geometria[indice].esquerda,
                            width: geometria[indice].largura,
                            ...estiloDoSegmento(segmento),
                          }}
                        />
                      ))}
                      {xEntrega === null ? null : (
                        <div
                          role="img"
                          aria-label={ariaLabelEntregaPrometida(
                            formatarDiaMes(ordem.entregaPrometida as string),
                          )}
                          data-testid="linha-do-tempo-entrega"
                          className="bg-tinta absolute -top-1 h-8 w-1 rounded-sm"
                          style={{ left: xEntrega }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* A linha de hoje: 2px de erro, por cima dos segmentos e embaixo da coluna fixa
                (que rola por cima dela). O texto está no `sr-only` do cabeçalho. */}
            <div
              aria-hidden="true"
              data-testid="linha-do-tempo-hoje"
              className="bg-erro pointer-events-none absolute inset-y-0 z-10 w-0.5"
              style={{ left: `calc(var(--coluna-fixa) + ${xHoje}px)` }}
            />
          </div>
        </div>
      </div>
      <Legenda />
    </div>
  );
}

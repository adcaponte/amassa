"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";

import type { Cronograma, StatusDeEncomenda } from "@/lib/encomendas/cronograma";
import {
  calcularIntervalo,
  celulasDeQuinzena,
  deslocamentoEmPixels,
  retanguloDaEtapa,
  rolagemInicial,
} from "@/lib/encomendas/gantt";
import { formatarDiaCurto } from "@/lib/encomendas/formato";
import { ROTULO_ETAPA, SELO_RASCUNHO } from "@/lib/encomendas/textos";

// Geometria fora do contrato vinculante (18px/dia, 46px de limiar) — dimensões de leiaute que
// este componente é livre para escolher (03-CONTEXT.md "Claude's Discretion" — estrutura de
// arquivo e detalhe visual não travado por 00-BRIEFING.md/04-DESIGN-SYSTEM.md).
const LARGURA_COLUNA_FIXA = 224;
const ALTURA_CABECALHO = 40;
const ALTURA_LINHA = 64;
const ALTURA_BARRA = 28;
const TAMANHO_LOSANGO = 12;

export type EncomendaDoGantt = {
  id: string;
  nome: string;
  clienteNome: string | null;
  status: StatusDeEncomenda;
  cronograma: Cronograma;
};

export type GanttProps = {
  encomendas: EncomendaDoGantt[];
  hoje: string;
};

// Mês abreviado em português para o rótulo de quinzena do cabeçalho — duplicado do padrão
// interno de `lib/encomendas/formato.ts` porque `celulasDeQuinzena` (lib/encomendas/gantt.ts,
// módulo puro sem import) recebe `formatarMes` por injeção de parâmetro, não importa nada.
function mesAbreviadoDaQuinzena(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  const texto = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(
    dataUtc,
  );
  return texto.replace(".", "");
}

// Rascunho no Gantt (D-10, 03-UI-SPEC.md "Rascunho no Gantt — Tratamento Atenuado"): hachura
// diagonal preservando a cor cheia da etapa, nunca opacidade reduzida (linguagem de
// "desabilitado" do sistema).
function estiloDeEtapa(cor: string, rascunho: boolean): CSSProperties {
  if (rascunho) {
    return {
      backgroundImage: `repeating-linear-gradient(45deg, ${cor} 0 4px, color-mix(in srgb, ${cor} 100%, black 20%) 4px 8px)`,
      border: `1px dashed color-mix(in srgb, ${cor} 70%, transparent)`,
    };
  }
  return { backgroundColor: cor };
}

// Client Component — `useLayoutEffect` é o que a rolagem inicial (ENC-07) exige. Recebe as
// encomendas JÁ ordenadas (ordenarParaGantt roda no Server Component) e os cronogramas JÁ
// calculados; nunca chama o banco, nunca recalcula data. Toda posição e largura saem de
// `retanguloDaEtapa`/`deslocamentoEmPixels` — nunca multiplica por 18 por conta própria.
export function Gantt({ encomendas, hoje }: GanttProps) {
  const areaRolavelRef = useRef<HTMLDivElement>(null);

  const intervalo = calcularIntervalo(
    encomendas.map((encomenda) => ({
      inicio: encomenda.cronograma.inicio,
      fimExclusivo: encomenda.cronograma.fimExclusivo,
    })),
    hoje,
  );
  const celulas = celulasDeQuinzena(intervalo, mesAbreviadoDaQuinzena);
  const deslocamentoHoje = deslocamentoEmPixels(intervalo, hoje);
  const alturaDasLinhas = encomendas.length * ALTURA_LINHA;

  useLayoutEffect(() => {
    const elemento = areaRolavelRef.current;
    if (!elemento) {
      return;
    }
    elemento.scrollLeft = rolagemInicial(intervalo, hoje, elemento.clientWidth);
    // Dependência vazia de propósito (ENC-07/idempotency, ENC-07/concurrency): a rolagem
    // inicial roda uma única vez no layout da montagem — nunca de novo quando os dados
    // mudarem, e nunca por cima de um gesto de rolagem que a pessoa já tenha feito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="rounded-xl border border-border bg-card"
      data-testid="gantt-desktop"
      // O intervalo REAL que este render calculou — exposto como atributo para que o e2e
      // (`tests/e2e/encomendas-indice.spec.ts`) recompute a posição esperada da linha de "Hoje"
      // e da rolagem inicial com a MESMA função de produção (`deslocamentoEmPixels`/
      // `rolagemInicial`), em vez de reconstruir o intervalo a partir de uma contagem
      // presumida de encomendas — o que quebraria com dado concorrente de outras specs.
      data-primeiro-dia={intervalo.primeiroDia}
      data-largura-em-pixels={intervalo.larguraEmPixels}
    >
      <div ref={areaRolavelRef} data-testid="gantt-area-rolavel" className="overflow-x-auto">
        <div style={{ width: LARGURA_COLUNA_FIXA + intervalo.larguraEmPixels }}>
          {/* Cabeçalho: coluna fixa + células de quinzena */}
          <div className="flex border-b border-border">
            <div
              className="sticky left-0 z-20 flex flex-shrink-0 items-center border-r border-border bg-card px-4"
              style={{ width: LARGURA_COLUNA_FIXA, height: ALTURA_CABECALHO }}
            >
              {/* Rótulo textual da linha de "Hoje" para quem usa leitor de tela — a linha em
                  si é aria-hidden (é só um traço visual). */}
              <span className="sr-only">
                Uma linha vermelha marca hoje, {formatarDiaCurto(hoje)}.
              </span>
              <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
                Encomenda
              </span>
            </div>
            <div
              data-testid="gantt-regua"
              className="relative"
              style={{ width: intervalo.larguraEmPixels, height: ALTURA_CABECALHO }}
            >
              {celulas.map((celula) => (
                <div
                  key={celula.chave}
                  data-testid="gantt-celula-quinzena"
                  className="text-apoio absolute top-0 flex h-full items-center border-r border-border px-2 text-muted-foreground"
                  style={{ left: celula.esquerda, width: celula.largura }}
                >
                  {celula.rotulo}
                </div>
              ))}
            </div>
          </div>

          {/* Linhas — uma por encomenda — mais a linha vertical de "Hoje" por cima de todas */}
          <div className="relative">
            {encomendas.length > 0 && (
              <div
                aria-hidden="true"
                data-testid="linha-hoje"
                data-hoje={hoje}
                className="absolute top-0 z-10 w-px bg-erro"
                style={{ left: LARGURA_COLUNA_FIXA + deslocamentoHoje, height: alturaDasLinhas }}
              />
            )}

            {encomendas.map((encomenda) => {
              const rascunho = encomenda.status === "rascunho";

              return (
                <div
                  className="flex"
                  key={encomenda.id}
                  data-testid={`gantt-linha-${encomenda.id}`}
                >
                  <div
                    className="sticky left-0 z-10 flex flex-shrink-0 border-r border-b border-border bg-card"
                    style={{ width: LARGURA_COLUNA_FIXA, height: ALTURA_LINHA }}
                  >
                    <Link
                      href={`/encomendas/${encomenda.id}`}
                      className="focus-visible:ring-ring flex h-full w-full flex-col justify-center gap-0.5 px-4 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-titulo truncate text-foreground"
                          title={encomenda.nome}
                        >
                          {encomenda.nome}
                        </span>
                        {rascunho && (
                          <span className="text-micro shrink-0 rounded border border-borda-forte bg-superficie-2 px-1.5 py-0.5 tracking-wide text-tinta-media uppercase">
                            {SELO_RASCUNHO}
                          </span>
                        )}
                      </div>
                      <span className="text-apoio truncate text-muted-foreground">
                        {encomenda.clienteNome ?? "Cliente não informado"}
                      </span>
                    </Link>
                  </div>

                  <div
                    className="relative border-b border-border"
                    style={{ width: intervalo.larguraEmPixels, height: ALTURA_LINHA }}
                  >
                    {encomenda.cronograma.faixas.map((faixa) => {
                      const retangulo = retanguloDaEtapa(
                        { dias: faixa.dias, inicio: faixa.inicio },
                        intervalo,
                      );
                      if (!retangulo) {
                        return null;
                      }

                      const cor = `var(--color-${faixa.etapa})`;
                      const rotuloAcessivel = `${ROTULO_ETAPA[faixa.etapa]} — ${faixa.dias} dia${faixa.dias === 1 ? "" : "s"}`;
                      const corDoTexto = faixa.etapa === "secagem" ? "#3A331F" : "#FFFFFF";

                      if (faixa.marco) {
                        return (
                          <div
                            key={faixa.etapa}
                            role="img"
                            aria-label={rotuloAcessivel}
                            data-testid={`gantt-marco-${encomenda.id}-${faixa.etapa}`}
                            className="absolute rounded-[2px]"
                            style={{
                              left: retangulo.esquerda + retangulo.largura / 2 - TAMANHO_LOSANGO / 2,
                              top: ALTURA_LINHA / 2 - TAMANHO_LOSANGO / 2,
                              width: TAMANHO_LOSANGO,
                              height: TAMANHO_LOSANGO,
                              transform: "rotate(45deg)",
                              ...estiloDeEtapa(cor, rascunho),
                            }}
                          />
                        );
                      }

                      return (
                        <div
                          key={faixa.etapa}
                          role="img"
                          aria-label={rotuloAcessivel}
                          data-testid={`gantt-barra-${encomenda.id}-${faixa.etapa}`}
                          className="absolute flex items-center overflow-hidden rounded-sm px-1"
                          style={{
                            left: retangulo.esquerda,
                            top: (ALTURA_LINHA - ALTURA_BARRA) / 2,
                            width: retangulo.largura,
                            height: ALTURA_BARRA,
                            ...estiloDeEtapa(cor, rascunho),
                          }}
                        >
                          {retangulo.mostrarRotulo && (
                            <span
                              className="text-micro truncate"
                              style={{ color: corDoTexto }}
                            >
                              {ROTULO_ETAPA[faixa.etapa]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

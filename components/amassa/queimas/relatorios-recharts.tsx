"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import type { BaldeDeQueimas, BarraDeForno } from "@/lib/queimas/relatorios";
import { ROTULO_MES, ROTULO_SEMANA, rotuloDoTipo } from "@/lib/queimas/textos";

// `recharts` — única dependência npm nova da Fase 4 (FOR-12, portão de legitimidade humano da
// Tarefa 1 desta fase). Client Component: recebe os baldes JÁ AGREGADOS como props
// (`lib/queimas/relatorios.ts`, rodado no servidor) — este componente NÃO agrega nada, só
// desenha. O alternador Semana/Mês troca qual das duas agregações já carregadas é exibida, sem
// disparar consulta nova e sem poder mudar os números (must_have deste plano).
//
// D-07: cada gráfico rola horizontalmente DENTRO do próprio contêiner — a página em si nunca
// rola lateralmente. Mesmo padrão de `components/amassa/encomendas/gantt.tsx`: geometria em
// pixels fixos (não `ResponsiveContainer` sozinho) dentro de um `overflow-x-auto`, largura
// suficiente para nunca encolher os 8 (ou 6) baldes no celular — os dois tamanhos de tela
// mostram o MESMO recorte de dados, nada reduzido.
//
// Nenhum componente aqui usa os tokens de NÍVEL de forno (`--color-forno-*`) — só os tokens de
// GRÁFICO (`--color-chart-1..3`, mapeados 1:1 nos tokens de TIPO de queima). É essa separação que
// mantém `--color-ouro`/`--color-forno-atencao` inequívocos apesar do mesmo hex
// (`04-UI-SPEC.md` §Color, nota de conflito 2).

export type Granularidade = "semana" | "mes";

export type RelatoriosRechartsProps = {
  baldesPorSemana: readonly BaldeDeQueimas[];
  baldesPorMes: readonly BaldeDeQueimas[];
  barrasPorForno: readonly BarraDeForno[];
};

const LARGURA_POR_BALDE_SEMANA = 70;
const LARGURA_POR_BALDE_MES = 90;
const ALTURA_DO_GRAFICO_DE_TIPO = 280;
const MAXIMO_DE_CARACTERES_NO_EIXO = 14;

// Mês abreviado em português, sem ponto — mesma abordagem de `mesAbreviadoDaQuinzena`
// (`components/amassa/encomendas/gantt.tsx`) e `mesAbreviado` (`lib/queimas/formato.ts`):
// formata a partir de `Date.UTC` do dia civil já calculado, timeZone "UTC" (nunca o fuso do
// runtime, que faria o mês saltar perto da virada). Duplicado aqui em vez de importado —
// `relatorios-recharts.tsx` não é um módulo puro, mas ainda assim não importa `formato.ts`
// (mesma disciplina de não misturar formatação de rótulo de eixo com a formatação de rodapé).
function mesAbreviadoUtc(diaCivil: string): string {
  const [ano, mes, dia] = diaCivil.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const texto = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(data);
  return texto.replace(".", "");
}

function rotuloDoBaldeSemanal(diaCivil: string): string {
  const [, , diaTexto] = diaCivil.split("-");
  return `${Number(diaTexto)} ${mesAbreviadoUtc(diaCivil)}`;
}

function rotuloDoBaldeMensal(diaCivil: string): string {
  const [anoTexto] = diaCivil.split("-");
  return `${mesAbreviadoUtc(diaCivil)}/${anoTexto.slice(2)}`;
}

// Eixo de forno: trunca com reticências, o nome completo vive no tooltip (E9/long-text,
// `04-UI-SPEC.md`). Truncagem por CONTAGEM DE CARACTERES, não por CSS — o eixo do Recharts
// desenha `<text>` de SVG, que não recebe `text-overflow: ellipsis` do jeito que um elemento HTML
// receberia; truncar o próprio rótulo mantém a largura do eixo previsível em qualquer tamanho de
// tela, inclusive no celular.
function truncarNomeDoForno(nome: string): string {
  if (nome.length <= MAXIMO_DE_CARACTERES_NO_EIXO) {
    return nome;
  }
  return `${nome.slice(0, MAXIMO_DE_CARACTERES_NO_EIXO - 1)}…`;
}

type LinhaDoGraficoDeTipo = BaldeDeQueimas & { rotulo: string };
type LinhaDoGraficoDeForno = BarraDeForno & { fornoNomeCurto: string };

function TooltipDeTipo({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  return (
    <div
      className="text-apoio rounded-md border border-border bg-card px-3 py-2 shadow-md"
      data-testid="tooltip-grafico-tipo"
    >
      <p className="text-foreground font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey as string} className="text-muted-foreground">
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

function TooltipDeForno({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const linha = payload[0].payload as LinhaDoGraficoDeForno;
  return (
    <div
      className="text-apoio rounded-md border border-border bg-card px-3 py-2 shadow-md"
      data-testid="tooltip-grafico-forno"
    >
      <p className="text-foreground font-medium">{linha.fornoNome}</p>
      <p className="text-muted-foreground">
        {linha.total} {linha.total === 1 ? "queima" : "queimas"}
      </p>
    </div>
  );
}

export function RelatoriosRecharts({
  baldesPorSemana,
  baldesPorMes,
  barrasPorForno,
}: RelatoriosRechartsProps) {
  const [granularidade, setGranularidade] = useState<Granularidade>("semana");

  const baldes = granularidade === "semana" ? baldesPorSemana : baldesPorMes;
  const rotular = granularidade === "semana" ? rotuloDoBaldeSemanal : rotuloDoBaldeMensal;
  const larguraPorBalde =
    granularidade === "semana" ? LARGURA_POR_BALDE_SEMANA : LARGURA_POR_BALDE_MES;

  const dadosDoGraficoDeTipo: LinhaDoGraficoDeTipo[] = baldes.map((balde) => ({
    ...balde,
    rotulo: rotular(balde.inicio),
  }));

  const dadosDoGraficoDeForno: LinhaDoGraficoDeForno[] = barrasPorForno.map((barra) => ({
    ...barra,
    fornoNomeCurto: truncarNomeDoForno(barra.fornoNome),
  }));

  const larguraDoGraficoDeTipo = dadosDoGraficoDeTipo.length * larguraPorBalde;
  const alturaDoGraficoDeForno = Math.max(dadosDoGraficoDeForno.length * 44 + 40, 120);

  return (
    <div className="flex flex-col gap-8">
      {/* Alternador Semana/Mês — troca qual agregação JÁ CARREGADA é exibida, nunca dispara
          consulta nova. `role="radiogroup"`, mesmo molde de `filtro-fornos.tsx`. */}
      <div
        role="radiogroup"
        aria-label="Granularidade dos gráficos"
        className="flex gap-2"
        data-testid="alternador-granularidade"
      >
        {(
          [
            { valor: "semana" as const, rotulo: ROTULO_SEMANA },
            { valor: "mes" as const, rotulo: ROTULO_MES },
          ]
        ).map((opcao) => {
          const selecionado = opcao.valor === granularidade;
          return (
            <button
              key={opcao.valor}
              type="button"
              role="radio"
              aria-checked={selecionado}
              onClick={() => setGranularidade(opcao.valor)}
              data-testid={`alternador-granularidade-${opcao.valor}`}
              className={
                "text-apoio focus-visible:ring-ring min-h-[44px] rounded-full border px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none " +
                (selecionado
                  ? "border-tinta bg-superficie-2 text-tinta"
                  : "border-borda bg-superficie text-tinta-fraca hover:bg-superficie-2")
              }
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {/* Barras empilhadas por tipo — biscoito, esmalte, ouro, sempre nessa ordem fixa. Baldes
          sem queima aparecem como zero (nunca somem): os 8/6 são sempre plotados por inteiro. */}
      <section aria-label="Queimas por tipo, ao longo do tempo">
        <div
          className="overflow-x-auto rounded-xl border border-border bg-card p-4"
          data-testid="grafico-tipo-rolagem"
        >
          <div style={{ width: Math.max(larguraDoGraficoDeTipo, 320) }}>
            <BarChart
              width={Math.max(larguraDoGraficoDeTipo, 320)}
              height={ALTURA_DO_GRAFICO_DE_TIPO}
              data={dadosDoGraficoDeTipo}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
              <Tooltip content={TooltipDeTipo} />
              <Legend
                formatter={(valor: string) =>
                  valor === "biscoito" || valor === "esmalte" || valor === "ouro"
                    ? rotuloDoTipo(valor)
                    : valor
                }
              />
              <Bar
                dataKey="biscoito"
                stackId="tipo"
                name={rotuloDoTipo("biscoito")}
                fill="var(--color-chart-1)"
              />
              <Bar
                dataKey="esmalte"
                stackId="tipo"
                name={rotuloDoTipo("esmalte")}
                fill="var(--color-chart-2)"
              />
              <Bar dataKey="ouro" stackId="tipo" name={rotuloDoTipo("ouro")} fill="var(--color-chart-3)" />
            </BarChart>
          </div>
        </div>
      </section>

      {/* Barras horizontais por forno — um único forno produz uma barra só, não um gráfico
          degenerado (E9/zero-one-many). Nome do forno truncado no eixo, completo no tooltip. */}
      <section aria-label="Queimas por forno">
        <div
          className="overflow-x-auto rounded-xl border border-border bg-card p-4"
          data-testid="grafico-forno-rolagem"
        >
          <div style={{ minWidth: 320, width: "100%" }}>
            <ResponsiveContainer width="100%" height={alturaDoGraficoDeForno} minWidth={320}>
              <BarChart
                data={dadosDoGraficoDeForno}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="fornoNomeCurto"
                  width={110}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip content={TooltipDeForno} />
                <Bar dataKey="total" name="Queimas" fill="var(--color-chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

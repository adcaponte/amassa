"use client";

import { useRouter } from "next/navigation";

import type { TipoDoPonto } from "@/lib/agenda/semana";
import {
  CABECALHO_DOS_DIAS_DO_MES,
  DICA_DO_MES,
  FRASE_MES_VAZIO,
  LEGENDA_TURMA_FIXA,
  LEGENDA_USO_LIVRE,
  ROTULO_AULA_AVULSA,
  ROTULO_FECHADO_BLOQUEIO,
} from "@/lib/agenda/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// A cor do ponto é DECORATIVA (UI-D12): o tipo está escrito no `aria-label` da célula e na
// legenda. O ouro reprova como objeto gráfico (2,94:1) — todo ponto ouro leva o contorno de 1px
// `tinta-fraca` (A15; `tests/unit/contraste.test.ts` lê esta linha).
export const COR_DO_PONTO: Record<TipoDoPonto, string> = {
  turma: "bg-area-espaco",
  avulsa: "bg-ouro outline outline-1 -outline-offset-1 outline-tinta-fraca",
  uso_livre: "bg-area-loja",
  fechado: "bg-area-geral",
};

const LEGENDA: readonly { tipo: TipoDoPonto; rotulo: string }[] = [
  { tipo: "turma", rotulo: LEGENDA_TURMA_FIXA },
  { tipo: "avulsa", rotulo: ROTULO_AULA_AVULSA },
  { tipo: "uso_livre", rotulo: LEGENDA_USO_LIVRE },
  { tipo: "fechado", rotulo: ROTULO_FECHADO_BLOQUEIO },
];

export type CelulaNaTela = {
  data: string;
  doMes: boolean;
  ehHoje: boolean;
  // Até seis, o fechado primeiro (o módulo puro já decidiu).
  pontos: TipoDoPonto[];
  // "{dia da semana}, {d} de {mês}: {resumo}" + " · hoje" — conta TODOS os lançamentos.
  rotulo: string;
};

export type GradeDoMesProps = {
  celulas: CelulaNaTela[];
  // Nenhum lançamento nos dias do mês: "Nada marcado neste mês." embaixo da legenda.
  vazio: boolean;
};

function Ponto({ tipo }: { tipo: TipoDoPonto }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", COR_DO_PONTO[tipo])} />;
}

// A grade do mês (05-UI-SPEC.md §"Aba Agenda — Mês", itens 2-4): cabeçalho "seg … dom", 7 colunas
// com gap de 4px, cada célula um `<button>` de 52px de altura mínima com o número do dia e até seis
// pontos de 8px (`flex-wrap` — a 320px quebram em linhas dentro da célula). Fora do mês:
// `superficie-2` e número `tinta-fraca`; hoje: borda de 2px `acento`. Tocar leva à vista Semana
// daquela semana, rolada até o dia (`#dia-{data}`). A célula fica com menos de 44px de largura
// abaixo de 375px (UI-D21) — o mesmo dia é alcançável pela vista Semana com "‹ ›".
export function GradeDoMes({ celulas, vazio }: GradeDoMesProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div
        data-testid="agenda-mes"
        className="bg-superficie border-borda flex flex-col gap-1 rounded-lg border p-4"
      >
        <div aria-hidden="true" className="grid grid-cols-7 gap-1">
          {CABECALHO_DOS_DIAS_DO_MES.map((dia) => (
            <span key={dia} className="text-apoio text-tinta-fraca text-center font-semibold">
              {dia}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((celula) => (
            <button
              key={celula.data}
              type="button"
              data-testid={`mes-dia-${celula.data}`}
              aria-label={celula.rotulo}
              onClick={() =>
                router.push(rotaDeGestao(`/agenda?semana=${celula.data}#dia-${celula.data}`))
              }
              className={cn(
                "flex min-h-[52px] min-w-0 flex-col items-center justify-start gap-1 rounded-sm px-0.5 py-1",
                "focus-visible:bg-acento-fundo focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none md:hover:bg-acento-fundo",
                celula.doMes ? "bg-superficie" : "bg-superficie-2",
                celula.ehHoje ? "border-acento border-2" : "border-borda border",
              )}
            >
              <span
                className={cn(
                  "text-corpo tabular-nums",
                  celula.doMes ? "text-tinta" : "text-tinta-fraca",
                )}
              >
                {Number(celula.data.slice(8, 10))}
              </span>
              {celula.pontos.length > 0 ? (
                <span aria-hidden="true" className="flex flex-wrap justify-center gap-1">
                  {celula.pontos.map((tipo, indice) => (
                    <Ponto key={`${tipo}-${indice}`} tipo={tipo} />
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <ul className="text-apoio text-tinta-media flex flex-wrap gap-x-4 gap-y-2" data-testid="agenda-mes-legenda">
        {LEGENDA.map((item) => (
          <li key={item.tipo} className="flex items-center gap-1">
            <Ponto tipo={item.tipo} />
            {item.rotulo}
          </li>
        ))}
      </ul>
      {vazio ? (
        <p className="text-apoio text-tinta-fraca" data-testid="agenda-mes-vazio">
          {FRASE_MES_VAZIO}
        </p>
      ) : null}
      <p className="text-apoio text-tinta-fraca">{DICA_DO_MES}</p>
    </div>
  );
}

const CELULAS_DO_ESQUELETO = Array.from({ length: 35 }, (_, indice) => indice);

// O esqueleto do mês (05-UI-SPEC.md §"Estados → Carregando"): o cabeçalho dos dias e 35 células
// de 52px — nunca "carregando..." solto nem tela em branco.
export function EsqueletoDoMes() {
  return (
    <div
      aria-busy="true"
      data-testid="agenda-mes-carregando"
      className="bg-superficie border-borda flex flex-col gap-1 rounded-lg border p-4"
    >
      <div aria-hidden="true" className="grid grid-cols-7 gap-1">
        {CABECALHO_DOS_DIAS_DO_MES.map((dia) => (
          <span key={dia} className="text-apoio text-tinta-fraca text-center font-semibold">
            {dia}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {CELULAS_DO_ESQUELETO.map((celula) => (
          <Skeleton key={celula} className="h-[52px] rounded-sm" />
        ))}
      </div>
    </div>
  );
}

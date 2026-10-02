"use client";

import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import type { VistaDaAgenda } from "@/lib/agenda/abas";
import {
  ARIA_VER_AGENDA_POR,
  ROTULO_HOJE,
  ROTULO_VISTA_MES,
  ROTULO_VISTA_SEMANA,
  TITULO_LANCAR_NA_AGENDA,
} from "@/lib/agenda/textos";
import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

import { enderecoDaAgendaCom } from "./url-da-agenda";

const CLASSE_DA_SETA =
  "border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md border focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

const VISTAS: readonly { valor: VistaDaAgenda; rotulo: string }[] = [
  { valor: "semana", rotulo: ROTULO_VISTA_SEMANA },
  { valor: "mes", rotulo: ROTULO_VISTA_MES },
];

export type BarraDaAgendaProps = {
  vista: VistaDaAgenda;
  // "05/10 a 11/10" (com o ano quando a semana cruza o ano) ou "dezembro de 2026".
  titulo: string;
  rotuloAnterior: string;
  rotuloProximo: string;
  hrefAnterior: string;
  hrefProximo: string;
  // O endereço de cada vista (a semana ou o mês que corresponde ao que está na tela).
  hrefDaVista: Record<VistaDaAgenda, string>;
  // Semana: a semana de hoje, rolada até o cabeçalho de hoje; mês: o mês de hoje.
  hrefHoje: string;
  hoje: string;
};

// A barra da aba Agenda (05-UI-SPEC.md §"Aba Agenda — Semana", itens 1 e 2, e §"Mês", item 1):
// "‹" · título (`tabular-nums`) · "›" e o alternador NEUTRO "Semana · Mês" (`tablist`, setas e
// Home/End — UI-D2; nunca verde nem terracota), tudo em `flex-wrap`: a 320px o alternador desce para
// a linha de baixo e nenhum botão sai da tela. Embaixo, "+ Lançar na agenda" — o ÚNICO botão
// terracota da aba — e "Hoje".
//
// O título NÃO é `whitespace-nowrap` (backstop E2 do UI-SPEC: "o título pode quebrar em duas linhas,
// nunca o botão"). A semana que cruza o ano, "28/12/2026 a 03/01/2027" em Título 20px, mede ~182px no
// Chromium do Windows e ~196px no do Linux; entre os dois botões de 44px e os dois gaps de 8px, isso
// passa dos 272px da coluna a 320px (320 − 2 × 24px). Preso numa linha, o `nav` estourava a coluna e
// empurrava o "›" para fora da tela — rolagem lateral (CI de 02/10/2026, run 36956290624). Livre, o
// título quebra nos espaços ("28/12/2026 a" / "03/01/2027" — a regra de quebra do Unicode não parte
// "dd/mm/aaaa") e o `nav` encolhe até caber; quando cabe, continua numa linha só.
export function BarraDaAgenda({
  vista,
  titulo,
  rotuloAnterior,
  rotuloProximo,
  hrefAnterior,
  hrefProximo,
  hrefDaVista,
  hrefHoje,
  hoje,
}: BarraDaAgendaProps) {
  const router = useRouter();
  const abas = useRef<Partial<Record<VistaDaAgenda, HTMLAnchorElement | null>>>({});

  function aoTeclarNasAbas(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = VISTAS.findIndex((opcao) => opcao.valor === vista);
    let destino: number | null = null;
    if (evento.key === "ArrowRight" || evento.key === "ArrowDown") {
      destino = (atual + 1) % VISTAS.length;
    } else if (evento.key === "ArrowLeft" || evento.key === "ArrowUp") {
      destino = (atual - 1 + VISTAS.length) % VISTAS.length;
    } else if (evento.key === "Home") {
      destino = 0;
    } else if (evento.key === "End") {
      destino = VISTAS.length - 1;
    }
    if (destino === null) {
      return;
    }
    evento.preventDefault();
    const nova = VISTAS[destino].valor;
    abas.current[nova]?.focus();
    if (nova !== vista) {
      router.push(hrefDaVista[nova]);
    }
  }

  // "Hoje" na semana de hoje já aberta: só rola até o cabeçalho de hoje (instantâneo com
  // `prefers-reduced-motion` — o `scroll-behavior` do `:root` decide). Fora dela, navega e o `#`
  // leva até o dia.
  function aoTocarEmHoje(evento: MouseEvent<HTMLAnchorElement>) {
    if (vista !== "semana") {
      return;
    }
    const cabecalho = document.getElementById(`dia-${hoje}`);
    if (cabecalho) {
      evento.preventDefault();
      cabecalho.scrollIntoView({ block: "start" });
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="agenda-barra">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Navegar na agenda" className="flex items-center gap-2">
          <Link href={hrefAnterior} aria-label={rotuloAnterior} data-testid="agenda-anterior" className={CLASSE_DA_SETA}>
            <ChevronLeft aria-hidden="true" />
          </Link>
          <h2 className="text-titulo text-tinta text-center font-semibold tabular-nums" data-testid="agenda-titulo">
            {titulo}
          </h2>
          <Link href={hrefProximo} aria-label={rotuloProximo} data-testid="agenda-proxima" className={CLASSE_DA_SETA}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </nav>

        <div
          role="tablist"
          aria-label={ARIA_VER_AGENDA_POR}
          onKeyDown={aoTeclarNasAbas}
          className="bg-muted flex gap-1 rounded-md p-1"
        >
          {VISTAS.map((opcao) => {
            const marcada = opcao.valor === vista;
            return (
              <Link
                key={opcao.valor}
                ref={(elemento) => {
                  abas.current[opcao.valor] = elemento;
                }}
                href={hrefDaVista[opcao.valor]}
                role="tab"
                aria-selected={marcada}
                tabIndex={marcada ? 0 : -1}
                data-testid={`agenda-vista-${opcao.valor}`}
                className={cn(
                  "text-corpo focus-visible:ring-ring flex min-h-[44px] min-w-[72px] items-center justify-center rounded-sm px-3 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
                  marcada
                    ? "bg-background text-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground font-normal",
                )}
              >
                {opcao.rotulo}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="agenda-lancar"
          onClick={() => irParaSemNavegar(enderecoDaAgendaCom({ lancar: "1", dia: null, evento: null }))}
          className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-md px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus aria-hidden="true" className="size-5" />
          {TITULO_LANCAR_NA_AGENDA}
        </button>
        <Link
          href={hrefHoje}
          data-testid="agenda-hoje"
          onClick={aoTocarEmHoje}
          className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo inline-flex min-h-[52px] items-center justify-center rounded-md border px-6 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          {ROTULO_HOJE}
        </Link>
      </div>
    </div>
  );
}

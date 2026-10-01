"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { ROTULO_HOJE, TITULO_LANCAR_NA_AGENDA } from "@/lib/agenda/textos";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

import { enderecoDaAgendaCom } from "./url-da-agenda";

const CLASSE_DA_SETA =
  "border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md border focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

export type BarraDaAgendaProps = {
  // "05/10 a 11/10" (ou com o ano, quando a semana cruza o ano).
  titulo: string;
  rotuloAnterior: string;
  rotuloProximo: string;
  hrefAnterior: string;
  hrefProximo: string;
  // A semana de hoje, rolada até o cabeçalho de hoje.
  hrefHoje: string;
};

// A barra da aba Agenda (05-UI-SPEC.md §"Aba Agenda — Semana", itens 1 e 2): "‹" · título · "›"
// (`flex-wrap`: a 320px nada sai da tela) e, embaixo, "+ Lançar na agenda" — o ÚNICO botão
// terracota da aba — e "Hoje".
export function BarraDaAgenda({
  titulo,
  rotuloAnterior,
  rotuloProximo,
  hrefAnterior,
  hrefProximo,
  hrefHoje,
}: BarraDaAgendaProps) {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Navegar na agenda" className="flex flex-wrap items-center gap-2">
        <Link href={hrefAnterior} aria-label={rotuloAnterior} data-testid="agenda-anterior" className={CLASSE_DA_SETA}>
          <ChevronLeft aria-hidden="true" />
        </Link>
        <h2 className="text-titulo text-tinta font-semibold whitespace-nowrap tabular-nums" data-testid="agenda-titulo">
          {titulo}
        </h2>
        <Link href={hrefProximo} aria-label={rotuloProximo} data-testid="agenda-proxima" className={CLASSE_DA_SETA}>
          <ChevronRight aria-hidden="true" />
        </Link>
      </nav>

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
          className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo inline-flex min-h-[52px] items-center justify-center rounded-md border px-6 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          {ROTULO_HOJE}
        </Link>
      </div>
    </div>
  );
}

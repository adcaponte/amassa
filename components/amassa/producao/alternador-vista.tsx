"use client";

import { useRef, type KeyboardEvent } from "react";

import { NOME_DO_COOKIE_DA_VISTA, type VistaDaProducao } from "@/lib/producao/quadro";
import { ARIA_ALTERNADOR_VISTA, ROTULO_DA_VISTA } from "@/lib/producao/textos";
import { cn } from "@/lib/utils";

const VISTAS: readonly VistaDaProducao[] = ["quadro", "tempo"];
// Um ano, como o `sidebar_state` do shadcn guarda a lateral (pesquisa, Pergunta 10).
const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

export function idDaAba(vista: VistaDaProducao): string {
  return `producao-aba-${vista}`;
}
export const ID_DO_PAINEL_DA_VISTA = "producao-painel-vista";

export type AlternadorVistaProps = {
  vista: VistaDaProducao;
  aoMudar: (vista: VistaDaProducao) => void;
};

// "Quadro por etapa · Linha do tempo" (UI-SPEC §"Página `/gestao/producao`" item 4; PRD-07, UI-D18):
// lista de abas (tablist) com abas `role="tab"` + `aria-selected` + `aria-controls`; setas, `Home` e `End`
// trocam e levam o foco (tabindex itinerante — só a aba marcada entra no Tab). Visual de
// `abas-financeiro.tsx` (`bg-muted p-1`, marcada `bg-background font-semibold shadow-sm`), NEUTRO —
// nunca terracota (UI-D1). Trocar grava o cookie `producao_vista` (`path=/gestao`, 1 ano) e troca o
// painel sem navegar; a página lê o cookie no servidor antes de pintar. Escolher de novo a mesma
// vista não muda nada.
export function AlternadorVista({ vista, aoMudar }: AlternadorVistaProps) {
  const abas = useRef<Record<VistaDaProducao, HTMLButtonElement | null>>({
    quadro: null,
    tempo: null,
  });

  function escolher(nova: VistaDaProducao, levarFoco: boolean) {
    if (levarFoco) {
      abas.current[nova]?.focus();
    }
    if (nova === vista) {
      return;
    }
    // Por navegador, não por conta (a casa usa dois celulares — suposição A7). Só `quadro`/`tempo`,
    // nenhum dado do ateliê (T-06.1-35).
    document.cookie = `${NOME_DO_COOKIE_DA_VISTA}=${nova}; path=/gestao; max-age=${UM_ANO_EM_SEGUNDOS}; samesite=lax`;
    aoMudar(nova);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = VISTAS.indexOf(vista);
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
    escolher(VISTAS[destino], true);
  }

  return (
    <div
      role="tablist"
      aria-label={ARIA_ALTERNADOR_VISTA}
      data-testid="producao-alternador"
      onKeyDown={aoTeclar}
      className="bg-muted flex gap-1 rounded-md p-1 md:max-w-md"
    >
      {VISTAS.map((opcao) => {
        const marcada = opcao === vista;
        return (
          <button
            key={opcao}
            ref={(elemento) => {
              abas.current[opcao] = elemento;
            }}
            type="button"
            role="tab"
            id={idDaAba(opcao)}
            aria-selected={marcada}
            aria-controls={ID_DO_PAINEL_DA_VISTA}
            tabIndex={marcada ? 0 : -1}
            data-testid={`producao-vista-${opcao}`}
            onClick={() => escolher(opcao, false)}
            className={cn(
              "text-corpo focus-visible:ring-ring flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center font-medium break-words transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
              marcada
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {ROTULO_DA_VISTA[opcao]}
          </button>
        );
      })}
    </div>
  );
}

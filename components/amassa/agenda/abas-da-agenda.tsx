"use client";

import { useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { abaDaAgendaDaUrl, type AbaDaAgenda } from "@/lib/agenda/abas";
import {
  ARIA_PARTES_DA_AGENDA,
  ROTULO_ABA_AGENDA,
  ROTULO_ABA_PESSOAS,
  rotuloDaAbaReceber,
} from "@/lib/agenda/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";

// As abas desta etapa: Agenda · Pessoas · A receber (+ " · {N}" quando há o que receber). "No site" e
// "Números" entram nos planos 15 e 14 — quando as cinco existirem, abaixo de 768px elas quebram em 3 + 2
// (Agenda · Pessoas · A receber | No site · Números) com o espaçador `basis-full md:hidden` entre a
// terceira e a quarta, o mesmo mecanismo de `abas-financeiro.tsx`/`sub-abas-cadastros.tsx` (UI-D1). Com
// três, uma fileira basta.
const ABAS: readonly { valor: AbaDaAgenda; rotulo: (quantosAReceber: number) => string; href: string }[] = [
  { valor: "agenda", rotulo: () => ROTULO_ABA_AGENDA, href: rotaDeGestao("/agenda") },
  { valor: "pessoas", rotulo: () => ROTULO_ABA_PESSOAS, href: rotaDeGestao("/agenda?aba=pessoas") },
  { valor: "receber", rotulo: rotuloDaAbaReceber, href: rotaDeGestao("/agenda?aba=receber") },
];

const CLASSE_DA_ABA =
  "text-corpo flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-sm p-1 text-center font-medium break-words transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

export type AbasDaAgendaProps = {
  // A página passa a aba que ela leu da URL; o `loading.tsx` não recebe a URL e deixa sem — aí a aba
  // vem do endereço atual.
  abaAtual?: AbaDaAgenda;
  // Quantas cobranças estão em "A receber" (UI E15·zero-one-many): 0 ou ausente → "A receber" sem
  // contador. A página lê no servidor, num `Suspense` próprio — as abas aparecem sem esperar a conta.
  quantosAReceber?: number;
};

// As abas da Agenda (05-UI-SPEC.md §"Página /gestao/agenda", item 2; UI-D1): `tablist` "Partes da
// Agenda", NEUTRAS no molde de `abas-financeiro.tsx` (`bg-muted p-1 rounded-md`, a marcada
// `bg-background font-semibold shadow-sm`) — nunca terracota: o terracota da tela é do "+ Lançar na
// agenda". Cada aba é um `<Link>` com `?aba=` — trocar de aba é navegação de página (o voltar do
// navegador volta à aba anterior) e mostra o esqueleto do `loading.tsx`. Setas, Home e End movem o
// foco entre as abas; Enter segue o link.
export function AbasDaAgenda({ abaAtual, quantosAReceber = 0 }: AbasDaAgendaProps) {
  const parametros = useSearchParams();
  const marcada = abaAtual ?? abaDaAgendaDaUrl(parametros.get("aba") ?? undefined);
  const elementos = useRef<Partial<Record<AbaDaAgenda, HTMLAnchorElement | null>>>({});

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const focada = ABAS.findIndex((aba) => elementos.current[aba.valor] === document.activeElement);
    const atual = focada === -1 ? ABAS.findIndex((aba) => aba.valor === marcada) : focada;
    let destino: number | null = null;
    if (evento.key === "ArrowRight" || evento.key === "ArrowDown") {
      destino = (atual + 1) % ABAS.length;
    } else if (evento.key === "ArrowLeft" || evento.key === "ArrowUp") {
      destino = (atual - 1 + ABAS.length) % ABAS.length;
    } else if (evento.key === "Home") {
      destino = 0;
    } else if (evento.key === "End") {
      destino = ABAS.length - 1;
    }
    if (destino === null) {
      return;
    }
    evento.preventDefault();
    elementos.current[ABAS[destino].valor]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ARIA_PARTES_DA_AGENDA}
      data-testid="abas-da-agenda"
      onKeyDown={aoTeclar}
      className="mx-6 flex flex-wrap gap-1 rounded-md bg-muted p-1 md:mx-8 md:max-w-xl"
    >
      {ABAS.map((aba) => {
        const selecionada = aba.valor === marcada;
        return (
          <Link
            key={aba.valor}
            ref={(elemento) => {
              elementos.current[aba.valor] = elemento;
            }}
            href={aba.href}
            role="tab"
            aria-selected={selecionada}
            tabIndex={selecionada ? 0 : -1}
            data-testid={`aba-${aba.valor}`}
            className={cn(
              CLASSE_DA_ABA,
              selecionada
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo(quantosAReceber)}
          </Link>
        );
      })}
    </div>
  );
}

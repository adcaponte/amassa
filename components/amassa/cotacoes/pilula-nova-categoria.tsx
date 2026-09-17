"use client";

import Link from "next/link";

import { ROTULO_NOVA_CATEGORIA } from "@/lib/cotacoes/textos";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

// Client Component pequeno (plano 04.3-01, Tarefa 1) — a pílula tracejada que abre o diálogo de
// nova categoria. ABRIR é `history.pushState` (D-23), nunca `router.push`: o `<Link>` continua
// navegável de verdade (botão direito, "abrir em nova aba" funcionam), mas o toque comum escreve
// a URL sem esperar confirmação de transição nenhuma.
export function PilulaNovaCategoria({ hrefBase }: { hrefBase: string }) {
  const href = `${hrefBase}${hrefBase.includes("?") ? "&" : "?"}categoriaDialogo=nova`;

  return (
    <Link
      href={href}
      onClick={(evento) => {
        evento.preventDefault();
        irParaSemNavegar(href);
      }}
      data-testid="cotacoes-nova-categoria"
      className="border-border text-muted-foreground hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-full border border-dashed px-4 font-medium"
    >
      {ROTULO_NOVA_CATEGORIA}
    </Link>
  );
}

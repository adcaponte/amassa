"use client";

import Link from "next/link";

import { useAbridorDeCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Button } from "@/components/ui/button";

// O botão dos DOIS estados vazios do comparador (UI-SPEC §"Copywriting Contract"): "Nenhuma
// categoria ainda" abre o diálogo de categoria; "Nenhuma cotação aqui ainda" abre o formulário de
// cotação — mesma disciplina de `botao-vazio-abertura.tsx`: um `<Link>` navegável de verdade
// (`href` compartilhável) que ABRE LOCALMENTE no mesmo toque (D-23), sem esperar a navegação
// confirmar.
export function BotaoVazioCotacoes({
  tipo,
  rotulo,
  categoriaId,
}: {
  tipo: "categoria" | "cotacao";
  rotulo: string;
  categoriaId?: string | null;
}) {
  const abridor = useAbridorDeCotacoes();
  const href =
    tipo === "categoria"
      ? `/abertura?aba=cotacoes${categoriaId ? `&categoria=${categoriaId}` : ""}&categoriaDialogo=nova`
      : `/abertura?aba=cotacoes&categoria=${categoriaId}&cotacao=novo`;

  return (
    <Button asChild variant="default" className="min-h-[44px]">
      <Link
        href={href}
        onClick={(evento) => {
          evento.preventDefault();
          irParaSemNavegar(href);
          if (tipo === "cotacao") {
            abridor.abrirCotacao(null);
          }
        }}
      >
        {rotulo}
      </Link>
    </Button>
  );
}

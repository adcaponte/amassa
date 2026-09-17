"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import type { CategoriaDeCotacao } from "@/lib/cotacoes/consultas";
import { rotuloEditarCategoria } from "@/lib/cotacoes/textos";
import { useAbridorDeCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

// Botão-só-ícone que abre `DialogoCategoria` em modo de RENOMEAR (D-15, UI-SPEC §"Sub-abas de
// categoria": botão "···" com `aria-label="Editar categoria «{nome}»"`) — SÓ existe para a
// categoria ATIVA (a sub-aba selecionada), nunca uma pílula por categoria, no mesmo espírito de
// `ConfirmarRemoverItem` ser UMA instância para a lista toda. `?categoriaDialogo=<id>` (o valor É
// o identificador, ao contrário do sentinela "nova" de `PilulaNovaCategoria`) escreve a URL por
// `history.pushState` (D-23) — nunca `router.push`; a categoria INTEIRA é entregue ao abridor no
// mesmo toque (`abridor.abrirCategoriaParaEditar`), porque abrir por `pushState` NÃO busca dado
// novo do servidor — sem o dado local, o campo de nome abriria vazio até a próxima navegação
// completa (mesmo cuidado de `linha-item.tsx`/`ferramentas-linha.tsx` para item/tarefa). Alvo de
// 44px com o glifo menor dentro, mesma técnica de `ferramentas-linha.tsx`.
export function BotaoEditarCategoria({ categoria }: { categoria: CategoriaDeCotacao }) {
  const abridor = useAbridorDeCotacoes();
  const href = `/abertura?aba=cotacoes&categoria=${categoria.id}&categoriaDialogo=${categoria.id}`;

  return (
    <Link
      href={href}
      onClick={(evento) => {
        evento.preventDefault();
        irParaSemNavegar(href);
        abridor.abrirCategoriaParaEditar(categoria);
      }}
      aria-label={rotuloEditarCategoria(categoria.nome)}
      data-testid="cotacoes-editar-categoria"
      className="border-border text-muted-foreground hover:bg-muted flex size-11 flex-none items-center justify-center rounded-full border"
    >
      <Pencil aria-hidden="true" className="size-4" />
    </Link>
  );
}

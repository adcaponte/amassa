"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { rotuloEditarCotacao, rotuloRemoverCotacao } from "@/lib/cotacoes/textos";
import { useAbridorDeCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

export type FerramentasCotacaoProps = {
  cotacao: Cotacao;
  categoriaId: string;
};

// Os dois botões só com ícone de cada linha (`Pencil`/`Trash2`, `aria-hidden="true"` no ícone),
// mesmo molde de `components/amassa/abertura/ferramentas-linha.tsx` — cada um com `aria-label`
// dizendo o que faz E SOBRE O QUÊ, nomeando a empresa (CLAUDE.md §Acessibilidade), nunca só o
// verbo. São `<Link>` de verdade (a URL segue compartilhável) que também abrem localmente no
// mesmo toque (D-23): sem o segundo caminho, um toque cuja navegação não confirma não abre nada.
// Os dois botões medem 30px DENTRO de uma linha/cartão de 44px ou mais — o pai garante a altura
// mínima.
//
// O botão de remover apenas ABRE a confirmação (`ConfirmarRemoverCotacao`, Tarefa 2) — nunca
// apaga direto. Diferente do botão de editar, ele não precisa entregar dado ao abridor: a
// confirmação acha a cotação certa dentro da lista já carregada pela página (mesmo molde de
// `ConfirmarRemoverCategoria`), então só a presença de `?cotacaoRemover=<id>` na URL importa.
export function FerramentasCotacao({ cotacao, categoriaId }: FerramentasCotacaoProps) {
  const abridor = useAbridorDeCotacoes();
  const hrefEditar = `/abertura?aba=cotacoes&categoria=${categoriaId}&cotacao=${cotacao.id}`;
  const hrefRemover = `/abertura?aba=cotacoes&categoria=${categoriaId}&cotacaoRemover=${cotacao.id}`;

  return (
    <div className="flex flex-none items-center gap-0.5">
      <Link
        href={hrefEditar}
        onClick={(evento) => {
          evento.preventDefault();
          irParaSemNavegar(hrefEditar);
          // A cotação INTEIRA entregue ao abridor no mesmo toque — abrir por `history.pushState`
          // não busca dado novo do servidor (mesmo cuidado de `formulario-cotacao.tsx`), e sem
          // ela o campo abriria vazio até a próxima navegação completa.
          abridor.abrirCotacao(cotacao);
        }}
        aria-label={rotuloEditarCotacao(cotacao.empresa)}
        data-testid="cotacoes-editar"
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-[30px] items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href={hrefRemover}
        onClick={(evento) => {
          evento.preventDefault();
          irParaSemNavegar(hrefRemover);
        }}
        aria-label={rotuloRemoverCotacao(cotacao.empresa)}
        data-testid="cotacoes-remover"
        className="text-muted-foreground hover:bg-erro-fundo hover:text-erro focus-visible:ring-ring flex size-[30px] items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

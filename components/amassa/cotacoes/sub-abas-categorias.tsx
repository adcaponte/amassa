import Link from "next/link";

import type { CategoriaDeCotacao } from "@/lib/cotacoes/consultas";
import { cn } from "@/lib/utils";
import { PilulaNovaCategoria } from "@/components/amassa/cotacoes/pilula-nova-categoria";

// Server Component. Diferente da barra de 4 abas (`abas-abertura.tsx`, contagem fixa, largura
// igual), as categorias têm contagem variável — `flex-wrap`, largura por conteúdo, nunca
// `flex-1`, nunca rolagem horizontal (UI-SPEC §"Layout & Navigation Contract"). Navegação por
// query string via `<Link>` NORMAL (RSC) — trocar de categoria é navegação de CONTEÚDO, ao
// contrário de abrir/fechar diálogo (D-23 só vale para diálogo).
//
// Pílula ativa com o tratamento NEUTRO da barra de abas principal (nunca preenchimento
// terracota — UI-SPEC §Color, "um botão terracota por tela, no máximo": o terracota fica só no
// CTA "+ Nova cotação").
//
// A pílula "editar categoria" do UI-SPEC (renomear/excluir, D-15) não faz parte desta fatia: não
// há Server Action de atualização/remoção de categoria em `lib/cotacoes/acoes.ts` ainda — this é
// uma redução de escopo deliberada desta Tarefa, documentada no SUMMARY do plano.
export function SubAbasCategorias({
  categorias,
  categoriaAtivaId,
  contagemPorCategoria,
}: {
  categorias: CategoriaDeCotacao[];
  categoriaAtivaId: string | null;
  contagemPorCategoria: Map<string, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Categorias de cotação"
      className="flex flex-wrap items-center gap-2"
      data-testid="cotacoes-sub-abas"
    >
      {categorias.map((categoria) => {
        const ativa = categoria.id === categoriaAtivaId;
        const contagem = contagemPorCategoria.get(categoria.id) ?? 0;
        return (
          <Link
            key={categoria.id}
            href={`/abertura?aba=cotacoes&categoria=${categoria.id}`}
            role="tab"
            aria-selected={ativa}
            data-testid="cotacoes-sub-aba"
            className={cn(
              "text-corpo flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 font-medium transition-colors",
              ativa
                ? "border-transparent bg-muted text-foreground font-semibold shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {categoria.nome}
            {/* Contagem SEMPRE visível, mesmo "0" (UI-SPEC §Assunções item 4) — nunca omitida.
                `data-testid` próprio: o nome da categoria é um texto livre e pode conter dígitos
                (nomes únicos de teste), então uma asserção contra o texto inteiro da pílula não
                provaria a contagem sozinha. */}
            <span className="text-apoio opacity-70" data-testid="cotacoes-sub-aba-contagem">
              {contagem}
            </span>
          </Link>
        );
      })}

      <PilulaNovaCategoria
        hrefBase={`/abertura?aba=cotacoes${categoriaAtivaId ? `&categoria=${categoriaAtivaId}` : ""}`}
      />
    </div>
  );
}

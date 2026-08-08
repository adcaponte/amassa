import type { ReactNode } from "react";

// Moldura compartilhada de cabeçalho de página (D-01): título em papel `display` à esquerda,
// botão de ação (quando houver) à direita no desktop. `flex-wrap` é o que resolve o transbordo
// no celular — o botão desce para a linha de baixo em vez de espremer o título; nunca
// truncamento do título.
export type CabecalhoPaginaProps = {
  titulo: string;
  children?: ReactNode;
};

export function CabecalhoPagina({ titulo, children }: CabecalhoPaginaProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
      <h1 className="text-display text-foreground">{titulo}</h1>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Moldura compartilhada de cabeçalho de página (D-01): título em papel `display` à esquerda,
// botão de ação (quando houver) à direita no desktop. `flex-wrap` é o que resolve o transbordo
// no celular — o botão desce para a linha de baixo em vez de espremer o título; nunca
// truncamento do título.
export type CabecalhoPaginaProps = {
  titulo: string;
  children?: ReactNode;
  // Controle de voltar OPCIONAL (G-03-3, quick 260820-uot): quando presente, aparece à esquerda
  // do `<h1>`, nas duas larguras de tela. `href` é um destino FIXO (não `router.back()`) — a
  // volta é "subir para o índice", determinística, nunca uma surpresa do histórico do navegador.
  voltar?: { href: string; rotulo: string };
};

export function CabecalhoPagina({ titulo, children, voltar }: CabecalhoPaginaProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        {voltar ? (
          <Link
            href={voltar.href}
            aria-label={voltar.rotulo}
            data-testid="voltar-pagina"
            className="hover:bg-muted flex size-11 shrink-0 -ml-2 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
        ) : null}
        <h1 className="text-display text-foreground">{titulo}</h1>
      </div>
      {children}
    </div>
  );
}

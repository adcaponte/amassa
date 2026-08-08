"use client";

import { CircleUserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { NOME_ACESSIVEL_MENU_USUARIO } from "@/lib/acessibilidade/rotulos";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MenuUsuario } from "@/components/amassa/menu-usuario";

// Cabeçalho fixo no topo do celular (< 768px). À esquerda o título da página; à direita o
// botão de avatar que abre o menu do usuário num Sheet. Este botão é o único da fase inteira
// sem rótulo visível — o `aria-label` abaixo é obrigatório (UI-09) e a asserção de teste
// procura exatamente por esse nome acessível: getByRole('button', { name: 'Abrir menu do
// usuário' }).
//
// A cadeia em si vive em lib/acessibilidade/rotulos.ts (módulo puro, zero import) — não aqui —
// porque tests/e2e/acessibilidade.spec.ts precisa importá-la sem herdar a cadeia de imports
// deste componente (que passa por Server Actions e next-auth, incompatíveis com o carregador
// de teste do Playwright fora do runtime do Next.js). Reexportada abaixo para quem só olha
// este arquivo continuar encontrando a fonte da string.
export { NOME_ACESSIVEL_MENU_USUARIO };

export type CabecalhoMovelProps = {
  nome: string;
  titulo?: string;
  className?: string;
};

export function CabecalhoMovel({ nome, titulo = "AMASSA", className }: CabecalhoMovelProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden",
        className,
      )}
    >
      <span className="truncate text-titulo text-foreground">{titulo}</span>

      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={NOME_ACESSIVEL_MENU_USUARIO}
            className="flex size-11 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <CircleUserRound aria-hidden="true" className="size-10 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <MenuUsuario nome={nome} variante="celular" />
        </SheetContent>
      </Sheet>
    </header>
  );
}

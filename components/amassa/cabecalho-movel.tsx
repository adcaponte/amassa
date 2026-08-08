"use client";

import { CircleUserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MenuUsuario } from "@/components/amassa/menu-usuario";

// Cabeçalho fixo no topo do celular (< 768px). À esquerda o título da página; à direita o
// botão de avatar que abre o menu do usuário num Sheet. Este botão é o único da fase inteira
// sem rótulo visível — o `aria-label` abaixo é obrigatório (UI-09) e a asserção de teste
// procura exatamente por esse nome acessível: getByRole('button', { name: 'Abrir menu do
// usuário' }).
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
            aria-label="Abrir menu do usuário"
            className="flex size-11 items-center justify-center rounded-full"
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

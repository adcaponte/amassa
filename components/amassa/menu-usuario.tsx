"use client";

import Link from "next/link";
import { Calculator, LogOut } from "lucide-react";

import { sair } from "@/lib/auth/acoes";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";

// As três coisas do menu do usuário, exatamente três (D-15): o nome de quem entrou (rótulo,
// não ação), Orçamentos e Sair. Nenhuma Server Action nova — `sair` é a mesma já usada pela
// página provisória da 2a. No desktop este componente é autossuficiente (gatilho + conteúdo,
// via DropdownMenu). No celular ele só entrega o CONTEÚDO — o botão de avatar que abre o
// Sheet vive em `cabecalho-movel.tsx`, dono do `aria-label` obrigatório de UI-09.
export type MenuUsuarioProps = {
  nome: string;
  variante: "desktop" | "celular";
};

export function MenuUsuario({ nome, variante }: MenuUsuarioProps) {
  if (variante === "celular") {
    return (
      <>
        <SheetHeader>
          <SheetTitle className="truncate" title={nome}>
            {nome}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-4 pb-4">
          <Link
            href="/orcamentos"
            className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-corpo text-foreground hover:bg-accent"
          >
            <Calculator aria-hidden="true" className="size-5" />
            Orçamentos
          </Link>
          <form action={sair}>
            <button
              type="submit"
              className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-2 text-left text-corpo text-foreground hover:bg-accent"
            >
              <LogOut aria-hidden="true" className="size-5" />
              Sair
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <span className="truncate" title={nome}>
            {nome}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate" title={nome}>
          {nome}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/orcamentos" className="flex items-center gap-1.5">
            <Calculator aria-hidden="true" />
            Orçamentos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={sair} className="w-full">
            <button type="submit" className="flex w-full items-center gap-1.5 text-left">
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

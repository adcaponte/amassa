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
          {/* Duas armadilhas do Radix aqui, achadas rodando o e2e de verdade (não por leitura
              de código): (1) um <button type="submit"> dentro de <form>, quando é o próprio
              alvo do `asChild`, nunca chega a submeter o form — o clique nativo que dispara a
              submissão não acontece; (2) `asChild` aplica role="menuitem" no elemento raiz
              recebido, então se o próprio <button> fosse o alvo, o nome acessível deixaria de
              responder por getByRole("button", ...) — passaria a ser "menuitem". A saída: o
              alvo do asChild é este <div> (que vira role="menuitem"), e o <button> real fica
              DENTRO dele, mantendo o papel de botão e chamando a Server Action diretamente
              (sem depender de submissão nativa de formulário). Fora do DropdownMenu (variante
              celular, dentro do Sheet) o <form action={sair}> comum funciona normalmente. */}
          <div className="w-full">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-left"
              onClick={() => {
                void sair();
              }}
            >
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

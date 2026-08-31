"use client";

import Link from "next/link";
import { Calculator, KeyRound, LogOut, Store } from "lucide-react";

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

// O menu do usuário: o nome de quem entrou (rótulo, não ação), Abertura do Espaço, Orçamentos,
// Trocar senha e Sair. D-15 fixava "exatamente três coisas"; o BRIEF-NOTURNO.md (Lote C) manda a
// tela de trocar senha ser "alcançável pelo menu do usuário", o que substitui aquela decisão —
// Trocar senha é a quarta entrada. Abertura do Espaço (Fase 4.2) entra ACIMA de Orçamentos, como
// UI-SPEC §"Onde o módulo entra na navegação" decide: é um módulo temporário, e um sexto item na
// barra inferior apertaria os cinco alvos de 44px já dimensionados para cinco — `lib/navegacao/
// itens.ts` não é tocado. No desktop este componente é autossuficiente (gatilho + conteúdo, via
// DropdownMenu). No celular ele só entrega o CONTEÚDO — o botão de avatar que abre o Sheet vive
// em `cabecalho-movel.tsx`, dono do `aria-label` obrigatório de UI-09.
export type MenuUsuarioProps = {
  nome: string;
  variante: "desktop" | "celular";
  // Chamado ao ativar qualquer link/botão da variante celular — fecha o `Sheet` que
  // `cabecalho-movel.tsx` controla por fora. Achado ao rodar o e2e de verdade (não por leitura
  // de código, `04.2-01-SUMMARY.md`): sem isto, uma navegação por `<Link>` dentro do Sheet é uma
  // troca de rota client-side (o layout que contém o Sheet não desmonta), e o Sheet — estado
  // não controlado — continua aberto por cima da página nova, escondendo-a inteira atrás do
  // overlay (Radix marca o resto da árvore `aria-hidden`). No desktop o `DropdownMenu` já fecha
  // sozinho ao selecionar um item (comportamento nativo do Radix), então esta prop não se aplica
  // lá.
  aoNavegar?: () => void;
};

export function MenuUsuario({ nome, variante, aoNavegar }: MenuUsuarioProps) {
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
            href="/abertura"
            onClick={aoNavegar}
            className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-corpo text-foreground hover:bg-accent"
          >
            <Store aria-hidden="true" className="size-5" />
            Abertura do Espaço
          </Link>
          <Link
            href="/orcamentos"
            onClick={aoNavegar}
            className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-corpo text-foreground hover:bg-accent"
          >
            <Calculator aria-hidden="true" className="size-5" />
            Orçamentos
          </Link>
          <Link
            href="/conta/senha"
            onClick={aoNavegar}
            className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-corpo text-foreground hover:bg-accent"
          >
            <KeyRound aria-hidden="true" className="size-5" />
            Trocar senha
          </Link>
          {/* SEM `aoNavegar` aqui, ao contrario das entradas acima — e de proposito.
              `aoNavegar` fecha o Sheet, e fechar o Sheet DESMONTA este formulario. Num botao
              `type="submit"`, o `onClick` corre ANTES do envio: o formulario sumia e a Server
              Action `sair` nunca chegava a rodar. No celular, tocar em "Sair" nao deslogava —
              a pessoa continuava na sessao, num aparelho que o ateliê compartilha.
              Fechar o Sheet nao e necessario aqui: `sair` navega para /login e o layout
              inteiro desmonta junto. Ver tests/e2e/sessao.spec.ts:110, que pega isto. */}
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
          <Link href="/abertura" className="flex items-center gap-1.5">
            <Store aria-hidden="true" />
            Abertura do Espaço
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/orcamentos" className="flex items-center gap-1.5">
            <Calculator aria-hidden="true" />
            Orçamentos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/conta/senha" className="flex items-center gap-1.5">
            <KeyRound aria-hidden="true" />
            Trocar senha
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

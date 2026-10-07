import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// A peça comum `TabelaResponsiva` (Fase 06.5, D-08 causa nº 2 do celular; POL-01): o mesmo dado em
// duas formas — uma lista que cabe em qualquer largura e a tabela de sempre — e só UMA aparece por
// vez. A outra fica `hidden` (`display: none`), fora da árvore de acessibilidade. Generaliza o molde
// de `cotacoes/lista-cotacoes.tsx` com uma diferença: a RÉGUA é a largura do CONTÊINER, não a da
// viewport (UI-D2). A lateral de 240 px faz a viewport mentir — a 980 px de tela o conteúdo tem
// 676 px — e a tabela aparecia sem caber, rolando de lado.
//
// Só tamanhos NOMEADOS do Tailwind v4 (`@sm` = 384 px, `@md` = 448 px, `@3xl` = 768 px), nunca valor
// arbitrário. O Mês usa `@sm` e não o `@md` da UI-D2: na grade de duas colunas, a 1280 px de tela a
// seção tem 442 px de conteúdo, e com `@md` o desktop perderia a tabela (decisão de 05/10/2026). As
// classes ficam escritas por extenso no mapa abaixo: o Tailwind só gera a classe que lê literal no
// código, então nada de montar `@${limiar}:hidden` em tempo de execução.
const CLASSES_DO_LIMIAR = {
  sm: { lista: "@sm:hidden", tabela: "hidden @sm:block" },
  md: { lista: "@md:hidden", tabela: "hidden @md:block" },
  "3xl": { lista: "@3xl:hidden", tabela: "hidden @3xl:block" },
} as const;

export type LimiarDaTabelaResponsiva = keyof typeof CLASSES_DO_LIMIAR;

export type TabelaResponsivaProps = {
  // A partir de que largura de CONTÊINER a tabela cabe de verdade.
  limiar: LimiarDaTabelaResponsiva;
  // O nome acessível da forma lista — o título da seção (UI-SPEC §Teclado e leitor de tela).
  rotulo: string;
  lista: ReactNode;
  tabela: ReactNode;
  className?: string;
};

export function TabelaResponsiva({ limiar, rotulo, lista, tabela, className }: TabelaResponsivaProps) {
  const classes = CLASSES_DO_LIMIAR[limiar];
  return (
    <div data-testid="tabela-responsiva" className={cn("@container min-w-0", className)}>
      <div role="group" aria-label={rotulo} className={classes.lista}>
        {lista}
      </div>
      {/* `overflow-x-auto` é só rede de segurança: acima do limiar o `min-w-[…]` da tabela nunca é
          atingido, e abaixo dele a tabela nem aparece. */}
      <div className={cn(classes.tabela, "overflow-x-auto")}>{tabela}</div>
    </div>
  );
}

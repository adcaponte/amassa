import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// Guarda contra a classe de defeito descoberta em `cartao-painel.tsx` (02b-03 → fechada aqui):
// `tailwind-merge` não conhece a escala tipográfica própria do design system (`display`,
// `titulo`, `corpo`, `apoio`, `micro`, `mono`, `nav` — 04-DESIGN-SYSTEM.md §4). Sem o
// `extendTailwindMerge` de `lib/utils.ts`, um papel combinado com uma cor de texto na mesma
// chamada de `cn()` (o padrão universal de `className={cn(padrao, override)}` do shadcn/ui)
// perde silenciosamente para a cor — nenhum erro, nenhum aviso, só o elemento errado na tela.
// Este teste roda em milissegundos e cobre QUALQUER primitivo shadcn futuro que combine papel +
// cor, não só o caso que a Fase 2b encontrou — é a rede mais barata para esta classe de defeito,
// mais direta que um e2e por componente.
describe("cn() — papéis tipográficos sobrevivem à mesclagem com cor de texto", () => {
  it("mantém 'text-titulo' junto de 'text-foreground'", () => {
    expect(cn("text-titulo", "text-foreground")).toContain("text-titulo");
  });

  it("mantém 'text-display' junto de 'text-foreground'", () => {
    expect(cn("text-display", "text-foreground")).toContain("text-display");
  });

  it("mantém 'text-corpo' junto de 'text-muted-foreground'", () => {
    expect(cn("text-corpo", "text-muted-foreground")).toContain("text-corpo");
  });

  it("continua resolvendo o conflito de verdade entre dois tamanhos nativos do Tailwind", () => {
    // Não é uma extensão que desliga o conflito de tamanho — só ensina o tailwind-merge sobre
    // os papéis novos. Dois tamanhos NATIVOS ainda devem seguir "o último vence".
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });
});

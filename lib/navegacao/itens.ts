// Módulo puro, sem nenhum import: a fonte única dos 5 itens de navegação da casca (barra
// inferior no celular, barra lateral no desktop) e a regra que decide qual deles está ativo
// para um caminho dado. Mesmo padrão de `lib/auth/rotas-publicas.ts` — recebe dados, devolve
// dados, testável no Vitest sem tocar em React nem no `lucide-react`.
//
// Orçamentos NÃO entra aqui (UI-04) — é item do menu do usuário (D-15), não da navegação
// principal.
export type ChaveDeIcone = "inicio" | "encomendas" | "agenda" | "queimas" | "estoque";

export type ItemDeNavegacao = {
  href: string;
  rotulo: string;
  icone: ChaveDeIcone;
};

export const ITENS_NAVEGACAO: readonly ItemDeNavegacao[] = [
  { href: "/", rotulo: "Início", icone: "inicio" },
  { href: "/encomendas", rotulo: "Encomendas", icone: "encomendas" },
  { href: "/agenda", rotulo: "Agenda", icone: "agenda" },
  { href: "/queimas", rotulo: "Queimas", icone: "queimas" },
  { href: "/estoque", rotulo: "Estoque", icone: "estoque" },
];

// Quando `href` é "/", só há casamento por igualdade exata — senão Início ficaria aceso em
// toda rota (a raiz é prefixo de qualquer caminho). Para qualquer outro `href`, casa quando
// `caminho` é igual a `href` ou quando começa com `href` seguido de uma barra separadora —
// isso cobre sub-rotas futuras (`/encomendas/42`) sem casar por prefixo de texto solto
// (`/encomendasx` não é `/encomendas`). Caminho vazio nunca casa com nada.
export function ehItemAtivo(caminho: string, href: string): boolean {
  if (!caminho) {
    return false;
  }

  if (href === "/") {
    return caminho === "/";
  }

  return caminho === href || caminho.startsWith(`${href}/`);
}

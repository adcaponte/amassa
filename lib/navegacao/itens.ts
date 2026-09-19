// Módulo puro, sem nenhum import: a fonte única dos itens de navegação da casca (barra inferior
// no celular, barra lateral no desktop) e a regra que decide qual deles está ativo para um
// caminho dado. Mesmo padrão de `lib/auth/rotas-publicas.ts` — recebe dados, devolve dados,
// testável no Vitest sem tocar em React nem no `lucide-react`.
//
// Celular e lateral DIVERGEM desde a Fase 04.4 (D-04/D-05): o Financeiro entrou nas duas, mas o
// Estoque só saiu da barra do celular (tela vazia até a Fase 6) — no desktop ele continua. A
// barra do celular DEFINITIVA (Início · Financeiro · Produção · Agenda) é da fase do `/gestao`,
// que ainda não existe; esta divergência de hoje é intermediária.
//
// Orçamentos NÃO entra aqui (UI-04) — é item do menu do usuário (D-15), não da navegação
// principal.
export type ChaveDeIcone = "inicio" | "encomendas" | "financeiro" | "agenda" | "queimas" | "estoque";

export type ItemDeNavegacao = {
  href: string;
  rotulo: string;
  icone: ChaveDeIcone;
};

// Barra inferior do celular — 5 itens (D-04): Início, Encomendas, Financeiro, Agenda, Queimas.
export const ITENS_NAVEGACAO_CELULAR: readonly ItemDeNavegacao[] = [
  { href: "/", rotulo: "Início", icone: "inicio" },
  { href: "/encomendas", rotulo: "Encomendas", icone: "encomendas" },
  { href: "/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/agenda", rotulo: "Agenda", icone: "agenda" },
  { href: "/queimas", rotulo: "Queimas", icone: "queimas" },
];

// Barra lateral do desktop — 6 itens (D-05): os cinco de cima mais Estoque, que nunca saiu daqui.
export const ITENS_NAVEGACAO_LATERAL: readonly ItemDeNavegacao[] = [
  { href: "/", rotulo: "Início", icone: "inicio" },
  { href: "/encomendas", rotulo: "Encomendas", icone: "encomendas" },
  { href: "/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/agenda", rotulo: "Agenda", icone: "agenda" },
  { href: "/queimas", rotulo: "Queimas", icone: "queimas" },
  { href: "/estoque", rotulo: "Estoque", icone: "estoque" },
];

// Quando `href` é "/", só há casamento por igualdade exata — senão Início ficaria aceso em
// toda rota (a raiz é prefixo de qualquer caminho). Para qualquer outro `href`, casa quando
// `caminho` é igual a `href` ou quando começa com `href` seguido de uma barra separadora —
// isso cobre sub-rotas futuras (`/encomendas/42`) sem casar por prefixo de texto solto
// (`/encomendasx` não é `/encomendas`). Caminho vazio nunca casa com nada. Regra inalterada
// desde antes da Fase 04.4 — só a lista de entrada muda por superfície.
export function ehItemAtivo(caminho: string, href: string): boolean {
  if (!caminho) {
    return false;
  }

  if (href === "/") {
    return caminho === "/";
  }

  return caminho === href || caminho.startsWith(`${href}/`);
}

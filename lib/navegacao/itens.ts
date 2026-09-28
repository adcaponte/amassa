// Módulo puro, sem nenhum import: a fonte única dos itens de navegação da casca (barra inferior
// no celular, barra lateral no desktop) e a regra que decide qual deles está ativo para um
// caminho dado. Mesmo padrão de `lib/auth/rotas-publicas.ts` — recebe dados, devolve dados,
// testável no Vitest sem tocar em React nem no `lucide-react`.
//
// Celular e lateral DIVERGEM desde a Fase 04.4 (D-04/D-05): o Financeiro entrou nas duas, mas o
// Estoque só saiu da barra do celular (tela vazia até a Fase 6) — no desktop ele continua. A
// barra do celular DEFINITIVA (Início · Financeiro · Produção · Agenda) é da Fase 05 (D-11 de
// 04.6-CONTEXT.md); esta divergência de hoje é intermediária.
//
// Orçamentos NÃO entra aqui (UI-04) — é item do menu do usuário (D-15), não da navegação
// principal.
//
// Fase 04.6 (D-21): a plataforma desceu para `/gestao` — todo `href` abaixo ganhou o prefixo.
// O único import deste módulo é `PREFIXO_GESTAO`, de `lib/rotas/gestao.ts` — outro módulo puro,
// sem valor mutável; a pureza do módulo continua de pé.
import { PREFIXO_GESTAO } from "@/lib/rotas/gestao";

export type ChaveDeIcone = "inicio" | "encomendas" | "financeiro" | "agenda" | "queimas" | "estoque";

export type ItemDeNavegacao = {
  href: string;
  rotulo: string;
  icone: ChaveDeIcone;
};

// Barra inferior do celular — 5 itens (D-04): Início, Encomendas, Financeiro, Agenda, Queimas.
export const ITENS_NAVEGACAO_CELULAR: readonly ItemDeNavegacao[] = [
  { href: "/gestao", rotulo: "Início", icone: "inicio" },
  { href: "/gestao/encomendas", rotulo: "Encomendas", icone: "encomendas" },
  { href: "/gestao/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/gestao/agenda", rotulo: "Agenda", icone: "agenda" },
  { href: "/gestao/queimas", rotulo: "Queimas", icone: "queimas" },
];

// Barra lateral do desktop — 6 itens (D-05): os cinco de cima mais Estoque, que nunca saiu daqui.
export const ITENS_NAVEGACAO_LATERAL: readonly ItemDeNavegacao[] = [
  { href: "/gestao", rotulo: "Início", icone: "inicio" },
  { href: "/gestao/encomendas", rotulo: "Encomendas", icone: "encomendas" },
  { href: "/gestao/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/gestao/agenda", rotulo: "Agenda", icone: "agenda" },
  { href: "/gestao/queimas", rotulo: "Queimas", icone: "queimas" },
  { href: "/gestao/estoque", rotulo: "Estoque", icone: "estoque" },
];

// Quando `href` é o Início (`/gestao`), só há casamento por igualdade exata — senão Início
// ficaria aceso em toda sub-rota, já que `/gestao` virou PREFIXO de tudo (Fase 04.6). Para
// qualquer outro `href`, casa quando `caminho` é igual a `href` ou quando começa com `href`
// seguido de uma barra separadora — isso cobre sub-rotas futuras (`/gestao/encomendas/42`) sem
// casar por prefixo de texto solto (`/gestao/encomendasx` não é `/gestao/encomendas`). Caminho
// vazio nunca casa com nada.
export function ehItemAtivo(caminho: string, href: string): boolean {
  if (!caminho) {
    return false;
  }

  if (href === PREFIXO_GESTAO) {
    return caminho === PREFIXO_GESTAO;
  }

  return caminho === href || caminho.startsWith(`${href}/`);
}

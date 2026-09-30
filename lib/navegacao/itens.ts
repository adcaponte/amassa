// Módulo puro, sem nenhum import: a fonte única dos itens de navegação da casca (barra inferior
// no celular, barra lateral no desktop) e a regra que decide qual deles está ativo para um
// caminho dado. Mesmo padrão de `lib/auth/rotas-publicas.ts` — recebe dados, devolve dados,
// testável no Vitest sem tocar em React nem no `lucide-react`.
//
// Fase 04.6, plano 05 (D-11): esta é a navegação FINAL, substituindo a divergência intermediária
// que a Fase 04.4 criou entre celular e lateral (D-04/D-05 daquela fase). As duas constantes
// abaixo são **independentes de propósito** — a de baixo NUNCA é derivada da lateral por
// `filter`/`slice`. Derivar uma da outra faria um módulo novo entrar na barra de baixo por
// descuido de quem só editou a lateral, que é exatamente o que D-11 proíbe: a regra permanente é
// **módulo novo entra no índice (este arquivo) e na lateral, nunca na barra de baixo** — a
// superfície de uso com a mão suja, em pé, no ateliê, onde cada item a mais reduz o alvo de
// toque dos outros.
//
// Orçamentos NÃO entra aqui (UI-04) — é item do menu do usuário até a Fase 04.5 (D-15), e sai
// dele também na Fase 04.6 (D-12/GES-13): a porta continua sendo `?aba=orcamentos` dentro do
// Financeiro (ORC-17), nunca um item de navegação principal.
//
// Fase 04.6 (D-21): a plataforma desceu para `/gestao` — todo `href` abaixo ganhou o prefixo.
// O único import deste módulo é `PREFIXO_GESTAO`, de `lib/rotas/gestao.ts` — outro módulo puro,
// sem valor mutável; a pureza do módulo continua de pé.
import { PREFIXO_GESTAO } from "@/lib/rotas/gestao";

export type ChaveDeIcone =
  | "inicio"
  | "encomendas"
  | "financeiro"
  | "agenda"
  | "queimas"
  | "estoque"
  | "cadastros";

export type ItemDeNavegacao = {
  href: string;
  rotulo: string;
  icone: ChaveDeIcone;
};

// Barra inferior do celular — EXATAMENTE 4 itens (D-11/GES-12): Início, Financeiro, Produção,
// Agenda. Queimas, Estoque e Cadastros saíram (ou nunca entraram) e continuam a um toque pela
// barra lateral e pelo Início (plano 06).
export const ITENS_NAVEGACAO_CELULAR: readonly ItemDeNavegacao[] = [
  { href: "/gestao", rotulo: "Início", icone: "inicio" },
  { href: "/gestao/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  // Fase 06.1 (D-03): a Produção mora em `/gestao/producao` — o menu aponta DIRETO para ela, nunca
  // para o endereço antigo (`/gestao/encomendas` só redireciona, por seis meses, para favoritos).
  // A chave de ícone continua "encomendas" de propósito: é só a chave do mapa `ICONES` das duas
  // barras (o ícone `Package`), sem efeito visível; renomeá-la mexeria em três componentes e dois
  // testes sem mudar nada na tela (decisão do plano 06.1-14).
  { href: "/gestao/producao", rotulo: "Produção", icone: "encomendas" },
  { href: "/gestao/agenda", rotulo: "Agenda", icone: "agenda" },
];

// Barra lateral do desktop — EXATAMENTE 7 itens (D-11): Início mais TODOS os módulos, na ordem
// do protótipo. Cadastros entra na lateral pela primeira vez nesta fase.
export const ITENS_NAVEGACAO_LATERAL: readonly ItemDeNavegacao[] = [
  { href: "/gestao", rotulo: "Início", icone: "inicio" },
  { href: "/gestao/financeiro", rotulo: "Financeiro", icone: "financeiro" },
  { href: "/gestao/producao", rotulo: "Produção", icone: "encomendas" },
  { href: "/gestao/agenda", rotulo: "Agenda", icone: "agenda" },
  { href: "/gestao/queimas", rotulo: "Queimas", icone: "queimas" },
  { href: "/gestao/estoque", rotulo: "Estoque", icone: "estoque" },
  { href: "/gestao/cadastros", rotulo: "Cadastros", icone: "cadastros" },
];

// Quando `href` é o Início (`/gestao`), só há casamento por igualdade exata — senão Início
// ficaria aceso em toda sub-rota, já que `/gestao` virou PREFIXO de tudo (Fase 04.6). Para
// qualquer outro `href`, casa quando `caminho` é igual a `href` ou quando começa com `href`
// seguido de uma barra separadora — isso cobre sub-rotas (`/gestao/producao/42`) sem
// casar por prefixo de texto solto (`/gestao/producaox` não é `/gestao/producao`). Caminho
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

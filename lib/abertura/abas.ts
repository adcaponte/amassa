// Regra "quais cartões do painel aparecem em qual aba" (pedido do dono, 19/09): "Comprometido" e
// "Sai neste mês" SÓ na aba Por mês; "Precisa de atenção" SÓ na aba Itens (a padrão); nenhum
// cartão em Tarefas ("comparar tarefas não precisa dos cartões") nem em Cotações ("não quero ver
// os cartões enquanto comparo cotações"). Módulo puro, sem nenhum import — nem React, nem banco,
// nem outro módulo de `lib/abertura/*` — para o teste unitário (`tests/unit/abertura-abas.test.ts`)
// cobrir a especificação isolada de qualquer outra peça do sistema.
//
// `AbaAbertura` e `abaDaUrl` viviam antes duplicados em `components/amassa/abertura/abas-abertura.tsx`
// e `components/amassa/abertura/botao-adicionar-abertura.tsx`; moveram para cá (260919-e4n) para
// que o servidor (`page.tsx`) e o cliente (`abas-abertura.tsx`) concordem por construção sobre
// qual é a aba padrão.

export type AbaAbertura = "itens" | "tarefas" | "meses" | "cotacoes";

// Normaliza o valor de `?aba=` (ou de `useAbaAtual()`, no cliente) para uma das quatro abas da
// união fechada. Qualquer valor que não seja exatamente "tarefas"/"meses"/"cotacoes" — ausente,
// vazio, maiúsculo, desconhecido — vira "itens", a aba padrão. Aceita `undefined` além de `null`
// porque é o que `searchParams` (Promise) do servidor entrega quando o parâmetro não está na URL.
export function abaDaUrl(valor: string | null | undefined): AbaAbertura {
  if (valor === "tarefas") return "tarefas";
  if (valor === "meses") return "meses";
  if (valor === "cotacoes") return "cotacoes";
  return "itens";
}

// Os três blocos do painel (D-15/ABE-12) — os mesmos sufixos dos `data-testid`
// `abertura-bloco-*` que já existem em `painel-resumo.tsx`.
export type CartaoDoPainel = "comprometido" | "mes" | "atencao";

// Ordem fixa (D-15) que qualquer lista devolvida por `cartoesDaAba` respeita.
export const ORDEM_DOS_CARTOES: readonly CartaoDoPainel[] = ["comprometido", "mes", "atencao"];

// `Record` tipado sobre `AbaAbertura`: uma quinta aba futura quebra o `tsc` em vez de cair no
// padrão "itens" em silêncio.
const CARTOES_POR_ABA: Record<AbaAbertura, readonly CartaoDoPainel[]> = {
  // Itens: só "Precisa de atenção" — a leitura do que está atrasado/vencido.
  itens: ["atencao"],
  // Tarefas: nenhum cartão — comparar tarefas não precisa do painel de valores.
  tarefas: [],
  // Por mês: "Comprometido" e "Sai neste mês", na ordem de ORDEM_DOS_CARTOES.
  meses: ["comprometido", "mes"],
  // Cotações: nenhum cartão — pedido explícito do dono, "não quero ver os cartões enquanto
  // comparo cotações".
  cotacoes: [],
};

export function cartoesDaAba(aba: AbaAbertura): readonly CartaoDoPainel[] {
  return CARTOES_POR_ABA[aba];
}

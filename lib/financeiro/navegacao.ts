// As URLs do Caixa, montadas num lugar só (D-06) — no molde exato de
// `lib/precificacao/navegacao.ts`, que nasceu de um defeito real (04.5-14): quatro montagens de
// URL espalhadas pelos componentes escreviam "/financeiro?aba=..." à mão e cada uma descartava
// um parâmetro. Módulo puro: nenhum React, nenhum acesso ao banco — os imports são o prefixo da
// plataforma, de `lib/rotas/gestao.ts`, e a origem da Venda (`./abas`), os dois também puros.
//
// `parcelaFoco` é um parâmetro NOVO e não pode colidir com o `?parcela=` que `avisoDaUrl`
// (lib/financeiro/avisos.ts) já usa para o aviso de pagamento — são coisas diferentes: um foca
// uma LINHA (destaque visual, nunca confirma nada), o outro anuncia um pagamento já feito.
import { PREFIXO_GESTAO } from "@/lib/rotas/gestao";

import { textoDaOrigem, type OrigemDaVenda } from "./abas";

export type DestinoDoCaixa = {
  parcelaFoco?: string | null;
};

export function hrefDoCaixa(destino: DestinoDoCaixa = {}): string {
  // `URLSearchParams` escapa sozinho — nenhuma concatenação crua de id na query string.
  const parametros = new URLSearchParams({ aba: "caixa" });

  if (destino.parcelaFoco) {
    parametros.set("parcelaFoco", destino.parcelaFoco);
  }

  return `${PREFIXO_GESTAO}/financeiro?${parametros.toString()}`;
}

// As URLs do editor de um orçamento (aba Orçamentos do Financeiro), montadas num lugar só — o
// mesmo motivo de `hrefDoCaixa` acima, e o CR-01 da revisão da Fase 04.6: 25 pontos escreviam
// "/financeiro?aba=orcamentos&orcamento=..." à mão, todos ainda no endereço ANTIGO da raiz
// (antes de a plataforma ir para `/gestao`), vivos só por causa dos redirecionamentos
// temporários. `extras` entra na ordem dada, depois de `aba` e `orcamento` — a mesma ordem que
// as URLs escritas à mão tinham, para não mudar nada que já dependesse dela.
export function hrefDoOrcamento(
  orcamentoId: string,
  extras: Readonly<Record<string, string>> = {},
): string {
  // `URLSearchParams` escapa sozinho — nenhuma concatenação crua de id na query string.
  const parametros = new URLSearchParams({ aba: "orcamentos", orcamento: orcamentoId });

  for (const [chave, valor] of Object.entries(extras)) {
    parametros.set(chave, valor);
  }

  return `${PREFIXO_GESTAO}/financeiro?${parametros.toString()}`;
}

// A Venda preenchida pela Agenda (Fase 05, plano 12 — AGE-15, UI-D26): o “Lançar na Venda” de “A
// receber” e da folha do uso livre encerrado. `URLSearchParams` escapa o “:” da origem.
export function hrefDaVendaComOrigem(origem: OrigemDaVenda): string {
  const parametros = new URLSearchParams({ aba: "venda", origem: textoDaOrigem(origem) });
  return `${PREFIXO_GESTAO}/financeiro?${parametros.toString()}`;
}

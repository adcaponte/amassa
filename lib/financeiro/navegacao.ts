// As URLs do Caixa, montadas num lugar só (D-06) — no molde exato de
// `lib/precificacao/navegacao.ts`, que nasceu de um defeito real (04.5-14): quatro montagens de
// URL espalhadas pelos componentes escreviam "/financeiro?aba=..." à mão e cada uma descartava
// um parâmetro. Módulo puro: nenhum React, nenhum acesso ao banco.
//
// `parcelaFoco` é um parâmetro NOVO e não pode colidir com o `?parcela=` que `avisoDaUrl`
// (lib/financeiro/avisos.ts) já usa para o aviso de pagamento — são coisas diferentes: um foca
// uma LINHA (destaque visual, nunca confirma nada), o outro anuncia um pagamento já feito.
export type DestinoDoCaixa = {
  parcelaFoco?: string | null;
};

export function hrefDoCaixa(destino: DestinoDoCaixa = {}): string {
  // `URLSearchParams` escapa sozinho — nenhuma concatenação crua de id na query string.
  const parametros = new URLSearchParams({ aba: "caixa" });

  if (destino.parcelaFoco) {
    parametros.set("parcelaFoco", destino.parcelaFoco);
  }

  return `/gestao/financeiro?${parametros.toString()}`;
}

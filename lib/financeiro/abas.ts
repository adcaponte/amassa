// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`. Nesta tarefa (plano 09)
// Mês entra, fechando a união na ordem Venda · Despesa · Caixa · Mês · Cadastros.
export type AbaFinanceiro = "venda" | "despesa" | "caixa" | "mes";

// Normaliza `?aba=` para uma das abas da união fechada — qualquer valor desconhecido, ausente ou
// vazio vira "venda", a aba padrão (o módulo abre direto na Venda, D-06 do 04.4-CONTEXT.md).
export function abaDaUrl(valor: string | null | undefined): AbaFinanceiro {
  if (valor === "despesa") return "despesa";
  if (valor === "caixa") return "caixa";
  if (valor === "mes") return "mes";
  return "venda";
}

// Formato fechado de mês civil "AAAA-MM" — usado por `mesDaUrl` abaixo E por `mes.ts`/
// `extrato.ts` (redeclarado neste arquivo por ser o único módulo de abas do Financeiro; os outros
// dois importam só o TIPO, nunca o regex).
const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// Normaliza `?mes=` para "AAAA-MM" — mês inválido, mal formado ou ausente cai no mês de HOJE
// (argumento explícito, nunca `new Date()` interno: este módulo continua puro). "2021-13" tem o
// formato de dois dígitos mas mês inexistente — o regex acima já recusa (só aceita 01-12).
export function mesDaUrl(valor: string | null | undefined, hoje: string): string {
  if (valor && FORMATO_MES.test(valor)) {
    return valor;
  }
  return hoje.slice(0, 7);
}

export type FormaDoFiltroDoExtrato = "todas" | "dinheiro" | "pix" | "cartao";

// Normaliza `?forma=` para uma das quatro opções do filtro do extrato (D-11) — qualquer valor
// desconhecido, ausente ou vazio cai em "todas" (nenhum filtro aplicado).
export function formaDaUrl(valor: string | null | undefined): FormaDoFiltroDoExtrato {
  if (valor === "dinheiro" || valor === "pix" || valor === "cartao") {
    return valor;
  }
  return "todas";
}

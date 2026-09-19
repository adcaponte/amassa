// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`. Nesta tarefa (plano 07)
// Despesa entra; o plano 09 (Mês) acrescenta o último valor da união, sempre na ordem
// Venda · Despesa · Caixa · Mês · Cadastros.
export type AbaFinanceiro = "venda" | "despesa" | "caixa";

// Normaliza `?aba=` para uma das abas da união fechada — qualquer valor desconhecido, ausente ou
// vazio vira "venda", a aba padrão (o módulo abre direto na Venda, D-06 do 04.4-CONTEXT.md).
export function abaDaUrl(valor: string | null | undefined): AbaFinanceiro {
  if (valor === "despesa") return "despesa";
  if (valor === "caixa") return "caixa";
  return "venda";
}

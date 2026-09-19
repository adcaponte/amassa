// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`. Nesta tarefa só Venda e
// Caixa existem; os planos 07 (Despesa) e 09 (Mês) acrescentam os outros dois valores da união,
// sempre na ordem Venda · Despesa · Caixa · Mês · Cadastros.
export type AbaFinanceiro = "venda" | "caixa";

// Normaliza `?aba=` para uma das abas da união fechada — qualquer valor desconhecido, ausente ou
// vazio vira "venda", a aba padrão (o módulo abre direto na Venda, D-06 do 04.4-CONTEXT.md).
export function abaDaUrl(valor: string | null | undefined): AbaFinanceiro {
  if (valor === "caixa") return "caixa";
  return "venda";
}

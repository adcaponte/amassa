// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`/`lib/financeiro/abas.ts`.
export type SubCadastros = "catalogo" | "categorias" | "fixas" | "taxas";

// Normaliza `?sub=` para uma das quatro sub-abas de Cadastros — ausente, vazio ou desconhecido
// vira "catalogo", a sub-aba padrão (04.4-UI-SPEC.md §"Dentro de Cadastros (4 sub-abas)").
export function subDaUrl(valor: string | null | undefined): SubCadastros {
  if (valor === "categorias") return "categorias";
  if (valor === "fixas") return "fixas";
  if (valor === "taxas") return "taxas";
  return "catalogo";
}

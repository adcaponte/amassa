// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`/`lib/financeiro/abas.ts`.
export type SubCadastros = "catalogo" | "categorias" | "fixas" | "taxas" | "parametros";

// Normaliza `?sub=` para uma das CINCO sub-abas de Cadastros — ausente, vazio ou desconhecido
// vira "catalogo", a sub-aba padrão (04.4-UI-SPEC.md §"Dentro de Cadastros"). "parametros" é nova
// na Fase 04.5 (D-03): os parâmetros de precificação são cadastro, não operação do dia.
export function subDaUrl(valor: string | null | undefined): SubCadastros {
  if (valor === "categorias") return "categorias";
  if (valor === "fixas") return "fixas";
  if (valor === "taxas") return "taxas";
  if (valor === "parametros") return "parametros";
  return "catalogo";
}

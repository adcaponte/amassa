// Módulo puro, sem nenhum import — mesmo molde de `lib/abertura/abas.ts`/`lib/financeiro/abas.ts`.
export type SubCadastros =
  | "catalogo"
  | "categorias"
  | "clientes"
  | "fixas"
  | "taxas"
  | "parametros"
  | "fornecedores";

// Normaliza `?sub=` para uma das SETE sub-abas de Cadastros — ausente, vazio ou desconhecido
// vira "catalogo", a sub-aba padrão (04.4-UI-SPEC.md §"Dentro de Cadastros"). "parametros" é nova
// na Fase 04.5 (D-03): os parâmetros de precificação são cadastro, não operação do dia. "clientes"
// é nova na Fase 5 (D-01): o cadastro de pessoas, o mesmo das Pessoas da Agenda. "fornecedores" é
// nova na Fase 06.2 (UI-D1): quem vende para o ateliê. A comparação é exata — caixa diferente ou
// espaço em volta também caem em "catalogo" (a URL é montada pelo sistema, nunca digitada).
export function subDaUrl(valor: string | null | undefined): SubCadastros {
  if (valor === "categorias") return "categorias";
  if (valor === "clientes") return "clientes";
  if (valor === "fixas") return "fixas";
  if (valor === "taxas") return "taxas";
  if (valor === "parametros") return "parametros";
  if (valor === "fornecedores") return "fornecedores";
  return "catalogo";
}

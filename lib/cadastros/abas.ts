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

// A ordem das sete pílulas na fileira única (D-09, Fase 06.5): o que se vende e a quem
// (Catálogo · Clientes · Fornecedores), depois os números que o dinheiro usa (Contas fixas ·
// Categorias · Parâmetros · Taxas). O componente só percorre esta lista — a ordem é verificável
// sem navegador (`tests/unit/cadastros-abas.test.ts`).
export const ORDEM_DAS_SUBS_CADASTROS: readonly SubCadastros[] = [
  "catalogo",
  "clientes",
  "fornecedores",
  "fixas",
  "categorias",
  "parametros",
  "taxas",
];

// Quanto rolar o trilho para a pílula ficar no meio dele — só no eixo horizontal (UI-SPEC §"Abas dos
// Cadastros": nunca `scrollIntoView`, que rolaria a página na vertical). `inicioDaPilula` é a
// distância da borda esquerda da pílula ao começo do conteúdo do trilho (o `offsetLeft` com o trilho
// como `offsetParent`). Nunca devolve menos que 0; o teto (`scrollWidth - clientWidth`) o próprio
// navegador aplica ao atribuir `scrollLeft`.
export function deslocamentoParaCentralizar({
  larguraDoTrilho,
  inicioDaPilula,
  larguraDaPilula,
}: {
  larguraDoTrilho: number;
  inicioDaPilula: number;
  larguraDaPilula: number;
}): number {
  return Math.max(0, inicioDaPilula - (larguraDoTrilho - larguraDaPilula) / 2);
}

// As frases fixas e os rótulos do módulo Abertura do Espaço — só `import type` é permitido
// aqui (nenhum import de valor), no molde de `lib/queimas/textos.ts`: o módulo não lê React
// nem o cliente do banco.
import type { categoriaItemAbertura } from "@/db/schema";

export type CategoriaDeItem = (typeof categoriaItemAbertura.enumValues)[number];

export const TITULO_MODULO = "Abertura do Espaço";

// D-08 — os seis rótulos, na mesma ordem em que os grupos aparecem na lista (ORDEM_DAS_
// CATEGORIAS). O valor do enum é sem acento e em minúsculas; o rótulo em português com acento
// vive só aqui, nunca no banco.
export const ROTULO_CATEGORIA: Record<CategoriaDeItem, string> = {
  moveis: "Móveis",
  equipamentos: "Equipamentos",
  material: "Material",
  utensilios: "Utensílios",
  obra: "Obra",
  outros: "Outros",
};

export const ORDEM_DAS_CATEGORIAS: readonly CategoriaDeItem[] = [
  "moveis",
  "equipamentos",
  "material",
  "utensilios",
  "obra",
  "outros",
];

export const ROTULO_NOVO_ITEM = "+ Adicionar item";
export const ROTULO_SALVAR_ITEM = "Adicionar item";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// Estado vazio da aba de itens (UI-SPEC §"Estados vazios") — verbatim.
export const FRASE_VAZIO_TITULO = "Nada aqui ainda.";
export const FRASE_VAZIO_CORPO = "Comece pelo que você já sabe que precisa comprar.";

// Estado de erro da rota (UI-SPEC §"Estados de erro") — verbatim, mesmo par de
// `lib/queimas/textos.ts`/`lib/encomendas/textos.ts`.
export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar a abertura do espaço. Verifique a internet e tente de novo.";

export const ROTULO_COMPROMETIDO = "Comprometido";
export const ROTULO_A_VISTA = "à vista";
export const ROTULO_A_PRAZO = "a prazo";

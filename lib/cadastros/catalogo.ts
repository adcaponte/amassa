// Módulo puro do Catálogo — só `import type` é permitido aqui (04.4-05-PLAN.md, Tarefa 1); nenhuma
// linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do plano). `Unidade` é
// REDECLARADO (mesma disciplina de `lib/cadastros/categorias.ts` — nem um `import type` de
// `@/db/schema` é permitido, só o import local de tipo abaixo, que já é puro).
//
// `validarItem` espelha, um a um, os `check`s de `itens_catalogo` e `ficha_tecnica` gravados em
// `db/schema.ts` (migração 0014, 04.4-01-PLAN.md):
//   itens_catalogo_aparece_ou_controla, itens_catalogo_aparece_exige_categoria_venda,
//   itens_catalogo_atalho_venda_exige_aparece,
//   itens_catalogo_controla_exige_unidade_e_categoria_compra,
//   itens_catalogo_atalho_compra_exige_controla,
//   ficha_tecnica_item_diferente_insumo, ficha_tecnica_quantidade_positiva.
// (`itens_catalogo_preco_no_intervalo` é conferido em `lib/financeiro/dinheiro.ts::
// converterReaisParaCentavos`, não aqui — o preço já chega convertido em centavos.) O banco é a
// última camada de defesa; a frase humana que o gestor lê vem sempre daqui — a MESMA chamada, no
// diálogo (mostrar) e na Server Action (gravar).
import type { AreaFinanceira } from "./categorias";

export type { AreaFinanceira };

// Espelha à mão o enum `unidade_estoque` do banco — nenhum import de `@/db` é permitido neste
// módulo, mesma disciplina de `lib/cadastros/categorias.ts` para os enums de categoria.
export type Unidade = "un" | "g" | "kg" | "ml" | "l" | "m";

// Rótulo de exibição de cada unidade — só "l" (litro) diverge do próprio valor, virando "L"
// maiúsculo (mesma regra de `unidadeExibida`, lib/financeiro/efeito-estoque.ts).
export const ROTULO_UNIDADE: Record<Unidade, string> = {
  un: "un",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
  m: "m",
};

export const MAXIMO_DE_INSUMOS_POR_ITEM = 20;

export const FRASE_ITEM_SEM_VENDA_NEM_ESTOQUE =
  "Marque Aparece na venda ou Tem estoque próprio — senão o item não aparece em lugar nenhum.";
export const FRASE_VENDA_SEM_CATEGORIA =
  "Escolha uma categoria de venda — ela decide a área do item.";
export const FRASE_ATALHO_VENDA_SEM_APARECE =
  "Só dá para pôr nos mais usados um item que aparece na venda.";
export const FRASE_ESTOQUE_SEM_UNIDADE = "Escolha a unidade do estoque.";
export const FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA = "Escolha a categoria da compra.";
export const FRASE_ATALHO_COMPRA_SEM_ESTOQUE =
  "Só dá para pôr nos atalhos da compra um item com estoque próprio.";
export const FRASE_FICHA_MUITOS_INSUMOS = `No máximo ${MAXIMO_DE_INSUMOS_POR_ITEM} insumos por item.`;
export const FRASE_FICHA_PROPRIO_ITEM = "Um item não pode ser insumo dele mesmo.";
export const FRASE_FICHA_INSUMO_REPETIDO = "Esse insumo já está na ficha técnica.";
export const FRASE_FICHA_QUANTIDADE_INVALIDA = "A quantidade precisa ser maior que zero.";
export const FRASE_FICHA_INSUMO_NAO_EXISTE_MAIS =
  "Esse insumo não existe mais — recarregue a página e tente de novo.";

export function fraseInsumoSemEstoque(nomeDoInsumo: string): string {
  return `${nomeDoInsumo} não tem estoque próprio — só um item com estoque pode ser insumo.`;
}

export function fraseItemEhInsumoDe(nomeDoItem: string): string {
  return `Esse item é insumo de ${nomeDoItem} — tire da ficha técnica antes.`;
}

export type EntradaDeFichaTecnica = {
  insumoId: string;
  quantidade: number;
};

export type InsumoDisponivel = {
  id: string;
  nome: string;
  controlaEstoque: boolean;
};

export type EntradaDeItem = {
  // `null` ao criar — o item ainda não tem id, não pode ser insumo de si mesmo por definição. Ao
  // editar, o id do próprio item, para a checagem "a ficha não pode ter o próprio item".
  id: string | null;
  categoriaVendaId: string | null;
  precoVendaCentavos: number | null;
  aparecenaVenda: boolean;
  atalhoVenda: boolean;
  controlaEstoque: boolean;
  atalhoCompra: boolean;
  unidade: Unidade | null;
  categoriaCompraId: string | null;
  ficha: readonly EntradaDeFichaTecnica[];
};

export type ResultadoDeValidacao = { ok: true } | { ok: false; erro: string };

// A regra única do item e da ficha técnica — chamada IDÊNTICA no diálogo (mostrar) e na Server
// Action (gravar), nunca uma segunda cópia (04.4-05-PLAN.md, key_links). `insumosDisponiveis` é
// SEMPRE o retrato carregado do banco (id → {nome, controlaEstoque}) — quem chama nunca confia no
// que o cliente diz sobre um insumo.
export function validarItem(
  entrada: EntradaDeItem,
  insumosDisponiveis: ReadonlyMap<string, InsumoDisponivel>,
): ResultadoDeValidacao {
  if (!entrada.aparecenaVenda && !entrada.controlaEstoque) {
    return { ok: false, erro: FRASE_ITEM_SEM_VENDA_NEM_ESTOQUE };
  }
  if (entrada.aparecenaVenda && !entrada.categoriaVendaId) {
    return { ok: false, erro: FRASE_VENDA_SEM_CATEGORIA };
  }
  if (entrada.atalhoVenda && !entrada.aparecenaVenda) {
    return { ok: false, erro: FRASE_ATALHO_VENDA_SEM_APARECE };
  }
  if (entrada.controlaEstoque && !entrada.unidade) {
    return { ok: false, erro: FRASE_ESTOQUE_SEM_UNIDADE };
  }
  if (entrada.controlaEstoque && !entrada.categoriaCompraId) {
    return { ok: false, erro: FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA };
  }
  if (entrada.atalhoCompra && !entrada.controlaEstoque) {
    return { ok: false, erro: FRASE_ATALHO_COMPRA_SEM_ESTOQUE };
  }

  if (entrada.ficha.length > MAXIMO_DE_INSUMOS_POR_ITEM) {
    return { ok: false, erro: FRASE_FICHA_MUITOS_INSUMOS };
  }

  const insumosVistos = new Set<string>();
  for (const linha of entrada.ficha) {
    if (entrada.id !== null && linha.insumoId === entrada.id) {
      return { ok: false, erro: FRASE_FICHA_PROPRIO_ITEM };
    }
    if (insumosVistos.has(linha.insumoId)) {
      return { ok: false, erro: FRASE_FICHA_INSUMO_REPETIDO };
    }
    insumosVistos.add(linha.insumoId);

    const insumo = insumosDisponiveis.get(linha.insumoId);
    if (!insumo) {
      return { ok: false, erro: FRASE_FICHA_INSUMO_NAO_EXISTE_MAIS };
    }
    if (!insumo.controlaEstoque) {
      return { ok: false, erro: fraseInsumoSemEstoque(insumo.nome) };
    }
    if (linha.quantidade <= 0) {
      return { ok: false, erro: FRASE_FICHA_QUANTIDADE_INVALIDA };
    }
  }

  return { ok: true };
}

// Área do item: vem da categoria de VENDA; sem ela, da categoria de COMPRA; sem as duas, "geral"
// (04.4-05-PLAN.md must_have — "a área do item nunca é escolhida, vem da categoria de venda, ou da
// de compra quando o item não se vende").
export function areaDoItem(
  categoriaVenda: { area: AreaFinanceira } | null,
  categoriaCompra: { area: AreaFinanceira } | null,
): AreaFinanceira {
  if (categoriaVenda) {
    return categoriaVenda.area;
  }
  if (categoriaCompra) {
    return categoriaCompra.area;
  }
  return "geral";
}

export type FichaDeOutroItem = {
  itemNome: string;
  insumoId: string;
};

// Um item só pode deixar de ter estoque próprio se nenhum OUTRO item o usa como insumo — recusa
// com o nome do PRIMEIRO item encontrado (ordem de `fichasDeOutros`), nunca "algum item".
export function podeDeixarDeTerEstoque(
  itemId: string,
  fichasDeOutros: readonly FichaDeOutroItem[],
): ResultadoDeValidacao {
  const usoEncontrado = fichasDeOutros.find((linha) => linha.insumoId === itemId);
  if (usoEncontrado) {
    return { ok: false, erro: fraseItemEhInsumoDe(usoEncontrado.itemNome) };
  }
  return { ok: true };
}

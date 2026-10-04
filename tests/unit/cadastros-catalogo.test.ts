import { describe, expect, it } from "vitest";

import {
  FRASE_ATALHO_COMPRA_SEM_ESTOQUE,
  FRASE_ATALHO_VENDA_SEM_APARECE,
  FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA,
  FRASE_ESTOQUE_SEM_UNIDADE,
  FRASE_FICHA_INSUMO_REPETIDO,
  FRASE_FICHA_MUITOS_INSUMOS,
  FRASE_FICHA_PROPRIO_ITEM,
  FRASE_FICHA_QUANTIDADE_INVALIDA,
  FRASE_ITEM_SEM_VENDA_NEM_ESTOQUE,
  FRASE_VENDA_SEM_CATEGORIA,
  ROTULO_UNIDADE,
  areaDoItem,
  categoriaDeCompraValida,
  categoriaDeVendaValida,
  fraseInsumoSemEstoque,
  fraseItemEhInsumoDe,
  podeDeixarDeTerEstoque,
  podeDesativarItem,
  validarItem,
  type EntradaDeItem,
  type InsumoDisponivel,
} from "../../lib/cadastros/catalogo";
import { esquemaAtivacaoDeItem } from "../../lib/cadastros/esquemas";
import {
  FRASE_ITEM_DAS_QUEIMAS,
  FRASE_ITEM_DO_SISTEMA,
  LINHA_ITEM_DAS_QUEIMAS,
  LINHA_ITEM_DO_SISTEMA,
  fraseDoItemDoSistema,
  linhaDoItemDoSistema,
} from "../../lib/cadastros/textos";

const CATEGORIA_VENDA_ID = "11111111-1111-1111-1111-111111111111";
const CATEGORIA_COMPRA_ID = "22222222-2222-2222-2222-222222222222";
const INSUMO_ID = "33333333-3333-3333-3333-333333333333";
const OUTRO_INSUMO_ID = "44444444-4444-4444-4444-444444444444";
const ITEM_ID = "55555555-5555-5555-5555-555555555555";

const INSUMO_COM_ESTOQUE: InsumoDisponivel = {
  id: INSUMO_ID,
  nome: "Grão de café",
  controlaEstoque: true,
};

const OUTRO_INSUMO_COM_ESTOQUE: InsumoDisponivel = {
  id: OUTRO_INSUMO_ID,
  nome: "Leite",
  controlaEstoque: true,
};

const INSUMO_SEM_ESTOQUE: InsumoDisponivel = {
  id: INSUMO_ID,
  nome: "Copo descartável",
  controlaEstoque: false,
};

function itemBase(sobrescritas: Partial<EntradaDeItem> = {}): EntradaDeItem {
  return {
    id: null,
    categoriaVendaId: null,
    precoVendaCentavos: null,
    aparecenaVenda: false,
    atalhoVenda: false,
    controlaEstoque: false,
    atalhoCompra: false,
    unidade: null,
    categoriaCompraId: null,
    ficha: [],
    ...sobrescritas,
  };
}

describe("validarItem", () => {
  it("item só vendável (aparece na venda, categoria de venda, preço 800) é válido", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        precoVendaCentavos: 800,
      }),
      new Map(),
    );
    expect(resultado).toEqual({ ok: true });
  });

  it("item só vendável sem preço é válido (valor na hora)", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        precoVendaCentavos: null,
      }),
      new Map(),
    );
    expect(resultado).toEqual({ ok: true });
  });

  it("item só insumo (estoque, unidade g, categoria da compra) é válido", () => {
    const resultado = validarItem(
      itemBase({
        controlaEstoque: true,
        unidade: "g",
        categoriaCompraId: CATEGORIA_COMPRA_ID,
      }),
      new Map(),
    );
    expect(resultado).toEqual({ ok: true });
  });

  it("nem venda nem estoque é recusado com a frase dos dois checkboxes", () => {
    const resultado = validarItem(itemBase(), new Map());
    expect(resultado).toEqual({ ok: false, erro: FRASE_ITEM_SEM_VENDA_NEM_ESTOQUE });
  });

  it("aparece na venda sem categoria de venda é recusado", () => {
    const resultado = validarItem(itemBase({ aparecenaVenda: true }), new Map());
    expect(resultado).toEqual({ ok: false, erro: FRASE_VENDA_SEM_CATEGORIA });
  });

  it("atalho de venda sem aparecer na venda é recusado", () => {
    const resultado = validarItem(
      itemBase({
        controlaEstoque: true,
        unidade: "un",
        categoriaCompraId: CATEGORIA_COMPRA_ID,
        atalhoVenda: true,
      }),
      new Map(),
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_ATALHO_VENDA_SEM_APARECE });
  });

  it("atalho de compra sem estoque é recusado", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        atalhoCompra: true,
      }),
      new Map(),
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_ATALHO_COMPRA_SEM_ESTOQUE });
  });

  it("estoque sem unidade é recusado", () => {
    const resultado = validarItem(
      itemBase({ controlaEstoque: true, categoriaCompraId: CATEGORIA_COMPRA_ID }),
      new Map(),
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_ESTOQUE_SEM_UNIDADE });
  });

  it("estoque sem categoria da compra é recusado", () => {
    const resultado = validarItem(itemBase({ controlaEstoque: true, unidade: "kg" }), new Map());
    expect(resultado).toEqual({ ok: false, erro: FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA });
  });

  it("ficha com o próprio item como insumo é recusada", () => {
    const resultado = validarItem(
      itemBase({
        id: ITEM_ID,
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        ficha: [{ insumoId: ITEM_ID, quantidade: 1 }],
      }),
      new Map([[ITEM_ID, { id: ITEM_ID, nome: "Café", controlaEstoque: true }]]),
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_FICHA_PROPRIO_ITEM });
  });

  it("insumo repetido na ficha é recusado", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        ficha: [
          { insumoId: INSUMO_ID, quantidade: 1 },
          { insumoId: INSUMO_ID, quantidade: 2 },
        ],
      }),
      new Map([[INSUMO_ID, INSUMO_COM_ESTOQUE]]),
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_FICHA_INSUMO_REPETIDO });
  });

  it("insumo sem estoque próprio é recusado com o nome dele", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        ficha: [{ insumoId: INSUMO_ID, quantidade: 1 }],
      }),
      new Map([[INSUMO_ID, INSUMO_SEM_ESTOQUE]]),
    );
    expect(resultado).toEqual({
      ok: false,
      erro: fraseInsumoSemEstoque("Copo descartável"),
    });
  });

  it("quantidade zero na ficha é recusada", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        ficha: [{ insumoId: INSUMO_ID, quantidade: 0 }],
      }),
      new Map([[INSUMO_ID, INSUMO_COM_ESTOQUE]]),
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_FICHA_QUANTIDADE_INVALIDA });
  });

  it("21 insumos na ficha é recusado", () => {
    const insumos = new Map<string, InsumoDisponivel>();
    const ficha = Array.from({ length: 21 }, (_, indice) => {
      const id = `insumo-${indice}`;
      insumos.set(id, { id, nome: `Insumo ${indice}`, controlaEstoque: true });
      return { insumoId: id, quantidade: 1 };
    });

    const resultado = validarItem(
      itemBase({ aparecenaVenda: true, categoriaVendaId: CATEGORIA_VENDA_ID, ficha }),
      insumos,
    );
    expect(resultado).toEqual({ ok: false, erro: FRASE_FICHA_MUITOS_INSUMOS });
  });

  it("20 insumos na ficha é aceito (o teto, não além dele)", () => {
    const insumos = new Map<string, InsumoDisponivel>();
    const ficha = Array.from({ length: 20 }, (_, indice) => {
      const id = `insumo-${indice}`;
      insumos.set(id, { id, nome: `Insumo ${indice}`, controlaEstoque: true });
      return { insumoId: id, quantidade: 1 };
    });

    const resultado = validarItem(
      itemBase({ aparecenaVenda: true, categoriaVendaId: CATEGORIA_VENDA_ID, ficha }),
      insumos,
    );
    expect(resultado).toEqual({ ok: true });
  });

  it("quantidade com três casas decimais válida (0,04) é aceita", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        ficha: [{ insumoId: INSUMO_ID, quantidade: 0.04 }],
      }),
      new Map([[INSUMO_ID, INSUMO_COM_ESTOQUE]]),
    );
    expect(resultado).toEqual({ ok: true });
  });

  it("ficha com dois insumos distintos, ambos com estoque, é aceita", () => {
    const resultado = validarItem(
      itemBase({
        aparecenaVenda: true,
        categoriaVendaId: CATEGORIA_VENDA_ID,
        ficha: [
          { insumoId: INSUMO_ID, quantidade: 15 },
          { insumoId: OUTRO_INSUMO_ID, quantidade: 200 },
        ],
      }),
      new Map([
        [INSUMO_ID, INSUMO_COM_ESTOQUE],
        [OUTRO_INSUMO_ID, OUTRO_INSUMO_COM_ESTOQUE],
      ]),
    );
    expect(resultado).toEqual({ ok: true });
  });
});

describe("areaDoItem", () => {
  it("usa a área da categoria de venda quando ela existe", () => {
    expect(areaDoItem({ area: "cafeteria" }, { area: "loja" })).toBe("cafeteria");
  });

  it("sem categoria de venda, usa a área da categoria de compra", () => {
    expect(areaDoItem(null, { area: "loja" })).toBe("loja");
  });

  it("sem as duas categorias, cai em 'geral'", () => {
    expect(areaDoItem(null, null)).toBe("geral");
  });
});

describe("podeDeixarDeTerEstoque", () => {
  it("é falso, com o nome do primeiro item que usa como insumo", () => {
    const resultado = podeDeixarDeTerEstoque(INSUMO_ID, [
      { itemNome: "Café 200 ml", insumoId: INSUMO_ID },
      { itemNome: "Café 300 ml", insumoId: INSUMO_ID },
    ]);
    expect(resultado).toEqual({ ok: false, erro: fraseItemEhInsumoDe("Café 200 ml") });
  });

  it("é verdadeiro quando nenhum outro item usa como insumo", () => {
    const resultado = podeDeixarDeTerEstoque(INSUMO_ID, [
      { itemNome: "Bolo de fubá", insumoId: OUTRO_INSUMO_ID },
    ]);
    expect(resultado).toEqual({ ok: true });
  });

  it("é verdadeiro quando não há nenhuma ficha de outro item", () => {
    expect(podeDeixarDeTerEstoque(INSUMO_ID, [])).toEqual({ ok: true });
  });
});

describe("ROTULO_UNIDADE", () => {
  it("'l' vira 'L' maiúsculo; as demais são iguais ao próprio valor", () => {
    expect(ROTULO_UNIDADE.l).toBe("L");
    expect(ROTULO_UNIDADE.un).toBe("un");
    expect(ROTULO_UNIDADE.g).toBe("g");
    expect(ROTULO_UNIDADE.kg).toBe("kg");
    expect(ROTULO_UNIDADE.ml).toBe("ml");
    expect(ROTULO_UNIDADE.m).toBe("m");
  });
});

// Plano 06-08 (D-20): item se desativa, nunca se apaga — e desativar um insumo que ainda está na
// ficha técnica de um produto ATIVO é recusado com a frase que já existe, senão uma venda baixaria
// estoque de um material que ninguém vê mais (pesquisa §Pergunta 6).
describe("podeDesativarItem", () => {
  it("recusa com o nome do produto ativo que usa o item como insumo", () => {
    const resultado = podeDesativarItem(INSUMO_ID, [{ itemNome: "Café coado", insumoId: INSUMO_ID }]);
    expect(resultado).toEqual({
      ok: false,
      erro: "Esse item é insumo de Café coado — tire da ficha técnica antes.",
    });
  });

  it("usa o PRIMEIRO produto da lista quando há mais de um", () => {
    const resultado = podeDesativarItem(INSUMO_ID, [
      { itemNome: "Café coado", insumoId: INSUMO_ID },
      { itemNome: "Café com leite", insumoId: INSUMO_ID },
    ]);
    expect(resultado).toEqual({ ok: false, erro: fraseItemEhInsumoDe("Café coado") });
  });

  it("aceita quando a lista de fichas de produtos ativos é vazia", () => {
    expect(podeDesativarItem(INSUMO_ID, [])).toEqual({ ok: true });
  });

  it("aceita quando as fichas da lista usam OUTRO insumo", () => {
    expect(
      podeDesativarItem(INSUMO_ID, [{ itemNome: "Bolo de fubá", insumoId: OUTRO_INSUMO_ID }]),
    ).toEqual({ ok: true });
  });
});

// Movidos de `lib/cadastros/acoes.ts` para o módulo puro (Pitfall 7): o "Novo material" do Estoque
// (plano 06-09) usa a MESMA validação, e um arquivo `"use server"` não pode exportar função síncrona.
describe("categoriaDeVendaValida", () => {
  it("aceita categoria de receita ativa", () => {
    expect(categoriaDeVendaValida({ grupo: "receita", ativa: true }, "x", null)).toBe(true);
  });

  it("aceita a categoria ATUAL do item mesmo desativada", () => {
    expect(categoriaDeVendaValida({ grupo: "receita", ativa: false }, "x", "x")).toBe(true);
  });

  it("recusa categoria desativada que não é a atual", () => {
    expect(categoriaDeVendaValida({ grupo: "receita", ativa: false }, "x", "y")).toBe(false);
  });

  it("recusa categoria que não é de receita, ou que não existe", () => {
    expect(categoriaDeVendaValida({ grupo: "custo", ativa: true }, "x", null)).toBe(false);
    expect(categoriaDeVendaValida(undefined, "x", null)).toBe(false);
  });
});

describe("categoriaDeCompraValida", () => {
  it("aceita a categoria ATUAL do item mesmo desativada", () => {
    expect(categoriaDeCompraValida({ grupo: "custo", ativa: false }, "x", "x")).toBe(true);
  });

  it("aceita custo e geral ativos", () => {
    expect(categoriaDeCompraValida({ grupo: "custo", ativa: true }, "x", null)).toBe(true);
    expect(categoriaDeCompraValida({ grupo: "geral", ativa: true }, "x", null)).toBe(true);
  });

  it("recusa receita, fora, desativada nova e inexistente", () => {
    expect(categoriaDeCompraValida({ grupo: "receita", ativa: true }, "x", null)).toBe(false);
    expect(categoriaDeCompraValida({ grupo: "fora", ativa: true }, "x", null)).toBe(false);
    expect(categoriaDeCompraValida({ grupo: "custo", ativa: false }, "x", null)).toBe(false);
    expect(categoriaDeCompraValida(undefined, "x", null)).toBe(false);
  });
});

// Um uuid v4 de verdade — os ids de fantasia acima ("5555…") não passam no `esquemaId` (Zod exige
// versão e variante RFC 4122).
const UUID_VALIDO = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("esquemaAtivacaoDeItem", () => {
  it("aceita { id: uuid, ativo: boolean }", () => {
    const resultado = esquemaAtivacaoDeItem.safeParse({ id: UUID_VALIDO, ativo: false });
    expect(resultado.success).toBe(true);
  });

  it("recusa id que não é uuid", () => {
    expect(esquemaAtivacaoDeItem.safeParse({ id: "nao-e-uuid", ativo: true }).success).toBe(false);
  });

  it("recusa ativo que não é booleano", () => {
    expect(esquemaAtivacaoDeItem.safeParse({ id: UUID_VALIDO, ativo: "sim" }).success).toBe(false);
  });
});

// Fase 06.4, plano 04 (D-05; assumption delta "promote"): a linha do diálogo e a frase de recusa dos
// itens do sistema são escolhidas PELA CHAVE — as da Agenda continuam literais.
describe("linhaDoItemDoSistema / fraseDoItemDoSistema", () => {
  it("chave das Queimas → as frases das Queimas", () => {
    for (const chave of ["queima_externa_p", "queima_externa_m", "queima_externa_g"]) {
      expect(linhaDoItemDoSistema(chave)).toBe(
        "Usado pelas Queimas — não se desativa nem sai da Venda. Nome, preço e categoria podem mudar.",
      );
      expect(fraseDoItemDoSistema(chave)).toBe(
        "Este item é usado pelas Queimas e não se desativa. Nome, preço e categoria podem mudar.",
      );
    }
    expect(LINHA_ITEM_DAS_QUEIMAS).toBe(linhaDoItemDoSistema("queima_externa_m"));
    expect(FRASE_ITEM_DAS_QUEIMAS).toBe(fraseDoItemDoSistema("queima_externa_m"));
  });

  it("chave da Agenda (ou nula) → exatamente as constantes da Agenda, intocadas", () => {
    for (const chave of ["uso_livre_hora", "mensalidade", "inscricao_oficina", null]) {
      expect(linhaDoItemDoSistema(chave)).toBe(LINHA_ITEM_DO_SISTEMA);
      expect(fraseDoItemDoSistema(chave)).toBe(FRASE_ITEM_DO_SISTEMA);
    }
    expect(LINHA_ITEM_DO_SISTEMA).toBe(
      "Usado pela Agenda — não se desativa nem sai da Venda. Nome, preço e categoria podem mudar.",
    );
    expect(FRASE_ITEM_DO_SISTEMA).toBe(
      "Este item é usado pela Agenda e não se desativa. Nome, preço e categoria podem mudar.",
    );
  });
});

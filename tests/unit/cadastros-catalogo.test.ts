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
  fraseInsumoSemEstoque,
  fraseItemEhInsumoDe,
  podeDeixarDeTerEstoque,
  validarItem,
  type EntradaDeItem,
  type InsumoDisponivel,
} from "../../lib/cadastros/catalogo";

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

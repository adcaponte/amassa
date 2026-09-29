import { describe, expect, it } from "vitest";

import type { ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import {
  pedidosDaCompra,
  pedidosDaVenda,
  type LinhaDeCompraGravada,
  type LinhaDeVendaGravada,
} from "@/lib/estoque/pedidos";

// Os pedidos do Financeiro (plano 06-03): a venda baixa e a compra dá entrada, UMA chamada de
// `efeitoNoEstoque` por linha do documento — a linha leva a sua área (D-27) e o seu valor (EST-15).
// Nomes e ids inventados; nenhum dado real.

const argila: ItemParaEfeito = {
  id: "argila",
  nome: "Argila",
  unidade: "kg",
  controlaEstoque: true,
  ficha: [],
};
const caneca: ItemParaEfeito = {
  id: "caneca",
  nome: "Caneca",
  unidade: null,
  controlaEstoque: false,
  ficha: [{ insumoId: "argila", quantidade: "0.08" }],
};
const prato: ItemParaEfeito = {
  id: "prato",
  nome: "Prato",
  unidade: null,
  controlaEstoque: false,
  ficha: [{ insumoId: "argila", quantidade: "0.3" }],
};
const copo: ItemParaEfeito = {
  id: "copo",
  nome: "Copo para pintar",
  unidade: "un",
  controlaEstoque: true,
  ficha: [],
};
const boleira: ItemParaEfeito = {
  id: "boleira",
  nome: "Boleira",
  unidade: "un",
  controlaEstoque: true,
  ficha: [{ insumoId: "argila", quantidade: "1.2" }],
};
const horaDeUso: ItemParaEfeito = {
  id: "hora",
  nome: "Hora de uso do espaço",
  unidade: null,
  controlaEstoque: false,
  ficha: [],
};
const gigante: ItemParaEfeito = {
  id: "gigante",
  nome: "Peça gigante",
  unidade: null,
  controlaEstoque: false,
  ficha: [{ insumoId: "argila", quantidade: "999.999" }],
};

const ITENS = [argila, caneca, prato, copo, boleira, horaDeUso, gigante];

const AREAS: ReadonlyMap<string, AreaFinanceira> = new Map<string, AreaFinanceira>([
  ["cat-pecas", "pecas"],
  ["cat-cafe", "cafeteria"],
  ["cat-espaco", "espaco"],
]);

function linhaVenda(
  documentoLinhaId: string,
  itemId: string | null,
  quantidade: number,
  categoriaId = "cat-pecas",
): LinhaDeVendaGravada {
  return { documentoLinhaId, itemId, quantidade, categoriaId };
}

describe("pedidosDaVenda", () => {
  it("2 un de um produto com ficha de 0,08 kg → uma saída de 160 milésimos do insumo, com a área e a linha", () => {
    const pedidos = pedidosDaVenda([linhaVenda("l1", "caneca", 2)], ITENS, AREAS);
    expect(pedidos).toEqual([
      {
        itemId: "argila",
        origem: "venda",
        tipo: "saida",
        movimento: { tipo: "saida", milesimos: 160 },
        area: "pecas",
        documentoLinhaId: "l1",
      },
    ]);
  });

  it("produto sem ficha com estoque próprio, 3 un → saída de 3000 milésimos do próprio produto", () => {
    const pedidos = pedidosDaVenda([linhaVenda("l1", "copo", 3)], ITENS, AREAS);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({
      itemId: "copo",
      tipo: "saida",
      movimento: { tipo: "saida", milesimos: 3000 },
    });
  });

  it("produto com ficha E estoque próprio → baixa só os insumos (a ficha vence)", () => {
    const pedidos = pedidosDaVenda([linhaVenda("l1", "boleira", 1)], ITENS, AREAS);
    expect(pedidos.map((pedido) => pedido.itemId)).toEqual(["argila"]);
    expect(pedidos[0].movimento).toEqual({ tipo: "saida", milesimos: 1200 });
  });

  it("linha livre e item sem ficha e sem estoque → nenhum pedido", () => {
    const pedidos = pedidosDaVenda(
      [linhaVenda("l1", null, 1, "cat-espaco"), linhaVenda("l2", "hora", 2, "cat-espaco")],
      ITENS,
      AREAS,
    );
    expect(pedidos).toEqual([]);
  });

  it("o mesmo insumo em duas linhas de áreas diferentes → dois pedidos, cada um com a sua área e a sua linha", () => {
    const pedidos = pedidosDaVenda(
      [linhaVenda("l1", "caneca", 2, "cat-pecas"), linhaVenda("l2", "prato", 1, "cat-cafe")],
      ITENS,
      AREAS,
    );
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0]).toMatchObject({
      itemId: "argila",
      area: "pecas",
      documentoLinhaId: "l1",
      movimento: { milesimos: 160 },
    });
    expect(pedidos[1]).toMatchObject({
      itemId: "argila",
      area: "cafeteria",
      documentoLinhaId: "l2",
      movimento: { milesimos: 300 },
    });
  });

  it("as saídas saem na ordem das linhas", () => {
    const pedidos = pedidosDaVenda(
      [linhaVenda("l1", "copo", 1), linhaVenda("l2", "caneca", 1), linhaVenda("l3", "copo", 2)],
      ITENS,
      AREAS,
    );
    expect(pedidos.map((pedido) => pedido.documentoLinhaId)).toEqual(["l1", "l2", "l3"]);
  });

  it("quantidade 99999 × ficha 999,999 → 99.998.900.001 milésimos, inteiro exato (Pitfall 11)", () => {
    const pedidos = pedidosDaVenda([linhaVenda("l1", "gigante", 99999)], ITENS, AREAS);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].movimento.milesimos).toBe(99_998_900_001);
    expect(Number.isSafeInteger(pedidos[0].movimento.milesimos)).toBe(true);
  });

  it("categoria sem área conhecida → erro alto (o check do banco recusaria a venda sem área)", () => {
    expect(() => pedidosDaVenda([linhaVenda("l1", "caneca", 1, "cat-sumiu")], ITENS, AREAS)).toThrow();
  });
});

function linhaCompra(
  documentoLinhaId: string,
  itemId: string | null,
  quantidadeEstoque: string | null,
  valorCentavos: number,
): LinhaDeCompraGravada {
  return { documentoLinhaId, itemId, quantidadeEstoque, valorCentavos };
}

describe("pedidosDaCompra", () => {
  it("25 kg por 12500 → entrada com preço de 25000 milésimos, pago e informado 12500", () => {
    const pedidos = pedidosDaCompra([linhaCompra("l1", "argila", "25", 12500)], ITENS);
    expect(pedidos).toEqual([
      {
        itemId: "argila",
        origem: "compra",
        tipo: "entrada",
        movimento: { tipo: "entrada_com_preco", milesimos: 25000, pagoCentavos: 12500 },
        valorInformadoCentavos: 12500,
        documentoLinhaId: "l1",
      },
    ]);
  });

  it("3 un por R$ 10,00 → informado 1000 e 3000 milésimos, nunca 333 por unidade", () => {
    const [pedido] = pedidosDaCompra([linhaCompra("l1", "copo", "3", 1000)], ITENS);
    expect(pedido.valorInformadoCentavos).toBe(1000);
    expect(pedido.movimento).toEqual({ tipo: "entrada_com_preco", milesimos: 3000, pagoCentavos: 1000 });
  });

  it("0,001 kg → 1 milésimo", () => {
    const [pedido] = pedidosDaCompra([linhaCompra("l1", "argila", "0.001", 5)], ITENS);
    expect(pedido.movimento.milesimos).toBe(1);
  });

  it("o mesmo material em duas linhas → duas entradas, cada uma com o seu valor", () => {
    const pedidos = pedidosDaCompra(
      [linhaCompra("l1", "argila", "10", 5000), linhaCompra("l2", "argila", "5", 3000)],
      ITENS,
    );
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0]).toMatchObject({
      documentoLinhaId: "l1",
      valorInformadoCentavos: 5000,
      movimento: { milesimos: 10000, pagoCentavos: 5000 },
    });
    expect(pedidos[1]).toMatchObject({
      documentoLinhaId: "l2",
      valorInformadoCentavos: 3000,
      movimento: { milesimos: 5000, pagoCentavos: 3000 },
    });
  });

  it("linha de valor 0 → entrada sem preço, informado 0", () => {
    const [pedido] = pedidosDaCompra([linhaCompra("l1", "argila", "2", 0)], ITENS);
    expect(pedido.movimento).toEqual({ tipo: "entrada_sem_preco", milesimos: 2000 });
    expect(pedido.valorInformadoCentavos).toBe(0);
    expect(pedido.tipo).toBe("entrada");
  });

  it("linha sem item ou sem quantidade de estoque → nenhum pedido", () => {
    const pedidos = pedidosDaCompra(
      [linhaCompra("l1", null, null, 1000), linhaCompra("l2", "argila", null, 1000)],
      ITENS,
    );
    expect(pedidos).toEqual([]);
  });
});

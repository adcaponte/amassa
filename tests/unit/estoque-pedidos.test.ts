import { describe, expect, it } from "vitest";

import type { ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import {
  pedidoDeAjuste,
  pedidoDeEntradaDaProducao,
  pedidoDeEntradaManual,
  pedidoDeSaidaManual,
  pedidosDaCompra,
  pedidosDaVenda,
  pedidosDoEstorno,
  type LinhaDeCompraGravada,
  type LinhaDeVendaGravada,
  type MovimentacaoOriginal,
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

// O estorno do cancelamento (D-04, D-23/D-24, Pitfall 4): espelha o GRAVADO, nunca recalcula.
describe("pedidosDoEstorno", () => {
  const saidaDeVenda: MovimentacaoOriginal = {
    id: "mov-1",
    itemId: "argila",
    origem: "venda",
    tipo: "saida",
    quantidadeMilesimos: -2000,
    valorCentavos: -840,
    area: "cafeteria",
    documentoId: "doc-1",
    documentoLinhaId: "linha-1",
  };
  const entradaDeCompra: MovimentacaoOriginal = {
    id: "mov-2",
    itemId: "argila",
    origem: "compra",
    tipo: "entrada",
    quantidadeMilesimos: 25000,
    valorCentavos: 12500,
    area: null,
    documentoId: "doc-2",
    documentoLinhaId: "linha-2",
  };

  it("saída de venda (−2000, −840, cafeteria) → estorno de venda de 2000 que levou 840, mesma área, documento e linha (D-23)", () => {
    expect(pedidosDoEstorno([saidaDeVenda])).toEqual([
      {
        itemId: "argila",
        origem: "venda",
        tipo: "entrada",
        movimento: { tipo: "estorno_de_venda", milesimos: 2000, valorDaVendaCentavos: 840 },
        valorInformadoCentavos: 840,
        estornoDeId: "mov-1",
        area: "cafeteria",
        documentoId: "doc-1",
        documentoLinhaId: "linha-1",
      },
    ]);
  });

  it("entrada de compra (+25000, +12500) → saída de 25000, sem área e sem valor informado (D-24)", () => {
    expect(pedidosDoEstorno([entradaDeCompra])).toEqual([
      {
        itemId: "argila",
        origem: "compra",
        tipo: "saida",
        movimento: { tipo: "saida", milesimos: 25000 },
        estornoDeId: "mov-2",
        documentoId: "doc-2",
        documentoLinhaId: "linha-2",
      },
    ]);
  });

  it("lista vazia de originais → lista vazia de pedidos (documento anterior ao Estoque, D-05)", () => {
    expect(pedidosDoEstorno([])).toEqual([]);
  });

  it("vários originais → um estorno por original, na mesma ordem", () => {
    const pedidos = pedidosDoEstorno([saidaDeVenda, entradaDeCompra]);
    expect(pedidos.map((pedido) => pedido.estornoDeId)).toEqual(["mov-1", "mov-2"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Os pedidos manuais da folha completa (06-05-PLAN.md): o ajuste, a peça pronta e os vínculos.
// ---------------------------------------------------------------------------------------------

describe("pedidoDeAjuste — EST-07", () => {
  it("diferença −300 com contado 1200 → ajuste que SAI 300, com o contado gravado", () => {
    expect(
      pedidoDeAjuste({
        itemId: "argila",
        diferencaMilesimos: -300,
        contadoMilesimos: 1200,
        nota: "Conferência da prateleira",
      }),
    ).toEqual({
      itemId: "argila",
      origem: "manual",
      tipo: "ajuste",
      movimento: { tipo: "saida", milesimos: 300 },
      saldoContadoMilesimos: 1200,
      nota: "Conferência da prateleira",
    });
  });

  it("diferença positiva → entrada SEM preço (à taxa corrente, R6)", () => {
    const pedido = pedidoDeAjuste({
      itemId: "argila",
      diferencaMilesimos: 2000,
      contadoMilesimos: 0 + 2000,
      nota: null,
    });
    expect(pedido.movimento).toEqual({ tipo: "entrada_sem_preco", milesimos: 2000 });
    expect(pedido.tipo).toBe("ajuste");
    expect(pedido.saldoContadoMilesimos).toBe(2000);
    expect(pedido).not.toHaveProperty("nota");
  });

  it("contado zero é gravado como zero, não como ausente", () => {
    const pedido = pedidoDeAjuste({
      itemId: "argila",
      diferencaMilesimos: -1500,
      contadoMilesimos: 0,
      nota: null,
    });
    expect(pedido.saldoContadoMilesimos).toBe(0);
  });

  it("ajuste nunca leva valor informado, destino, área nem encomenda", () => {
    const pedido = pedidoDeAjuste({
      itemId: "argila",
      diferencaMilesimos: 1,
      contadoMilesimos: 1,
      nota: null,
    });
    expect(pedido).not.toHaveProperty("valorInformadoCentavos");
    expect(pedido).not.toHaveProperty("destino");
    expect(pedido).not.toHaveProperty("area");
    expect(pedido).not.toHaveProperty("encomendaId");
  });

  it("diferença zero não vira pedido — quem chama já decidiu “nada” (EST-08)", () => {
    expect(() =>
      pedidoDeAjuste({ itemId: "argila", diferencaMilesimos: 0, contadoMilesimos: 1, nota: null }),
    ).toThrow(RangeError);
  });
});

describe("pedidoDeEntradaManual — a peça pronta (D-09/D-29)", () => {
  it("pecaPronta: true → motivo “peca_pronta”", () => {
    const pedido = pedidoDeEntradaManual({
      itemId: "caneca",
      milesimos: 3000,
      custoCentavos: 3702,
      pecaPronta: true,
    });
    expect(pedido.motivo).toBe("peca_pronta");
    expect(pedido.movimento).toEqual({
      tipo: "entrada_com_preco",
      milesimos: 3000,
      pagoCentavos: 3702,
    });
    expect(pedido.valorInformadoCentavos).toBe(3702);
  });

  it("sem pecaPronta → nenhum motivo (entrada manual comum)", () => {
    const pedido = pedidoDeEntradaManual({ itemId: "argila", milesimos: 5000, custoCentavos: 2100 });
    expect(pedido).not.toHaveProperty("motivo");
    expect(
      pedidoDeEntradaManual({
        itemId: "argila",
        milesimos: 5000,
        custoCentavos: 2100,
        pecaPronta: false,
      }),
    ).not.toHaveProperty("motivo");
  });
});

describe("pedidoDeEntradaDaProducao — a peça pronta vinda da conclusão (PRD-16)", () => {
  it("origem producao, entrada com preço, valor informado, a ordem e a nota — e nenhum motivo", () => {
    const pedido = pedidoDeEntradaDaProducao({
      itemId: "caneca",
      milesimos: 2000,
      custoCentavos: 7404,
      ordemId: "ordem-1",
      nota: "Canecas [e2e]",
    });
    expect(pedido).toEqual({
      itemId: "caneca",
      origem: "producao",
      tipo: "entrada",
      movimento: { tipo: "entrada_com_preco", milesimos: 2000, pagoCentavos: 7404 },
      valorInformadoCentavos: 7404,
      encomendaId: "ordem-1",
      nota: "Canecas [e2e]",
    });
    // O check `movimentacoes_estoque_motivo_so_manual` recusaria o motivo numa origem producao.
    expect(pedido).not.toHaveProperty("motivo");
    expect(pedido).not.toHaveProperty("destino");
    expect(pedido).not.toHaveProperty("area");
    expect(pedido).not.toHaveProperty("documentoId");
  });
});

describe("pedidoDeSaidaManual — os vínculos (EST-11)", () => {
  it("encomenda com id e o rótulo congelado na nota", () => {
    expect(
      pedidoDeSaidaManual({
        itemId: "argila",
        milesimos: 500,
        destino: "encomenda",
        encomendaId: "enc-1",
        nota: "Jogo de pratos",
      }),
    ).toEqual({
      itemId: "argila",
      origem: "manual",
      tipo: "saida",
      movimento: { tipo: "saida", milesimos: 500 },
      destino: "encomenda",
      area: "pecas",
      encomendaId: "enc-1",
      nota: "Jogo de pratos",
    });
  });

  it("vínculos nulos não entram no pedido (a coluna fica nula)", () => {
    const pedido = pedidoDeSaidaManual({
      itemId: "argila",
      milesimos: 500,
      destino: "aula",
      encomendaId: null,
      nota: null,
    });
    expect(pedido).not.toHaveProperty("nota");
    expect(pedido).not.toHaveProperty("encomendaId");
    expect(pedido.area).toBe("espaco");
  });

  it("a baixa da ordem (Produção, PRD-14): destino encomenda, a ordem e o material da ordem vão juntos", () => {
    expect(
      pedidoDeSaidaManual({
        itemId: "argila",
        milesimos: 2200,
        destino: "encomenda",
        encomendaId: "ordem-1",
        nota: "[e2e] Jogo de canecas",
        materialDaOrdem: "argila",
      }),
    ).toEqual({
      itemId: "argila",
      origem: "manual",
      tipo: "saida",
      movimento: { tipo: "saida", milesimos: 2200 },
      destino: "encomenda",
      area: "pecas",
      encomendaId: "ordem-1",
      nota: "[e2e] Jogo de canecas",
      materialDaOrdem: "argila",
    });
  });

  it("“outro material” pela ordem: sem materialDaOrdem, a coluna fica nula", () => {
    const pedido = pedidoDeSaidaManual({
      itemId: "argila",
      milesimos: 100,
      destino: "encomenda",
      encomendaId: "ordem-1",
      nota: "Ordem",
      materialDaOrdem: null,
    });
    expect(pedido).not.toHaveProperty("materialDaOrdem");
    expect(pedido.encomendaId).toBe("ordem-1");
  });

  it("materialDaOrdem sem a ordem, ou fora do destino encomenda, não vai (o check `material_da_ordem_so_na_baixa` recusaria)", () => {
    const semOrdem = pedidoDeSaidaManual({
      itemId: "argila",
      milesimos: 100,
      destino: "encomenda",
      encomendaId: null,
      materialDaOrdem: "esmalte",
    });
    expect(semOrdem).not.toHaveProperty("materialDaOrdem");
    expect(semOrdem).not.toHaveProperty("encomendaId");

    const outroDestino = pedidoDeSaidaManual({
      itemId: "argila",
      milesimos: 100,
      destino: "aula",
      encomendaId: "ordem-1",
      materialDaOrdem: "argila",
    });
    expect(outroDestino).not.toHaveProperty("materialDaOrdem");
    expect(outroDestino).not.toHaveProperty("encomendaId");
  });

  it("encomenda fora do destino encomenda é descartada (o check do banco recusaria)", () => {
    const pedido = pedidoDeSaidaManual({
      itemId: "argila",
      milesimos: 500,
      destino: "perda",
      encomendaId: "enc-1",
      nota: "Caiu da prateleira",
    });
    expect(pedido).not.toHaveProperty("encomendaId");
    expect(pedido.nota).toBe("Caiu da prateleira");
  });
});

import { describe, expect, it } from "vitest";

import {
  efeitoNoEstoque,
  formatarEfeito,
  type ItemParaEfeito,
  type LinhaParaEfeito,
} from "@/lib/financeiro/efeito-estoque";

const grao: ItemParaEfeito = {
  id: "grao",
  nome: "Grão de café",
  unidade: "g",
  controlaEstoque: true,
  ficha: [],
};
const paoCongelado: ItemParaEfeito = {
  id: "pao-congelado",
  nome: "Pão de queijo congelado",
  unidade: "kg",
  controlaEstoque: true,
  ficha: [],
};
const cafe: ItemParaEfeito = {
  id: "cafe",
  nome: "Café 200 ml",
  unidade: null,
  controlaEstoque: false,
  ficha: [{ insumoId: "grao", quantidade: "15" }],
};
const refil: ItemParaEfeito = {
  id: "refil",
  nome: "Café refil",
  unidade: null,
  controlaEstoque: false,
  ficha: [{ insumoId: "grao", quantidade: "30" }],
};
const paoDeQueijo: ItemParaEfeito = {
  id: "pao",
  nome: "Pão de queijo",
  unidade: null,
  controlaEstoque: false,
  ficha: [{ insumoId: "pao-congelado", quantidade: "0.04" }],
};
const copo: ItemParaEfeito = {
  id: "copo",
  nome: "Copo 10 cm para pintar",
  unidade: "un",
  controlaEstoque: true,
  ficha: [],
};
const horaDeUso: ItemParaEfeito = {
  id: "hora",
  nome: "Hora de uso do espaço",
  unidade: null,
  controlaEstoque: false,
  ficha: [],
};
// Item com FICHA e controla_estoque ao mesmo tempo — vale a ficha, o próprio não baixa.
const boleiraComFichaEEstoque: ItemParaEfeito = {
  id: "boleira",
  nome: "Boleira",
  unidade: "un",
  controlaEstoque: true,
  ficha: [{ insumoId: "grao", quantidade: "5" }],
};
const esmalte: ItemParaEfeito = {
  id: "esmalte",
  nome: "Esmalte (pote)",
  unidade: "un",
  controlaEstoque: true,
  ficha: [],
};
const leite: ItemParaEfeito = {
  id: "leite",
  nome: "Leite",
  unidade: "l",
  controlaEstoque: true,
  ficha: [],
};

function linhaDeItem(itemId: string, quantidade: number): LinhaParaEfeito {
  return { itemId, quantidade };
}

describe("efeitoNoEstoque — venda", () => {
  it("Café (ficha 15 g de grão) × 1 → grão −15 g", () => {
    const efeito = efeitoNoEstoque([linhaDeItem("cafe", 1)], [grao, cafe], "venda");
    expect(efeito).toEqual([
      { itemId: "grao", nome: "Grão de café", unidade: "g", variacaoMilesimos: -15000 },
    ]);
  });

  it("Café × 2 → grão −30 g", () => {
    const efeito = efeitoNoEstoque([linhaDeItem("cafe", 2)], [grao, cafe], "venda");
    expect(efeito[0].variacaoMilesimos).toBe(-30000);
  });

  it("Pão de queijo (ficha 0,04 kg de pão congelado) × 40 → −1,6 kg exato", () => {
    const efeito = efeitoNoEstoque(
      [linhaDeItem("pao", 40)],
      [paoCongelado, paoDeQueijo],
      "venda",
    );
    expect(efeito).toEqual([
      {
        itemId: "pao-congelado",
        nome: "Pão de queijo congelado",
        unidade: "kg",
        variacaoMilesimos: -1600,
      },
    ]);
  });

  it("Pão de queijo × 4 → −0,16 kg exato", () => {
    const efeito = efeitoNoEstoque([linhaDeItem("pao", 4)], [paoCongelado, paoDeQueijo], "venda");
    expect(efeito[0].variacaoMilesimos).toBe(-160);
  });

  it("Refil (30 g) + Café (15 g) na mesma venda → uma entrada só de grão, −45 g", () => {
    const efeito = efeitoNoEstoque(
      [linhaDeItem("refil", 1), linhaDeItem("cafe", 1)],
      [grao, cafe, refil],
      "venda",
    );
    expect(efeito).toHaveLength(1);
    expect(efeito[0]).toEqual({
      itemId: "grao",
      nome: "Grão de café",
      unidade: "g",
      variacaoMilesimos: -45000,
    });
  });

  it("Copo (controla estoque, sem ficha) × 1 → −1 un do próprio copo", () => {
    const efeito = efeitoNoEstoque([linhaDeItem("copo", 1)], [copo], "venda");
    expect(efeito).toEqual([
      { itemId: "copo", nome: "Copo 10 cm para pintar", unidade: "un", variacaoMilesimos: -1000 },
    ]);
  });

  it("Item com ficha E controla estoque → vale a ficha (o próprio não baixa)", () => {
    const efeito = efeitoNoEstoque(
      [linhaDeItem("boleira", 1)],
      [grao, boleiraComFichaEEstoque],
      "venda",
    );
    expect(efeito).toEqual([
      { itemId: "grao", nome: "Grão de café", unidade: "g", variacaoMilesimos: -5000 },
    ]);
  });

  it("Hora de uso do espaço (nem ficha nem estoque) → nenhuma entrada", () => {
    const efeito = efeitoNoEstoque([linhaDeItem("hora", 3)], [horaDeUso], "venda");
    expect(efeito).toEqual([]);
  });

  it("Ficha de um nível só: insumo que tem ficha própria não é expandido", () => {
    // O grão, aqui, ganha uma ficha própria (hipotética) — o cálculo nunca a segue.
    const graoComFichaPropria: ItemParaEfeito = { ...grao, ficha: [{ insumoId: "x", quantidade: "1" }] };
    const efeito = efeitoNoEstoque(
      [linhaDeItem("cafe", 1)],
      [graoComFichaPropria, cafe],
      "venda",
    );
    expect(efeito).toEqual([
      { itemId: "grao", nome: "Grão de café", unidade: "g", variacaoMilesimos: -15000 },
    ]);
  });

  it("Linha sem item (valor livre) → nenhuma entrada", () => {
    const efeito = efeitoNoEstoque([{ itemId: null, quantidade: 1 }], [grao, cafe], "venda");
    expect(efeito).toEqual([]);
  });

  it("Ordem das entradas = ordem de primeira aparição", () => {
    const efeito = efeitoNoEstoque(
      [linhaDeItem("copo", 1), linhaDeItem("cafe", 1), linhaDeItem("refil", 1)],
      [grao, cafe, refil, copo],
      "venda",
    );
    expect(efeito.map((entrada) => entrada.itemId)).toEqual(["copo", "grao"]);
  });
});

describe("efeitoNoEstoque — compra", () => {
  it('Esmalte (pote), 1 linha com quantidade de estoque "100", valor 240000 → +100 un, custo unitário 2400', () => {
    const efeito = efeitoNoEstoque(
      [{ itemId: "esmalte", quantidade: 1, quantidadeEstoque: "100", valorCentavos: 240000 }],
      [esmalte],
      "compra",
    );
    expect(efeito).toEqual([
      {
        itemId: "esmalte",
        nome: "Esmalte (pote)",
        unidade: "un",
        variacaoMilesimos: 100000,
        custoUnitarioCentavos: 2400,
      },
    ]);
  });

  it('pão congelado "5" kg por 16000 → +5 kg, custo 3200', () => {
    const efeito = efeitoNoEstoque(
      [{ itemId: "pao-congelado", quantidade: 1, quantidadeEstoque: "5", valorCentavos: 16000 }],
      [paoCongelado],
      "compra",
    );
    expect(efeito).toEqual([
      {
        itemId: "pao-congelado",
        nome: "Pão de queijo congelado",
        unidade: "kg",
        variacaoMilesimos: 5000,
        custoUnitarioCentavos: 3200,
      },
    ]);
  });

  it("linha sem item (valor livre) → nenhuma entrada", () => {
    const efeito = efeitoNoEstoque(
      [{ itemId: null, quantidade: 1, quantidadeEstoque: "5", valorCentavos: 1000 }],
      [esmalte],
      "compra",
    );
    expect(efeito).toEqual([]);
  });

  it('unidade "l" na compra também vira milésimos inteiros (0,5 L)', () => {
    const efeito = efeitoNoEstoque(
      [{ itemId: "leite", quantidade: 1, quantidadeEstoque: "0.5", valorCentavos: 250 }],
      [leite],
      "compra",
    );
    expect(efeito).toEqual([
      { itemId: "leite", nome: "Leite", unidade: "l", variacaoMilesimos: 500, custoUnitarioCentavos: 500 },
    ]);
  });
});

describe("formatarEfeito", () => {
  it('venda → "−15 g · Grão de café"', () => {
    expect(
      formatarEfeito({ itemId: "grao", nome: "Grão de café", unidade: "g", variacaoMilesimos: -15000 }),
    ).toBe("−15 g · Grão de café");
  });

  it('compra → "+100 un · Esmalte (pote)"', () => {
    expect(
      formatarEfeito({
        itemId: "esmalte",
        nome: "Esmalte (pote)",
        unidade: "un",
        variacaoMilesimos: 100000,
        custoUnitarioCentavos: 2400,
      }),
    ).toBe("+100 un · Esmalte (pote)");
  });

  it('venda fracionária → "−1,6 kg · Pão de queijo congelado"', () => {
    expect(
      formatarEfeito({
        itemId: "pao-congelado",
        nome: "Pão de queijo congelado",
        unidade: "kg",
        variacaoMilesimos: -1600,
      }),
    ).toBe("−1,6 kg · Pão de queijo congelado");
  });

  it('unidade "l" aparece como "L" maiúsculo → "−0,5 L · Leite"', () => {
    expect(
      formatarEfeito({ itemId: "leite", nome: "Leite", unidade: "l", variacaoMilesimos: -500 }),
    ).toBe("−0,5 L · Leite");
  });
});

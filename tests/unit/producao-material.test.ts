import { describe, expect, it } from "vitest";

import {
  baixaTotalSugerida,
  baixadoEmMg,
  baixadoMudou,
  materialPrevisto,
  mgEmMilesimos,
  miligramasPorMilesimo,
  situacaoDoMaterial,
  type BaixaParaSomar,
  type PecaParaPrevisto,
} from "@/lib/producao/material";
import { esquemaDarBaixaNaOrdem } from "@/lib/producao/esquemas";
import { fraseBaixaMudouEnquantoPreenchia } from "@/lib/producao/textos";

// O material da ordem (Fase 06.1, plano 10, PRD-14): o previsto sai da ficha de cada peça (gramas ×
// peças feitas, com as a mais), o baixado sai do livro do Estoque convertido pela unidade do ITEM
// (Pitfall 10), e a baixa total é o que falta, na unidade do item. Tudo em inteiros de miligramas.

const FICHA = { argilaMiligramas: 350_000, esmalteMiligramas: 40_000 };

function peca(
  quantidade: number,
  aMais = 0,
  ficha: PecaParaPrevisto["ficha"] = FICHA,
): PecaParaPrevisto {
  return { quantidade, aMais, ficha };
}

describe("materialPrevisto", () => {
  it("10 pedidas + 2 a mais, caminho completo → argila 4 200 000 mg e esmalte 480 000 mg", () => {
    expect(materialPrevisto([peca(10, 2)], "completo")).toEqual({
      argilaMg: 4_200_000,
      esmalteMg: 480_000,
      pecasSemFicha: 0,
    });
  });

  it("caminho “termina no biscoito” → esmalte 0 mesmo com gramas na ficha (Pitfall 9)", () => {
    expect(materialPrevisto([peca(10, 2)], "biscoito")).toEqual({
      argilaMg: 4_200_000,
      esmalteMg: 0,
      pecasSemFicha: 0,
    });
  });

  it("peça sem ficha fica fora da soma e é contada (D-04)", () => {
    expect(materialPrevisto([peca(1, 0, null)], "completo")).toEqual({
      argilaMg: 0,
      esmalteMg: 0,
      pecasSemFicha: 1,
    });
  });

  it("as peças sem ficha contam as FEITAS (pedido + a mais), somadas entre linhas", () => {
    const previsto = materialPrevisto(
      [peca(10, 2), peca(3, 1, null), peca(2, 0, null)],
      "completo",
    );
    expect(previsto.pecasSemFicha).toBe(6);
    expect(previsto.argilaMg).toBe(4_200_000);
  });

  it("várias peças com fichas diferentes somam", () => {
    const previsto = materialPrevisto(
      [peca(10, 2), peca(4, 0, { argilaMiligramas: 1_000_000, esmalteMiligramas: 0 })],
      "completo",
    );
    expect(previsto).toEqual({ argilaMg: 8_200_000, esmalteMg: 480_000, pecasSemFicha: 0 });
  });

  it("ordem sem peças → tudo zero", () => {
    expect(materialPrevisto([], "completo")).toEqual({ argilaMg: 0, esmalteMg: 0, pecasSemFicha: 0 });
  });

  it("no teto (100 000 + 100 000 peças × 10 000 000 mg) continua inteiro exato", () => {
    const previsto = materialPrevisto(
      [peca(100_000, 100_000, { argilaMiligramas: 10_000_000, esmalteMiligramas: 10_000_000 })],
      "completo",
    );
    expect(previsto.argilaMg).toBe(2_000_000_000_000);
    expect(Number.isSafeInteger(previsto.argilaMg)).toBe(true);
  });
});

function baixa(
  quantidadeMilesimos: number,
  unidade: BaixaParaSomar["unidade"],
  material: BaixaParaSomar["material"] = "argila",
): BaixaParaSomar {
  return { quantidadeMilesimos, unidade, material };
}

describe("miligramasPorMilesimo", () => {
  it("kg → 1000 (um milésimo de kg é um grama); g → 1; o resto não compara", () => {
    expect(miligramasPorMilesimo("kg")).toBe(1000);
    expect(miligramasPorMilesimo("g")).toBe(1);
    expect(miligramasPorMilesimo("un")).toBeNull();
    expect(miligramasPorMilesimo("ml")).toBeNull();
    expect(miligramasPorMilesimo("l")).toBeNull();
    expect(miligramasPorMilesimo("m")).toBeNull();
  });
});

describe("baixadoEmMg", () => {
  it("saída de −2 000 milésimos de um item em kg → 2 000 000 mg", () => {
    expect(baixadoEmMg([baixa(-2_000, "kg")], "argila")).toEqual({ mg: 2_000_000, foraDaConta: 0 });
  });

  it("saída de −500 000 milésimos de um item em g → 500 000 mg", () => {
    expect(baixadoEmMg([baixa(-500_000, "g")], "argila")).toEqual({ mg: 500_000, foraDaConta: 0 });
  });

  it("item em un ou l → fora da soma, contado em foraDaConta", () => {
    expect(
      baixadoEmMg([baixa(-2_000, "kg"), baixa(-3_000, "un"), baixa(-1_500, "l")], "argila"),
    ).toEqual({ mg: 2_000_000, foraDaConta: 2 });
  });

  it("só as baixas do material pedido entram; as de “outro material” (sem material) ficam de fora", () => {
    const baixas = [
      baixa(-2_000, "kg", "argila"),
      baixa(-400, "kg", "esmalte"),
      baixa(-9_000, "kg", null),
      baixa(-1_000, "un", "esmalte"),
    ];
    expect(baixadoEmMg(baixas, "argila")).toEqual({ mg: 2_000_000, foraDaConta: 0 });
    expect(baixadoEmMg(baixas, "esmalte")).toEqual({ mg: 400_000, foraDaConta: 1 });
  });

  it("nenhuma baixa → zero", () => {
    expect(baixadoEmMg([], "esmalte")).toEqual({ mg: 0, foraDaConta: 0 });
  });
});

describe("situacaoDoMaterial", () => {
  it("baixado = previsto → completo", () => {
    expect(situacaoDoMaterial(4_200_000, 4_200_000)).toEqual({ tipo: "completo" });
  });

  it("baixado > previsto → passou, com a diferença", () => {
    expect(situacaoDoMaterial(4_200_000, 5_000_000)).toEqual({ tipo: "passou", diferencaMg: 800_000 });
  });

  it("baixado < previsto → faltam, com a diferença", () => {
    expect(situacaoDoMaterial(4_200_000, 2_000_000)).toEqual({
      tipo: "faltam",
      diferencaMg: 2_200_000,
    });
  });

  it("nada baixado → faltam o previsto inteiro", () => {
    expect(situacaoDoMaterial(480_000, 0)).toEqual({ tipo: "faltam", diferencaMg: 480_000 });
  });
});

describe("mgEmMilesimos", () => {
  it("4 200 000 mg → 4 200 milésimos de kg (4,2 kg); em g, os mesmos 4 200 000; em un, null", () => {
    expect(mgEmMilesimos(4_200_000, "kg")).toBe(4_200);
    expect(mgEmMilesimos(4_200_000, "g")).toBe(4_200_000);
    expect(mgEmMilesimos(4_200_000, "un")).toBeNull();
  });
});

describe("baixaTotalSugerida", () => {
  it("previsto 4 200 000 mg, baixado 2 000 000 mg, item em kg → 2 200 milésimos (2,2 kg)", () => {
    expect(baixaTotalSugerida(4_200_000, 2_000_000, "kg")).toBe(2_200);
  });

  it("o mesmo em g → 2 200 000 milésimos", () => {
    expect(baixaTotalSugerida(4_200_000, 2_000_000, "g")).toBe(2_200_000);
  });

  it("baixado ≥ previsto → 0", () => {
    expect(baixaTotalSugerida(4_200_000, 4_200_000, "kg")).toBe(0);
    expect(baixaTotalSugerida(4_200_000, 9_000_000, "g")).toBe(0);
  });

  it("unidade não comparável → null", () => {
    expect(baixaTotalSugerida(4_200_000, 0, "un")).toBeNull();
    expect(baixaTotalSugerida(4_200_000, 0, "l")).toBeNull();
  });

  it("em kg, arredonda em milésimos, meio para cima (1 500 mg → 2 milésimos; 1 499 mg → 1)", () => {
    expect(baixaTotalSugerida(1_500, 0, "kg")).toBe(2);
    expect(baixaTotalSugerida(1_499, 0, "kg")).toBe(1);
    expect(baixaTotalSugerida(400, 0, "kg")).toBe(0);
  });
});

// Revisão 06.1, WR-101: a "Baixa total" manda o que a tela acreditava já baixado; o servidor refaz a
// soma sob a trava da ordem e recusa quando outra baixa entrou no meio (dois celulares).
describe("baixadoMudou — a Baixa total contra o livro", () => {
  const argila2kg: BaixaParaSomar = { quantidadeMilesimos: -2000, unidade: "kg", material: "argila" };
  const esmalte100g: BaixaParaSomar = {
    quantidadeMilesimos: -100_000,
    unidade: "g",
    material: "esmalte",
  };

  it("nulo (baixa parcial ou outro material) nunca recusa", () => {
    expect(baixadoMudou(null, [argila2kg], "argila")).toBe(false);
  });

  it("o livro bate com a tela → segue", () => {
    expect(baixadoMudou(0, [], "argila")).toBe(false);
    expect(baixadoMudou(2_000_000, [argila2kg, esmalte100g], "argila")).toBe(false);
  });

  it("outro celular deu baixa de 10 kg no meio → recusa (a tela viu 0)", () => {
    const outra: BaixaParaSomar = { quantidadeMilesimos: -10_000, unidade: "kg", material: "argila" };
    expect(baixadoMudou(0, [outra], "argila")).toBe(true);
  });

  it("baixa de OUTRO material no meio não conta", () => {
    expect(baixadoMudou(0, [esmalte100g], "argila")).toBe(false);
  });

  it("o esquema leva o esperado só quando há material", () => {
    const base = {
      ordemId: "0b7e8a4c-1f2d-4c3b-9a8e-7d6c5b4a3f21",
      itemId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a49382716",
      quantidadeTexto: "2",
    };
    const total = esquemaDarBaixaNaOrdem.safeParse({ ...base, material: "argila", baixadoEsperadoMg: 1500 });
    expect(total.success && total.data.baixadoEsperadoMg).toBe(1500);
    const parcial = esquemaDarBaixaNaOrdem.safeParse({ ...base, material: "argila" });
    expect(parcial.success && parcial.data.baixadoEsperadoMg).toBe(null);
    const outro = esquemaDarBaixaNaOrdem.safeParse({ ...base, material: null, baixadoEsperadoMg: 1500 });
    expect(outro.success && outro.data.baixadoEsperadoMg).toBe(null);
    expect(
      esquemaDarBaixaNaOrdem.safeParse({ ...base, material: "argila", baixadoEsperadoMg: -1 }).success,
    ).toBe(false);
  });

  it("a frase diz o material e o que fazer", () => {
    expect(fraseBaixaMudouEnquantoPreenchia("argila")).toBe(
      "Outra baixa de argila foi registrada enquanto você preenchia — nada foi gravado. A tela foi atualizada: confira o que falta e dê baixa de novo, se precisar.",
    );
  });
});

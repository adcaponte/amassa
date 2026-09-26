import { describe, expect, it } from "vitest";

import {
  CATALOGO_DE_PARAMETROS,
  inteiroDaUnidade,
  valorNaUnidade,
  vigenteEm,
  type LinhaDeParametro,
} from "@/lib/precificacao/parametros";

// 04.5-01-PLAN.md, Tarefa 2 — o catálogo fechado de parâmetros, a conversão de unidade exibida
// ↔ inteiro guardado, e a leitura do "vigente na data".

describe("CATALOGO_DE_PARAMETROS", () => {
  it("tem exatamente 18 entradas", () => {
    expect(CATALOGO_DE_PARAMETROS).toHaveLength(18);
  });

  it("a taxa do cartão NÃO é uma chave de parâmetro (D-16)", () => {
    const chaves = CATALOGO_DE_PARAMETROS.map((item) => item.chave);
    expect(chaves.some((chave) => chave.includes("taxa"))).toBe(false);
  });

  it("cada entrada declara grupo, rótulo, unidade e escala", () => {
    for (const item of CATALOGO_DE_PARAMETROS) {
      expect(["Material", "Trabalho", "Forno", "Perda", "No preço"]).toContain(item.grupo);
      expect(item.rotulo.length).toBeGreaterThan(0);
      expect(item.unidade.length).toBeGreaterThan(0);
      expect(item.escala).toBeGreaterThan(0);
    }
  });

  it("nenhuma chave se repete", () => {
    const chaves = CATALOGO_DE_PARAMETROS.map((item) => item.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("inteiroDaUnidade / valorNaUnidade — inversas", () => {
  it.each([
    ["material_argila", 10, 1000], // R$ 10,00/kg ↔ 1000 centavos
    ["preco_lucro", 3.5, 350], // 3,5% ↔ 350 pontos-base
    ["forno_largura_util", 35, 35000], // 35 cm ↔ 35000 milésimos
    ["forno_fator_biscoito", 1.8, 1800], // 1,8× ↔ 1800 milésimos
    ["forno_kwh_biscoito", 18, 18000], // 18 kWh ↔ 18000 milésimos
  ] as const)("%s: %s na unidade ↔ %s inteiro", (chave, naUnidade, inteiro) => {
    expect(inteiroDaUnidade(chave, naUnidade)).toBe(inteiro);
    expect(valorNaUnidade(chave, inteiro)).toBeCloseTo(naUnidade, 6);
  });

  it("lança para uma chave desconhecida", () => {
    // @ts-expect-error — chave fora da união fechada, de propósito.
    expect(() => inteiroDaUnidade("chave_inventada", 10)).toThrow();
  });
});

describe("vigenteEm", () => {
  const historico: LinhaDeParametro[] = [
    { valorInteiro: 900, medido: false, vigenteDesde: "2026-01-01" },
    { valorInteiro: 1000, medido: false, vigenteDesde: "2026-06-01" },
    { valorInteiro: 1100, medido: true, vigenteDesde: "2027-01-01" }, // linha futura
  ];

  it("devolve a linha de maior vigenteDesde menor ou igual à data pedida", () => {
    expect(vigenteEm(historico, "2026-09-26")).toEqual({
      valorInteiro: 1000,
      medido: false,
      vigenteDesde: "2026-06-01",
    });
  });

  it("na data exata de uma vigência, escolhe aquela linha", () => {
    expect(vigenteEm(historico, "2026-06-01")?.valorInteiro).toBe(1000);
  });

  it("nunca escolhe uma linha futura", () => {
    expect(vigenteEm(historico, "2026-03-01")?.valorInteiro).toBe(900);
  });

  it("sem nenhuma linha vigente ainda (data antes de tudo), devolve null", () => {
    expect(vigenteEm(historico, "2025-12-31")).toBeNull();
  });

  it("histórico vazio devolve null", () => {
    expect(vigenteEm([], "2026-09-26")).toBeNull();
  });
});

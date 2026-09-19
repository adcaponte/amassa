import { describe, expect, it } from "vitest";

import { nomeDaLinha, totalDasLinhas, tituloDoDocumento } from "@/lib/financeiro/documento";

describe("nomeDaLinha", () => {
  it("quantidade 1 (padrão) devolve só o nome", () => {
    expect(nomeDaLinha({ nome: "Café 200 ml" })).toBe("Café 200 ml");
  });

  it("quantidade 3 vira '3× Café'", () => {
    expect(nomeDaLinha({ nome: "Café", quantidade: 3 })).toBe("3× Café");
  });

  it("linha de compra (quantidadeEstoque + unidade) vira 'Esmalte (pote) × 100 un'", () => {
    expect(
      nomeDaLinha({ nome: "Esmalte (pote)", quantidadeEstoque: "100", unidade: "un" }),
    ).toBe("Esmalte (pote) × 100 un");
  });

  it("a unidade 'l' aparece como 'L' maiúsculo só na exibição", () => {
    expect(
      nomeDaLinha({ nome: "Leite", quantidadeEstoque: "5", unidade: "l" }),
    ).toBe("Leite × 5 L");
  });
});

describe("totalDasLinhas", () => {
  it("soma os valores inteiros das linhas", () => {
    expect(
      totalDasLinhas([{ valorCentavos: 10000 }, { valorCentavos: 5000 }, { valorCentavos: 2500 }]),
    ).toBe(17500);
  });

  it("aceita linha negativa de diferença na soma", () => {
    expect(totalDasLinhas([{ valorCentavos: 10000 }, { valorCentavos: -500 }])).toBe(9500);
  });

  it("lista vazia soma zero", () => {
    expect(totalDasLinhas([])).toBe(0);
  });
});

describe("tituloDoDocumento", () => {
  it("título explícito sempre vence, mesmo com linhas", () => {
    expect(
      tituloDoDocumento({
        titulo: "Fechamento do dia · cafeteria",
        linhas: [{ nome: "Café" }, { nome: "Pão de queijo" }],
      }),
    ).toBe("Fechamento do dia · cafeteria");
  });

  it("sem título, uma linha só vira o nome dela", () => {
    expect(tituloDoDocumento({ linhas: [{ nome: "Café 200 ml" }] })).toBe("Café 200 ml");
  });

  it("sem título, duas linhas viram 'A + B'", () => {
    expect(
      tituloDoDocumento({ linhas: [{ nome: "Café" }, { nome: "Pão de queijo" }] }),
    ).toBe("Café + Pão de queijo");
  });

  it("sem título, quatro linhas viram 'A + B +2'", () => {
    expect(
      tituloDoDocumento({
        linhas: [{ nome: "Café" }, { nome: "Pão de queijo" }, { nome: "Bolo" }, { nome: "Refil" }],
      }),
    ).toBe("Café + Pão de queijo +2");
  });
});

import { describe, expect, it } from "vitest";

import { avisoDoCartao, liquidoDaParcela, taxaEmCentavos } from "@/lib/financeiro/taxa";

// 04.4-06-PLAN.md, Tarefa 1 — a taxa do cartão (congelada na parcela, nunca reescreve o passado)
// e o aviso que a tela mostra ANTES de lançar (estimativa com a taxa de hoje).

describe("taxaEmCentavos", () => {
  it("arredonda meio-para-cima", () => {
    expect(taxaEmCentavos(15000, 350)).toBe(525);
    expect(taxaEmCentavos(9900, 350)).toBe(347);
  });

  it("taxa zero não desconta nada", () => {
    expect(taxaEmCentavos(15000, 0)).toBe(0);
  });
});

describe("liquidoDaParcela", () => {
  it("despesa paga no cartão entra inteira — a taxa só existe quando o dinheiro ENTRA", () => {
    expect(liquidoDaParcela({ tipo: "despesa", valorCentavos: 15000, taxaPontosBase: 350 })).toBe(15000);
  });

  it("venda paga no cartão desconta a taxa", () => {
    expect(liquidoDaParcela({ tipo: "venda", valorCentavos: 15000, taxaPontosBase: 350 })).toBe(14475);
  });
});

describe("avisoDoCartao", () => {
  it("soma a taxa só das parcelas no cartão; 'entram' desconta só essas", () => {
    const aviso = avisoDoCartao({
      tipo: "venda",
      parcelas: [
        { valorCentavos: 10000, forma: "cartao" },
        { valorCentavos: 5000, forma: "dinheiro" },
      ],
      taxaPontosBase: 350,
    });
    expect(aviso).toEqual({ taxaCentavos: 350, entramCentavos: 14650 });
  });

  it("nulo quando nenhuma parcela é no cartão", () => {
    expect(
      avisoDoCartao({ tipo: "venda", parcelas: [{ valorCentavos: 5000, forma: "dinheiro" }], taxaPontosBase: 350 }),
    ).toBeNull();
  });

  it("nulo quando o documento é despesa, mesmo com parcela no cartão", () => {
    expect(
      avisoDoCartao({ tipo: "despesa", parcelas: [{ valorCentavos: 5000, forma: "cartao" }], taxaPontosBase: 350 }),
    ).toBeNull();
  });
});

// BL-01 (quick 261007-shs): na correção, a parcela já recebida leva ao aviso a taxa CONGELADA dela; as
// outras, a de hoje. `null` conta zero; sem o campo, tudo como antes.
describe("avisoDoCartao — taxa por parcela (BL-01)", () => {
  it("a parcela com taxa própria usa a dela; a sem o campo usa a global", () => {
    const aviso = avisoDoCartao({
      tipo: "venda",
      parcelas: [
        { valorCentavos: 10000, forma: "cartao", taxaPontosBase: 499 },
        { valorCentavos: 10000, forma: "cartao" },
      ],
      taxaPontosBase: 349,
    });
    expect(aviso).toEqual({ taxaCentavos: 499 + 349, entramCentavos: 20000 - 499 - 349 });
  });

  it("taxa própria nula conta zero", () => {
    const aviso = avisoDoCartao({
      tipo: "venda",
      parcelas: [{ valorCentavos: 10000, forma: "cartao", taxaPontosBase: null }],
      taxaPontosBase: 349,
    });
    expect(aviso).toEqual({ taxaCentavos: 0, entramCentavos: 10000 });
  });

  it("sem o campo, o resultado é o de antes", () => {
    expect(
      avisoDoCartao({ tipo: "venda", parcelas: [{ valorCentavos: 10000, forma: "cartao" }], taxaPontosBase: 350 }),
    ).toEqual({ taxaCentavos: 350, entramCentavos: 9650 });
  });
});

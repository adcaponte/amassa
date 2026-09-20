import { describe, expect, it } from "vitest";

import { formatarReais } from "@/lib/financeiro/formato";
import { conferirParcelas, dividirEmDuasFormas, gerarPlano } from "@/lib/financeiro/parcelas";

// 04.4-06-PLAN.md, Tarefa 1 — o plano de parcelas, a divisão em duas formas (D-07/D-08) e a
// conferência da soma (servidor E cliente chamam a mesma função), sem servidor nenhum.

describe("gerarPlano — à vista", () => {
  it("uma parcela só, já paga, na data do documento — sem passar pagaAVista, o padrão não mudou", () => {
    const resultado = gerarPlano({ plano: "avista", totalCentavos: 15000, data: "2026-12-18", forma: "pix" });
    expect(resultado).toEqual({
      ok: true,
      parcelas: [{ numero: 1, de: 1, vencimento: "2026-12-18", valorCentavos: 15000, forma: "pix", paga: true }],
    });
  });

  it("com pagaAVista em falso, devolve uma parcela NÃO paga, com vencimento na data do documento", () => {
    const resultado = gerarPlano({
      plano: "avista",
      totalCentavos: 15000,
      data: "2026-12-18",
      forma: "pix",
      pagaAVista: false,
    });
    expect(resultado).toEqual({
      ok: true,
      parcelas: [{ numero: 1, de: 1, vencimento: "2026-12-18", valorCentavos: 15000, forma: "pix", paga: false }],
    });
  });
});

describe("gerarPlano — sinal de 50% + saldo", () => {
  it("a primeira metade arredondada para cima, a segunda em aberto 30 dias depois", () => {
    const resultado = gerarPlano({ plano: "sinal", totalCentavos: 15001, data: "2026-12-18", forma: "pix" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas).toEqual([
      { numero: 1, de: 2, vencimento: "2026-12-18", valorCentavos: 7501, forma: "pix", paga: true },
      { numero: 2, de: 2, vencimento: "2027-01-17", valorCentavos: 7500, forma: "pix", paga: false },
    ]);
  });

  it("total exatamente par divide igual", () => {
    const resultado = gerarPlano({ plano: "sinal", totalCentavos: 15000, data: "2026-12-18", forma: "dinheiro" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas.map((parcela) => parcela.valorCentavos)).toEqual([7500, 7500]);
  });

  it("pagaAVista em falso NÃO afeta o sinal — a primeira parcela continua paga", () => {
    const resultado = gerarPlano({
      plano: "sinal",
      totalCentavos: 15001,
      data: "2026-12-18",
      forma: "pix",
      pagaAVista: false,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas.map((parcela) => parcela.paga)).toEqual([true, false]);
  });
});

describe("gerarPlano — Nx", () => {
  it("3x: os centavos que sobram vão para a PRIMEIRA parcela, vencimentos mensais", () => {
    const resultado = gerarPlano({ plano: "3", totalCentavos: 10000, data: "2026-12-18", forma: "dinheiro" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas.map((parcela) => parcela.valorCentavos)).toEqual([3334, 3333, 3333]);
    expect(resultado.parcelas.map((parcela) => parcela.vencimento)).toEqual([
      "2026-12-18",
      "2027-01-18",
      "2027-02-18",
    ]);
    expect(resultado.parcelas.map((parcela) => parcela.paga)).toEqual([true, false, false]);
  });

  it("3x de R$ 900,00 divide exato, sem sobra", () => {
    const resultado = gerarPlano({ plano: "3", totalCentavos: 90000, data: "2026-12-18", forma: "cartao" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas.map((parcela) => parcela.valorCentavos)).toEqual([30000, 30000, 30000]);
  });

  it("12x de R$ 1,00: base 8, a primeira leva a sobra inteira, soma 100", () => {
    const resultado = gerarPlano({ plano: "12", totalCentavos: 100, data: "2026-12-18", forma: "dinheiro" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas[0].valorCentavos).toBe(12);
    expect(resultado.parcelas.slice(1).every((parcela) => parcela.valorCentavos === 8)).toBe(true);
    expect(resultado.parcelas.reduce((total, parcela) => total + parcela.valorCentavos, 0)).toBe(100);
  });

  it("2x de 1 centavo recusa: valor pequeno demais para dividir", () => {
    const resultado = gerarPlano({ plano: "2", totalCentavos: 1, data: "2026-12-18", forma: "dinheiro" });
    expect(resultado).toEqual({ ok: false, erro: "O valor é pequeno demais para dividir em 2 vezes." });
  });

  it("pagaAVista em falso NÃO afeta o Nx — a primeira parcela continua paga", () => {
    const resultado = gerarPlano({
      plano: "3",
      totalCentavos: 10000,
      data: "2026-12-18",
      forma: "dinheiro",
      pagaAVista: false,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas.map((parcela) => parcela.paga)).toEqual([true, false, false]);
  });
});

describe("dividirEmDuasFormas", () => {
  it("divide o total em duas parcelas, ambas pagas na data do documento", () => {
    const resultado = dividirEmDuasFormas({
      totalCentavos: 15000,
      primeiroValorCentavos: 10000,
      data: "2026-12-18",
      formas: ["pix", "dinheiro"],
    });
    expect(resultado).toEqual({
      ok: true,
      parcelas: [
        { numero: 1, de: 2, vencimento: "2026-12-18", valorCentavos: 10000, forma: "pix", paga: true },
        { numero: 2, de: 2, vencimento: "2026-12-18", valorCentavos: 5000, forma: "dinheiro", paga: true },
      ],
    });
  });

  it("recusa quando o segundo valor fica zero ou negativo", () => {
    expect(
      dividirEmDuasFormas({
        totalCentavos: 15000,
        primeiroValorCentavos: 15000,
        data: "2026-12-18",
        formas: ["pix", "dinheiro"],
      }).ok,
    ).toBe(false);
    expect(
      dividirEmDuasFormas({
        totalCentavos: 15000,
        primeiroValorCentavos: 16000,
        data: "2026-12-18",
        formas: ["pix", "dinheiro"],
      }).ok,
    ).toBe(false);
  });

  it("com os dois pagas em falso, devolve as duas em aberto, ambas na data do documento", () => {
    const resultado = dividirEmDuasFormas({
      totalCentavos: 15000,
      primeiroValorCentavos: 10000,
      data: "2026-12-18",
      formas: ["pix", "dinheiro"],
      pagas: [false, false],
    });
    expect(resultado).toEqual({
      ok: true,
      parcelas: [
        { numero: 1, de: 2, vencimento: "2026-12-18", valorCentavos: 10000, forma: "pix", paga: false },
        { numero: 2, de: 2, vencimento: "2026-12-18", valorCentavos: 5000, forma: "dinheiro", paga: false },
      ],
    });
  });

  it("com o primeiro verdadeiro e o segundo falso, devolve exatamente isso", () => {
    const resultado = dividirEmDuasFormas({
      totalCentavos: 15000,
      primeiroValorCentavos: 10000,
      data: "2026-12-18",
      formas: ["pix", "dinheiro"],
      pagas: [true, false],
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.parcelas.map((parcela) => parcela.paga)).toEqual([true, false]);
  });
});

describe("conferirParcelas", () => {
  const base = { totalCentavos: 15000, hoje: "2026-12-18", dataSaldoInicial: null as string | null };

  it("soma igual fecha", () => {
    expect(
      conferirParcelas({ ...base, parcelas: [{ vencimento: "2026-12-18", valorCentavos: 15000, pago: true }] }),
    ).toEqual({ ok: true });
  });

  it("soma menor: falta, com a frase exata", () => {
    expect(
      conferirParcelas({ ...base, parcelas: [{ vencimento: "2026-12-18", valorCentavos: 10000, pago: true }] }),
    ).toEqual({
      ok: false,
      erro: `As parcelas somam ${formatarReais(10000)}. Faltam ${formatarReais(5000)} para fechar com o total.`,
    });
  });

  it("soma maior: sobra, com a frase exata", () => {
    expect(
      conferirParcelas({ ...base, parcelas: [{ vencimento: "2026-12-18", valorCentavos: 20000, pago: true }] }),
    ).toEqual({
      ok: false,
      erro: `As parcelas somam ${formatarReais(20000)}. Sobram ${formatarReais(5000)} para fechar com o total.`,
    });
  });

  it("parcela com valor zero recusa antes de somar", () => {
    expect(
      conferirParcelas({
        ...base,
        parcelas: [
          { vencimento: "2026-12-18", valorCentavos: 0, pago: false },
          { vencimento: "2027-01-18", valorCentavos: 15000, pago: false },
        ],
      }),
    ).toEqual({ ok: false, erro: "Cada parcela precisa ter um valor maior que zero." });
  });

  it("mais de 12 parcelas recusa", () => {
    const parcelas = Array.from({ length: 13 }, () => ({
      vencimento: "2026-12-18",
      valorCentavos: 1000,
      pago: false,
    }));
    expect(conferirParcelas({ ...base, totalCentavos: 13000, parcelas })).toEqual({
      ok: false,
      erro: "No máximo 12 parcelas.",
    });
  });

  it("parcela paga com vencimento depois de hoje recusa", () => {
    expect(
      conferirParcelas({ ...base, parcelas: [{ vencimento: "2026-12-19", valorCentavos: 15000, pago: true }] }),
    ).toEqual({
      ok: false,
      erro:
        "Uma parcela que vence depois de hoje não pode estar paga — desmarque e registre no Caixa quando o dinheiro entrar.",
    });
  });

  it("parcela única NÃO paga vencendo depois de hoje é aceita (a conta que vence dia 30)", () => {
    expect(
      conferirParcelas({ ...base, parcelas: [{ vencimento: "2026-12-19", valorCentavos: 15000, pago: false }] }),
    ).toEqual({ ok: true });
  });

  it("parcela paga antes do saldo inicial recusa quando ele existe", () => {
    expect(
      conferirParcelas({
        totalCentavos: 15000,
        hoje: "2026-12-18",
        dataSaldoInicial: "2026-12-01",
        parcelas: [{ vencimento: "2026-11-30", valorCentavos: 15000, pago: true }],
      }),
    ).toEqual({
      ok: false,
      erro: "Essa parcela vence antes do saldo inicial do Financeiro — confira a data.",
    });
  });

  it("parcela única NÃO paga com vencimento anterior ao saldo inicial é aceita — a recusa é só para parcela paga", () => {
    expect(
      conferirParcelas({
        totalCentavos: 15000,
        hoje: "2026-12-18",
        dataSaldoInicial: "2026-12-01",
        parcelas: [{ vencimento: "2026-11-30", valorCentavos: 15000, pago: false }],
      }),
    ).toEqual({ ok: true });
  });

  it("mesmo com parcela não paga, continua recusando a soma que não fecha", () => {
    expect(
      conferirParcelas({
        totalCentavos: 15000,
        hoje: "2026-12-18",
        dataSaldoInicial: "2026-12-01",
        parcelas: [{ vencimento: "2026-11-30", valorCentavos: 10000, pago: false }],
      }),
    ).toEqual({
      ok: false,
      erro: `As parcelas somam ${formatarReais(10000)}. Faltam ${formatarReais(5000)} para fechar com o total.`,
    });
  });

  it("sem saldo inicial, essa regra não se aplica", () => {
    expect(
      conferirParcelas({
        totalCentavos: 15000,
        hoje: "2026-12-18",
        dataSaldoInicial: null,
        parcelas: [{ vencimento: "2020-01-01", valorCentavos: 15000, pago: true }],
      }),
    ).toEqual({ ok: true });
  });
});

import { describe, expect, it } from "vitest";

import { parcelasDoPlano } from "@/lib/orcamentos/plano";

// 04.5-07-PLAN.md, Tarefa 1 — "o plano de pagamento": `parcelasDoPlano` é a ÚNICA função que
// decide a forma das parcelas de um orçamento (key_links do plano) — a tela, o documento do
// cliente (plano 11) e a aprovação (plano 12) leem daqui, nunca uma segunda conta. Nenhum dado
// real de cliente ou preço do ateliê entra aqui — só números ilustrativos.

const HOJE = "2026-09-26";
const ENTREGA_PREVISTA = "2026-11-10";

describe("parcelasDoPlano", () => {
  it("à vista: uma parcela só, rótulo e vencimento hoje, valor igual ao total", () => {
    const parcelas = parcelasDoPlano({
      plano: "avista",
      sinalPercentual: 50,
      totalCentavos: 100000,
      hoje: HOJE,
      entregaPrevista: ENTREGA_PREVISTA,
    });

    expect(parcelas).toEqual([
      { rotulo: "À vista, na aprovação", valorCentavos: 100000, vencimento: HOJE },
    ]);
  });

  it("sinal de 50% de R$ 1.000,00: duas parcelas de R$ 500,00 cada — sinal hoje, saldo na entrega", () => {
    const parcelas = parcelasDoPlano({
      plano: "sinal",
      sinalPercentual: 50,
      totalCentavos: 100000,
      hoje: HOJE,
      entregaPrevista: ENTREGA_PREVISTA,
    });

    expect(parcelas).toEqual([
      { rotulo: "Sinal de 50%, na aprovação", valorCentavos: 50000, vencimento: HOJE },
      { rotulo: "Saldo, na entrega", valorCentavos: 50000, vencimento: ENTREGA_PREVISTA },
    ]);
  });

  it("sinal de 33% de R$ 100,01: as duas parcelas somam exatamente o total — o saldo absorve o resto", () => {
    const parcelas = parcelasDoPlano({
      plano: "sinal",
      sinalPercentual: 33,
      totalCentavos: 10001,
      hoje: HOJE,
      entregaPrevista: ENTREGA_PREVISTA,
    });

    // Math.round(10001 * 33 / 100) = Math.round(3300.33) = 3300
    expect(parcelas[0]).toEqual({ rotulo: "Sinal de 33%, na aprovação", valorCentavos: 3300, vencimento: HOJE });
    expect(parcelas[1]).toEqual({ rotulo: "Saldo, na entrega", valorCentavos: 6701, vencimento: ENTREGA_PREVISTA });
    expect(parcelas[0].valorCentavos + parcelas[1].valorCentavos).toBe(10001);
  });

  it("3x de R$ 100,01: três parcelas somando exatamente o total, sobra na primeira, vencimentos hoje/+30/+60", () => {
    const parcelas = parcelasDoPlano({
      plano: "3x",
      sinalPercentual: 50,
      totalCentavos: 10001,
      hoje: HOJE,
      entregaPrevista: ENTREGA_PREVISTA,
    });

    expect(parcelas).toEqual([
      { rotulo: "1ª parcela, na aprovação", valorCentavos: 3335, vencimento: "2026-09-26" },
      { rotulo: "2ª parcela, em 30 dias", valorCentavos: 3333, vencimento: "2026-10-26" },
      { rotulo: "3ª parcela, em 60 dias", valorCentavos: 3333, vencimento: "2026-11-25" },
    ]);
    expect(parcelas.reduce((soma, p) => soma + p.valorCentavos, 0)).toBe(10001);
  });

  it("3x de R$ 0,00: devolve três parcelas de zero, sem divisão por zero", () => {
    const parcelas = parcelasDoPlano({
      plano: "3x",
      sinalPercentual: 50,
      totalCentavos: 0,
      hoje: HOJE,
      entregaPrevista: ENTREGA_PREVISTA,
    });

    expect(parcelas.map((p) => p.valorCentavos)).toEqual([0, 0, 0]);
    expect(parcelas.every((p) => Number.isFinite(p.valorCentavos))).toBe(true);
  });

  it("3x atravessando a virada do ano: os vencimentos avançam o dia civil corretamente", () => {
    const parcelas = parcelasDoPlano({
      plano: "3x",
      sinalPercentual: 50,
      totalCentavos: 30000,
      hoje: "2026-12-15",
      entregaPrevista: "2027-02-01",
    });

    expect(parcelas.map((p) => p.vencimento)).toEqual(["2026-12-15", "2027-01-14", "2027-02-13"]);
  });

  // Dez totais escolhidos para NÃO dividir exato por 3 nem por percentuais comuns — a soma das
  // parcelas precisa fechar com o total em TODOS, nos três planos.
  const TOTAIS_QUE_NAO_DIVIDEM_EXATO = [1, 2, 5, 7, 10, 100, 101, 9999, 10001, 33333, 100000001];

  it.each(TOTAIS_QUE_NAO_DIVIDEM_EXATO)(
    "a soma das parcelas fecha com o total %i, nos três planos",
    (totalCentavos) => {
      for (const plano of ["avista", "sinal", "3x"] as const) {
        const parcelas = parcelasDoPlano({
          plano,
          sinalPercentual: 37,
          totalCentavos,
          hoje: HOJE,
          entregaPrevista: ENTREGA_PREVISTA,
        });
        const soma = parcelas.reduce((total, p) => total + p.valorCentavos, 0);
        expect(soma).toBe(totalCentavos);
      }
    },
  );

  it("é pura: chamada duas vezes com a mesma entrada devolve exatamente o mesmo resultado", () => {
    const entrada = {
      plano: "3x" as const,
      sinalPercentual: 50,
      totalCentavos: 12345,
      hoje: HOJE,
      entregaPrevista: ENTREGA_PREVISTA,
    };

    expect(parcelasDoPlano(entrada)).toEqual(parcelasDoPlano(entrada));
  });
});

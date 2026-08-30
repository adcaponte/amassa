import { describe, expect, it } from "vitest";

import {
  calcularParcelas,
  proximaParcela,
  somarMeses,
  totaisComprometidos,
  type ItemParaCalculo,
} from "../../lib/abertura/parcelas";

// Tarefa 2 (04.2-01-PLAN.md): os casos que definem o contrato de `lib/abertura/parcelas.ts` —
// a Tarefa 3 completa a suíte com as bordas de calendário (dia 31, ano bissexto, virada de ano).
// D-19 já resolvida pelo dono em 2026-08-30 (04.2-CONTEXT.md): parcela cujo dia não existe no
// mês seguinte cai no ÚLTIMO DIA daquele mês, e o dia original volta nos meses que o comportam.

describe("calcularParcelas", () => {
  it("item a prazo de R$ 9.800 em 6 parcelas com a primeira em 2026-09-10", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 980000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-09-10",
    };
    const parcelas = calcularParcelas(item);

    expect(parcelas).toHaveLength(6);
    parcelas.forEach((parcela, indice) => {
      expect(parcela.valorEmCentavos).toBeCloseTo(980000 / 6, 6);
      expect(parcela.numero).toBe(indice + 1);
      expect(parcela.de).toBe(6);
    });

    expect(parcelas.map((p) => p.vencimentoEm)).toEqual([
      "2026-09-10",
      "2026-10-10",
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
      "2027-02-10",
    ]);
  });

  it("a soma dos valorEmCentavos das 6 parcelas é exatamente 980000", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 980000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-09-10",
    };
    const parcelas = calcularParcelas(item);
    const soma = parcelas.reduce((acumulado, p) => acumulado + p.valorEmCentavos, 0);

    expect(soma).toBe(980000);
  });

  it("item à vista devolve uma entrada só, com de: 1 e vencimento igual à primeira parcela", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 210000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-08-18",
    };
    const parcelas = calcularParcelas(item);

    expect(parcelas).toHaveLength(1);
    expect(parcelas[0]).toEqual({
      numero: 1,
      de: 1,
      vencimentoEm: "2026-08-18",
      valorEmCentavos: 210000,
    });
  });
});

describe("proximaParcela", () => {
  const item: ItemParaCalculo = {
    valorEmCentavos: 980000,
    formaPagamento: "prazo",
    parcelas: 6,
    primeiraParcelaEm: "2026-09-10",
  };
  const parcelas = calcularParcelas(item);

  it("devolve a parcela de 2026-11-10 com tipo proxima quando hoje é 2026-11-01", () => {
    const resultado = proximaParcela(parcelas, "2026-11-01");

    expect(resultado.tipo).toBe("proxima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-11-10");
  });

  it("devolve a última parcela com tipo ultima quando todas já passaram", () => {
    const resultado = proximaParcela(parcelas, "2027-06-01");

    expect(resultado.tipo).toBe("ultima");
    expect(resultado.parcela.vencimentoEm).toBe("2027-02-10");
  });
});

describe("totaisComprometidos", () => {
  it("separa aVistaEmCentavos de aPrazoEmCentavos e a soma dos dois é comprometidoEmCentavos", () => {
    const itens: ItemParaCalculo[] = [
      { valorEmCentavos: 480000, formaPagamento: "prazo", parcelas: 3, primeiraParcelaEm: "2026-09-01" },
      { valorEmCentavos: 210000, formaPagamento: "vista", parcelas: 1, primeiraParcelaEm: "2026-08-18" },
      { valorEmCentavos: 150000, formaPagamento: "vista", parcelas: 1, primeiraParcelaEm: "2026-08-20" },
    ];

    const totais = totaisComprometidos(itens);

    expect(totais.aVistaEmCentavos).toBe(360000);
    expect(totais.aPrazoEmCentavos).toBe(480000);
    expect(totais.comprometidoEmCentavos).toBe(840000);
  });
});

describe("somarMeses", () => {
  it("soma um mês simples: 2026-12-15 + 1 mês = 2027-01-15", () => {
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
  });
});

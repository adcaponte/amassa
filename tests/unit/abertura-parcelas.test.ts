import { describe, expect, it } from "vitest";

import { formatarReais } from "../../lib/abertura/formato";
import {
  calcularParcelas,
  proximaParcela,
  proximoMes,
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

  // Tarefa 3 (04.2-01-PLAN.md): as bordas de calendário. A resposta do humano na Tarefa 1 —
  // "ajustar" (D-19) — é o que decide o valor esperado destes casos de dia 31, não a
  // preferência deste plano.
  it("dia 31 encadeado: 2027-01-31 em 4 parcelas cai 2027-01-31, 2027-02-28, 2027-03-31, 2027-04-30", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 400000,
      formaPagamento: "prazo",
      parcelas: 4,
      primeiraParcelaEm: "2027-01-31",
    };
    const vencimentos = calcularParcelas(item).map((p) => p.vencimentoEm);

    // A TERCEIRA parcela é o caso que pega o encadeamento a partir da anterior: se calculada
    // a partir da SEGUNDA (28/02), ficaria presa em 28/03 em vez de voltar para 31/03 — cada
    // parcela é calculada a partir da PRIMEIRA data (D-19), nunca da anterior.
    expect(vencimentos).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("dia 31 em ano bissexto: 2028-01-31 em 2 parcelas cai 2028-01-31, 2028-02-29", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 200000,
      formaPagamento: "prazo",
      parcelas: 2,
      primeiraParcelaEm: "2028-01-31",
    };
    expect(calcularParcelas(item).map((p) => p.vencimentoEm)).toEqual([
      "2028-01-31",
      "2028-02-29",
    ]);
  });

  it("dia 30 em fevereiro: 2026-01-30 em 2 parcelas cai 2026-01-30, 2026-02-28", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 200000,
      formaPagamento: "prazo",
      parcelas: 2,
      primeiraParcelaEm: "2026-01-30",
    };
    expect(calcularParcelas(item).map((p) => p.vencimentoEm)).toEqual([
      "2026-01-30",
      "2026-02-28",
    ]);
  });

  it("virada de ano simples: 2026-12-15 em 3 parcelas cai 2026-12-15, 2027-01-15, 2027-02-15", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 300000,
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2026-12-15",
    };
    expect(calcularParcelas(item).map((p) => p.vencimentoEm)).toEqual([
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
    ]);
  });

  it("virada de ano longa: 2026-11-30 + 3 meses = 2027-02-28; 2028-01-31 + 13 meses = 2029-02-28", () => {
    expect(somarMeses("2026-11-30", 3)).toBe("2027-02-28");
    expect(somarMeses("2028-01-31", 13)).toBe("2029-02-28");
  });
});

describe("proximoMes", () => {
  it("proximoMes('2026-12') = '2027-01'; proximoMes('2026-01') = '2026-02'", () => {
    expect(proximoMes("2026-12")).toBe("2027-01");
    expect(proximoMes("2026-01")).toBe("2026-02");
  });
});

describe("bordas de calcularParcelas/proximaParcela", () => {
  it("a soma fecha em divisão não exata: 10000 centavos em 3 parcelas — mesmo texto formatado e soma exata", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 10000,
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2026-05-01",
    };
    const parcelas = calcularParcelas(item);
    const soma = parcelas.reduce((acumulado, p) => acumulado + p.valorEmCentavos, 0);

    expect(soma).toBe(10000);
    const textosFormatados = parcelas.map((p) => formatarReais(p.valorEmCentavos));
    expect(new Set(textosFormatados).size).toBe(1);
  });

  it("parcela que já passou continua sendo parcela — nenhuma é filtrada por já ter vencido", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 600000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-01-10",
    };
    const parcelas = calcularParcelas(item);

    expect(parcelas).toHaveLength(6);
    const resultado = proximaParcela(parcelas, "2026-04-01");
    expect(resultado.tipo).toBe("proxima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-04-10");
  });

  it("todas as parcelas passaram: proximaParcela devolve a última, com tipo ultima", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 600000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-01-10",
    };
    const parcelas = calcularParcelas(item);
    const resultado = proximaParcela(parcelas, "2027-01-01");

    expect(resultado.tipo).toBe("ultima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-06-10");
  });

  it("à vista com data no passado: uma parcela só, e proximaParcela devolve tipo ultima", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 100000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-01-01",
    };
    const parcelas = calcularParcelas(item);
    const resultado = proximaParcela(parcelas, "2026-06-01");

    expect(parcelas).toHaveLength(1);
    expect(resultado.tipo).toBe("ultima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-01-01");
  });

  it("determinismo: chamar calcularParcelas duas vezes com o mesmo argumento devolve resultado estruturalmente igual, e não muta o argumento recebido", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 480000,
      formaPagamento: "prazo",
      parcelas: 4,
      primeiraParcelaEm: "2026-03-31",
    };
    const copiaOriginal = { ...item };

    const primeiraChamada = calcularParcelas(item);
    const segundaChamada = calcularParcelas(item);

    expect(primeiraChamada).toEqual(segundaChamada);
    expect(item).toEqual(copiaOriginal);
  });
});

describe("totaisComprometidos — lista vazia", () => {
  it("devolve os três totais em 0, sem lançar", () => {
    expect(() => totaisComprometidos([])).not.toThrow();
    expect(totaisComprometidos([])).toEqual({
      comprometidoEmCentavos: 0,
      aVistaEmCentavos: 0,
      aPrazoEmCentavos: 0,
    });
  });
});

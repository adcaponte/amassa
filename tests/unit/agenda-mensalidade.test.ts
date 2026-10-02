import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TETO_CENTAVOS } from "@/lib/financeiro/dinheiro";
import {
  arredondarMeioParaCima,
  mesDaData,
  valorDaAula,
  valorProporcional,
  vencimentoDaMensalidade,
} from "@/lib/agenda/mensalidade";

// AGE-07 / AGE-20 / D-07: a conta da mensalidade em centavos inteiros — nenhum ponto flutuante chega
// ao valor final. As quatro terças de outubro de 2026: 06, 13, 20 e 27.
const OUTUBRO = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"] as const;

describe("arredondarMeioParaCima", () => {
  it("arredonda ao inteiro mais próximo, com o meio para cima", () => {
    expect(arredondarMeioParaCima(32000 * 3, 4)).toBe(24000);
    expect(arredondarMeioParaCima(10000, 3)).toBe(3333); // 3333,33
    expect(arredondarMeioParaCima(20000, 3)).toBe(6667); // 6666,67
    expect(arredondarMeioParaCima(5, 2)).toBe(3); // 2,5 → 3
    expect(arredondarMeioParaCima(3, 2)).toBe(2); // 1,5 → 2
    expect(arredondarMeioParaCima(0, 7)).toBe(0);
  });

  it("recusa denominador zero, negativos e não inteiros", () => {
    expect(() => arredondarMeioParaCima(10, 0)).toThrow(RangeError);
    expect(() => arredondarMeioParaCima(-1, 2)).toThrow(RangeError);
    expect(() => arredondarMeioParaCima(1.5, 2)).toThrow(RangeError);
    expect(() => arredondarMeioParaCima(1, 2.5)).toThrow(RangeError);
  });
});

describe("valorProporcional", () => {
  it("entrou depois da 1ª das 4 aulas: 3 de 4 = 24000", () => {
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: OUTUBRO, entrouEm: "2026-10-07" })).toEqual({
      tipo: "proporcional",
      valorCentavos: 24000,
      restantes: 3,
      noMes: 4,
    });
  });

  it("a aula do dia da entrada conta como restante (data ≥ entrada)", () => {
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: OUTUBRO, entrouEm: "2026-10-13" })).toEqual({
      tipo: "proporcional",
      valorCentavos: 24000,
      restantes: 3,
      noMes: 4,
    });
  });

  it("1 de 3 → 3333 e 2 de 3 → 6667 (meio para cima, em inteiros)", () => {
    const tres = ["2026-11-03", "2026-11-10", "2026-11-17"];
    expect(valorProporcional({ valorCentavos: 10000, datasDoMes: tres, entrouEm: "2026-11-11" })).toEqual({
      tipo: "proporcional",
      valorCentavos: 3333,
      restantes: 1,
      noMes: 3,
    });
    expect(valorProporcional({ valorCentavos: 10000, datasDoMes: tres, entrouEm: "2026-11-04" })).toEqual({
      tipo: "proporcional",
      valorCentavos: 6667,
      restantes: 2,
      noMes: 3,
    });
  });

  it("entrou antes da 1ª aula, ou no dia dela: mensalidade cheia", () => {
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: OUTUBRO, entrouEm: "2026-10-01" })).toEqual({
      tipo: "cheia",
      valorCentavos: 32000,
    });
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: OUTUBRO, entrouEm: "2026-10-06" })).toEqual({
      tipo: "cheia",
      valorCentavos: 32000,
    });
  });

  it("nenhuma aula restante no mês: nenhuma mensalidade", () => {
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: OUTUBRO, entrouEm: "2026-10-28" })).toEqual({
      tipo: "nenhuma",
    });
  });

  it("nenhuma data no mês: nenhuma mensalidade, sem dividir por zero", () => {
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: [], entrouEm: "2026-10-15" })).toEqual({
      tipo: "nenhuma",
    });
  });

  it("a ordem das datas e uma data repetida não mudam a conta", () => {
    const embaralhadas = ["2026-10-27", "2026-10-06", "2026-10-20", "2026-10-13", "2026-10-20"];
    expect(valorProporcional({ valorCentavos: 32000, datasDoMes: embaralhadas, entrouEm: "2026-10-07" })).toEqual({
      tipo: "proporcional",
      valorCentavos: 24000,
      restantes: 3,
      noMes: 4,
    });
  });

  it("um proporcional que arredondaria a zero centavo não vira mensalidade", () => {
    const cinco = ["2026-12-01", "2026-12-08", "2026-12-15", "2026-12-22", "2026-12-29"];
    expect(valorProporcional({ valorCentavos: 2, datasDoMes: cinco, entrouEm: "2026-12-23" })).toEqual({
      tipo: "nenhuma",
    });
  });

  it("no teto, a conta continua exata", () => {
    expect(
      valorProporcional({ valorCentavos: TETO_CENTAVOS, datasDoMes: OUTUBRO, entrouEm: "2026-10-07" }),
    ).toEqual({ tipo: "proporcional", valorCentavos: 750_000_000, restantes: 3, noMes: 4 });
  });

  it("recusa valor fora da faixa com erro de dado (AGE-20)", () => {
    const base = { datasDoMes: OUTUBRO, entrouEm: "2026-10-07" };
    expect(() => valorProporcional({ ...base, valorCentavos: -100 })).toThrow(RangeError);
    expect(() => valorProporcional({ ...base, valorCentavos: 0 })).toThrow(RangeError);
    expect(() => valorProporcional({ ...base, valorCentavos: 100.5 })).toThrow(RangeError);
    expect(() => valorProporcional({ ...base, valorCentavos: TETO_CENTAVOS + 1 })).toThrow(RangeError);
    expect(() => valorProporcional({ ...base, valorCentavos: Number.NaN })).toThrow(RangeError);
  });

  it("recusa data que não é civil", () => {
    expect(() => valorProporcional({ valorCentavos: 100, datasDoMes: OUTUBRO, entrouEm: "07/10/2026" })).toThrow(
      RangeError,
    );
    expect(() => valorProporcional({ valorCentavos: 100, datasDoMes: ["2026-10"], entrouEm: "2026-10-07" })).toThrow(
      RangeError,
    );
  });
});

describe("valorDaAula (D-07)", () => {
  it("mensalidade ÷ aulas do mês, ao centavo com meio para cima", () => {
    expect(valorDaAula(32000, 4)).toBe(8000);
    expect(valorDaAula(10000, 3)).toBe(3333);
    expect(valorDaAula(20000, 3)).toBe(6667);
    expect(valorDaAula(32000, 1)).toBe(32000);
  });

  it("sem aula no mês não há sugestão", () => {
    expect(valorDaAula(32000, 0)).toBeNull();
  });

  it("recusa entrada fora da faixa", () => {
    expect(() => valorDaAula(-1, 4)).toThrow(RangeError);
    expect(() => valorDaAula(100.5, 4)).toThrow(RangeError);
    expect(() => valorDaAula(TETO_CENTAVOS + 1, 4)).toThrow(RangeError);
    expect(() => valorDaAula(32000, -1)).toThrow(RangeError);
    expect(() => valorDaAula(32000, 1.5)).toThrow(RangeError);
  });
});

describe("vencimentoDaMensalidade", () => {
  it("o dia da turma dentro do mês da mensalidade", () => {
    expect(vencimentoDaMensalidade(28, "2027-02")).toBe("2027-02-28");
    expect(vencimentoDaMensalidade(10, "2026-12")).toBe("2026-12-10");
    expect(vencimentoDaMensalidade(1, "2026-10")).toBe("2026-10-01");
  });

  it("recusa dia fora de 1..28 e mês mal escrito", () => {
    expect(() => vencimentoDaMensalidade(0, "2026-10")).toThrow(RangeError);
    expect(() => vencimentoDaMensalidade(29, "2026-10")).toThrow(RangeError);
    expect(() => vencimentoDaMensalidade(10.5, "2026-10")).toThrow(RangeError);
    expect(() => vencimentoDaMensalidade(10, "2026-13")).toThrow(RangeError);
    expect(() => vencimentoDaMensalidade(10, "2026-10-01")).toThrow(RangeError);
  });
});

describe("mesDaData", () => {
  it("a chave do mês de uma data civil", () => {
    expect(mesDaData("2026-10-31")).toBe("2026-10");
    expect(mesDaData("2027-01-01")).toBe("2027-01");
    expect(() => mesDaData("2026-10")).toThrow(RangeError);
  });
});

describe("pureza", () => {
  it("lib/agenda/mensalidade.ts só importa módulos puros do Financeiro", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/mensalidade.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import [\s\S]*? from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    for (const origem of imports) {
      expect(["@/lib/financeiro/dinheiro", "@/lib/financeiro/calendario"]).toContain(origem);
    }
    expect(fonte).not.toMatch(/toFixed|parseFloat|new Date/);
  });
});

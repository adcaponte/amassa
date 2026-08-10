import { describe, expect, it } from "vitest";
import { diaCivilEmBrasilia, formatarInstanteCurto, hojeEmBrasilia } from "../../lib/queimas/formato";

describe("diaCivilEmBrasilia", () => {
  it('"2026-08-10T02:30:00Z" (23h30 do dia 9 em Brasília) devolve "2026-08-09" — a armadilha de fuso que getDay() do processo (rodando em UTC) esconderia', () => {
    expect(diaCivilEmBrasilia("2026-08-10T02:30:00Z")).toBe("2026-08-09");
  });

  it('"2026-08-10T03:30:00Z" (já virou meia-noite em Brasília) devolve "2026-08-10"', () => {
    expect(diaCivilEmBrasilia("2026-08-10T03:30:00Z")).toBe("2026-08-10");
  });
});

describe("formatarInstanteCurto", () => {
  it('"2026-08-05T14:00:00Z" (11h do dia 5 em Brasília) devolve "5 ago 2026" — sem zero à esquerda no dia', () => {
    expect(formatarInstanteCurto("2026-08-05T14:00:00Z")).toBe("5 ago 2026");
  });

  it("não deixa o ponto final do mês abreviado do pt-BR aparecer (\"ago\", nunca \"ago.\")", () => {
    expect(formatarInstanteCurto("2026-08-05T14:00:00Z")).not.toContain(".");
  });

  it('um instante depois da meia-noite de Brasília usa o dia civil novo, não o dia UTC anterior — "2026-08-10T02:30:00Z" devolve "9 ago 2026"', () => {
    expect(formatarInstanteCurto("2026-08-10T02:30:00Z")).toBe("9 ago 2026");
  });
});

describe("hojeEmBrasilia", () => {
  it("recebe o instante como argumento — chamadas diferentes com o mesmo argumento devolvem o mesmo resultado", () => {
    const instante = new Date("2026-08-09T12:00:00.000Z");

    expect(hojeEmBrasilia(instante)).toBe(hojeEmBrasilia(instante));
  });
});

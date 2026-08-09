import { describe, expect, it } from "vitest";
import {
  formatarDiaCompleto,
  formatarDiaCurto,
  formatarIntervalo,
  formatarPeriodo,
  hojeEmBrasilia,
} from "../../lib/encomendas/formato";

describe("hojeEmBrasilia", () => {
  it('2026-08-09T02:30:00.000Z (23h30 do dia 8 em Brasília) devolve "2026-08-08" — o caso que current_date do Postgres erraria', () => {
    expect(hojeEmBrasilia(new Date("2026-08-09T02:30:00.000Z"))).toBe("2026-08-08");
  });

  it('2026-08-09T03:30:00.000Z (já virou meia-noite em Brasília) devolve "2026-08-09"', () => {
    expect(hojeEmBrasilia(new Date("2026-08-09T03:30:00.000Z"))).toBe("2026-08-09");
  });
});

describe("formatarDiaCurto", () => {
  it('"2026-08-12" devolve "12 ago"', () => {
    expect(formatarDiaCurto("2026-08-12")).toBe("12 ago");
  });

  it('"2026-09-03" devolve "3 set" — sem zero à esquerda no dia', () => {
    expect(formatarDiaCurto("2026-09-03")).toBe("3 set");
  });

  it("não deixa o ponto final do mês abreviado do pt-BR aparecer (\"ago\", nunca \"ago.\")", () => {
    expect(formatarDiaCurto("2026-08-12")).not.toContain(".");
  });
});

describe("formatarIntervalo", () => {
  it('"2026-08-12" a "2026-08-18" devolve "12 a 18 ago"', () => {
    expect(formatarIntervalo("2026-08-12", "2026-08-18")).toBe("12 a 18 ago");
  });

  it('"2026-08-28" a "2026-09-03" devolve "28 ago a 3 set" — os dois meses aparecem quando o mês muda', () => {
    expect(formatarIntervalo("2026-08-28", "2026-09-03")).toBe("28 ago a 3 set");
  });
});

describe("formatarDiaCompleto", () => {
  it('"2026-08-12" devolve "12 de agosto de 2026"', () => {
    expect(formatarDiaCompleto("2026-08-12")).toBe("12 de agosto de 2026");
  });
});

describe("formatarPeriodo", () => {
  it('"2026-08-12" a "2026-09-03" devolve "12 ago – 3 set" (travessão)', () => {
    expect(formatarPeriodo("2026-08-12", "2026-09-03")).toBe("12 ago – 3 set");
  });

  it('com fim null devolve só "12 ago" — nunca "12 ago – —"', () => {
    const periodo = formatarPeriodo("2026-08-12", null);

    expect(periodo).toBe("12 ago");
    expect(periodo).not.toContain("—");
    expect(periodo).not.toContain("–");
  });
});

describe("nenhuma função lê o relógio", () => {
  it("hojeEmBrasilia recebe o instante como argumento — chamadas diferentes com o mesmo argumento devolvem o mesmo resultado", () => {
    const instante = new Date("2026-08-09T12:00:00.000Z");

    expect(hojeEmBrasilia(instante)).toBe(hojeEmBrasilia(instante));
  });
});

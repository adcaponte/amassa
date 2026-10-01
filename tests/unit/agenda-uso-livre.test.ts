import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  horasCheias,
  proximoEstado,
  saidaPrevista,
  valorDoMaterial,
  valorDoUsoLivre,
} from "@/lib/agenda/uso-livre";

// AGE-13: o uso livre cobra por HORA CHEIA — teto(minutos ÷ 60), em minutos inteiros — e o valor é
// horas cheias × pessoas × preço da hora + Σ material cobrado, em centavos. Pessoas multiplica UMA
// vez (a nota do AGE-13: o §6 do briefing multiplica duas; o protótipo, uma; vale o protótipo).
describe("horasCheias", () => {
  it("60 minutos é 1 hora cheia", () => {
    expect(horasCheias("14:00", "15:00")).toBe(1);
  });

  it("1 minuto já é 1 hora cheia", () => {
    expect(horasCheias("14:00", "14:01")).toBe(1);
  });

  it("61 minutos são 2 horas cheias — passou da hora, conta a próxima", () => {
    expect(horasCheias("14:00", "15:01")).toBe(2);
  });

  it("aceita a hora com segundos que o pg devolve (Pitfall 9)", () => {
    expect(horasCheias("14:00:00", "17:30:00")).toBe(4);
    expect(horasCheias("14:00:00", "16:00")).toBe(2);
  });

  it("saída igual ou antes da chegada é recusada", () => {
    expect(() => horasCheias("14:00", "14:00")).toThrow(RangeError);
    expect(() => horasCheias("14:00", "13:59")).toThrow(RangeError);
  });

  it("hora que não é hora é recusada", () => {
    expect(() => horasCheias("", "15:00")).toThrow(RangeError);
    expect(() => horasCheias("14:00", "25:00")).toThrow(RangeError);
  });

  it("o dia inteiro cabe: 00:00 às 23:59 são 24 horas cheias", () => {
    expect(horasCheias("00:00", "23:59")).toBe(24);
  });
});

describe("valorDoUsoLivre", () => {
  it("3 h × 2 pessoas × R$ 30,00 = R$ 180,00 — pessoas multiplica uma vez só", () => {
    expect(
      valorDoUsoLivre({ horas: 3, pessoas: 2, precoHoraCentavos: 3000, materialCobradoCentavos: 0 }),
    ).toBe(18000);
  });

  it("soma o material cobrado por cima", () => {
    expect(
      valorDoUsoLivre({ horas: 3, pessoas: 2, precoHoraCentavos: 3000, materialCobradoCentavos: 2160 }),
    ).toBe(20160);
  });

  it("1 hora, 1 pessoa: o preço da hora", () => {
    expect(
      valorDoUsoLivre({ horas: 1, pessoas: 1, precoHoraCentavos: 2550, materialCobradoCentavos: 0 }),
    ).toBe(2550);
  });

  it("preço da hora zero vale (o dono pode não cobrar a hora)", () => {
    expect(
      valorDoUsoLivre({ horas: 2, pessoas: 3, precoHoraCentavos: 0, materialCobradoCentavos: 500 }),
    ).toBe(500);
  });

  it("recusa entrada fora da faixa — é erro de dado, nunca um valor corrigido", () => {
    const base = { horas: 1, pessoas: 1, precoHoraCentavos: 1000, materialCobradoCentavos: 0 };
    expect(() => valorDoUsoLivre({ ...base, horas: 0 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, horas: 1.5 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, pessoas: 0 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, pessoas: 51 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, precoHoraCentavos: -1 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, precoHoraCentavos: 10.5 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, materialCobradoCentavos: -1 })).toThrow(RangeError);
    expect(() => valorDoUsoLivre({ ...base, materialCobradoCentavos: Number.NaN })).toThrow(RangeError);
  });

  it("recusa um total acima do teto do dinheiro", () => {
    expect(() =>
      valorDoUsoLivre({ horas: 24, pessoas: 50, precoHoraCentavos: 1_000_000_000, materialCobradoCentavos: 0 }),
    ).toThrow(RangeError);
  });
});

describe("valorDoMaterial", () => {
  it("1,2 kg × R$ 18,00 = R$ 21,60", () => {
    expect(valorDoMaterial(1200, 1800)).toBe(2160);
  });

  it("arredonda o meio para cima: 0,5 × R$ 3,33 = R$ 1,67", () => {
    expect(valorDoMaterial(500, 333)).toBe(167);
  });

  it("uma unidade inteira é o preço unitário", () => {
    expect(valorDoMaterial(1000, 4590)).toBe(4590);
  });

  it("quantidade zero, negativa ou fracionária é recusada", () => {
    expect(() => valorDoMaterial(0, 1800)).toThrow(RangeError);
    expect(() => valorDoMaterial(-1000, 1800)).toThrow(RangeError);
    expect(() => valorDoMaterial(1.5, 1800)).toThrow(RangeError);
  });

  it("preço negativo ou fracionário é recusado", () => {
    expect(() => valorDoMaterial(1000, -1)).toThrow(RangeError);
    expect(() => valorDoMaterial(1000, 1.5)).toThrow(RangeError);
  });
});

describe("proximoEstado", () => {
  it("reservado + chegou → no espaço", () => {
    expect(proximoEstado("reservado", "chegou")).toBe("no_espaco");
  });

  it("no espaço + encerrar → encerrado", () => {
    expect(proximoEstado("no_espaco", "encerrar")).toBe("encerrado");
  });

  it("qualquer outra transição é nula", () => {
    expect(proximoEstado("reservado", "encerrar")).toBeNull();
    expect(proximoEstado("no_espaco", "chegou")).toBeNull();
    expect(proximoEstado("encerrado", "chegou")).toBeNull();
    expect(proximoEstado("encerrado", "encerrar")).toBeNull();
  });
});

describe("saidaPrevista", () => {
  it("14:00 + 2 horas = 16:00", () => {
    expect(saidaPrevista("14:00:00", 2)).toBe("16:00");
    expect(saidaPrevista("09:30", 1)).toBe("10:30");
  });

  it("nunca passa da meia-noite: para em 23:59", () => {
    expect(saidaPrevista("22:00", 3)).toBe("23:59");
  });

  it("horas previstas fora de 1..12 é recusada", () => {
    expect(() => saidaPrevista("14:00", 0)).toThrow(RangeError);
    expect(() => saidaPrevista("14:00", 13)).toThrow(RangeError);
  });
});

describe("pureza do módulo do uso livre", () => {
  it("não importa React, Next, drizzle-orm, pg nem @/db e não lê o relógio", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/uso-livre.ts"), "utf8");
    expect(fonte).not.toMatch(/from "(@\/db|react|next|drizzle-orm|pg)/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });
});

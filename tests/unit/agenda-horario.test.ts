import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cobreOAgora, horaDe, minutosDe } from "@/lib/agenda/horario";

// Horas de parede da Agenda (Pitfall 9): o `pg` devolve `time` com segundos ("19:00:00") e o
// formulário manda sem ("19:00") — as duas formas são a mesma hora.
describe("minutosDe / horaDe", () => {
  it("aceita a hora com e sem segundos", () => {
    expect(minutosDe("19:00")).toBe(1140);
    expect(minutosDe("19:00:00")).toBe(1140);
    expect(minutosDe("00:00")).toBe(0);
    expect(minutosDe("23:59:00")).toBe(1439);
  });

  it("devolve HH:MM a partir dos minutos do dia", () => {
    expect(horaDe(1140)).toBe("19:00");
    expect(horaDe(0)).toBe("00:00");
    expect(horaDe(605)).toBe("10:05");
  });

  it("recusa o que não é hora", () => {
    expect(() => minutosDe("lixo")).toThrow(RangeError);
    expect(() => minutosDe("24:00")).toThrow(RangeError);
    expect(() => minutosDe("10:60")).toThrow(RangeError);
    expect(() => horaDe(-1)).toThrow(RangeError);
    expect(() => horaDe(1440)).toThrow(RangeError);
  });
});

describe("cobreOAgora", () => {
  it("o início entra, o fim não (fim exclusivo)", () => {
    expect(cobreOAgora("19:00", "21:00", 1140)).toBe(true);
    expect(cobreOAgora("19:00:00", "21:00:00", 1200)).toBe(true);
    expect(cobreOAgora("19:00", "21:00", 1260)).toBe(false);
    expect(cobreOAgora("19:00", "21:00", 1139)).toBe(false);
  });
});

describe("pureza", () => {
  it("lib/agenda/horario.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/horario.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

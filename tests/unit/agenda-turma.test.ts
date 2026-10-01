import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NOMES_DOS_DIAS,
  ORDEM_DOS_DIAS_NA_TELA,
  aPartirDeParaEstender,
  datasDaTurma,
  datasEmDiaFechado,
  diaDaSemanaDe,
  quandoDaTurmaNoSite,
  rotuloDaTurmaNaGestao,
  todoODia,
} from "@/lib/agenda/turma";

// AGE-03: uma data por semana, no dia da turma, a partir de quando o gestor escolher (UI-D10). Tudo em
// datas civis — nenhuma conta passa por `Date`, então nenhuma data escorrega de dia por fuso.
describe("diaDaSemanaDe", () => {
  it("0 = domingo … 6 = sábado", () => {
    expect(diaDaSemanaDe("2026-10-04")).toBe(0); // domingo
    expect(diaDaSemanaDe("2026-10-05")).toBe(1);
    expect(diaDaSemanaDe("2026-10-06")).toBe(2); // terça
    expect(diaDaSemanaDe("2026-10-10")).toBe(6); // sábado
    expect(diaDaSemanaDe("1969-12-31")).toBe(3); // antes da âncora
  });
});

describe("datasDaTurma", () => {
  it("a partir do próprio dia da semana: ele entra", () => {
    expect(datasDaTurma({ diaDaSemana: 2, aPartirDe: "2026-10-06", semanas: 3 })).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
    ]);
  });

  it("a partir de um dia depois: começa na semana seguinte", () => {
    expect(datasDaTurma({ diaDaSemana: 2, aPartirDe: "2026-10-07", semanas: 2 })).toEqual(["2026-10-13", "2026-10-20"]);
  });

  it("domingo é 0", () => {
    expect(datasDaTurma({ diaDaSemana: 0, aPartirDe: "2026-10-06", semanas: 2 })).toEqual(["2026-10-11", "2026-10-18"]);
  });

  it("52 semanas atravessam a virada do ano em ordem, todas no mesmo dia da semana", () => {
    const datas = datasDaTurma({ diaDaSemana: 2, aPartirDe: "2026-10-06", semanas: 52 });
    expect(datas).toHaveLength(52);
    expect(datas[0]).toBe("2026-10-06");
    expect(datas[51]).toBe("2027-09-28");
    expect(datas).toContain("2026-12-29");
    expect(datas).toContain("2027-01-05");
    expect([...datas].sort()).toEqual(datas);
    expect(new Set(datas).size).toBe(52);
    expect(datas.every((data) => diaDaSemanaDe(data) === 2)).toBe(true);
  });

  it("padrão do formulário: 8 semanas, uma por semana", () => {
    const datas = datasDaTurma({ diaDaSemana: 5, aPartirDe: "2026-10-01", semanas: 8 });
    expect(datas).toEqual([
      "2026-10-02",
      "2026-10-09",
      "2026-10-16",
      "2026-10-23",
      "2026-10-30",
      "2026-11-06",
      "2026-11-13",
      "2026-11-20",
    ]);
  });

  it("semanas fora de 1..52 ou não inteiras → RangeError", () => {
    expect(() => datasDaTurma({ diaDaSemana: 2, aPartirDe: "2026-10-06", semanas: 0 })).toThrow(RangeError);
    expect(() => datasDaTurma({ diaDaSemana: 2, aPartirDe: "2026-10-06", semanas: 53 })).toThrow(RangeError);
    expect(() => datasDaTurma({ diaDaSemana: 2, aPartirDe: "2026-10-06", semanas: 1.5 })).toThrow(RangeError);
  });

  it("dia da semana fora de 0..6 → RangeError", () => {
    expect(() => datasDaTurma({ diaDaSemana: 7, aPartirDe: "2026-10-06", semanas: 1 })).toThrow(RangeError);
    expect(() => datasDaTurma({ diaDaSemana: -1, aPartirDe: "2026-10-06", semanas: 1 })).toThrow(RangeError);
  });

  it("uma semana só", () => {
    expect(datasDaTurma({ diaDaSemana: 6, aPartirDe: "2026-12-31", semanas: 1 })).toEqual(["2027-01-02"]);
  });
});

describe("aPartirDeParaEstender", () => {
  it("o dia seguinte à última data marcada — a última não é marcada de novo", () => {
    expect(aPartirDeParaEstender("2026-10-20", "2026-10-08")).toBe("2026-10-21");
  });

  it("última data já passou → hoje", () => {
    expect(aPartirDeParaEstender("2026-09-01", "2026-10-08")).toBe("2026-10-08");
  });

  it("última data é hoje → amanhã (hoje já está marcada)", () => {
    expect(aPartirDeParaEstender("2026-10-08", "2026-10-08")).toBe("2026-10-09");
  });

  it("última data foi ontem → hoje", () => {
    expect(aPartirDeParaEstender("2026-10-07", "2026-10-08")).toBe("2026-10-08");
  });

  it("sem nenhuma data → hoje", () => {
    expect(aPartirDeParaEstender(null, "2026-10-08")).toBe("2026-10-08");
  });

  it("estender começa na semana seguinte à última data", () => {
    const de = aPartirDeParaEstender("2026-10-20", "2026-10-08");
    expect(datasDaTurma({ diaDaSemana: 2, aPartirDe: de, semanas: 2 })).toEqual(["2026-10-27", "2026-11-03"]);
  });
});

describe("datasEmDiaFechado", () => {
  it("só as datas que caem num fechado, com o motivo", () => {
    expect(datasEmDiaFechado(["2026-12-22", "2026-12-29"], [{ data: "2026-12-29", motivo: "x" }])).toEqual([
      { data: "2026-12-29", motivo: "x" },
    ]);
  });

  it("na ordem das datas; dois fechados no mesmo dia → o primeiro", () => {
    expect(
      datasEmDiaFechado(
        ["2026-12-15", "2026-12-22", "2026-12-29"],
        [
          { data: "2026-12-29", motivo: "férias" },
          { data: "2026-12-15", motivo: "forno" },
          { data: "2026-12-29", motivo: "outro" },
          { data: "2026-12-30", motivo: "fora" },
        ],
      ),
    ).toEqual([
      { data: "2026-12-15", motivo: "forno" },
      { data: "2026-12-29", motivo: "férias" },
    ]);
  });

  it("sem fechado → nada", () => {
    expect(datasEmDiaFechado(["2026-12-22"], [])).toEqual([]);
  });
});

describe("rótulos da turma", () => {
  it("gestão: “toda terça, 19:00 às 21:00”, com ou sem segundos", () => {
    expect(rotuloDaTurmaNaGestao({ diaSemana: 2, inicio: "19:00:00", fim: "21:00:00" })).toBe("toda terça, 19:00 às 21:00");
    expect(rotuloDaTurmaNaGestao({ diaSemana: 2, inicio: "09:30", fim: "11:00" })).toBe("toda terça, 09:30 às 11:00");
  });

  it("site: “toda terça, 19h às 21h”; meia hora “19h30”", () => {
    expect(quandoDaTurmaNoSite({ diaSemana: 2, inicio: "19:00:00", fim: "21:00:00" })).toBe("toda terça, 19h às 21h");
    expect(quandoDaTurmaNoSite({ diaSemana: 3, inicio: "19:30:00", fim: "21:05" })).toBe("toda quarta, 19h30 às 21h05");
    expect(quandoDaTurmaNoSite({ diaSemana: 4, inicio: "09:00", fim: "11:00" })).toBe("toda quinta, 9h às 11h");
  });

  it("sábado e domingo são masculinos", () => {
    expect(todoODia(6)).toBe("todo sábado");
    expect(todoODia(0)).toBe("todo domingo");
    expect(todoODia(1)).toBe("toda segunda");
    expect(rotuloDaTurmaNaGestao({ diaSemana: 6, inicio: "10:00", fim: "12:00" })).toBe("todo sábado, 10:00 às 12:00");
  });

  it("os nomes e a ordem da tela (segunda → domingo)", () => {
    expect(NOMES_DOS_DIAS[0]).toBe("domingo");
    expect(NOMES_DOS_DIAS[2]).toBe("terça");
    expect(ORDEM_DOS_DIAS_NA_TELA.map((dia) => NOMES_DOS_DIAS[dia])).toEqual([
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
      "domingo",
    ]);
  });
});

describe("pureza", () => {
  it("lib/agenda/turma.ts só importa o calendário civil e as horas", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/turma.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import [\s\S]*? from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const origem of imports) {
      expect(["@/lib/producao/calendario", "./horario"]).toContain(origem);
    }
  });
});

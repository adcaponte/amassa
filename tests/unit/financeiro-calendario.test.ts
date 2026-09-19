import { describe, expect, it } from "vitest";

import {
  mesAnterior,
  mesSeguinte,
  primeiroDiaDoMes,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from "@/lib/financeiro/calendario";

// 04.4-06-PLAN.md, Tarefa 1 — aritmética de calendário civil sem `Date`, provada em milissegundos.

describe("somarMeses", () => {
  it("cai no último dia do mês de destino quando o dia original não existe nele", () => {
    expect(somarMeses("2027-01-31", 1)).toBe("2027-02-28");
  });

  it("cai em 29/02 num ano bissexto", () => {
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("conta sempre a partir da data ORIGINAL, nunca da parcela anterior", () => {
    // Se a soma encadeasse a partir da parcela anterior (31/01 → 28/02), somar mais 1 mês a
    // partir de 28/02 devolveria 28/03 — a regra certa devolve 31/03 (a partir de 31/01 direto).
    expect(somarMeses("2027-01-31", 2)).toBe("2027-03-31");
  });
});

describe("somarDias", () => {
  it("vira o ano nos dois sentidos", () => {
    expect(somarDias("2026-12-18", 30)).toBe("2027-01-17");
    expect(somarDias("2027-01-17", -30)).toBe("2026-12-18");
  });
});

describe("mesSeguinte / mesAnterior", () => {
  it("viram o ano nos dois sentidos", () => {
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesAnterior("2027-01")).toBe("2026-12");
  });

  it("são inversos um do outro dentro do mesmo ano", () => {
    expect(mesAnterior(mesSeguinte("2027-05"))).toBe("2027-05");
  });
});

describe("ultimoDiaDoMes", () => {
  it("acerta fevereiro bissexto e não bissexto", () => {
    expect(ultimoDiaDoMes(2027, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(2000, 2)).toBe(29);
    expect(ultimoDiaDoMes(1900, 2)).toBe(28);
  });

  it("acerta os meses de 30 e de 31 dias", () => {
    expect(ultimoDiaDoMes(2027, 4)).toBe(30);
    expect(ultimoDiaDoMes(2027, 1)).toBe(31);
  });
});

describe("primeiroDiaDoMes", () => {
  it("monta o primeiro dia civil a partir da chave YYYY-MM", () => {
    expect(primeiroDiaDoMes("2026-12")).toBe("2026-12-01");
  });
});

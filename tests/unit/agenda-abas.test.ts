import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  abaDaAgendaDaUrl,
  buscaDaUrl,
  diaDaUrl,
  idDaUrl,
  lancarDaUrl,
  mesDaUrl,
  pessoaDaUrl,
  semanaDaUrl,
  turmaDaUrl,
  vistaDaUrl,
} from "@/lib/agenda/abas";

// Parâmetro desconhecido na URL cai no padrão, nunca em erro (UI E1·error).
describe("semanaDaUrl", () => {
  const hoje = "2026-10-01"; // quinta

  it("sem parâmetro, a segunda da semana de hoje", () => {
    expect(semanaDaUrl(undefined, hoje)).toBe("2026-09-28");
  });

  it("qualquer dia vira a segunda da semana dele", () => {
    expect(semanaDaUrl("2026-10-08", hoje)).toBe("2026-10-05");
    expect(semanaDaUrl("2026-10-05", hoje)).toBe("2026-10-05");
  });

  it("lixo, data impossível e lista repetida caem na semana de hoje", () => {
    expect(semanaDaUrl("lixo", hoje)).toBe("2026-09-28");
    expect(semanaDaUrl("2026-02-30", hoje)).toBe("2026-09-28");
    expect(semanaDaUrl(["a", "b"], hoje)).toBe("2026-09-28");
    expect(semanaDaUrl(["2026-10-08", "2026-10-15"], hoje)).toBe("2026-09-28");
    expect(semanaDaUrl("", hoje)).toBe("2026-09-28");
  });
});

describe("idDaUrl", () => {
  it("aceita só uuid", () => {
    expect(idDaUrl("3f1c2a4e-9b7d-4c1e-8a2b-0d9e8f7a6b5c")).toBe("3f1c2a4e-9b7d-4c1e-8a2b-0d9e8f7a6b5c");
    expect(idDaUrl("3F1C2A4E-9B7D-4C1E-8A2B-0D9E8F7A6B5C")).toBe("3F1C2A4E-9B7D-4C1E-8A2B-0D9E8F7A6B5C");
  });

  it("qualquer outra coisa vira null", () => {
    expect(idDaUrl(undefined)).toBeNull();
    expect(idDaUrl("")).toBeNull();
    expect(idDaUrl("1")).toBeNull();
    expect(idDaUrl("x' or 1=1 --")).toBeNull();
    expect(idDaUrl(["3f1c2a4e-9b7d-4c1e-8a2b-0d9e8f7a6b5c"])).toBeNull();
  });
});

describe("diaDaUrl", () => {
  it("aceita uma data civil válida", () => {
    expect(diaDaUrl("2026-10-08")).toBe("2026-10-08");
    expect(diaDaUrl("2028-02-29")).toBe("2028-02-29");
  });

  it("data impossível, lixo e lista viram null", () => {
    expect(diaDaUrl("2026-02-30")).toBeNull();
    expect(diaDaUrl("lixo")).toBeNull();
    expect(diaDaUrl("")).toBeNull();
    expect(diaDaUrl(undefined)).toBeNull();
    expect(diaDaUrl(["2026-10-08"])).toBeNull();
  });
});

describe("lancarDaUrl", () => {
  it("só o 1 abre a folha", () => {
    expect(lancarDaUrl("1")).toBe(true);
    expect(lancarDaUrl("0")).toBe(false);
    expect(lancarDaUrl("")).toBe(false);
    expect(lancarDaUrl("sim")).toBe(false);
    expect(lancarDaUrl(undefined)).toBe(false);
    expect(lancarDaUrl(["1"])).toBe(false);
  });
});

describe("vistaDaUrl", () => {
  it("mes é mes; o resto é semana", () => {
    expect(vistaDaUrl("mes")).toBe("mes");
    expect(vistaDaUrl("semana")).toBe("semana");
    expect(vistaDaUrl("ano")).toBe("semana");
    expect(vistaDaUrl(undefined)).toBe("semana");
    expect(vistaDaUrl(["mes"])).toBe("semana");
  });
});

describe("mesDaUrl", () => {
  const hoje = "2026-10-01";

  it("AAAA-MM válido fica", () => {
    expect(mesDaUrl("2026-12", hoje)).toBe("2026-12");
    expect(mesDaUrl("2027-01", hoje)).toBe("2027-01");
  });

  it("lixo, mês 13, data inteira e lista caem no mês de hoje", () => {
    expect(mesDaUrl("lixo", hoje)).toBe("2026-10");
    expect(mesDaUrl("2026-13", hoje)).toBe("2026-10");
    expect(mesDaUrl("2026-00", hoje)).toBe("2026-10");
    expect(mesDaUrl("2026-12-01", hoje)).toBe("2026-10");
    expect(mesDaUrl(undefined, hoje)).toBe("2026-10");
    expect(mesDaUrl(["2026-12"], hoje)).toBe("2026-10");
  });
});

// 05-04-PLAN.md, Tarefa 2: as abas da Agenda nascem — "agenda" e "pessoas" nesta etapa (os planos 11,
// 14 e 15 acrescentam "receber", "numeros" e "site").
describe("abaDaAgendaDaUrl", () => {
  it("sem parâmetro, a aba Agenda", () => {
    expect(abaDaAgendaDaUrl(undefined)).toBe("agenda");
  });

  it.each(["agenda", "pessoas"] as const)("“%s” → a mesma aba", (aba) => {
    expect(abaDaAgendaDaUrl(aba)).toBe(aba);
  });

  it.each(["receber", "numeros", "site", "PESSOAS", "", "lixo"])("ainda não existe ou é lixo (“%s”) → agenda", (valor) => {
    expect(abaDaAgendaDaUrl(valor)).toBe("agenda");
  });

  it("lista repetida (?aba=a&aba=b) → agenda", () => {
    expect(abaDaAgendaDaUrl(["pessoas", "agenda"])).toBe("agenda");
  });
});

describe("buscaDaUrl", () => {
  it("apara; ausente ou lista → ''; corta em 160", () => {
    expect(buscaDaUrl("  joao  ")).toBe("joao");
    expect(buscaDaUrl(undefined)).toBe("");
    expect(buscaDaUrl(["a", "b"])).toBe("");
    expect(buscaDaUrl("x".repeat(200))).toHaveLength(160);
  });
});

describe("pessoaDaUrl", () => {
  it("só uuid; o resto é null", () => {
    expect(pessoaDaUrl("0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e")).toBe("0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e");
    expect(pessoaDaUrl(undefined)).toBeNull();
    expect(pessoaDaUrl("1 or 1=1")).toBeNull();
    expect(pessoaDaUrl(["0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e"])).toBeNull();
  });
});

describe("turmaDaUrl", () => {
  it("só uuid; o resto é null", () => {
    expect(turmaDaUrl("0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e")).toBe("0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e");
    expect(turmaDaUrl(undefined)).toBeNull();
    expect(turmaDaUrl("")).toBeNull();
    expect(turmaDaUrl("1 or 1=1")).toBeNull();
    expect(turmaDaUrl(["0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e"])).toBeNull();
  });
});

describe("pureza", () => {
  it("lib/agenda/abas.ts só importa módulos puros", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/abas.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import .* from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    for (const origem of imports) {
      expect(["@/lib/producao/calendario", "@/lib/clientes/lista", "./semana"]).toContain(origem);
    }
  });

  it("lib/agenda/textos.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/textos.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

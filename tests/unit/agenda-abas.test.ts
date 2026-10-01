import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { idDaUrl, semanaDaUrl } from "@/lib/agenda/abas";

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

describe("pureza", () => {
  it("lib/agenda/abas.ts só importa módulos puros", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/abas.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import .* from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    for (const origem of imports) {
      expect(["@/lib/producao/calendario", "./semana"]).toContain(origem);
    }
  });

  it("lib/agenda/textos.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/textos.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

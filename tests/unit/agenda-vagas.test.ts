import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listaCheia, rotuloDeVagas, vagasRestantes } from "@/lib/agenda/vagas";

// AGE-11: as vagas são só uma conta para MOSTRAR — nada aqui recusa uma inscrição. Os quatro rótulos
// vêm do protótipo (linha 277) e servem ao calendário do site (plano 15).
describe("vagasRestantes", () => {
  it("vagas menos inscritos, inclusive negativo quando a lista passou das vagas", () => {
    expect(vagasRestantes(8, 5)).toBe(3);
    expect(vagasRestantes(8, 8)).toBe(0);
    expect(vagasRestantes(8, 9)).toBe(-1);
    expect(vagasRestantes(1, 0)).toBe(1);
  });
});

describe("rotuloDeVagas", () => {
  it("n vagas, últimas 2 vagas, última vaga", () => {
    expect(rotuloDeVagas(3)).toBe("3 vagas");
    expect(rotuloDeVagas(12)).toBe("12 vagas");
    expect(rotuloDeVagas(2)).toBe("últimas 2 vagas");
    expect(rotuloDeVagas(1)).toBe("última vaga");
  });

  it("zero ou negativo é esgotado", () => {
    expect(rotuloDeVagas(0)).toBe("esgotado");
    expect(rotuloDeVagas(-1)).toBe("esgotado");
    expect(rotuloDeVagas(-30)).toBe("esgotado");
  });
});

describe("listaCheia", () => {
  it("cheia com inscritos = vagas ou acima; vagas mínimas = 1", () => {
    expect(listaCheia(8, 8)).toBe(true);
    expect(listaCheia(8, 9)).toBe(true);
    expect(listaCheia(8, 7)).toBe(false);
    expect(listaCheia(1, 1)).toBe(true);
    expect(listaCheia(1, 0)).toBe(false);
  });

  it("uma data vazia nunca está cheia", () => {
    expect(listaCheia(8, 0)).toBe(false);
  });
});

describe("pureza", () => {
  it("lib/agenda/vagas.ts só importa as frases da Agenda", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/vagas.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import [\s\S]*? from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    expect(imports.every((origem) => origem === "./textos")).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { luminanciaRelativa, razaoDeContraste } from "@/lib/acessibilidade/contraste";

// O briefing do site (BRIEFING-site.md §4) manda CONFERIR o contraste da faixa amarela, não
// afirmá-lo — "a faixa amarela `--sol` com texto `--tinta` passa; conferir". Uma frase de plano
// não confere nada; um número, sim (SIT-10, aresta `precision`). Os pares do site são lidos do
// `app/globals.css` REAL por `node:fs` (nunca hex repetido aqui) — o mesmo molde de
// `tests/unit/tokens.test.ts` — para mudar um neutro reexecutar esta conferência sozinho.
const globalsCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf-8");

function tokenDoSite(nome: string): string {
  const padrao = new RegExp(`--color-site-${nome}:\\s*(#[0-9A-Fa-f]{6});`);
  const encontrado = globalsCss.match(padrao);
  if (!encontrado) {
    throw new Error(`token --color-site-${nome} não encontrado em app/globals.css`);
  }
  return encontrado[1];
}

describe("lib/acessibilidade/contraste — razaoDeContraste e luminanciaRelativa (SIT-10)", () => {
  it("razaoDeContraste é simétrica: branco/preto e preto/branco devolvem 21", () => {
    expect(razaoDeContraste("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(razaoDeContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
  });

  it("razaoDeContraste da mesma cor contra si mesma devolve 1", () => {
    expect(razaoDeContraste("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("aceita hex com e sem #, maiúsculo e minúsculo", () => {
    const comCerquilha = razaoDeContraste("#FFFFFF", "#000000");
    const semCerquilha = razaoDeContraste("FFFFFF", "000000");
    const minusculo = razaoDeContraste("ffffff", "000000");
    expect(semCerquilha).toBeCloseTo(comCerquilha, 5);
    expect(minusculo).toBeCloseTo(comCerquilha, 5);
  });

  it("recusa entrada mal formada com erro claro em português", () => {
    expect(() => razaoDeContraste("não é hex", "#000000")).toThrow(/hex/i);
    expect(() => razaoDeContraste("#FFF", "#000000")).toThrow(/hex/i);
    expect(() => razaoDeContraste("#GGGGGG", "#000000")).toThrow(/hex/i);
  });

  it("luminanciaRelativa do branco é 1 e do preto é 0", () => {
    expect(luminanciaRelativa("#FFFFFF")).toBeCloseTo(1, 5);
    expect(luminanciaRelativa("#000000")).toBeCloseTo(0, 5);
  });

  it("o par --color-site-sol sobre --color-site-tinta passa AA (>= 4.5)", () => {
    const sol = tokenDoSite("sol");
    const tinta = tokenDoSite("tinta");
    expect(razaoDeContraste(sol, tinta)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["fundo", "papel", "areia"])(
    "--color-site-tinta sobre --color-site-%s passa AA (>= 4.5)",
    (fundo) => {
      const tinta = tokenDoSite("tinta");
      const corDeFundo = tokenDoSite(fundo);
      expect(razaoDeContraste(tinta, corDeFundo)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("--color-site-tinta-fraca sobre --color-site-fundo passa AA (>= 4.5) — achado real se não passar: o token muda, não o teste", () => {
    const tintaFraca = tokenDoSite("tinta-fraca");
    const fundo = tokenDoSite("fundo");
    expect(razaoDeContraste(tintaFraca, fundo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("app/sitemap.ts — MetadataRoute.Sitemap (SIT-08)", () => {
  it("devolve uma entrada só (a raiz), com lastModified, determinística entre chamadas", async () => {
    const modulo = await import("@/app/sitemap");
    const sitemap = modulo.default;

    const primeira = sitemap();
    const segunda = sitemap();

    expect(primeira).toHaveLength(1);
    expect(primeira[0]?.url).toMatch(/\/$/);
    expect(primeira[0]?.lastModified).toBeDefined();
    expect(segunda).toEqual(primeira);
  });
});

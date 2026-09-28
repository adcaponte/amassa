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

// Resolve o valor de UMA variável CSS (`--nome: valor;`) em app/globals.css — pode ser um hex
// literal ou uma referência `var(--outra-variavel)` (D-19: sete dos treze tokens do site
// referenciam um token da plataforma, de propósito, para os dois nunca divergirem sem ninguém
// notar). Segue a cadeia de `var(...)` até achar hex, ou lança se não achar em 5 saltos (limite
// de segurança contra ciclo, nunca esperado num CSS real).
function resolverVariavelCss(nomeDaVariavel: string, saltosRestantes = 5): string {
  if (saltosRestantes <= 0) {
    throw new Error(`cadeia de var(...) longa demais ao resolver ${nomeDaVariavel} — possível ciclo`);
  }
  const padrao = new RegExp(`${nomeDaVariavel}:\\s*([^;]+);`);
  const encontrado = globalsCss.match(padrao);
  if (!encontrado) {
    throw new Error(`variável ${nomeDaVariavel} não encontrada em app/globals.css`);
  }
  const valorBruto = encontrado[1].trim();
  const casoHex = valorBruto.match(/^#[0-9A-Fa-f]{6}$/);
  if (casoHex) return valorBruto;

  const casoVar = valorBruto.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (casoVar) return resolverVariavelCss(casoVar[1], saltosRestantes - 1);

  throw new Error(`valor "${valorBruto}" de ${nomeDaVariavel} não é hex nem var(...) — formato inesperado`);
}

function tokenDoSite(nome: string): string {
  return resolverVariavelCss(`--color-site-${nome}`);
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

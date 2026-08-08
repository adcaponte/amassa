import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// `readFileSync` puro, não import de módulo: o Vite/Vitest tem um plugin próprio de CSS que
// intercepta QUALQUER import de arquivo `.css` (mesmo com "?raw") e devolve string vazia fora
// de ambiente de navegador — silenciosamente, sem erro. Ler o arquivo como texto plano pelo
// `node:fs` é o único jeito confiável de testar o conteúdo real do CSS aqui.
const globalsCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf-8");

// Único guarda contra a "armadilha de silêncio" do D-08/D-09: instalar um componente shadcn
// sem o mapeamento `@theme inline` não quebra o build nem aparece no console — só um teste que
// lê o arquivo de verdade pega isso. Cada assertativa itera um array de chaves esperadas para
// o relatório do Vitest dizer exatamente QUAL faltou, em vez de um "algo está errado" genérico.

describe("app/globals.css — tokens do design system (D-08, D-09)", () => {
  it("declara os dois blocos @theme, nesta ordem", () => {
    const indiceThemeCru = globalsCss.indexOf("@theme {");
    const indiceThemeInline = globalsCss.indexOf("@theme inline {");

    expect(indiceThemeCru).toBeGreaterThan(-1);
    expect(indiceThemeInline).toBeGreaterThan(-1);
    expect(indiceThemeCru).toBeLessThan(indiceThemeInline);
  });

  it("não usa oklch em lugar nenhum — os valores são hex literais do 04-DESIGN-SYSTEM.md", () => {
    expect(globalsCss.toLowerCase()).not.toContain("oklch");
  });

  it("nunca menciona o valor de contraste reprovado #8A7A70", () => {
    expect(globalsCss).not.toContain("8A7A70");
  });

  it.each([
    ["--color-fundo", "#F6F3F0"],
    ["--color-superficie", "#FFFFFF"],
    ["--color-superficie-2", "#EFEAE5"],
    ["--color-borda", "#E8E2DC"],
    ["--color-borda-forte", "#D8CFC7"],
    ["--color-tinta", "#1D2221"],
    ["--color-tinta-media", "#5A4C44"],
    ["--color-tinta-fraca", "#6E5F56"],
    ["--color-acento", "#894025"],
    ["--color-acento-hover", "#5B2916"],
    ["--color-acento-fundo", "#F3EDE9"],
    ["--color-destaque", "#FFBD59"],
  ])("token de superfície/texto/ação %s vale %s", (chave, valorEsperado) => {
    const padrao = new RegExp(`${chave}:\\s*${valorEsperado};`, "i");
    expect(globalsCss).toMatch(padrao);
  });

  // As "quinze cores NÃO ALTERAR" do 02b-01-PLAN.md — 6 de etapa, 3 de modalidade, 3 de tipo
  // de queima e os 3 níveis do contador de forno (o array abaixo confere também os pares
  // fundo/texto de cada nível, que fazem parte do mesmo bloco literal).
  it.each([
    // etapas da encomenda (6)
    ["--color-producao", "#8B6F47"],
    ["--color-secagem", "#C9B896"],
    ["--color-queima1", "#C2451B"],
    ["--color-esmaltacao", "#2E7D8C"],
    ["--color-queima2", "#7A3527"],
    ["--color-entrega", "#5B7553"],
    // modalidades de aula (3)
    ["--color-modelagem", "#92400E"],
    ["--color-torno", "#115E59"],
    ["--color-pintura", "#1D4ED8"],
    // tipos de queima (3)
    ["--color-biscoito", "#9A3412"],
    ["--color-esmalte", "#155E75"],
    ["--color-ouro", "#CA8A04"],
    // níveis do contador de forno (3 principais + fundo/texto de cada um)
    ["--color-forno-ok", "#D97706"],
    ["--color-forno-ok-fundo", "#FFFBEB"],
    ["--color-forno-ok-texto", "#92400E"],
    ["--color-forno-atencao", "#CA8A04"],
    ["--color-forno-atencao-fundo", "#FEF9C3"],
    ["--color-forno-atencao-texto", "#854D0E"],
    ["--color-forno-critico", "#DC2626"],
    ["--color-forno-critico-fundo", "#FEE2E2"],
    ["--color-forno-critico-texto", "#991B1B"],
  ])("cor NÃO ALTERAR %s vale %s mesmo sem uso nesta fase", (chave, valorEsperado) => {
    const padrao = new RegExp(`${chave}:\\s*${valorEsperado};`, "i");
    expect(globalsCss).toMatch(padrao);
  });

  it.each([
    ["--color-sucesso", "#15803D"],
    ["--color-sucesso-fundo", "#DCFCE7"],
    ["--color-atencao", "#B45309"],
    ["--color-atencao-fundo", "#FEF3C7"],
    ["--color-erro", "#B91C1C"],
    ["--color-erro-fundo", "#FEE2E2"],
  ])("cor semântica %s vale %s", (chave, valorEsperado) => {
    const padrao = new RegExp(`${chave}:\\s*${valorEsperado};`, "i");
    expect(globalsCss).toMatch(padrao);
  });

  it.each([
    ["--radius-sm", "6px"],
    ["--radius-md", "10px"],
    ["--radius-lg", "14px"],
    ["--radius-xl", "18px"],
  ])("raio %s vale %s — namespace --radius-* do Tailwind v4", (chave, valorEsperado) => {
    const padrao = new RegExp(`${chave}:\\s*${valorEsperado};`);
    expect(globalsCss).toMatch(padrao);
  });

  it("--color-primary aponta para var(--color-acento), não para um hex solto", () => {
    expect(globalsCss).toMatch(/--color-primary:\s*var\(--color-acento\);/);
  });

  // As oito variáveis do namespace próprio do Sidebar do shadcn — o ponto exato onde esta
  // fase falha em silêncio se alguém esquecer (D-08, D-09).
  it.each([
    "--color-sidebar",
    "--color-sidebar-foreground",
    "--color-sidebar-primary",
    "--color-sidebar-primary-foreground",
    "--color-sidebar-accent",
    "--color-sidebar-accent-foreground",
    "--color-sidebar-border",
    "--color-sidebar-ring",
  ])("declara a variável do namespace do Sidebar: %s", (chave) => {
    // Âncora em início de linha (com indentação) e ":" logo depois, para não confundir
    // `--color-sidebar` com `--color-sidebar-foreground` na hora de checar a base isolada.
    const padrao = new RegExp(`^\\s*${chave}:`, "m");
    expect(globalsCss).toMatch(padrao);
  });

  it("declara a escala tipográfica (--font-titulo, --text-display, --text-nav)", () => {
    expect(globalsCss).toMatch(/--font-titulo:/);
    expect(globalsCss).toMatch(/--text-display:\s*28px;/);
    expect(globalsCss).toMatch(/--text-nav:\s*12px;/);
  });
});

import { describe, expect, it } from "vitest";

import { ehItemAtivo, ITENS_NAVEGACAO } from "../../lib/navegacao/itens";

describe("ehItemAtivo", () => {
  it("a raiz casa só por igualdade exata", () => {
    expect(ehItemAtivo("/", "/")).toBe(true);
    expect(ehItemAtivo("/encomendas", "/")).toBe(false);
  });

  it("um href de módulo casa com o próprio caminho e com sub-rotas futuras", () => {
    expect(ehItemAtivo("/encomendas", "/encomendas")).toBe(true);
    expect(ehItemAtivo("/encomendas/42", "/encomendas")).toBe(true);
  });

  it("prefixo de texto solto não basta — exige a barra separadora", () => {
    expect(ehItemAtivo("/encomendasx", "/encomendas")).toBe(false);
  });

  it("caminho vazio nunca casa com nenhum item", () => {
    for (const item of ITENS_NAVEGACAO) {
      expect(ehItemAtivo("", item.href)).toBe(false);
    }
  });

  it("caminho desconhecido não casa com nenhum item", () => {
    for (const item of ITENS_NAVEGACAO) {
      expect(ehItemAtivo("/rota-que-nao-existe", item.href)).toBe(false);
    }
  });

  it("para cada caminho dos 5 itens, exatamente um item fica ativo — a barra nunca acende dois", () => {
    for (const alvo of ITENS_NAVEGACAO) {
      const ativos = ITENS_NAVEGACAO.filter((item) => ehItemAtivo(alvo.href, item.href));
      expect(ativos).toHaveLength(1);
      expect(ativos[0]?.href).toBe(alvo.href);
    }
  });
});

describe("ITENS_NAVEGACAO", () => {
  it("tem exatamente 5 itens, nesta ordem", () => {
    expect(ITENS_NAVEGACAO).toHaveLength(5);
    expect(ITENS_NAVEGACAO.map((item) => item.rotulo)).toEqual([
      "Início",
      "Encomendas",
      "Agenda",
      "Queimas",
      "Estoque",
    ]);
  });

  it("nenhum item leva a /orcamentos — Orçamentos é item do menu do usuário, não da navegação principal (UI-04)", () => {
    expect(ITENS_NAVEGACAO.some((item) => item.href === "/orcamentos")).toBe(false);
  });
});

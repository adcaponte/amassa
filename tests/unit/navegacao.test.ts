import { describe, expect, it } from "vitest";

import {
  ehItemAtivo,
  ITENS_NAVEGACAO_CELULAR,
  ITENS_NAVEGACAO_LATERAL,
} from "../../lib/navegacao/itens";

// As duas listas divergem desde a Fase 04.4 (D-04/D-05) — todo teste abaixo que antes rodava
// sobre a lista única agora roda sobre as DUAS, separadamente.
const LISTAS = [
  { nome: "celular", lista: ITENS_NAVEGACAO_CELULAR },
  { nome: "lateral", lista: ITENS_NAVEGACAO_LATERAL },
] as const;

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

  for (const { nome, lista } of LISTAS) {
    it(`caminho vazio nunca casa com nenhum item (lista ${nome})`, () => {
      for (const item of lista) {
        expect(ehItemAtivo("", item.href)).toBe(false);
      }
    });

    it(`caminho desconhecido não casa com nenhum item (lista ${nome})`, () => {
      for (const item of lista) {
        expect(ehItemAtivo("/rota-que-nao-existe", item.href)).toBe(false);
      }
    });

    it(`para cada caminho dos itens da lista ${nome}, exatamente um item fica ativo — a barra nunca acende dois`, () => {
      for (const alvo of lista) {
        const ativos = lista.filter((item) => ehItemAtivo(alvo.href, item.href));
        expect(ativos).toHaveLength(1);
        expect(ativos[0]?.href).toBe(alvo.href);
      }
    });
  }
});

describe("ITENS_NAVEGACAO_CELULAR", () => {
  it("tem exatamente 5 itens, nesta ordem — Financeiro no lugar do Estoque (D-04)", () => {
    expect(ITENS_NAVEGACAO_CELULAR).toHaveLength(5);
    expect(ITENS_NAVEGACAO_CELULAR.map((item) => item.rotulo)).toEqual([
      "Início",
      "Encomendas",
      "Financeiro",
      "Agenda",
      "Queimas",
    ]);
  });

  it("não tem Estoque — saiu da barra do celular na Fase 04.4 (D-04)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/estoque")).toBe(false);
  });

  it("nenhum item leva a /orcamentos — Orçamentos é item do menu do usuário, não da navegação principal (UI-04)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/orcamentos")).toBe(false);
  });

  it("nenhum item leva a /cadastros — Cadastros é alcançado pelo Financeiro, não pela navegação principal (D-06)", () => {
    expect(ITENS_NAVEGACAO_CELULAR.some((item) => item.href === "/cadastros")).toBe(false);
  });
});

describe("ITENS_NAVEGACAO_LATERAL", () => {
  it("tem exatamente 6 itens, nesta ordem — ganhou o Financeiro sem perder o Estoque (D-05)", () => {
    expect(ITENS_NAVEGACAO_LATERAL).toHaveLength(6);
    expect(ITENS_NAVEGACAO_LATERAL.map((item) => item.rotulo)).toEqual([
      "Início",
      "Encomendas",
      "Financeiro",
      "Agenda",
      "Queimas",
      "Estoque",
    ]);
  });

  it("nenhum item leva a /orcamentos — Orçamentos é item do menu do usuário, não da navegação principal (UI-04)", () => {
    expect(ITENS_NAVEGACAO_LATERAL.some((item) => item.href === "/orcamentos")).toBe(false);
  });

  it("nenhum item leva a /cadastros — Cadastros é alcançado pelo Financeiro, não pela navegação principal (D-06)", () => {
    expect(ITENS_NAVEGACAO_LATERAL.some((item) => item.href === "/cadastros")).toBe(false);
  });
});

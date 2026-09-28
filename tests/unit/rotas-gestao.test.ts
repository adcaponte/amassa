import { describe, expect, it } from "vitest";

import { ehRotaDeApi, ehRotaDeGestao, rotaDeGestao } from "../../lib/rotas/gestao";

describe("rotaDeGestao", () => {
  it("prefixa a raiz sem duplicar barra", () => {
    expect(rotaDeGestao("/")).toBe("/gestao");
    expect(rotaDeGestao("")).toBe("/gestao");
  });

  it("prefixa um caminho de módulo", () => {
    expect(rotaDeGestao("/financeiro")).toBe("/gestao/financeiro");
  });

  it("prefixa um caminho com segmento dinâmico", () => {
    expect(rotaDeGestao("/encomendas/42")).toBe("/gestao/encomendas/42");
  });
});

describe("ehRotaDeGestao", () => {
  it("reconhece /gestao exato e /gestao/ com barra final", () => {
    expect(ehRotaDeGestao("/gestao")).toBe(true);
    expect(ehRotaDeGestao("/gestao/")).toBe(true);
  });

  it("reconhece uma sub-rota da plataforma", () => {
    expect(ehRotaDeGestao("/gestao/financeiro")).toBe(true);
  });

  it("não confunde um prefixo de texto solto com a plataforma", () => {
    expect(ehRotaDeGestao("/gestaoqualquercoisa")).toBe(false);
  });

  it("não considera caminho vazio uma rota da plataforma", () => {
    expect(ehRotaDeGestao("")).toBe(false);
  });
});

describe("ehRotaDeApi", () => {
  it("reconhece rota de API que ficou fora de /gestao", () => {
    expect(ehRotaDeApi("/api/health")).toBe(true);
  });

  it("reconhece rota de API que se mudou para dentro de /gestao", () => {
    expect(ehRotaDeApi("/gestao/api/orcamentos/x/pdf")).toBe(true);
  });

  it("não confunde página da plataforma com rota de API", () => {
    expect(ehRotaDeApi("/gestao/financeiro")).toBe(false);
  });
});

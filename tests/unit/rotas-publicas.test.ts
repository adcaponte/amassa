import { describe, expect, it } from "vitest";

import { ehRotaPublica } from "../../lib/auth/rotas-publicas";

describe("ehRotaPublica", () => {
  it("considera /gestao/login pública", () => {
    expect(ehRotaPublica("/gestao/login")).toBe(true);
  });

  it("considera qualquer caminho sob /api/health público", () => {
    expect(ehRotaPublica("/api/health")).toBe(true);
    expect(ehRotaPublica("/api/health/backup")).toBe(true);
  });

  it("não considera a raiz pública", () => {
    expect(ehRotaPublica("/")).toBe(false);
  });

  it("não considera /gestao (exato) nem uma rota de módulo públicas", () => {
    expect(ehRotaPublica("/gestao")).toBe(false);
    expect(ehRotaPublica("/gestao/financeiro")).toBe(false);
  });

  it("não considera rotas antigas de produto públicas", () => {
    expect(ehRotaPublica("/encomendas")).toBe(false);
    expect(ehRotaPublica("/agenda")).toBe(false);
  });

  it("não confunde um prefixo parecido com uma rota pública de verdade", () => {
    expect(ehRotaPublica("/gestao/loginzinho")).toBe(false);
    expect(ehRotaPublica("/api/healthcheck")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { ehRotaPublica } from "../../lib/auth/rotas-publicas";

describe("ehRotaPublica", () => {
  it("considera /login pública", () => {
    expect(ehRotaPublica("/login")).toBe(true);
  });

  it("considera qualquer caminho sob /api/health público", () => {
    expect(ehRotaPublica("/api/health")).toBe(true);
    expect(ehRotaPublica("/api/health/backup")).toBe(true);
  });

  it("não considera a raiz pública", () => {
    expect(ehRotaPublica("/")).toBe(false);
  });

  it("não considera rotas de produto públicas", () => {
    expect(ehRotaPublica("/encomendas")).toBe(false);
    expect(ehRotaPublica("/agenda")).toBe(false);
  });

  it("não confunde um prefixo parecido com uma rota pública de verdade", () => {
    expect(ehRotaPublica("/loginzinho")).toBe(false);
    expect(ehRotaPublica("/api/healthcheck")).toBe(false);
  });
});

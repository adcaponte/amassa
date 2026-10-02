import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { linkDoWhatsApp, urlDoSite } from "@/lib/fornecedores/contato";

// Os links da ficha do fornecedor (06.2-03-PLAN.md, Tarefa 1; FRN-05; Pitfalls 9 e 10 da pesquisa).
// Telefones de teste com DDD 00 e sites no domínio reservado `example.com` — o repositório é público.
// As matrizes de borda (empty, encoding) são da Tarefa 2.

describe("linkDoWhatsApp", () => {
  it("11 dígitos com DDD ganham o 55 na frente", () => {
    expect(linkDoWhatsApp("(00) 9 0000-0001")).toBe("https://wa.me/5500900000001");
  });
});

describe("urlDoSite", () => {
  it("sem esquema, vira https", () => {
    expect(urlDoSite("example.com")).toBe("https://example.com/");
  });

  it("javascript: nunca vira link", () => {
    expect(urlDoSite("javascript:alert(1)")).toBeNull();
  });
});

describe("pureza", () => {
  it("lib/fornecedores/contato.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/contato.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

import { describe, expect, it } from "vitest";

import { hrefDoWhatsapp } from "@/lib/site/whatsapp";

// D-17/SIT-06: hrefDoWhatsapp é a única porta para montar um link `wa.me` no site. As quatro
// arestas sondadas: empty (mensagem vazia não gera parâmetro), encoding (acento intacto de
// ponta a ponta), ordering/concurrency colapsadas com encoding (ver 04.6-03-PLAN.md,
// "Reconciliação das arestas sondadas").
describe("lib/site/whatsapp.ts — hrefDoWhatsapp (D-17, SIT-06)", () => {
  it("mensagem vazia não gera parâmetro text nenhum", () => {
    const href = hrefDoWhatsapp("5562900000000", "");
    expect(href).toBe("https://wa.me/5562900000000");
    expect(href).not.toContain("?text=");
  });

  it("mensagem só com espaço também não gera parâmetro text", () => {
    const href = hrefDoWhatsapp("5562900000000", "   ");
    expect(href).toBe("https://wa.me/5562900000000");
  });

  it("a mensagem viaja com acento intacto — text decodificado é igual ao original", () => {
    const mensagemOriginal = "Oi! Quero pedir um orçamento de peças.";
    const href = hrefDoWhatsapp("5562900000000", mensagemOriginal);

    expect(href.startsWith("https://wa.me/5562900000000?text=")).toBe(true);

    const url = new URL(href);
    expect(url.searchParams.get("text")).toBe(mensagemOriginal);
  });

  it("não concatena a mensagem crua — usa URLSearchParams para escapar", () => {
    const href = hrefDoWhatsapp("5562900000000", "Oi! Vim pelo site do ateliê.");
    // Espaço vira "+" ou "%20" via URLSearchParams, nunca literal no meio da URL.
    expect(href).not.toMatch(/text=[^&]* [^&]*/);
  });

  it("o número recebido é usado como veio, sem transformação — troca de número é editar conteudo/site.ts", () => {
    const href = hrefDoWhatsapp("5511999999999", "teste");
    expect(href.startsWith("https://wa.me/5511999999999")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { CONTEUDO_SITE } from "@/conteudo/site";
import { hrefDoWhatsapp, rotuloTelefoneDoZap } from "@/lib/site/whatsapp";

// O número do site vem da constante (o real, dado pelo dono em 02/10/2026) — nunca escrito aqui.
const ZAP = CONTEUDO_SITE.zap;

// D-17/SIT-06: hrefDoWhatsapp é a única porta para montar um link `wa.me` no site. As quatro
// arestas sondadas: empty (mensagem vazia não gera parâmetro), encoding (acento intacto de
// ponta a ponta), ordering/concurrency colapsadas com encoding (ver 04.6-03-PLAN.md,
// "Reconciliação das arestas sondadas").
describe("lib/site/whatsapp.ts — hrefDoWhatsapp (D-17, SIT-06)", () => {
  it("mensagem vazia não gera parâmetro text nenhum", () => {
    const href = hrefDoWhatsapp(ZAP, "");
    expect(href).toBe(`https://wa.me/${ZAP}`);
    expect(href).not.toContain("?text=");
  });

  it("mensagem só com espaço também não gera parâmetro text", () => {
    const href = hrefDoWhatsapp(ZAP, "   ");
    expect(href).toBe(`https://wa.me/${ZAP}`);
  });

  it("a mensagem viaja com acento intacto — text decodificado é igual ao original", () => {
    const mensagemOriginal = "Oi! Quero pedir um orçamento de peças.";
    const href = hrefDoWhatsapp(ZAP, mensagemOriginal);

    expect(href.startsWith(`https://wa.me/${ZAP}?text=`)).toBe(true);

    const url = new URL(href);
    expect(url.searchParams.get("text")).toBe(mensagemOriginal);
  });

  it("não concatena a mensagem crua — usa URLSearchParams para escapar", () => {
    const href = hrefDoWhatsapp(ZAP, "Oi! Vim pelo site do ateliê.");
    // Espaço vira "+" ou "%20" via URLSearchParams, nunca literal no meio da URL.
    expect(href).not.toMatch(/text=[^&]* [^&]*/);
  });

  it("o número recebido é usado como veio, sem transformação — troca de número é editar conteudo/site.ts", () => {
    const href = hrefDoWhatsapp("5511999999999", "teste");
    expect(href.startsWith("https://wa.me/5511999999999")).toBe(true);
  });
});

// D-28 / UI-D19 (Fase 06.5): o telefone exibido é derivado do `zap`. Os casos usam números
// INVENTADOS (repositório público, T-06.5-62) — o do ateliê só é lido da constante, nunca copiado.
describe("lib/site/whatsapp.ts — rotuloTelefoneDoZap (D-28, UI-D19)", () => {
  it('celular com 55 e DDD vira "({DD}) 9 {XXXX}-{XXXX}"', () => {
    expect(rotuloTelefoneDoZap("5511987654321")).toBe("(11) 9 8765-4321");
    expect(rotuloTelefoneDoZap("5521912345678")).toBe("(21) 9 1234-5678");
  });

  it("número de 10 dígitos depois do 55 (fixo, sem o 9) não tem rótulo — o campo não renderiza", () => {
    expect(rotuloTelefoneDoZap("551187654321")).toBe("");
  });

  it("celular de 9 dígitos que não começa por 9 não tem rótulo", () => {
    expect(rotuloTelefoneDoZap("5511887654321")).toBe("");
  });

  it("sem o 55, com letra, com espaço, com sinal, longo demais ou vazio → texto vazio", () => {
    for (const zap of [
      "11987654321",
      "4411987654321",
      "55119876543x1",
      "55 11987654321",
      "+5511987654321",
      "55119876543210",
      "",
    ]) {
      expect(rotuloTelefoneDoZap(zap), `"${zap}" não deveria ter rótulo`).toBe("");
    }
  });

  it("o zap do site (lido da constante) tem rótulo no desenho, com os mesmos dígitos do link", () => {
    const rotulo = rotuloTelefoneDoZap(ZAP);
    expect(rotulo).toMatch(/^\(\d{2}\) 9 \d{4}-\d{4}$/);
    expect(`55${rotulo.replace(/\D/g, "")}`).toBe(ZAP);
    expect(rotulo).not.toContain("0000-0000");
  });
});

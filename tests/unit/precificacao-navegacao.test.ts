import { describe, expect, it } from "vitest";

import { hrefDaAbaPecas } from "../../lib/precificacao/navegacao";

// O módulo nasceu do achado 8 da verificação humana (04.5-14): quatro montagens de URL à mão
// descartavam `?exclusivas=1`, e sem ele o diálogo de confirmação da ficha exclusiva nem chega a
// existir no DOM. O que estes testes travam é justamente o que estava divergindo.
describe("hrefDaAbaPecas", () => {
  it("sem nada, é a aba Peças e mais nada", () => {
    expect(hrefDaAbaPecas()).toBe("/financeiro?aba=pecas");
  });

  it("`exclusivas=1` aparece quando a lista está mostrando as exclusivas", () => {
    expect(hrefDaAbaPecas({ mostrarExclusivas: true })).toBe("/financeiro?aba=pecas&exclusivas=1");
  });

  it("`exclusivas` NUNCA aparece como 0 — a ausência é o padrão da tela", () => {
    expect(hrefDaAbaPecas({ mostrarExclusivas: false })).toBe("/financeiro?aba=pecas");
  });

  it("abrir uma ficha preserva o filtro das exclusivas", () => {
    expect(hrefDaAbaPecas({ peca: "abc", mostrarExclusivas: true })).toBe(
      "/financeiro?aba=pecas&peca=abc&exclusivas=1",
    );
  });

  it("apagar uma ficha preserva o filtro das exclusivas — o caso do achado 8", () => {
    expect(hrefDaAbaPecas({ apagarPeca: "abc", mostrarExclusivas: true })).toBe(
      "/financeiro?aba=pecas&apagarPeca=abc&exclusivas=1",
    );
  });

  it("o aviso vem por último, depois da ficha salva", () => {
    expect(hrefDaAbaPecas({ peca: "abc", aviso: "peca-salva" })).toBe(
      "/financeiro?aba=pecas&peca=abc&aviso=peca-salva",
    );
  });

  it("id vazio ou nulo não vira parâmetro vazio na URL", () => {
    expect(hrefDaAbaPecas({ peca: "", apagarPeca: null, aviso: null })).toBe("/financeiro?aba=pecas");
  });

  it("um id com caractere especial é escapado, nunca concatenado cru", () => {
    expect(hrefDaAbaPecas({ apagarPeca: "a&b=c" })).toBe("/financeiro?aba=pecas&apagarPeca=a%26b%3Dc");
  });
});

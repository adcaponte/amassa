import { describe, expect, it } from "vitest";

import { hrefDoCaixa } from "../../lib/financeiro/navegacao";

// D-06: "Paguei"/"Recebi" levam ao Caixa, na parcela específica — nunca pagam dali. O molde é
// `lib/precificacao/navegacao.ts` (tests/unit/precificacao-navegacao.test.ts).
describe("hrefDoCaixa", () => {
  it("sem nada, é a aba Caixa e mais nada", () => {
    expect(hrefDoCaixa()).toBe("/gestao/financeiro?aba=caixa");
  });

  it("também sem nada quando chamado sem argumento nenhum", () => {
    expect(hrefDoCaixa({})).toBe("/gestao/financeiro?aba=caixa");
  });

  it("`parcelaFoco` aparece quando a linha precisa ser destacada", () => {
    expect(hrefDoCaixa({ parcelaFoco: "abc-123" })).toBe(
      "/gestao/financeiro?aba=caixa&parcelaFoco=abc-123",
    );
  });

  it("`parcelaFoco` nulo não vira parâmetro vazio na URL", () => {
    expect(hrefDoCaixa({ parcelaFoco: null })).toBe("/gestao/financeiro?aba=caixa");
  });

  it("`parcelaFoco` string vazia também não vira parâmetro", () => {
    expect(hrefDoCaixa({ parcelaFoco: "" })).toBe("/gestao/financeiro?aba=caixa");
  });

  it("um id com caractere especial é escapado, nunca concatenado cru", () => {
    expect(hrefDoCaixa({ parcelaFoco: "a&b=c" })).toBe(
      "/gestao/financeiro?aba=caixa&parcelaFoco=a%26b%3Dc",
    );
  });
});

import { describe, expect, it } from "vitest";

import { hrefDoCaixa, hrefDoOrcamento } from "../../lib/financeiro/navegacao";
import { PREFIXO_GESTAO } from "../../lib/rotas/gestao";

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

// CR-01 (revisão da Fase 04.6): o editor do orçamento era montado à mão em 25 pontos, todos no
// endereço antigo da raiz. A porta única garante o prefixo e a ordem dos parâmetros.
describe("hrefDoOrcamento", () => {
  it("é a aba Orçamentos com o orçamento, sob o prefixo da plataforma", () => {
    expect(hrefDoOrcamento("orc-1")).toBe(
      `${PREFIXO_GESTAO}/financeiro?aba=orcamentos&orcamento=orc-1`,
    );
  });

  it("os extras entram depois, na ordem dada", () => {
    expect(hrefDoOrcamento("orc-1", { aviso: "orcamento-aprovado" })).toBe(
      `${PREFIXO_GESTAO}/financeiro?aba=orcamentos&orcamento=orc-1&aviso=orcamento-aprovado`,
    );
    expect(hrefDoOrcamento("orc-1", { peca: "novo", aviso: "x" })).toBe(
      `${PREFIXO_GESTAO}/financeiro?aba=orcamentos&orcamento=orc-1&peca=novo&aviso=x`,
    );
  });

  it("um id com caractere especial é escapado, nunca concatenado cru", () => {
    expect(hrefDoOrcamento("a&b=c")).toBe(
      `${PREFIXO_GESTAO}/financeiro?aba=orcamentos&orcamento=a%26b%3Dc`,
    );
  });
});

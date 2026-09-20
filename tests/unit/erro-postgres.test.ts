import { describe, expect, it } from "vitest";

import { codigoDoErroPostgres, ehViolacaoDeChaveEstrangeira } from "../../lib/erro/postgres";

describe("lib/erro/postgres — codigoDoErroPostgres", () => {
  it("erro cru do pg, com 'code' de tipo string no próprio objeto, devolve esse código", () => {
    expect(codigoDoErroPostgres({ code: "23503" })).toBe("23503");
  });

  it("erro EMBRULHADO no formato real de produção — code da raiz undefined, cause.code presente — devolve o código da causa", () => {
    // Este é o caso que hoje falha em produção: se algum outro cenário passar e este não, a
    // correção não aconteceu.
    const erroEmbrulhado = { code: undefined, cause: { code: "23503" } };
    expect(codigoDoErroPostgres(erroEmbrulhado)).toBe("23503");
  });

  it("erro embrulhado sem a propriedade 'code' de jeito nenhum, só cause.code, devolve o código da causa", () => {
    const erroEmbrulhado = { cause: { code: "23503" } };
    expect(codigoDoErroPostgres(erroEmbrulhado)).toBe("23503");
  });

  it.each([["23503"], [null], [undefined], [23503]])(
    "não-objeto (%p) devolve undefined",
    (valor) => {
      expect(codigoDoErroPostgres(valor)).toBeUndefined();
    },
  );

  it("objeto vazio devolve undefined", () => {
    expect(codigoDoErroPostgres({})).toBeUndefined();
  });

  it("um Error comum, sem code nem cause, devolve undefined", () => {
    expect(codigoDoErroPostgres(new Error("falha qualquer"))).toBeUndefined();
  });

  it("propriedade 'code' de tipo não-string no objeto raiz, sem cause, devolve undefined (nunca o número convertido em texto)", () => {
    expect(codigoDoErroPostgres({ code: 23503 })).toBeUndefined();
  });

  it("cause presente mas não é objeto (string) devolve undefined", () => {
    expect(codigoDoErroPostgres({ code: undefined, cause: "não é objeto" })).toBeUndefined();
  });

  it("cause presente mas não é objeto (null) devolve undefined", () => {
    expect(codigoDoErroPostgres({ code: undefined, cause: null })).toBeUndefined();
  });

  it("cause é objeto com 'code' de tipo não-string (número) devolve undefined", () => {
    expect(codigoDoErroPostgres({ code: undefined, cause: { code: 23503 } })).toBeUndefined();
  });
});

describe("lib/erro/postgres — ehViolacaoDeChaveEstrangeira", () => {
  it("true para '23503' solto na raiz", () => {
    expect(ehViolacaoDeChaveEstrangeira({ code: "23503" })).toBe(true);
  });

  it("true para '23503' embrulhado em cause", () => {
    expect(ehViolacaoDeChaveEstrangeira({ code: undefined, cause: { code: "23503" } })).toBe(true);
  });

  it.each(["23505", "P0001", "23514"])("false para %s (não é chave estrangeira)", (codigo) => {
    expect(ehViolacaoDeChaveEstrangeira({ code: codigo })).toBe(false);
  });

  it.each([[undefined], [null], [{}]])("false para %p", (valor) => {
    expect(ehViolacaoDeChaveEstrangeira(valor)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { interpretarSaudeDoBanco } from "../../lib/saude";

describe("interpretarSaudeDoBanco", () => {
  it("devolve status ok quando a consulta funcionou", () => {
    expect(interpretarSaudeDoBanco(true)).toEqual({
      status: "ok",
      banco: "ok",
      http: 200,
    });
  });

  it("devolve status erro quando a consulta falhou", () => {
    expect(interpretarSaudeDoBanco(false)).toEqual({
      status: "erro",
      banco: "erro",
      http: 503,
    });
  });
});

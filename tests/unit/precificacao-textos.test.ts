import { describe, expect, it } from "vitest";

import { fraseNoForno } from "@/lib/precificacao/textos";

// Achado da verificação do Cowork em produção (27/09/2026): a ficha da peça escrevia
// "1 níveis" quando a peça alta só cabe num nível. O resto do projeto concorda o plural
// (`textoAvisoDeEstimados` usa "(s)"; a frase da recusa por uso conta orçamentos no singular),
// e esta era a única que não.
describe("fraseNoForno", () => {
  const BASE = {
    esmalte: 6,
    biscoito: 10,
    porPrateleira: 6,
    origemEsmalte: "calculado" as const,
    origemBiscoito: "calculado" as const,
  };

  it("um nível só sai no singular", () => {
    const frase = fraseNoForno({ ...BASE, esmalte: 6, porPrateleira: 6, niveis: 1 });

    expect(frase).toContain("1 nível");
    expect(frase).not.toContain("1 níveis");
  });

  it("mais de um nível continua no plural", () => {
    const frase = fraseNoForno({ ...BASE, niveis: 3 });

    expect(frase).toContain("3 níveis");
  });

  it("zero nível usa o plural, como manda o português", () => {
    const frase = fraseNoForno({ ...BASE, esmalte: 0, porPrateleira: 6, niveis: 0 });

    expect(frase).toContain("0 níveis");
  });

  it("quando a contagem foi informada à mão, o parêntese não fala de níveis", () => {
    const frase = fraseNoForno({ ...BASE, niveis: 1, origemEsmalte: "informado" });

    expect(frase).toContain("contado por você");
    expect(frase).not.toContain("nível");
    expect(frase).not.toContain("níveis");
  });
});

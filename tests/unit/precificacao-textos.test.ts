import { describe, expect, it } from "vitest";

import { fraseFichaNaProducaoDaCasa, fraseNoForno } from "@/lib/precificacao/textos";

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

// Revisão 06.1, WR-01 — o dono escolheu (a) na Parte 0 (30/09/2026): marcar "exclusiva" uma ficha
// que uma ordem da produção da casa ainda aberta usa é recusado, dizendo qual ordem e o que fazer.
describe("fraseFichaNaProducaoDaCasa", () => {
  it("uma ordem: diz o nome e manda concluir ou cancelar", () => {
    expect(fraseFichaNaProducaoDaCasa(["[teste] Reposição de canecas"])).toBe(
      "A ficha está na produção da casa “[teste] Reposição de canecas”. Conclua ou cancele a ordem na Produção antes de torná-la exclusiva. Nada foi gravado.",
    );
  });

  it("duas ordens: as duas pelo nome", () => {
    expect(fraseFichaNaProducaoDaCasa(["[teste] A", "[teste] B"])).toBe(
      "A ficha está em 2 ordens da produção da casa ainda abertas (“[teste] A” e “[teste] B”). Conclua ou cancele essas ordens na Produção antes de torná-la exclusiva. Nada foi gravado.",
    );
  });

  it("mais de duas: as duas primeiras pelo nome e quantas mais", () => {
    expect(fraseFichaNaProducaoDaCasa(["[teste] A", "[teste] B", "[teste] C", "[teste] D"])).toBe(
      "A ficha está em 4 ordens da produção da casa ainda abertas (“[teste] A”, “[teste] B” e mais 2). Conclua ou cancele essas ordens na Produção antes de torná-la exclusiva. Nada foi gravado.",
    );
  });
});

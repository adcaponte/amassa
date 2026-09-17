import { describe, expect, it } from "vitest";

import { ordenarCotacoes, type CotacaoParaOrdenar } from "../../lib/cotacoes/ordenacao";

// Tarefa 2 (04.3-01-PLAN.md, D-11): o contrato de `lib/cotacoes/ordenacao.ts` — ausência de
// preço nunca é um preço baixo nem um preço alto, ela é sempre a ÚLTIMA, nos dois sentidos.
// `criadoEm` entra como TEXTO (nunca uma instância de `Date`), na ordem em que a lista chega do
// servidor — o desempate é sempre por essa ordem de cadastro, para a lista nunca dançar entre
// dois renders.

function cotacao(id: string, precoCentavos: number | null, criadoEm: string): CotacaoParaOrdenar {
  return { id, precoCentavos, criadoEm };
}

const A = cotacao("a", 1000, "2026-01-01T00:00:00.000Z");
const B = cotacao("b", 500, "2026-01-02T00:00:00.000Z");
const C_SEM_PRECO = cotacao("c", null, "2026-01-03T00:00:00.000Z");
const D = cotacao("d", 2000, "2026-01-04T00:00:00.000Z");

describe("ordenarCotacoes — ordem de cadastro", () => {
  it("devolve a lista na ordem de criação, nunca reordenada por preço", () => {
    const lista = [D, A, C_SEM_PRECO, B];
    expect(ordenarCotacoes(lista, "cadastro").map((c) => c.id)).toEqual(["d", "a", "c", "b"]);
  });
});

describe("ordenarCotacoes — do menor para o maior", () => {
  it("preços em ordem crescente e as SEM PREÇO no fim", () => {
    const lista = [D, C_SEM_PRECO, A, B];
    expect(ordenarCotacoes(lista, "crescente").map((c) => c.id)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("ordenarCotacoes — do maior para o menor", () => {
  it("preços em ordem decrescente e as SEM PREÇO no fim TAMBÉM — não no começo", () => {
    const lista = [C_SEM_PRECO, A, B, D];
    expect(ordenarCotacoes(lista, "decrescente").map((c) => c.id)).toEqual(["d", "a", "b", "c"]);
  });
});

describe("ordenarCotacoes — lista só de cotações sem preço", () => {
  it("fica na ordem de cadastro nos três modos", () => {
    const semA = cotacao("x", null, "2026-01-01T00:00:00.000Z");
    const semB = cotacao("y", null, "2026-01-02T00:00:00.000Z");
    const lista = [semA, semB];

    expect(ordenarCotacoes(lista, "cadastro").map((c) => c.id)).toEqual(["x", "y"]);
    expect(ordenarCotacoes(lista, "crescente").map((c) => c.id)).toEqual(["x", "y"]);
    expect(ordenarCotacoes(lista, "decrescente").map((c) => c.id)).toEqual(["x", "y"]);
  });
});

describe("ordenarCotacoes — empate de preço", () => {
  it("desempata pela ordem de cadastro, de forma estável", () => {
    const primeira = cotacao("primeira", 1000, "2026-01-01T00:00:00.000Z");
    const segunda = cotacao("segunda", 1000, "2026-01-02T00:00:00.000Z");
    const lista = [segunda, primeira];

    expect(ordenarCotacoes(lista, "crescente").map((c) => c.id)).toEqual(["segunda", "primeira"]);
    expect(ordenarCotacoes(lista, "decrescente").map((c) => c.id)).toEqual(["segunda", "primeira"]);
  });
});

describe("ordenarCotacoes — não muta a lista recebida", () => {
  it("a lista original continua na ordem original depois da chamada", () => {
    const lista = [D, A, C_SEM_PRECO, B];
    const copiaDosIds = lista.map((c) => c.id);

    ordenarCotacoes(lista, "crescente");
    ordenarCotacoes(lista, "decrescente");

    expect(lista.map((c) => c.id)).toEqual(copiaDosIds);
  });
});

describe("ordenarCotacoes — lista vazia", () => {
  it("devolve lista vazia nos três modos", () => {
    expect(ordenarCotacoes([], "cadastro")).toEqual([]);
    expect(ordenarCotacoes([], "crescente")).toEqual([]);
    expect(ordenarCotacoes([], "decrescente")).toEqual([]);
  });
});

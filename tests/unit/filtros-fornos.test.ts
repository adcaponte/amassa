import { describe, expect, it } from "vitest";

import { limiarDeAtencao } from "../../lib/queimas/contador";
import {
  filtrarPorAtivo,
  ordenarParaBanner,
  type FornoDeIndiceFiltravel,
  type FornoParaBanner,
} from "../../lib/queimas/filtros";
import { fraseDoBanner, prefixoDoBanner } from "../../lib/queimas/textos";

// Fixture mínima, sobrescrita campo a campo por teste — mesma técnica de
// `tests/unit/filtros-encomendas.test.ts`.
function forno(sobrescritas: Partial<FornoParaBanner> = {}): FornoParaBanner {
  return {
    nome: "Forno de teste",
    ativo: true,
    nivel: "atencao",
    contador: 50,
    ...sobrescritas,
  };
}

describe("filtrarPorAtivo", () => {
  const ativo: FornoDeIndiceFiltravel & { nome: string } = { nome: "Ativo", ativo: true };
  const inativo: FornoDeIndiceFiltravel & { nome: string } = { nome: "Inativo", ativo: false };

  it('"ativos" mantém só os fornos com ativo=true', () => {
    expect(filtrarPorAtivo([ativo, inativo], "ativos")).toEqual([ativo]);
  });

  it('"desativados" mantém só os fornos com ativo=false', () => {
    expect(filtrarPorAtivo([ativo, inativo], "desativados")).toEqual([inativo]);
  });

  it('"todos" devolve a lista inteira, na MESMA ordem', () => {
    expect(filtrarPorAtivo([ativo, inativo], "todos")).toEqual([ativo, inativo]);
  });

  it("lista vazia devolve lista vazia, nos três filtros", () => {
    expect(filtrarPorAtivo([], "ativos")).toEqual([]);
    expect(filtrarPorAtivo([], "desativados")).toEqual([]);
    expect(filtrarPorAtivo([], "todos")).toEqual([]);
  });

  it("nunca reordena — só remove itens da mesma lista já ordenada", () => {
    const tres = [
      { nome: "Ábaco", ativo: true },
      { nome: "Meio", ativo: false },
      { nome: "Zebra", ativo: true },
    ];
    expect(filtrarPorAtivo(tres, "ativos").map((f) => f.nome)).toEqual(["Ábaco", "Zebra"]);
  });
});

describe("ordenarParaBanner", () => {
  it("inclui um forno com contador exatamente no limiar de atenção (a fronteira é `>=`)", () => {
    const limite = 100;
    const atencao = limiarDeAtencao(limite); // 90 — no limiar, `medirForno` já classifica "atencao"
    const noLimiar = forno({ nome: "No limiar", nivel: "atencao", contador: atencao });

    expect(ordenarParaBanner([noLimiar]).map((f) => f.nome)).toEqual(["No limiar"]);
  });

  it("exclui um forno com contador um a menos que o limiar (nível ok, não entra no banner)", () => {
    const abaixoDoLimiar = forno({ nome: "Abaixo do limiar", nivel: "ok", contador: 89 });

    expect(ordenarParaBanner([abaixoDoLimiar])).toEqual([]);
  });

  it("lista os críticos ANTES dos em atenção, independente da ordem de entrada", () => {
    const emAtencao = forno({ nome: "Em atenção", nivel: "atencao", contador: 95 });
    const critico = forno({ nome: "Crítico", nivel: "critico", contador: 100 });

    expect(ordenarParaBanner([emAtencao, critico]).map((f) => f.nome)).toEqual([
      "Crítico",
      "Em atenção",
    ]);
  });

  it("dentro do mesmo nível, ordena por contador decrescente", () => {
    const menor = forno({ nome: "Menor contador", nivel: "critico", contador: 100 });
    const maior = forno({ nome: "Maior contador", nivel: "critico", contador: 130 });

    expect(ordenarParaBanner([menor, maior]).map((f) => f.nome)).toEqual([
      "Maior contador",
      "Menor contador",
    ]);
  });

  it("empate de nível e contador desempata por nome (localeCompare pt-BR)", () => {
    const zebra = forno({ nome: "Zebra", nivel: "atencao", contador: 95 });
    const abaco = forno({ nome: "Ábaco", nivel: "atencao", contador: 95 });

    expect(ordenarParaBanner([zebra, abaco]).map((f) => f.nome)).toEqual(["Ábaco", "Zebra"]);
  });

  it("exclui fornos desativados, mesmo em nível crítico", () => {
    const desativado = forno({ nome: "Desativado", nivel: "critico", contador: 999, ativo: false });

    expect(ordenarParaBanner([desativado])).toEqual([]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(ordenarParaBanner([])).toEqual([]);
  });

  it("nível ok nunca entra no banner", () => {
    const ok = forno({ nome: "Tranquilo", nivel: "ok", contador: 10 });
    expect(ordenarParaBanner([ok])).toEqual([]);
  });
});

describe("prefixoDoBanner", () => {
  it("N=1: singular", () => {
    expect(prefixoDoBanner(1)).toBe("1 forno precisa de atenção:");
  });

  it("N=2: plural", () => {
    expect(prefixoDoBanner(2)).toBe("2 fornos precisam de atenção:");
  });
});

describe("fraseDoBanner", () => {
  it("N=1: singular, um único forno", () => {
    expect(fraseDoBanner([{ nome: "Forno 01", contador: 95, limite: 100 }])).toBe(
      "1 forno precisa de atenção: Forno 01 (95/100)",
    );
  });

  it("N=2: plural, lista completa, literal de 04-DESIGN-SYSTEM.md §8", () => {
    expect(
      fraseDoBanner([
        { nome: "Forno 01", contador: 95, limite: 100 },
        { nome: "Forno 02", contador: 103, limite: 100 },
      ]),
    ).toBe("2 fornos precisam de atenção: Forno 01 (95/100) · Forno 02 (103/100)");
  });

  it("N=3: lista completa, sem sufixo 'e mais'", () => {
    const resultado = fraseDoBanner([
      { nome: "Forno 01", contador: 91, limite: 100 },
      { nome: "Forno 02", contador: 92, limite: 100 },
      { nome: "Forno 03", contador: 93, limite: 100 },
    ]);
    expect(resultado).toBe(
      "3 fornos precisam de atenção: Forno 01 (91/100) · Forno 02 (92/100) · Forno 03 (93/100)",
    );
    expect(resultado).not.toMatch(/e mais/);
  });

  it("N=5: mostra os 3 primeiros e trunca com 'e mais 2'", () => {
    const resultado = fraseDoBanner([
      { nome: "Forno 01", contador: 91, limite: 100 },
      { nome: "Forno 02", contador: 92, limite: 100 },
      { nome: "Forno 03", contador: 93, limite: 100 },
      { nome: "Forno 04", contador: 94, limite: 100 },
      { nome: "Forno 05", contador: 95, limite: 100 },
    ]);
    expect(resultado).toBe(
      "5 fornos precisam de atenção: Forno 01 (91/100) · Forno 02 (92/100) · Forno 03 (93/100) · e mais 2",
    );
  });

  it("N=0: lista vazia devolve o prefixo plural sem nenhum item (o componente decide não renderizar)", () => {
    expect(fraseDoBanner([])).toBe("0 fornos precisam de atenção: ");
  });
});

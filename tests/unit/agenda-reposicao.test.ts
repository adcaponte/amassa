import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { creditosDeReposicao } from "@/lib/agenda/reposicao";

// AGE-09: o crédito de reposição é uma CONTA sobre as linhas (faltas com direito − reposições usadas,
// as duas lidas de `inscricoes` em datas não canceladas) — nunca um contador gravado à parte
// (Pattern 3 da pesquisa; BRIEFING §4 "guardar os dois lados").
describe("creditosDeReposicao", () => {
  it("2 faltas com direito e 1 reposição usada: saldo 1", () => {
    expect(creditosDeReposicao({ faltasComDireito: 2, reposicoesUsadas: 1 })).toEqual({
      comDireito: 2,
      usadas: 1,
      saldo: 1,
      excedido: false,
    });
  });

  it("nada dos dois lados: saldo 0", () => {
    expect(creditosDeReposicao({ faltasComDireito: 0, reposicoesUsadas: 0 })).toEqual({
      comDireito: 0,
      usadas: 0,
      saldo: 0,
      excedido: false,
    });
  });

  it("tudo usado: saldo 0, sem exceder", () => {
    expect(creditosDeReposicao({ faltasComDireito: 3, reposicoesUsadas: 3 })).toMatchObject({
      saldo: 0,
      excedido: false,
    });
  });

  it("usadas além das faltas com direito: saldo 0 (nunca negativo) e o caso é sinalizado", () => {
    expect(creditosDeReposicao({ faltasComDireito: 1, reposicoesUsadas: 3 })).toEqual({
      comDireito: 1,
      usadas: 3,
      saldo: 0,
      excedido: true,
    });
  });

  it("devolve os dois lados como vieram — a tela pode mostrar os dois", () => {
    const creditos = creditosDeReposicao({ faltasComDireito: 7, reposicoesUsadas: 2 });
    expect(creditos.comDireito).toBe(7);
    expect(creditos.usadas).toBe(2);
    expect(creditos.saldo).toBe(5);
    expect(Number.isInteger(creditos.saldo)).toBe(true);
  });

  it("recusa contagem negativa, fracionária ou NaN — é erro de dado, nunca um saldo corrigido", () => {
    expect(() => creditosDeReposicao({ faltasComDireito: -1, reposicoesUsadas: 0 })).toThrow(RangeError);
    expect(() => creditosDeReposicao({ faltasComDireito: 1.5, reposicoesUsadas: 0 })).toThrow(RangeError);
    expect(() => creditosDeReposicao({ faltasComDireito: 1, reposicoesUsadas: Number.NaN })).toThrow(RangeError);
    expect(() => creditosDeReposicao({ faltasComDireito: 1, reposicoesUsadas: -2 })).toThrow(RangeError);
  });
});

describe("pureza", () => {
  it("lib/agenda/reposicao.ts não importa nada e não lê o relógio", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/reposicao.ts"), "utf8");
    expect(fonte).not.toMatch(/^import /m);
    expect(fonte).not.toMatch(/new Date|Date\.now/);
  });
});

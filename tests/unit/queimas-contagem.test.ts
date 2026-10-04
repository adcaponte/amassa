import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHAVES_DOS_CONTADORES,
  CONTAGEM_VAZIA,
  QUANTIDADES_ZERADAS,
  TETO_DO_CONTADOR,
  abaixoDoLancado,
  cabeNoQueFalta,
  contagemVazia,
  diaMes,
  externasDaContagem,
  faltaCobrar,
  lancadoAtivo,
  limitarContador,
  totalDaContagem,
  totalDasExternas,
  totalDasInternas,
  totalDasQuantidades,
  type Contagem,
  type VendaLigada,
} from "@/lib/queimas/contagem";

const CONTAGEM: Contagem = {
  internasP: 3,
  internasM: 1,
  internasG: 0,
  externasP: 2,
  externasM: 4,
  externasG: 1,
  saiuCheio: false,
};

function venda(
  numero: number,
  cancelada: boolean,
  quantidades: { p: number; m: number; g: number },
): VendaLigada {
  return { documentoId: `doc-${numero}`, numero, cancelada, paga: false, quantidades };
}

describe("contagem — regras puras (Fase 06.4)", () => {
  it("CONTAGEM_VAZIA tem os seis contadores em 0 e “saiu cheio” marcado por padrão", () => {
    expect(totalDaContagem(CONTAGEM_VAZIA)).toBe(0);
    expect(contagemVazia(CONTAGEM_VAZIA)).toBe(true);
    expect(CONTAGEM_VAZIA.saiuCheio).toBe(true);
  });

  it("totais: soma as seis, só as internas, só as externas", () => {
    expect(totalDaContagem(CONTAGEM)).toBe(11);
    expect(totalDasInternas(CONTAGEM)).toBe(4);
    expect(totalDasExternas(CONTAGEM)).toBe(7);
    expect(contagemVazia(CONTAGEM)).toBe(false);
  });

  it("CHAVES_DOS_CONTADORES está na ordem da folha e TETO_DO_CONTADOR é 10000", () => {
    expect(CHAVES_DOS_CONTADORES).toEqual([
      "internasP",
      "internasM",
      "internasG",
      "externasP",
      "externasM",
      "externasG",
    ]);
    expect(TETO_DO_CONTADOR).toBe(10000);
  });

  it("limitarContador: NaN → 0; −5 → 0; 10001 → 10000; 7,9 → 7", () => {
    expect(limitarContador(Number.NaN)).toBe(0);
    expect(limitarContador(-5)).toBe(0);
    expect(limitarContador(10001)).toBe(10000);
    expect(limitarContador(7.9)).toBe(7);
    expect(limitarContador(10000)).toBe(10000);
    expect(limitarContador(0)).toBe(0);
  });

  it('diaMes("2026-12-18") → "18/12"', () => {
    expect(diaMes("2026-12-18")).toBe("18/12");
    expect(diaMes("2026-01-05")).toBe("05/01");
  });
});

describe("D-07 — várias vendas por queima (regras puras)", () => {
  it("lancadoAtivo soma só as vendas não canceladas", () => {
    const vendas = [
      venda(12, false, { p: 2, m: 0, g: 1 }),
      venda(13, true, { p: 5, m: 5, g: 5 }),
      venda(15, false, { p: 1, m: 1, g: 0 }),
    ];
    expect(lancadoAtivo(vendas)).toEqual({ p: 3, m: 1, g: 1 });
  });

  it("lancadoAtivo de lista vazia → zeros", () => {
    expect(lancadoAtivo([])).toEqual({ p: 0, m: 0, g: 0 });
    expect(QUANTIDADES_ZERADAS).toEqual({ p: 0, m: 0, g: 0 });
  });

  it("faltaCobrar: externas − lançado, por tamanho, nunca negativo", () => {
    expect(faltaCobrar({ p: 3, m: 2, g: 1 }, { p: 3, m: 1, g: 0 })).toEqual({ p: 0, m: 1, g: 1 });
    expect(faltaCobrar({ p: 1, m: 0, g: 0 }, { p: 4, m: 2, g: 0 })).toEqual({ p: 0, m: 0, g: 0 });
  });

  it("cabeNoQueFalta: cada tamanho do pedido ≤ o que falta", () => {
    expect(cabeNoQueFalta({ p: 1, m: 0, g: 0 }, { p: 1, m: 0, g: 0 })).toBe(true);
    expect(cabeNoQueFalta({ p: 2, m: 0, g: 0 }, { p: 1, m: 5, g: 5 })).toBe(false);
  });

  it("abaixoDoLancado: igual pode; abaixo devolve o primeiro tamanho na ordem P, M, G; subir nunca recusa", () => {
    expect(abaixoDoLancado({ p: 2, m: 1, g: 0 }, { p: 2, m: 1, g: 0 })).toBeNull();
    expect(abaixoDoLancado({ p: 1, m: 0, g: 0 }, { p: 2, m: 1, g: 0 })).toBe("P");
    expect(abaixoDoLancado({ p: 2, m: 0, g: 0 }, { p: 2, m: 1, g: 3 })).toBe("M");
    expect(abaixoDoLancado({ p: 9, m: 9, g: 9 }, { p: 2, m: 1, g: 0 })).toBeNull();
  });

  it("externasDaContagem devolve as três externas; totalDasQuantidades soma as três", () => {
    expect(externasDaContagem(CONTAGEM)).toEqual({ p: 2, m: 4, g: 1 });
    expect(totalDasQuantidades({ p: 2, m: 4, g: 1 })).toBe(7);
  });
});

describe("pureza de lib/queimas/contagem.ts", () => {
  it("não tem nenhuma linha de import (nem de tipo)", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/queimas/contagem.ts"), "utf8");
    const linhasDeImport = fonte.split(/\r?\n/).filter((linha) => /^\s*import\b/.test(linha));
    expect(linhasDeImport).toEqual([]);
  });
});

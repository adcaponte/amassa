import { describe, expect, it } from "vitest";

import {
  converterPercentualParaPontosBase,
  converterQuantidade,
  converterReaisParaCentavos,
} from "@/lib/financeiro/dinheiro";

// Um caso por fato, o nome do caso diz o fato — mesmo estilo de
// `tests/unit/cotacoes-preco.test.ts`/`tests/unit/abertura-parcelas.test.ts`.
describe("converterReaisParaCentavos", () => {
  it.each([
    ["150", 15000],
    ["150,5", 15050],
    ["150,50", 15050],
    ["1.234,56", 123456],
    ["R$ 24.900", 2490000],
    ["24.900,00", 2490000],
    ["R$ 24.900,00", 2490000],
    ["8.50", 850],
    ["8.5", 850],
    ["1.500", 150000],
    ["0", 0],
  ])('"%s" vira %i centavos', (texto, esperado) => {
    const resultado = converterReaisParaCentavos(texto);
    expect(resultado).toEqual({ ok: true, centavos: esperado });
  });

  it('aceita espaço não separável logo depois do "R$"', () => {
    const resultado = converterReaisParaCentavos("R$ 24.900,00");
    expect(resultado).toEqual({ ok: true, centavos: 2490000 });
  });

  it.each(["", "   "])('"%s" vira nulo, nunca zero', (texto) => {
    const resultado = converterReaisParaCentavos(texto);
    expect(resultado).toEqual({ ok: true, centavos: null });
  });

  it('"R$" sozinho vira nulo', () => {
    const resultado = converterReaisParaCentavos("R$");
    expect(resultado).toEqual({ ok: true, centavos: null });
  });

  it('"0" é um valor válido (zero), não nulo', () => {
    const resultado = converterReaisParaCentavos("0");
    expect(resultado).toEqual({ ok: true, centavos: 0 });
    if (resultado.ok) {
      expect(resultado.centavos).not.toBeNull();
    }
  });

  it.each(["abc", "24.900 reais", "-100", "1,2,3", "10,123", "24.90.1"])(
    '"%s" é recusado com frase humana',
    (texto) => {
      const resultado = converterReaisParaCentavos(texto);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.erro.length).toBeGreaterThan(0);
      }
    },
  );

  it('"10.000.000,01" é recusado por passar do teto de dez milhões de reais', () => {
    const resultado = converterReaisParaCentavos("10.000.000,01");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toMatch(/10\.000\.000/);
    }
  });
});

describe("converterPercentualParaPontosBase", () => {
  it.each([
    ["3,5", 350],
    ["3.5", 350],
    ["0", 0],
    ["100", 10000],
  ])('"%s" vira %i pontos-base', (texto, esperado) => {
    expect(converterPercentualParaPontosBase(texto)).toEqual({ ok: true, pontosBase: esperado });
  });

  it.each(["101", "-1", "3,555", "x"])("recusa \"%s\"", (texto) => {
    const resultado = converterPercentualParaPontosBase(texto);
    expect(resultado.ok).toBe(false);
  });
});

describe("converterQuantidade", () => {
  it.each([
    ["0,04", "0.04"],
    ["15", "15"],
    ["2,250", "2.25"],
  ])('"%s" vira "%s"', (texto, esperado) => {
    expect(converterQuantidade(texto)).toEqual({ ok: true, quantidade: esperado });
  });

  it.each(["0", "-1", "1,2345", "1000000"])("recusa \"%s\"", (texto) => {
    const resultado = converterQuantidade(texto);
    expect(resultado.ok).toBe(false);
  });
});

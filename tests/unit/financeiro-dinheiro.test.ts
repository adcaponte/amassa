import { describe, expect, it } from "vitest";

import {
  centavosParaCampo,
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

// A variante que aceita zero é OPÇÃO EXPLÍCITA (06-RESEARCH.md Pitfall 9, D-32): só o saldo
// contado do Estoque a pede — "prateleira vazia" é um contado válido. Sem a opção, nada muda.
describe("converterQuantidade — { aceitaZero: true }", () => {
  it('"0" com a opção é aceito como "0"', () => {
    expect(converterQuantidade("0", { aceitaZero: true })).toEqual({ ok: true, quantidade: "0" });
  });

  it('"0,000" com a opção também vira "0"', () => {
    expect(converterQuantidade("0,000", { aceitaZero: true })).toEqual({
      ok: true,
      quantidade: "0",
    });
  });

  it('"0" sem a opção continua recusado', () => {
    expect(converterQuantidade("0").ok).toBe(false);
    expect(converterQuantidade("0", { aceitaZero: false }).ok).toBe(false);
  });

  it.each(["-1", "1,2345", "1000000", ""])('"%s" continua recusado mesmo com a opção', (texto) => {
    expect(converterQuantidade(texto, { aceitaZero: true }).ok).toBe(false);
  });
});

// 06.5-15 (D-21, P4): a conversão de centavos para o texto de um campo editável, que antes era
// repetida em 13 componentes como `(centavos / 100).toFixed(2).replace(".", ",")`.
describe("centavosParaCampo", () => {
  it.each([
    [9000, "90,00"],
    [5, "0,05"],
    [0, "0,00"],
    [1, "0,01"],
    [99, "0,99"],
    [15001, "150,01"],
    [123456, "1234,56"],
    [1_000_000_000, "10000000,00"],
  ])("%d centavos viram \"%s\" — duas casas, vírgula, sem R$ e sem milhar", (centavos, texto) => {
    expect(centavosParaCampo(centavos)).toBe(texto);
  });

  it("null vira campo vazio, nunca \"0,00\"", () => {
    expect(centavosParaCampo(null)).toBe("");
  });

  // A refatoração não pode mudar nenhum texto: a função comum devolve EXATAMENTE o que a
  // expressão que morava nos componentes devolvia — inclusive para negativo, que nenhum campo
  // deveria receber mas a expressão antiga aceitava.
  it("devolve o mesmo texto que a expressão antiga dos componentes, de -100000 a 100000 e nos valores grandes", () => {
    const expressaoAntiga = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
    const valores: number[] = [];
    for (let n = -100_000; n <= 100_000; n++) valores.push(n);
    valores.push(123_456_789, 999_999_999, 1_000_000_000, -123_456_789);
    for (const n of valores) {
      expect(centavosParaCampo(n)).toBe(expressaoAntiga(n));
    }
  });

  it("ida e volta: converterReaisParaCentavos(centavosParaCampo(n)) devolve n", () => {
    const valores: number[] = [1, 99, 123456, 1_000_000_000, 999_999_999, 123_456_789];
    for (let n = 0; n <= 100_000; n++) valores.push(n);
    for (const n of valores) {
      expect(converterReaisParaCentavos(centavosParaCampo(n))).toEqual({ ok: true, centavos: n });
    }
  });

  it("ida e volta do vazio: null vira \"\" e \"\" volta null", () => {
    expect(converterReaisParaCentavos(centavosParaCampo(null))).toEqual({ ok: true, centavos: null });
  });
});

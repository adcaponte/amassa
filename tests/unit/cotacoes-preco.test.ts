import { describe, expect, it } from "vitest";

import { converterPrecoParaCentavos } from "../../lib/cotacoes/preco";

// Tarefa 2 (04.3-01-PLAN.md): os casos que definem o contrato completo de
// `lib/cotacoes/preco.ts` — as quatro formas de D-08, o campo vazio (D-07), as recusas com frase
// humana e o teto de dez milhões de reais. A Tarefa 1 já cobria as quatro formas básicas e o
// campo vazio (o que o traçado ponta a ponta usa de verdade); este arquivo completa as bordas.

describe("converterPrecoParaCentavos — as quatro formas de D-08", () => {
  it("só dígitos: '24900' → 2490000 centavos", () => {
    const resultado = converterPrecoParaCentavos("24900");
    expect(resultado).toEqual({ ok: true, centavos: 2490000 });
  });

  it("com separador de milhar: '24.900' → 2490000 centavos", () => {
    const resultado = converterPrecoParaCentavos("24.900");
    expect(resultado).toEqual({ ok: true, centavos: 2490000 });
  });

  it("com centavos: '24.900,00' → 2490000 centavos", () => {
    const resultado = converterPrecoParaCentavos("24.900,00");
    expect(resultado).toEqual({ ok: true, centavos: 2490000 });
  });

  it("com o símbolo da moeda na frente: 'R$ 24.900' → 2490000 centavos", () => {
    const resultado = converterPrecoParaCentavos("R$ 24.900");
    expect(resultado).toEqual({ ok: true, centavos: 2490000 });
  });

  it("símbolo da moeda MAIS centavos: 'R$ 24.900,00' → 2490000 centavos", () => {
    const resultado = converterPrecoParaCentavos("R$ 24.900,00");
    expect(resultado).toEqual({ ok: true, centavos: 2490000 });
  });

  it("centavos diferentes de zero: '1.234,56' → 123456 centavos", () => {
    const resultado = converterPrecoParaCentavos("1.234,56");
    expect(resultado).toEqual({ ok: true, centavos: 123456 });
  });

  it("um dígito só de centavos é décimo de real: '10,5' → 1050 centavos", () => {
    const resultado = converterPrecoParaCentavos("10,5");
    expect(resultado).toEqual({ ok: true, centavos: 1050 });
  });

  it("espaço não separável entre o símbolo e o número é aceito, mesmo resultado", () => {
    const comEspacoComum = converterPrecoParaCentavos("R$ 24.900");
    const comEspacoNaoSeparavel = converterPrecoParaCentavos("R$ 24.900");
    expect(comEspacoNaoSeparavel).toEqual(comEspacoComum);
    expect(comEspacoNaoSeparavel).toEqual({ ok: true, centavos: 2490000 });
  });

  it("sete dígitos sem separador nenhum: '1234567' → 123456700 centavos", () => {
    const resultado = converterPrecoParaCentavos("1234567");
    expect(resultado).toEqual({ ok: true, centavos: 123456700 });
  });
});

describe("converterPrecoParaCentavos — campo vazio é sob consulta, nunca zero (D-07)", () => {
  it("texto vazio → nulo", () => {
    expect(converterPrecoParaCentavos("")).toEqual({ ok: true, centavos: null });
  });

  it("texto só com espaço → nulo", () => {
    expect(converterPrecoParaCentavos("   ")).toEqual({ ok: true, centavos: null });
  });

  it("texto só com o símbolo da moeda → nulo", () => {
    expect(converterPrecoParaCentavos("R$")).toEqual({ ok: true, centavos: null });
  });

  it("'0' → 0 centavos, e isso NÃO é a mesma coisa que nulo", () => {
    const zero = converterPrecoParaCentavos("0");
    const vazio = converterPrecoParaCentavos("");
    expect(zero).toEqual({ ok: true, centavos: 0 });
    expect(vazio).toEqual({ ok: true, centavos: null });
    expect(zero).not.toEqual(vazio);
  });
});

describe("converterPrecoParaCentavos — recusas, cada uma com frase humana", () => {
  it("letra no meio: '24.900 reais' é recusado", () => {
    const resultado = converterPrecoParaCentavos("24.900 reais");
    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.erro.length > 0).toBe(true);
  });

  it("sinal negativo: '-100' é recusado", () => {
    const resultado = converterPrecoParaCentavos("-100");
    expect(resultado.ok).toBe(false);
  });

  it("duas vírgulas: '1,2,3' é recusado", () => {
    const resultado = converterPrecoParaCentavos("1,2,3");
    expect(resultado.ok).toBe(false);
  });

  it("três dígitos de centavos: '10,123' é recusado", () => {
    const resultado = converterPrecoParaCentavos("10,123");
    expect(resultado.ok).toBe(false);
  });

  it("grupo de milhar com dois dígitos: '24.90' é recusado", () => {
    const resultado = converterPrecoParaCentavos("24.90");
    expect(resultado.ok).toBe(false);
  });

  it("valor acima do teto de dez milhões de reais é recusado", () => {
    const resultado = converterPrecoParaCentavos("10000001");
    expect(resultado.ok).toBe(false);
  });

  it("cada recusa devolve uma frase humana, nunca uma cadeia vazia", () => {
    const casos = ["24.900 reais", "-100", "1,2,3", "10,123", "24.90", "10000001"];
    for (const caso of casos) {
      const resultado = converterPrecoParaCentavos(caso);
      expect(resultado.ok, `'${caso}' deveria ser recusado`).toBe(false);
      if (!resultado.ok) {
        expect(resultado.erro.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("converterPrecoParaCentavos — determinismo", () => {
  it("a mesma entrada devolve o mesmo resultado em duas chamadas", () => {
    expect(converterPrecoParaCentavos("R$ 24.900,00")).toEqual(
      converterPrecoParaCentavos("R$ 24.900,00"),
    );
    expect(converterPrecoParaCentavos("")).toEqual(converterPrecoParaCentavos(""));
  });
});

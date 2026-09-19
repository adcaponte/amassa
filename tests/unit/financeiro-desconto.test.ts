import { describe, expect, it } from "vitest";

import { repartirDesconto, type Desconto } from "@/lib/financeiro/desconto";

// Gerador determinístico (LCG simples, semente fixa) — nunca `Math.random()`: o mesmo teste
// precisa reproduzir o mesmo caso a cada execução.
function gerador(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
}

describe("repartirDesconto", () => {
  it("[15300] com R$ 3,00 → [15000] (o caso do dono: R$ 153 por R$ 150)", () => {
    const resultado = repartirDesconto([15300], { modo: "reais", centavos: 300 });
    expect(resultado).toEqual({ ok: true, valoresFinais: [15000], descontoTotalCentavos: 300 });
  });

  it("[18000, 15200] (exemplo 6) com R$ 2,00 → soma 33000, cada linha proporcional, sobra na maior", () => {
    const resultado = repartirDesconto([18000, 15200], { modo: "reais", centavos: 200 });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valoresFinais[0] + resultado.valoresFinais[1]).toBe(33000);
    expect(resultado.descontoTotalCentavos).toBe(200);
    // A maior linha (18000) absorve a sobra do arredondamento.
    expect(resultado.valoresFinais[0]).toBe(17891);
    expect(resultado.valoresFinais[1]).toBe(15109);
  });

  it("[1000, 1000, 1000] com R$ 1,00 → dois recebem 33 e a maior (empate: a primeira) recebe 34; total 2900", () => {
    const resultado = repartirDesconto([1000, 1000, 1000], { modo: "reais", centavos: 100 });
    expect(resultado).toEqual({
      ok: true,
      valoresFinais: [966, 967, 967],
      descontoTotalCentavos: 100,
    });
    if (resultado.ok) {
      expect(resultado.valoresFinais.reduce((soma, valor) => soma + valor, 0)).toBe(2900);
    }
  });

  it("percentual: [10000, 5000] com 10% → [9000, 4500]", () => {
    const resultado = repartirDesconto([10000, 5000], { modo: "percentual", pontosBase: 1000 });
    expect(resultado).toEqual({ ok: true, valoresFinais: [9000, 4500], descontoTotalCentavos: 1500 });
  });

  it("percentual que dá meio centavo arredonda para cima no desconto total e o total final é exato", () => {
    // total 15001, 10% = 1500,1 → arredonda para 1500 (meio-para-cima só quando fração é exatamente
    // 0,5); um caso que produz fração 0,5 exata: total 100, 0,5% = 0,5 → 1 (meio-para-cima).
    const resultado = repartirDesconto([100], { modo: "percentual", pontosBase: 50 });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.descontoTotalCentavos).toBe(1);
    expect(resultado.valoresFinais[0]).toBe(99);
  });

  it("desconto zero → subtotais iguais", () => {
    const resultado = repartirDesconto([5000, 3000], { modo: "reais", centavos: 0 });
    expect(resultado).toEqual({ ok: true, valoresFinais: [5000, 3000], descontoTotalCentavos: 0 });
  });

  it("sem linhas e desconto zero → lista vazia", () => {
    const resultado = repartirDesconto([], { modo: "reais", centavos: 0 });
    expect(resultado).toEqual({ ok: true, valoresFinais: [], descontoTotalCentavos: 0 });
  });

  it("desconto igual ao total → todas as linhas zero", () => {
    const resultado = repartirDesconto([4000, 6000], { modo: "reais", centavos: 10000 });
    expect(resultado).toEqual({ ok: true, valoresFinais: [0, 0], descontoTotalCentavos: 10000 });
  });

  it("desconto maior que o total → recusa", () => {
    const resultado = repartirDesconto([1000], { modo: "reais", centavos: 1001 });
    expect(resultado).toEqual({ ok: false, erro: "O desconto é maior que o total." });
  });

  it("[3, 3, 3] com 8 centavos → partes 2,2,2, sobra de 2 na primeira (que ficaria negativa) → recusa", () => {
    const resultado = repartirDesconto([3, 3, 3], { modo: "reais", centavos: 8 });
    expect(resultado).toEqual({
      ok: false,
      erro: "Esse desconto não dá para repartir entre as linhas — diminua o desconto ou tire uma linha.",
    });
  });

  it("percentual acima de 100 → recusa", () => {
    const resultado = repartirDesconto([1000], { modo: "percentual", pontosBase: 10001 });
    expect(resultado).toEqual({
      ok: false,
      erro: "O percentual do desconto precisa estar entre 0 e 100.",
    });
  });

  it("percentual negativo → recusa", () => {
    const resultado = repartirDesconto([1000], { modo: "percentual", pontosBase: -1 });
    expect(resultado).toEqual({
      ok: false,
      erro: "O percentual do desconto precisa estar entre 0 e 100.",
    });
  });

  it("a soma dos valores devolvidos é SEMPRE total − desconto (50 entradas aleatórias determinísticas)", () => {
    const aleatorio = gerador(42);
    for (let caso = 0; caso < 50; caso++) {
      const quantidadeDeLinhas = 1 + Math.floor(aleatorio() * 5);
      // Subtotais de pelo menos R$ 10 (1000 centavos) e desconto no máximo 90% do total: a sobra
      // de arredondamento nunca passa do número de linhas (no máximo 4 aqui), muito menor que a
      // folga de 10% de cada linha — o caso degenerado de recusa (linha que ficaria negativa) já
      // tem teste próprio acima ([3, 3, 3] com 8 centavos) e não é o que esta propriedade prova.
      const subtotais = Array.from(
        { length: quantidadeDeLinhas },
        () => Math.floor(aleatorio() * 99000) + 1000,
      );
      const total = subtotais.reduce((soma, valor) => soma + valor, 0);
      const desconto: Desconto = {
        modo: "reais",
        centavos: Math.floor(aleatorio() * total * 0.9),
      };

      const resultado = repartirDesconto(subtotais, desconto);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        const somaFinal = resultado.valoresFinais.reduce((soma, valor) => soma + valor, 0);
        expect(somaFinal).toBe(total - desconto.centavos);
      }
    }
  });

  it("não muta a lista recebida", () => {
    const subtotais = [1000, 2000];
    const copia = [...subtotais];
    repartirDesconto(subtotais, { modo: "reais", centavos: 300 });
    expect(subtotais).toEqual(copia);
  });
});

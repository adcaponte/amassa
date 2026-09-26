import { describe, expect, it } from "vitest";

import { algoMudou, sugerirPrecos, type LinhaParaAtualizar } from "@/lib/orcamentos/atualizacao";

// 04.5-09-PLAN.md, Tarefa 1 — "a sugestão que preserva a margem" (D-23): `sugerirPrecos` compara
// o mínimo de ANTES (congelado, ou ausente no rascunho) com o mínimo de HOJE e sugere um preço
// que mantém a razão preço ÷ mínimo da época, arredondada. Nenhum dado real de cliente ou preço
// do ateliê entra aqui — só números ilustrativos.

function linha(sobrescritas: Partial<LinhaParaAtualizar>): LinhaParaAtualizar {
  return {
    linhaId: "linha-1",
    nome: "[teste] Caneca lisa",
    precoAtualCentavos: 0,
    minimoDeHojeCentavos: 0,
    minimoCongeladoCentavos: null,
    ...sobrescritas,
  };
}

describe("sugerirPrecos — orçamento CONGELADO", () => {
  it("preço R$ 120,00, mínimo congelado R$ 100,00 (razão 1,2), mínimo de hoje R$ 110,00 → sugestão R$ 135,00 (subiu)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 12000, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 11000 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(13500);
    expect(sugestao.direcao).toBe("subiu");
    expect(sugestao.temRazaoAnterior).toBe(true);
    expect(sugestao.percentualAbsoluto).toBe(10);
  });

  it("preço R$ 40,00, mínimo congelado R$ 32,00, mínimo de hoje R$ 35,00 → sugestão R$ 44,00 (real inteiro acima, até R$ 50)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 4000, minimoCongeladoCentavos: 3200, minimoDeHojeCentavos: 3500 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(4400);
    expect(sugestao.direcao).toBe("subiu");
  });

  it("mínimo de hoje igual ao congelado (diferença menor que um centavo) → sugestão é o preço atual, direção 'igual'", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 15000, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 10000 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(15000);
    expect(sugestao.direcao).toBe("igual");
    expect(sugestao.percentualAbsoluto).toBe(0);
  });

  it("mínimo congelado igual a zero (peça que não calculava na época) → sugestão é o mínimo de hoje arredondado, 'sem razão anterior', nunca divide por zero", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 0, minimoCongeladoCentavos: 0, minimoDeHojeCentavos: 4200 }),
    ]);

    expect(() => sugestao).not.toThrow();
    expect(sugestao.precoSugeridoCentavos).toBe(4200); // arredondarBonito(4200) = 4200 (múltiplo de 100, ≤ 50)
    expect(sugestao.temRazaoAnterior).toBe(false);
    expect(sugestao.direcao).toBeNull();
    expect(sugestao.percentualAbsoluto).toBeNull();
  });

  it("mínimo caiu: direção 'caiu' e percentual absoluto positivo", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 13500, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 9000 }),
    ]);

    expect(sugestao.direcao).toBe("caiu");
    expect(sugestao.percentualAbsoluto).toBe(10);
  });

  it("percentual absoluto sai com uma casa decimal (9,4%, não 9,375% nem 9%)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 4000, minimoCongeladoCentavos: 3200, minimoDeHojeCentavos: 3500 }),
    ]);

    expect(sugestao.percentualAbsoluto).toBe(9.4);
  });
});

describe("sugerirPrecos — orçamento RASCUNHO (sem snapshot)", () => {
  it("preço já no mínimo de hoje → sugestão é o próprio preço, sem razão anterior", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 5000, minimoDeHojeCentavos: 5000, minimoCongeladoCentavos: null }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(5000);
    expect(sugestao.temRazaoAnterior).toBe(false);
    expect(sugestao.direcao).toBeNull();
  });

  it("preço acima do mínimo de hoje → sugestão é o próprio preço (nunca baixa um preço que já estava bom)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 9000, minimoDeHojeCentavos: 5000, minimoCongeladoCentavos: null }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(9000);
  });

  it("preço abaixo do mínimo de hoje → sugestão é o mínimo de hoje, arredondado", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 3000, minimoDeHojeCentavos: 4650, minimoCongeladoCentavos: null }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(4700); // arredondarBonito(4650) = 4700
  });
});

describe("algoMudou", () => {
  it("falso quando todos os mínimos de hoje batem com os congelados dentro de um centavo", () => {
    const sugestoes = sugerirPrecos([
      linha({ precoAtualCentavos: 1000, minimoCongeladoCentavos: 800, minimoDeHojeCentavos: 800 }),
      linha({ linhaId: "linha-2", precoAtualCentavos: 2000, minimoCongeladoCentavos: 1500, minimoDeHojeCentavos: 1500 }),
    ]);

    expect(algoMudou(sugestoes)).toBe(false);
  });

  it("verdadeiro quando ao menos uma linha difere", () => {
    const sugestoes = sugerirPrecos([
      linha({ precoAtualCentavos: 1000, minimoCongeladoCentavos: 800, minimoDeHojeCentavos: 800 }),
      linha({ linhaId: "linha-2", precoAtualCentavos: 2000, minimoCongeladoCentavos: 1500, minimoDeHojeCentavos: 1600 }),
    ]);

    expect(algoMudou(sugestoes)).toBe(true);
  });

  it("ignora linhas em modo rascunho (sem mínimo congelado) — não há 'antes' a comparar", () => {
    const sugestoes = sugerirPrecos([linha({ precoAtualCentavos: 1000, minimoDeHojeCentavos: 800, minimoCongeladoCentavos: null })]);

    expect(algoMudou(sugestoes)).toBe(false);
  });
});

// Fronteiras do arredondamento (o dono pediu explicitamente: exatamente R$ 50, logo abaixo, logo
// acima, e um valor já múltiplo de 5) — testadas no CANO INTEIRO (razão + arredondarBonito), não
// só em `arredondarBonito` isoladamente (já coberto em tests/unit/precificacao-calculo.test.ts).
// Truque para controlar exatamente o valor da razão: com `precoAtualCentavos === minimoCongelado
// Centavos`, a razão vira `Math.round(minimoDeHojeCentavos)` — ou seja, o PRÓPRIO
// `minimoDeHojeCentavos`, sem nenhum arredondamento de razão no meio. Ver SUMMARY, "Decidido sem
// o dono".
describe("sugerirPrecos — fronteiras do arredondamento", () => {
  it("razão cai EXATAMENTE em R$ 50,00 → fica R$ 50,00 (não sobe para múltiplo de 5)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 10000, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 5000 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(5000);
  });

  it("razão cai um centavo ABAIXO de R$ 50,00 (R$ 49,99) → sobe para R$ 50,00 (real inteiro acima)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 10000, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 4999 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(5000);
  });

  it("razão cai um centavo ACIMA de R$ 50,00 (R$ 50,01) → sobe para o múltiplo de 5 seguinte (R$ 55,00)", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 10000, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 5001 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(5500);
  });

  it("razão cai num valor já múltiplo de 5 acima de R$ 50 (R$ 65,00) → permanece R$ 65,00", () => {
    const [sugestao] = sugerirPrecos([
      linha({ precoAtualCentavos: 10000, minimoCongeladoCentavos: 10000, minimoDeHojeCentavos: 6500 }),
    ]);

    expect(sugestao.precoSugeridoCentavos).toBe(6500);
  });
});

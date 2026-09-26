import { describe, expect, it } from "vitest";

import { contasDoOrcamento, type LinhaParaContas } from "@/lib/orcamentos/contas";
import type { ResultadoDaFicha } from "@/lib/precificacao/ficha";

// 04.5-06-PLAN.md, Tarefa 1 — "as contas do orçamento": uma soma só, em inteiros, que nunca se
// contamina com a linha cuja peça não calcula (D-11/D-12). Nenhum dado real de peça ou preço do
// ateliê entra aqui — só números ilustrativos, no molde de `tests/unit/precificacao-ficha.test.ts`.

function resultadoOk(entrada: {
  custoCentavos: number;
  minimoCentavos: number;
  esmalte: number;
  biscoito: number;
}): ResultadoDaFicha {
  return {
    ok: true,
    fatias: [
      { chave: "material", centavos: entrada.custoCentavos },
      { chave: "trabalho", centavos: 0 },
      { chave: "queima", centavos: 0 },
      { chave: "embalagem", centavos: 0 },
      { chave: "perda", centavos: 0 },
    ],
    custoCentavos: entrada.custoCentavos,
    minimoCentavos: entrada.minimoCentavos,
    minimoGaleriaCentavos: entrada.minimoCentavos,
    zeroCentavos: Math.round(entrada.custoCentavos * 1.1),
    farol: "verde",
    forno: {
      esmalte: entrada.esmalte,
      biscoito: entrada.biscoito,
      porPrateleira: 6,
      niveis: 2,
      origemEsmalte: "calculado",
      origemBiscoito: "calculado",
    },
  };
}

const RESULTADO_NAO_CABE: ResultadoDaFicha = { ok: false, motivo: "nao-cabe" };
const RESULTADO_DIVISOR_INVALIDO: ResultadoDaFicha = { ok: false, motivo: "divisor-invalido" };

function linha(entrada: Partial<LinhaParaContas> & Pick<LinhaParaContas, "resultado">): LinhaParaContas {
  return {
    nome: "Peça de teste",
    quantidade: 1,
    precoUnitarioCentavos: 0,
    horasMilesimos: 0,
    ...entrada,
  };
}

describe("contasDoOrcamento", () => {
  it("soma quantidade × preço unitário de três linhas, em inteiros", () => {
    const linhas: LinhaParaContas[] = [
      linha({ nome: "Caneca", quantidade: 2, precoUnitarioCentavos: 5000, resultado: resultadoOk({ custoCentavos: 3000, minimoCentavos: 4500, esmalte: 12, biscoito: 21 }) }),
      linha({ nome: "Prato", quantidade: 1, precoUnitarioCentavos: 8000, resultado: resultadoOk({ custoCentavos: 5000, minimoCentavos: 7500, esmalte: 6, biscoito: 10 }) }),
      linha({ nome: "Vaso", quantidade: 3, precoUnitarioCentavos: 3300, resultado: resultadoOk({ custoCentavos: 2000, minimoCentavos: 3000, esmalte: 8, biscoito: 14 }) }),
    ];

    const contas = contasDoOrcamento(linhas);

    // 2×5000 + 1×8000 + 3×3300 = 10000 + 8000 + 9900 = 27900
    expect(contas.pecasCentavos).toBe(27900);
    expect(contas.totalCentavos).toBe(27900);
    expect(Number.isInteger(contas.pecasCentavos)).toBe(true);
  });

  it("sem nenhuma linha, devolve zero em tudo e não divide por zero em lugar nenhum", () => {
    const contas = contasDoOrcamento([]);

    expect(contas.pecasCentavos).toBe(0);
    expect(contas.totalCentavos).toBe(0);
    expect(contas.custoCentavos).toBe(0);
    expect(contas.horasMilesimos).toBe(0);
    expect(contas.fornadasBiscoitoMilesimos).toBe(0);
    expect(contas.fornadasEsmalteMilesimos).toBe(0);
    expect(contas.linhasSemCalculo).toEqual([]);
    expect(Number.isFinite(contas.pecasCentavos)).toBe(true);
  });

  it("horasMilesimos é a soma de quantidade × horas; fornadas ignoram contagem zero/desconhecida em vez de dividir por zero", () => {
    const linhas: LinhaParaContas[] = [
      linha({
        quantidade: 4,
        horasMilesimos: 500,
        precoUnitarioCentavos: 1000,
        resultado: resultadoOk({ custoCentavos: 100, minimoCentavos: 150, esmalte: 12, biscoito: 20 }),
      }),
      linha({
        quantidade: 2,
        horasMilesimos: 250,
        precoUnitarioCentavos: 1000,
        // Sem cálculo válido — não deve contaminar horas nem fornadas de fora do laço, mas
        // AINDA soma horas (a hora de trabalho é da ficha, não do resultado do cálculo).
        resultado: RESULTADO_NAO_CABE,
      }),
    ];

    const contas = contasDoOrcamento(linhas);

    // 4×500 + 2×250 = 2500 milésimos de hora
    expect(contas.horasMilesimos).toBe(2500);
    // Só a primeira linha calcula: 4 ÷ 20 biscoito = 0,2 fornada = 200 milésimos;
    // 4 ÷ 12 esmalte = 0,333... → arredondado para 333 milésimos.
    expect(contas.fornadasBiscoitoMilesimos).toBe(200);
    expect(contas.fornadasEsmalteMilesimos).toBe(333);
  });

  it("custoCentavos é a soma de quantidade × custo unitário, e é ≤ total quando os preços estão no mínimo ou acima", () => {
    const linhas: LinhaParaContas[] = [
      linha({ quantidade: 2, precoUnitarioCentavos: 4500, resultado: resultadoOk({ custoCentavos: 3000, minimoCentavos: 4500, esmalte: 12, biscoito: 21 }) }),
      linha({ quantidade: 1, precoUnitarioCentavos: 7500, resultado: resultadoOk({ custoCentavos: 5000, minimoCentavos: 7500, esmalte: 6, biscoito: 10 }) }),
    ];

    const contas = contasDoOrcamento(linhas);

    expect(contas.custoCentavos).toBe(2 * 3000 + 1 * 5000);
    expect(contas.custoCentavos).toBeLessThanOrEqual(contas.totalCentavos);
  });

  it("uma linha com motivo de recusa não contamina a soma: o total das peças continua verdadeiro, e a linha entra em linhasSemCalculo pelo nome", () => {
    const linhas: LinhaParaContas[] = [
      linha({ nome: "Caneca boa", quantidade: 2, precoUnitarioCentavos: 5000, resultado: resultadoOk({ custoCentavos: 3000, minimoCentavos: 4500, esmalte: 12, biscoito: 21 }) }),
      linha({ nome: "Prato gigante", quantidade: 1, precoUnitarioCentavos: 9900, resultado: RESULTADO_NAO_CABE }),
      linha({ nome: "Vaso sem parâmetro", quantidade: 3, precoUnitarioCentavos: 3300, resultado: RESULTADO_DIVISOR_INVALIDO }),
    ];

    const contas = contasDoOrcamento(linhas);

    // 2×5000 + 1×9900 + 3×3300 = 10000 + 9900 + 9900 = 29800 — o total das peças NUNCA some
    // uma linha por ela não ter calculado.
    expect(contas.pecasCentavos).toBe(29800);
    expect(contas.totalCentavos).toBe(29800);
    // Só a linha calculável entra no custo e nas fornadas.
    expect(contas.custoCentavos).toBe(2 * 3000);
    expect(contas.linhasSemCalculo).toEqual(["Prato gigante", "Vaso sem parâmetro"]);
  });

  it("é pura: chamada duas vezes com a mesma entrada devolve exatamente o mesmo resultado", () => {
    const linhas: LinhaParaContas[] = [
      linha({ nome: "Caneca", quantidade: 2, precoUnitarioCentavos: 5000, resultado: resultadoOk({ custoCentavos: 3000, minimoCentavos: 4500, esmalte: 12, biscoito: 21 }) }),
      linha({ nome: "Prato", quantidade: 1, precoUnitarioCentavos: 8000, resultado: RESULTADO_NAO_CABE }),
    ];

    const primeira = contasDoOrcamento(linhas);
    const segunda = contasDoOrcamento(linhas);

    expect(segunda).toEqual(primeira);
  });
});

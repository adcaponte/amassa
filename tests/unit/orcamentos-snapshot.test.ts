import { describe, expect, it } from "vitest";

import { lerDoSnapshot, montarSnapshot, type LinhaParaMontarSnapshot } from "@/lib/orcamentos/snapshot";

// 04.5-08-PLAN.md, Tarefa 1 — "o que o congelamento guarda": `montarSnapshot`/`lerDoSnapshot` são
// a ida e a volta do contrato de persistência que "Marcar como enviado" grava (D-21). Nenhum dado
// real de cliente ou preço do ateliê entra aqui — só números ilustrativos.

const LINHA_A: LinhaParaMontarSnapshot = {
  nome: "[teste] Caneca lisa",
  custoCentavos: 1200,
  minimoCentavos: 2500,
  zeroCentavos: 1800,
  horasMilesimos: 600,
  quantasCabemBiscoito: 20,
  quantasCabemEsmalte: 15,
};

const LINHA_B: LinhaParaMontarSnapshot = {
  nome: "[teste] Prato raso",
  custoCentavos: 3400,
  minimoCentavos: 7200,
  zeroCentavos: 5100,
  horasMilesimos: 900,
  quantasCabemBiscoito: 8,
  quantasCabemEsmalte: 6,
};

describe("montarSnapshot / lerDoSnapshot", () => {
  it("ida e volta sem perda: lerDoSnapshot devolve as mesmas linhas que montarSnapshot recebeu, na mesma ordem", () => {
    const snapshot = montarSnapshot({
      linhas: [LINHA_A, LINHA_B],
      impostoETaxaPontosBase: 850,
      parametrosEstimados: 3,
      congeladoEm: "2026-09-26T18:04:00.000Z",
    });

    const leitura = lerDoSnapshot(snapshot);

    expect(leitura.camposFaltantes).toEqual([]);
    expect(leitura.impostoETaxaPontosBase).toBe(850);
    expect(leitura.parametrosEstimados).toBe(3);
    expect(leitura.congeladoEm).toBe("2026-09-26T18:04:00.000Z");
    expect(leitura.linhas).toEqual([
      {
        nome: "[teste] Caneca lisa",
        custoCentavos: 1200,
        minimoCentavos: 2500,
        zeroCentavos: 1800,
        horasMilesimos: 600,
        quantasCabem: { biscoito: 20, esmalte: 15 },
      },
      {
        nome: "[teste] Prato raso",
        custoCentavos: 3400,
        minimoCentavos: 7200,
        zeroCentavos: 5100,
        horasMilesimos: 900,
        quantasCabem: { biscoito: 8, esmalte: 6 },
      },
    ]);
  });

  it("guarda, por linha, exatamente os seis campos do briefing — nem mais nem menos", () => {
    const snapshot = montarSnapshot({
      linhas: [LINHA_A],
      impostoETaxaPontosBase: 500,
      parametrosEstimados: 0,
      congeladoEm: "2026-09-26T12:00:00.000Z",
    });

    expect(Object.keys(snapshot.linhas[0]).sort()).toEqual(
      ["nome", "custoCentavos", "minimoCentavos", "zeroCentavos", "horasMilesimos", "quantasCabem"].sort(),
    );
  });

  it("um snapshot de formato antigo, com um campo de linha faltando, não explode: o campo vira zero e entra em camposFaltantes", () => {
    const bruto = {
      linhas: [
        {
          nome: "[teste] Caneca lisa",
          custoCentavos: 1200,
          minimoCentavos: 2500,
          // zeroCentavos ausente de propósito — simula um snapshot gravado antes deste campo existir.
          horasMilesimos: 600,
          quantasCabem: { biscoito: 20, esmalte: 15 },
        },
      ],
      impostoETaxaPontosBase: 850,
      parametrosEstimados: 3,
      congeladoEm: "2026-09-26T18:04:00.000Z",
    };

    const leitura = lerDoSnapshot(bruto);

    expect(leitura.linhas[0].zeroCentavos).toBe(0);
    expect(leitura.linhas[0].custoCentavos).toBe(1200);
    expect(leitura.camposFaltantes).toEqual(["linha 1 · zero"]);
  });

  it("um snapshot vazio (nem objeto) não explode: tudo vira zero/vazio, e cada ausência entra em camposFaltantes", () => {
    const leitura = lerDoSnapshot(null);

    expect(leitura.linhas).toEqual([]);
    expect(leitura.impostoETaxaPontosBase).toBe(0);
    expect(leitura.parametrosEstimados).toBe(0);
    expect(leitura.congeladoEm).toBe("");
    expect(leitura.camposFaltantes).toEqual(
      expect.arrayContaining(["linhas", "imposto + taxa", "parâmetros estimados", "congelado em"]),
    );
  });
});

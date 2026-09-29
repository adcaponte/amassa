import { describe, expect, it } from "vitest";

import {
  ESTADO_VAZIO,
  custoMedioCentavosPorUnidade,
  movimentoDoEstorno,
  valorarMovimento,
  type EstadoDoItem,
} from "@/lib/estoque/custo";

// O caminho do traçador (plano 06-01): os casos 1, 1b e 2 da tabela de 06-RESEARCH.md §Pergunta 3,
// com argila em kg (1 kg = 1000 milésimos). A bateria completa — casos 3 a 7, invariantes e
// estornos em sequência — é do plano 06-02.
describe("valorarMovimento — o caminho do traçador", () => {
  it("caso 1: entrada de 5 kg por R$ 21,00 sobre estoque vazio grava +5000 e +2100", () => {
    const resultado = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 5000,
      pagoCentavos: 2100,
    });

    expect(resultado.quantidadeMilesimos).toBe(5000);
    expect(resultado.valorCentavos).toBe(2100);
    expect(resultado.estadoDepois).toEqual({
      saldoMilesimos: 5000,
      valorCentavos: 2100,
      ultimaEntradaComPreco: { valorCentavos: 2100, milesimos: 5000 },
    });
    // R$ 4,20 por kg.
    expect(custoMedioCentavosPorUnidade(resultado.estadoDepois)).toBe(420);
  });

  it("caso 1b: baixa de 2 kg ao custo médio grava −2000 e −840, e o saldo fica 3000 exatos", () => {
    const depoisDaEntrada: EstadoDoItem = {
      saldoMilesimos: 5000,
      valorCentavos: 2100,
      ultimaEntradaComPreco: { valorCentavos: 2100, milesimos: 5000 },
    };

    const resultado = valorarMovimento(depoisDaEntrada, { tipo: "saida", milesimos: 2000 });

    expect(resultado.quantidadeMilesimos).toBe(-2000);
    expect(resultado.valorCentavos).toBe(-840);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(3000);
    expect(resultado.estadoDepois.valorCentavos).toBe(1260);
    // A saída não mexe na última entrada com preço.
    expect(resultado.estadoDepois.ultimaEntradaComPreco).toEqual({
      valorCentavos: 2100,
      milesimos: 5000,
    });
    expect(custoMedioCentavosPorUnidade(resultado.estadoDepois)).toBe(420);
  });

  it("caso 2: a saída que zera o saldo leva o valor inteiro (R1) — nenhum resíduo fica", () => {
    const depoisDaBaixa: EstadoDoItem = {
      saldoMilesimos: 3000,
      valorCentavos: 1260,
      ultimaEntradaComPreco: { valorCentavos: 2100, milesimos: 5000 },
    };

    const resultado = valorarMovimento(depoisDaBaixa, { tipo: "saida", milesimos: 3000 });

    expect(resultado.quantidadeMilesimos).toBe(-3000);
    expect(resultado.valorCentavos).toBe(-1260);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(0);
    expect(resultado.estadoDepois.valorCentavos).toBe(0);
  });

  it("a sequência inteira do traçador soma certo: 5 kg − 2 kg = 3 kg, valendo R$ 12,60", () => {
    const entrada = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 5000,
      pagoCentavos: 2100,
    });
    const baixa = valorarMovimento(entrada.estadoDepois, { tipo: "saida", milesimos: 2000 });

    expect(entrada.quantidadeMilesimos + baixa.quantidadeMilesimos).toBe(3000);
    expect(entrada.valorCentavos + baixa.valorCentavos).toBe(1260);
  });
});

describe("custoMedioCentavosPorUnidade", () => {
  it("sem saldo e sem nenhuma entrada com preço, não há custo conhecido", () => {
    expect(custoMedioCentavosPorUnidade(ESTADO_VAZIO)).toBeNull();
  });
});

describe("movimentoDoEstorno (D-23/D-24 — a confirmar com o dono antes do merge)", () => {
  it("estorno de uma saída de venda devolve ao custo que a venda levou (D-23)", () => {
    expect(movimentoDoEstorno({ quantidadeMilesimos: -2000, valorCentavos: -840 })).toEqual({
      tipo: "entrada_com_preco",
      milesimos: 2000,
      pagoCentavos: 840,
    });
  });

  it("estorno de uma entrada de compra sai ao custo médio corrente (D-24)", () => {
    expect(movimentoDoEstorno({ quantidadeMilesimos: 5000, valorCentavos: 2100 })).toEqual({
      tipo: "saida",
      milesimos: 5000,
    });
  });
});

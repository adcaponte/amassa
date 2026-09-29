import { describe, expect, it } from "vitest";

import {
  ESTADO_VAZIO,
  custoMedioCentavosPorUnidade,
  movimentoDoEstorno,
  valorarMovimento,
  type EstadoDoItem,
  type Movimento,
} from "@/lib/estoque/custo";

// A bateria do custo médio (planos 06-01 e 06-02). Os números esperados são os da tabela de
// `06-RESEARCH.md` §Pergunta 3, LITERALMENTE — se um caso não bater, a correção vai no módulo puro
// (`lib/estoque/custo.ts`), nunca aqui. Argila em kg: 1 kg = 1000 milésimos; valores em centavos.

// A última entrada com preço dos casos 1 a 3: 5 kg por R$ 21,00 (R$ 4,20/kg).
const ENTRADA_DO_CASO_1 = { valorCentavos: 2100, milesimos: 5000 };

function estado(
  saldoMilesimos: number,
  valorCentavos: number,
  ultimaEntradaComPreco: EstadoDoItem["ultimaEntradaComPreco"] = null,
): EstadoDoItem {
  return { saldoMilesimos, valorCentavos, ultimaEntradaComPreco };
}

describe("valorarMovimento — os sete casos de 06-RESEARCH.md §Pergunta 3", () => {
  it("06-RESEARCH.md §Pergunta 3, caso 1: entrada de 5 kg por R$ 21,00 sobre estoque vazio grava +5000 e +2100", () => {
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
      ultimaEntradaComPreco: ENTRADA_DO_CASO_1,
    });
    // R$ 4,20 por kg.
    expect(custoMedioCentavosPorUnidade(resultado.estadoDepois)).toBe(420);
  });

  it("06-RESEARCH.md §Pergunta 3, caso 1b: baixa de 2 kg ao custo médio grava −2000 e −840, e o saldo fica 3000 exatos", () => {
    const resultado = valorarMovimento(estado(5000, 2100, ENTRADA_DO_CASO_1), {
      tipo: "saida",
      milesimos: 2000,
    });

    expect(resultado.quantidadeMilesimos).toBe(-2000);
    expect(resultado.valorCentavos).toBe(-840);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(3000);
    expect(resultado.estadoDepois.valorCentavos).toBe(1260);
    // A saída não mexe na última entrada com preço.
    expect(resultado.estadoDepois.ultimaEntradaComPreco).toEqual(ENTRADA_DO_CASO_1);
  });

  it("06-RESEARCH.md §Pergunta 3, caso 2: a saída que zera o saldo leva o valor inteiro (R1) — Q = 0 e V = 0 exatos", () => {
    const resultado = valorarMovimento(estado(3000, 1260, ENTRADA_DO_CASO_1), {
      tipo: "saida",
      milesimos: 3000,
    });

    expect(resultado.quantidadeMilesimos).toBe(-3000);
    expect(resultado.valorCentavos).toBe(-1260);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(0);
    expect(resultado.estadoDepois.valorCentavos).toBe(0);
  });

  it("06-RESEARCH.md §Pergunta 3, caso 3: saída com saldo zero usa a última entrada com preço (D-26) — −420, estado (−1000, −420)", () => {
    const resultado = valorarMovimento(estado(0, 0, ENTRADA_DO_CASO_1), {
      tipo: "saida",
      milesimos: 1000,
    });

    expect(resultado.quantidadeMilesimos).toBe(-1000);
    expect(resultado.valorCentavos).toBe(-420);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(-1000);
    expect(resultado.estadoDepois.valorCentavos).toBe(-420);
  });

  it("06-RESEARCH.md §Pergunta 3, caso 4: entrada que tira o saldo do negativo — o custo vira o da entrada (R3), +12420, estado (24000, 12000)", () => {
    const resultado = valorarMovimento(estado(-1000, -420, ENTRADA_DO_CASO_1), {
      tipo: "entrada_com_preco",
      milesimos: 25000,
      pagoCentavos: 12500,
    });

    expect(resultado.quantidadeMilesimos).toBe(25000);
    // Grava 12420, não os R$ 125,00 pagos: a diferença reprecifica o quilo "devido".
    expect(resultado.valorCentavos).toBe(12420);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(24000);
    expect(resultado.estadoDepois.valorCentavos).toBe(12000);
    // R$ 5,00/kg — o da compra.
    expect(custoMedioCentavosPorUnidade(resultado.estadoDepois)).toBe(500);
    expect(resultado.estadoDepois.ultimaEntradaComPreco).toEqual({
      valorCentavos: 12500,
      milesimos: 25000,
    });
  });

  it("06-RESEARCH.md §Pergunta 3, caso 5: entrada com saldo negativo que continua negativo mantém a taxa (R4) — +420, estado (−2000, −840)", () => {
    const resultado = valorarMovimento(estado(-3000, -1260, ENTRADA_DO_CASO_1), {
      tipo: "entrada_com_preco",
      milesimos: 1000,
      pagoCentavos: 500,
    });

    expect(resultado.quantidadeMilesimos).toBe(1000);
    expect(resultado.valorCentavos).toBe(420);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(-2000);
    expect(resultado.estadoDepois.valorCentavos).toBe(-840);
    expect(custoMedioCentavosPorUnidade(resultado.estadoDepois)).toBe(420);
  });

  // O caso 6 (estorno de venda depois de o médio mudar) mora no `describe` D-23/D-24 abaixo.

  it("06-RESEARCH.md §Pergunta 3, caso 7: três saídas de 1 un de um lote de 3 un por R$ 10,00 gravam −333, −334, −333 e somam exatamente R$ 10,00", () => {
    const inicio = estado(3000, 1000, { valorCentavos: 1000, milesimos: 3000 });

    const primeira = valorarMovimento(inicio, { tipo: "saida", milesimos: 1000 });
    // 333,33… → 333.
    expect(primeira.valorCentavos).toBe(-333);
    expect(primeira.estadoDepois).toMatchObject({
      saldoMilesimos: 2000,
      valorCentavos: 667,
    });

    const segunda = valorarMovimento(primeira.estadoDepois, {
      tipo: "saida",
      milesimos: 1000,
    });
    // round(1000 × 667 / 2000) = round(333,5) = 334 — meio-para-cima sobre o absoluto.
    expect(segunda.valorCentavos).toBe(-334);
    expect(segunda.estadoDepois).toMatchObject({
      saldoMilesimos: 1000,
      valorCentavos: 333,
    });

    const terceira = valorarMovimento(segunda.estadoDepois, {
      tipo: "saida",
      milesimos: 1000,
    });
    // R1: zera o resíduo.
    expect(terceira.valorCentavos).toBe(-333);
    expect(terceira.estadoDepois).toMatchObject({ saldoMilesimos: 0, valorCentavos: 0 });

    expect(primeira.valorCentavos + segunda.valorCentavos + terceira.valorCentavos).toBe(
      -1000,
    );
  });
});

describe("valorarMovimento — as bordas", () => {
  it("a sequência do traçador soma certo: 5 kg − 2 kg = 3 kg, valendo R$ 12,60", () => {
    const entrada = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 5000,
      pagoCentavos: 2100,
    });
    const baixa = valorarMovimento(entrada.estadoDepois, {
      tipo: "saida",
      milesimos: 2000,
    });

    expect(entrada.quantidadeMilesimos + baixa.quantidadeMilesimos).toBe(3000);
    expect(entrada.valorCentavos + baixa.valorCentavos).toBe(1260);
  });

  it("uma saída de 1 milésimo além do saldo NÃO é recusada: o saldo fica em −1 milésimo (D-06)", () => {
    const resultado = valorarMovimento(estado(3000, 1260, ENTRADA_DO_CASO_1), {
      tipo: "saida",
      milesimos: 3001,
    });

    expect(resultado.quantidadeMilesimos).toBe(-3001);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(-1);
    // −round(3001 × 1260 / 3000) = −round(1260,42) = −1260: V fica 0, sinal permitido (0).
    expect(resultado.valorCentavos).toBe(-1260);
    expect(resultado.estadoDepois.valorCentavos).toBe(0);
  });

  it("entrada sem preço com saldo zero e sem entrada anterior vale 0 (D-26)", () => {
    const resultado = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_sem_preco",
      milesimos: 2000,
    });

    expect(resultado.quantidadeMilesimos).toBe(2000);
    expect(resultado.valorCentavos).toBe(0);
    expect(resultado.estadoDepois).toEqual({
      saldoMilesimos: 2000,
      valorCentavos: 0,
      ultimaEntradaComPreco: null,
    });
  });

  it("saída com saldo zero e sem entrada anterior vale 0 (D-26)", () => {
    const resultado = valorarMovimento(ESTADO_VAZIO, { tipo: "saida", milesimos: 1500 });

    expect(resultado.quantidadeMilesimos).toBe(-1500);
    expect(resultado.valorCentavos).toBe(0);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(-1500);
    expect(resultado.estadoDepois.valorCentavos).toBe(0);
  });

  it("nenhum custo unitário arredondado é gravado: argila em g a R$ 78,00/kg (7,8 centavos por g) sai 100 g por vez a exatos −780", () => {
    // 1 kg = 1000 g = 1.000.000 milésimos de g. Arredondar o unitário (8 centavos/g) erraria 2,5%.
    let atual = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 1_000_000,
      pagoCentavos: 7800,
    }).estadoDepois;
    for (let i = 0; i < 10; i++) {
      const saida = valorarMovimento(atual, { tipo: "saida", milesimos: 100_000 });
      expect(saida.valorCentavos).toBe(-780);
      atual = saida.estadoDepois;
    }
    expect(atual).toMatchObject({ saldoMilesimos: 0, valorCentavos: 0 });
  });

  it("recusa milésimos zero, negativos ou fracionários — o sinal vem do tipo", () => {
    expect(() => valorarMovimento(ESTADO_VAZIO, { tipo: "saida", milesimos: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      valorarMovimento(ESTADO_VAZIO, { tipo: "saida", milesimos: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      valorarMovimento(ESTADO_VAZIO, { tipo: "saida", milesimos: 1.5 }),
    ).toThrow(RangeError);
  });
});

// Gerador pseudoaleatório com semente fixa (LCG de 32 bits, constantes de Numerical Recipes) —
// a sequência é a mesma em toda execução; nada de aleatoriedade do ambiente.
function criarGerador(semente: number): (minimo: number, maximo: number) => number {
  let s = semente >>> 0;
  return (minimo, maximo) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return minimo + (s % (maximo - minimo + 1));
  };
}

function sinal(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

type Passo = { valorCentavos: number; estado: EstadoDoItem };

function rodarSequencia(semente: number, tamanho: number): Passo[] {
  const sortear = criarGerador(semente);
  const passos: Passo[] = [];
  let atual = ESTADO_VAZIO;
  for (let i = 0; i < tamanho; i++) {
    // Metade entradas (com e sem preço), metade saídas: passeio sem deriva, que cruza o zero e
    // entra no negativo. A cada 50 passos com saldo positivo, uma saída do saldo exato força R1.
    const escolha = sortear(0, 3);
    const milesimos = sortear(1, 30000);
    const zerar = i % 50 === 49 && atual.saldoMilesimos > 0;
    const movimento: Movimento = zerar
      ? { tipo: "saida", milesimos: atual.saldoMilesimos }
      : escolha === 0
        ? { tipo: "entrada_com_preco", milesimos, pagoCentavos: sortear(0, 50000) }
        : escolha === 1
          ? { tipo: "entrada_sem_preco", milesimos }
          : { tipo: "saida", milesimos };
    const resultado = valorarMovimento(atual, movimento);
    atual = resultado.estadoDepois;
    passos.push({ valorCentavos: resultado.valorCentavos, estado: atual });
  }
  return passos;
}

describe("valorarMovimento — os invariantes (500 movimentos, semente fixa)", () => {
  const SEMENTE = 20260929;

  it("a cada passo, Q = 0 ⇒ V = 0 e sinal(V) ∈ {sinal(Q), 0}", () => {
    const passos = rodarSequencia(SEMENTE, 500);
    expect(passos).toHaveLength(500);

    for (const [indice, passo] of passos.entries()) {
      const { saldoMilesimos: q, valorCentavos: v } = passo.estado;
      if (q === 0) {
        expect(v, `passo ${indice}: saldo zero com valor ${v}`).toBe(0);
      }
      expect(
        [sinal(q), 0].includes(sinal(v)),
        `passo ${indice}: Q = ${q}, V = ${v} — sinais incompatíveis`,
      ).toBe(true);
    }
    // A sequência precisa atravessar o negativo e o zero, senão o invariante não prova nada.
    expect(passos.some((passo) => passo.estado.saldoMilesimos < 0)).toBe(true);
    expect(passos.some((passo) => passo.estado.saldoMilesimos > 0)).toBe(true);
    expect(passos.some((passo) => passo.estado.saldoMilesimos === 0)).toBe(true);
  });

  it("é pura: rodar a mesma sequência duas vezes dá os mesmos valores", () => {
    const primeira = rodarSequencia(SEMENTE, 500);
    const segunda = rodarSequencia(SEMENTE, 500);

    expect(segunda.map((passo) => passo.valorCentavos)).toEqual(
      primeira.map((passo) => passo.valorCentavos),
    );
    expect(segunda[499]?.estado).toEqual(primeira[499]?.estado);
  });
});

describe("custoMedioCentavosPorUnidade", () => {
  it("(3000, 1260) em kg dá R$ 4,20 por kg — derivado de |V| ÷ |Q|, nada gravado", () => {
    expect(custoMedioCentavosPorUnidade(estado(3000, 1260, ENTRADA_DO_CASO_1))).toBe(420);
  });

  it("sem saldo e sem nenhuma entrada com preço, não há custo conhecido", () => {
    expect(custoMedioCentavosPorUnidade(ESTADO_VAZIO)).toBeNull();
  });
});

describe("D-23/D-24 — o valor do estorno (tomado sem o dono; confirmar antes do merge)", () => {
  // Um lugar só para a revisão do dono ler. Trocar a regra é editar `movimentoDoEstorno` em
  // `lib/estoque/custo.ts` e este bloco — nenhum outro módulo calcula o valor de um estorno.

  it("D-23: o estorno de uma saída de venda volta como entrada ao valor absoluto que a venda levou", () => {
    expect(
      movimentoDoEstorno({ quantidadeMilesimos: -2000, valorCentavos: -840 }),
    ).toEqual({
      tipo: "entrada_com_preco",
      milesimos: 2000,
      pagoCentavos: 840,
    });
  });

  it("D-24: o estorno de uma entrada de compra sai ao custo médio corrente (sem preço próprio)", () => {
    expect(
      movimentoDoEstorno({ quantidadeMilesimos: 5000, valorCentavos: 2100 }),
    ).toEqual({
      tipo: "saida",
      milesimos: 5000,
    });
  });

  it("06-RESEARCH.md §Pergunta 3, caso 6: estorno da venda do caso 1b depois de o médio mudar volta a +840 (D-23), estado (26000, 12840)", () => {
    const depoisDoCaso4 = estado(24000, 12000, {
      valorCentavos: 12500,
      milesimos: 25000,
    });

    const resultado = valorarMovimento(
      depoisDoCaso4,
      movimentoDoEstorno({ quantidadeMilesimos: -2000, valorCentavos: -840 }),
    );

    expect(resultado.quantidadeMilesimos).toBe(2000);
    expect(resultado.valorCentavos).toBe(840);
    expect(resultado.estadoDepois.saldoMilesimos).toBe(26000);
    expect(resultado.estadoDepois.valorCentavos).toBe(12840);
    // R$ 4,94/kg (12840 / 26 = 493,8 → 494).
    expect(custoMedioCentavosPorUnidade(resultado.estadoDepois)).toBe(494);
  });

  it("D-24: 10 un a R$ 0,01, compra de 1 un por R$ 10,00, saem 5, a compra é estornada — o valor nunca fica negativo com quantidade positiva", () => {
    // 10 un a 1 centavo cada = 10 centavos.
    const inicial = valorarMovimento(ESTADO_VAZIO, {
      tipo: "entrada_com_preco",
      milesimos: 10000,
      pagoCentavos: 10,
    });
    const compra = valorarMovimento(inicial.estadoDepois, {
      tipo: "entrada_com_preco",
      milesimos: 1000,
      pagoCentavos: 1000,
    });
    expect(compra.estadoDepois).toMatchObject({
      saldoMilesimos: 11000,
      valorCentavos: 1010,
    });

    const consumo = valorarMovimento(compra.estadoDepois, {
      tipo: "saida",
      milesimos: 5000,
    });
    // −round(5000 × 1010 / 11000) = −round(459,09) = −459.
    expect(consumo.valorCentavos).toBe(-459);
    expect(consumo.estadoDepois).toMatchObject({
      saldoMilesimos: 6000,
      valorCentavos: 551,
    });

    const estorno = valorarMovimento(
      consumo.estadoDepois,
      movimentoDoEstorno({
        quantidadeMilesimos: compra.quantidadeMilesimos,
        valorCentavos: compra.valorCentavos,
      }),
    );
    // Ao custo médio corrente: −round(1000 × 551 / 6000) = −round(91,83) = −92.
    expect(estorno.quantidadeMilesimos).toBe(-1000);
    expect(estorno.valorCentavos).toBe(-92);
    expect(estorno.estadoDepois).toMatchObject({
      saldoMilesimos: 5000,
      valorCentavos: 459,
    });
    expect(estorno.estadoDepois.valorCentavos).toBeGreaterThanOrEqual(0);

    // Contraexemplo (documentado, NÃO implementado): pelo custo ORIGINAL da compra, o estorno
    // levaria −1000 e deixaria V = 551 − 1000 = −449 com Q = 5000 > 0 — valor negativo com
    // quantidade positiva, o invariante quebrado. É por isso que D-24 usa o custo corrente.
  });
});

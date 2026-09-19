import { describe, expect, it } from "vitest";

import { montarExtrato, resumoDoCaixa, type MovimentoParaExtrato } from "@/lib/financeiro/extrato";

let contadorDeId = 0;

// Fábrica com padrões sensatos — cada teste só passa os campos que importam para o fato sendo
// provado (mesmo estilo de `tests/unit/abertura-parcelas.test.ts`).
function movimento(sobrescritas: Partial<MovimentoParaExtrato> = {}): MovimentoParaExtrato {
  contadorDeId += 1;
  return {
    parcelaId: `parcela-${contadorDeId}`,
    documentoId: `documento-${contadorDeId}`,
    numeroDocumento: contadorDeId,
    numeroParcela: 1,
    deQuantas: 1,
    tipo: "venda",
    pagoEm: "2026-01-01",
    forma: "pix",
    valorCentavos: 1000,
    taxaPontosBase: null,
    cancelado: false,
    titulo: "Movimento de teste",
    ...sobrescritas,
  };
}

describe("montarExtrato", () => {
  it("venda + despesa + venda em datas diferentes: saldo depois de cada uma, em ordem de pagoEm", () => {
    const m1 = movimento({ tipo: "venda", pagoEm: "2026-01-01", valorCentavos: 500 });
    const m2 = movimento({ tipo: "despesa", pagoEm: "2026-01-02", valorCentavos: 200 });
    const m3 = movimento({ tipo: "venda", pagoEm: "2026-01-03", valorCentavos: 300 });

    // Fora de ordem de propósito — a função é quem ordena, não quem chama.
    const { linhas, saldoAtualCentavos } = montarExtrato([m3, m1, m2], 1000);

    expect(linhas.map((linha) => linha.pagoEm)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(linhas[0].saldoDepoisCentavos).toBe(1500); // 1000 + 500
    expect(linhas[1].saldoDepoisCentavos).toBe(1300); // 1500 - 200
    expect(linhas[2].saldoDepoisCentavos).toBe(1600); // 1300 + 300
    expect(saldoAtualCentavos).toBe(1600);
  });

  it("mesmo dia desempata pelo número do documento, depois pelo número da parcela", () => {
    const documentoDois = movimento({
      pagoEm: "2026-02-10",
      numeroDocumento: 2,
      numeroParcela: 1,
      valorCentavos: 100,
    });
    const documentoUmParcelaDois = movimento({
      pagoEm: "2026-02-10",
      numeroDocumento: 1,
      numeroParcela: 2,
      valorCentavos: 100,
    });
    const documentoUmParcelaUm = movimento({
      pagoEm: "2026-02-10",
      numeroDocumento: 1,
      numeroParcela: 1,
      valorCentavos: 100,
    });

    const { linhas } = montarExtrato(
      [documentoDois, documentoUmParcelaDois, documentoUmParcelaUm],
      0,
    );

    expect(linhas.map((linha) => [linha.numeroDocumento, linha.numeroParcela])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it("movimento retroativo recalcula os saldos seguintes", () => {
    const m1 = movimento({ pagoEm: "2026-03-02", valorCentavos: 500 });
    const m2 = movimento({ pagoEm: "2026-03-03", valorCentavos: 300 });

    const antes = montarExtrato([m1, m2], 1000);
    expect(antes.linhas[0].saldoDepoisCentavos).toBe(1500);
    expect(antes.linhas[1].saldoDepoisCentavos).toBe(1800);

    // Um movimento retroativo (data ANTERIOR às duas já existentes) entra na lista.
    const retroativo = movimento({ pagoEm: "2026-03-01", valorCentavos: 200 });
    const depois = montarExtrato([m1, m2, retroativo], 1000);

    // O retroativo muda o saldo depois de TODOS os posteriores (m1 e m2, que agora vêm depois
    // dele na ordem cronológica) — não muda o próprio valor de m1/m2, só o saldo acumulado.
    expect(depois.linhas.map((linha) => linha.pagoEm)).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
    expect(depois.linhas[0].saldoDepoisCentavos).toBe(1200); // 1000 + 200 (o retroativo)
    expect(depois.linhas[1].saldoDepoisCentavos).toBe(1700); // 1200 + 500 (mudou: era 1500)
    expect(depois.linhas[2].saldoDepoisCentavos).toBe(2000); // 1700 + 300 (mudou: era 1800)
    expect(depois.saldoAtualCentavos).toBe(2000);
  });

  it("movimento cancelado aparece, sem saldo depois, e não entra no saldo atual", () => {
    const normal1 = movimento({ pagoEm: "2026-04-01", valorCentavos: 1000, tipo: "venda" });
    const cancelado = movimento({
      pagoEm: "2026-04-02",
      valorCentavos: 5000,
      tipo: "venda",
      cancelado: true,
    });
    const normal2 = movimento({ pagoEm: "2026-04-03", valorCentavos: 300, tipo: "despesa" });

    const { linhas, saldoAtualCentavos } = montarExtrato([normal1, cancelado, normal2], 1000);

    const linhaCancelada = linhas.find((linha) => linha.cancelado);
    expect(linhaCancelada).toBeDefined();
    expect(linhaCancelada?.saldoDepoisCentavos).toBeNull();

    // Saldo final ignora o cancelado por completo: 1000 (inicial) + 1000 (normal1) - 300 (normal2).
    expect(saldoAtualCentavos).toBe(1700);
  });

  it("venda no cartão com 350 pontos-base entra líquida (15000 → 14475)", () => {
    const { linhas, saldoAtualCentavos } = montarExtrato(
      [
        movimento({
          tipo: "venda",
          forma: "cartao",
          valorCentavos: 15000,
          taxaPontosBase: 350,
          pagoEm: "2026-05-01",
        }),
      ],
      0,
    );

    expect(linhas[0].liquidoCentavos).toBe(14475);
    expect(saldoAtualCentavos).toBe(14475);
  });

  it("despesa no cartão entra inteira, mesmo com taxaPontosBase informado", () => {
    const { linhas, saldoAtualCentavos } = montarExtrato(
      [
        movimento({
          tipo: "despesa",
          forma: "cartao",
          valorCentavos: 15000,
          taxaPontosBase: 350,
          pagoEm: "2026-05-02",
        }),
      ],
      20000,
    );

    expect(linhas[0].liquidoCentavos).toBe(15000);
    expect(saldoAtualCentavos).toBe(20000 - 15000);
  });

  it("lista vazia: saldo atual é igual ao saldo inicial", () => {
    const { linhas, saldoAtualCentavos } = montarExtrato([], 4200);
    expect(linhas).toEqual([]);
    expect(saldoAtualCentavos).toBe(4200);
  });

  it("saldo inicial negativo é aceito", () => {
    const { saldoAtualCentavos } = montarExtrato([], -1500);
    expect(saldoAtualCentavos).toBe(-1500);
  });

  it("não muta a lista recebida nem os movimentos originais", () => {
    const originais = Object.freeze([
      Object.freeze(movimento({ pagoEm: "2026-06-02" })),
      Object.freeze(movimento({ pagoEm: "2026-06-01" })),
    ]);

    expect(() => montarExtrato(originais, 0)).not.toThrow();
    // A lista congelada continua na ordem original — `montarExtrato` nunca reordena in-place.
    expect(originais[0].pagoEm).toBe("2026-06-02");
    expect(originais[1].pagoEm).toBe("2026-06-01");
  });
});

describe("resumoDoCaixa", () => {
  it("a receber conta só venda, a pagar conta só despesa", () => {
    const resumo = resumoDoCaixa({
      saldoAtualCentavos: 1000,
      abertas: [
        { tipo: "venda", valorCentavos: 500 },
        { tipo: "venda", valorCentavos: 300 },
        { tipo: "despesa", valorCentavos: 200 },
      ],
    });

    expect(resumo.aReceberCentavos).toBe(800);
    expect(resumo.aPagarCentavos).toBe(200);
  });

  it("'se tudo se cumprir' = saldo + a receber − a pagar", () => {
    const resumo = resumoDoCaixa({
      saldoAtualCentavos: 1000,
      abertas: [
        { tipo: "venda", valorCentavos: 800 },
        { tipo: "despesa", valorCentavos: 200 },
      ],
    });

    expect(resumo.seTudoSeCumprirCentavos).toBe(1000 + 800 - 200);
  });

  it("sem nada em aberto, a receber e a pagar são zero", () => {
    const resumo = resumoDoCaixa({ saldoAtualCentavos: 1000, abertas: [] });
    expect(resumo.aReceberCentavos).toBe(0);
    expect(resumo.aPagarCentavos).toBe(0);
    expect(resumo.seTudoSeCumprirCentavos).toBe(1000);
  });
});

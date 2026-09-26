import { describe, expect, it } from "vitest";

import {
  filtrarExtrato,
  montarExtrato,
  resumoDoCaixa,
  type MovimentoParaExtrato,
} from "@/lib/financeiro/extrato";
import { formaDaUrl, mesDaUrl } from "@/lib/financeiro/abas";

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

// D-11/D-12: o extrato navega por mês, filtra por forma, e o "saldo depois" continua o acumulado
// GLOBAL — o filtro esconde linhas, não recalcula saldo.
describe("filtrarExtrato", () => {
  it("devolve só as linhas pagas no mês, da mais recente para a mais antiga, com o saldo intacto", () => {
    const { linhas: montadas } = montarExtrato(
      [
        movimento({ pagoEm: "2026-07-05", valorCentavos: 100 }),
        movimento({ pagoEm: "2026-07-10", valorCentavos: 200 }),
        movimento({ pagoEm: "2026-08-01", valorCentavos: 300 }),
      ],
      0,
    );

    const { linhas } = filtrarExtrato(montadas, { mes: "2026-07", forma: "todas" });

    expect(linhas.map((linha) => linha.pagoEm)).toEqual(["2026-07-10", "2026-07-05"]);
    // O saldo depois de cada linha é o MESMO que `montarExtrato` calculou (acumulado global) —
    // nunca recalculado sobre o recorte do mês.
    expect(linhas[0].saldoDepoisCentavos).toBe(300); // 100 + 200
    expect(linhas[1].saldoDepoisCentavos).toBe(100);
  });

  it("com forma dinheiro, esconde Pix e Cartão e não muda o saldo depois de nenhuma linha (D-12)", () => {
    const { linhas: montadas } = montarExtrato(
      [
        movimento({ pagoEm: "2026-09-01", forma: "dinheiro", valorCentavos: 100 }),
        movimento({ pagoEm: "2026-09-02", forma: "pix", valorCentavos: 200 }),
        movimento({ pagoEm: "2026-09-03", forma: "cartao", valorCentavos: 300 }),
      ],
      0,
    );

    const semFiltro = filtrarExtrato(montadas, { mes: "2026-09", forma: "todas" });
    const comFiltro = filtrarExtrato(montadas, { mes: "2026-09", forma: "dinheiro" });

    expect(comFiltro.linhas).toHaveLength(1);
    expect(comFiltro.linhas[0].forma).toBe("dinheiro");
    const linhaSemFiltro = semFiltro.linhas.find((linha) => linha.forma === "dinheiro");
    expect(comFiltro.linhas[0].saldoDepoisCentavos).toBe(linhaSemFiltro?.saldoDepoisCentavos);
  });

  it("total filtrado = entradas líquidas − saídas das linhas visíveis não canceladas; cancelada visível não entra", () => {
    const { linhas: montadas } = montarExtrato(
      [
        movimento({ pagoEm: "2026-10-01", forma: "dinheiro", tipo: "venda", valorCentavos: 500 }),
        movimento({ pagoEm: "2026-10-02", forma: "dinheiro", tipo: "despesa", valorCentavos: 200 }),
        movimento({
          pagoEm: "2026-10-03",
          forma: "dinheiro",
          tipo: "venda",
          valorCentavos: 9999,
          cancelado: true,
        }),
        movimento({ pagoEm: "2026-10-04", forma: "pix", valorCentavos: 700 }),
      ],
      0,
    );

    const { totalFiltradoCentavos } = filtrarExtrato(montadas, { mes: "2026-10", forma: "dinheiro" });
    expect(totalFiltradoCentavos).toBe(300); // 500 - 200, cancelada e pix de fora
  });

  // REESCRITO (04.4-13-PLAN.md, Tarefa 2): resposta ao item 13 da conferência do dono
  // (26/09/2026) — "aparece a frase com a soma em todas categorias, mas nao na 'todas'". O total
  // deixa de ser `null` em "todas" e passa a somar o mês inteiro por conta própria.
  it('forma "todas" soma entradas líquidas menos saídas de TODAS as formas do mês, com a cancelada e o mês vizinho de fora', () => {
    const { linhas: montadas } = montarExtrato(
      [
        movimento({ pagoEm: "2026-11-01", forma: "pix", tipo: "venda", valorCentavos: 500 }),
        movimento({ pagoEm: "2026-11-02", forma: "dinheiro", tipo: "despesa", valorCentavos: 200 }),
        movimento({
          pagoEm: "2026-11-03",
          forma: "cartao",
          tipo: "venda",
          valorCentavos: 9999,
          cancelado: true,
        }),
        // Mês vizinho — nunca entra na soma de novembro.
        movimento({ pagoEm: "2026-10-31", forma: "pix", tipo: "venda", valorCentavos: 700 }),
      ],
      0,
    );

    const { totalFiltradoCentavos } = filtrarExtrato(montadas, { mes: "2026-11", forma: "todas" });
    expect(totalFiltradoCentavos).toBe(300); // 500 (pix) − 200 (dinheiro); cancelada e mês vizinho de fora
  });

  it('forma "todas" num mês sem nenhuma linha devolve ZERO, não nulo — quem esconde a frase é a tela, não o módulo', () => {
    const { linhas: montadas } = montarExtrato(
      [movimento({ pagoEm: "2026-12-01", valorCentavos: 500 })],
      0,
    );
    const { linhas, totalFiltradoCentavos } = filtrarExtrato(montadas, {
      mes: "2027-01",
      forma: "todas",
    });
    expect(linhas).toEqual([]);
    expect(totalFiltradoCentavos).toBe(0);
  });

  it('mês sem linhas → lista vazia e motivo "sem-movimento"', () => {
    const { linhas: montadas } = montarExtrato(
      [movimento({ pagoEm: "2026-12-01", valorCentavos: 500 })],
      0,
    );
    const { linhas, motivoVazio } = filtrarExtrato(montadas, { mes: "2027-01", forma: "todas" });
    expect(linhas).toEqual([]);
    expect(motivoVazio).toBe("sem-movimento");
  });

  it('mês com linhas mas nenhuma na forma → motivo "sem-movimento-na-forma"', () => {
    const { linhas: montadas } = montarExtrato(
      [movimento({ pagoEm: "2027-02-01", forma: "pix", valorCentavos: 500 })],
      0,
    );
    const { linhas, motivoVazio } = filtrarExtrato(montadas, { mes: "2027-02", forma: "cartao" });
    expect(linhas).toEqual([]);
    expect(motivoVazio).toBe("sem-movimento-na-forma");
  });

  it("movimento retroativo num mês anterior muda o saldo depois das linhas do mês seguinte", () => {
    const antes = montarExtrato(
      [movimento({ pagoEm: "2027-04-05", valorCentavos: 500 })],
      1000,
    );
    const linhaAbrilAntes = filtrarExtrato(antes.linhas, { mes: "2027-04", forma: "todas" });
    expect(linhaAbrilAntes.linhas[0].saldoDepoisCentavos).toBe(1500);

    const depois = montarExtrato(
      [
        movimento({ pagoEm: "2027-04-05", valorCentavos: 500 }),
        movimento({ pagoEm: "2027-03-01", valorCentavos: 200 }),
      ],
      1000,
    );
    const linhaAbrilDepois = filtrarExtrato(depois.linhas, { mes: "2027-04", forma: "todas" });
    expect(linhaAbrilDepois.linhas[0].saldoDepoisCentavos).toBe(1700); // 1200 (retroativo) + 500
  });
});

describe("mesDaUrl", () => {
  const hoje = "2026-09-20";

  it("aceita 'AAAA-MM' válido", () => {
    expect(mesDaUrl("2021-03", hoje)).toBe("2021-03");
  });

  it("mês inexistente (13), texto solto ou ausente caem no mês de hoje", () => {
    expect(mesDaUrl("2021-13", hoje)).toBe("2026-09");
    expect(mesDaUrl("x", hoje)).toBe("2026-09");
    expect(mesDaUrl(undefined, hoje)).toBe("2026-09");
    expect(mesDaUrl(null, hoje)).toBe("2026-09");
  });
});

describe("formaDaUrl", () => {
  it("reconhece as três formas e cai em 'todas' para qualquer outra coisa", () => {
    expect(formaDaUrl("dinheiro")).toBe("dinheiro");
    expect(formaDaUrl("pix")).toBe("pix");
    expect(formaDaUrl("cartao")).toBe("cartao");
    expect(formaDaUrl("outracoisa")).toBe("todas");
    expect(formaDaUrl(undefined)).toBe("todas");
    expect(formaDaUrl(null)).toBe("todas");
  });
});

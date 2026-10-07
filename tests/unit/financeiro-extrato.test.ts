import { describe, expect, it } from "vitest";

import {
  filtrarExtrato,
  saldoAntesDaJanela,
  type GrupoDePagas,
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

// D-27 (06.5-12): o Caixa lê linha a linha só do 1º dia do mês do extrato em diante; o que foi
// pago antes chega AGREGADO por (tipo, valor, taxa) e vira saldo de partida. Esta suíte prova que
// nenhum número que a tela mostra muda: saldo de cada linha, saldo atual (tile), total filtrado.
describe("saldoAntesDaJanela — equivalência com o histórico inteiro (D-27)", () => {
  // O que `somarMovimentosAntesDe` faz no banco, reproduzido em memória: pagas antes de `desde`,
  // de documento não cancelado, agrupadas por (tipo, valor, taxa) com a contagem. A chave usa o
  // valor CRU da taxa (`null` e `0` são grupos diferentes, como no `group by` do Postgres).
  function agruparAntesDe(movimentos: readonly MovimentoParaExtrato[], desde: string): GrupoDePagas[] {
    const grupos = new Map<string, GrupoDePagas>();
    for (const m of movimentos) {
      if (m.pagoEm >= desde || m.cancelado) {
        continue;
      }
      const chave = `${m.tipo}|${m.valorCentavos}|${m.taxaPontosBase ?? "nulo"}`;
      const grupo = grupos.get(chave);
      if (grupo) {
        grupo.quantidade += 1;
      } else {
        grupos.set(chave, {
          tipo: m.tipo,
          valorCentavos: m.valorCentavos,
          taxaPontosBase: m.taxaPontosBase ?? null,
          quantidade: 1,
        });
      }
    }
    return [...grupos.values()];
  }

  // Monta das duas formas — a de antes (tudo) e a de agora (agregado + do mês em diante) — e
  // compara tudo que a tela lê, para o mês mostrado e cada forma do filtro.
  function conferirEquivalencia(
    movimentos: readonly MovimentoParaExtrato[],
    saldoInicial: number,
    mes: string,
  ) {
    const desde = `${mes}-01`;
    const antes = montarExtrato(movimentos, saldoInicial);
    const agora = montarExtrato(
      movimentos.filter((m) => m.pagoEm >= desde),
      saldoInicial + saldoAntesDaJanela(agruparAntesDe(movimentos, desde)),
    );

    expect(agora.saldoAtualCentavos).toBe(antes.saldoAtualCentavos);
    for (const forma of ["todas", "dinheiro", "pix", "cartao"] as const) {
      expect(filtrarExtrato(agora.linhas, { mes, forma })).toEqual(
        filtrarExtrato(antes.linhas, { mes, forma }),
      );
    }
    // As linhas do mês em diante, uma a uma, com o mesmo saldo depois (inclusive `null` da cancelada).
    expect(agora.linhas).toEqual(antes.linhas.filter((l) => l.pagoEm >= desde));
    // E os tiles (`resumoDoCaixa`) saem os mesmos, com as mesmas abertas.
    const abertas = [
      { tipo: "venda" as const, valorCentavos: 4321 },
      { tipo: "despesa" as const, valorCentavos: 1234 },
    ];
    expect(resumoDoCaixa({ saldoAtualCentavos: agora.saldoAtualCentavos, abertas })).toEqual(
      resumoDoCaixa({ saldoAtualCentavos: antes.saldoAtualCentavos, abertas }),
    );
  }

  it("lista vazia de grupos soma zero", () => {
    expect(saldoAntesDaJanela([])).toBe(0);
  });

  it("venda soma o líquido (taxa arredondada por parcela, vezes a quantidade); despesa subtrai inteira", () => {
    // 333 com 350 pb: taxa 11,655 → 12; líquido 321 — três parcelas iguais dão 963, não
    // 999 − round(34,965) = 964 (a taxa NUNCA é calculada sobre a soma do grupo).
    expect(
      saldoAntesDaJanela([
        { tipo: "venda", valorCentavos: 333, taxaPontosBase: 350, quantidade: 3 },
        { tipo: "despesa", valorCentavos: 500, taxaPontosBase: 350, quantidade: 2 },
        { tipo: "venda", valorCentavos: 1000, taxaPontosBase: null, quantidade: 1 },
      ]),
    ).toBe(963 - 1000 + 1000);
  });

  // Três meses (fev, mar, abr de 2027): vendas com e sem taxa, despesas (com taxa informada, que
  // não vale para despesa), canceladas antes e dentro da janela, empates no mesmo dia, e
  // pagamentos colados na borda (último dia do mês anterior e dia 1º do mês mostrado).
  const fixture: MovimentoParaExtrato[] = [
    movimento({ tipo: "venda", pagoEm: "2027-02-03", valorCentavos: 15000, taxaPontosBase: 350, forma: "cartao" }),
    movimento({ tipo: "venda", pagoEm: "2027-02-03", valorCentavos: 333, taxaPontosBase: 350, forma: "cartao" }),
    movimento({ tipo: "venda", pagoEm: "2027-02-10", valorCentavos: 333, taxaPontosBase: 350, forma: "cartao" }),
    movimento({ tipo: "venda", pagoEm: "2027-02-11", valorCentavos: 333, taxaPontosBase: 0, forma: "pix" }),
    movimento({ tipo: "despesa", pagoEm: "2027-02-12", valorCentavos: 8000, taxaPontosBase: 350, forma: "cartao" }),
    movimento({ tipo: "venda", pagoEm: "2027-02-20", valorCentavos: 99999, cancelado: true }),
    movimento({ tipo: "despesa", pagoEm: "2027-02-28", valorCentavos: 70000, cancelado: true }),
    movimento({ tipo: "venda", pagoEm: "2027-02-28", valorCentavos: 2500, forma: "dinheiro" }),
    // Borda: 1º de março, com empate de dia e de documento.
    movimento({ tipo: "despesa", pagoEm: "2027-03-01", valorCentavos: 1200, numeroDocumento: 900, numeroParcela: 2 }),
    movimento({ tipo: "despesa", pagoEm: "2027-03-01", valorCentavos: 1200, numeroDocumento: 900, numeroParcela: 1 }),
    movimento({
      tipo: "venda",
      pagoEm: "2027-03-01",
      valorCentavos: 777,
      taxaPontosBase: 299,
      forma: "cartao",
      numeroDocumento: 899,
    }),
    movimento({ tipo: "venda", pagoEm: "2027-03-15", valorCentavos: 4000, cancelado: true, forma: "pix" }),
    movimento({ tipo: "venda", pagoEm: "2027-03-31", valorCentavos: 5050, taxaPontosBase: 199, forma: "cartao" }),
    movimento({ tipo: "despesa", pagoEm: "2027-04-01", valorCentavos: 300000, forma: "pix" }),
    movimento({ tipo: "venda", pagoEm: "2027-04-02", valorCentavos: 1, taxaPontosBase: 5000, forma: "cartao" }),
    movimento({ tipo: "venda", pagoEm: "2027-04-30", valorCentavos: 12345, forma: "dinheiro", cancelado: true }),
  ];

  it("três meses: para cada mês mostrado, o mesmo saldo por linha, o mesmo saldo atual e o mesmo total filtrado", () => {
    for (const mes of ["2027-01", "2027-02", "2027-03", "2027-04", "2027-05"]) {
      conferirEquivalencia(fixture, 100000, mes);
      conferirEquivalencia(fixture, -5000, mes);
    }
  });

  it("março conferido à mão: saldo de antes, saldo depois de cada linha e total do mês", () => {
    const desde = "2027-03-01";
    const grupos = agruparAntesDe(fixture, desde);
    // Fevereiro: 15000−525 = 14475; 333−12 = 321 (duas, um grupo de 2); 333 com taxa 0 = 333;
    // −8000 (despesa no cartão entra inteira); +2500. = 14475 + 642 + 333 − 8000 + 2500 = 9950.
    // As duas canceladas de fevereiro não entram.
    expect(grupos.find((g) => g.valorCentavos === 333 && g.taxaPontosBase === 350)?.quantidade).toBe(2);
    expect(saldoAntesDaJanela(grupos)).toBe(9950);

    const agora = montarExtrato(
      fixture.filter((m) => m.pagoEm >= desde),
      0 + saldoAntesDaJanela(grupos),
    );
    const marco = filtrarExtrato(agora.linhas, { mes: "2027-03", forma: "todas" });
    // Da mais recente para a mais antiga: 31/03 (5050−100 = 4950), 15/03 cancelada,
    // 01/03 doc 900 p2, doc 900 p1, doc 899 (777−23 = 754).
    expect(marco.linhas.map((l) => l.saldoDepoisCentavos)).toEqual([
      9950 + 754 - 1200 - 1200 + 4950,
      null,
      9950 + 754 - 1200 - 1200,
      9950 + 754 - 1200,
      9950 + 754,
    ]);
    expect(marco.totalFiltradoCentavos).toBe(754 - 2400 + 4950);
  });

  it("muitos históricos sorteados (semente fixa): nenhum número muda em mês nenhum", () => {
    // Gerador MINSTD (Park–Miller) com semente fixa — determinístico, nunca intermitente; o produto
    // fica abaixo de 2^53, então a conta é exata em ponto flutuante.
    let semente = 20261006;
    const sortear = (n: number) => {
      semente = (semente * 48271) % 2147483647;
      return semente % n;
    };
    const formas = ["dinheiro", "pix", "cartao"] as const;
    const taxas = [null, 0, 199, 299, 350, 499];
    for (let rodada = 0; rodada < 40; rodada += 1) {
      const movimentos: MovimentoParaExtrato[] = [];
      const quantos = 1 + sortear(60);
      for (let i = 0; i < quantos; i += 1) {
        const mesDoMovimento = 1 + sortear(6);
        const dia = 1 + sortear(28);
        movimentos.push(
          movimento({
            tipo: sortear(3) === 0 ? "despesa" : "venda",
            pagoEm: `2027-${String(mesDoMovimento).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
            // Valores repetidos de propósito (grupos com quantidade > 1).
            valorCentavos: [333, 1000, 777, 5050, 1 + sortear(50000)][sortear(5)],
            taxaPontosBase: taxas[sortear(taxas.length)],
            forma: formas[sortear(3)],
            cancelado: sortear(8) === 0,
            numeroDocumento: 1 + sortear(5),
            numeroParcela: 1 + sortear(3),
          }),
        );
      }
      const saldoInicial = sortear(200000) - 100000;
      for (const mes of ["2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07"]) {
        conferirEquivalencia(movimentos, saldoInicial, mes);
      }
    }
  });
});

import { describe, expect, it } from "vitest";

import { formatarReais } from "../../lib/abertura/formato";
import {
  calcularParcelas,
  fluxoMensal,
  proximaParcela,
  proximoMes,
  resumoDoPainel,
  somarMeses,
  totaisComprometidos,
  type ItemParaCalculo,
  type ItemParaFluxo,
  type ItemParaResumoDoPainel,
} from "../../lib/abertura/parcelas";

// Tarefa 2 (04.2-01-PLAN.md): os casos que definem o contrato de `lib/abertura/parcelas.ts` —
// a Tarefa 3 completa a suíte com as bordas de calendário (dia 31, ano bissexto, virada de ano).
// D-19 já resolvida pelo dono em 2026-08-30 (04.2-CONTEXT.md): parcela cujo dia não existe no
// mês seguinte cai no ÚLTIMO DIA daquele mês, e o dia original volta nos meses que o comportam.

describe("calcularParcelas", () => {
  it("item a prazo de R$ 9.800 em 6 parcelas com a primeira em 2026-09-10", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 980000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-09-10",
    };
    const parcelas = calcularParcelas(item);

    expect(parcelas).toHaveLength(6);
    parcelas.forEach((parcela, indice) => {
      expect(parcela.valorEmCentavos).toBeCloseTo(980000 / 6, 6);
      expect(parcela.numero).toBe(indice + 1);
      expect(parcela.de).toBe(6);
    });

    expect(parcelas.map((p) => p.vencimentoEm)).toEqual([
      "2026-09-10",
      "2026-10-10",
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
      "2027-02-10",
    ]);
  });

  it("a soma dos valorEmCentavos das 6 parcelas é exatamente 980000", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 980000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-09-10",
    };
    const parcelas = calcularParcelas(item);
    const soma = parcelas.reduce((acumulado, p) => acumulado + p.valorEmCentavos, 0);

    expect(soma).toBe(980000);
  });

  it("item à vista devolve uma entrada só, com de: 1 e vencimento igual à primeira parcela", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 210000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-08-18",
    };
    const parcelas = calcularParcelas(item);

    expect(parcelas).toHaveLength(1);
    expect(parcelas[0]).toEqual({
      numero: 1,
      de: 1,
      vencimentoEm: "2026-08-18",
      valorEmCentavos: 210000,
    });
  });
});

describe("proximaParcela", () => {
  const item: ItemParaCalculo = {
    valorEmCentavos: 980000,
    formaPagamento: "prazo",
    parcelas: 6,
    primeiraParcelaEm: "2026-09-10",
  };
  const parcelas = calcularParcelas(item);

  it("devolve a parcela de 2026-11-10 com tipo proxima quando hoje é 2026-11-01", () => {
    const resultado = proximaParcela(parcelas, "2026-11-01");

    expect(resultado.tipo).toBe("proxima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-11-10");
  });

  it("devolve a última parcela com tipo ultima quando todas já passaram", () => {
    const resultado = proximaParcela(parcelas, "2027-06-01");

    expect(resultado.tipo).toBe("ultima");
    expect(resultado.parcela.vencimentoEm).toBe("2027-02-10");
  });
});

describe("totaisComprometidos", () => {
  it("separa aVistaEmCentavos de aPrazoEmCentavos e a soma dos dois é comprometidoEmCentavos", () => {
    const itens: ItemParaCalculo[] = [
      { valorEmCentavos: 480000, formaPagamento: "prazo", parcelas: 3, primeiraParcelaEm: "2026-09-01" },
      { valorEmCentavos: 210000, formaPagamento: "vista", parcelas: 1, primeiraParcelaEm: "2026-08-18" },
      { valorEmCentavos: 150000, formaPagamento: "vista", parcelas: 1, primeiraParcelaEm: "2026-08-20" },
    ];

    const totais = totaisComprometidos(itens);

    expect(totais.aVistaEmCentavos).toBe(360000);
    expect(totais.aPrazoEmCentavos).toBe(480000);
    expect(totais.comprometidoEmCentavos).toBe(840000);
  });
});

describe("somarMeses", () => {
  it("soma um mês simples: 2026-12-15 + 1 mês = 2027-01-15", () => {
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
  });

  // Tarefa 3 (04.2-01-PLAN.md): as bordas de calendário. A resposta do humano na Tarefa 1 —
  // "ajustar" (D-19) — é o que decide o valor esperado destes casos de dia 31, não a
  // preferência deste plano.
  it("dia 31 encadeado: 2027-01-31 em 4 parcelas cai 2027-01-31, 2027-02-28, 2027-03-31, 2027-04-30", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 400000,
      formaPagamento: "prazo",
      parcelas: 4,
      primeiraParcelaEm: "2027-01-31",
    };
    const vencimentos = calcularParcelas(item).map((p) => p.vencimentoEm);

    // A TERCEIRA parcela é o caso que pega o encadeamento a partir da anterior: se calculada
    // a partir da SEGUNDA (28/02), ficaria presa em 28/03 em vez de voltar para 31/03 — cada
    // parcela é calculada a partir da PRIMEIRA data (D-19), nunca da anterior.
    expect(vencimentos).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("dia 31 em ano bissexto: 2028-01-31 em 2 parcelas cai 2028-01-31, 2028-02-29", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 200000,
      formaPagamento: "prazo",
      parcelas: 2,
      primeiraParcelaEm: "2028-01-31",
    };
    expect(calcularParcelas(item).map((p) => p.vencimentoEm)).toEqual([
      "2028-01-31",
      "2028-02-29",
    ]);
  });

  it("dia 30 em fevereiro: 2026-01-30 em 2 parcelas cai 2026-01-30, 2026-02-28", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 200000,
      formaPagamento: "prazo",
      parcelas: 2,
      primeiraParcelaEm: "2026-01-30",
    };
    expect(calcularParcelas(item).map((p) => p.vencimentoEm)).toEqual([
      "2026-01-30",
      "2026-02-28",
    ]);
  });

  it("virada de ano simples: 2026-12-15 em 3 parcelas cai 2026-12-15, 2027-01-15, 2027-02-15", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 300000,
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2026-12-15",
    };
    expect(calcularParcelas(item).map((p) => p.vencimentoEm)).toEqual([
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
    ]);
  });

  it("virada de ano longa: 2026-11-30 + 3 meses = 2027-02-28; 2028-01-31 + 13 meses = 2029-02-28", () => {
    expect(somarMeses("2026-11-30", 3)).toBe("2027-02-28");
    expect(somarMeses("2028-01-31", 13)).toBe("2029-02-28");
  });
});

describe("proximoMes", () => {
  it("proximoMes('2026-12') = '2027-01'; proximoMes('2026-01') = '2026-02'", () => {
    expect(proximoMes("2026-12")).toBe("2027-01");
    expect(proximoMes("2026-01")).toBe("2026-02");
  });
});

describe("bordas de calcularParcelas/proximaParcela", () => {
  it("a soma fecha em divisão não exata: 10000 centavos em 3 parcelas — mesmo texto formatado e soma exata", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 10000,
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2026-05-01",
    };
    const parcelas = calcularParcelas(item);
    const soma = parcelas.reduce((acumulado, p) => acumulado + p.valorEmCentavos, 0);

    expect(soma).toBe(10000);
    const textosFormatados = parcelas.map((p) => formatarReais(p.valorEmCentavos));
    expect(new Set(textosFormatados).size).toBe(1);
  });

  it("parcela que já passou continua sendo parcela — nenhuma é filtrada por já ter vencido", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 600000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-01-10",
    };
    const parcelas = calcularParcelas(item);

    expect(parcelas).toHaveLength(6);
    const resultado = proximaParcela(parcelas, "2026-04-01");
    expect(resultado.tipo).toBe("proxima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-04-10");
  });

  it("todas as parcelas passaram: proximaParcela devolve a última, com tipo ultima", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 600000,
      formaPagamento: "prazo",
      parcelas: 6,
      primeiraParcelaEm: "2026-01-10",
    };
    const parcelas = calcularParcelas(item);
    const resultado = proximaParcela(parcelas, "2027-01-01");

    expect(resultado.tipo).toBe("ultima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-06-10");
  });

  it("à vista com data no passado: uma parcela só, e proximaParcela devolve tipo ultima", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 100000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-01-01",
    };
    const parcelas = calcularParcelas(item);
    const resultado = proximaParcela(parcelas, "2026-06-01");

    expect(parcelas).toHaveLength(1);
    expect(resultado.tipo).toBe("ultima");
    expect(resultado.parcela.vencimentoEm).toBe("2026-01-01");
  });

  it("determinismo: chamar calcularParcelas duas vezes com o mesmo argumento devolve resultado estruturalmente igual, e não muta o argumento recebido", () => {
    const item: ItemParaCalculo = {
      valorEmCentavos: 480000,
      formaPagamento: "prazo",
      parcelas: 4,
      primeiraParcelaEm: "2026-03-31",
    };
    const copiaOriginal = { ...item };

    const primeiraChamada = calcularParcelas(item);
    const segundaChamada = calcularParcelas(item);

    expect(primeiraChamada).toEqual(segundaChamada);
    expect(item).toEqual(copiaOriginal);
  });
});

describe("totaisComprometidos — lista vazia", () => {
  it("devolve os três totais em 0, sem lançar", () => {
    expect(() => totaisComprometidos([])).not.toThrow();
    expect(totaisComprometidos([])).toEqual({
      comprometidoEmCentavos: 0,
      aVistaEmCentavos: 0,
      aPrazoEmCentavos: 0,
    });
  });
});

// Tarefa 1 (04.2-04-PLAN.md): `fluxoMensal` — a visão "Por mês" (D-16), a mais valiosa e a mais
// fácil de fazer errado. Precisa somar TODAS as parcelas de TODOS os itens no mês certo,
// incluindo as vencidas, sem perder nem contar nenhuma duas vezes.
describe("fluxoMensal", () => {
  function item(parcial: Partial<ItemParaFluxo> & { nome: string }): ItemParaFluxo {
    return {
      valorEmCentavos: 100000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-09-01",
      ...parcial,
    };
  }

  it("dois itens à vista no mesmo mês somam no mesmo mês, com duas linhas de composição", () => {
    const itens = [
      item({ nome: "Sofá", valorEmCentavos: 100000, primeiraParcelaEm: "2026-09-05" }),
      item({ nome: "Mesa", valorEmCentavos: 50000, primeiraParcelaEm: "2026-09-20" }),
    ];

    const meses = fluxoMensal(itens, "2026-09-01");

    expect(meses).toHaveLength(1);
    expect(meses[0].chave).toBe("2026-09");
    expect(meses[0].totalEmCentavos).toBe(150000);
    expect(meses[0].composicao).toHaveLength(2);
  });

  it("item de 980000 centavos em 6 parcelas atravessa a virada de ano em seis meses, cada um com a fração no rótulo", () => {
    const itens = [
      item({
        nome: "Forno",
        valorEmCentavos: 980000,
        formaPagamento: "prazo",
        parcelas: 6,
        primeiraParcelaEm: "2026-11-10",
      }),
    ];

    const meses = fluxoMensal(itens, "2026-11-01");

    expect(meses.map((mes) => mes.chave)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
    ]);
    meses.forEach((mes, indice) => {
      expect(mes.composicao).toEqual([
        { rotulo: `Forno · ${indice + 1}/6`, valorEmCentavos: mes.composicao[0].valorEmCentavos },
      ]);
    });
  });

  it("item à vista não tem fração no rótulo da composição — de === 1 nunca vira '1/1'", () => {
    const itens = [item({ nome: "Estante", valorEmCentavos: 210000 })];

    const meses = fluxoMensal(itens, "2026-09-01");

    expect(meses[0].composicao[0].rotulo).toBe("Estante");
  });

  it("mês no passado continua na lista, marcado como passado", () => {
    const itens = [item({ nome: "Torno", valorEmCentavos: 440000, primeiraParcelaEm: "2026-01-10" })];

    const meses = fluxoMensal(itens, "2026-09-10");

    expect(meses).toHaveLength(1);
    expect(meses[0].chave).toBe("2026-01");
    expect(meses[0].ehPassado).toBe(true);
  });

  it("ehMesAtual é verdadeiro exatamente para a chave de mês de hoje", () => {
    const itens = [
      item({ nome: "A", primeiraParcelaEm: "2026-08-01" }),
      item({ nome: "B", primeiraParcelaEm: "2026-09-01" }),
      item({ nome: "C", primeiraParcelaEm: "2026-10-01" }),
    ];

    const meses = fluxoMensal(itens, "2026-09-15");

    expect(meses.find((mes) => mes.chave === "2026-08")?.ehMesAtual).toBe(false);
    expect(meses.find((mes) => mes.chave === "2026-09")?.ehMesAtual).toBe(true);
    expect(meses.find((mes) => mes.chave === "2026-10")?.ehMesAtual).toBe(false);
  });

  it("identifica o mês mais pesado e a porcentagem dos demais em relação a ele", () => {
    const itens = [
      item({ nome: "A", valorEmCentavos: 1000, primeiraParcelaEm: "2026-01-01" }),
      item({ nome: "B", valorEmCentavos: 3000, primeiraParcelaEm: "2026-02-01" }),
      item({ nome: "C", valorEmCentavos: 2000, primeiraParcelaEm: "2026-03-01" }),
    ];

    const meses = fluxoMensal(itens, "2026-01-01");

    expect(meses.map((mes) => ({ ehPico: mes.ehPico, percentual: mes.percentualDoPico }))).toEqual([
      { ehPico: false, percentual: 33 },
      { ehPico: true, percentual: 100 },
      { ehPico: false, percentual: 67 },
    ]);
  });

  it("com um mês só, nenhum é chamado de pico — um mês sozinho não se compara com nada", () => {
    const itens = [item({ nome: "Único", valorEmCentavos: 500000 })];

    const meses = fluxoMensal(itens, "2026-09-01");

    expect(meses).toHaveLength(1);
    expect(meses[0].ehPico).toBe(false);
    expect(meses[0].percentualDoPico).toBe(100);
  });

  it("empate no topo: os dois meses empatados no valor máximo são marcados ehPico, ambos com 100%", () => {
    const itens = [
      item({ nome: "A", valorEmCentavos: 500000, primeiraParcelaEm: "2026-01-01" }),
      item({ nome: "B", valorEmCentavos: 500000, primeiraParcelaEm: "2026-02-01" }),
    ];

    const meses = fluxoMensal(itens, "2026-01-01");

    expect(meses).toEqual([
      expect.objectContaining({ chave: "2026-01", ehPico: true, percentualDoPico: 100 }),
      expect.objectContaining({ chave: "2026-02", ehPico: true, percentualDoPico: 100 }),
    ]);
  });

  it("as chaves saem em ordem cronológica crescente, mesmo entrando em ordem inversa", () => {
    const itens = [
      item({ nome: "Tardio", primeiraParcelaEm: "2027-03-01" }),
      item({ nome: "Médio", primeiraParcelaEm: "2026-12-01" }),
      item({ nome: "Cedo", primeiraParcelaEm: "2026-09-01" }),
    ];

    const meses = fluxoMensal(itens, "2026-09-01");

    expect(meses.map((mes) => mes.chave)).toEqual(["2026-09", "2026-12", "2027-03"]);
  });

  it("lista vazia devolve vetor vazio, sem lançar e sem divisão por zero", () => {
    expect(() => fluxoMensal([], "2026-09-01")).not.toThrow();
    expect(fluxoMensal([], "2026-09-01")).toEqual([]);
  });

  it("invariante: a soma dos totais de todos os meses é igual à soma dos valores de todos os itens", () => {
    const itens = [
      item({ nome: "A", valorEmCentavos: 480000, formaPagamento: "prazo", parcelas: 3, primeiraParcelaEm: "2026-09-01" }),
      item({ nome: "B", valorEmCentavos: 210000, primeiraParcelaEm: "2026-08-18" }),
      item({
        nome: "C",
        valorEmCentavos: 10000,
        formaPagamento: "prazo",
        parcelas: 3,
        primeiraParcelaEm: "2026-05-01",
      }),
    ];

    const somaDosItens = itens.reduce((total, item) => total + item.valorEmCentavos, 0);
    const somaDosMeses = fluxoMensal(itens, "2026-09-01").reduce(
      (total, mes) => total + mes.totalEmCentavos,
      0,
    );

    expect(somaDosMeses).toBe(somaDosItens);
  });
});

// Tarefa 2 (04.2-04-PLAN.md): `resumoDoPainel` — os três blocos do topo (D-15/ABE-12).
describe("resumoDoPainel", () => {
  function item(
    parcial: Partial<ItemParaResumoDoPainel> & { nome: string },
  ): ItemParaResumoDoPainel {
    return {
      valorEmCentavos: 100000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-09-01",
      entregaPrevistaEm: null,
      resolvido: false,
      ...parcial,
    };
  }

  it("comprometidoEmCentavos é a soma de dois itens à vista e um a prazo, e aVista + aPrazo bate com ele", () => {
    const itens = [
      item({ nome: "A", valorEmCentavos: 100000 }),
      item({ nome: "B", valorEmCentavos: 50000 }),
      item({
        nome: "C",
        valorEmCentavos: 480000,
        formaPagamento: "prazo",
        parcelas: 3,
        primeiraParcelaEm: "2026-09-10",
      }),
    ];

    const resumo = resumoDoPainel(itens, [], "2026-09-01");

    expect(resumo.comprometidoEmCentavos).toBe(630000);
    expect(resumo.aVistaEmCentavos + resumo.aPrazoEmCentavos).toBe(resumo.comprometidoEmCentavos);
  });

  it("saiNesteMesEmCentavos inclui a parcela já vencida dentro do mês corrente", () => {
    const itens = [item({ nome: "Vencida", valorEmCentavos: 200000, primeiraParcelaEm: "2026-09-01" })];

    const resumo = resumoDoPainel(itens, [], "2026-09-15");

    expect(resumo.saiNesteMesEmCentavos).toBe(200000);
  });

  it("virada de ano: em dezembro, saiNesteMes é o de dezembro e saiNoProximoMes é o de janeiro do ano seguinte", () => {
    const itens = [
      item({
        nome: "Forno",
        valorEmCentavos: 200000,
        formaPagamento: "prazo",
        parcelas: 2,
        primeiraParcelaEm: "2026-12-05",
      }),
    ];

    const resumo = resumoDoPainel(itens, [], "2026-12-20");

    expect(resumo.saiNesteMesEmCentavos).toBe(100000);
    expect(resumo.saiNoProximoMesEmCentavos).toBe(100000);
  });

  it("mês sem nenhuma parcela vale 0, nunca omitido ou indefinido", () => {
    const itens = [item({ nome: "Distante", primeiraParcelaEm: "2026-01-01" })];

    const resumo = resumoDoPainel(itens, [], "2026-09-01");

    expect(resumo.saiNesteMesEmCentavos).toBe(0);
    expect(resumo.saiNoProximoMesEmCentavos).toBe(0);
  });

  it("tarefasAtrasadas conta as não concluídas com prazo anterior a hoje; entregasVencidas usa a mesma regra do plano 03; precisamDeAtencao soma os dois", () => {
    const itens = [
      item({
        nome: "Atrasado",
        entregaPrevistaEm: "2026-09-01",
        resolvido: false,
      }),
      item({ nome: "Em dia", entregaPrevistaEm: "2026-09-20", resolvido: false }),
    ];
    const tarefas = [
      { concluida: false, prazoEm: "2026-09-01" },
      { concluida: true, prazoEm: "2026-01-01" },
      { concluida: false, prazoEm: "2026-09-20" },
    ];

    const resumo = resumoDoPainel(itens, tarefas, "2026-09-10");

    expect(resumo.tarefasAtrasadas).toBe(1);
    expect(resumo.entregasVencidas).toBe(1);
    expect(resumo.precisamDeAtencao).toBe(2);
  });

  it("listas vazias devolvem todos os campos em 0, sem lançar", () => {
    expect(() => resumoDoPainel([], [], "2026-09-01")).not.toThrow();
    expect(resumoDoPainel([], [], "2026-09-01")).toEqual({
      comprometidoEmCentavos: 0,
      aVistaEmCentavos: 0,
      aPrazoEmCentavos: 0,
      saiNesteMesEmCentavos: 0,
      saiNoProximoMesEmCentavos: 0,
      tarefasAtrasadas: 0,
      entregasVencidas: 0,
      precisamDeAtencao: 0,
    });
  });
});

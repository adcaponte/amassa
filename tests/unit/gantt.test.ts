import { describe, expect, it } from "vitest";
import {
  LARGURA_MINIMA_PARA_ROTULO,
  PIXELS_POR_DIA,
  calcularIntervalo,
  celulasDeQuinzena,
  deslocamentoEmPixels,
  ordenarParaGantt,
  retanguloDaEtapa,
  rolagemInicial,
  type IntervaloDaTimeline,
} from "../../lib/encomendas/gantt";

const MESES_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatarMesStub(dia: string): string {
  const mes = Number(dia.slice(5, 7));
  return MESES_PT[mes - 1];
}

describe("constantes", () => {
  it("PIXELS_POR_DIA é exatamente 18", () => {
    expect(PIXELS_POR_DIA).toBe(18);
  });

  it("LARGURA_MINIMA_PARA_ROTULO é exatamente 46", () => {
    expect(LARGURA_MINIMA_PARA_ROTULO).toBe(46);
  });
});

describe("calcularIntervalo", () => {
  it("uma encomenda de 2026-08-12 a 2026-08-25: primeiroDia na quinzena anterior (2026-07-16), ultimoDiaExclusivo na quinzena posterior (2026-09-16)", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );

    expect(intervalo.primeiroDia).toBe("2026-07-16");
    expect(intervalo.ultimoDiaExclusivo).toBe("2026-09-16");
  });

  it("lista vazia: intervalo centrado em hoje, com uma quinzena de folga de cada lado, largura nunca 0", () => {
    const intervalo = calcularIntervalo([], "2026-08-20");

    expect(intervalo.primeiroDia).toBe("2026-08-01");
    expect(intervalo.ultimoDiaExclusivo).toBe("2026-09-16");
    expect(intervalo.larguraEmPixels).toBeGreaterThan(0);
  });

  it("uma encomenda só ainda desenha a quinzena de folga nas duas pontas", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-13" }],
      "2026-08-12",
    );

    // A própria encomenda ocupa só 1 dia (12 a 13, exclusivo), mas o intervalo desenhado é
    // muito maior por causa da folga de uma quinzena de cada lado.
    expect(intervalo.primeiroDia < "2026-08-12").toBe(true);
    expect(intervalo.ultimoDiaExclusivo > "2026-08-13").toBe(true);
  });

  it("larguraEmPixels do intervalo é totalDeDias * 18, sempre inteiro", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );

    expect(intervalo.larguraEmPixels).toBe(intervalo.totalDeDias * 18);
    expect(Number.isInteger(intervalo.larguraEmPixels)).toBe(true);
  });

  it("com duas encomendas, usa o menor inicio e o maior fimExclusivo entre elas", () => {
    const intervalo = calcularIntervalo(
      [
        { inicio: "2026-09-01", fimExclusivo: "2026-09-05" },
        { inicio: "2026-08-12", fimExclusivo: "2026-08-25" },
      ],
      "2026-08-12",
    );

    expect(intervalo.primeiroDia).toBe("2026-07-16");
    // maior fimExclusivo é 2026-09-05 (da primeira encomenda) — cai na quinzena 1–15 de
    // setembro; a posterior é 16–30 de setembro, exclusivo = 2026-10-01.
    expect(intervalo.ultimoDiaExclusivo).toBe("2026-10-01");
  });
});

describe("celulasDeQuinzena", () => {
  it("cobre o intervalo inteiro sem vão, sem sobreposição, e a soma das larguras é igual a larguraEmPixels", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );
    const celulas = celulasDeQuinzena(intervalo, formatarMesStub);

    const somaLarguras = celulas.reduce((total, celula) => total + celula.largura, 0);
    expect(somaLarguras).toBe(intervalo.larguraEmPixels);

    for (let i = 0; i < celulas.length - 1; i++) {
      expect(celulas[i].esquerda + celulas[i].largura).toBe(celulas[i + 1].esquerda);
    }
    expect(celulas[0].esquerda).toBe(0);
    const ultima = celulas[celulas.length - 1];
    expect(ultima.esquerda + ultima.largura).toBe(intervalo.larguraEmPixels);
  });

  it("quinzenas inteiras: Jul16-31 (16 dias), Ago1-15 (15 dias), Ago16-31 (16 dias), Set1-15 (15 dias)", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );
    const celulas = celulasDeQuinzena(intervalo, formatarMesStub);

    expect(celulas.map((c) => c.inicio)).toEqual([
      "2026-07-16",
      "2026-08-01",
      "2026-08-16",
      "2026-09-01",
    ]);
    expect(celulas.map((c) => c.dias)).toEqual([16, 15, 16, 15]);
  });

  it("rótulo combina o intervalo de dias com o mês devolvido por formatarMes: '16–31 jul', '1–15 ago'", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );
    const celulas = celulasDeQuinzena(intervalo, formatarMesStub);

    expect(celulas[0].rotulo).toBe("16–31 jul");
    expect(celulas[1].rotulo).toBe("1–15 ago");
  });

  it("primeira e última célula são quinzenas parciais quando o intervalo não começa em dia 1 ou 16", () => {
    const intervaloParcial: IntervaloDaTimeline = {
      primeiroDia: "2026-08-05",
      ultimoDiaExclusivo: "2026-08-20",
      totalDeDias: 15,
      larguraEmPixels: 15 * 18,
    };
    const celulas = celulasDeQuinzena(intervaloParcial, formatarMesStub);

    expect(celulas).toHaveLength(2);
    expect(celulas[0]).toMatchObject({ inicio: "2026-08-05", dias: 11 });
    expect(celulas[1]).toMatchObject({ inicio: "2026-08-16", dias: 4 });
    const somaLarguras = celulas.reduce((total, celula) => total + celula.largura, 0);
    expect(somaLarguras).toBe(intervaloParcial.larguraEmPixels);
  });
});

describe("deslocamentoEmPixels", () => {
  const intervalo: IntervaloDaTimeline = {
    primeiroDia: "2026-08-01",
    ultimoDiaExclusivo: "2026-09-01",
    totalDeDias: 31,
    larguraEmPixels: 31 * 18,
  };

  it("para primeiroDia devolve 0", () => {
    expect(deslocamentoEmPixels(intervalo, "2026-08-01")).toBe(0);
  });

  it("devolve (dias desde primeiroDia) * 18", () => {
    expect(deslocamentoEmPixels(intervalo, "2026-08-05")).toBe(4 * 18);
    expect(deslocamentoEmPixels(intervalo, "2026-08-31")).toBe(30 * 18);
  });
});

describe("retanguloDaEtapa", () => {
  const intervalo: IntervaloDaTimeline = {
    primeiroDia: "2026-08-01",
    ultimoDiaExclusivo: "2026-09-01",
    totalDeDias: 31,
    larguraEmPixels: 31 * 18,
  };

  it("devolve null quando faixa.dias === 0 — nem losango, nem retângulo, nem espaço reservado", () => {
    const retangulo = retanguloDaEtapa({ dias: 0, inicio: "2026-08-05" }, intervalo);

    expect(retangulo).toBeNull();
  });

  it("etapa de 1 dia devolve largura: 18 e mostrarRotulo: false", () => {
    const retangulo = retanguloDaEtapa({ dias: 1, inicio: "2026-08-01" }, intervalo);

    expect(retangulo).toMatchObject({ esquerda: 0, largura: 18, mostrarRotulo: false });
  });

  it("largura exatamente 46px não mostra rótulo; 47px mostra — o limiar é estritamente 'mais de 46', não 'a partir de'", () => {
    const com46px = retanguloDaEtapa(
      { dias: 46 / PIXELS_POR_DIA, inicio: "2026-08-01" },
      intervalo,
    );
    const com47px = retanguloDaEtapa(
      { dias: 47 / PIXELS_POR_DIA, inicio: "2026-08-01" },
      intervalo,
    );

    expect(com46px?.largura).toBeCloseTo(46, 5);
    expect(com46px?.mostrarRotulo).toBe(false);
    expect(com47px?.largura).toBeCloseTo(47, 5);
    expect(com47px?.mostrarRotulo).toBe(true);
  });

  it("duas etapas adjacentes: esquerda da seguinte é exatamente esquerda + largura da anterior", () => {
    const faixaA = retanguloDaEtapa({ dias: 3, inicio: "2026-08-05" }, intervalo);
    const faixaB = retanguloDaEtapa({ dias: 2, inicio: "2026-08-08" }, intervalo);

    expect(faixaA).not.toBeNull();
    expect(faixaB).not.toBeNull();
    expect(faixaB!.esquerda).toBe(faixaA!.esquerda + faixaA!.largura);
  });
});

describe("rolagemInicial", () => {
  const intervalo: IntervaloDaTimeline = {
    primeiroDia: "2026-08-01",
    ultimoDiaExclusivo: "2026-09-01",
    totalDeDias: 31,
    larguraEmPixels: 31 * 18,
  };

  it("centraliza 'hoje' quando cabe dentro da largura visível", () => {
    // hoje no meio do intervalo (offset ~ metade de 558px = 279), largura visível 200.
    const rolagem = rolagemInicial(intervalo, "2026-08-17", 200);

    expect(rolagem).toBeGreaterThan(0);
    expect(rolagem).toBeLessThan(intervalo.larguraEmPixels - 200);
  });

  it("devolve 0 quando 'hoje' está antes do início do intervalo desenhado", () => {
    const rolagem = rolagemInicial(intervalo, "2026-07-01", 200);

    expect(rolagem).toBe(0);
  });

  it("devolve 0 quando 'hoje' está perto demais do começo para centralizar", () => {
    const rolagem = rolagemInicial(intervalo, "2026-08-01", 200);

    expect(rolagem).toBe(0);
  });

  it("devolve larguraTotal - larguraVisivel quando 'hoje' cai depois do fim do intervalo", () => {
    const rolagem = rolagemInicial(intervalo, "2026-12-01", 200);

    expect(rolagem).toBe(intervalo.larguraEmPixels - 200);
  });

  it("devolve larguraTotal - larguraVisivel quando 'hoje' está perto demais do fim para centralizar", () => {
    const rolagem = rolagemInicial(intervalo, "2026-08-31", 200);

    expect(rolagem).toBe(intervalo.larguraEmPixels - 200);
  });

  it("nunca um valor negativo nem maior que o máximo rolável, e sempre inteiro", () => {
    for (const hoje of ["2026-07-01", "2026-08-01", "2026-08-17", "2026-08-31", "2026-12-01"]) {
      const rolagem = rolagemInicial(intervalo, hoje, 200);

      expect(rolagem).toBeGreaterThanOrEqual(0);
      expect(rolagem).toBeLessThanOrEqual(intervalo.larguraEmPixels - 200);
      expect(Number.isInteger(rolagem)).toBe(true);
    }
  });
});

describe("ordenarParaGantt", () => {
  it("ordena por dataInicio ascendente", () => {
    const lista = [
      { id: "3", nome: "Coleção Verão", dataInicio: "2026-08-20" },
      { id: "1", nome: "Canecas Cônicas", dataInicio: "2026-08-01" },
      { id: "2", nome: "Vasos Grandes", dataInicio: "2026-08-10" },
    ];

    expect(ordenarParaGantt(lista).map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("desempata por nome com localeCompare('pt-BR') quando dataInicio é igual", () => {
    const lista = [
      { id: "1", nome: "Zebra", dataInicio: "2026-08-01" },
      { id: "2", nome: "Água", dataInicio: "2026-08-01" },
      { id: "3", nome: "Banana", dataInicio: "2026-08-01" },
    ];

    expect(ordenarParaGantt(lista).map((e) => e.nome)).toEqual(["Água", "Banana", "Zebra"]);
  });

  it("desempata por id quando dataInicio e nome são iguais — ordem determinística, nunca a do banco", () => {
    const lista = [
      { id: "b", nome: "Mesma Encomenda", dataInicio: "2026-08-01" },
      { id: "a", nome: "Mesma Encomenda", dataInicio: "2026-08-01" },
    ];

    expect(ordenarParaGantt(lista).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  LARGURA_MINIMA_PARA_ROTULO,
  PIXELS_POR_DIA,
  calcularIntervalo,
  celulasDeSemana,
  deslocamentoEmPixels,
  ordenarParaGantt,
  retanguloDaEtapa,
  rolagemInicial,
  type IntervaloDaTimeline,
} from "../../lib/encomendas/gantt";
import { DIAS_PADRAO, calcularCronograma } from "../../lib/encomendas/cronograma";

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

// Âncora aritmética verificada (A3 do brief noturno): 2026-08-12 é uma quarta-feira, logo a
// segunda-feira da sua semana é 2026-08-10. Os demais valores esperados abaixo foram derivados
// da regra e confirmados rodando `npm test` — nenhum copiado de cabeça.
describe("calcularIntervalo", () => {
  it("uma encomenda de 2026-08-12 a 2026-08-25, hoje=2026-08-12: primeiroDia é a segunda da semana de hoje (2026-08-10), ultimoDiaExclusivo é a semana posterior ao maior fimExclusivo (2026-09-07)", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );

    expect(intervalo.primeiroDia).toBe("2026-08-10");
    expect(intervalo.ultimoDiaExclusivo).toBe("2026-09-07");
  });

  it("lista vazia: intervalo baseado só em hoje, sem folga na ponta inicial, largura nunca 0", () => {
    const intervalo = calcularIntervalo([], "2026-08-20");

    expect(intervalo.primeiroDia).toBe("2026-08-17");
    expect(intervalo.ultimoDiaExclusivo).toBe("2026-08-31");
    expect(intervalo.larguraEmPixels).toBeGreaterThan(0);
  });

  it("uma encomenda só: primeiroDia é exatamente a segunda da semana de hoje (nenhuma folga no começo) e o fim ainda ganha uma semana de folga", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-13" }],
      "2026-08-12",
    );

    // A timeline abre em hoje — a própria encomenda ocupa só 1 dia (12 a 13, exclusivo), e
    // `primeiroDia` não recua além da segunda-feira da semana de hoje.
    expect(intervalo.primeiroDia).toBe("2026-08-10");
    expect(intervalo.ultimoDiaExclusivo > "2026-08-13").toBe(true);
  });

  it("larguraEmPixels do intervalo é totalDeDias * 18, sempre inteiro, e totalDeDias é sempre múltiplo de 7 (as duas pontas caem em segunda-feira)", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );

    expect(intervalo.larguraEmPixels).toBe(intervalo.totalDeDias * 18);
    expect(Number.isInteger(intervalo.larguraEmPixels)).toBe(true);
    expect(intervalo.totalDeDias % 7).toBe(0);
  });

  it("com duas encomendas, o menor início — mesmo bem no passado — NÃO afeta mais primeiroDia; só o maior fimExclusivo afeta o fim", () => {
    const intervalo = calcularIntervalo(
      [
        { inicio: "2026-09-01", fimExclusivo: "2026-09-05" },
        { inicio: "2025-01-01", fimExclusivo: "2025-01-10" },
      ],
      "2026-08-12",
    );

    expect(intervalo.primeiroDia).toBe("2026-08-10");
    // maior fimExclusivo é 2026-09-05 — cai na semana de 2026-08-31 a 2026-09-06; a posterior é
    // 2026-09-07 a 2026-09-13, exclusivo = 2026-09-14.
    expect(intervalo.ultimoDiaExclusivo).toBe("2026-09-14");
  });
});

describe("celulasDeSemana", () => {
  it("cobre o intervalo inteiro sem vão, sem sobreposição, e a soma das larguras é igual a larguraEmPixels", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );
    const celulas = celulasDeSemana(intervalo, formatarMesStub);

    const somaLarguras = celulas.reduce((total, celula) => total + celula.largura, 0);
    expect(somaLarguras).toBe(intervalo.larguraEmPixels);

    for (let i = 0; i < celulas.length - 1; i++) {
      expect(celulas[i].esquerda + celulas[i].largura).toBe(celulas[i + 1].esquerda);
    }
    expect(celulas[0].esquerda).toBe(0);
    const ultima = celulas[celulas.length - 1];
    expect(ultima.esquerda + ultima.largura).toBe(intervalo.larguraEmPixels);
  });

  it("semanas inteiras de 7 dias: 10–16 ago, 17–23 ago, 24–30 ago, 31 ago–6 set", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );
    const celulas = celulasDeSemana(intervalo, formatarMesStub);

    expect(celulas.map((c) => c.inicio)).toEqual([
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
    expect(celulas.map((c) => c.dias)).toEqual([7, 7, 7, 7]);
  });

  it("rótulo de semana que NÃO cruza o mês: '10–16 ago'", () => {
    const intervalo = calcularIntervalo(
      [{ inicio: "2026-08-12", fimExclusivo: "2026-08-25" }],
      "2026-08-12",
    );
    const celulas = celulasDeSemana(intervalo, formatarMesStub);

    expect(celulas[0].rotulo).toBe("10–16 ago");
    expect(celulas[1].rotulo).toBe("17–23 ago");
  });

  it("rótulo de semana que CRUZA o mês usa os dois meses: '31 ago–6 set'", () => {
    const intervaloCruzandoMes: IntervaloDaTimeline = {
      primeiroDia: "2026-08-24",
      ultimoDiaExclusivo: "2026-09-07",
      totalDeDias: 14,
      larguraEmPixels: 14 * 18,
    };
    const celulas = celulasDeSemana(intervaloCruzandoMes, formatarMesStub);

    expect(celulas).toHaveLength(2);
    expect(celulas[0].rotulo).toBe("24–30 ago");
    expect(celulas[1].rotulo).toBe("31 ago–6 set");
  });

  it("primeira e última célula podem ser semanas parciais quando o intervalo (montado à mão) não começa/termina numa segunda-feira", () => {
    const intervaloParcial: IntervaloDaTimeline = {
      primeiroDia: "2026-08-05",
      ultimoDiaExclusivo: "2026-08-20",
      totalDeDias: 15,
      larguraEmPixels: 15 * 18,
    };
    const celulas = celulasDeSemana(intervaloParcial, formatarMesStub);

    expect(celulas).toHaveLength(3);
    expect(celulas[0]).toMatchObject({ inicio: "2026-08-05", dias: 5 });
    expect(celulas[1]).toMatchObject({ inicio: "2026-08-10", dias: 7 });
    expect(celulas[2]).toMatchObject({ inicio: "2026-08-17", dias: 3 });
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
    primeiroDia: "2026-08-10",
    ultimoDiaExclusivo: "2026-09-07",
    totalDeDias: 28,
    larguraEmPixels: 28 * 18,
  };

  it("devolve null quando faixa.dias === 0 — nem losango, nem retângulo, nem espaço reservado", () => {
    const retangulo = retanguloDaEtapa({ dias: 0, inicio: "2026-08-12" }, intervalo);

    expect(retangulo).toBeNull();
  });

  it("etapa de 1 dia começando no primeiroDia devolve largura: 18, cortadaNaEsquerda: false, mostrarRotulo: false", () => {
    const retangulo = retanguloDaEtapa({ dias: 1, inicio: "2026-08-10" }, intervalo);

    expect(retangulo).toMatchObject({
      esquerda: 0,
      largura: 18,
      cortadaNaEsquerda: false,
      mostrarRotulo: false,
    });
  });

  it("largura exatamente 46px não mostra rótulo; 47px mostra — o limiar é estritamente 'mais de 46', não 'a partir de'", () => {
    const com46px = retanguloDaEtapa(
      { dias: 46 / PIXELS_POR_DIA, inicio: "2026-08-10" },
      intervalo,
    );
    const com47px = retanguloDaEtapa(
      { dias: 47 / PIXELS_POR_DIA, inicio: "2026-08-10" },
      intervalo,
    );

    expect(com46px?.largura).toBeCloseTo(46, 5);
    expect(com46px?.mostrarRotulo).toBe(false);
    expect(com46px?.cortadaNaEsquerda).toBe(false);
    expect(com47px?.largura).toBeCloseTo(47, 5);
    expect(com47px?.mostrarRotulo).toBe(true);
  });

  it("duas etapas adjacentes: esquerda da seguinte é exatamente esquerda + largura da anterior", () => {
    const faixaA = retanguloDaEtapa({ dias: 3, inicio: "2026-08-13" }, intervalo);
    const faixaB = retanguloDaEtapa({ dias: 2, inicio: "2026-08-16" }, intervalo);

    expect(faixaA).toMatchObject({ cortadaNaEsquerda: false });
    expect(faixaB).toMatchObject({ cortadaNaEsquerda: false });
    expect(faixaA).not.toBeNull();
    expect(faixaB).not.toBeNull();
    expect(faixaB!.esquerda).toBe(faixaA!.esquerda + faixaA!.largura);
  });

  it("caso de borda obrigatório: faixa iniciada antes de primeiroDia devolve esquerda: 0, largura reduzida e cortadaNaEsquerda: true — nunca esquerda negativa", () => {
    // Começa 5 dias antes de primeiroDia (2026-08-10), dura 8 dias — só 3 dias caem dentro da
    // timeline (2026-08-10 a 2026-08-13).
    const retangulo = retanguloDaEtapa({ dias: 8, inicio: "2026-08-05" }, intervalo);

    expect(retangulo).toMatchObject({
      esquerda: 0,
      largura: 3 * PIXELS_POR_DIA,
      cortadaNaEsquerda: true,
    });
    expect(retangulo!.esquerda).toBeGreaterThanOrEqual(0);
  });

  it("caso de borda obrigatório: faixa que termina em ou antes de primeiroDia devolve null", () => {
    // Termina EXATAMENTE em primeiroDia (2026-08-10): nenhum dia da faixa cai dentro da timeline.
    const terminaNoPrimeiroDia = retanguloDaEtapa({ dias: 5, inicio: "2026-08-05" }, intervalo);
    expect(terminaNoPrimeiroDia).toBeNull();

    // Termina bem antes de primeiroDia.
    const terminaAntes = retanguloDaEtapa({ dias: 3, inicio: "2026-07-31" }, intervalo);
    expect(terminaAntes).toBeNull();
  });
});

// D-09: a espera de um marco aparece no Gantt como vão vazio — espaço em branco entre a etapa
// anterior e o losango do marco — SEM nenhum elemento novo desenhado nesse intervalo. O plano
// 04.1-01 já desloca `inicio` da faixa do marco na cascata (`calcularCronograma`); esta suíte
// prova, por MEDIDA de pixel sobre `retanguloDaEtapa` (nenhuma mudança em `gantt.ts`/`gantt.tsx`
// foi necessária), que o vão sai de graça — nunca por inspeção visual.
describe("vão de espera do marco sai de graça, sem desenho novo (D-09)", () => {
  it("a distância entre a borda direita da esmaltação e a borda esquerda do losango da queima do esmalte é exatamente 54px (3 dias × 18px/dia)", () => {
    const dataInicio = "2026-08-12";
    const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
    const intervalo = calcularIntervalo([cronograma], dataInicio);

    const esmaltacao = cronograma.faixas.find((faixa) => faixa.etapa === "esmaltacao")!;
    const queima2 = cronograma.faixas.find((faixa) => faixa.etapa === "queima2")!;

    const retanguloEsmaltacao = retanguloDaEtapa(esmaltacao, intervalo)!;
    const retanguloQueima2 = retanguloDaEtapa(queima2, intervalo)!;

    expect(retanguloEsmaltacao).not.toBeNull();
    expect(retanguloQueima2).not.toBeNull();
    expect(
      retanguloQueima2.esquerda - (retanguloEsmaltacao.esquerda + retanguloEsmaltacao.largura),
    ).toBe(3 * PIXELS_POR_DIA);
    expect(
      retanguloQueima2.esquerda - (retanguloEsmaltacao.esquerda + retanguloEsmaltacao.largura),
    ).toBe(54);
  });

  it("a distância entre a borda direita da queima do esmalte e a borda esquerda do losango da entrega é exatamente 90px (5 dias × 18px/dia)", () => {
    const dataInicio = "2026-08-12";
    const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
    const intervalo = calcularIntervalo([cronograma], dataInicio);

    const queima2 = cronograma.faixas.find((faixa) => faixa.etapa === "queima2")!;
    const entrega = cronograma.faixas.find((faixa) => faixa.etapa === "entrega")!;

    const retanguloQueima2 = retanguloDaEtapa(queima2, intervalo)!;
    const retanguloEntrega = retanguloDaEtapa(entrega, intervalo)!;

    expect(retanguloQueima2).not.toBeNull();
    expect(retanguloEntrega).not.toBeNull();
    expect(
      retanguloEntrega.esquerda - (retanguloQueima2.esquerda + retanguloQueima2.largura),
    ).toBe(5 * PIXELS_POR_DIA);
  });

  it("caso de adjacência exata: com espera 0 na queima do esmalte, a distância cai a 0 — o marco encosta na etapa anterior, sem vão e sem sobreposição", () => {
    const dataInicio = "2026-08-12";
    const duracoesSemEsperaNaQueima2 = DIAS_PADRAO.map((duracao) =>
      duracao.etapa === "queima2" ? { ...duracao, esperaDias: 0 } : duracao,
    );
    const cronograma = calcularCronograma(dataInicio, duracoesSemEsperaNaQueima2);
    const intervalo = calcularIntervalo([cronograma], dataInicio);

    const esmaltacao = cronograma.faixas.find((faixa) => faixa.etapa === "esmaltacao")!;
    const queima2 = cronograma.faixas.find((faixa) => faixa.etapa === "queima2")!;

    const retanguloEsmaltacao = retanguloDaEtapa(esmaltacao, intervalo)!;
    const retanguloQueima2 = retanguloDaEtapa(queima2, intervalo)!;

    expect(retanguloEsmaltacao).not.toBeNull();
    expect(retanguloQueima2).not.toBeNull();
    expect(retanguloQueima2.esquerda).toBe(retanguloEsmaltacao.esquerda + retanguloEsmaltacao.largura);
    expect(
      retanguloQueima2.esquerda - (retanguloEsmaltacao.esquerda + retanguloEsmaltacao.largura),
    ).toBe(0);
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

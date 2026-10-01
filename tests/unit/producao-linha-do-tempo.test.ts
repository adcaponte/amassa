import { describe, expect, it } from "vitest";

import { etapasIniciais, type CaminhoOrdem, type StatusOrdem } from "@/lib/producao/etapas";
import type { OrdemParaLeitura } from "@/lib/producao/leitura";
import {
  deslocamentoEmPixels,
  geometriaDosSegmentos,
  intervaloDaLinhaDoTempo,
  LARGURA_MINIMA_DO_SEGMENTO,
  ordenarLinhas,
  posicaoDaEntrega,
  posicaoDeHoje,
  PX_POR_DIA,
  rolagemInicial,
  segmentosDaOrdem,
  segundasDoIntervalo,
  type IntervaloDaLinhaDoTempo,
} from "@/lib/producao/linha-do-tempo";

// Fase 06.1 (plano 09, PRD-07, D-06): a linha do tempo de cada ordem LIBERADA — o que aconteceu em
// cheio (datas reais), o previsto em listrado, a linha de hoje e o traço da entrega. "Hoje" é sempre
// argumento; nenhuma hora entra na conta (dias civis inteiros × 12px).

function ordem(
  parcial: {
    caminho?: CaminhoOrdem;
    status?: StatusOrdem;
    inicio?: string | null;
    entregaPrometida?: string | null;
    feitas?: Record<string, string>;
    previstos?: Record<string, number>;
  } = {},
): OrdemParaLeitura {
  const caminho = parcial.caminho ?? "completo";
  const feitas = parcial.feitas ?? {};
  const previstos = parcial.previstos ?? {};
  return {
    tipo: "encomenda",
    caminho,
    status: parcial.status ?? "ativa",
    entregaPrometida: parcial.entregaPrometida ?? null,
    inicio: parcial.inicio === undefined ? "2026-10-01" : parcial.inicio,
    etapas: etapasIniciais(caminho).map((etapa) => ({
      ...etapa,
      diasPrevistos: previstos[etapa.etapa] ?? etapa.diasPrevistos,
      feitaEm: feitas[etapa.etapa] ?? null,
      passaram: null,
    })),
  };
}

function intervalo(primeiroDia: string, totalDeDias: number): IntervaloDaLinhaDoTempo {
  return {
    primeiroDia,
    fimExclusivo: "2099-01-01",
    totalDeDias,
    larguraEmPixels: totalDeDias * PX_POR_DIA,
  };
}

describe("PX_POR_DIA", () => {
  it("é a escala fixa de 12px por dia do UI-SPEC", () => {
    expect(PX_POR_DIA).toBe(12);
    expect(LARGURA_MINIMA_DO_SEGMENTO).toBe(4);
  });
});

describe("intervaloDaLinhaDoTempo", () => {
  it("vai do menor início − 2 dias até a maior entre previsão e entrega + 5 dias", () => {
    // Começou em 05/10, está na produção desde então; hoje 06/10.
    // Previsão: produção 5 → termina 10/10; + 15 + 1 + 1 + 4 + 6 = 37 → 06/10 + 4 + 27 = 06/11.
    const hoje = "2026-10-06";
    const a = ordem({ inicio: "2026-10-05", entregaPrometida: "2026-11-20" });
    // A segunda começou depois e tem previsão mais tardia que a primeira, entrega mais cedo.
    const b = ordem({
      inicio: "2026-10-06",
      entregaPrometida: "2026-10-30",
      previstos: { entrega: 10 },
    });
    const intervaloCalculado = intervaloDaLinhaDoTempo([a, b], hoje);
    // Previsão de b: 06/10 + 5 + 15 + 1 + 1 + 4 + 10 = 06/10 + 36 = 11/11 → menor que a entrega 20/11.
    expect(intervaloCalculado).not.toBeNull();
    expect(intervaloCalculado?.primeiroDia).toBe("2026-10-03");
    expect(intervaloCalculado?.fimExclusivo).toBe("2026-11-25");
    expect(intervaloCalculado?.totalDeDias).toBe(53);
    expect(intervaloCalculado?.larguraEmPixels).toBe(53 * 12);
  });

  it("maior previsão 10/11 e maior entrega 20/11 → a entrega manda (de 03/10 a 25/11)", () => {
    const hoje = "2026-10-05";
    // Previsão exatamente 10/11: 05/10 + 36 dias (5 + 15 + 1 + 1 + 4 + 10).
    const a = ordem({ inicio: "2026-10-05", previstos: { entrega: 10 } });
    const b = ordem({ inicio: "2026-10-05", entregaPrometida: "2026-11-20", previstos: { entrega: 1 } });
    const resultado = intervaloDaLinhaDoTempo([a, b], hoje);
    expect(resultado?.primeiroDia).toBe("2026-10-03");
    expect(resultado?.fimExclusivo).toBe("2026-11-25");
  });

  it("sem entrega, a previsão manda o fim", () => {
    const hoje = "2026-10-05";
    const a = ordem({ inicio: "2026-10-05", previstos: { entrega: 10 } });
    // Previsão 10/11 → fim 15/11.
    expect(intervaloDaLinhaDoTempo([a], hoje)?.fimExclusivo).toBe("2026-11-15");
  });

  it("aguardando, concluída e cancelada ficam fora do cálculo", () => {
    const hoje = "2026-10-06";
    const liberada = ordem({ inicio: "2026-10-05", previstos: { entrega: 10 } });
    const aguardando = ordem({
      status: "aguardando_sinal",
      inicio: null,
      entregaPrometida: "2027-06-01",
    });
    const concluida = ordem({ status: "concluida", inicio: "2026-01-01" });
    const cancelada = ordem({ status: "cancelada", inicio: "2025-12-01" });
    const soLiberada = intervaloDaLinhaDoTempo([liberada], hoje);
    expect(intervaloDaLinhaDoTempo([aguardando, liberada, concluida, cancelada], hoje)).toEqual(
      soLiberada,
    );
  });

  it("sem nenhuma liberada, não há intervalo (null)", () => {
    expect(intervaloDaLinhaDoTempo([], "2026-10-06")).toBeNull();
    expect(
      intervaloDaLinhaDoTempo([ordem({ status: "aguardando_sinal", inicio: null })], "2026-10-06"),
    ).toBeNull();
  });

  it("uma ordem só começando hoje: hoje fica dentro do intervalo, com folga dos dois lados", () => {
    const hoje = "2026-10-07";
    const resultado = intervaloDaLinhaDoTempo([ordem({ inicio: hoje })], hoje);
    expect(resultado).not.toBeNull();
    const posicao = posicaoDeHoje(resultado as IntervaloDaLinhaDoTempo, hoje);
    expect(posicao).toBe(2 * PX_POR_DIA);
    expect(posicao).toBeLessThan((resultado as IntervaloDaLinhaDoTempo).larguraEmPixels);
  });
});

describe("segundasDoIntervalo", () => {
  it("devolve só segundas-feiras dentro do intervalo", () => {
    // 03/10/2026 é sábado; 05/10 é segunda.
    const resultado = segundasDoIntervalo({
      primeiroDia: "2026-10-03",
      fimExclusivo: "2026-10-27",
      totalDeDias: 24,
      larguraEmPixels: 24 * 12,
    });
    expect(resultado).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });

  it("atravessa a virada de mês e de ano", () => {
    // 28/12/2026 é segunda; 04/01/2027 também.
    const resultado = segundasDoIntervalo({
      primeiroDia: "2026-12-24",
      fimExclusivo: "2027-01-12",
      totalDeDias: 19,
      larguraEmPixels: 19 * 12,
    });
    expect(resultado).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]);
  });

  it("fimExclusivo numa segunda não entra", () => {
    const resultado = segundasDoIntervalo({
      primeiroDia: "2026-10-05",
      fimExclusivo: "2026-10-12",
      totalDeDias: 7,
      larguraEmPixels: 7 * 12,
    });
    expect(resultado).toEqual(["2026-10-05"]);
  });
});

describe("segmentosDaOrdem", () => {
  it("feita: cheio do início até feita_em; atual: cheio até hoje + listrado pelo que falta; futuras listradas em sequência", () => {
    const hoje = "2026-10-10";
    const a = ordem({ inicio: "2026-10-01", feitas: { producao: "2026-10-03" } });
    const segmentos = segmentosDaOrdem(a, hoje);

    expect(segmentos[0]).toMatchObject({
      etapa: "producao",
      tipo: "cheio",
      situacao: "feita",
      inicio: "2026-10-01",
      fimExclusivo: "2026-10-03",
      dias: 2,
      minimo: false,
      feitaEm: "2026-10-03",
    });
    expect(segmentos[1]).toMatchObject({
      etapa: "secagem",
      tipo: "cheio",
      situacao: "atual",
      inicio: "2026-10-03",
      fimExclusivo: "2026-10-10",
      dias: 7,
      diasNestaEtapa: 7,
      diasPrevistos: 15,
      minimo: false,
    });
    expect(segmentos[2]).toMatchObject({
      etapa: "secagem",
      tipo: "listrado",
      situacao: "atual",
      inicio: "2026-10-10",
      fimExclusivo: "2026-10-18",
      dias: 8,
    });
    // Futuras: queima1 1, esmaltação 4, queima2 1, entrega 6 — em sequência a partir de 18/10.
    expect(segmentos.slice(3).map((s) => [s.etapa, s.tipo, s.situacao, s.inicio, s.dias])).toEqual([
      ["queima1", "listrado", "prevista", "2026-10-18", 1],
      ["esmaltacao", "listrado", "prevista", "2026-10-19", 4],
      ["queima2", "listrado", "prevista", "2026-10-23", 1],
      ["entrega", "listrado", "prevista", "2026-10-24", 6],
    ]);
    // O fim do último listrado é a previsão de conclusão.
    expect(segmentos.at(-1)?.fimExclusivo).toBe("2026-10-30");
  });

  it("atual estourada: sem listrado da atual, as futuras começam em hoje", () => {
    // Secagem desde 03/10, hoje 23/10 → 20 dias, previsto 15.
    const hoje = "2026-10-23";
    const a = ordem({ inicio: "2026-10-01", feitas: { producao: "2026-10-03" } });
    const segmentos = segmentosDaOrdem(a, hoje);
    const daSecagem = segmentos.filter((s) => s.etapa === "secagem");
    expect(daSecagem).toHaveLength(1);
    expect(daSecagem[0]).toMatchObject({ tipo: "cheio", dias: 20, diasNestaEtapa: 20 });
    expect(segmentos.find((s) => s.etapa === "queima1")).toMatchObject({
      tipo: "listrado",
      inicio: "2026-10-23",
    });
  });

  it("etapa feita no mesmo dia da anterior: segmento de 0 dia marcado como mínimo", () => {
    const hoje = "2026-10-25";
    const a = ordem({
      inicio: "2026-10-01",
      feitas: { producao: "2026-10-03", secagem: "2026-10-20", queima1: "2026-10-20" },
    });
    const segmentos = segmentosDaOrdem(a, hoje);
    const queima1 = segmentos.find((s) => s.etapa === "queima1");
    expect(queima1).toMatchObject({
      tipo: "cheio",
      situacao: "feita",
      inicio: "2026-10-20",
      fimExclusivo: "2026-10-20",
      dias: 0,
      minimo: true,
    });
  });

  it("ordem começando hoje: cheio de 0 dia (mínimo) + listrado do previsto inteiro", () => {
    const hoje = "2026-10-07";
    const segmentos = segmentosDaOrdem(ordem({ inicio: hoje }), hoje);
    expect(segmentos[0]).toMatchObject({
      etapa: "producao",
      tipo: "cheio",
      situacao: "atual",
      inicio: hoje,
      dias: 0,
      minimo: true,
    });
    expect(segmentos[1]).toMatchObject({
      etapa: "producao",
      tipo: "listrado",
      inicio: hoje,
      dias: 5,
      minimo: false,
    });
  });

  it("caminho que termina no biscoito tem só as quatro etapas dele", () => {
    const segmentos = segmentosDaOrdem(ordem({ caminho: "biscoito" }), "2026-10-02");
    expect([...new Set(segmentos.map((s) => s.etapa))]).toEqual([
      "producao",
      "secagem",
      "queima1",
      "entrega",
    ]);
  });

  it("aguardando, concluída e cancelada não têm segmentos", () => {
    expect(segmentosDaOrdem(ordem({ status: "aguardando_sinal", inicio: null }), "2026-10-02")).toEqual(
      [],
    );
    expect(segmentosDaOrdem(ordem({ status: "concluida" }), "2026-10-02")).toEqual([]);
    expect(segmentosDaOrdem(ordem({ status: "cancelada" }), "2026-10-02")).toEqual([]);
  });

  it("posições em dias civis inteiros — nenhuma data com hora", () => {
    const segmentos = segmentosDaOrdem(
      ordem({ inicio: "2026-10-01", feitas: { producao: "2026-10-03" } }),
      "2026-10-10",
    );
    for (const segmento of segmentos) {
      expect(segmento.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(segmento.fimExclusivo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(segmento.dias)).toBe(true);
    }
  });
});

describe("geometriaDosSegmentos", () => {
  const base = intervalo("2026-10-01", 60);

  it("largura = dias × 12px, a partir do deslocamento do início", () => {
    const segmentos = segmentosDaOrdem(
      ordem({ inicio: "2026-10-01", feitas: { producao: "2026-10-03" } }),
      "2026-10-10",
    );
    const geometria = geometriaDosSegmentos(segmentos, base);
    expect(geometria[0]).toEqual({ esquerda: 0, largura: 24 });
    expect(geometria[1]).toEqual({ esquerda: 24, largura: 7 * 12 });
    expect(geometria[2]).toEqual({ esquerda: 9 * 12, largura: 8 * 12 });
  });

  it("segmento de 0 dia tem a largura mínima de 4px e não sobrepõe o seguinte", () => {
    const segmentos = segmentosDaOrdem(
      ordem({
        inicio: "2026-10-01",
        feitas: { producao: "2026-10-03", secagem: "2026-10-20", queima1: "2026-10-20" },
      }),
      "2026-10-25",
    );
    const geometria = geometriaDosSegmentos(segmentos, base);
    const indiceQueima1 = segmentos.findIndex((s) => s.etapa === "queima1");
    const queima1 = geometria[indiceQueima1];
    const seguinte = geometria[indiceQueima1 + 1];
    expect(queima1.largura).toBe(LARGURA_MINIMA_DO_SEGMENTO);
    expect(queima1.esquerda).toBe(19 * 12);
    // O seguinte começa onde o mínimo termina — e termina no dia dele, sem perder a posição.
    expect(seguinte.esquerda).toBe(queima1.esquerda + queima1.largura);
    expect(seguinte.esquerda + seguinte.largura).toBe(24 * 12);
    // Nenhum par vizinho se sobrepõe.
    for (let i = 1; i < geometria.length; i += 1) {
      expect(geometria[i].esquerda).toBeGreaterThanOrEqual(
        geometria[i - 1].esquerda + geometria[i - 1].largura,
      );
    }
  });

  it("ordem começando hoje: o cheio de 0 dia tem 4px", () => {
    const hoje = "2026-10-07";
    const segmentos = segmentosDaOrdem(ordem({ inicio: hoje }), hoje);
    const geometria = geometriaDosSegmentos(segmentos, base);
    expect(geometria[0]).toEqual({ esquerda: 6 * 12, largura: LARGURA_MINIMA_DO_SEGMENTO });
    expect(geometria[1].esquerda).toBe(6 * 12 + LARGURA_MINIMA_DO_SEGMENTO);
    expect(geometria[1].esquerda + geometria[1].largura).toBe(11 * 12);
  });
});

describe("posicaoDeHoje, posicaoDaEntrega e deslocamentoEmPixels", () => {
  const base = intervalo("2026-10-03", 53);

  it("deslocamento em dias inteiros × 12px", () => {
    expect(deslocamentoEmPixels(base, "2026-10-03")).toBe(0);
    expect(deslocamentoEmPixels(base, "2026-10-10")).toBe(84);
    expect(posicaoDeHoje(base, "2026-10-10")).toBe(84);
  });

  it("sem entrega prometida, não há traço (null)", () => {
    expect(posicaoDaEntrega(base, null)).toBeNull();
  });

  it("entrega já passada com a ordem em curso fica antes da linha de hoje", () => {
    const hoje = "2026-10-20";
    const entrega = posicaoDaEntrega(base, "2026-10-15");
    expect(entrega).not.toBeNull();
    expect(entrega as number).toBeLessThan(posicaoDeHoje(base, hoje));
  });

  it("entrega futura fica depois da linha de hoje", () => {
    expect(posicaoDaEntrega(base, "2026-11-20") as number).toBeGreaterThan(
      posicaoDeHoje(base, "2026-10-20"),
    );
  });
});

describe("rolagemInicial", () => {
  const base = intervalo("2026-10-01", 100); // 1200px

  it("centra hoje na área visível", () => {
    // Hoje a 50 dias = 600px; visível 400 → 600 − 200 = 400.
    expect(rolagemInicial(base, "2026-11-20", 400)).toBe(400);
  });

  it("nunca negativa", () => {
    expect(rolagemInicial(base, "2026-10-02", 400)).toBe(0);
  });

  it("nunca além de largura − visível", () => {
    expect(rolagemInicial(base, "2027-01-08", 400)).toBe(800);
  });

  it("área visível maior que a linha inteira: 0", () => {
    expect(rolagemInicial(base, "2026-11-20", 2000)).toBe(0);
  });

  it("sempre inteira", () => {
    expect(Number.isInteger(rolagemInicial(base, "2026-11-20", 401))).toBe(true);
  });
});

describe("ordenarLinhas", () => {
  it("por início, depois nome (pt-BR), depois id — sem mudar a lista recebida", () => {
    const lista = [
      { id: "b", nome: "Pratos", inicio: "2026-10-02" },
      { id: "a", nome: "Pratos", inicio: "2026-10-02" },
      { id: "c", nome: "Canecas", inicio: "2026-10-02" },
      { id: "d", nome: "Árvores", inicio: "2026-10-05" },
      { id: "e", nome: "Zebras", inicio: "2026-10-01" },
    ];
    const copia = [...lista];
    expect(ordenarLinhas(lista).map((l) => l.id)).toEqual(["e", "c", "a", "b", "d"]);
    expect(lista).toEqual(copia);
  });
});

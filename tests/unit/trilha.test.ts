import { describe, expect, it } from "vitest";

import {
  posicaoDeHojeNaTrilha,
  segmentosDaTrilha,
  type FaixaDaTrilha,
} from "../../lib/encomendas/trilha";

// Faixas dos padrões novos (DIAS_PADRAO, fase 04.1): produção 5 · secagem 15 · queima1 1 ·
// esmaltação 1 · queima2 1 (espera 3 antes) · entrega 1 (espera 5 antes) = 32 dias de
// calendário, começando em 2026-08-12 — montada à mão com a mesma cascata de
// `calcularCronograma` (espera avança o cursor ANTES do marco, sem virar faixa própria),
// mesma disciplina de `gantt.test.ts`: datas civis simples, sem depender de
// `calcularCronograma`, mas conferidas contra ele.
const FAIXAS_PADRAO: FaixaDaTrilha[] = [
  { etapa: "producao", dias: 5, esperaDias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-17" },
  { etapa: "secagem", dias: 15, esperaDias: 0, inicio: "2026-08-17", fimExclusivo: "2026-09-01" },
  { etapa: "queima1", dias: 1, esperaDias: 0, inicio: "2026-09-01", fimExclusivo: "2026-09-02" },
  { etapa: "esmaltacao", dias: 1, esperaDias: 0, inicio: "2026-09-02", fimExclusivo: "2026-09-03" },
  // Espera de 3 dias antes da queima do esmalte: o cursor pula de 2026-09-03 (fim da
  // esmaltação) para 2026-09-06 (início da queima2) sem nenhuma faixa própria no meio.
  { etapa: "queima2", dias: 1, esperaDias: 3, inicio: "2026-09-06", fimExclusivo: "2026-09-07" },
  // Espera de 5 dias antes da entrega: o cursor pula de 2026-09-07 para 2026-09-12.
  { etapa: "entrega", dias: 1, esperaDias: 5, inicio: "2026-09-12", fimExclusivo: "2026-09-13" },
];

// A mesma cascata, mas com espera 0 nos três marcos — a adjacência exata do valor degenerado
// (D-09): sem nenhum vão, as faixas ficam contíguas, exatamente como antes da fase 04.1.
const FAIXAS_SEM_ESPERA: FaixaDaTrilha[] = [
  { etapa: "producao", dias: 5, esperaDias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-17" },
  { etapa: "secagem", dias: 15, esperaDias: 0, inicio: "2026-08-17", fimExclusivo: "2026-09-01" },
  { etapa: "queima1", dias: 1, esperaDias: 0, inicio: "2026-09-01", fimExclusivo: "2026-09-02" },
  { etapa: "esmaltacao", dias: 1, esperaDias: 0, inicio: "2026-09-02", fimExclusivo: "2026-09-03" },
  { etapa: "queima2", dias: 1, esperaDias: 0, inicio: "2026-09-03", fimExclusivo: "2026-09-04" },
  { etapa: "entrega", dias: 1, esperaDias: 0, inicio: "2026-09-04", fimExclusivo: "2026-09-05" },
];

describe("posicaoDeHojeNaTrilha", () => {
  it("hoje no início do período devolve 0", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-12")).toBe(0);
  });

  it("o 27º dia (dentro do vão de espera antes da entrega) devolve um percentual válido, NUNCA null — pela soma de dias das etapas (24) ele cairia fora e a marca sumiria no meio da encomenda", () => {
    const posicao = posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-09-08");

    expect(posicao).not.toBeNull();
    expect(posicao).toBeGreaterThan(0);
    expect(posicao).toBeLessThan(100);
    // decorridos = 27 dias desde 2026-08-12, extensão total = 32.
    expect(posicao).toBeCloseTo((27 / 32) * 100, 10);
  });

  it("o último dia desenhado (início da entrega) devolve um percentual menor que 100, nunca null", () => {
    const posicao = posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-09-12");

    expect(posicao).not.toBeNull();
    expect(posicao).toBeLessThan(100);
    expect(posicao).toBeCloseTo((31 / 32) * 100, 10);
  });

  it("o dia seguinte ao último dia desenhado (fimExclusivo do período) devolve null", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-09-13")).toBeNull();
  });

  it("hoje anterior ao início do período devolve null", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-11")).toBeNull();
  });

  it("lista vazia devolve null", () => {
    expect(posicaoDeHojeNaTrilha([], "2026-08-12")).toBeNull();
  });

  it("todas as faixas com dias: 0 devolve null, sem lançar", () => {
    const faixasZeradas: FaixaDaTrilha[] = [
      { etapa: "queima1", dias: 0, esperaDias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-12" },
      { etapa: "queima2", dias: 0, esperaDias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-12" },
    ];

    expect(() => posicaoDeHojeNaTrilha(faixasZeradas, "2026-08-12")).not.toThrow();
    expect(posicaoDeHojeNaTrilha(faixasZeradas, "2026-08-12")).toBeNull();
  });
});

describe("segmentosDaTrilha", () => {
  it("devolve 6 segmentos de etapa e 2 vãos, em ordem de calendário, para os padrões", () => {
    const segmentos = segmentosDaTrilha(FAIXAS_PADRAO);

    expect(segmentos.filter((s) => s.tipo === "etapa")).toHaveLength(6);
    expect(segmentos.filter((s) => s.tipo === "vao")).toHaveLength(2);

    // Ordem de calendário: o vão vem IMEDIATAMENTE ANTES da etapa que ele antecede.
    expect(segmentos.map((s) => `${s.tipo}:${s.etapa}`)).toEqual([
      "etapa:producao",
      "etapa:secagem",
      "etapa:queima1",
      "etapa:esmaltacao",
      "vao:queima2",
      "etapa:queima2",
      "vao:entrega",
      "etapa:entrega",
    ]);
  });

  it("cada vão carrega os dias de espera corretos (3 antes da queima do esmalte, 5 antes da entrega)", () => {
    const segmentos = segmentosDaTrilha(FAIXAS_PADRAO);
    const vaoQueima2 = segmentos.find((s) => s.tipo === "vao" && s.etapa === "queima2");
    const vaoEntrega = segmentos.find((s) => s.tipo === "vao" && s.etapa === "entrega");

    expect(vaoQueima2).toMatchObject({ dias: 3 });
    expect(vaoEntrega).toMatchObject({ dias: 5 });
  });

  it("a soma de todos os percentuais é 100 (tolerância de ponto flutuante), e nenhum item se sobrepõe a outro", () => {
    const segmentos = segmentosDaTrilha(FAIXAS_PADRAO);
    const somaPercentuais = segmentos.reduce((total, s) => total + s.percentual, 0);

    expect(somaPercentuais).toBeCloseTo(100, 8);

    // "Nenhuma sobreposição" — cada item ocupa uma fatia contígua da régua percentual; a soma
    // acumulada nunca ultrapassa 100 até o último item, e cada fatia é > 0.
    let acumulado = 0;
    for (const segmento of segmentos) {
      expect(segmento.percentual).toBeGreaterThan(0);
      acumulado += segmento.percentual;
      expect(acumulado).toBeLessThanOrEqual(100 + 1e-8);
    }
  });

  it("com espera 0 em todos os marcos, devolve só os 6 segmentos de etapa, nenhum vão — a adjacência exata do valor degenerado", () => {
    const segmentos = segmentosDaTrilha(FAIXAS_SEM_ESPERA);

    expect(segmentos.every((s) => s.tipo === "etapa")).toBe(true);
    expect(segmentos).toHaveLength(6);
  });

  it("com espera 0 em todos os marcos, o resultado é numericamente idêntico ao percentual por duração (dias / soma de dias)", () => {
    const segmentos = segmentosDaTrilha(FAIXAS_SEM_ESPERA);
    const somaDeDias = FAIXAS_SEM_ESPERA.reduce((total, faixa) => total + faixa.dias, 0);

    for (const segmento of segmentos) {
      const faixaOriginal = FAIXAS_SEM_ESPERA.find((f) => f.etapa === segmento.etapa)!;
      expect(segmento.percentual).toBeCloseTo((faixaOriginal.dias / somaDeDias) * 100, 10);
    }
  });

  it("lista vazia devolve lista vazia, sem lançar", () => {
    expect(() => segmentosDaTrilha([])).not.toThrow();
    expect(segmentosDaTrilha([])).toEqual([]);
  });

  it("lista com todas as faixas não desenhadas (dias: 0) devolve lista vazia, sem lançar", () => {
    const faixasZeradas: FaixaDaTrilha[] = [
      { etapa: "queima1", dias: 0, esperaDias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-12" },
      { etapa: "queima2", dias: 0, esperaDias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-12" },
    ];

    expect(() => segmentosDaTrilha(faixasZeradas)).not.toThrow();
    expect(segmentosDaTrilha(faixasZeradas)).toEqual([]);
  });
});

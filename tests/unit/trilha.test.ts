import { describe, expect, it } from "vitest";

import { posicaoDeHojeNaTrilha, type FaixaDaTrilha } from "../../lib/encomendas/trilha";

// Faixas padrão (DIAS_PADRAO): produção 3 · secagem 6 · queima1 1 · esmaltação 1 · queima2 1 ·
// entrega 1 = 13 dias, começando em 2026-08-12 (cascata montada à mão, mesma disciplina de
// gantt.test.ts — datas civis simples, sem depender de `calcularCronograma`).
const FAIXAS_PADRAO: FaixaDaTrilha[] = [
  { dias: 3, inicio: "2026-08-12", fimExclusivo: "2026-08-15" },
  { dias: 6, inicio: "2026-08-15", fimExclusivo: "2026-08-21" },
  { dias: 1, inicio: "2026-08-21", fimExclusivo: "2026-08-22" },
  { dias: 1, inicio: "2026-08-22", fimExclusivo: "2026-08-23" },
  { dias: 1, inicio: "2026-08-23", fimExclusivo: "2026-08-24" },
  { dias: 1, inicio: "2026-08-24", fimExclusivo: "2026-08-25" },
];

describe("posicaoDeHojeNaTrilha", () => {
  it("hoje no início das faixas padrão devolve 0", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-12")).toBe(0);
  });

  it("hoje = início + 3 dias devolve 3/13 * 100", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-15")).toBeCloseTo((3 / 13) * 100, 10);
  });

  it("hoje anterior ao início devolve null", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-11")).toBeNull();
  });

  it("hoje igual ao fimExclusivo do período (dia seguinte ao último) devolve null", () => {
    expect(posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-25")).toBeNull();
  });

  it("hoje no último dia desenhado devolve um percentual menor que 100, nunca 100", () => {
    const posicao = posicaoDeHojeNaTrilha(FAIXAS_PADRAO, "2026-08-24");

    expect(posicao).not.toBeNull();
    expect(posicao).toBeLessThan(100);
    expect(posicao).toBeCloseTo((12 / 13) * 100, 10);
  });

  it("todas as faixas com dias: 0 devolve null", () => {
    const faixasZeradas: FaixaDaTrilha[] = [
      { dias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-12" },
      { dias: 0, inicio: "2026-08-12", fimExclusivo: "2026-08-12" },
    ];

    expect(posicaoDeHojeNaTrilha(faixasZeradas, "2026-08-12")).toBeNull();
  });

  it("uma faixa de dias: 0 no meio não desloca a conta — não é desenhada", () => {
    const faixasComZeroNoMeio: FaixaDaTrilha[] = [
      { dias: 3, inicio: "2026-08-12", fimExclusivo: "2026-08-15" },
      { dias: 0, inicio: "2026-08-15", fimExclusivo: "2026-08-15" },
      { dias: 6, inicio: "2026-08-15", fimExclusivo: "2026-08-21" },
    ];
    const faixasSemAEtapaZerada: FaixaDaTrilha[] = [
      { dias: 3, inicio: "2026-08-12", fimExclusivo: "2026-08-15" },
      { dias: 6, inicio: "2026-08-15", fimExclusivo: "2026-08-21" },
    ];

    expect(posicaoDeHojeNaTrilha(faixasComZeroNoMeio, "2026-08-17")).toBeCloseTo(
      posicaoDeHojeNaTrilha(faixasSemAEtapaZerada, "2026-08-17")!,
      10,
    );
  });
});

import { describe, expect, it } from "vitest";

import { quantasCabem, type MedidasUteisDoForno } from "@/lib/precificacao/forno";

// 04.5-01-PLAN.md, Tarefa 2 — quantas peças cabem no forno pelas MEDIDAS (D-12), nunca pelo
// volume. Forno de referência: 350×350×350 mm por dentro (D-08), folga de 15 mm entre peças
// esmaltadas, 30 mm de prateleira + pilar somados à altura da peça, fator de 1,8× no biscoito.
const FORNO_DE_REFERENCIA: MedidasUteisDoForno = {
  larguraMm: 350,
  profundidadeMm: 350,
  alturaMm: 350,
  folgaMm: 15,
  prateleiraEPilarMm: 30,
  fatorBiscoitoMilesimos: 1800,
};

describe("quantasCabem", () => {
  it("peça 120×90×100 mm: por prateleira pelo melhor das duas orientações, níveis, esmalte e biscoito", () => {
    const resultado = quantasCabem(
      { larguraMm: 120, profundidadeMm: 90, alturaMm: 100 },
      FORNO_DE_REFERENCIA,
    );

    // Orientação 1: ⌊365/135⌋×⌊365/105⌋ = 2×3 = 6. Orientação 2 (forno cúbico): mesmo produto.
    expect(resultado.porPrateleira).toBe(6);
    // Níveis: ⌊350/(100+30)⌋ = ⌊2,69⌋ = 2.
    expect(resultado.niveis).toBe(2);
    expect(resultado.esmalte).toBe(12); // 6 × 2
    expect(resultado.biscoito).toBe(21); // ⌊12 × 1800/1000⌋ = ⌊21,6⌋
    expect(resultado.cabe).toBe(true);
    expect(resultado.esmalteAutomatico).toBe(true);
    expect(resultado.biscoitoAutomatico).toBe(true);
  });

  it("prato 270×270×30 mm: cabe 1 por prateleira (o caso real do D-08) e vários níveis — NUNCA o número por volume", () => {
    const resultado = quantasCabem(
      { larguraMm: 270, profundidadeMm: 270, alturaMm: 30 },
      FORNO_DE_REFERENCIA,
    );

    expect(resultado.porPrateleira).toBe(1); // ⌊365/285⌋×⌊365/285⌋ = 1×1
    expect(resultado.niveis).toBe(5); // ⌊350/(30+30)⌋ = ⌊5,83⌋
    expect(resultado.esmalte).toBe(5); // 1 × 5, NUNCA por volume

    // Registro do que uma conta ingênua por volume daria — só para provar a diferença (D-12): o
    // módulo real nunca faz esta conta.
    const volumeDaPeca = 270 * 270 * 30;
    const volumeDoForno = 350 * 350 * 350;
    const estimativaPorVolume = Math.floor(volumeDoForno / volumeDaPeca);
    expect(estimativaPorVolume).not.toBe(resultado.esmalte);
    expect(estimativaPorVolume).toBeGreaterThan(resultado.esmalte * 2); // erra bem mais que 2×
  });

  it("peça maior que o forno em qualquer dimensão: cabe false, contagens em 0", () => {
    const resultado = quantasCabem(
      { larguraMm: 400, profundidadeMm: 400, alturaMm: 400 },
      FORNO_DE_REFERENCIA,
    );

    expect(resultado.porPrateleira).toBe(0);
    expect(resultado.niveis).toBe(0);
    expect(resultado.esmalte).toBe(0);
    expect(resultado.biscoito).toBe(0);
    expect(resultado.cabe).toBe(false);
  });

  it('"já contei" (esmalte) substitui o calculado e marca o campo como não-calculado', () => {
    const resultado = quantasCabem(
      { larguraMm: 120, profundidadeMm: 90, alturaMm: 100 },
      FORNO_DE_REFERENCIA,
      { esmalte: 8 },
    );

    expect(resultado.esmalte).toBe(8);
    expect(resultado.esmalteAutomatico).toBe(false);
    // Biscoito continua calculado — os dois campos são independentes.
    expect(resultado.biscoito).toBe(21);
    expect(resultado.biscoitoAutomatico).toBe(true);
  });

  it('"já contei" (biscoito) substitui o calculado e marca o campo como não-calculado, independente do esmalte', () => {
    const resultado = quantasCabem(
      { larguraMm: 120, profundidadeMm: 90, alturaMm: 100 },
      FORNO_DE_REFERENCIA,
      { biscoito: 30 },
    );

    expect(resultado.biscoito).toBe(30);
    expect(resultado.biscoitoAutomatico).toBe(false);
    expect(resultado.esmalte).toBe(12);
    expect(resultado.esmalteAutomatico).toBe(true);
  });

  it('"já contei" com 0 é um valor informado válido, não "sem informação"', () => {
    const resultado = quantasCabem(
      { larguraMm: 120, profundidadeMm: 90, alturaMm: 100 },
      FORNO_DE_REFERENCIA,
      { esmalte: 0 },
    );

    expect(resultado.esmalte).toBe(0);
    expect(resultado.esmalteAutomatico).toBe(false);
    expect(resultado.cabe).toBe(false); // esmalte 0 → não cabe, mesmo com biscoito calculado > 0
  });
});

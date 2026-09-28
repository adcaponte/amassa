import { describe, expect, it } from "vitest";

import { contasQueVencem, DIAS_DE_HORIZONTE } from "../../lib/financeiro/vencimentos";
import type { ContaEmAberto } from "../../lib/financeiro/consultas";

// Nomes inventados nos dados, nunca real (o repositório é público).
function conta(parcial: Partial<ContaEmAberto> & { vencimento: string }): ContaEmAberto {
  return {
    documentoId: "00000000-0000-0000-0000-000000000000",
    parcelaId: parcial.parcelaId ?? "00000000-0000-0000-0000-000000000001",
    numeroDocumento: 1,
    numeroParcela: 1,
    deQuantas: 1,
    tipo: "despesa",
    titulo: "[e2e] Conta de teste",
    pessoa: null,
    rotulo: null,
    valorCentavos: 10000,
    forma: "dinheiro",
    ...parcial,
  };
}

describe("contasQueVencem", () => {
  const hoje = "2026-12-18";

  it("DIAS_DE_HORIZONTE é 7 (D-05)", () => {
    expect(DIAS_DE_HORIZONTE).toBe(7);
  });

  it("vencimento igual a hoje entra em aVencer, não em vencidas", () => {
    const { vencidas, aVencer } = contasQueVencem(
      [conta({ parcelaId: "p1", vencimento: hoje })],
      hoje,
    );
    expect(vencidas).toHaveLength(0);
    expect(aVencer.map((c) => c.parcelaId)).toEqual(["p1"]);
  });

  it("vencimento em hoje + 7 dias entra em aVencer — fronteira DENTRO", () => {
    const { aVencer } = contasQueVencem(
      [conta({ parcelaId: "p7", vencimento: "2026-12-25" })],
      hoje,
    );
    expect(aVencer.map((c) => c.parcelaId)).toEqual(["p7"]);
  });

  it("vencimento em hoje + 8 dias NÃO entra em nenhum grupo — fronteira FORA", () => {
    const { vencidas, aVencer } = contasQueVencem(
      [conta({ parcelaId: "p8", vencimento: "2026-12-26" })],
      hoje,
    );
    expect(vencidas).toHaveLength(0);
    expect(aVencer).toHaveLength(0);
  });

  it("vencimento em hoje - 1 dia entra em vencidas, marcada", () => {
    const { vencidas, aVencer } = contasQueVencem(
      [conta({ parcelaId: "ontem", vencimento: "2026-12-17" })],
      hoje,
    );
    expect(vencidas.map((c) => c.parcelaId)).toEqual(["ontem"]);
    expect(aVencer).toHaveLength(0);
  });

  it("as vencidas saem separadas das que vão vencer, cada grupo preservando a ordem de entrada", () => {
    const contas = [
      conta({ parcelaId: "vence-hoje", vencimento: "2026-12-18" }),
      conta({ parcelaId: "vencida-ha-5", vencimento: "2026-12-13" }),
      conta({ parcelaId: "vence-em-3", vencimento: "2026-12-21" }),
      conta({ parcelaId: "vencida-ontem", vencimento: "2026-12-17" }),
    ];
    const { vencidas, aVencer } = contasQueVencem(contas, hoje);
    expect(vencidas.map((c) => c.parcelaId)).toEqual(["vencida-ha-5", "vencida-ontem"]);
    expect(aVencer.map((c) => c.parcelaId)).toEqual(["vence-hoje", "vence-em-3"]);
  });

  it("lista vazia devolve os dois grupos vazios, sem erro", () => {
    expect(contasQueVencem([], hoje)).toEqual({ vencidas: [], aVencer: [] });
  });

  it("chamar duas vezes com o mesmo argumento devolve o mesmo resultado — não lê o relógio", () => {
    const contas = [conta({ parcelaId: "p1", vencimento: hoje })];
    const primeira = contasQueVencem(contas, hoje);
    const segunda = contasQueVencem(contas, hoje);
    expect(primeira).toEqual(segunda);
  });

  it("vencimento em formato inesperado é descartado, nunca posicionado por acaso", () => {
    const { vencidas, aVencer } = contasQueVencem(
      [conta({ parcelaId: "quebrada", vencimento: "não é uma data" })],
      hoje,
    );
    expect(vencidas).toHaveLength(0);
    expect(aVencer).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";

import { etapasIniciais } from "@/lib/producao/etapas";
import type { OrdemParaLeitura } from "@/lib/producao/leitura";
import { planejarTerminar } from "@/lib/producao/transicoes";

// Fase 06.1 (plano 01): "Terminei" decidido sob a trava da ordem, contra a etapa ESPERADA (o que o
// botão mostrava) — é o que recusa o toque duplo e o segundo celular (Pitfall 7). As demais
// transições são dos planos 03, 05 e 06.

function ordem(
  parcial: Partial<OrdemParaLeitura> & { feitas?: Record<string, string> } = {},
): OrdemParaLeitura {
  const { feitas = {}, ...resto } = parcial;
  const caminho = resto.caminho ?? "completo";
  return {
    tipo: "casa",
    caminho,
    status: "ativa",
    entregaPrometida: null,
    inicio: "2026-03-01",
    etapas: etapasIniciais(caminho).map((etapa) => ({
      ...etapa,
      feitaEm: feitas[etapa.etapa] ?? null,
      passaram: null,
    })),
    ...resto,
  };
}

describe("planejarTerminar", () => {
  it("etapa esperada = atual → ok, feita hoje, a próxima vira a atual e o parcial é limpo", () => {
    expect(planejarTerminar(ordem(), "producao", "2026-03-04")).toEqual({
      tipo: "ok",
      etapa: "producao",
      feitaEm: "2026-03-04",
      proxima: "secagem",
      limparPassaram: true,
    });
  });

  it("no caminho biscoito, depois da queima de biscoito vem a entrega", () => {
    const plano = planejarTerminar(
      ordem({ caminho: "biscoito", feitas: { producao: "2026-03-05", secagem: "2026-03-20" } }),
      "queima1",
      "2026-03-21",
    );
    expect(plano).toMatchObject({ tipo: "ok", etapa: "queima1", proxima: "entrega" });
  });

  it("etapa esperada ≠ atual → recusa “já marcada” (toque duplo, outro celular)", () => {
    const jaMarcada = ordem({ feitas: { producao: "2026-03-04" } });
    expect(planejarTerminar(jaMarcada, "producao", "2026-03-04")).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
  });

  it("ordem que não está ativa → recusa", () => {
    expect(
      planejarTerminar(ordem({ status: "aguardando_sinal", inicio: null }), "producao", "2026-03-04"),
    ).toEqual({ tipo: "recusa", motivo: "nao-ativa" });
    expect(planejarTerminar(ordem({ status: "concluida" }), "producao", "2026-03-04")).toEqual({
      tipo: "recusa",
      motivo: "nao-ativa",
    });
  });

  it("etapa atual entrega → recusa “última etapa” (isso é concluir, plano 11)", () => {
    const naEntrega = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20", queima1: "2026-03-21" },
    });
    expect(planejarTerminar(naEntrega, "entrega", "2026-03-22")).toEqual({
      tipo: "recusa",
      motivo: "ultima-etapa",
    });
  });

  it("terminar no mesmo dia em que a anterior foi feita é aceito", () => {
    const plano = planejarTerminar(
      ordem({ feitas: { producao: "2026-03-05" } }),
      "secagem",
      "2026-03-05",
    );
    expect(plano).toMatchObject({ tipo: "ok", etapa: "secagem", feitaEm: "2026-03-05" });
  });
});

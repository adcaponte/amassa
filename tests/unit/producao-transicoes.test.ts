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

// Fase 06.1 (plano 02): "Terminei" nas bordas — todos os estados que não andam, a etapa esperada
// errada em qualquer posição do caminho (a já feita e a futura) e o parcial que não sobrevive.

describe("planejarTerminar nas bordas", () => {
  it("recusa ordem cancelada (além de aguardando e concluída)", () => {
    expect(planejarTerminar(ordem({ status: "cancelada" }), "producao", "2026-03-04")).toEqual({
      tipo: "recusa",
      motivo: "nao-ativa",
    });
  });

  it("o parcial (“já passaram N”) da etapa que termina é limpo (Pitfall 8)", () => {
    const base = ordem({ feitas: { producao: "2026-03-05" } });
    const comParcial = {
      ...base,
      etapas: base.etapas.map((etapa) =>
        etapa.etapa === "secagem" ? { ...etapa, passaram: 3 } : etapa,
      ),
    };
    expect(planejarTerminar(comParcial, "secagem", "2026-03-20")).toMatchObject({
      tipo: "ok",
      etapa: "secagem",
      proxima: "queima1",
      limparPassaram: true,
    });
  });

  it("etapa esperada ≠ atual → “já marcada”, em qualquer posição (a já feita e a futura)", () => {
    for (const caminho of ["completo", "biscoito"] as const) {
      const etapas = etapasIniciais(caminho).map((etapa) => etapa.etapa);
      // A atual percorre todas as posições que ainda se "terminam" (todas menos a entrega).
      for (let atual = 0; atual < etapas.length - 1; atual += 1) {
        const feitas = Object.fromEntries(
          etapas.slice(0, atual).map((etapa) => [etapa, "2026-03-05"]),
        );
        const naPosicao = ordem({ caminho, feitas });
        for (const esperada of etapas) {
          if (esperada === etapas[atual]) {
            expect(planejarTerminar(naPosicao, esperada, "2026-03-06")).toMatchObject({
              tipo: "ok",
              etapa: esperada,
              proxima: etapas[atual + 1],
            });
          } else {
            expect(planejarTerminar(naPosicao, esperada, "2026-03-06")).toEqual({
              tipo: "recusa",
              motivo: "ja-marcada",
            });
          }
        }
      }
    }
  });

  it("no caminho biscoito, a esmaltação e a queima de esmalte nunca são a etapa esperada certa", () => {
    const naQueima1 = ordem({
      caminho: "biscoito",
      feitas: { producao: "2026-03-05", secagem: "2026-03-20" },
    });
    expect(planejarTerminar(naQueima1, "esmaltacao", "2026-03-21")).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
    expect(planejarTerminar(naQueima1, "queima2", "2026-03-21")).toEqual({
      tipo: "recusa",
      motivo: "ja-marcada",
    });
  });

  it("“última etapa” também no caminho completo: a entrega não se termina", () => {
    const naEntrega = ordem({
      feitas: {
        producao: "2026-03-05",
        secagem: "2026-03-10",
        queima1: "2026-03-11",
        esmaltacao: "2026-03-12",
        queima2: "2026-03-20",
      },
    });
    expect(planejarTerminar(naEntrega, "entrega", "2026-03-22")).toEqual({
      tipo: "recusa",
      motivo: "ultima-etapa",
    });
  });

  it("virada de ano: termina em 02/01 uma etapa começada em 30/12 — a data é o hoje recebido", () => {
    expect(
      planejarTerminar(ordem({ feitas: { producao: "2026-12-30" } }), "secagem", "2027-01-02"),
    ).toMatchObject({ tipo: "ok", feitaEm: "2027-01-02", proxima: "queima1" });
  });
});

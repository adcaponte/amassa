import { describe, expect, it } from "vitest";

import { etapasIniciais } from "@/lib/producao/etapas";
import {
  etapaAtual,
  leituraDaOrdem,
  levouDias,
  seloDaOrdem,
  type LeituraDaOrdem,
  type OrdemParaLeitura,
} from "@/lib/producao/leitura";

// Fase 06.1 (plano 01): os casos do traçador. A bateria completa de bordas (virada de ano, 29/02,
// entrega já passada, feitas fora de prefixo em todas as posições) é do plano 02.

function ordem(
  parcial: Partial<OrdemParaLeitura> & { feitas?: Record<string, string> } = {},
): OrdemParaLeitura {
  const { feitas = {}, ...resto } = parcial;
  const caminho = resto.caminho ?? "completo";
  return {
    tipo: "encomenda",
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

describe("etapaAtual", () => {
  it("é a primeira etapa sem feita_em", () => {
    expect(etapaAtual(ordem())).toEqual({ etapa: "producao", indice: 0 });
    expect(etapaAtual(ordem({ feitas: { producao: "2026-03-05" } }))).toEqual({
      etapa: "secagem",
      indice: 1,
    });
  });

  it("devolve null quando todas estão feitas", () => {
    const todas = Object.fromEntries(
      etapasIniciais("biscoito").map((etapa) => [etapa.etapa, "2026-03-05"]),
    );
    expect(etapaAtual(ordem({ caminho: "biscoito", feitas: todas }))).toBeNull();
  });

  it("não depende da ordem em que as etapas chegam — ordena por posição", () => {
    const base = ordem({ feitas: { producao: "2026-03-05" } });
    const embaralhada = { ...base, etapas: [...base.etapas].reverse() };
    expect(etapaAtual(embaralhada)).toEqual({ etapa: "secagem", indice: 1 });
  });

  it("feitas fora de prefixo são RangeError", () => {
    expect(() => etapaAtual(ordem({ feitas: { secagem: "2026-03-05" } }))).toThrow(RangeError);
  });
});

describe("leituraDaOrdem", () => {
  it("ativa, início 01/03, produção feita em 05/03, hoje 10/03 → secagem há 5 dias, previsto 15", () => {
    const leitura = leituraDaOrdem(ordem({ feitas: { producao: "2026-03-05" } }), "2026-03-10");
    expect(leitura).toEqual({
      tipo: "em-andamento",
      etapa: "secagem",
      indice: 1,
      desde: "2026-03-05",
      diasNestaEtapa: 5,
      previstoDaEtapa: 15,
      estouroDias: 0,
      // hoje + max(0, 15 − 5) + (1 + 1 + 4 + 6) = 10/03 + 22 = 01/04
      previsaoDeConclusao: "2026-04-01",
      folgaDias: null,
    });
  });

  it("na primeira etapa, `desde` é o início da ordem", () => {
    const leitura = leituraDaOrdem(ordem(), "2026-03-04");
    expect(leitura).toMatchObject({ etapa: "producao", desde: "2026-03-01", diasNestaEtapa: 3 });
  });

  it("estouro = dias nesta etapa além do previsto; a previsão não conta dia negativo", () => {
    const leitura = leituraDaOrdem(ordem(), "2026-03-08");
    // produção prevista 5, está há 7 → estouro 2; previsão = hoje + 0 + (15+1+1+4+6 = 27)
    expect(leitura).toMatchObject({
      diasNestaEtapa: 7,
      estouroDias: 2,
      previsaoDeConclusao: "2026-04-04",
    });
  });

  it("folga = entrega prometida − previsão", () => {
    const leitura = leituraDaOrdem(
      ordem({ entregaPrometida: "2026-04-03", feitas: { producao: "2026-03-05" } }),
      "2026-03-10",
    );
    expect(leitura).toMatchObject({ previsaoDeConclusao: "2026-04-01", folgaDias: 2 });
  });

  it("hoje antes do `desde` não dá dia negativo nesta etapa", () => {
    const leitura = leituraDaOrdem(ordem({ inicio: "2026-03-10" }), "2026-03-09");
    expect(leitura).toMatchObject({ diasNestaEtapa: 0 });
  });

  it("aguardando, concluída e cancelada não têm etapa em andamento", () => {
    expect(leituraDaOrdem(ordem({ status: "aguardando_sinal", inicio: null }), "2026-03-10")).toEqual({
      tipo: "aguardando",
    });
    expect(leituraDaOrdem(ordem({ status: "concluida" }), "2026-03-10")).toEqual({
      tipo: "concluida",
    });
    expect(leituraDaOrdem(ordem({ status: "cancelada" }), "2026-03-10")).toEqual({
      tipo: "cancelada",
    });
  });

  it("ordem ativa com todas as etapas feitas é RangeError", () => {
    const todas = Object.fromEntries(
      etapasIniciais("completo").map((etapa) => [etapa.etapa, "2026-03-05"]),
    );
    expect(() => leituraDaOrdem(ordem({ feitas: todas }), "2026-03-10")).toThrow(RangeError);
  });

  it("ordem ativa sem início é RangeError", () => {
    expect(() => leituraDaOrdem(ordem({ inicio: null }), "2026-03-10")).toThrow(RangeError);
  });
});

describe("seloDaOrdem", () => {
  const emAndamento = (folgaDias: number | null, estouroDias: number): LeituraDaOrdem => ({
    tipo: "em-andamento",
    etapa: "secagem",
    indice: 1,
    desde: "2026-03-05",
    diasNestaEtapa: 5,
    previstoDaEtapa: 15,
    estouroDias,
    previsaoDeConclusao: "2026-04-01",
    folgaDias,
  });

  it("aguardando → aguardando-sinal", () => {
    expect(seloDaOrdem({ tipo: "aguardando" })).toEqual({ tipo: "aguardando-sinal" });
  });

  it("folga −3 → vai atrasar 3", () => {
    expect(seloDaOrdem(emAndamento(-3, 0))).toEqual({ tipo: "vai-atrasar", dias: 3 });
  });

  it("atrasada E estourada → só “vai atrasar”", () => {
    expect(seloDaOrdem(emAndamento(-1, 4))).toEqual({ tipo: "vai-atrasar", dias: 1 });
  });

  it("estouro 2 com folga ≥ 0 → +2 nesta etapa", () => {
    expect(seloDaOrdem(emAndamento(0, 2))).toEqual({ tipo: "passou-nesta-etapa", dias: 2 });
    expect(seloDaOrdem(emAndamento(null, 2))).toEqual({ tipo: "passou-nesta-etapa", dias: 2 });
  });

  it("folga 0 e estouro 0 → no ritmo", () => {
    expect(seloDaOrdem(emAndamento(0, 0))).toEqual({ tipo: "no-ritmo" });
  });

  it("concluída e cancelada → encerrada", () => {
    expect(seloDaOrdem({ tipo: "concluida" })).toEqual({ tipo: "encerrada" });
    expect(seloDaOrdem({ tipo: "cancelada" })).toEqual({ tipo: "encerrada" });
  });
});

describe("levouDias", () => {
  it("cada etapa feita levou do `desde` dela até o feita_em", () => {
    const levou = levouDias(ordem({ feitas: { producao: "2026-03-05", secagem: "2026-03-20" } }));
    expect(levou.get("producao")).toBe(4);
    expect(levou.get("secagem")).toBe(15);
    expect(levou.has("queima1")).toBe(false);
  });

  it("etapa feita no mesmo dia da anterior levou 0 dias", () => {
    const levou = levouDias(ordem({ feitas: { producao: "2026-03-05", secagem: "2026-03-05" } }));
    expect(levou.get("secagem")).toBe(0);
  });
});

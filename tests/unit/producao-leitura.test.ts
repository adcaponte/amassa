import { describe, expect, it } from "vitest";

import { diasEntre, somarDias } from "@/lib/producao/calendario";
import { etapasIniciais } from "@/lib/producao/etapas";
import {
  etapaAtual,
  leituraDaOrdem,
  levouDias,
  previsaoDaNovaOrdem,
  seloDaOrdem,
  type LeituraDaOrdem,
  type OrdemParaLeitura,
} from "@/lib/producao/leitura";

// Fase 06.1 (plano 01): os casos do traçador. A bateria completa de bordas (virada de ano, 29/02,
// entrega já passada, feitas fora de prefixo em todas as posições) está no fim do arquivo (plano 02).

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

  it("concluída → encerrada", () => {
    expect(seloDaOrdem({ tipo: "concluida" })).toEqual({ tipo: "encerrada" });
  });

  // Plano 06: a cancelada tem selo próprio, "cancelada" (neutro) — cancelada não é sucesso.
  it("cancelada → cancelada", () => {
    expect(seloDaOrdem({ tipo: "cancelada" })).toEqual({ tipo: "cancelada" });
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

// Fase 06.1 (plano 02): as bordas. Calendário (virada de ano, 29/02), estado (entrega já passada,
// sem entrega, etapa atual `entrega`) e dado incoerente (feitas fora de prefixo em todas as
// posições, `feita_em` que decresce) — dado incoerente é RangeError, nunca uma etapa inventada.

describe("calendário nas bordas (PRD-03, PRD-12 · precision)", () => {
  it("virada de ano: produção feita em 30/12, hoje 02/01 → 3 dias na secagem, previsão em janeiro", () => {
    const leitura = leituraDaOrdem(
      ordem({ inicio: "2026-12-20", feitas: { producao: "2026-12-30" } }),
      "2027-01-02",
    );
    // hoje + max(0, 15 − 3) + (1 + 1 + 4 + 6) = 02/01 + 24 = 26/01/2027
    expect(leitura).toMatchObject({
      etapa: "secagem",
      desde: "2026-12-30",
      diasNestaEtapa: 3,
      estouroDias: 0,
      previsaoDeConclusao: "2027-01-26",
    });
  });

  it("29/02 de ano bissexto conta como dia — somarDias e diasEntre", () => {
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDias("2028-02-29", 1)).toBe("2028-03-01");
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2);
    // Ano não bissexto: de 28/02 a 01/03 é 1 dia só.
    expect(diasEntre("2027-02-28", "2027-03-01")).toBe(1);
  });

  it("leitura com hoje = 29/02/2028: dias nesta etapa e previsão atravessam o dia a mais", () => {
    const leitura = leituraDaOrdem(ordem({ inicio: "2028-02-27" }), "2028-02-29");
    // produção há 2 dias, previsto 5 → hoje + 3 + 27 = 29/02 + 30 = 30/03/2028
    expect(leitura).toMatchObject({
      etapa: "producao",
      diasNestaEtapa: 2,
      previsaoDeConclusao: "2028-03-30",
    });
  });
});

describe("previsão e folga nas bordas (PRD-12)", () => {
  it("estouro: prevista 15, está há 20 → estouro 5, previsão = hoje + 0 + Σ futuras", () => {
    const leitura = leituraDaOrdem(ordem({ feitas: { producao: "2026-03-05" } }), "2026-03-25");
    expect(leitura).toMatchObject({
      etapa: "secagem",
      diasNestaEtapa: 20,
      previstoDaEtapa: 15,
      estouroDias: 5,
      // 25/03 + 0 + (1 + 1 + 4 + 6) = 06/04
      previsaoDeConclusao: "2026-04-06",
    });
  });

  it("etapa atual `entrega`: a previsão é só o resto dela", () => {
    const quaseTudo = {
      producao: "2026-03-05",
      secagem: "2026-03-10",
      queima1: "2026-03-11",
      esmaltacao: "2026-03-12",
      queima2: "2026-03-20",
    };
    expect(leituraDaOrdem(ordem({ feitas: quaseTudo }), "2026-03-22")).toMatchObject({
      etapa: "entrega",
      indice: 5,
      diasNestaEtapa: 2,
      // 22/03 + max(0, 6 − 2) + 0 = 26/03
      previsaoDeConclusao: "2026-03-26",
    });
    // Estourada na entrega: a previsão é hoje, nunca antes.
    expect(leituraDaOrdem(ordem({ feitas: quaseTudo }), "2026-03-30")).toMatchObject({
      etapa: "entrega",
      estouroDias: 4,
      previsaoDeConclusao: "2026-03-30",
    });
  });

  it("entrega prometida já passada com a ordem em curso → folga negativa → “vai atrasar”", () => {
    const leitura = leituraDaOrdem(
      ordem({ entregaPrometida: "2026-03-01", feitas: { producao: "2026-03-05" } }),
      "2026-03-10",
    );
    // previsão 01/04; entrega 01/03 → folga −31
    expect(leitura).toMatchObject({ previsaoDeConclusao: "2026-04-01", folgaDias: -31 });
    expect(seloDaOrdem(leitura)).toEqual({ tipo: "vai-atrasar", dias: 31 });
  });

  it("sem entrega prometida (PRD-12 · empty): folga null e nunca “vai atrasar”, mesmo estourada", () => {
    const leitura = leituraDaOrdem(
      ordem({ tipo: "casa", entregaPrometida: null, feitas: { producao: "2026-03-05" } }),
      "2026-03-25",
    );
    expect(leitura).toMatchObject({ folgaDias: null, estouroDias: 5 });
    expect(seloDaOrdem(leitura)).toEqual({ tipo: "passou-nesta-etapa", dias: 5 });
  });

  it("folga exatamente 0 → “no ritmo”", () => {
    const leitura = leituraDaOrdem(
      ordem({ entregaPrometida: "2026-04-01", feitas: { producao: "2026-03-05" } }),
      "2026-03-10",
    );
    expect(leitura).toMatchObject({ folgaDias: 0, estouroDias: 0 });
    expect(seloDaOrdem(leitura)).toEqual({ tipo: "no-ritmo" });
  });

  it("atrasada E estourada ao mesmo tempo (PRD-12 · adjacency) → só “vai atrasar”", () => {
    const leitura = leituraDaOrdem(
      ordem({ entregaPrometida: "2026-03-20", feitas: { producao: "2026-03-05" } }),
      "2026-03-25",
    );
    // estouro 5; previsão 06/04; folga −17
    expect(leitura).toMatchObject({ estouroDias: 5, folgaDias: -17 });
    expect(seloDaOrdem(leitura)).toEqual({ tipo: "vai-atrasar", dias: 17 });
  });

  it("aguardando o sinal (PRD-12 · empty): selo “aguardando o sinal”, sem prazo contando", () => {
    const leitura = leituraDaOrdem(
      ordem({ status: "aguardando_sinal", inicio: null, entregaPrometida: "2026-03-01" }),
      "2026-03-10",
    );
    expect(leitura).toEqual({ tipo: "aguardando" });
    expect(seloDaOrdem(leitura)).toEqual({ tipo: "aguardando-sinal" });
  });
});

describe("dado incoerente é RangeError (PRD-04 · ordering)", () => {
  it("uma etapa feita com alguma anterior não feita é RangeError — em cada posição do caminho", () => {
    for (const caminho of ["completo", "biscoito"] as const) {
      const etapas = etapasIniciais(caminho);
      for (const { etapa } of etapas.slice(1)) {
        const incoerente = ordem({ caminho, feitas: { [etapa]: "2026-03-05" } });
        expect(() => etapaAtual(incoerente)).toThrow(RangeError);
        expect(() => leituraDaOrdem(incoerente, "2026-03-10")).toThrow(RangeError);
      }
    }
  });

  it("a mensagem do RangeError de prefixo diz qual etapa quebrou a regra", () => {
    expect(() => etapaAtual(ordem({ feitas: { secagem: "2026-03-05" } }))).toThrow(/secagem/);
  });

  it("feita_em que decresce (secagem antes da produção) é RangeError, e diz qual etapa", () => {
    const decrescente = ordem({ feitas: { producao: "2026-03-10", secagem: "2026-03-05" } });
    expect(() => etapaAtual(decrescente)).toThrow(RangeError);
    expect(() => etapaAtual(decrescente)).toThrow(/secagem/);
    expect(() => leituraDaOrdem(decrescente, "2026-03-12")).toThrow(RangeError);
    expect(() => levouDias(decrescente)).toThrow(RangeError);
  });

  it("feita_em igual ao da anterior (duas etapas no mesmo dia) não é incoerente", () => {
    const mesmoDia = ordem({ feitas: { producao: "2026-03-05", secagem: "2026-03-05" } });
    expect(etapaAtual(mesmoDia)).toEqual({ etapa: "queima1", indice: 2 });
  });

  it("ordem ativa com todas as etapas feitas é RangeError também no caminho biscoito", () => {
    const todas = Object.fromEntries(
      etapasIniciais("biscoito").map((etapa) => [etapa.etapa, "2026-03-05"]),
    );
    expect(() =>
      leituraDaOrdem(ordem({ caminho: "biscoito", feitas: todas }), "2026-03-10"),
    ).toThrow(RangeError);
  });
});

// Fase 06.5 (plano 07, D-11): o aviso da folha "Nova ordem" usa a MESMA conta do "vai atrasar".
describe("previsaoDaNovaOrdem (D-11)", () => {
  it("cabe: a entrega depois da previsão → diasDepoisDaEntrega null", () => {
    // completo = 5 + 15 + 1 + 4 + 1 + 6 = 32; 10/03 + 32 = 11/04
    expect(
      previsaoDaNovaOrdem({ caminho: "completo", hoje: "2026-03-10", entregaPrometida: "2026-05-09" }),
    ).toEqual({ diasDasEtapas: 32, prontaEm: "2026-04-11", diasDepoisDaEntrega: null });
  });

  it("entrega exatamente na previsão também cabe", () => {
    expect(
      previsaoDaNovaOrdem({ caminho: "completo", hoje: "2026-03-10", entregaPrometida: "2026-04-11" })
        .diasDepoisDaEntrega,
    ).toBeNull();
  });

  it("não cabe: o número de dias que a previsão passa da entrega", () => {
    // entrega 25/03 (hoje + 15); pronta 11/04 → 17 dias depois
    expect(
      previsaoDaNovaOrdem({ caminho: "completo", hoje: "2026-03-10", entregaPrometida: "2026-03-25" }),
    ).toEqual({ diasDasEtapas: 32, prontaEm: "2026-04-11", diasDepoisDaEntrega: 17 });
  });

  it("sem data → diasDepoisDaEntrega null, mas a soma e a previsão continuam", () => {
    expect(
      previsaoDaNovaOrdem({ caminho: "completo", hoje: "2026-03-10", entregaPrometida: null }),
    ).toEqual({ diasDasEtapas: 32, prontaEm: "2026-04-11", diasDepoisDaEntrega: null });
  });

  it("caminho biscoito: soma menor (5 + 15 + 1 + 6 = 27)", () => {
    expect(
      previsaoDaNovaOrdem({ caminho: "biscoito", hoje: "2026-03-10", entregaPrometida: "2026-03-25" }),
    ).toEqual({ diasDasEtapas: 27, prontaEm: "2026-04-06", diasDepoisDaEntrega: 12 });
  });

  it("é o mesmo número que o selo “vai atrasar” dá à ordem criada hoje", () => {
    const hoje = "2026-12-20";
    const entregaPrometida = "2027-01-05";
    const previsao = previsaoDaNovaOrdem({ caminho: "completo", hoje, entregaPrometida });
    const criada = ordem({ entregaPrometida, inicio: hoje });
    expect(seloDaOrdem(leituraDaOrdem(criada, hoje))).toEqual({
      tipo: "vai-atrasar",
      dias: previsao.diasDepoisDaEntrega,
    });
  });
});

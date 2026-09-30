import { describe, expect, it } from "vitest";

import {
  esquemaAjustarDiasPrevistos,
  esquemaDefinirAMais,
  esquemaDesfazerEtapa,
  esquemaRegistrarParcial,
} from "@/lib/producao/esquemas";
import {
  FRASE_A_MAIS_INVALIDO,
  FRASE_FALHA_AO_AJUSTAR,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_PARCIAL_NAO_INTEIRO,
  textoParcialInvalido,
} from "@/lib/producao/textos";

// "Fazer a mais, de segurança" (Fase 06.1, plano 04, PRD-08): o texto do campo vira inteiro de 0 a
// 100.000 AQUI, no servidor — o mesmo intervalo do check `ordem_pecas_a_mais_faixa`. Vazio é zero
// (apagar o campo tira as a mais); qualquer outra coisa é recusada com a frase da UI-SPEC.

const ORDEM = "0b7e8a4c-1f2d-4c3b-9a8e-7d6c5b4a3f21";
const PECA = "5e4d3c2b-1a09-4f8e-8d7c-6b5a49382716";

function definir(aMaisTexto: unknown) {
  return esquemaDefinirAMais.safeParse({ ordemId: ORDEM, pecaId: PECA, aMaisTexto });
}

describe("esquemaDefinirAMais", () => {
  it.each([
    ["0", 0],
    ["5", 5],
    ["100000", 100000],
    ["", 0],
    ["   ", 0],
    [" 12 ", 12],
    ["007", 7],
  ])("aceita %j como %i", (texto, esperado) => {
    const resultado = definir(texto);
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({
      ordemId: ORDEM,
      pecaId: PECA,
      aMais: esperado,
    });
  });

  it.each(["100001", "-1", "2,5", "2.5", "abc", "1e3", "5 peças", "+5"])(
    "recusa %j com a frase da UI-SPEC",
    (texto) => {
      const resultado = definir(texto);
      expect(resultado.success).toBe(false);
      expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_A_MAIS_INVALIDO);
    },
  );

  it("recusa um número que não é texto (o campo sempre manda texto)", () => {
    const resultado = definir(5);
    expect(resultado.success).toBe(false);
    expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_A_MAIS_INVALIDO);
  });

  it("a frase é a da UI-SPEC", () => {
    expect(FRASE_A_MAIS_INVALIDO).toBe("Diga um número inteiro, zero ou mais.");
  });

  it("recusa id de ordem ou de peça que não é uuid (a mais)", () => {
    const semOrdem = esquemaDefinirAMais.safeParse({ ordemId: "x", pecaId: PECA, aMaisTexto: "1" });
    expect(semOrdem.success).toBe(false);
    expect(!semOrdem.success && semOrdem.error.issues[0]?.message).toBe(FRASE_ORDEM_NAO_EXISTE);
    const semPeca = esquemaDefinirAMais.safeParse({ ordemId: ORDEM, pecaId: "y", aMaisTexto: "1" });
    expect(semPeca.success).toBe(false);
  });
});

// Plano 05: desfazer, ajustar o previsto e o parcial. Do cliente chegam só os ids, a etapa que a
// tela mostrava, o ±1 e o TEXTO do parcial — a faixa superior do parcial (o total de feitas) é
// decidida no servidor, sob a trava, pelo módulo puro.

describe("esquemaDesfazerEtapa", () => {
  it("aceita id e etapa esperada", () => {
    expect(esquemaDesfazerEtapa.safeParse({ ordemId: ORDEM, etapaEsperada: "secagem" })).toEqual({
      success: true,
      data: { ordemId: ORDEM, etapaEsperada: "secagem" },
    });
  });

  it("recusa etapa que não é uma das seis e id que não é uuid", () => {
    expect(esquemaDesfazerEtapa.safeParse({ ordemId: ORDEM, etapaEsperada: "forno" }).success).toBe(
      false,
    );
    const semOrdem = esquemaDesfazerEtapa.safeParse({ ordemId: "x", etapaEsperada: "secagem" });
    expect(!semOrdem.success && semOrdem.error.issues[0]?.message).toBe(FRASE_ORDEM_NAO_EXISTE);
  });
});

describe("esquemaAjustarDiasPrevistos", () => {
  it.each([1, -1])("aceita delta %i", (delta) => {
    expect(
      esquemaAjustarDiasPrevistos.safeParse({ ordemId: ORDEM, etapa: "queima2", delta }),
    ).toEqual({ success: true, data: { ordemId: ORDEM, etapa: "queima2", delta } });
  });

  it.each([0, 2, -2, 0.5, "1", null])("recusa delta %j", (delta) => {
    const resultado = esquemaAjustarDiasPrevistos.safeParse({
      ordemId: ORDEM,
      etapa: "queima2",
      delta,
    });
    expect(resultado.success).toBe(false);
    expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_FALHA_AO_AJUSTAR);
  });

  it("recusa etapa desconhecida", () => {
    expect(
      esquemaAjustarDiasPrevistos.safeParse({ ordemId: ORDEM, etapa: "forno", delta: 1 }).success,
    ).toBe(false);
  });
});

describe("esquemaRegistrarParcial", () => {
  function parcial(passaramTexto: unknown) {
    return esquemaRegistrarParcial.safeParse({
      ordemId: ORDEM,
      etapaEsperada: "secagem",
      passaramTexto,
    });
  }

  it.each([
    ["18", 18],
    [" 18 ", 18],
    ["0", 0],
    ["007", 7],
    ["", null],
    ["   ", null],
  ])("aceita %j como %j", (texto, esperado) => {
    expect(parcial(texto)).toEqual({
      success: true,
      data: { ordemId: ORDEM, etapaEsperada: "secagem", passaram: esperado },
    });
  });

  it.each(["2,5", "2.5", "abc", "-1", "+5", "1e3", "18 peças", "9999999999"])(
    "recusa %j (inteiro de verdade, sem vírgula, ponto, sinal ou expoente)",
    (texto) => {
      const resultado = parcial(texto);
      expect(resultado.success).toBe(false);
      expect(!resultado.success && resultado.error.issues[0]?.path).toEqual(["passaramTexto"]);
      expect(!resultado.success && resultado.error.issues[0]?.message).toBe(
        FRASE_PARCIAL_NAO_INTEIRO,
      );
    },
  );

  it("recusa um número cru (o campo sempre manda texto)", () => {
    expect(parcial(18).success).toBe(false);
  });

  it("a frase do parcial fora da faixa é a da UI-SPEC", () => {
    expect(textoParcialInvalido(30)).toBe("Diga um número de 0 a 30.");
  });
});

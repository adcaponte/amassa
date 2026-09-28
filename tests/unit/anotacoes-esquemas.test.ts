import { describe, expect, it } from "vitest";

import { esquemaSalvarAnotacoes } from "@/lib/anotacoes/esquemas";
import { LIMITE_DE_CARACTERES } from "@/lib/anotacoes/folha";

// U+1F600 ("😀") é um par substituto (surrogate pair) em UTF-16: UM ponto de código, DUAS
// unidades UTF-16 (`"😀".length === 2`, `[..."😀"].length === 1`). Usado abaixo para provar que
// a contagem é por ponto de código, nunca por `texto.length`.
const EMOJI = "😀";

describe("esquemaSalvarAnotacoes", () => {
  it("aceita texto vazio — esvaziar a folha é legítimo", () => {
    const resultado = esquemaSalvarAnotacoes.safeParse({ texto: "", vistoEm: null });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.texto).toBe("");
    }
  });

  it("aceita exatamente LIMITE_DE_CARACTERES pontos de código, mesmo com emoji cujo texto.length em UTF-16 seria maior", () => {
    const texto = "a".repeat(LIMITE_DE_CARACTERES - 1) + EMOJI;
    expect([...texto].length).toBe(LIMITE_DE_CARACTERES);
    // Se a validação contasse por `texto.length` (UTF-16), este texto pareceria ter
    // LIMITE_DE_CARACTERES + 1 "caracteres" e seria recusado por engano.
    expect(texto.length).toBe(LIMITE_DE_CARACTERES + 1);

    const resultado = esquemaSalvarAnotacoes.safeParse({ texto, vistoEm: null });
    expect(resultado.success).toBe(true);
  });

  it("recusa acima de LIMITE_DE_CARACTERES contando pontos de código, mesmo com emoji, com mensagem em português", () => {
    const texto = "a".repeat(LIMITE_DE_CARACTERES - 1) + EMOJI + EMOJI;
    expect([...texto].length).toBe(LIMITE_DE_CARACTERES + 1);

    const resultado = esquemaSalvarAnotacoes.safeParse({ texto, vistoEm: null });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/caracteres/i);
    }
  });

  it("normaliza para NFC — duas grafias do mesmo acento contam como o mesmo texto", () => {
    const precomposto = "café"; // "é" precomposto (U+00E9)
    const decomposto = "café"; // "e" + acento agudo combinante (U+0301)
    expect(precomposto).not.toBe(decomposto); // strings cruas diferem byte a byte

    const resultadoPrecomposto = esquemaSalvarAnotacoes.safeParse({
      texto: precomposto,
      vistoEm: null,
    });
    const resultadoDecomposto = esquemaSalvarAnotacoes.safeParse({
      texto: decomposto,
      vistoEm: null,
    });
    expect(resultadoPrecomposto.success && resultadoDecomposto.success).toBe(true);
    if (resultadoPrecomposto.success && resultadoDecomposto.success) {
      expect(resultadoPrecomposto.data.texto).toBe(resultadoDecomposto.data.texto);
    }
  });

  it("recusa entrada cujo texto não é uma string", () => {
    const resultado = esquemaSalvarAnotacoes.safeParse({ texto: 123, vistoEm: null });
    expect(resultado.success).toBe(false);
  });

  it("aceita vistoEm nulo", () => {
    const resultado = esquemaSalvarAnotacoes.safeParse({ texto: "recado", vistoEm: null });
    expect(resultado.success).toBe(true);
  });

  it("aceita vistoEm como instante ISO válido", () => {
    const resultado = esquemaSalvarAnotacoes.safeParse({
      texto: "recado",
      vistoEm: "2026-12-18T14:20:00.000Z",
    });
    expect(resultado.success).toBe(true);
  });

  it("recusa vistoEm como string arbitrária que não é um instante", () => {
    const resultado = esquemaSalvarAnotacoes.safeParse({
      texto: "recado",
      vistoEm: "não é uma data",
    });
    expect(resultado.success).toBe(false);
  });
});

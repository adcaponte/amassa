import { describe, expect, it } from "vitest";

import {
  FRASE_ERRO_CORPO_GENERICO,
  FRASE_ERRO_TITULO,
  ROTULO_TENTAR_DE_NOVO,
} from "../../lib/erro/textos";
import { FRASE_ERRO_TITULO as FRASE_ERRO_TITULO_ENCOMENDAS } from "../../lib/encomendas/textos";

describe("lib/erro/textos — voz única das fronteiras de erro", () => {
  it("FRASE_ERRO_TITULO é exatamente igual ao FRASE_ERRO_TITULO de lib/encomendas/textos.ts", () => {
    expect(FRASE_ERRO_TITULO).toBe(FRASE_ERRO_TITULO_ENCOMENDAS);
  });

  it('FRASE_ERRO_CORPO_GENERICO diz o que fazer — contém "tente de novo"', () => {
    expect(FRASE_ERRO_CORPO_GENERICO.toLowerCase()).toContain("tente de novo");
  });

  it("ROTULO_TENTAR_DE_NOVO não é string vazia", () => {
    expect(ROTULO_TENTAR_DE_NOVO.length).toBeGreaterThan(0);
  });

  it("as três constantes são strings não vazias", () => {
    const frases = [FRASE_ERRO_TITULO, FRASE_ERRO_CORPO_GENERICO, ROTULO_TENTAR_DE_NOVO];

    for (const frase of frases) {
      expect(frase.length).toBeGreaterThan(0);
    }
  });
});

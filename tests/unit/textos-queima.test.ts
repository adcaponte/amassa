import { describe, expect, it } from "vitest";
import type { NivelDeForno } from "../../lib/queimas/contador";
import { rotuloDoTipo, textoDoNivel, type TipoDeQueima } from "../../lib/queimas/textos";

describe("textoDoNivel", () => {
  it('"ok" devolve null — nenhum selo aparece nesse nível', () => {
    expect(textoDoNivel("ok")).toBeNull();
  });

  it('"atencao" devolve exatamente "Manutenção próxima"', () => {
    expect(textoDoNivel("atencao")).toBe("Manutenção próxima");
  });

  it('"critico" devolve exatamente "Manutenção vencida"', () => {
    expect(textoDoNivel("critico")).toBe("Manutenção vencida");
  });

  it("cobre os TRÊS níveis de NivelDeForno (inventário desta suíte)", () => {
    const niveis: NivelDeForno[] = ["ok", "atencao", "critico"];
    expect(niveis).toHaveLength(3);
  });

  it("não usa linguagem de culpa — as duas frases de selo dizem o fato, nunca quem deixou passar do limite", () => {
    for (const nivel of ["atencao", "critico"] as const) {
      const texto = textoDoNivel(nivel);
      expect(texto).not.toBeNull();
      expect(texto?.toLowerCase()).not.toMatch(/você|alguém|esqueceu|deixou/);
    }
  });
});

describe("rotuloDoTipo", () => {
  const casos: Array<{ tipo: TipoDeQueima; rotulo: string }> = [
    { tipo: "biscoito", rotulo: "Biscoito" },
    { tipo: "esmalte", rotulo: "Esmalte" },
    { tipo: "ouro", rotulo: "Ouro" },
  ];

  it.each(casos)("$tipo devolve exatamente $rotulo", ({ tipo, rotulo }) => {
    expect(rotuloDoTipo(tipo)).toBe(rotulo);
  });

  it("cobre os TRÊS tipos de queima (inventário desta suíte)", () => {
    expect(casos).toHaveLength(3);
  });
});

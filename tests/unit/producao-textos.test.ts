import { describe, expect, it } from "vitest";

import { textoAvisoPrazoManchete, textoLevou } from "@/lib/producao/textos";

// Fase 06.5 (plano 07, D-11): as frases novas da Produção, com o plural de verdade.
describe("textoLevou (Concluídas)", () => {
  it("zero é “no mesmo dia”, nunca “0 dias”", () => {
    expect(textoLevou(0)).toBe("no mesmo dia");
  });

  it("um é singular", () => {
    expect(textoLevou(1)).toBe("levou 1 dia");
  });

  it("muitos é plural", () => {
    expect(textoLevou(23)).toBe("levou 23 dias");
  });
});

describe("textoAvisoPrazoManchete (folha Nova ordem)", () => {
  it("a frase da UI-SPEC, verbatim", () => {
    expect(textoAvisoPrazoManchete(31, "05/11", 17)).toBe(
      "As etapas somam 31 dias — a ordem fica pronta em 05/11, 17 dias depois da entrega.",
    );
  });

  it("um dia depois da entrega é singular", () => {
    expect(textoAvisoPrazoManchete(32, "12/04", 1)).toBe(
      "As etapas somam 32 dias — a ordem fica pronta em 12/04, 1 dia depois da entrega.",
    );
  });
});

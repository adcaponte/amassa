import { describe, expect, it } from "vitest";

import { rotuloGerarContas, textoContasGeradas } from "@/lib/cadastros/textos";

// 06.5-12 (UI-SPEC da 06.5, §Toasts): o toast de "Gerar as contas de {mês}" com plural de verdade —
// o "conta(s) … criada(s)" saiu. O mesmo texto serve aos Cadastros e ao aviso do Caixa.
describe("textoContasGeradas", () => {
  it("0: as contas já existiam", () => {
    expect(textoContasGeradas(0, "novembro de 2026")).toBe("As contas de novembro de 2026 já existiam.");
  });

  it("1: singular", () => {
    expect(textoContasGeradas(1, "novembro de 2026")).toBe("1 conta de novembro de 2026 criada no Caixa.");
  });

  it("3: plural", () => {
    expect(textoContasGeradas(3, "novembro de 2026")).toBe("3 contas de novembro de 2026 criadas no Caixa.");
  });

  it("nenhuma forma tem o plural falso entre parênteses", () => {
    for (const quantidade of [0, 1, 2, 3, 12]) {
      expect(textoContasGeradas(quantidade, "janeiro de 2027")).not.toMatch(/\(s\)/);
    }
  });
});

describe("rotuloGerarContas", () => {
  it("o rótulo do botão, o mesmo nos Cadastros e no aviso do Caixa", () => {
    expect(rotuloGerarContas("novembro de 2026")).toBe("Gerar as contas de novembro de 2026");
  });
});

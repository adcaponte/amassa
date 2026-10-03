import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ariaAbrirSite,
  ariaAbrirWhatsapp,
  ariaCopiarEmail,
  ariaCopiarWhatsapp,
  fraseSemResultado,
  fraseSemResultadoDaArea,
  rotuloDosAnexos,
  rotuloDosDesativados,
  textoDoRodape,
  toastCopiado,
  toastNaoDeuParaCopiar,
} from "@/lib/fornecedores/textos";

// As frases com número e nome da lista e da ficha de fornecedores (06.2-03-PLAN.md, Tarefa 2; textos
// verbatim da 06.2-UI-SPEC.md §Copywriting). Plural de verdade: nunca "(s)".

describe("rotuloDosAnexos — zero, um, muitos", () => {
  it.each([
    [0, "sem anexo"],
    [1, "1 anexo"],
    [2, "2 anexos"],
    [3, "3 anexos"],
    [12, "12 anexos"],
  ] as const)("%i → %s", (quantos, esperado) => {
    expect(rotuloDosAnexos(quantos)).toBe(esperado);
  });
});

describe("rotuloDosDesativados — um, muitos, mostrando ou não", () => {
  it.each([
    [1, false, "mostrar 1 desativado"],
    [1, true, "esconder 1 desativado"],
    [4, false, "mostrar 4 desativados"],
    [4, true, "esconder 4 desativados"],
  ] as const)("%i, mostrando=%s → %s", (quantos, mostrando, esperado) => {
    expect(rotuloDosDesativados(quantos, mostrando)).toBe(esperado);
  });
});

describe("frases da lista", () => {
  it("rodapé “{n} de {total}”", () => {
    expect(textoDoRodape(3, 12)).toBe("3 de 12");
    expect(textoDoRodape(0, 0)).toBe("0 de 0");
  });

  it("sem resultado: com a busca entre aspas curvas, ou com a área", () => {
    expect(fraseSemResultado("argila")).toBe("Nenhum fornecedor com “argila”.");
    expect(fraseSemResultadoDaArea("Cafeteria")).toBe("Nenhum fornecedor de Cafeteria.");
  });
});

describe("frases dos contatos", () => {
  it("aria-label com o nome do fornecedor", () => {
    expect(ariaCopiarWhatsapp("Loja X")).toBe("Copiar o WhatsApp de Loja X");
    expect(ariaAbrirWhatsapp("Loja X")).toBe("Abrir o WhatsApp de Loja X numa aba nova");
    expect(ariaCopiarEmail("Loja X")).toBe("Copiar o e-mail de Loja X");
    expect(ariaAbrirSite("Loja X")).toBe("Abrir o site de Loja X numa aba nova");
  });

  it("toasts do copiar", () => {
    expect(toastCopiado("(00) 9 0000-0001")).toBe("Copiado: (00) 9 0000-0001");
    expect(toastNaoDeuParaCopiar("vendas@example.com")).toBe("Não deu para copiar. Está aqui: vendas@example.com");
  });
});

describe("nunca “(s)”", () => {
  it("lib/fornecedores/textos.ts não tem plural com parêntese", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/textos.ts"), "utf8");
    expect(fonte).not.toContain("(s)");
  });

  it.each([0, 1, 2, 7])("nenhum rótulo gerado tem parêntese (%i)", (quantos) => {
    expect(rotuloDosAnexos(quantos)).not.toMatch(/[()]/);
    if (quantos > 0) {
      expect(rotuloDosDesativados(quantos, true)).not.toMatch(/[()]/);
      expect(rotuloDosDesativados(quantos, false)).not.toMatch(/[()]/);
    }
  });
});

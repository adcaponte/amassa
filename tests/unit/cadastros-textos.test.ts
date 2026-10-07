import { describe, expect, it } from "vitest";

import {
  dicaContasCanceladas,
  frasePerguntaContasCanceladas,
  rotuloGerarContas,
  textoContasGeradas,
  textoOutrasContasDoMes,
  tituloContasCanceladas,
} from "@/lib/cadastros/textos";

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

// 06.5-WR-03 (quick 261007-shs; decisão do dono, 07/10/2026 — “perguntar antes”): a conta cancelada no mês
// só volta se alguém a marcar; o toast diz quantas continuaram canceladas. Com `mantidas = 0`, os textos de
// antes, idênticos.
describe("textoContasGeradas — com as canceladas que ficaram (WR-03)", () => {
  it("mantidas = 0: igual a antes", () => {
    expect(textoContasGeradas(0, "novembro de 2026", 0)).toBe("As contas de novembro de 2026 já existiam.");
    expect(textoContasGeradas(2, "novembro de 2026", 0)).toBe("2 contas de novembro de 2026 criadas no Caixa.");
  });

  it("uma criada e uma cancelada que ficou", () => {
    expect(textoContasGeradas(1, "novembro de 2026", 1)).toBe(
      "1 conta de novembro de 2026 criada no Caixa. A cancelada continua cancelada.",
    );
  });

  it("nenhuma criada e duas canceladas que ficaram", () => {
    expect(textoContasGeradas(0, "novembro de 2026", 2)).toBe(
      "Nenhuma conta de novembro de 2026 criada. As 2 canceladas continuam canceladas.",
    );
  });
});

describe("o diálogo das contas canceladas no mês (WR-03)", () => {
  it("tituloContasCanceladas", () => {
    expect(tituloContasCanceladas(1, "novembro de 2026")).toBe("Uma conta de novembro de 2026 foi cancelada no Caixa");
    expect(tituloContasCanceladas(2, "novembro de 2026")).toBe("2 contas de novembro de 2026 foram canceladas no Caixa");
  });

  it("dicaContasCanceladas", () => {
    expect(dicaContasCanceladas(1)).toBe("Marque se ela deve voltar para “A pagar”. Desmarcada, continua cancelada.");
    expect(dicaContasCanceladas(2)).toBe(
      "Marque as que devem voltar para “A pagar”. As desmarcadas continuam canceladas.",
    );
  });

  it("textoOutrasContasDoMes", () => {
    const m = "novembro de 2026";
    expect(textoOutrasContasDoMes(0, m)).toBe(`As outras contas de ${m} já estão no Caixa.`);
    expect(textoOutrasContasDoMes(1, m)).toBe(`A outra conta que falta em ${m} será criada.`);
    expect(textoOutrasContasDoMes(3, m)).toBe(`As outras 3 contas que faltam em ${m} serão criadas.`);
  });

  it("frasePerguntaContasCanceladas (a aba aberta antes da publicação)", () => {
    const m = "novembro de 2026";
    expect(frasePerguntaContasCanceladas(["Internet"], m)).toBe(
      `Internet foi cancelada em ${m} — recarregue a página e gere de novo para escolher se ela volta.`,
    );
    expect(frasePerguntaContasCanceladas(["Internet", "Água"], m)).toBe(
      `Internet e Água foram canceladas em ${m} — recarregue a página e gere de novo para escolher quais voltam.`,
    );
  });
});

describe("rotuloGerarContas", () => {
  it("o rótulo do botão, o mesmo nos Cadastros e no aviso do Caixa", () => {
    expect(rotuloGerarContas("novembro de 2026")).toBe("Gerar as contas de novembro de 2026");
  });
});

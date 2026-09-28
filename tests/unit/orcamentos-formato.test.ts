import { describe, expect, it } from "vitest";

import { formatarFornadas } from "@/lib/orcamentos/formato";

// Achado da verificação do Cowork em produção (27/09/2026): o painel "Só para você" mostrava
// "0 fornada(s) de biscoito · 0,1 de esmalte" — duas precisões diferentes na mesma frase, porque
// `formatarFornadas` declarava só `maximumFractionDigits`. O protótipo (`n1`) sempre mostra a
// casa decimal, mesmo quando ela é zero — é o que o comentário de
// `formatarPercentualDeVariacao`, logo abaixo no mesmo arquivo, já dizia e aplicava.
describe("formatarFornadas", () => {
  it("mostra sempre uma casa decimal, inclusive quando ela é zero", () => {
    expect(formatarFornadas(0)).toBe("0,0");
    expect(formatarFornadas(1000)).toBe("1,0");
    expect(formatarFornadas(2000)).toBe("2,0");
  });

  it("mantém a casa decimal quando ela não é zero", () => {
    expect(formatarFornadas(100)).toBe("0,1");
    expect(formatarFornadas(1200)).toBe("1,2");
  });

  it("arredonda para uma casa, nunca mais", () => {
    expect(formatarFornadas(1250)).toBe("1,3");
    expect(formatarFornadas(1240)).toBe("1,2");
  });

  it("as duas metades da frase das fornadas ocupadas saem com a mesma precisão", () => {
    // O defeito relatado, na forma em que ele aparece: biscoito zerado e esmalte em 0,1.
    expect(formatarFornadas(0)).toBe("0,0");
    expect(formatarFornadas(100)).toBe("0,1");
  });
});

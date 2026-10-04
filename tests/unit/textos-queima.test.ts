import { describe, expect, it } from "vitest";
import type { NivelDeForno } from "../../lib/queimas/contador";
import {
  faixasDaRegua,
  fraseAbaixoDoLancado,
  fraseDaReguaNaFolha,
  fraseDoRodape,
  nomeDasVendas,
  rotuloDoTipo,
  subtituloDaFolha,
  textoDoNivel,
  type TipoDeQueima,
} from "../../lib/queimas/textos";

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

describe("fraseDoRodape", () => {
  it('com responsável: "Última manutenção em {data} · {responsável} · {total} no total"', () => {
    expect(fraseDoRodape({ data: "9 ago 2026", responsavel: "Ana", total: 42 })).toBe(
      "Última manutenção em 9 ago 2026 · Ana · 42 no total",
    );
  });

  it('sem responsável (null): "Última manutenção em {data} · {total} no total" — sem o segundo separador órfão', () => {
    expect(fraseDoRodape({ data: "9 ago 2026", responsavel: null, total: 3 })).toBe(
      "Última manutenção em 9 ago 2026 · 3 no total",
    );
  });

  it('sem manutenção (data null): "Sem manutenção registrada · {total} no total"', () => {
    expect(fraseDoRodape({ data: null, responsavel: null, total: 0 })).toBe(
      "Sem manutenção registrada · 0 no total",
    );
  });

  it("as três formas sempre terminam em '· {total} no total'", () => {
    expect(fraseDoRodape({ data: null, responsavel: null, total: 7 }).endsWith("· 7 no total")).toBe(
      true,
    );
    expect(
      fraseDoRodape({ data: "1 jan 2026", responsavel: null, total: 5 }).endsWith("· 5 no total"),
    ).toBe(true);
    expect(
      fraseDoRodape({ data: "1 jan 2026", responsavel: "Zé", total: 9 }).endsWith("· 9 no total"),
    ).toBe(true);
  });
});

// Fase 06.4 — D-07 (várias vendas por queima): os nomes das vendas e a frase do piso.
describe("nomeDasVendas", () => {
  it("uma, duas e três vendas", () => {
    expect(nomeDasVendas([12])).toBe("venda nº 12");
    expect(nomeDasVendas([12, 15])).toBe("vendas nº 12 e 15");
    expect(nomeDasVendas([12, 15, 19])).toBe("vendas nº 12, 15 e 19");
  });
});

describe("fraseAbaixoDoLancado", () => {
  it("plural, singular e várias vendas", () => {
    expect(fraseAbaixoDoLancado("P", 2, [12])).toBe(
      "Já foram lançadas 2 externas P; para baixar daí, cancele a venda nº 12 no Caixa.",
    );
    expect(fraseAbaixoDoLancado("G", 1, [12])).toBe(
      "Já foi lançada 1 externa G; para baixar daí, cancele a venda nº 12 no Caixa.",
    );
    expect(fraseAbaixoDoLancado("P", 3, [12, 15])).toBe(
      "Já foram lançadas 3 externas P, nas vendas nº 12 e 15; para baixar daí, cancele uma delas no Caixa.",
    );
  });
});

// Plano 06.4-02, Tarefa 2 — a régua vigente e o forno na folha.
describe("a régua na folha", () => {
  const REGUA = { pAte: 10000, mAte: 25000 };

  it("fraseDaReguaNaFolha usa os números da régua, verbatim do protótipo", () => {
    expect(fraseDaReguaNaFolha(REGUA)).toBe(
      "Contar, não medir: P até 10 cm · M de 10 a 25 cm · G maior que 25 cm, no olho.",
    );
    expect(fraseDaReguaNaFolha({ pAte: 12500, mAte: 30000 })).toBe(
      "Contar, não medir: P até 12,5 cm · M de 12,5 a 30 cm · G maior que 30 cm, no olho.",
    );
  });

  it("faixasDaRegua dá a faixa de cada tamanho", () => {
    expect(faixasDaRegua(REGUA)).toEqual({ P: "até 10 cm", M: "10 a 25 cm", G: "maior que 25 cm" });
  });
});

describe("subtituloDaFolha", () => {
  it("com o forno (mais de um forno na casa)", () => {
    expect(subtituloDaFolha("biscoito", "18/12", "Forno grande")).toBe(
      "Biscoito de 18/12 · Forno grande · opcional — a queima já está registrada.",
    );
  });

  it("sem o forno (um forno só)", () => {
    expect(subtituloDaFolha("esmalte", "03/01", null)).toBe(
      "Esmalte de 03/01 · opcional — a queima já está registrada.",
    );
  });
});

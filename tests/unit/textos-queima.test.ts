import { describe, expect, it } from "vitest";
import type { NivelDeForno } from "../../lib/queimas/contador";
import {
  FRASE_SEM_CONTAGEM_HISTORICO,
  ROTULO_APAGAR_CONTAGEM,
  ROTULO_CORRIGIR_CONTAGEM,
  TAG_NAO_SAIU_CHEIO,
  TITULO_APAGAR_CONTAGEM,
  TOAST_CONTAGEM_APAGADA,
  chipDaContagem,
  corpoApagarContagem,
  corpoExcluirQueima,
  faixasDaRegua,
  fraseApagarComVendas,
  fraseAbaixoDoLancado,
  fraseDaReguaNaFolha,
  fraseDoRodape,
  fraseExternasLancadas,
  tagDaVendaDaQueima,
  tagSituacaoDaQueima,
  nomeDasVendas,
  rotuloDoTipo,
  subtituloDaFolha,
  textoDoNivel,
  toastContagemCorrigida,
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

// Plano 06.4-02, Tarefa 3 — o Histórico com a contagem, o apagar e a exclusão (sondas QMC-11).
describe("corpoExcluirQueima", () => {
  it("sem contagem: exatamente a frase herdada da Fase 4", () => {
    expect(corpoExcluirQueima("Forno grande")).toBe(
      "Ela some do histórico do Forno «Forno grande» e o contador é recalculado.",
    );
    expect(corpoExcluirQueima("Forno grande", null)).toBe(
      "Ela some do histórico do Forno «Forno grande» e o contador é recalculado.",
    );
  });

  it("com contagem: diz que ela vai junto, com plural de verdade", () => {
    expect(corpoExcluirQueima("Forno grande", 1)).toBe(
      "Ela some do histórico do Forno «Forno grande» e o contador é recalculado. A contagem desta fornada (1 peça) vai junto.",
    );
    expect(corpoExcluirQueima("Forno grande", 29)).toBe(
      "Ela some do histórico do Forno «Forno grande» e o contador é recalculado. A contagem desta fornada (29 peças) vai junto.",
    );
  });
});

describe("apagar a contagem", () => {
  it("título e rótulo", () => {
    expect(TITULO_APAGAR_CONTAGEM).toBe("Apagar a contagem desta queima?");
    expect(ROTULO_APAGAR_CONTAGEM).toBe("Apagar a contagem");
    expect(TOAST_CONTAGEM_APAGADA).toBe("Contagem apagada. A queima voltou para “Sem contagem”.");
  });

  it("corpoApagarContagem no plural e no singular", () => {
    expect(corpoApagarContagem(29, "Biscoito de 18/12")).toBe(
      "As 29 peças contadas de Biscoito de 18/12 somem e a queima volta para “Sem contagem”. A queima continua registrada no forno.",
    );
    expect(corpoApagarContagem(1, "Esmalte de 03/01")).toBe(
      "A peça contada de Esmalte de 03/01 some e a queima volta para “Sem contagem”. A queima continua registrada no forno.",
    );
  });

  it("fraseApagarComVendas (D-07): uma venda e várias", () => {
    expect(fraseApagarComVendas([12])).toBe(
      "As externas desta queima já foram lançadas na venda nº 12. Para apagar a contagem, cancele a venda no Caixa.",
    );
    expect(fraseApagarComVendas([12, 15])).toBe(
      "As externas desta queima já foram lançadas nas vendas nº 12 e 15. Para apagar a contagem, cancele as vendas no Caixa.",
    );
  });
});

describe("o Histórico com a contagem", () => {
  it("chipDaContagem: só os tamanhos com quantidade; grupo zerado não aparece", () => {
    expect(chipDaContagem("internas", { p: 12, m: 9, g: 2 })).toBe("internas: 12 P · 9 M · 2 G");
    expect(chipDaContagem("internas", { p: 12, m: 9, g: 0 })).toBe("internas: 12 P · 9 M");
    expect(chipDaContagem("externas", { p: 0, m: 0, g: 1 })).toBe("externas: 1 G");
    expect(chipDaContagem("externas", { p: 0, m: 0, g: 0 })).toBeNull();
  });

  it("toastContagemCorrigida com plural de verdade", () => {
    expect(toastContagemCorrigida(29)).toBe("Contagem corrigida: 29 peças.");
    expect(toastContagemCorrigida(1)).toBe("Contagem corrigida: 1 peça.");
  });

  it("rótulos verbatim", () => {
    expect(ROTULO_CORRIGIR_CONTAGEM).toBe("Corrigir contagem");
    expect(FRASE_SEM_CONTAGEM_HISTORICO).toBe("sem contagem");
    expect(TAG_NAO_SAIU_CHEIO).toBe("não saiu cheio");
  });
});

// Plano 06.4-04, Tarefa 2 — as várias vendas (D-07): o piso na folha, as tags do Histórico e a exclusão.
describe("fraseExternasLancadas (UI-D7 revisto em 04/10)", () => {
  it("uma frase por venda ativa, com o resumo dela", () => {
    expect(
      fraseExternasLancadas([
        { numero: 12, quantidades: { p: 2, m: 0, g: 0 } },
        { numero: 15, quantidades: { p: 0, m: 1, g: 0 } },
      ]),
    ).toBe(
      "Já lançado: venda nº 12 (2 P) · venda nº 15 (1 M). As externas não descem abaixo disso — para baixar, cancele a venda no Caixa.",
    );
    expect(fraseExternasLancadas([{ numero: 7, quantidades: { p: 1, m: 0, g: 2 } }])).toBe(
      "Já lançado: venda nº 7 (1 P · 2 G). As externas não descem abaixo disso — para baixar, cancele a venda no Caixa.",
    );
  });
});

describe("corpoExcluirQueima com as vendas que ficam no Caixa (UI-D25)", () => {
  const herdada =
    "Ela some do histórico do Forno «F» e o contador é recalculado. A contagem desta fornada (3 peças) vai junto.";

  it("uma venda ativa", () => {
    expect(corpoExcluirQueima("F", 3, [12])).toBe(
      `${herdada} A venda nº 12 continua no Caixa — se for o caso, cancele por lá.`,
    );
  });

  it("várias vendas ativas", () => {
    expect(corpoExcluirQueima("F", 3, [12, 15])).toBe(
      `${herdada} As vendas nº 12 e 15 continuam no Caixa — se for o caso, cancele por lá.`,
    );
  });

  it("sem vendas: só a parte da contagem", () => {
    expect(corpoExcluirQueima("F", 3, [])).toBe(herdada);
    expect(corpoExcluirQueima("F", 3)).toBe(herdada);
  });
});

describe("tags do Histórico (UI E9 · U39)", () => {
  it("tagSituacaoDaQueima: o valor do que falta, ou falta preço, ou nada", () => {
    expect(tagSituacaoDaQueima({ p: 1, m: 0, g: 0 }, 1100)?.replace(/\s/g, " ")).toBe("a cobrar · R$ 11,00");
    expect(tagSituacaoDaQueima({ p: 0, m: 0, g: 1 }, null)).toBe("a cobrar · falta preço");
    expect(tagSituacaoDaQueima({ p: 0, m: 0, g: 0 }, 0)).toBeNull();
  });

  it("tagDaVendaDaQueima: número, resumo e a situação da venda", () => {
    const quantidades = { p: 2, m: 0, g: 0 };
    expect(
      tagDaVendaDaQueima({ documentoId: "d", numero: 12, cancelada: false, paga: false, quantidades }),
    ).toBe("venda nº 12 · 2 P · em aberto");
    expect(
      tagDaVendaDaQueima({ documentoId: "d", numero: 12, cancelada: false, paga: true, quantidades }),
    ).toBe("venda nº 12 · 2 P · paga");
    expect(
      tagDaVendaDaQueima({
        documentoId: "d",
        numero: 12,
        cancelada: true,
        paga: true,
        quantidades: { p: 1, m: 0, g: 1 },
      }),
    ).toBe("venda nº 12 · 1 P · 1 G · cancelada");
  });
});

import { describe, expect, it } from "vitest";

import { abaDaUrl, cartoesDaAba, ORDEM_DOS_CARTOES, type CartaoDoPainel } from "../../lib/abertura/abas";

// Tarefa 1 (260919-e4n-PLAN.md): a regra "quais cartões do painel em qual aba", pedida pelo dono
// em 19/09 — "Comprometido" e "Sai neste mês" só na aba Por mês, "Precisa de atenção" só na aba
// Itens (a padrão), nenhum cartão em Tarefas e em Cotações. Casos escritos à mão a partir do
// pedido do dono, nunca derivados do próprio módulo.

describe("cartoesDaAba", () => {
  it('"itens" devolve exatamente ["atencao"]', () => {
    expect(cartoesDaAba("itens")).toEqual(["atencao"]);
  });

  it('"meses" devolve exatamente ["comprometido", "mes"]', () => {
    expect(cartoesDaAba("meses")).toEqual(["comprometido", "mes"]);
  });

  it('"tarefas" devolve lista vazia', () => {
    expect(cartoesDaAba("tarefas")).toEqual([]);
  });

  it('"cotacoes" devolve lista vazia', () => {
    expect(cartoesDaAba("cotacoes")).toEqual([]);
  });

  it("para toda aba, a lista devolvida está na ordem de ORDEM_DOS_CARTOES e não repete cartão", () => {
    const abas = ["itens", "tarefas", "meses", "cotacoes"] as const;
    for (const aba of abas) {
      const cartoes = cartoesDaAba(aba);
      // sem repetição
      expect(new Set(cartoes).size).toBe(cartoes.length);
      // ordem consistente com ORDEM_DOS_CARTOES
      const indices = cartoes.map((cartao) => ORDEM_DOS_CARTOES.indexOf(cartao as CartaoDoPainel));
      const ordenados = [...indices].sort((a, b) => a - b);
      expect(indices).toEqual(ordenados);
    }
  });

  it("composição da URL padrão: cartoesDaAba(abaDaUrl(undefined)) devolve [\"atencao\"]", () => {
    expect(cartoesDaAba(abaDaUrl(undefined))).toEqual(["atencao"]);
  });
});

describe("abaDaUrl", () => {
  it.each([undefined, null, "", "itens", "desconhecida", "MESES"])(
    "abaDaUrl(%j) devolve 'itens'",
    (valor) => {
      expect(abaDaUrl(valor)).toBe("itens");
    },
  );

  it.each(["tarefas", "meses", "cotacoes"] as const)(
    "abaDaUrl(%j) devolve o próprio valor",
    (valor) => {
      expect(abaDaUrl(valor)).toBe(valor);
    },
  );
});

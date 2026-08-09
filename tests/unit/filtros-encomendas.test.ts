import { describe, expect, it } from "vitest";

import {
  aplicarFiltros,
  calcularJanelaDoHistorico,
  combina,
  compararPorDataDeInicio,
  compararPorNome,
  compararPorUrgencia,
  filtrarPorStatus,
  normalizarParaBusca,
  type EncomendaFiltravel,
  type SituacaoDeUrgencia,
} from "../../lib/encomendas/filtros";

// Fixture mínima, sobrescrita campo a campo por teste — mesma técnica de `tests/unit/
// frescor.test.ts` (fixture-base + overrides), adaptada para o formato de encomenda.
function encomenda(sobrescritas: Partial<EncomendaFiltravel> = {}): EncomendaFiltravel {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    nome: "Encomenda de teste",
    clienteNome: null,
    status: "em_producao",
    dataInicio: "2026-08-01",
    itens: [{ descricao: "Item padrão" }],
    situacao: { tipo: "em-etapa-intervalo", diasAteProxima: 3 },
    ...sobrescritas,
  };
}

function situacao(valor: SituacaoDeUrgencia): SituacaoDeUrgencia {
  return valor;
}

describe("normalizarParaBusca", () => {
  it('"Coleção Verão" vira "colecao verao"', () => {
    expect(normalizarParaBusca("Coleção Verão")).toBe("colecao verao");
  });

  it('"CANECA" vira "caneca"', () => {
    expect(normalizarParaBusca("CANECA")).toBe("caneca");
  });

  it('"  açúcar  " vira "acucar" — espaços das pontas removidos, ç virando c', () => {
    expect(normalizarParaBusca("  açúcar  ")).toBe("acucar");
  });
});

describe("combina", () => {
  it('combina(encomenda "Coleção Verão", "colecao verao") é verdadeiro', () => {
    const alvo = encomenda({ nome: "Coleção Verão" });
    expect(combina(alvo, "colecao verao")).toBe(true);
  });

  it('combina(encomenda, "caneca") é verdadeiro quando o único acerto está na descrição de um item', () => {
    const alvo = encomenda({
      nome: "Encomenda de aniversário",
      clienteNome: "Marina",
      itens: [{ descricao: "Prato raso" }, { descricao: "Caneca artesanal" }],
    });
    expect(combina(alvo, "caneca")).toBe(true);
  });

  it('combina(encomenda, "") é verdadeiro para qualquer encomenda', () => {
    expect(combina(encomenda(), "")).toBe(true);
  });

  it('combina(encomenda, "   ") é verdadeiro para qualquer encomenda', () => {
    expect(combina(encomenda(), "   ")).toBe(true);
  });

  it('"verao cole" NÃO acha «Coleção Verão» — o termo não é quebrado em palavras', () => {
    const alvo = encomenda({ nome: "Coleção Verão" });
    expect(combina(alvo, "verao cole")).toBe(false);
  });

  it('"cao ver" acha «Coleção Verão» — é subcadeia literal de "colecao verao"', () => {
    const alvo = encomenda({ nome: "Coleção Verão" });
    expect(combina(alvo, "cao ver")).toBe(true);
  });

  it("busca também varre o cliente, não só nome e itens", () => {
    const alvo = encomenda({ nome: "Peças diversas", clienteNome: "Studio Sereia" });
    expect(combina(alvo, "sereia")).toBe(true);
  });
});

describe("filtrarPorStatus", () => {
  const lista = [
    encomenda({ id: "1", status: "rascunho" }),
    encomenda({ id: "2", status: "em_producao" }),
    encomenda({ id: "3", status: "concluida" }),
    encomenda({ id: "4", status: "cancelada" }),
  ];

  it('"todas" devolve a lista inteira', () => {
    expect(filtrarPorStatus(lista, "todas")).toHaveLength(4);
  });

  it('"em_producao" devolve só a em produção', () => {
    const resultado = filtrarPorStatus(lista, "em_producao");
    expect(resultado.map((e) => e.id)).toEqual(["2"]);
  });

  it('"rascunho" devolve só o rascunho', () => {
    const resultado = filtrarPorStatus(lista, "rascunho");
    expect(resultado.map((e) => e.id)).toEqual(["1"]);
  });

  it('"concluida" devolve só a concluída', () => {
    const resultado = filtrarPorStatus(lista, "concluida");
    expect(resultado.map((e) => e.id)).toEqual(["3"]);
  });

  it('"cancelada" devolve só a cancelada', () => {
    const resultado = filtrarPorStatus(lista, "cancelada");
    expect(resultado.map((e) => e.id)).toEqual(["4"]);
  });
});

describe("compararPorDataDeInicio", () => {
  it("ordena ascendente por data de início", () => {
    const lista = [
      encomenda({ id: "b", dataInicio: "2026-09-01", nome: "B" }),
      encomenda({ id: "a", dataInicio: "2026-08-01", nome: "A" }),
    ];
    const ordenada = [...lista].sort(compararPorDataDeInicio);
    expect(ordenada.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("mesma data: desempata por nome (localeCompare pt-BR)", () => {
    const lista = [
      encomenda({ id: "z", dataInicio: "2026-08-01", nome: "Zebra" }),
      encomenda({ id: "a", dataInicio: "2026-08-01", nome: "Ábaco" }),
    ];
    const ordenada = [...lista].sort(compararPorDataDeInicio);
    expect(ordenada.map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("mesma data e mesmo nome: desempata por id", () => {
    const lista = [
      encomenda({ id: "b", dataInicio: "2026-08-01", nome: "Igual" }),
      encomenda({ id: "a", dataInicio: "2026-08-01", nome: "Igual" }),
    ];
    const ordenada = [...lista].sort(compararPorDataDeInicio);
    expect(ordenada.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("compararPorNome", () => {
  it("usa localeCompare('pt-BR') — «Ácido» vem antes de «Barro»", () => {
    const lista = [encomenda({ id: "b", nome: "Barro" }), encomenda({ id: "a", nome: "Ácido" })];
    const ordenada = [...lista].sort(compararPorNome);
    expect(ordenada.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("compararPorUrgencia", () => {
  it("põe primeiro a encomenda cuja próxima etapa está mais perto", () => {
    const lista = [
      encomenda({ id: "longe", situacao: situacao({ tipo: "em-etapa-intervalo", diasAteProxima: 10 }) }),
      encomenda({ id: "perto", situacao: situacao({ tipo: "em-etapa-intervalo", diasAteProxima: 1 }) }),
    ];
    const ordenada = [...lista].sort(compararPorUrgencia);
    expect(ordenada.map((e) => e.id)).toEqual(["perto", "longe"]);
  });

  it("mesma proximidade: desempata por data de início, depois nome, depois id", () => {
    const lista = [
      encomenda({
        id: "b",
        dataInicio: "2026-08-01",
        situacao: situacao({ tipo: "em-etapa-intervalo", diasAteProxima: 2 }),
      }),
      encomenda({
        id: "a",
        dataInicio: "2026-07-01",
        situacao: situacao({ tipo: "em-etapa-intervalo", diasAteProxima: 2 }),
      }),
    ];
    const ordenada = [...lista].sort(compararPorUrgencia);
    expect(ordenada.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("atrasada é mais urgente que qualquer proximidade futura", () => {
    const lista = [
      encomenda({ id: "futuro", situacao: situacao({ tipo: "em-etapa-intervalo", diasAteProxima: 0 }) }),
      encomenda({ id: "atrasada", situacao: situacao({ tipo: "atrasada", diasDeAtraso: 5 }) }),
    ];
    const ordenada = [...lista].sort(compararPorUrgencia);
    expect(ordenada.map((e) => e.id)).toEqual(["atrasada", "futuro"]);
  });

  it("concluídas, canceladas e sem-etapas (sem próxima etapa) vão para o FIM, nunca para o começo", () => {
    const lista = [
      encomenda({ id: "concluida", situacao: situacao({ tipo: "concluida" }) }),
      encomenda({ id: "cancelada", situacao: situacao({ tipo: "cancelada" }) }),
      encomenda({ id: "sem-etapas", situacao: situacao({ tipo: "sem-etapas" }) }),
      encomenda({ id: "ativa", situacao: situacao({ tipo: "em-etapa-intervalo", diasAteProxima: 5 }) }),
    ];
    const ordenada = [...lista].sort(compararPorUrgencia);
    expect(ordenada[0].id).toBe("ativa");
    expect(ordenada.slice(1).map((e) => e.id).sort()).toEqual(
      ["cancelada", "concluida", "sem-etapas"].sort(),
    );
  });
});

describe("os três comparadores são totais", () => {
  it("aplicar sort duas vezes sobre a mesma lista devolve a mesma ordem", () => {
    const lista = [
      encomenda({ id: "3", nome: "Café", dataInicio: "2026-08-05" }),
      encomenda({ id: "1", nome: "Ábaco", dataInicio: "2026-08-01" }),
      encomenda({ id: "2", nome: "Ábaco", dataInicio: "2026-08-01" }),
      encomenda({
        id: "4",
        nome: "Data",
        dataInicio: "2026-08-05",
        situacao: situacao({ tipo: "atrasada", diasDeAtraso: 2 }),
      }),
    ];

    for (const comparador of [compararPorDataDeInicio, compararPorNome, compararPorUrgencia]) {
      const primeiraPassada = [...lista].sort(comparador).map((e) => e.id);
      const segundaPassada = [...lista].sort(comparador).map((e) => e.id);
      expect(segundaPassada).toEqual(primeiraPassada);
    }
  });
});

describe("aplicarFiltros", () => {
  it("combina status, busca e ordenação por interseção", () => {
    const lista = [
      encomenda({ id: "1", nome: "Coleção Verão", status: "em_producao", dataInicio: "2026-08-10" }),
      encomenda({ id: "2", nome: "Coleção Inverno", status: "em_producao", dataInicio: "2026-08-01" }),
      encomenda({ id: "3", nome: "Coleção Verão 2", status: "rascunho", dataInicio: "2026-08-05" }),
    ];

    const resultado = aplicarFiltros(lista, {
      termo: "verao",
      status: "em_producao",
      ordenacao: "data-inicio",
      hoje: "2026-08-09",
    });

    expect(resultado.map((e) => e.id)).toEqual(["1"]);
  });

  it("combinação sem resultado devolve lista vazia", () => {
    const lista = [encomenda({ id: "1", nome: "Coleção Verão" })];
    const resultado = aplicarFiltros(lista, {
      termo: "inexistente",
      status: "todas",
      ordenacao: "data-inicio",
      hoje: "2026-08-09",
    });
    expect(resultado).toEqual([]);
  });
});

describe("calcularJanelaDoHistorico", () => {
  it('calcularJanelaDoHistorico("2026-08-09") devolve "2025-08-09"', () => {
    expect(calcularJanelaDoHistorico("2026-08-09")).toBe("2025-08-09");
  });

  it("29 de fevereiro de um ano bissexto recua para 28 de fevereiro do ano comum anterior", () => {
    expect(calcularJanelaDoHistorico("2028-02-29")).toBe("2027-02-28");
  });
});

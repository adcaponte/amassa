import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  areasDoFiltro,
  contarDesativados,
  estadoDaLista,
  filtrarFornecedores,
  itensDeVende,
  normalizar,
  ordenarFornecedores,
  type FornecedorParaBusca,
} from "@/lib/fornecedores/busca";

// A busca da lista de fornecedores (06.2-03-PLAN.md, Tarefas 1 e 2; FRN-04). Nomes inventados — nenhum
// dado real, nenhum nome do protótipo. A Tarefa 2 acrescenta as matrizes de borda do EDGE-COVERAGE
// (adjacency, empty, encoding, ordering), uma categoria por `describe`.

function fornecedor(parcial: Partial<FornecedorParaBusca> & { id: string; nome: string }): FornecedorParaBusca {
  return {
    vende: null,
    area: "pecas",
    cidadeEntrega: null,
    ativo: true,
    ...parcial,
  };
}

describe("normalizar", () => {
  it("tira acento, caixa e espaços sobrando", () => {
    expect(normalizar("  ÇÃO   Ārgíla ")).toBe("cao argila");
  });
});

describe("filtrarFornecedores", () => {
  it("“argila” acha pelo nome e pelo que vende, cada um uma vez, em ordem alfabética, sem os desativados", () => {
    const lista = [
      fornecedor({ id: "3", nome: "Zeta Embalagens", vende: "caixa, papel" }),
      fornecedor({ id: "2", nome: "Loja do Barro", vende: "argila, esmalte" }),
      fornecedor({ id: "1", nome: "Argíla Sul" }),
      fornecedor({ id: "4", nome: "Argila Antiga", ativo: false }),
    ];
    const achados = filtrarFornecedores(lista, { termo: "argila", area: "tudo", mostrarDesativados: false });
    expect(achados.map((item) => item.nome)).toEqual(["Argíla Sul", "Loja do Barro"]);
  });
});

describe("pureza", () => {
  it("lib/fornecedores/busca.ts não importa React, Next, o banco nem o driver", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/busca.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+"(@\/db|react|next|drizzle-orm|pg)[/"]/);
  });
});

// ——— Tarefa 2: as arestas do EDGE-COVERAGE (FRN-04), uma categoria por `describe`. ———

const SEM_FILTRO = { termo: "", area: "tudo", mostrarDesativados: false } as const;

function nomes(lista: readonly FornecedorParaBusca[]): string[] {
  return lista.map((item) => item.nome);
}

describe("adjacency — um termo que casa em nome, vende e cidade", () => {
  const lista = [
    fornecedor({ id: "1", nome: "Argíla Sul" }),
    fornecedor({ id: "2", nome: "Loja do Barro", vende: "esmalte, argila branca" }),
    fornecedor({ id: "3", nome: "Transportes Vale", cidadeEntrega: "Argilândia · entrega em 3 dias" }),
    fornecedor({ id: "4", nome: "Argila Tripla", vende: "argila", cidadeEntrega: "Vila da Argila" }),
    fornecedor({ id: "5", nome: "Papelaria Centro", vende: "papel, fita" }),
  ];

  it("“argila” acha pelo nome, pelo que vende e pela cidade", () => {
    // Sem acento, "Argila Sul" vem antes de "Argila Tripla" (S < T).
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "argila" }))).toEqual([
      "Argíla Sul",
      "Argila Tripla",
      "Loja do Barro",
      "Transportes Vale",
    ]);
  });

  it("quem casa nos três campos aparece uma vez só", () => {
    const achados = filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "argila" });
    expect(achados.filter((item) => item.id === "4")).toHaveLength(1);
    expect(new Set(achados.map((item) => item.id)).size).toBe(achados.length);
  });

  it("o termo é procurado DENTRO de cada campo, não na junção deles", () => {
    // "barro esmalte" junta o fim do nome com o começo do vende — não é texto de nenhum campo.
    expect(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "barro esmalte" })).toEqual([]);
  });

  it("termo e área se somam; a área sozinha também filtra", () => {
    const comArea = [
      fornecedor({ id: "1", nome: "Café Argila", area: "cafeteria" }),
      fornecedor({ id: "2", nome: "Ateliê Argila", area: "pecas" }),
      fornecedor({ id: "3", nome: "Café Bom", area: "cafeteria" }),
    ];
    expect(nomes(filtrarFornecedores(comArea, { ...SEM_FILTRO, termo: "argila", area: "cafeteria" }))).toEqual([
      "Café Argila",
    ]);
    expect(nomes(filtrarFornecedores(comArea, { ...SEM_FILTRO, area: "cafeteria" }))).toEqual([
      "Café Argila",
      "Café Bom",
    ]);
  });
});

describe("empty — busca vazia, lista vazia, só desativados, sem resultado", () => {
  const lista = [
    fornecedor({ id: "1", nome: "Bento" }),
    fornecedor({ id: "2", nome: "Ávila" }),
    fornecedor({ id: "3", nome: "Antigo", ativo: false }),
  ];

  it("termo vazio ou só com espaços mostra todos os ativos", () => {
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "" }))).toEqual(["Ávila", "Bento"]);
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "   " }))).toEqual(["Ávila", "Bento"]);
    expect(normalizar("   ")).toBe("");
  });

  it("lista vazia → vazio-total, com qualquer filtro", () => {
    expect(estadoDaLista([], SEM_FILTRO)).toBe("vazio-total");
    expect(estadoDaLista([], { termo: "x", area: "loja", mostrarDesativados: true })).toBe("vazio-total");
    expect(filtrarFornecedores([], SEM_FILTRO)).toEqual([]);
  });

  it("só desativados → so-desativados; com eles à mostra, a lista tem itens", () => {
    const soDesativados = [fornecedor({ id: "1", nome: "Antigo", ativo: false })];
    expect(estadoDaLista(soDesativados, SEM_FILTRO)).toBe("so-desativados");
    expect(estadoDaLista(soDesativados, { ...SEM_FILTRO, termo: "qualquer" })).toBe("so-desativados");
    expect(estadoDaLista(soDesativados, { ...SEM_FILTRO, mostrarDesativados: true })).toBe("com-itens");
    expect(contarDesativados(soDesativados)).toBe(1);
  });

  it("termo sem casamento → sem-resultado; com casamento → com-itens", () => {
    expect(estadoDaLista(lista, { ...SEM_FILTRO, termo: "zzz" })).toBe("sem-resultado");
    expect(estadoDaLista(lista, { ...SEM_FILTRO, termo: "bento" })).toBe("com-itens");
    // O desativado não conta enquanto está escondido.
    expect(estadoDaLista(lista, { ...SEM_FILTRO, termo: "antigo" })).toBe("sem-resultado");
    expect(estadoDaLista(lista, { ...SEM_FILTRO, termo: "antigo", mostrarDesativados: true })).toBe("com-itens");
  });

  it("nenhum desativado conta 0 (o link some)", () => {
    expect(contarDesativados([fornecedor({ id: "1", nome: "Bento" })])).toBe(0);
    expect(contarDesativados([])).toBe(0);
  });

  it("pílulas: nenhuma ou uma área só → nenhuma pílula", () => {
    expect(areasDoFiltro([], false)).toEqual([]);
    expect(areasDoFiltro([fornecedor({ id: "1", nome: "A", area: "loja" })], false)).toEqual([]);
    expect(
      areasDoFiltro(
        [fornecedor({ id: "1", nome: "A", area: "loja" }), fornecedor({ id: "2", nome: "B", area: "loja" })],
        false,
      ),
    ).toEqual([]);
  });

  it("pílulas: só as áreas dos ativos, na ordem do protótipo; com os desativados, também as deles", () => {
    const misturada = [
      fornecedor({ id: "1", nome: "A", area: "geral" }),
      fornecedor({ id: "2", nome: "B", area: "pecas" }),
      fornecedor({ id: "3", nome: "C", area: "cafeteria" }),
      fornecedor({ id: "4", nome: "D", area: "espaco", ativo: false }),
    ];
    expect(areasDoFiltro(misturada, false)).toEqual(["pecas", "cafeteria", "geral"]);
    expect(areasDoFiltro(misturada, true)).toEqual(["pecas", "cafeteria", "espaco", "geral"]);
  });

  it("“vende” vazio, nulo ou só vírgulas → nenhuma etiqueta; itens aparados", () => {
    expect(itensDeVende(null)).toEqual([]);
    expect(itensDeVende(undefined)).toEqual([]);
    expect(itensDeVende("")).toEqual([]);
    expect(itensDeVende(" , ,, ")).toEqual([]);
    expect(itensDeVende("argila")).toEqual(["argila"]);
    expect(itensDeVende(" argila , , esmalte,")).toEqual(["argila", "esmalte"]);
  });
});

describe("encoding — a mesma normalização no termo e no texto", () => {
  it("“ÇÃO” casa “cao” e “cao” casa “ÇÃO”", () => {
    const lista = [fornecedor({ id: "1", nome: "Fundição ÇÃO" }), fornecedor({ id: "2", nome: "Embalagem cao" })];
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "cao" }))).toEqual([
      "Embalagem cao",
      "Fundição ÇÃO",
    ]);
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "ÇÃO" }))).toEqual([
      "Embalagem cao",
      "Fundição ÇÃO",
    ]);
  });

  it("“Cerâmica” casa “ceramica”, nos dois sentidos e no “vende”", () => {
    const lista = [
      fornecedor({ id: "1", nome: "Cerâmica Leste" }),
      fornecedor({ id: "2", nome: "Loja Norte", vende: "ceramica fria, esmalte" }),
    ];
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "ceramica" }))).toEqual([
      "Cerâmica Leste",
      "Loja Norte",
    ]);
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "CERÂMICA" }))).toEqual([
      "Cerâmica Leste",
      "Loja Norte",
    ]);
  });

  it("espaços múltiplos colapsam no termo e no texto", () => {
    const lista = [fornecedor({ id: "1", nome: "Argila   do    Vale" })];
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, termo: "  argila  do vale " }))).toEqual([
      "Argila   do    Vale",
    ]);
    expect(normalizar("a\t\nb   c")).toBe("a b c");
  });

  it("acento composto e decomposto dão o mesmo texto", () => {
    // "é" pré-composto (U+00E9) e "e" + acento combinante (U+0065 U+0301).
    expect(normalizar("café")).toBe("cafe");
    expect(normalizar("café")).toBe("cafe");
  });
});

describe("ordering — alfabética pt-BR sem caixa nem acento, desempate por id", () => {
  it("“Ávila” antes de “Bento” antes de “caio”", () => {
    const lista = [
      fornecedor({ id: "1", nome: "caio" }),
      fornecedor({ id: "2", nome: "Bento" }),
      fornecedor({ id: "3", nome: "Ávila" }),
    ];
    expect(nomes(ordenarFornecedores(lista))).toEqual(["Ávila", "Bento", "caio"]);
    expect(nomes(filtrarFornecedores(lista, SEM_FILTRO))).toEqual(["Ávila", "Bento", "caio"]);
  });

  it("nomes iguais para o localeCompare base saem pela ordem do id, de qualquer jeito que cheguem", () => {
    const a = fornecedor({ id: "a", nome: "argíla" });
    const b = fornecedor({ id: "b", nome: "Argila" });
    expect(ordenarFornecedores([b, a]).map((item) => item.id)).toEqual(["a", "b"]);
    expect(ordenarFornecedores([a, b]).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("desativados à mostra entram no meio da ordem, não no fim", () => {
    const lista = [
      fornecedor({ id: "1", nome: "Cobre" }),
      fornecedor({ id: "2", nome: "Barro", ativo: false }),
      fornecedor({ id: "3", nome: "Areia" }),
    ];
    expect(nomes(filtrarFornecedores(lista, { ...SEM_FILTRO, mostrarDesativados: true }))).toEqual([
      "Areia",
      "Barro",
      "Cobre",
    ]);
  });

  it("ordenar não muda a lista recebida", () => {
    const lista = [fornecedor({ id: "1", nome: "B" }), fornecedor({ id: "2", nome: "A" })];
    ordenarFornecedores(lista);
    expect(nomes(lista)).toEqual(["B", "A"]);
  });
});

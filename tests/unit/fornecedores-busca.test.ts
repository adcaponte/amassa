import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  filtrarFornecedores,
  normalizar,
  type FornecedorParaBusca,
} from "@/lib/fornecedores/busca";

// A busca da lista de fornecedores (06.2-03-PLAN.md, Tarefa 1; FRN-04). Nomes inventados — nenhum
// dado real, nenhum nome do protótipo. As matrizes de borda (adjacency, empty, encoding, ordering) são
// da Tarefa 2.

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

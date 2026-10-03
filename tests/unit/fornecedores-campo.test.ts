import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAXIMO_DE_SUGESTOES,
  situacaoDoVinculo,
  sugestoesDoCampo,
  type FornecedorDoCampo,
} from "@/lib/fornecedores/campo";

// O campo "Fornecedor" da Despesa (06.2-10-PLAN.md, Tarefa 1; FRN-12, D-04). Nomes inventados — nenhum
// dado real, nenhum nome do protótipo. A Tarefa 2 acrescenta a matriz de bordas das sugestões; as
// matrizes de `situacaoDoVinculo` com os seis estados são do plano 12.

function fornecedor(parcial: Partial<FornecedorDoCampo> & { id: string; nome: string }): FornecedorDoCampo {
  return { vende: null, cidadeEntrega: null, ...parcial };
}

function nomes(lista: readonly FornecedorDoCampo[]): string[] {
  return lista.map((item) => item.nome);
}

describe("sugestoesDoCampo", () => {
  it("“argila” acha quem tem argila no nome ou no que vende, em ordem alfabética", () => {
    const lista = [
      fornecedor({ id: "1", nome: "Zeta Embalagens", vende: "caixa, papel" }),
      fornecedor({ id: "2", nome: "Casa da Argila Fictícia", vende: "barbotina" }),
      fornecedor({ id: "3", nome: "Barro Inventado", vende: "argila, esmalte" }),
      fornecedor({ id: "4", nome: "Loja Qualquer", vende: null, cidadeEntrega: "Argilândia" }),
    ];
    const { opcoes, haMais } = sugestoesDoCampo(lista, "argila");
    expect(nomes(opcoes)).toEqual(["Barro Inventado", "Casa da Argila Fictícia"]);
    expect(haMais).toBe(false);
  });

  it("no máximo 8, com haMais quando passa", () => {
    const lista = Array.from({ length: 12 }, (_, indice) =>
      fornecedor({ id: String(indice), nome: `Fornecedor ${String(indice).padStart(2, "0")}`, vende: "argila" }),
    );
    const { opcoes, haMais } = sugestoesDoCampo(lista, "argila");
    expect(opcoes).toHaveLength(MAXIMO_DE_SUGESTOES);
    expect(MAXIMO_DE_SUGESTOES).toBe(8);
    expect(haMais).toBe(true);
  });
});

describe("situacaoDoVinculo", () => {
  it("campo vazio (ou só espaços) e sem escolha = vazio", () => {
    expect(situacaoDoVinculo({ texto: "", fornecedorId: null })).toBe("vazio");
    expect(situacaoDoVinculo({ texto: "   ", fornecedorId: null })).toBe("vazio");
  });

  it("escolhido da lista = ligado", () => {
    expect(situacaoDoVinculo({ texto: "Barro Inventado", fornecedorId: "abc" })).toBe("ligado");
  });

  it("texto sem escolha = texto livre — mesmo igual ao nome de um fornecedor (nada liga sozinho, UI-D4)", () => {
    expect(situacaoDoVinculo({ texto: "Barro Inventado", fornecedorId: null })).toBe("texto-livre");
  });
});

describe("pureza", () => {
  it("lib/fornecedores/campo.ts não importa React, Next, o banco nem o driver", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/campo.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+"(@\/db|react|next|drizzle-orm|pg)[/"]/);
  });
});

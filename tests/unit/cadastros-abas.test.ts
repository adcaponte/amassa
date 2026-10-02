import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import { subDaUrl, type SubCadastros } from "@/lib/cadastros/abas";

// 04.5-02-PLAN.md, Tarefa 3 (D-03) — `SubCadastros` ganha "parametros"; `subDaUrl` continua
// caindo em "catalogo" para valor desconhecido (o fallback não muda).

describe("subDaUrl — Fase 04.5 (D-03)", () => {
  it.each([
    ["catalogo", "catalogo"],
    ["categorias", "categorias"],
    ["fixas", "fixas"],
    ["taxas", "taxas"],
    ["parametros", "parametros"],
    // Fase 5 (D-01, 05-04-PLAN.md): Clientes é a sexta sub-aba — o mesmo cadastro das Pessoas da Agenda.
    ["clientes", "clientes"],
    // Fase 06.2 (UI-D1, 06.2-02-PLAN.md): Fornecedores é a sétima sub-aba, a última pílula.
    ["fornecedores", "fornecedores"],
  ] satisfies [string, SubCadastros][])('subDaUrl("%s") → "%s"', (valor, esperado) => {
    expect(subDaUrl(valor)).toBe(esperado);
  });

  it.each([undefined, null, "", "algo-desconhecido", "FORNECEDORES"])(
    "valor desconhecido (%s) continua caindo em 'catalogo' — o fallback não muda",
    (valor) => {
      expect(subDaUrl(valor)).toBe("catalogo");
    },
  );
});

// 06.2-02-PLAN.md, Tarefa 2 — as SETE sub-abas da URL, borda por borda, e a prova de que toda pílula
// leva a uma sub-aba que a URL aceita.

// Os valores da união `SubCadastros` (lib/cadastros/abas.ts). O `expectTypeOf` abaixo reprova o
// arquivo se a união ganhar ou perder um valor sem esta lista acompanhar.
const AS_SETE_SUB_ABAS = [
  "catalogo",
  "categorias",
  "clientes",
  "fixas",
  "taxas",
  "parametros",
  "fornecedores",
] as const satisfies readonly SubCadastros[];

describe("subDaUrl — as sete sub-abas (Fase 06.2, UI-D1)", () => {
  it("a lista do teste é exatamente a união SubCadastros", () => {
    expectTypeOf<(typeof AS_SETE_SUB_ABAS)[number]>().toEqualTypeOf<SubCadastros>();
    expect(new Set(AS_SETE_SUB_ABAS).size).toBe(7);
  });

  it.each(AS_SETE_SUB_ABAS)('cada sub-aba volta igual: subDaUrl("%s")', (valor) => {
    expect(subDaUrl(valor)).toBe(valor);
  });

  it.each([
    ["caixa diferente", "Fornecedores"],
    ["tudo maiúsculo", "FORNECEDORES"],
    ["espaços em volta", " fornecedores "],
    ["singular", "fornecedor"],
    ["vazio", ""],
    ["null", null],
    ["undefined", undefined],
  ] as const)("%s (%s) cai em 'catalogo', sem lançar", (_caso, valor) => {
    expect(() => subDaUrl(valor)).not.toThrow();
    expect(subDaUrl(valor)).toBe("catalogo");
  });
});

// Lê `components/amassa/cadastros/sub-abas-cadastros.tsx` como TEXTO (sem importar o .tsx) e extrai
// os `valor: "…"` das constantes `*_FILEIRA`: cada pílula desenhada aponta para uma sub-aba que a URL
// aceita, nenhuma se repete, e são as sete.
describe("as pílulas de Cadastros × subDaUrl (Fase 06.2, UI-D1)", () => {
  const caminho = join(process.cwd(), "components/amassa/cadastros/sub-abas-cadastros.tsx");
  const fonte = readFileSync(caminho, "utf-8");

  const fileiras = [...fonte.matchAll(/const\s+\w+_FILEIRA\b[^=]*=\s*\[([\s\S]*?)\];/g)].map(
    (casamento) => casamento[1],
  );
  const valores = fileiras.flatMap((corpo) =>
    [...corpo.matchAll(/valor:\s*"([^"]*)"/g)].map((casamento) => casamento[1]),
  );

  it("o componente tem três fileiras (3 + 3 + 1)", () => {
    expect(fileiras.map((corpo) => [...corpo.matchAll(/valor:\s*"/g)].length)).toEqual([3, 3, 1]);
  });

  it("as pílulas são sete, sem repetição, e “Fornecedores” é a última", () => {
    expect(valores).toHaveLength(7);
    expect(new Set(valores).size).toBe(7);
    expect(valores.at(-1)).toBe("fornecedores");
    expect([...valores].sort()).toEqual([...AS_SETE_SUB_ABAS].sort());
  });

  it.each(valores)('a pílula "%s" leva a uma sub-aba que a URL aceita', (valor) => {
    expect(subDaUrl(valor)).toBe(valor);
  });
});

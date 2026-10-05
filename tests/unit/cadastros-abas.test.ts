import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  deslocamentoParaCentralizar,
  ORDEM_DAS_SUBS_CADASTROS,
  subDaUrl,
  type SubCadastros,
} from "@/lib/cadastros/abas";

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

// Fase 06.5 (D-09, POL-02, 06.5-04-PLAN.md): as sete pílulas viram UMA fileira com rolagem lateral, na
// ordem do dono. A ordem mora em `ORDEM_DAS_SUBS_CADASTROS`; o componente só a percorre.
describe("ORDEM_DAS_SUBS_CADASTROS — a fileira única (Fase 06.5, D-09)", () => {
  it("é a ordem do dono: Catálogo · Clientes · Fornecedores · Contas fixas · Categorias · Parâmetros · Taxas", () => {
    expect(ORDEM_DAS_SUBS_CADASTROS).toEqual([
      "catalogo",
      "clientes",
      "fornecedores",
      "fixas",
      "categorias",
      "parametros",
      "taxas",
    ]);
  });

  it("tem as sete sub-abas, sem repetição", () => {
    expect(ORDEM_DAS_SUBS_CADASTROS).toHaveLength(7);
    expect(new Set(ORDEM_DAS_SUBS_CADASTROS).size).toBe(7);
    expect([...ORDEM_DAS_SUBS_CADASTROS].sort()).toEqual([...AS_SETE_SUB_ABAS].sort());
  });

  it.each(ORDEM_DAS_SUBS_CADASTROS)('a pílula "%s" leva a uma sub-aba que a URL aceita', (valor) => {
    expect(subDaUrl(valor)).toBe(valor);
  });
});

// Lê `components/amassa/cadastros/sub-abas-cadastros.tsx` como TEXTO (sem importar o .tsx): o
// componente percorre a lista ordenada e não tem mais os espaçadores das três fileiras.
describe("as pílulas de Cadastros seguem a lista ordenada (Fase 06.5, D-09)", () => {
  const caminho = join(process.cwd(), "components/amassa/cadastros/sub-abas-cadastros.tsx");
  const fonte = readFileSync(caminho, "utf-8");

  it("o componente percorre ORDEM_DAS_SUBS_CADASTROS", () => {
    expect(fonte).toMatch(/ORDEM_DAS_SUBS_CADASTROS\.map\(/);
  });

  it("não sobra nenhuma constante *_FILEIRA nem espaçador basis-full", () => {
    expect(fonte).not.toMatch(/const\s+\w+_FILEIRA\b/);
    expect(fonte).not.toMatch(/basis-full/);
  });
});

describe("deslocamentoParaCentralizar — a aba ativa no meio do trilho (Fase 06.5, D-09)", () => {
  it("pílula no começo → 0 (nunca negativo)", () => {
    expect(
      deslocamentoParaCentralizar({ larguraDoTrilho: 327, inicioDaPilula: 4, larguraDaPilula: 96 }),
    ).toBe(0);
  });

  it("pílula no meio → o centro da pílula cai no centro do trilho", () => {
    // 400 − (300 − 100) / 2 = 300; o centro da pílula (450) menos 300 = 150, o meio do trilho.
    expect(
      deslocamentoParaCentralizar({ larguraDoTrilho: 300, inicioDaPilula: 400, larguraDaPilula: 100 }),
    ).toBe(300);
  });

  it("pílula no fim → passa do máximo rolável; o navegador corta no teto ao atribuir scrollLeft", () => {
    // Trilho de 327 px com 804 px de conteúdo: o máximo rolável é 477. "Taxas" começa em 740 e
    // mede 60 → 740 − (327 − 60) / 2 = 606,5, acima de 477 — quem limita é o navegador.
    expect(
      deslocamentoParaCentralizar({ larguraDoTrilho: 327, inicioDaPilula: 740, larguraDaPilula: 60 }),
    ).toBe(606.5);
  });

  it("pílula mais larga que o trilho → alinha pelo começo dela menos a sobra (nunca negativo)", () => {
    expect(
      deslocamentoParaCentralizar({ larguraDoTrilho: 100, inicioDaPilula: 10, larguraDaPilula: 200 }),
    ).toBe(60);
  });
});

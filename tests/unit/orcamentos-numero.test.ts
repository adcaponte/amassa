import { describe, expect, it } from "vitest";

import { numeroDeOrcamento, rotuloDeRevisao } from "@/lib/orcamentos/formato";

// 04.5-01-PLAN.md, Tarefa 3 — o formato ORC-2026-001 (D-05), o mesmo em toda tela. A prova de
// concorrência real (duas transações, dois números diferentes e consecutivos) roda contra
// Postgres de verdade em `scripts/testar-migracoes.mjs`, nunca aqui — este arquivo cobre só as
// funções puras de formatação.

describe("numeroDeOrcamento", () => {
  it.each([
    [2026, 1, "ORC-2026-001"],
    [2026, 40, "ORC-2026-040"],
    [2027, 999, "ORC-2027-999"],
    [2026, 1000, "ORC-2026-1000"], // passa de três dígitos sem truncar nem estourar
  ])("numeroDeOrcamento(%s, %s) → %s", (ano, sequencial, esperado) => {
    expect(numeroDeOrcamento(ano, sequencial)).toBe(esperado);
  });
});

describe("rotuloDeRevisao", () => {
  it("string vazia na revisão 1", () => {
    expect(rotuloDeRevisao(1)).toBe("");
  });

  it('" · revisão 2" a partir da revisão 2', () => {
    expect(rotuloDeRevisao(2)).toBe(" · revisão 2");
  });

  it('" · revisão 5" na revisão 5', () => {
    expect(rotuloDeRevisao(5)).toBe(" · revisão 5");
  });
});

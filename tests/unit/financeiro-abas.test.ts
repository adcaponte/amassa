import { describe, expect, it } from "vitest";

import { abaDaUrl, type AbaFinanceiro } from "@/lib/financeiro/abas";

// 04.5-01-PLAN.md, Tarefa 4 (D-01/D-02) — `AbaFinanceiro` ganha "orcamentos" e "pecas";
// `abaDaUrl` continua caindo em "venda" para valor desconhecido (o fallback não muda).
//
// Nota de execução (ver 04.5-01-SUMMARY.md, "Decidido sem o dono"): o PLAN.md desta tarefa lista
// `tests/unit/abertura-abas.test.ts` entre os arquivos modificados, mas esse arquivo testa
// `lib/abertura/abas.ts` — um módulo completamente diferente, não tocado por esta tarefa. Este
// arquivo novo (`financeiro-abas.test.ts`) é o substituto correto: testa o módulo que a Tarefa 4
// de fato modifica (`lib/financeiro/abas.ts`).

describe("abaDaUrl — Fase 04.5 (D-01/D-02)", () => {
  it.each([
    ["venda", "venda"],
    ["despesa", "despesa"],
    ["caixa", "caixa"],
    ["mes", "mes"],
    ["orcamentos", "orcamentos"],
    ["pecas", "pecas"],
  ] satisfies [string, AbaFinanceiro][])('abaDaUrl("%s") → "%s"', (valor, esperado) => {
    expect(abaDaUrl(valor)).toBe(esperado);
  });

  it.each([undefined, null, "", "algo-desconhecido"])(
    "valor desconhecido (%s) continua caindo em 'venda' — o fallback não muda (D-01)",
    (valor) => {
      expect(abaDaUrl(valor)).toBe("venda");
    },
  );
});

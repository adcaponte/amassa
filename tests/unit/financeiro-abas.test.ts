import { describe, expect, it } from "vitest";

import { abaDaUrl, origemDaUrl, type AbaFinanceiro } from "@/lib/financeiro/abas";
import { hrefDaVendaComOrigem } from "@/lib/financeiro/navegacao";

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

// Fase 05, plano 12 (AGE-15, mecanismo B da pesquisa): a Venda aberta pela Agenda. `origemDaUrl`
// normaliza `?origem=` para a união fechada — tipo desconhecido, uuid inválido, vazio ou lista → `null`.
describe("origemDaUrl — a Venda aberta pela Agenda (05-12)", () => {
  const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

  it.each(["mensalidade", "inscricao", "uso_livre"] as const)('"%s:{uuid}" → { tipo, id }', (tipo) => {
    expect(origemDaUrl(`${tipo}:${ID}`)).toEqual({ tipo, id: ID });
  });

  it("aceita o uuid em maiúsculas e devolve em minúsculas", () => {
    expect(origemDaUrl(`mensalidade:${ID.toUpperCase()}`)).toEqual({ tipo: "mensalidade", id: ID });
  });

  it.each([
    undefined,
    null,
    "",
    "mensalidade",
    `mensalidade:`,
    `encomenda:${ID}`,
    `mensalidade:nao-e-uuid`,
    `mensalidade:${ID}:extra`,
    ` mensalidade:${ID}`,
    `MENSALIDADE:${ID}`,
  ])("valor inválido (%s) → null", (valor) => {
    expect(origemDaUrl(valor)).toBeNull();
  });

  it("lista (o parâmetro repetido na URL) → null", () => {
    expect(origemDaUrl([`mensalidade:${ID}`, `inscricao:${ID}`])).toBeNull();
  });
});

describe("hrefDaVendaComOrigem — 05-12", () => {
  const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

  it("monta a URL da Venda com a origem escapada pelo URLSearchParams", () => {
    expect(hrefDaVendaComOrigem({ tipo: "uso_livre", id: ID })).toBe(
      `/gestao/financeiro?aba=venda&origem=uso_livre%3A${ID}`,
    );
  });

  it("ida e volta: origemDaUrl lê de novo o que hrefDaVendaComOrigem escreveu", () => {
    const href = hrefDaVendaComOrigem({ tipo: "mensalidade", id: ID });
    const lido = new URL(href, "https://exemplo.test").searchParams.get("origem");
    expect(origemDaUrl(lido)).toEqual({ tipo: "mensalidade", id: ID });
  });
});

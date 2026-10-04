import { describe, expect, it } from "vitest";

import {
  abaDaUrl,
  ehOrigemDaAgenda,
  moduloDaOrigem,
  moduloDoTextoDaOrigem,
  origemDaUrl,
  type AbaFinanceiro,
} from "@/lib/financeiro/abas";
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

// Fase 06.4, plano 05 (QMC-08, D-07): a Venda aberta pelas Queimas. O Financeiro deixa de supor que
// toda origem é da Agenda — `queima:{uuid}` entra na união, e `moduloDaOrigem` diz quem é o dono.
// Os casos da Agenda acima continuam iguais (e `encomenda:{uuid}` continua inválido).
describe("origemDaUrl e moduloDaOrigem — a Venda aberta pelas Queimas (06.4-05)", () => {
  const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  it('"queima:{uuid}" → { tipo: "queima", id } com o uuid em minúsculas', () => {
    expect(origemDaUrl("queima:3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toEqual({ tipo: "queima", id: ID });
  });

  it.each([`encomenda:${ID}`, `QUEIMA:${ID}`, "queima:nao-e-uuid", `queima:${ID}:extra`, "queima:"])(
    "valor inválido (%s) → null",
    (valor) => {
      expect(origemDaUrl(valor)).toBeNull();
    },
  );

  it("moduloDaOrigem: queima → queimas; os três tipos da Agenda → agenda", () => {
    expect(moduloDaOrigem("queima")).toBe("queimas");
    expect(moduloDaOrigem("uso_livre")).toBe("agenda");
    expect(moduloDaOrigem("mensalidade")).toBe("agenda");
    expect(moduloDaOrigem("inscricao")).toBe("agenda");
  });

  it("ehOrigemDaAgenda estreita só as origens da Agenda", () => {
    expect(ehOrigemDaAgenda({ tipo: "mensalidade", id: ID })).toBe(true);
    expect(ehOrigemDaAgenda({ tipo: "queima", id: ID })).toBe(false);
  });

  it("moduloDoTextoDaOrigem: só o prefixo exato `queima:` aponta para as Queimas", () => {
    expect(moduloDoTextoDaOrigem("queima:mal-formado")).toBe("queimas");
    expect(moduloDoTextoDaOrigem(`encomenda:${ID}`)).toBe("agenda");
    expect(moduloDoTextoDaOrigem("QUEIMA:x")).toBe("agenda");
    expect(moduloDoTextoDaOrigem(undefined)).toBe("agenda");
    expect(moduloDoTextoDaOrigem(["queima:x"])).toBe("agenda");
  });

  it("ida e volta: hrefDaVendaComOrigem com a queima", () => {
    const href = hrefDaVendaComOrigem({ tipo: "queima", id: ID });
    expect(href).toBe(`/gestao/financeiro?aba=venda&origem=queima%3A${ID}`);
    const lido = new URL(href, "https://exemplo.test").searchParams.get("origem");
    expect(origemDaUrl(lido)).toEqual({ tipo: "queima", id: ID });
  });
});

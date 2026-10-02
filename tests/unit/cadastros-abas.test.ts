import { describe, expect, it } from "vitest";

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

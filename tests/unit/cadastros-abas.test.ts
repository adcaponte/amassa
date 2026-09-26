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
  ] satisfies [string, SubCadastros][])('subDaUrl("%s") → "%s"', (valor, esperado) => {
    expect(subDaUrl(valor)).toBe(esperado);
  });

  it.each([undefined, null, "", "algo-desconhecido"])(
    "valor desconhecido (%s) continua caindo em 'catalogo' — o fallback não muda",
    (valor) => {
      expect(subDaUrl(valor)).toBe("catalogo");
    },
  );
});

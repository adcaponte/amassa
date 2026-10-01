import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  destinoSaida,
  estadoUsoLivre,
  presencaDaInscricao,
  tipoEvento,
  tipoInscricao,
} from "@/db/schema";
import {
  ESTADOS_DE_USO_LIVRE,
  PRESENCAS,
  TIPOS_DE_EVENTO,
  TIPOS_DE_INSCRICAO,
} from "@/lib/agenda/tipos";
import { DESTINOS_DA_FOLHA_DO_ESTOQUE, DESTINOS_DE_SAIDA } from "@/lib/estoque/destinos";

// Fase 5 (plano 01). As uniões de `lib/agenda/tipos.ts` e de `lib/estoque/destinos.ts` são
// REDECLARADAS à mão (os módulos são puros, não importam `@/db/schema`) — estes testes são o elo que
// obriga as duas cópias a continuarem iguais, no molde de `tests/unit/producao-etapas.test.ts`.
describe("paridade com os enums de db/schema.ts", () => {
  it("TIPOS_DE_EVENTO casa com tipoEvento.enumValues", () => {
    expect(TIPOS_DE_EVENTO).toEqual(tipoEvento.enumValues);
  });

  it("TIPOS_DE_INSCRICAO casa com tipoInscricao.enumValues", () => {
    expect(TIPOS_DE_INSCRICAO).toEqual(tipoInscricao.enumValues);
  });

  it("PRESENCAS casa com presencaDaInscricao.enumValues", () => {
    expect(PRESENCAS).toEqual(presencaDaInscricao.enumValues);
  });

  it("ESTADOS_DE_USO_LIVRE casa com estadoUsoLivre.enumValues", () => {
    expect(ESTADOS_DE_USO_LIVRE).toEqual(estadoUsoLivre.enumValues);
  });

  it("DESTINOS_DE_SAIDA (a descrição, seis) casa com destinoSaida.enumValues — o uso livre no fim (D-06)", () => {
    expect(DESTINOS_DE_SAIDA.map((destino) => destino.valor)).toEqual(destinoSaida.enumValues);
    expect(destinoSaida.enumValues.at(-1)).toBe("uso_livre");
  });

  it("a folha do Estoque tem os cinco de antes, sem o uso livre", () => {
    const valores = DESTINOS_DA_FOLHA_DO_ESTOQUE.map((destino) => destino.valor);
    expect(valores).toEqual(["aula", "encomenda", "cafeteria", "atelie", "perda"]);
    expect(valores).not.toContain("uso_livre");
  });
});

describe("pureza", () => {
  it("lib/agenda/tipos.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/tipos.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

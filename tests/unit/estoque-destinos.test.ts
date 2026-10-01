import { describe, expect, it } from "vitest";

import {
  DESTINOS_DA_FOLHA_DO_ESTOQUE,
  DESTINOS_DE_SAIDA,
  areaDoDestino,
  ehDestinoDaFolha,
  ehDestinoDeSaida,
  rotuloDoDestino,
} from "@/lib/estoque/destinos";

// Os destinos da saída manual (D-14, D-15) e o sexto, o uso livre da Agenda (D-06): a lista da folha
// é a única fonte da grade, a descrição completa é a do "Para onde foi", e a área que paga é decidida
// no servidor a partir dela. A paridade com o enum do banco está em `agenda-paridade.test.ts`.
describe("DESTINOS_DE_SAIDA", () => {
  it("a folha do Estoque tem cinco destinos, na ordem da grade: aula, encomenda, cafeteria, ateliê, perda", () => {
    expect(DESTINOS_DA_FOLHA_DO_ESTOQUE.map((destino) => destino.valor)).toEqual([
      "aula",
      "encomenda",
      "cafeteria",
      "atelie",
      "perda",
    ]);
  });

  it("a descrição tem seis: os cinco da folha e o uso livre do espaço (D-06), no fim", () => {
    expect(DESTINOS_DE_SAIDA.map((destino) => destino.valor)).toEqual([
      "aula",
      "encomenda",
      "cafeteria",
      "atelie",
      "perda",
      "uso_livre",
    ]);
    expect(DESTINOS_DE_SAIDA.at(-1)).toEqual({
      valor: "uso_livre",
      rotulo: "Uso livre do espaço",
      area: "espaco",
      vinculo: "uso-livre",
    });
  });

  it("cada destino diz qual área do Financeiro paga (D-14): Espaço, Peças, Cafeteria, Peças, Peças, Espaço", () => {
    expect(areaDoDestino("aula")).toBe("espaco");
    expect(areaDoDestino("encomenda")).toBe("pecas");
    expect(areaDoDestino("cafeteria")).toBe("cafeteria");
    expect(areaDoDestino("atelie")).toBe("pecas");
    expect(areaDoDestino("perda")).toBe("pecas");
    expect(areaDoDestino("uso_livre")).toBe("espaco");
  });

  it('"venda" não é destino de saída manual (D-15) — venda só nasce no Financeiro', () => {
    expect(ehDestinoDeSaida("venda")).toBe(false);
    expect(ehDestinoDeSaida("")).toBe(false);
    expect(ehDestinoDeSaida(undefined)).toBe(false);
    expect(ehDestinoDeSaida(1)).toBe(false);
    for (const destino of DESTINOS_DE_SAIDA) {
      expect(ehDestinoDeSaida(destino.valor)).toBe(true);
    }
  });

  it("a folha do Estoque recusa o uso livre (só a Agenda o grava, com vínculo) e aceita os outros cinco", () => {
    expect(ehDestinoDaFolha("uso_livre")).toBe(false);
    expect(ehDestinoDaFolha("venda")).toBe(false);
    expect(ehDestinoDaFolha(undefined)).toBe(false);
    for (const destino of DESTINOS_DA_FOLHA_DO_ESTOQUE) {
      expect(ehDestinoDaFolha(destino.valor)).toBe(true);
    }
  });

  it("o rótulo de cada destino é o da folha", () => {
    expect(rotuloDoDestino("atelie")).toBe("Uso do ateliê");
    expect(rotuloDoDestino("perda")).toBe("Perda ou quebra");
    expect(rotuloDoDestino("uso_livre")).toBe("Uso livre do espaço");
  });
});

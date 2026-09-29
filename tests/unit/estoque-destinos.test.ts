import { describe, expect, it } from "vitest";

import {
  DESTINOS_DE_SAIDA,
  areaDoDestino,
  ehDestinoDeSaida,
  rotuloDoDestino,
} from "@/lib/estoque/destinos";

// Os destinos da saída manual (D-14, D-15): a lista é a única fonte da grade da folha, e a área que
// paga é decidida no servidor a partir dela.
describe("DESTINOS_DE_SAIDA", () => {
  it("tem os cinco destinos, na ordem da grade: aula, encomenda, cafeteria, ateliê, perda", () => {
    expect(DESTINOS_DE_SAIDA.map((destino) => destino.valor)).toEqual([
      "aula",
      "encomenda",
      "cafeteria",
      "atelie",
      "perda",
    ]);
  });

  it("cada destino diz qual área do Financeiro paga (D-14): Espaço, Peças, Cafeteria, Peças, Peças", () => {
    expect(areaDoDestino("aula")).toBe("espaco");
    expect(areaDoDestino("encomenda")).toBe("pecas");
    expect(areaDoDestino("cafeteria")).toBe("cafeteria");
    expect(areaDoDestino("atelie")).toBe("pecas");
    expect(areaDoDestino("perda")).toBe("pecas");
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

  it("o rótulo de cada destino é o da folha", () => {
    expect(rotuloDoDestino("atelie")).toBe("Uso do ateliê");
    expect(rotuloDoDestino("perda")).toBe("Perda ou quebra");
  });
});

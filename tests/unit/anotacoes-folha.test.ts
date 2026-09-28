import { describe, expect, it } from "vitest";

import { decidirGravacao, textoDaAutoria } from "@/lib/anotacoes/folha";

// `decidirGravacao` (D-08/GES-10, aresta `concurrency`) — a PRIMEIRA função de detecção de
// escrita velha deste projeto. Um `it` por caso de `<behavior>` do plano.
describe("decidirGravacao", () => {
  it("vistoEm nulo devolve gravar — quem nunca viu marca nenhuma não pode estar sobrescrevendo nada que conheça", () => {
    expect(
      decidirGravacao({ vistoEm: null, atualizadoEmNoServidor: "2026-12-18T14:20:00.000Z" }),
    ).toBe("gravar");
  });

  it("as duas marcas iguais devolvem gravar", () => {
    expect(
      decidirGravacao({
        vistoEm: "2026-12-18T14:20:00.000Z",
        atualizadoEmNoServidor: "2026-12-18T14:20:00.000Z",
      }),
    ).toBe("gravar");
  });

  it("as duas marcas diferentes devolvem avisar", () => {
    expect(
      decidirGravacao({
        vistoEm: "2026-12-18T14:20:00.000Z",
        atualizadoEmNoServidor: "2026-12-18T14:21:00.000Z",
      }),
    ).toBe("avisar");
  });

  it("compara INSTANTES, não strings formatadas — com/sem milissegundos e Z/+00:00 contam como iguais", () => {
    expect(
      decidirGravacao({
        vistoEm: "2026-12-18T14:20:00Z",
        atualizadoEmNoServidor: "2026-12-18T14:20:00.000+00:00",
      }),
    ).toBe("gravar");
  });
});

describe("textoDaAutoria", () => {
  it('devolve "‹nome› salvou às ‹HH›h‹MM›" com a hora em Brasília', () => {
    // 2026-12-18T17:20:00.000Z = 14h20 em America/Sao_Paulo (UTC-3, sem horário de verão).
    expect(
      textoDaAutoria({ nome: "Andressa", atualizadoEm: "2026-12-18T17:20:00.000Z" }),
    ).toBe("Andressa salvou às 14h20");
  });

  it("nome nulo devolve null — a linha de autoria não aparece", () => {
    expect(textoDaAutoria({ nome: null, atualizadoEm: "2026-12-18T17:20:00.000Z" })).toBeNull();
  });
});

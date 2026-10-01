import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { horasDaOrdem, horasDaPeca } from "@/lib/producao/horas";

// As horas de trabalho estimadas da ordem contam as peças a mais (decisão do dono, 01/10/2026, a
// partir do item 3 da verificação do Cowork de 30/09).

describe("horasDaPeca", () => {
  it("horas da ficha × pedido, sem a mais", () => {
    expect(horasDaPeca({ quantidade: 3, aMais: 0, horasMilesimos: 600 })).toBe(1800);
  });

  it("as a mais contam: o caso do Cowork, 12 canecas de 0,75 h + 1 a mais = 9,75 h", () => {
    expect(horasDaPeca({ quantidade: 12, aMais: 0, horasMilesimos: 750 })).toBe(9000);
    expect(horasDaPeca({ quantidade: 12, aMais: 1, horasMilesimos: 750 })).toBe(9750);
  });

  it("peça sem ficha: null, com ou sem a mais", () => {
    expect(horasDaPeca({ quantidade: 4, aMais: 2, horasMilesimos: null })).toBeNull();
  });
});

describe("horasDaOrdem", () => {
  it("soma as peças com ficha, cada uma com as suas a mais", () => {
    expect(
      horasDaOrdem([
        { quantidade: 3, aMais: 0, horasMilesimos: 600 },
        { quantidade: 2, aMais: 1, horasMilesimos: 1250 },
      ]),
    ).toBe(1800 + 3750);
  });

  it("peça sem ficha fica fora da soma", () => {
    expect(
      horasDaOrdem([
        { quantidade: 2, aMais: 5, horasMilesimos: 600 },
        { quantidade: 10, aMais: 0, horasMilesimos: null },
      ]),
    ).toBe(4200);
  });

  it("nenhuma peça com ficha (ou nenhuma peça): null — a tela diz “sem estimativa”", () => {
    expect(horasDaOrdem([{ quantidade: 2, aMais: 1, horasMilesimos: null }])).toBeNull();
    expect(horasDaOrdem([])).toBeNull();
  });

  it("ficha com zero horas é estimativa de zero, não “sem estimativa”", () => {
    expect(horasDaOrdem([{ quantidade: 2, aMais: 0, horasMilesimos: 0 }])).toBe(0);
  });
});

describe("pureza", () => {
  it("lib/producao/horas.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/producao/horas.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

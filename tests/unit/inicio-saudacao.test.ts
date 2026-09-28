import { describe, expect, it } from "vitest";

import { dataLongaEmPortugues, saudacaoDe } from "../../lib/inicio/saudacao";
import { ocupacaoDoEspaco } from "../../lib/agenda/espaco";

describe("saudacaoDe", () => {
  it("nome normal passa direto", () => {
    expect(saudacaoDe({ nome: "Theo", email: "theo@amassacerrado.com.br" })).toBe("Theo");
  });

  it("nome com espaço nas pontas é normalizado (trim)", () => {
    expect(saudacaoDe({ nome: "  Theo  ", email: "theo@amassacerrado.com.br" })).toBe("Theo");
  });

  it("nome com espaço duplo interno colapsa para um espaço", () => {
    expect(saudacaoDe({ nome: "Theo   Restivo", email: "theo@amassacerrado.com.br" })).toBe(
      "Theo Restivo",
    );
  });

  it("nome só de espaços cai no trecho do e-mail antes do arroba — a saudação nunca fica sem sujeito", () => {
    expect(saudacaoDe({ nome: "   ", email: "andressa@amassacerrado.com.br" })).toBe("andressa");
  });

  it("nome ausente (string vazia) também cai no e-mail", () => {
    expect(saudacaoDe({ nome: "", email: "andressa@amassacerrado.com.br" })).toBe("andressa");
  });
});

describe("dataLongaEmPortugues", () => {
  it('"2026-12-18" (sexta) vira "Sexta, 18 de dezembro"', () => {
    expect(dataLongaEmPortugues("2026-12-18")).toBe("Sexta, 18 de dezembro");
  });

  it("um domingo sai sem sufixo -feira, só capitalizado", () => {
    expect(dataLongaEmPortugues("2026-12-20")).toBe("Domingo, 20 de dezembro");
  });

  it("dia 1 do mês sai sem zero à esquerda", () => {
    expect(dataLongaEmPortugues("2027-01-01")).toBe("Sexta, 1 de janeiro");
  });

  it("o mesmo ISO devolve o mesmo texto com TZ em UTC e em America/Sao_Paulo (GES-11, aresta encoding)", () => {
    const tzOriginal = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const comUtc = dataLongaEmPortugues("2026-12-18");
      process.env.TZ = "America/Sao_Paulo";
      const comBrasilia = dataLongaEmPortugues("2026-12-18");
      expect(comUtc).toBe(comBrasilia);
      expect(comUtc).toBe("Sexta, 18 de dezembro");
    } finally {
      process.env.TZ = tzOriginal;
    }
  });
});

// A capacidade do espaço saiu em 29/09/2026, por decisão do dono no portão da Fase 04.6 (item 13
// da verificação humana): o espaço não tem número fixo de lugares, e o 10 que estava aqui vinha do
// protótipo, não de medição. A linha permanente virou CONTAGEM, sem denominador. O limite por
// turma é outra coisa e continua valendo (Fase 5, AGD-02/03/04).
describe("ocupacaoDoEspaco", () => {
  it("0 ocupados devolve '0 pessoas' — a linha permanente em dia vazio (D-07)", () => {
    expect(ocupacaoDoEspaco(0)).toBe("0 pessoas");
  });

  it("3 ocupados devolve '3 pessoas'", () => {
    expect(ocupacaoDoEspaco(3)).toBe("3 pessoas");
  });

  it("1 ocupado devolve '1 pessoa', no singular", () => {
    expect(ocupacaoDoEspaco(1)).toBe("1 pessoa");
  });

  // Portão contra a volta do denominador: nenhuma saída pode falar de "lugares" nem trazer uma
  // fração, que é o que a decisão do dono retirou.
  it("nenhuma saída menciona lugares nem uma fração", () => {
    for (const n of [0, 1, 2, 10, 37]) {
      expect(ocupacaoDoEspaco(n)).not.toMatch(/lugar/i);
      expect(ocupacaoDoEspaco(n)).not.toMatch(/\bde\s+\d/);
    }
  });
});

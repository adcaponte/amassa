import { describe, expect, it } from "vitest";

import { textoDePeso } from "@/lib/producao/peso";

// O peso de argila e esmalte na Produção (regra do dono, Parte 0 da verificação humana,
// 30/09/2026): abaixo de 1 000 g, gramas inteiras; a partir de 1 000 g, quilos com até duas casas,
// vírgula pt-BR. As entradas são miligramas (a unidade da ficha).
describe("textoDePeso", () => {
  it("abaixo de 1 000 g: gramas inteiras", () => {
    expect(textoDePeso(0)).toBe("0 g");
    expect(textoDePeso(850_000)).toBe("850 g");
    expect(textoDePeso(999_000)).toBe("999 g");
  });

  it("a fronteira: 1 000 g já é quilo, sem casa quando inteiro", () => {
    expect(textoDePeso(1_000_000)).toBe("1 kg");
  });

  it("a partir de 1 000 g: até duas casas, meio para cima, sem zeros à direita", () => {
    expect(textoDePeso(1_005_000)).toBe("1,01 kg");
    expect(textoDePeso(1_250_000)).toBe("1,25 kg");
    expect(textoDePeso(1_200_000)).toBe("1,2 kg");
    expect(textoDePeso(12_345_000)).toBe("12,35 kg");
    expect(textoDePeso(4_200_000)).toBe("4,2 kg");
  });

  it("arredonda primeiro para a grama inteira: 999,6 g vira 1 kg, 999,4 g fica 999 g", () => {
    expect(textoDePeso(999_600)).toBe("1 kg");
    expect(textoDePeso(999_400)).toBe("999 g");
    expect(textoDePeso(350_400)).toBe("350 g");
    expect(textoDePeso(350_500)).toBe("351 g");
  });

  it("milhar com ponto pt-BR", () => {
    expect(textoDePeso(12_345_000_000)).toBe("12.345 kg");
  });

  it("negativo conta como zero", () => {
    expect(textoDePeso(-5_000)).toBe("0 g");
  });
});

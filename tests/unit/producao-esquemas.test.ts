import { describe, expect, it } from "vitest";

import { esquemaDefinirAMais } from "@/lib/producao/esquemas";
import { FRASE_A_MAIS_INVALIDO, FRASE_ORDEM_NAO_EXISTE } from "@/lib/producao/textos";

// "Fazer a mais, de segurança" (Fase 06.1, plano 04, PRD-08): o texto do campo vira inteiro de 0 a
// 100.000 AQUI, no servidor — o mesmo intervalo do check `ordem_pecas_a_mais_faixa`. Vazio é zero
// (apagar o campo tira as a mais); qualquer outra coisa é recusada com a frase da UI-SPEC.

const ORDEM = "0b7e8a4c-1f2d-4c3b-9a8e-7d6c5b4a3f21";
const PECA = "5e4d3c2b-1a09-4f8e-8d7c-6b5a49382716";

function definir(aMaisTexto: unknown) {
  return esquemaDefinirAMais.safeParse({ ordemId: ORDEM, pecaId: PECA, aMaisTexto });
}

describe("esquemaDefinirAMais", () => {
  it.each([
    ["0", 0],
    ["5", 5],
    ["100000", 100000],
    ["", 0],
    ["   ", 0],
    [" 12 ", 12],
    ["007", 7],
  ])("aceita %j como %i", (texto, esperado) => {
    const resultado = definir(texto);
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({
      ordemId: ORDEM,
      pecaId: PECA,
      aMais: esperado,
    });
  });

  it.each(["100001", "-1", "2,5", "2.5", "abc", "1e3", "5 peças", "+5"])(
    "recusa %j com a frase da UI-SPEC",
    (texto) => {
      const resultado = definir(texto);
      expect(resultado.success).toBe(false);
      expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_A_MAIS_INVALIDO);
    },
  );

  it("recusa um número que não é texto (o campo sempre manda texto)", () => {
    const resultado = definir(5);
    expect(resultado.success).toBe(false);
    expect(!resultado.success && resultado.error.issues[0]?.message).toBe(FRASE_A_MAIS_INVALIDO);
  });

  it("a frase é a da UI-SPEC", () => {
    expect(FRASE_A_MAIS_INVALIDO).toBe("Diga um número inteiro, zero ou mais.");
  });

  it("recusa id de ordem ou de peça que não é uuid", () => {
    const semOrdem = esquemaDefinirAMais.safeParse({ ordemId: "x", pecaId: PECA, aMaisTexto: "1" });
    expect(semOrdem.success).toBe(false);
    expect(!semOrdem.success && semOrdem.error.issues[0]?.message).toBe(FRASE_ORDEM_NAO_EXISTE);
    const semPeca = esquemaDefinirAMais.safeParse({ ordemId: ORDEM, pecaId: "y", aMaisTexto: "1" });
    expect(semPeca.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { esquemaRegistrarMovimentacao, textoParaMilesimos } from "@/lib/estoque/esquemas";
import {
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_QUANTIDADE_ZERO,
} from "@/lib/estoque/textos";

// Id fictício de item (uuid v4 válido) — nenhum dado real.
const ITEM_ID = "3f2c6a1e-8b4d-4c2a-9e1f-0a1b2c3d4e5f";

function saida(quantidadeTexto: string, destino: unknown = "atelie") {
  return esquemaRegistrarMovimentacao.safeParse({
    tipo: "saida",
    itemId: ITEM_ID,
    quantidadeTexto,
    destino,
  });
}

function primeiraMensagem(resultado: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaRegistrarMovimentacao — a quantidade", () => {
  it("aceita “2,5” como 2500 milésimos", () => {
    const resultado = saida("2,5");
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.quantidadeTexto).toBe(2500);
    }
  });

  it("aceita “0,001” como 1 milésimo — a menor quantidade que existe", () => {
    const resultado = saida("0,001");
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.quantidadeTexto).toBe(1);
    }
  });

  it("recusa “0” com a frase da quantidade zero", () => {
    const resultado = saida("0");
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_QUANTIDADE_ZERO);
  });

  it("recusa “-1” — o sinal vem do tipo, nunca do texto", () => {
    expect(saida("-1").success).toBe(false);
  });

  it("recusa “1,2345” — mais de 3 casas decimais não cabem em milésimos", () => {
    expect(saida("1,2345").success).toBe(false);
  });

  it("recusa texto vazio", () => {
    expect(saida("").success).toBe(false);
    expect(saida("   ").success).toBe(false);
  });

  it("textoParaMilesimos converte o texto uma vez só, em inteiro", () => {
    expect(textoParaMilesimos("5")).toEqual({ ok: true, milesimos: 5000 });
    expect(textoParaMilesimos("2,250")).toEqual({ ok: true, milesimos: 2250 });
    expect(textoParaMilesimos("0.5")).toEqual({ ok: true, milesimos: 500 });
  });
});

describe("esquemaRegistrarMovimentacao — entrada e saída", () => {
  it("entrada sem custo é recusada com “Diga quanto custou ao todo — é daí que sai o custo médio.”", () => {
    const semCampo = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
    });
    expect(semCampo.success).toBe(false);
    expect(primeiraMensagem(semCampo)).toBe(FRASE_CUSTO_OBRIGATORIO);

    const vazio = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
      custoTexto: "",
    });
    expect(vazio.success).toBe(false);
    expect(primeiraMensagem(vazio)).toBe(
      "Diga quanto custou ao todo — é daí que sai o custo médio.",
    );
  });

  it("entrada com custo vira centavos inteiros", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "entrada",
      itemId: ITEM_ID,
      quantidadeTexto: "5",
      custoTexto: "21,00",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "entrada") {
      expect(resultado.data.quantidadeTexto).toBe(5000);
      expect(resultado.data.custoTexto).toBe(2100);
    }
  });

  it("saída sem destino é recusada com “Escolha para onde o material foi.”", () => {
    const resultado = esquemaRegistrarMovimentacao.safeParse({
      tipo: "saida",
      itemId: ITEM_ID,
      quantidadeTexto: "2",
    });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
    expect(FRASE_DESTINO_OBRIGATORIO).toBe("Escolha para onde o material foi.");
  });

  it("destino fora dos cinco é recusado — inclusive “venda”", () => {
    for (const destino of ["venda", "doacao", "", 3]) {
      const resultado = saida("2", destino);
      expect(resultado.success, `destino ${String(destino)}`).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_DESTINO_OBRIGATORIO);
    }
  });

  it("saída válida devolve o destino e os milésimos", () => {
    const resultado = saida("2", "encomenda");
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.tipo === "saida") {
      expect(resultado.data.destino).toBe("encomenda");
      expect(resultado.data.quantidadeTexto).toBe(2000);
    }
  });
});

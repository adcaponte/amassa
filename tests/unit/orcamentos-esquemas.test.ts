import { describe, expect, it } from "vitest";

import {
  esquemaCabecalhoDoOrcamento,
  esquemaNovoOrcamento,
} from "@/lib/orcamentos/esquemas";
import {
  FRASE_CLIENTE_MUITO_LONGO,
  FRASE_NOVO_ORCAMENTO_SEM_CAMPO,
  FRASE_TITULO_MUITO_LONGO,
} from "@/lib/orcamentos/textos";

// 06.5-14 (D-15): "Novo orçamento" só cria o registro com o primeiro campo preenchido. O esquema
// do primeiro campo usa as MESMAS regras do cabeçalho (NFC, vazio = nulo, 160 pontos de código).
// Nomes inventados — o repositório é público.

function primeiraMensagem(resultado: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaNovoOrcamento", () => {
  it("só o cliente: grava o cliente normalizado e o título nulo", () => {
    const resultado = esquemaNovoOrcamento.safeParse({
      clienteTexto: "  Clarice Inventada  ",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ clienteNome: "Clarice Inventada", titulo: null });
  });

  it("só o título: grava o título e o cliente nulo (o campo de cliente vazio vira nulo)", () => {
    const resultado = esquemaNovoOrcamento.safeParse({
      clienteTexto: "   ",
      tituloTexto: "Jogo de jantar",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ clienteNome: null, titulo: "Jogo de jantar" });
  });

  it("normaliza em NFC (o “é” decomposto vira o composto)", () => {
    const decomposto = "Jose\u0301";
    const resultado = esquemaNovoOrcamento.safeParse({ clienteTexto: decomposto });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.clienteNome).toBe("José");
  });

  it("os dois vazios (ou ausentes) são recusados — nunca um rascunho sem nada", () => {
    for (const entrada of [
      {},
      { clienteTexto: "", tituloTexto: "" },
      { clienteTexto: "  ", tituloTexto: "\n" },
    ]) {
      const resultado = esquemaNovoOrcamento.safeParse(entrada);
      expect(resultado.success).toBe(false);
      expect(primeiraMensagem(resultado)).toBe(FRASE_NOVO_ORCAMENTO_SEM_CAMPO);
    }
  });

  it("cliente longo demais: a mesma frase do cabeçalho; 160 pontos de código ainda passam", () => {
    expect(
      esquemaNovoOrcamento.safeParse({ clienteTexto: "a".repeat(160) }).success,
    ).toBe(true);
    const resultado = esquemaNovoOrcamento.safeParse({ clienteTexto: "a".repeat(161) });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_CLIENTE_MUITO_LONGO);
  });

  it("conta em pontos de código: 160 emojis (320 unidades UTF-16) ainda passam", () => {
    expect(
      esquemaNovoOrcamento.safeParse({ tituloTexto: "🏺".repeat(160) }).success,
    ).toBe(true);
  });

  it("título longo demais: a mesma frase do cabeçalho", () => {
    const resultado = esquemaNovoOrcamento.safeParse({ tituloTexto: "b".repeat(161) });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe(FRASE_TITULO_MUITO_LONGO);
  });

  it("o cabeçalho continua com as mesmas regras depois da extração da função comum", () => {
    const base = {
      id: "6f1c2a4e-3b5d-4e7f-9a1b-2c3d4e5f6a7b",
      entregaTexto: "2026-11-10",
      validadeTexto: "10",
    };
    const ok = esquemaCabecalhoDoOrcamento.safeParse({
      ...base,
      clienteTexto: " ",
      tituloTexto: "Vaso",
    });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ clienteNome: null, titulo: "Vaso" });

    const longo = esquemaCabecalhoDoOrcamento.safeParse({
      ...base,
      clienteTexto: "c".repeat(161),
      tituloTexto: "",
    });
    expect(longo.success).toBe(false);
    expect(primeiraMensagem(longo)).toBe(FRASE_CLIENTE_MUITO_LONGO);
  });
});

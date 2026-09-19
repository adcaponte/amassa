import { describe, expect, it } from "vitest";

import {
  CHAVE_RASCUNHO_DESPESA,
  CHAVE_RASCUNHO_VENDA,
  lerRascunho,
  serializarRascunho,
  type RascunhoDeVenda,
} from "@/lib/financeiro/rascunho";

describe("chaves do rascunho", () => {
  it("Venda e Despesa usam chaves diferentes", () => {
    expect(CHAVE_RASCUNHO_VENDA).not.toBe(CHAVE_RASCUNHO_DESPESA);
  });
});

describe("serializarRascunho / lerRascunho", () => {
  it("fazem ida e volta do mesmo objeto", () => {
    const rascunho: RascunhoDeVenda = {
      data: "2026-12-18",
      pessoa: "Pousada do Rio",
      linhas: [
        { tipo: "item", itemId: "item-1", quantidade: 2, valorUnitarioTexto: "8,00" },
        { tipo: "livre", descricao: "Aporte dos sócios", categoriaId: "cat-1", valorTexto: "500" },
      ],
      desconto: { modo: "percentual", texto: "10" },
    };

    const texto = serializarRascunho(rascunho);
    const lido = lerRascunho(texto, ["item-1"]);

    expect(lido).toEqual(rascunho);
  });

  it("rascunho sem desconto faz ida e volta com desconto nulo", () => {
    const rascunho: RascunhoDeVenda = {
      data: "2026-12-18",
      pessoa: "",
      linhas: [],
      desconto: null,
    };
    const lido = lerRascunho(serializarRascunho(rascunho), []);
    expect(lido).toEqual(rascunho);
  });

  it("texto que não é JSON → rascunho vazio, nunca exceção", () => {
    expect(() => lerRascunho("isto não é json{{{", [])).not.toThrow();
    expect(lerRascunho("isto não é json{{{", [])).toEqual({
      data: "",
      pessoa: "",
      linhas: [],
      desconto: null,
    });
  });

  it("JSON de outra versão → rascunho vazio", () => {
    const texto = JSON.stringify({ versao: 999, data: "2026-01-01", pessoa: "", linhas: [], desconto: null });
    expect(lerRascunho(texto, [])).toEqual({ data: "", pessoa: "", linhas: [], desconto: null });
  });

  it("JSON de formato errado (não é objeto) → rascunho vazio", () => {
    expect(lerRascunho(JSON.stringify([1, 2, 3]), [])).toEqual({
      data: "",
      pessoa: "",
      linhas: [],
      desconto: null,
    });
    expect(lerRascunho(JSON.stringify("um texto qualquer"), [])).toEqual({
      data: "",
      pessoa: "",
      linhas: [],
      desconto: null,
    });
  });

  it("linha cujo item não existe mais no catálogo recebido → descartada na leitura", () => {
    const rascunho: RascunhoDeVenda = {
      data: "2026-12-18",
      pessoa: "",
      linhas: [
        { tipo: "item", itemId: "item-removido", quantidade: 1, valorUnitarioTexto: "10" },
        { tipo: "item", itemId: "item-1", quantidade: 1, valorUnitarioTexto: "10" },
        { tipo: "livre", descricao: "Valor livre", categoriaId: "cat-1", valorTexto: "50" },
      ],
      desconto: null,
    };
    const texto = serializarRascunho(rascunho);
    // Só "item-1" continua existindo no catálogo carregado agora — "item-removido" some, a linha
    // livre (sem itemId) nunca é filtrada por esta regra.
    const lido = lerRascunho(texto, ["item-1"]);
    expect(lido.linhas).toEqual([
      { tipo: "item", itemId: "item-1", quantidade: 1, valorUnitarioTexto: "10" },
      { tipo: "livre", descricao: "Valor livre", categoriaId: "cat-1", valorTexto: "50" },
    ]);
  });

  it("linha corrompida (falta campo obrigatório) é descartada, sem quebrar as demais", () => {
    const texto = JSON.stringify({
      versao: 1,
      data: "2026-01-01",
      pessoa: "",
      linhas: [
        { tipo: "item", itemId: "item-1" }, // sem quantidade nem valorUnitarioTexto
        { tipo: "livre", descricao: "Ok", categoriaId: "cat-1", valorTexto: "10" },
      ],
      desconto: null,
    });
    const lido = lerRascunho(texto, ["item-1"]);
    expect(lido.linhas).toEqual([
      { tipo: "livre", descricao: "Ok", categoriaId: "cat-1", valorTexto: "10" },
    ]);
  });
});

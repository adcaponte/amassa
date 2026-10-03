import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  COMPRAS_A_MOSTRAR,
  montarComprasDele,
  type DocumentoDaCompra,
  type LinhaDaCompra,
} from "@/lib/fornecedores/compras";

// "Compras dele" (06.2-11-PLAN.md; FRN-13, D-03, UI-D12, UI-D13): todas as despesas não canceladas do
// fornecedor, mais recentes primeiro; o total e o N contam só o ano de `hoje` (dia civil de Brasília,
// por parâmetro). O valor de cada linha é `totalDasLinhas` do documento — o número que o Financeiro já
// mostra, nenhum número novo.

let contador = 0;
function documento(dados: Partial<DocumentoDaCompra> & Pick<DocumentoDaCompra, "data">): DocumentoDaCompra {
  contador += 1;
  const sequencia = String(contador).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${sequencia}`,
    titulo: null,
    criadoEm: `${dados.data}T15:00:00.000Z`,
    ...dados,
  };
}

function linhaLivre(documentoId: string, nome: string, valorCentavos: number): LinhaDaCompra {
  return {
    documentoId,
    nome,
    quantidade: 1,
    quantidadeEstoque: null,
    unidade: null,
    itemId: null,
    valorCentavos,
  };
}

function linhaDeItem(
  documentoId: string,
  nome: string,
  valorCentavos: number,
  quantidadeEstoque = "10",
  unidade = "kg",
): LinhaDaCompra {
  return {
    documentoId,
    nome,
    quantidade: 1,
    quantidadeEstoque,
    unidade,
    itemId: "11111111-1111-4111-8111-111111111111",
    valorCentavos,
  };
}

describe("pureza", () => {
  it("lib/fornecedores/compras.ts não importa React, Next, o banco nem o driver, e não lê o relógio", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/compras.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+"(@\/db|react|next|drizzle-orm|pg)[/"]/);
    expect(fonte).not.toContain("toISOString");
    expect(fonte).not.toContain("new Date(");
  });

  it("mostra as 10 mais recentes (UI-D12)", () => {
    expect(COMPRAS_A_MOSTRAR).toBe(10);
  });
});

describe("montarComprasDele", () => {
  it("lista as duas (março primeiro) e soma só 2026 quando hoje é 02/10/2026", () => {
    const marco = documento({ data: "2026-03-01" });
    const dezembro = documento({ data: "2025-12-31" });
    const resultado = montarComprasDele({
      documentos: [dezembro, marco],
      linhas: [linhaLivre(marco.id, "Frete", 10000), linhaLivre(dezembro.id, "Frete", 5000)],
      hoje: "2026-10-02",
    });
    expect(resultado.compras.map((compra) => compra.id)).toEqual([marco.id, dezembro.id]);
    expect(resultado.compras.map((compra) => compra.valorCentavos)).toEqual([10000, 5000]);
    expect(resultado.totalDoAno).toEqual({ ano: "2026", centavos: 10000, quantidade: 1 });
  });

  it("com linha de item é compra de material, com os itens por nomeDaLinha; sem item é outra despesa", () => {
    const compra = documento({ data: "2026-09-10" });
    const outra = documento({ data: "2026-09-09", titulo: "Conserto do forno" });
    const resultado = montarComprasDele({
      documentos: [compra, outra],
      linhas: [
        linhaDeItem(compra.id, "Argila branca", 8500),
        linhaDeItem(compra.id, "Esmalte azul", 1500, "2", "l"),
        linhaLivre(outra.id, "Conserto do forno", 30000),
      ],
      hoje: "2026-10-02",
    });
    const [primeira, segunda] = resultado.compras;
    expect(primeira).toEqual({
      id: compra.id,
      data: "2026-09-10",
      titulo: "Argila branca × 10 kg + Esmalte azul × 2 L",
      tipo: "compra",
      itens: ["Argila branca × 10 kg", "Esmalte azul × 2 L"],
      valorCentavos: 10000,
    });
    expect(segunda).toEqual({
      id: outra.id,
      data: "2026-09-09",
      titulo: "Conserto do forno",
      tipo: "outra",
      itens: [],
      valorCentavos: 30000,
    });
    expect(resultado.totalDoAno).toEqual({ ano: "2026", centavos: 40000, quantidade: 2 });
  });

  it("os itens são só as linhas de item: a linha de diferença (sem item) entra no valor, não nos itens", () => {
    const compra = documento({ data: "2026-09-10" });
    const resultado = montarComprasDele({
      documentos: [compra],
      linhas: [linhaDeItem(compra.id, "Argila branca", 8500), linhaLivre(compra.id, "Diferença", -500)],
      hoje: "2026-10-02",
    });
    expect(resultado.compras[0].itens).toEqual(["Argila branca × 10 kg"]);
    expect(resultado.compras[0].valorCentavos).toBe(8000);
  });
});

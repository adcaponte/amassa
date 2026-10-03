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

// ——— As arestas FRN-13 (06.2-11-PLAN.md, Tarefa 2; 06.2-EDGE-COVERAGE.json). ———

describe("boundary", () => {
  it("em 31/12/2026 conta 01/01/2026 e 31/12/2026, e nada de 31/12/2025", () => {
    const anterior = documento({ data: "2025-12-31" });
    const primeiro = documento({ data: "2026-01-01" });
    const ultimo = documento({ data: "2026-12-31" });
    const { compras, totalDoAno } = montarComprasDele({
      documentos: [anterior, primeiro, ultimo],
      linhas: [
        linhaLivre(anterior.id, "Frete", 700),
        linhaLivre(primeiro.id, "Frete", 300),
        linhaLivre(ultimo.id, "Frete", 200),
      ],
      hoje: "2026-12-31",
    });
    expect(compras).toHaveLength(3);
    expect(totalDoAno).toEqual({ ano: "2026", centavos: 500, quantidade: 2 });
  });

  it("em 01/01/2027 o ano é 2027: nada de 2026 entra, e a de 01/01/2027 sim", () => {
    const fimDoAno = documento({ data: "2026-12-31" });
    const virada = documento({ data: "2027-01-01" });
    const { totalDoAno } = montarComprasDele({
      documentos: [fimDoAno, virada],
      linhas: [linhaLivre(fimDoAno.id, "Frete", 900), linhaLivre(virada.id, "Frete", 100)],
      hoje: "2027-01-01",
    });
    expect(totalDoAno).toEqual({ ano: "2027", centavos: 100, quantidade: 1 });
  });

  it("uma despesa datada no ano seguinte ao de hoje fica na lista e fora do total", () => {
    const seguinte = documento({ data: "2027-01-01" });
    const { compras, totalDoAno } = montarComprasDele({
      documentos: [seguinte],
      linhas: [linhaLivre(seguinte.id, "Frete", 100)],
      hoje: "2026-12-31",
    });
    expect(compras).toHaveLength(1);
    expect(totalDoAno).toEqual({ ano: "2026", centavos: 0, quantidade: 0 });
  });
});

describe("adjacency", () => {
  it("o valor da linha é totalDasLinhas do documento, com a linha negativa da diferença", () => {
    const compra = documento({ data: "2026-05-05" });
    const { compras } = montarComprasDele({
      documentos: [compra],
      linhas: [
        linhaDeItem(compra.id, "Argila", 10000),
        linhaDeItem(compra.id, "Esmalte", 2550, "1", "l"),
        linhaLivre(compra.id, "Juros, multas e descontos", -1050),
      ],
      hoje: "2026-10-02",
    });
    expect(compras[0].valorCentavos).toBe(11500);
  });

  it("a soma do ano é exatamente a soma dos valores das linhas do ano", () => {
    const a = documento({ data: "2026-02-01" });
    const b = documento({ data: "2026-03-01" });
    const c = documento({ data: "2025-03-01" });
    const { compras, totalDoAno } = montarComprasDele({
      documentos: [a, b, c],
      linhas: [
        linhaLivre(a.id, "Frete", 1234),
        linhaLivre(a.id, "Diferença", -34),
        linhaLivre(b.id, "Frete", 5678),
        linhaLivre(c.id, "Frete", 9999),
      ],
      hoje: "2026-10-02",
    });
    const doAno = compras.filter((compra) => compra.data.startsWith("2026"));
    expect(totalDoAno.centavos).toBe(doAno.reduce((soma, compra) => soma + compra.valorCentavos, 0));
    expect(totalDoAno).toEqual({ ano: "2026", centavos: 6878, quantidade: 2 });
  });

  it("documento sem linha nenhuma vale 0 e não quebra", () => {
    const vazio = documento({ data: "2026-04-04" });
    const { compras, totalDoAno } = montarComprasDele({ documentos: [vazio], linhas: [], hoje: "2026-10-02" });
    expect(compras[0]).toMatchObject({ valorCentavos: 0, tipo: "outra", itens: [], titulo: "" });
    expect(totalDoAno).toEqual({ ano: "2026", centavos: 0, quantidade: 1 });
  });

  it("linha de um documento que não veio na lista não entra em nada", () => {
    const meu = documento({ data: "2026-04-04" });
    const { compras, totalDoAno } = montarComprasDele({
      documentos: [meu],
      linhas: [linhaLivre(meu.id, "Frete", 100), linhaLivre("99999999-9999-4999-8999-999999999999", "Alheia", 5000)],
      hoje: "2026-10-02",
    });
    expect(compras).toHaveLength(1);
    expect(totalDoAno.centavos).toBe(100);
  });
});

describe("empty", () => {
  it("sem documentos: lista vazia e quantidade 0, com o ano de hoje", () => {
    expect(montarComprasDele({ documentos: [], linhas: [], hoje: "2026-10-02" })).toEqual({
      compras: [],
      totalDoAno: { ano: "2026", centavos: 0, quantidade: 0 },
    });
  });

  it("só de anos anteriores: a lista com elas e quantidade 0", () => {
    const a = documento({ data: "2024-06-01" });
    const b = documento({ data: "2025-12-31" });
    const { compras, totalDoAno } = montarComprasDele({
      documentos: [a, b],
      linhas: [linhaLivre(a.id, "Frete", 100), linhaLivre(b.id, "Frete", 200)],
      hoje: "2026-10-02",
    });
    expect(compras.map((compra) => compra.id)).toEqual([b.id, a.id]);
    expect(totalDoAno).toEqual({ ano: "2026", centavos: 0, quantidade: 0 });
  });

  it("uma só: quantidade 1", () => {
    const unica = documento({ data: "2026-10-02" });
    const { totalDoAno } = montarComprasDele({
      documentos: [unica],
      linhas: [linhaLivre(unica.id, "Frete", 4200)],
      hoje: "2026-10-02",
    });
    expect(totalDoAno).toEqual({ ano: "2026", centavos: 4200, quantidade: 1 });
  });
});

describe("ordering", () => {
  const mesmoDia = "2026-08-08";
  const maisAntigo = documento({ data: mesmoDia, criadoEm: "2026-08-08T12:00:00.000Z" });
  const maisNovo = documento({ data: mesmoDia, criadoEm: "2026-08-08T18:30:00.000Z" });
  // Mesmo instante: o id decide (maior primeiro).
  const empateA = documento({
    id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
    data: mesmoDia,
    criadoEm: "2026-08-08T15:00:00.000Z",
  });
  const empateB = documento({
    id: "00000000-0000-4000-8000-bbbbbbbbbbbb",
    data: mesmoDia,
    criadoEm: "2026-08-08T15:00:00.000Z",
  });
  const diaDepois = documento({ data: "2026-08-09", criadoEm: "2026-08-01T10:00:00.000Z" });
  const esperado = [diaDepois.id, maisNovo.id, empateB.id, empateA.id, maisAntigo.id];

  it("data desc, depois criado_em desc, depois id desc", () => {
    const { compras } = montarComprasDele({
      documentos: [maisAntigo, empateA, diaDepois, maisNovo, empateB],
      linhas: [],
      hoje: "2026-10-02",
    });
    expect(compras.map((compra) => compra.id)).toEqual(esperado);
  });

  it("não depende da ordem de entrada e não muta a lista recebida", () => {
    const entrada = [empateB, maisNovo, maisAntigo, diaDepois, empateA];
    const copia = [...entrada];
    const invertida = [...entrada].reverse();
    const ids = (documentos: DocumentoDaCompra[]) =>
      montarComprasDele({ documentos, linhas: [], hoje: "2026-10-02" }).compras.map((compra) => compra.id);
    expect(ids(entrada)).toEqual(esperado);
    expect(ids(invertida)).toEqual(esperado);
    expect(entrada).toEqual(copia);
  });

  it("criado_em é comparado como instante, não como texto (ISO com fuso)", () => {
    // 2026-08-08T20:00:00-03:00 = 23:00Z (o mais novo), embora o texto "20" venha antes de "21".
    const comFuso = documento({ data: mesmoDia, criadoEm: "2026-08-08T20:00:00-03:00" });
    const emUtc = documento({ data: mesmoDia, criadoEm: "2026-08-08T21:00:00.000Z" });
    const { compras } = montarComprasDele({ documentos: [emUtc, comFuso], linhas: [], hoje: "2026-10-02" });
    expect(compras.map((compra) => compra.id)).toEqual([comFuso.id, emUtc.id]);
  });

  it("as linhas de cada documento ficam na ordem recebida (a do Financeiro)", () => {
    const compra = documento({ data: "2026-09-01" });
    const { compras } = montarComprasDele({
      documentos: [compra],
      linhas: [linhaDeItem(compra.id, "Zinco", 100), linhaDeItem(compra.id, "Argila", 100)],
      hoje: "2026-10-02",
    });
    expect(compras[0].itens).toEqual(["Zinco × 10 kg", "Argila × 10 kg"]);
  });
});

describe("precision", () => {
  it("3 × R$ 0,10 somam 30 centavos exatos, inteiros", () => {
    const documentos = [
      documento({ data: "2026-01-10" }),
      documento({ data: "2026-01-11" }),
      documento({ data: "2026-01-12" }),
    ];
    const { totalDoAno } = montarComprasDele({
      documentos,
      linhas: documentos.map((doc) => linhaLivre(doc.id, "Troco", 10)),
      hoje: "2026-10-02",
    });
    expect(totalDoAno.centavos).toBe(30);
    expect(Number.isInteger(totalDoAno.centavos)).toBe(true);
  });

  it("valores grandes somam sem perder centavo (100 × R$ 9.999.999,99)", () => {
    const documentos = Array.from({ length: 100 }, (_, indice) =>
      documento({ data: `2026-02-${String((indice % 28) + 1).padStart(2, "0")}` }),
    );
    const { totalDoAno, compras } = montarComprasDele({
      documentos,
      linhas: documentos.map((doc) => linhaLivre(doc.id, "Forno", 999999999)),
      hoje: "2026-10-02",
    });
    expect(totalDoAno.centavos).toBe(99999999900);
    expect(Number.isSafeInteger(totalDoAno.centavos)).toBe(true);
    expect(compras.every((compra) => Number.isInteger(compra.valorCentavos))).toBe(true);
  });
});

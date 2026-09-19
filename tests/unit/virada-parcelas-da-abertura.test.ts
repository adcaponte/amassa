import { describe, expect, it } from "vitest";

import {
  parcelasInteirasDoItem,
  planejarImportacao,
  type DocumentoPlanejado,
  type ItemDaAberturaParaVirada,
} from "../../lib/virada/parcelas-da-abertura";

// 04.4-04-PLAN.md, Tarefa 1: a regra da virada — quais parcelas em aberto viram despesa, em
// centavos inteiros, com o rótulo de origem preservado. Nomes e valores inventados (repositório
// público) — nenhum item real do ateliê aparece aqui.

describe("parcelasInteirasDoItem", () => {
  it("R$ 1.000,00 em 3x soma exatamente 100000, com a distribuição do prefixo arredondado", () => {
    const parcelas = parcelasInteirasDoItem({
      valorEmCentavos: 100000,
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2026-01-01",
    });

    expect(parcelas.map((parcela) => parcela.valorEmCentavos)).toEqual([33333, 33334, 33333]);
    expect(parcelas.reduce((soma, parcela) => soma + parcela.valorEmCentavos, 0)).toBe(100000);
  });

  it("R$ 100,00 em 3x soma exatamente 10000", () => {
    const parcelas = parcelasInteirasDoItem({
      valorEmCentavos: 10000,
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2026-01-01",
    });

    expect(parcelas.reduce((soma, parcela) => soma + parcela.valorEmCentavos, 0)).toBe(10000);
    expect(parcelas.every((parcela) => Number.isInteger(parcela.valorEmCentavos))).toBe(true);
  });

  it("R$ 100,00 em 36x (não divide exato) soma exatamente 10000, todas inteiras", () => {
    const parcelas = parcelasInteirasDoItem({
      valorEmCentavos: 10000,
      formaPagamento: "prazo",
      parcelas: 36,
      primeiraParcelaEm: "2026-01-01",
    });

    expect(parcelas).toHaveLength(36);
    expect(parcelas.every((parcela) => Number.isInteger(parcela.valorEmCentavos))).toBe(true);
    expect(parcelas.reduce((soma, parcela) => soma + parcela.valorEmCentavos, 0)).toBe(10000);
  });

  it("à vista devolve uma parcela só, com o valor inteiro do item", () => {
    const parcelas = parcelasInteirasDoItem({
      valorEmCentavos: 250000,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-03-05",
    });

    expect(parcelas).toEqual([
      { numero: 1, de: 1, vencimentoEm: "2026-03-05", valorEmCentavos: 250000 },
    ]);
  });
});

describe("planejarImportacao", () => {
  function item(sobrescritas: Partial<ItemDaAberturaParaVirada> = {}): ItemDaAberturaParaVirada {
    return {
      id: "11111111-1111-1111-1111-111111111111",
      nome: "Item de teste inventado",
      categoria: "moveis",
      valorEmCentavos: 100000,
      formaPagamento: "prazo",
      parcelas: 10,
      primeiraParcelaEm: "2026-01-01",
      resolvido: false,
      ...sobrescritas,
    };
  }

  const CATEGORIA_MATERIAL = "categoria-material-id";
  const CATEGORIA_DEMAIS = "categoria-demais-id";

  function planejar(itens: ItemDaAberturaParaVirada[], dataDaVirada = "2026-07-01") {
    return planejarImportacao({
      itens,
      dataDaVirada,
      categoriaMaterialId: CATEGORIA_MATERIAL,
      categoriaDemaisId: CATEGORIA_DEMAIS,
    });
  }

  it("item a prazo em 10x com primeira parcela seis meses antes da virada entra com as parcelas 7 a 10", () => {
    const itemDeTeste = item({
      valorEmCentavos: 1000000,
      parcelas: 10,
      primeiraParcelaEm: "2026-01-01",
    });
    const { documentos, ignorados } = planejar([itemDeTeste], "2026-07-01");

    expect(ignorados).toEqual([]);
    expect(documentos).toHaveLength(1);
    const [documento] = documentos;
    expect(documento.parcelas.map((parcela) => parcela.rotulo)).toEqual([
      "7 de 10",
      "8 de 10",
      "9 de 10",
      "10 de 10",
    ]);
    expect(documento.parcelas.map((parcela) => parcela.numero)).toEqual([1, 2, 3, 4]);
    // 1000000 / 10 = 100000 exato por parcela — as 6 primeiras somam 600000, as 4 últimas 400000.
    expect(documento.valorCentavos).toBe(1000000 - 600000);
  });

  it("parcela que vence exatamente no primeiro dia do mês da virada entra; a de um dia antes não", () => {
    const noLimite = item({
      id: "22222222-2222-2222-2222-222222222222",
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-09-01",
    });
    const antesDoLimite = item({
      id: "33333333-3333-3333-3333-333333333333",
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-08-31",
    });

    const { documentos, ignorados } = planejar([noLimite, antesDoLimite], "2026-09-01");

    expect(documentos).toHaveLength(1);
    expect(documentos[0].itemId).toBe(noLimite.id);
    expect(ignorados).toEqual([
      { itemId: antesDoLimite.id, nome: antesDoLimite.nome, motivo: "já quitado antes da virada" },
    ]);
  });

  it("item com todas as parcelas antes da virada é ignorado com o motivo certo", () => {
    const itemQuitado = item({
      formaPagamento: "prazo",
      parcelas: 3,
      primeiraParcelaEm: "2025-01-01",
    });

    const { documentos, ignorados } = planejar([itemQuitado], "2026-07-01");

    expect(documentos).toEqual([]);
    expect(ignorados).toEqual([
      { itemId: itemQuitado.id, nome: itemQuitado.nome, motivo: "já quitado antes da virada" },
    ]);
  });

  it("item à vista com data a partir da virada vira um documento de uma parcela, sem rótulo", () => {
    const itemAVista = item({
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-08-01",
      valorEmCentavos: 45000,
    });

    const { documentos } = planejar([itemAVista], "2026-07-01");

    expect(documentos).toHaveLength(1);
    const [documento] = documentos;
    expect(documento.parcelas).toHaveLength(1);
    expect(documento.parcelas[0].rotulo).toBeNull();
    expect(documento.valorCentavos).toBe(45000);
    expect(documento.data).toBe("2026-08-01");
  });

  it("categoria material recebe a categoria de material; as demais recebem a categoria dos demais", () => {
    const categoriasParaTestar: ItemDaAberturaParaVirada["categoria"][] = [
      "moveis",
      "equipamentos",
      "utensilios",
      "obra",
      "outros",
    ];

    for (const categoria of categoriasParaTestar) {
      const { documentos } = planejar([
        item({ categoria, formaPagamento: "vista", parcelas: 1, primeiraParcelaEm: "2026-08-01" }),
      ]);
      expect(documentos[0].categoriaFinanceiraId).toBe(CATEGORIA_DEMAIS);
    }

    const { documentos: documentosDeMaterial } = planejar([
      item({
        categoria: "material",
        formaPagamento: "vista",
        parcelas: 1,
        primeiraParcelaEm: "2026-08-01",
      }),
    ]);
    expect(documentosDeMaterial[0].categoriaFinanceiraId).toBe(CATEGORIA_MATERIAL);
  });

  it("o documento carrega nome, valor, data da compra, chave de importação e a marca de resolvido", () => {
    const itemDeTeste = item({
      nome: "Estante de secagem inventada",
      formaPagamento: "prazo",
      parcelas: 10,
      primeiraParcelaEm: "2026-01-01",
      valorEmCentavos: 1000000,
      resolvido: false,
    });

    const { documentos } = planejar([itemDeTeste], "2026-07-01");
    const [documento] = documentos;

    expect(documento.nome).toBe("Estante de secagem inventada");
    // A data do documento é a da COMPRA (primeira parcela original do item), não a da primeira
    // parcela em aberto — suposição 2 do plano (04.4-04-PLAN.md).
    expect(documento.data).toBe("2026-01-01");
    expect(documento.chaveDeImportacao).toBe(`abertura:${itemDeTeste.id}`);
    expect(documento.resolvido).toBe(false);
    expect(documento.parcelas.every((parcela) => parcela.forma === "pix")).toBe(true);
  });

  it("item não resolvido entra do mesmo jeito, e o plano carrega a marca para o ensaio mostrar", () => {
    const itemNaoResolvido = item({
      resolvido: false,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-08-01",
    });
    const itemResolvido = item({
      id: "44444444-4444-4444-4444-444444444444",
      resolvido: true,
      formaPagamento: "vista",
      parcelas: 1,
      primeiraParcelaEm: "2026-08-01",
    });

    const { documentos } = planejar([itemNaoResolvido, itemResolvido]);
    const porId = new Map(documentos.map((documento: DocumentoPlanejado) => [documento.itemId, documento]));

    expect(porId.get(itemNaoResolvido.id)?.resolvido).toBe(false);
    expect(porId.get(itemResolvido.id)?.resolvido).toBe(true);
  });

  it("entrada vazia não gera documento nem ignorado", () => {
    const { documentos, ignorados } = planejar([]);
    expect(documentos).toEqual([]);
    expect(ignorados).toEqual([]);
  });

  it("data da virada que não é o primeiro dia do mês é recusada", () => {
    expect(() => planejar([item()], "2026-07-15")).toThrow();
  });

  it("não muta a entrada", () => {
    const itemDeTeste = item({ formaPagamento: "prazo", parcelas: 10, primeiraParcelaEm: "2026-01-01" });
    const copia = structuredClone(itemDeTeste);

    planejar([itemDeTeste], "2026-07-01");

    expect(itemDeTeste).toEqual(copia);
  });
});

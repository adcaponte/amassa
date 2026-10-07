import { describe, expect, it } from "vitest";

import {
  motivoSemCorrecao,
  normalizarParaVersao,
  rascunhoDaCorrecao,
  taxasHerdadasDaCorrecao,
  versaoDoDocumento,
  type LeituraParaVersao,
  type OriginalParaRascunho,
  type ParcelaPagaDaOriginal,
} from "@/lib/financeiro/correcao";
import { saldoAntesDaJanela, type GrupoDePagas } from "@/lib/financeiro/extrato";
import { resumoDoMes, type DocumentoParaMes, type ParcelaPagaParaMes } from "@/lib/financeiro/mes";
import { liquidoDaParcela } from "@/lib/financeiro/taxa";
import { fraseCancelarCorrecao, textoAvisoCartaoHerdado, textoAvisoCartaoMisto } from "@/lib/financeiro/textos";

// 06.5-16-PLAN.md, Tarefa 1 — a versão do documento que a página manda à tela e que a transação relê
// sob a trava: a MESMA leitura e o MESMO normalizador nos dois lados. Representações diferentes do
// mesmo dado dão a mesma versão; uma mudança de verdade dá outra.

const LINHA_A = "11111111-1111-4111-8111-111111111111";
const LINHA_B = "22222222-2222-4222-8222-222222222222";
const PARCELA_A = "33333333-3333-4333-8333-333333333333";
const PARCELA_B = "44444444-4444-4444-8444-444444444444";

// A leitura como o Drizzle entrega (`date` em modo texto, `numeric` em texto de 3 casas, inteiros).
function leituraBase(): LeituraParaVersao {
  return {
    canceladoEm: null,
    linhas: [
      { id: LINHA_A, quantidade: 2, valorCentavos: 7000, quantidadeEstoque: null },
      { id: LINHA_B, quantidade: 1, valorCentavos: 3000, quantidadeEstoque: "2.000" },
    ],
    parcelas: [
      { id: PARCELA_A, valorCentavos: 5000, forma: "pix", vencimento: "2026-10-05", pagoEm: "2026-10-05" },
      { id: PARCELA_B, valorCentavos: 5000, forma: "cartao", vencimento: "2026-11-05", pagoEm: null },
    ],
  };
}

function versao(leitura: LeituraParaVersao): string {
  return versaoDoDocumento(normalizarParaVersao(leitura));
}

describe("versaoDoDocumento — resumo curto e determinístico", () => {
  it("é hexadecimal de 8 casas e igual em duas chamadas", () => {
    const v = versao(leituraBase());
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(versao(leituraBase())).toBe(v);
  });
});

describe("versaoDoDocumento — a MESMA versão quando só a representação muda", () => {
  const base = versao(leituraBase());

  it("cancelado_em: Date × texto ISO × texto do Postgres", () => {
    const instante = "2026-10-05T15:04:05.123Z";
    const comDate = versao({ ...leituraBase(), canceladoEm: new Date(instante) });
    expect(versao({ ...leituraBase(), canceladoEm: instante })).toBe(comDate);
    expect(versao({ ...leituraBase(), canceladoEm: "2026-10-05 15:04:05.123+00" })).toBe(comDate);
    expect(versao({ ...leituraBase(), canceladoEm: "2026-10-05 12:04:05.123-03" })).toBe(comDate);
  });

  it("vencimento e pago em: Date × “2026-10-05” (meia-noite UTC e meia-noite de Brasília)", () => {
    const leitura = leituraBase();
    const comDateUtc: LeituraParaVersao = {
      ...leitura,
      parcelas: [
        { ...leitura.parcelas[0], vencimento: new Date("2026-10-05"), pagoEm: new Date("2026-10-05T00:00:00Z") },
        leitura.parcelas[1],
      ],
    };
    const comDateBrasilia: LeituraParaVersao = {
      ...leitura,
      parcelas: [
        {
          ...leitura.parcelas[0],
          vencimento: new Date("2026-10-05T00:00:00-03:00"),
          pagoEm: new Date("2026-10-05T00:00:00-03:00"),
        },
        { ...leitura.parcelas[1], vencimento: new Date("2026-11-05T00:00:00-03:00") },
      ],
    };
    expect(versao(comDateUtc)).toBe(base);
    expect(versao(comDateBrasilia)).toBe(base);
  });

  it("valor: “70” × 70, e quantidade como texto", () => {
    const leitura = leituraBase();
    const comTexto: LeituraParaVersao = {
      ...leitura,
      linhas: [
        { ...leitura.linhas[0], quantidade: "2", valorCentavos: "7000" },
        { ...leitura.linhas[1], valorCentavos: "3000" },
      ],
      parcelas: [{ ...leitura.parcelas[0], valorCentavos: "5000" }, leitura.parcelas[1]],
    };
    expect(versao(comTexto)).toBe(base);

    const pequena = (valor: number | string): string =>
      versao({ ...leitura, linhas: [{ ...leitura.linhas[0], valorCentavos: valor }] });
    expect(pequena("70")).toBe(pequena(70));
  });

  it("quantidade de estoque: “2” × “2.000” × 2 × “2.0”", () => {
    const leitura = leituraBase();
    for (const quantidade of ["2", 2, "2.0", "02.000"] as const) {
      expect(versao({ ...leitura, linhas: [leitura.linhas[0], { ...leitura.linhas[1], quantidadeEstoque: quantidade }] })).toBe(
        base,
      );
    }
    const fracionada = (valor: number | string): string =>
      versao({ ...leitura, linhas: [{ ...leitura.linhas[1], quantidadeEstoque: valor }] });
    expect(fracionada("2.5")).toBe(fracionada("2.500"));
    expect(fracionada(2.5)).toBe(fracionada("2.500"));
  });

  it("linhas e parcelas em outra ordem", () => {
    const leitura = leituraBase();
    expect(
      versao({ ...leitura, linhas: [...leitura.linhas].reverse(), parcelas: [...leitura.parcelas].reverse() }),
    ).toBe(base);
  });
});

describe("versaoDoDocumento — versão DIFERENTE quando o documento mudou", () => {
  const base = versao(leituraBase());

  it("uma parcela foi paga", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, parcelas: [leitura.parcelas[0], { ...leitura.parcelas[1], pagoEm: "2026-10-06" }] })).not.toBe(
      base,
    );
  });

  it("um valor mudou (linha ou parcela)", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, linhas: [{ ...leitura.linhas[0], valorCentavos: 7001 }, leitura.linhas[1]] })).not.toBe(base);
    expect(versao({ ...leitura, parcelas: [{ ...leitura.parcelas[0], valorCentavos: 5001 }, leitura.parcelas[1]] })).not.toBe(
      base,
    );
  });

  it("a forma, o vencimento ou a quantidade de estoque mudaram", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, parcelas: [{ ...leitura.parcelas[0], forma: "dinheiro" }, leitura.parcelas[1]] })).not.toBe(base);
    expect(versao({ ...leitura, parcelas: [leitura.parcelas[0], { ...leitura.parcelas[1], vencimento: "2026-11-06" }] })).not.toBe(
      base,
    );
    expect(versao({ ...leitura, linhas: [leitura.linhas[0], { ...leitura.linhas[1], quantidadeEstoque: "2.001" }] })).not.toBe(base);
  });

  it("uma parcela a mais ou a menos", () => {
    const leitura = leituraBase();
    expect(versao({ ...leitura, parcelas: [leitura.parcelas[0]] })).not.toBe(base);
  });

  it("o documento foi cancelado", () => {
    expect(versao({ ...leituraBase(), canceladoEm: new Date("2026-10-05T15:04:05Z") })).not.toBe(base);
  });
});

describe("normalizarParaVersao — recusa o que não é dado do banco", () => {
  it("inteiro que não é inteiro, data e instante inválidos", () => {
    const leitura = leituraBase();
    expect(() => normalizarParaVersao({ ...leitura, linhas: [{ ...leitura.linhas[0], valorCentavos: "70,00" }] })).toThrow();
    expect(() => normalizarParaVersao({ ...leitura, parcelas: [{ ...leitura.parcelas[0], vencimento: "05/10/2026" }] })).toThrow();
    expect(() => normalizarParaVersao({ ...leitura, canceladoEm: "ontem" })).toThrow();
  });
});

describe("motivoSemCorrecao — UI-D10 e as contas fixas", () => {
  const nenhuma = { temAgenda: false, temQueima: false, temOrcamento: false, temContaFixa: false };

  it("sem origem → null (corrige)", () => {
    expect(motivoSemCorrecao(nenhuma)).toBeNull();
  });

  it("cada origem dá o seu motivo", () => {
    expect(motivoSemCorrecao({ ...nenhuma, temAgenda: true })).toBe("agenda");
    expect(motivoSemCorrecao({ ...nenhuma, temQueima: true })).toBe("queimas");
    expect(motivoSemCorrecao({ ...nenhuma, temOrcamento: true })).toBe("orcamento");
    expect(motivoSemCorrecao({ ...nenhuma, temContaFixa: true })).toBe("conta_fixa");
  });
});

// 06.5-17-PLAN.md, Tarefa 1 — o rascunho da correção: o que a Venda/Despesa abre preenchida (UI-D11: o
// preço da linha antiga), o que fica de fora e o pagamento como estava.
describe("rascunhoDaCorrecao — a Venda preenchida com a original", () => {
  const ITEM_ATIVO = "55555555-5555-4555-8555-555555555555";
  const ITEM_INATIVO = "66666666-6666-4666-8666-666666666666";
  const CATEGORIA = "77777777-7777-4777-8777-777777777777";

  function original(): OriginalParaRascunho {
    return {
      data: "2026-10-01",
      pessoaNome: "Joana Inventada",
      linhas: [
        {
          itemId: ITEM_ATIVO,
          descricao: "Caneca",
          categoriaId: CATEGORIA,
          quantidade: 2,
          valorCentavos: 7000,
          quantidadeEstoque: null,
          ehDiferenca: false,
        },
        {
          itemId: ITEM_INATIVO,
          descricao: "Caneca grande",
          categoriaId: CATEGORIA,
          quantidade: 1,
          valorCentavos: 5000,
          quantidadeEstoque: null,
          ehDiferenca: false,
        },
        {
          itemId: null,
          descricao: "Aporte",
          categoriaId: CATEGORIA,
          quantidade: 1,
          valorCentavos: 1234,
          quantidadeEstoque: null,
          ehDiferenca: false,
        },
        {
          itemId: null,
          descricao: "Diferença no recebimento",
          categoriaId: CATEGORIA,
          quantidade: 1,
          valorCentavos: -500,
          quantidadeEstoque: null,
          ehDiferenca: true,
        },
      ],
      parcelas: [
        { numero: 1, vencimento: "2026-10-01", valorCentavos: 12734, forma: "pix", pagoEm: "2026-10-01", taxaPontosBase: null },
      ],
    };
  }

  it("linha de item ativo entra com descrição, quantidade e o valor da linha antiga", () => {
    const rascunho = rascunhoDaCorrecao(original(), new Set([ITEM_ATIVO]));
    expect(rascunho.linhas[0]).toEqual({
      tipo: "item",
      itemId: ITEM_ATIVO,
      descricao: "Caneca",
      categoriaId: CATEGORIA,
      quantidade: 2,
      valorCentavos: 7000,
      quantidadeEstoque: null,
    });
    expect(rascunho.pessoa).toBe("Joana Inventada");
    expect(rascunho.data).toBe("2026-10-01");
  });

  it("linha de item inativo sai para deFora, pelo nome da linha, sem repetir", () => {
    const base = original();
    const rascunho = rascunhoDaCorrecao(
      { ...base, linhas: [...base.linhas, { ...base.linhas[1], quantidade: 3 }] },
      new Set([ITEM_ATIVO]),
    );
    expect(rascunho.deFora).toEqual(["Caneca grande"]);
    expect(rascunho.linhas.some((linha) => linha.tipo === "item" && linha.itemId === ITEM_INATIVO)).toBe(false);
  });

  it("linha livre entra com a categoria; a de diferença é ignorada", () => {
    const rascunho = rascunhoDaCorrecao(original(), new Set([ITEM_ATIVO]));
    expect(rascunho.linhas).toHaveLength(2);
    expect(rascunho.linhas[1]).toEqual({
      tipo: "livre",
      descricao: "Aporte",
      categoriaId: CATEGORIA,
      valorCentavos: 1234,
    });
  });

  it("sem pessoa → texto vazio", () => {
    expect(rascunhoDaCorrecao({ ...original(), pessoaNome: null }, new Set()).pessoa).toBe("");
  });

  it("à vista pago: uma parcela paga, plano à vista, a forma dela", () => {
    const { pagamento } = rascunhoDaCorrecao(original(), new Set([ITEM_ATIVO]));
    expect(pagamento).toEqual({
      plano: "avista",
      forma: "pix",
      duasFormas: false,
      parcelas: [{ vencimento: "2026-10-01", valorCentavos: 12734, forma: "pix", pago: true }],
    });
  });

  it("duas formas: à vista dividido, cada parcela com a sua forma e o seu pago", () => {
    const { pagamento } = rascunhoDaCorrecao(
      {
        ...original(),
        parcelas: [
          { numero: 1, vencimento: "2026-10-01", valorCentavos: 6000, forma: "pix", pagoEm: "2026-10-01", taxaPontosBase: null },
          { numero: 2, vencimento: "2026-10-01", valorCentavos: 6734, forma: "dinheiro", pagoEm: null, taxaPontosBase: null },
        ],
      },
      new Set([ITEM_ATIVO]),
    );
    expect(pagamento.plano).toBe("avista");
    expect(pagamento.duasFormas).toBe(true);
    expect(pagamento.forma).toBe("pix");
    expect(pagamento.parcelas.map((parcela) => [parcela.forma, parcela.pago])).toEqual([
      ["pix", true],
      ["dinheiro", false],
    ]);
  });

  it("a parcela paga vence no dia do pagamento; a em aberto, no vencimento", () => {
    const { pagamento } = rascunhoDaCorrecao(
      {
        ...original(),
        parcelas: [
          { numero: 1, vencimento: "2026-10-01", valorCentavos: 4245, forma: "cartao", pagoEm: "2026-10-03", taxaPontosBase: null },
          { numero: 2, vencimento: "2026-11-01", valorCentavos: 4245, forma: "cartao", pagoEm: null, taxaPontosBase: null },
          { numero: 3, vencimento: "2026-12-01", valorCentavos: 4244, forma: "cartao", pagoEm: null, taxaPontosBase: null },
        ],
      },
      new Set([ITEM_ATIVO]),
    );
    expect(pagamento.plano).toBe("3");
    expect(pagamento.parcelas.map((parcela) => parcela.vencimento)).toEqual([
      "2026-10-03",
      "2026-11-01",
      "2026-12-01",
    ]);
  });

  it("sinal: duas parcelas da mesma forma com 30 dias entre elas (que não são “um mês”)", () => {
    const { pagamento } = rascunhoDaCorrecao(
      {
        ...original(),
        parcelas: [
          { numero: 1, vencimento: "2026-10-01", valorCentavos: 6367, forma: "pix", pagoEm: "2026-10-01", taxaPontosBase: null },
          { numero: 2, vencimento: "2026-10-31", valorCentavos: 6367, forma: "pix", pagoEm: null, taxaPontosBase: null },
        ],
      },
      new Set([ITEM_ATIVO]),
    );
    expect(pagamento.plano).toBe("sinal");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// BL-01 da revisão 06.5 (decisão do dono, 07/10/2026; quick 261007-shs): a parcela JÁ RECEBIDA no
// cartão mantém, na corrigida, a taxa com que foi recebida. Só parcela nova (ou em aberto marcada paga
// agora) usa a taxa de hoje.

describe("rascunhoDaCorrecao — pagasDaOriginal (BL-01)", () => {
  it("só as parcelas pagas, com número, dia, forma, valor e a taxa congelada da original", () => {
    const rascunho = rascunhoDaCorrecao(
      {
        data: "2026-08-20",
        pessoaNome: "Lia Inventada",
        linhas: [],
        parcelas: [
          { numero: 1, vencimento: "2026-08-20", valorCentavos: 10000, forma: "cartao", pagoEm: "2026-08-20", taxaPontosBase: 499 },
          { numero: 2, vencimento: "2026-09-20", valorCentavos: 10000, forma: "cartao", pagoEm: null, taxaPontosBase: null },
          { numero: 3, vencimento: "2026-10-20", valorCentavos: 5000, forma: "pix", pagoEm: "2026-10-02", taxaPontosBase: null },
        ],
      },
      new Set(),
    );
    expect(rascunho.pagasDaOriginal).toEqual([
      { numero: 1, pagoEm: "2026-08-20", forma: "cartao", valorCentavos: 10000, taxaPontosBase: 499 },
      { numero: 3, pagoEm: "2026-10-02", forma: "pix", valorCentavos: 5000, taxaPontosBase: null },
    ]);
  });
});

describe("taxasHerdadasDaCorrecao — BL-01", () => {
  const D = "2026-08-20";
  const D2 = "2026-08-21";
  const paga = (
    numero: number,
    valorCentavos: number,
    taxaPontosBase: number | null,
    forma = "cartao",
    pagoEm: Date | string = D,
  ): ParcelaPagaDaOriginal => ({ numero, pagoEm, forma, valorCentavos, taxaPontosBase });
  const nova = (vencimento: string, valorCentavos: number, forma = "cartao", pago = true) => ({
    vencimento,
    valorCentavos,
    forma,
    pago,
  });

  it("a parcela recebida no cartão no mesmo dia e com o mesmo valor herda a taxa da original", () => {
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, 499)], [nova(D, 10000)])).toEqual([{ herdada: true, pontosBase: 499 }]);
  });

  it("taxa nula na original é herdada como nula — nunca vira a taxa de hoje", () => {
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, null)], [nova(D, 10000)])).toEqual([{ herdada: true, pontosBase: null }]);
  });

  it("outro dia, em aberto ou em pix não herdam", () => {
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, 499)], [nova(D2, 10000)])).toEqual([{ herdada: false }]);
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, 499)], [nova(D, 10000, "cartao", false)])).toEqual([{ herdada: false }]);
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, 499)], [nova(D, 10000, "pix")])).toEqual([{ herdada: false }]);
  });

  it("original paga em pix e nova paga no cartão no mesmo dia: a forma mudou, é pagamento novo", () => {
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, null, "pix")], [nova(D, 10000)])).toEqual([{ herdada: false }]);
  });

  it("cada original casa UMA vez, na ordem do número", () => {
    expect(
      taxasHerdadasDaCorrecao([paga(2, 10000, 450), paga(1, 10000, 499)], [nova(D, 10000), nova(D, 10000)]),
    ).toEqual([
      { herdada: true, pontosBase: 499 },
      { herdada: true, pontosBase: 450 },
    ]);
  });

  it("segunda passada: mesmo dia e cartão com valor diferente ainda herda", () => {
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, 499)], [nova(D, 15000)])).toEqual([{ herdada: true, pontosBase: 499 }]);
  });

  it("a primeira passada (mesmo valor) tem prioridade sobre a ordem", () => {
    expect(
      taxasHerdadasDaCorrecao([paga(1, 10000, 499), paga(2, 5000, 450)], [nova(D, 5000), nova(D, 10000)]),
    ).toEqual([
      { herdada: true, pontosBase: 450 },
      { herdada: true, pontosBase: 499 },
    ]);
  });

  it("pagoEm como Date (00:00 UTC ou 03:00 UTC do dia) casa com o vencimento em texto", () => {
    expect(
      taxasHerdadasDaCorrecao([paga(1, 10000, 499, "cartao", new Date("2026-08-20T00:00:00Z"))], [nova(D, 10000)]),
    ).toEqual([{ herdada: true, pontosBase: 499 }]);
    expect(
      taxasHerdadasDaCorrecao([paga(1, 10000, 499, "cartao", new Date("2026-08-20T03:00:00Z"))], [nova(D, 10000)]),
    ).toEqual([{ herdada: true, pontosBase: 499 }]);
  });

  it("vencimento vazio (campo de data limpo na tela) não casa e não lança", () => {
    expect(taxasHerdadasDaCorrecao([paga(1, 10000, 499)], [nova("", 10000)])).toEqual([{ herdada: false }]);
  });
});

describe("a correção não mexe no dinheiro do passado (BL-01)", () => {
  // A venda: R$ 200,00 em duas de R$ 100,00 no cartão; a 1/2 recebida em 20/08 com 4,99% congelado; a 2/2
  // em aberto. Em outubro a taxa de Cadastros vai a 3,49% e alguém corrige a venda (troca a pessoa),
  // marcando a 2/2 como recebida hoje.
  const DIA_PAGO = "2026-08-20";
  const HOJE = "2026-10-07";
  const TAXA_ORIGINAL = 499;
  const TAXA_DE_HOJE = 349;
  const pagasDaOriginal: ParcelaPagaDaOriginal[] = [
    { numero: 1, pagoEm: DIA_PAGO, forma: "cartao", valorCentavos: 10000, taxaPontosBase: TAXA_ORIGINAL },
  ];
  const parcelasDaNova = [
    { vencimento: DIA_PAGO, valorCentavos: 10000, forma: "cartao", pago: true },
    { vencimento: HOJE, valorCentavos: 10000, forma: "cartao", pago: true },
  ];
  const documento: DocumentoParaMes = {
    data: DIA_PAGO,
    tipo: "venda",
    cancelado: false,
    linhas: [{ grupo: "receita", area: "pecas", categoriaNome: "Peças prontas", valorCentavos: 20000 }],
  };
  type Paga = { pagoEm: string; valorCentavos: number; taxa: number | null };

  // A taxa que `gravarVenda` grava em cada parcela da nova: herdada, ou a de hoje.
  function depois(comHeranca: boolean): Paga[] {
    const herancas = taxasHerdadasDaCorrecao(comHeranca ? pagasDaOriginal : [], parcelasDaNova);
    return parcelasDaNova.map((parcela, indice) => {
      const heranca = herancas[indice];
      return {
        pagoEm: parcela.vencimento,
        valorCentavos: parcela.valorCentavos,
        taxa: heranca.herdada ? heranca.pontosBase : TAXA_DE_HOJE,
      };
    });
  }
  const antes: Paga[] = [{ pagoEm: DIA_PAGO, valorCentavos: 10000, taxa: TAXA_ORIGINAL }];

  function gruposAntesDeSetembro(pagas: Paga[]): GrupoDePagas[] {
    return pagas
      .filter((paga) => paga.pagoEm < "2026-09-01")
      .map((paga) => ({ tipo: "venda", valorCentavos: paga.valorCentavos, taxaPontosBase: paga.taxa, quantidade: 1 }));
  }

  function resumoDeAgosto(pagas: Paga[]) {
    const parcelasPagas: ParcelaPagaParaMes[] = pagas.map((paga) => ({
      pagoEm: paga.pagoEm,
      tipo: "venda",
      cancelado: false,
      forma: "cartao",
      valorCentavos: paga.valorCentavos,
      taxaPontosBase: paga.taxa,
    }));
    return resumoDoMes({ mes: "2026-08", documentos: [documento], parcelasPagas });
  }

  function liquidoDaPrimeira(pagas: Paga[]): number {
    return liquidoDaParcela({ tipo: "venda", valorCentavos: pagas[0].valorCentavos, taxaPontosBase: pagas[0].taxa });
  }

  it("com a herança: o líquido, o saldo antes de setembro e o Mês de agosto ficam IDÊNTICOS", () => {
    const nova = depois(true);
    expect(nova.map((paga) => paga.taxa)).toEqual([TAXA_ORIGINAL, TAXA_DE_HOJE]);
    expect(liquidoDaPrimeira(nova)).toBe(liquidoDaPrimeira(antes));
    expect(saldoAntesDaJanela(gruposAntesDeSetembro(nova))).toBe(saldoAntesDaJanela(gruposAntesDeSetembro(antes)));
    expect(resumoDeAgosto(nova)).toEqual(resumoDeAgosto(antes));
  });

  it("controle sem a herança (3,49% na nova): os três DIFEREM — o teste morde", () => {
    const nova = depois(false);
    expect(liquidoDaPrimeira(nova)).not.toBe(liquidoDaPrimeira(antes));
    expect(saldoAntesDaJanela(gruposAntesDeSetembro(nova))).not.toBe(saldoAntesDaJanela(gruposAntesDeSetembro(antes)));
    expect(resumoDeAgosto(nova)).not.toEqual(resumoDeAgosto(antes));
  });
});

// 06.5-WR-02 (quick 261007-shs; decisão do dono, 07/10/2026): cancelar o documento que corrigiu outro não traz a
// original de volta — a confirmação diz isso e oferece “Corrigir”.
describe("fraseCancelarCorrecao (WR-02)", () => {
  it("venda e despesa", () => {
    expect(fraseCancelarCorrecao("venda", 33)).toBe(
      "Esta venda corrige a nº 33, que continua cancelada — cancelar esta não traz a nº 33 de volta. Se a correção é que estava errada, use “Corrigir esta venda”.",
    );
    expect(fraseCancelarCorrecao("despesa", 12)).toBe(
      "Esta despesa corrige a nº 12, que continua cancelada — cancelar esta não traz a nº 12 de volta. Se a correção é que estava errada, use “Corrigir esta despesa”.",
    );
  });
});

describe("os textos do aviso do cartão na correção (BL-01)", () => {
  it("todas herdadas com a mesma taxa: a maquininha FICOU com a taxa de quando a venda foi recebida", () => {
    expect(textoAvisoCartaoHerdado("4,99", "R$ 4,99", "R$ 95,01")).toBe(
      "Cartão: a maquininha ficou com 4,99% (R$ 4,99) — a taxa de quando a venda foi recebida, que a correção mantém. Entram R$ 95,01 no caixa e a taxa vira custo do mês.",
    );
  });

  it("misto: as já recebidas mantêm a taxa de quando entraram; as novas usam a de hoje", () => {
    expect(textoAvisoCartaoMisto("R$ 8,48", "R$ 191,52", "3,49")).toBe(
      "Cartão: a maquininha fica com R$ 8,48 — as parcelas já recebidas mantêm a taxa de quando entraram, e as novas usam a de hoje (3,49%). Entram R$ 191,52 no caixa e a taxa vira custo do mês. A taxa muda em Cadastros → Taxas.",
    );
  });
});

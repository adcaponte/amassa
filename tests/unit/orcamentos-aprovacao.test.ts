import { describe, expect, it } from "vitest";

import { planejarAprovacao, type LinhaParaAprovacao } from "@/lib/orcamentos/aprovacao";

const HOJE = "2026-10-01";
const ENTREGA_PREVISTA = "2026-11-15";
const FICHA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FICHA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function linha(sobrescrita: Partial<LinhaParaAprovacao> = {}): LinhaParaAprovacao {
  return {
    fichaId: FICHA_A,
    nome: "Caneca cônica",
    quantidade: 1,
    precoUnitarioCentavos: 5000,
    cor: null,
    personalizacao: null,
    ...sobrescrita,
  };
}

describe("planejarAprovacao", () => {
  it("gera uma linha de venda com a descrição sem cor quando a linha não tem cor", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha({ nome: "Caneca cônica", cor: null })],
      [],
      HOJE,
    );

    expect(plano.linhasDaVenda[0].descricao).toBe("Caneca cônica");
  });

  it("acrescenta a cor na descrição com ' — ' quando a linha tem cor", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha({ nome: "Caneca cônica", cor: "verde-musgo" })],
      [],
      HOJE,
    );

    expect(plano.linhasDaVenda[0].descricao).toBe("Caneca cônica — verde-musgo");
  });

  it("acrescenta a personalização depois da cor, separada por ' · '", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha({ nome: "Caneca cônica", cor: "verde-musgo", personalizacao: "gravação: Maria" })],
      [],
      HOJE,
    );

    expect(plano.linhasDaVenda[0].descricao).toBe(
      "Caneca cônica — verde-musgo · gravação: Maria",
    );
  });

  it("o valor total da linha é quantidade × unitário, em centavos inteiros", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha({ quantidade: 4, precoUnitarioCentavos: 3333 })],
      [],
      HOJE,
    );

    expect(plano.linhasDaVenda[0].quantidade).toBe(4);
    expect(plano.linhasDaVenda[0].valorCentavos).toBe(4 * 3333);
  });

  it("cada custo de projeto vira uma linha de venda com a própria descrição", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha()],
      [
        { descricao: "Molde exclusivo", valorCentavos: 10000 },
        { descricao: "Carimbo", valorCentavos: 5000 },
      ],
      HOJE,
    );

    const descricoes = plano.linhasDaVenda.map((l) => l.descricao);
    expect(descricoes).toContain("Molde exclusivo");
    expect(descricoes).toContain("Carimbo");
  });

  it("o frete, quando maior que zero, vira uma linha 'Frete'", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 2500,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha()],
      [],
      HOJE,
    );

    const linhaDeFrete = plano.linhasDaVenda.find((l) => l.descricao === "Frete");
    expect(linhaDeFrete).toBeDefined();
    expect(linhaDeFrete?.valorCentavos).toBe(2500);
  });

  it("quando o frete é zero, não existe linha de frete", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha()],
      [],
      HOJE,
    );

    expect(plano.linhasDaVenda.some((l) => l.descricao === "Frete")).toBe(false);
  });

  it("a soma das linhas da venda é exatamente o total do orçamento (peças + 2 custos + frete)", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "avista",
        sinalPercentual: 50,
        freteCentavos: 4000,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [
        linha({ nome: "Caneca cônica", quantidade: 3, precoUnitarioCentavos: 5000 }),
        linha({ nome: "Prato raso", quantidade: 2, precoUnitarioCentavos: 8000 }),
      ],
      [
        { descricao: "Molde exclusivo", valorCentavos: 10000 },
        { descricao: "Carimbo", valorCentavos: 5000 },
      ],
      HOJE,
    );

    const somaEsperada = 3 * 5000 + 2 * 8000 + 10000 + 5000 + 4000;
    const somaDasLinhas = plano.linhasDaVenda.reduce((total, l) => total + l.valorCentavos, 0);
    expect(somaDasLinhas).toBe(somaEsperada);
    expect(plano.totalCentavos).toBe(somaEsperada);
  });

  it("as parcelas vêm de parcelasDoPlano, com a primeira vencendo hoje e nenhuma paga", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "sinal",
        sinalPercentual: 50,
        freteCentavos: 0,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha({ quantidade: 1, precoUnitarioCentavos: 10000 })],
      [],
      HOJE,
    );

    expect(plano.parcelas).toHaveLength(2);
    expect(plano.parcelas[0].vencimento).toBe(HOJE);
    expect(plano.parcelas[1].vencimento).toBe(ENTREGA_PREVISTA);
    // `ParcelaDoPlano` nem tem campo de pagamento — nenhuma parcela nasce paga por construção.
    for (const parcela of plano.parcelas) {
      expect(parcela).not.toHaveProperty("pago");
      expect(parcela).not.toHaveProperty("pagoEm");
    }
  });

  it("a soma das parcelas é exatamente a soma das linhas", () => {
    const plano = planejarAprovacao(
      {
        numero: "ORC-2026-001",
        titulo: "Jogo de jantar",
        plano: "3x",
        sinalPercentual: 50,
        freteCentavos: 1500,
        entregaPrevista: ENTREGA_PREVISTA,
      },
      [linha({ quantidade: 3, precoUnitarioCentavos: 3333 })],
      [{ descricao: "Molde", valorCentavos: 777 }],
      HOJE,
    );

    const somaDasLinhas = plano.linhasDaVenda.reduce((total, l) => total + l.valorCentavos, 0);
    const somaDasParcelas = plano.parcelas.reduce((total, p) => total + p.valorCentavos, 0);
    expect(somaDasParcelas).toBe(somaDasLinhas);
  });

  // Fase 06.1 (plano 03): a aprovação abre a ORDEM DE PRODUÇÃO — uma peça por linha, na ordem das
  // linhas, com a ficha, a cor e a personalização em campos próprios (não mais concatenadas numa
  // descrição de item). As etapas não vêm mais daqui: nascem de `etapasIniciais` na gravação.
  const ORCAMENTO = {
    numero: "ORC-2026-001",
    titulo: "Jogo de jantar",
    plano: "avista" as const,
    sinalPercentual: 50,
    freteCentavos: 0,
    entregaPrevista: ENTREGA_PREVISTA,
  };

  it("as peças da ordem são uma por linha, na ordem das linhas, com a ficha, a cor e a personalização", () => {
    const plano = planejarAprovacao(
      ORCAMENTO,
      [
        linha({ fichaId: FICHA_A, nome: "Caneca cônica", quantidade: 4, cor: "verde-musgo" }),
        linha({
          fichaId: FICHA_B,
          nome: "Prato raso",
          quantidade: 2,
          cor: null,
          personalizacao: "gravação: Maria",
        }),
      ],
      [],
      HOJE,
    );

    expect(plano.pecasDaOrdem).toEqual([
      {
        fichaId: FICHA_A,
        descricao: "Caneca cônica",
        quantidade: 4,
        cor: "verde-musgo",
        personalizacao: null,
      },
      {
        fichaId: FICHA_B,
        descricao: "Prato raso",
        quantidade: 2,
        cor: null,
        personalizacao: "gravação: Maria",
      },
    ]);
  });

  it("custos de projeto e frete não viram peça da ordem", () => {
    const plano = planejarAprovacao(
      { ...ORCAMENTO, freteCentavos: 2500 },
      [linha()],
      [{ descricao: "Molde exclusivo", valorCentavos: 10000 }],
      HOJE,
    );

    expect(plano.pecasDaOrdem).toHaveLength(1);
  });

  it("trunca com segurança a descrição da peça além de 160 pontos de código (o teto de ordem_pecas)", () => {
    const plano = planejarAprovacao(ORCAMENTO, [linha({ nome: `${"P".repeat(150)}${"😀".repeat(20)}` })], [], HOJE);

    const descricao = plano.pecasDaOrdem[0].descricao;
    expect([...descricao].length).toBe(160);
    expect(descricao.startsWith("P".repeat(150))).toBe(true);
    // Corta em fronteira de ponto de código — nenhum emoji partido ao meio.
    expect(descricao.endsWith("😀")).toBe(true);
  });

  it("o plano não carrega mais etapas nem itens de encomenda", () => {
    const plano = planejarAprovacao(ORCAMENTO, [linha()], [], HOJE);

    expect(plano).not.toHaveProperty("etapasDaEncomenda");
    expect(plano).not.toHaveProperty("itensDaEncomenda");
    expect(plano).not.toHaveProperty("nomeDaEncomenda");
  });

  it("o nome da ordem é o título do orçamento", () => {
    const plano = planejarAprovacao(ORCAMENTO, [linha()], [], HOJE);

    expect(plano.nomeDaOrdem).toBe("Jogo de jantar");
  });

  it("quando o título está vazio, o nome da ordem é 'Orçamento {número}'", () => {
    const plano = planejarAprovacao({ ...ORCAMENTO, titulo: "  " }, [linha()], [], HOJE);

    expect(plano.nomeDaOrdem).toBe("Orçamento ORC-2026-001");
  });

  it("o nome da ordem é truncado com segurança em 120 pontos de código", () => {
    const plano = planejarAprovacao({ ...ORCAMENTO, titulo: "J".repeat(160) }, [linha()], [], HOJE);

    expect([...plano.nomeDaOrdem].length).toBe(120);
  });
});

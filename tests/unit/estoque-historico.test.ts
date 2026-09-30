import { describe, expect, it } from "vitest";

import {
  abaDoEstoqueDaUrl,
  limiteDaUrl,
  periodoDaUrl,
  tipoDoHistoricoDaUrl,
} from "@/lib/estoque/abas";
import { DESTINOS_DE_SAIDA } from "@/lib/estoque/destinos";
import { esquemaLerMaterial } from "@/lib/estoque/esquemas";
import {
  agregarParaOndeFoi,
  descreverMovimentacao,
  inicioDoPeriodo,
  ordenarGastoPor,
  quandoTexto,
  textoGastoPor,
  type MovimentacaoParaDescrever,
  type SaidaParaOndeFoi,
} from "@/lib/estoque/historico";

// As abas Histórico e Para onde foi (06-07-PLAN.md, Tarefa 1). Um `it` por comportamento do
// `<behavior>` do plano, mais as arestas de EST-05 (adjacência, vazio, ordem) que o plano lista em
// `must_haves.truths`. Nomes e valores inventados — nenhum dado real.

// O `Intl` põe um espaço não separável depois de "R$"; a comparação usa o espaço comum.
function semNbsp(texto: string): string {
  return texto.replace(/ /g, " ");
}

function mov(parcial: Partial<MovimentacaoParaDescrever>): MovimentacaoParaDescrever {
  return {
    origem: "manual",
    tipo: "saida",
    motivo: null,
    destino: null,
    area: null,
    unidade: "kg",
    quantidadeMilesimos: -1000,
    valorCentavos: 0,
    valorInformadoCentavos: null,
    saldoContadoMilesimos: null,
    nota: null,
    documentoNumero: null,
    ehEstorno: false,
    estornada: false,
    ...parcial,
  };
}

function rotulosDosChips(descricao: ReturnType<typeof descreverMovimentacao>): string[] {
  return descricao.chips.map((chip) => chip.rotulo);
}

describe("abas do Estoque — os parâmetros da URL", () => {
  it("?aba= aceita historico e destino; qualquer outra coisa cai em saldos", () => {
    expect(abaDoEstoqueDaUrl("historico")).toBe("historico");
    expect(abaDoEstoqueDaUrl("destino")).toBe("destino");
    expect(abaDoEstoqueDaUrl("saldos")).toBe("saldos");
    expect(abaDoEstoqueDaUrl("xyz")).toBe("saldos");
    expect(abaDoEstoqueDaUrl(null)).toBe("saldos");
    expect(abaDoEstoqueDaUrl(undefined)).toBe("saldos");
    expect(abaDoEstoqueDaUrl(["historico", "destino"])).toBe("saldos");
  });

  it("?tipo= aceita entrada, saida e ajuste; o resto é tudo", () => {
    expect(tipoDoHistoricoDaUrl("entrada")).toBe("entrada");
    expect(tipoDoHistoricoDaUrl("saida")).toBe("saida");
    expect(tipoDoHistoricoDaUrl("ajuste")).toBe("ajuste");
    expect(tipoDoHistoricoDaUrl("venda")).toBe("tudo");
    expect(tipoDoHistoricoDaUrl(null)).toBe("tudo");
  });

  it("?limite= só aceita múltiplos de 50 até 1000; o resto vira 50 (T-06-28)", () => {
    expect(limiteDaUrl("100")).toBe(100);
    expect(limiteDaUrl("1000")).toBe(1000);
    expect(limiteDaUrl("7")).toBe(50);
    expect(limiteDaUrl("abc")).toBe(50);
    expect(limiteDaUrl("5000")).toBe(50);
    expect(limiteDaUrl("1050")).toBe(50);
    expect(limiteDaUrl("0")).toBe(50);
    expect(limiteDaUrl("-50")).toBe(50);
    expect(limiteDaUrl("100.0")).toBe(50);
    expect(limiteDaUrl(null)).toBe(50);
  });

  it("?periodo= aceita 30, 90 e tudo; o resto é 30", () => {
    expect(periodoDaUrl("30")).toBe("30");
    expect(periodoDaUrl("90")).toBe("90");
    expect(periodoDaUrl("tudo")).toBe("tudo");
    expect(periodoDaUrl("7")).toBe("30");
    expect(periodoDaUrl(undefined)).toBe("30");
  });
});

describe("descreverMovimentacao — uma frase por tipo de movimentação (UI-SPEC §Aba Histórico)", () => {
  it("saída manual de perda: destino, área que pagou, o que aconteceu e o valor; chip Perda", () => {
    const descricao = descreverMovimentacao(
      mov({
        destino: "perda",
        area: "pecas",
        quantidadeMilesimos: -1000,
        valorCentavos: -420,
        nota: "caiu da prateleira",
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe(
      "Perda ou quebra · paga por Peças · caiu da prateleira · R$ 4,20",
    );
    expect(rotulosDosChips(descricao)).toEqual(["Perda"]);
    expect(descricao.sinal).toBe("−");
    expect(descricao.tom).toBe("tinta");
    expect(descricao.quantidadeTexto).toBe("−1");
    expect(descricao.unidadeTexto).toBe("kg");
  });

  it("saída manual sem vínculo não deixa separador sobrando", () => {
    const descricao = descreverMovimentacao(
      mov({ destino: "atelie", area: "pecas", quantidadeMilesimos: -2000, valorCentavos: -840 }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Uso do ateliê · paga por Peças · R$ 8,40");
    expect(descricao.chips).toEqual([]);
  });

  it("saída por venda: venda nº, área da linha que vendeu; chips Venda e do Financeiro", () => {
    const descricao = descreverMovimentacao(
      mov({
        origem: "venda",
        area: "cafeteria",
        quantidadeMilesimos: -2000,
        valorCentavos: -840,
        documentoNumero: 12,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe(
      "Vendido · venda nº 12 · paga por Cafeteria · R$ 8,40",
    );
    expect(rotulosDosChips(descricao)).toEqual(["Venda", "do Financeiro"]);
  });

  it("entrada por compra: compra nº, o valor da nota e o preço por unidade; chip do Financeiro", () => {
    const descricao = descreverMovimentacao(
      mov({
        origem: "compra",
        tipo: "entrada",
        quantidadeMilesimos: 25000,
        valorCentavos: 12500,
        valorInformadoCentavos: 12500,
        documentoNumero: 7,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Compra nº 7 · R$ 125,00 · R$ 5,00/kg");
    expect(rotulosDosChips(descricao)).toEqual(["do Financeiro"]);
    expect(descricao.sinal).toBe("+");
    expect(descricao.tom).toBe("sucesso");
    expect(descricao.quantidadeTexto).toBe("+25");
  });

  it("entrada manual mostra o valor da NOTA quando ele difere do gravado (D-25)", () => {
    const descricao = descreverMovimentacao(
      mov({
        tipo: "entrada",
        quantidadeMilesimos: 25000,
        valorCentavos: 12420,
        valorInformadoCentavos: 12500,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Entrada · R$ 125,00 · R$ 5,00/kg");
    expect(semNbsp(descricao.linha2)).not.toContain("124,20");
    expect(descricao.chips).toEqual([]);
  });

  it("entrada de peça pronta diz que é peça pronta", () => {
    const descricao = descreverMovimentacao(
      mov({
        tipo: "entrada",
        motivo: "peca_pronta",
        unidade: "un",
        quantidadeMilesimos: 4000,
        valorCentavos: 4800,
        valorInformadoCentavos: 4800,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Entrada · peça pronta · R$ 48,00 · R$ 12,00/un");
  });

  it("entrada da Produção: “Da Produção · {ordem} · {R$} · {R$}/{un}” e o chip da Produção (PRD-16)", () => {
    const descricao = descreverMovimentacao(
      mov({
        origem: "producao",
        tipo: "entrada",
        unidade: "un",
        quantidadeMilesimos: 2000,
        valorCentavos: 7404,
        valorInformadoCentavos: 7404,
        nota: "Canecas da Ana",
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Da Produção · Canecas da Ana · R$ 74,04 · R$ 37,02/un");
    expect(descricao.chips).toEqual([{ rotulo: "da Produção", tom: "producao" }]);
    expect(descricao.sinal).toBe("+");
    expect(descricao.tom).toBe("sucesso");
  });

  it("ajuste: contado na prateleira e o motivo; número em terracota com o sentido da diferença", () => {
    const descricao = descreverMovimentacao(
      mov({
        tipo: "ajuste",
        quantidadeMilesimos: -900,
        valorCentavos: -378,
        saldoContadoMilesimos: 4100,
        nota: "Conferência da prateleira",
      }),
    );
    expect(descricao.linha2).toBe(
      "Ajuste de conferência · contado 4,1 kg na prateleira · Conferência da prateleira",
    );
    expect(descricao.tom).toBe("acento");
    expect(descricao.sinal).toBe("−");
    expect(descricao.quantidadeTexto).toBe("−0,9");
    expect(descricao.chips).toEqual([]);

    const paraMais = descreverMovimentacao(
      mov({ tipo: "ajuste", quantidadeMilesimos: 500, saldoContadoMilesimos: 5000 }),
    );
    expect(paraMais.linha2).toBe("Ajuste de conferência · contado 5 kg na prateleira");
    expect(paraMais.sinal).toBe("+");
    expect(paraMais.tom).toBe("acento");
  });

  it("estorno de venda: venda nº cancelada e o valor; chips Estorno e do Financeiro", () => {
    const descricao = descreverMovimentacao(
      mov({
        origem: "venda",
        tipo: "entrada",
        area: "cafeteria",
        quantidadeMilesimos: 2000,
        valorCentavos: 840,
        valorInformadoCentavos: 840,
        documentoNumero: 12,
        ehEstorno: true,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Estorno · venda nº 12 cancelada · R$ 8,40");
    expect(rotulosDosChips(descricao)).toEqual(["Estorno", "do Financeiro"]);
    expect(descricao.sinal).toBe("+");
  });

  it("estorno de compra sai, com compra nº cancelada", () => {
    const descricao = descreverMovimentacao(
      mov({
        origem: "compra",
        tipo: "saida",
        quantidadeMilesimos: -10000,
        valorCentavos: -3000,
        documentoNumero: 7,
        ehEstorno: true,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Estorno · compra nº 7 cancelada · R$ 30,00");
    expect(rotulosDosChips(descricao)).toEqual(["Estorno", "do Financeiro"]);
    expect(descricao.sinal).toBe("−");
  });

  it("a original estornada ganha o chip Estornada, sem mudar o texto (EST-16/D-04)", () => {
    const base = mov({
      origem: "venda",
      area: "cafeteria",
      quantidadeMilesimos: -2000,
      valorCentavos: -840,
      documentoNumero: 12,
    });
    const original = descreverMovimentacao(base);
    const estornada = descreverMovimentacao({ ...base, estornada: true });
    expect(estornada.linha2).toBe(original.linha2);
    expect(rotulosDosChips(estornada)).toEqual(["Venda", "do Financeiro", "Estornada"]);
    expect(estornada.chips.find((chip) => chip.rotulo === "Estornada")?.tom).toBe("neutro");
  });

  it("saldo inicial: contado e o valor informado; chip Saldo inicial", () => {
    const descricao = descreverMovimentacao(
      mov({
        tipo: "entrada",
        motivo: "saldo_inicial",
        quantidadeMilesimos: 10000,
        valorCentavos: 5000,
        valorInformadoCentavos: 5000,
        saldoContadoMilesimos: 10000,
      }),
    );
    expect(semNbsp(descricao.linha2)).toBe("Saldo inicial · contado 10 kg · R$ 50,00");
    expect(rotulosDosChips(descricao)).toEqual(["Saldo inicial"]);
    expect(descricao.tom).toBe("sucesso");

    // Primeira contagem ABAIXO do saldo (06-10): ajuste com motivo saldo_inicial, sem custo.
    const paraMenos = descreverMovimentacao(
      mov({
        tipo: "ajuste",
        motivo: "saldo_inicial",
        quantidadeMilesimos: -2000,
        saldoContadoMilesimos: 3000,
      }),
    );
    expect(paraMenos.linha2).toBe("Saldo inicial · contado 3 kg");
    expect(rotulosDosChips(paraMenos)).toEqual(["Saldo inicial"]);
    expect(paraMenos.tom).toBe("acento");
  });

  it("vocabulário: nunca SKU, valoração nem frente", () => {
    const textos = [
      mov({ destino: "cafeteria", area: "cafeteria", valorCentavos: -100 }),
      mov({ origem: "venda", area: "loja", documentoNumero: 3 }),
      mov({ tipo: "entrada", quantidadeMilesimos: 1000, valorInformadoCentavos: 100 }),
    ].map((linha) => descreverMovimentacao(linha).linha2.toLowerCase());
    for (const texto of textos) {
      expect(texto).not.toMatch(/sku|valora|frente/);
    }
  });

  it("litro aparece como L e quantidades fracionárias em pt-BR", () => {
    const descricao = descreverMovimentacao(
      mov({ unidade: "l", destino: "cafeteria", area: "cafeteria", quantidadeMilesimos: -1234567 }),
    );
    expect(descricao.unidadeTexto).toBe("L");
    expect(descricao.quantidadeTexto).toBe("−1.234,567");
  });
});

describe("quandoTexto — Hoje / Ontem / dd/mm, sempre em Brasília", () => {
  // 29/09/2026, 15:00 em Brasília = 18:00 UTC.
  const agora = new Date("2026-09-29T18:00:00Z");

  it("mesmo dia em Brasília → Hoje, hh:mm", () => {
    expect(quandoTexto(new Date("2026-09-29T17:32:00Z"), agora)).toBe("Hoje, 14:32");
  });

  it("dia anterior → Ontem, hh:mm", () => {
    expect(quandoTexto(new Date("2026-09-28T12:10:00Z"), agora)).toBe("Ontem, 09:10");
  });

  it("antes de ontem → dd/mm, hh:mm", () => {
    expect(quandoTexto(new Date("2026-09-27T17:32:00Z"), agora)).toBe("27/09, 14:32");
  });

  it("às 23h30 de Brasília (02h30 UTC do dia seguinte) continua Hoje", () => {
    const agoraTarde = new Date("2026-09-30T02:45:00Z"); // 23h45 de 29/09 em Brasília
    expect(quandoTexto(new Date("2026-09-30T02:30:00Z"), agoraTarde)).toBe("Hoje, 23:30");
  });

  it("à meia-noite e meia de Brasília, o que foi às 23h30 do dia anterior é Ontem", () => {
    const agoraMadrugada = new Date("2026-09-30T03:30:00Z"); // 00h30 de 30/09 em Brasília
    expect(quandoTexto(new Date("2026-09-30T02:30:00Z"), agoraMadrugada)).toBe("Ontem, 23:30");
  });

  it("vira o mês: 1º de outubro olha para 30 de setembro como Ontem", () => {
    const primeiroDeOutubro = new Date("2026-10-01T13:00:00Z");
    expect(quandoTexto(new Date("2026-09-30T13:00:00Z"), primeiroDeOutubro)).toBe("Ontem, 10:00");
  });
});

describe("inicioDoPeriodo — a data civil de início", () => {
  it("últimos 30 dias = hoje e os 29 anteriores", () => {
    expect(inicioDoPeriodo("2026-09-29", 30)).toBe("2026-08-31");
  });

  it("90 dias atravessa meses e ano", () => {
    expect(inicioDoPeriodo("2027-01-15", 90)).toBe("2026-10-18");
  });

  it("1 dia é o próprio dia", () => {
    expect(inicioDoPeriodo("2026-03-01", 1)).toBe("2026-03-01");
  });
});

describe("agregarParaOndeFoi — qual área pagou cada grama (D-12, D-31, Pitfall 15)", () => {
  function saida(parcial: Partial<SaidaParaOndeFoi>): SaidaParaOndeFoi {
    return {
      origem: "manual",
      tipo: "saida",
      destino: "atelie",
      area: "pecas",
      valorCentavos: -100,
      ehEstorno: false,
      estornada: false,
      ...parcial,
    };
  }
  const opcoes = { destinos: DESTINOS_DE_SAIDA };

  it("seis barras sempre: os cinco destinos e Vendido · pelo Financeiro", () => {
    const resultado = agregarParaOndeFoi([], opcoes);
    expect(resultado.barras.map((barra) => barra.chave)).toEqual([
      "aula",
      "encomenda",
      "cafeteria",
      "atelie",
      "perda",
      "venda",
    ]);
    expect(resultado.barras.find((barra) => barra.chave === "venda")?.nome).toBe(
      "Vendido · pelo Financeiro",
    );
  });

  it("total zero: todas sem saída, largura e percentual zero", () => {
    const resultado = agregarParaOndeFoi([], opcoes);
    expect(resultado.totalCentavos).toBe(0);
    expect(resultado.saidas).toBe(0);
    for (const barra of resultado.barras) {
      expect(barra.valorCentavos).toBe(0);
      expect(barra.saidas).toBe(0);
      expect(barra.percentual).toBe(0);
      expect(barra.largura).toBe(0);
    }
  });

  it("soma o valor ABSOLUTO de cada saída no destino dela", () => {
    const resultado = agregarParaOndeFoi(
      [
        saida({ destino: "perda", valorCentavos: -420 }),
        saida({ destino: "perda", valorCentavos: -80 }),
        saida({ destino: "aula", area: "espaco", valorCentavos: -1000 }),
      ],
      opcoes,
    );
    const perda = resultado.barras.find((barra) => barra.chave === "perda");
    expect(perda).toMatchObject({ valorCentavos: 500, saidas: 2, area: "pecas" });
    expect(resultado.totalCentavos).toBe(1500);
    expect(resultado.saidas).toBe(3);
  });

  it("saída de venda estornada fica fora — uma venda cancelada zera (Pitfall 15)", () => {
    const resultado = agregarParaOndeFoi(
      [saida({ origem: "venda", destino: null, area: "cafeteria", valorCentavos: -840, estornada: true })],
      opcoes,
    );
    expect(resultado.totalCentavos).toBe(0);
    expect(resultado.saidas).toBe(0);
    expect(resultado.barras.find((barra) => barra.chave === "venda")?.saidas).toBe(0);
  });

  it("estorno de compra (saída de origem compra) fica fora", () => {
    const resultado = agregarParaOndeFoi(
      [saida({ origem: "compra", destino: null, area: null, valorCentavos: -3000, ehEstorno: true })],
      opcoes,
    );
    expect(resultado.totalCentavos).toBe(0);
  });

  it("ajuste fica fora, mesmo para menos", () => {
    const resultado = agregarParaOndeFoi(
      [saida({ tipo: "ajuste", destino: null, area: null, valorCentavos: -500 })],
      opcoes,
    );
    expect(resultado.totalCentavos).toBe(0);
    expect(resultado.saidas).toBe(0);
  });

  it("entrada nunca conta como consumo", () => {
    const resultado = agregarParaOndeFoi(
      [saida({ tipo: "entrada", destino: null, valorCentavos: 900 })],
      opcoes,
    );
    expect(resultado.totalCentavos).toBe(0);
  });

  it("a barra de vendas tem uma linha por área que vendeu (D-31)", () => {
    const resultado = agregarParaOndeFoi(
      [
        saida({ origem: "venda", destino: null, area: "cafeteria", valorCentavos: -300 }),
        saida({ origem: "venda", destino: null, area: "pecas", valorCentavos: -700 }),
        saida({ origem: "venda", destino: null, area: "cafeteria", valorCentavos: -200 }),
      ],
      opcoes,
    );
    const vendas = resultado.barras.find((barra) => barra.chave === "venda");
    expect(vendas?.valorCentavos).toBe(1200);
    expect(vendas?.saidas).toBe(3);
    expect(vendas?.area).toBeNull();
    expect(vendas?.porArea).toEqual([
      { area: "pecas", valorCentavos: 700 },
      { area: "cafeteria", valorCentavos: 500 },
    ]);
    // Os destinos manuais não têm linhas por área.
    expect(resultado.barras.find((barra) => barra.chave === "aula")?.porArea).toEqual([]);
  });

  it("ordem decrescente de valor; empate na ordem fixa dos destinos", () => {
    const resultado = agregarParaOndeFoi(
      [
        saida({ destino: "perda", valorCentavos: -500 }),
        saida({ origem: "venda", destino: null, area: "loja", valorCentavos: -900 }),
        saida({ destino: "encomenda", valorCentavos: -500 }),
        saida({ destino: "cafeteria", area: "cafeteria", valorCentavos: -100 }),
      ],
      opcoes,
    );
    expect(resultado.barras.map((barra) => barra.chave)).toEqual([
      "venda",
      "encomenda",
      "perda",
      "cafeteria",
      "aula",
      "atelie",
    ]);
  });

  it("percentual sobre o total; largura proporcional à maior, mínimo 2% quando o valor é maior que zero", () => {
    const resultado = agregarParaOndeFoi(
      [
        saida({ destino: "atelie", valorCentavos: -10000 }),
        saida({ destino: "perda", valorCentavos: -100 }),
        saida({ destino: "aula", area: "espaco", valorCentavos: -1 }),
      ],
      opcoes,
    );
    const por = (chave: string) => resultado.barras.find((barra) => barra.chave === chave);
    expect(por("atelie")).toMatchObject({ largura: 100, percentual: 99 });
    expect(por("perda")).toMatchObject({ largura: 2, percentual: 1 });
    expect(por("aula")).toMatchObject({ largura: 2, percentual: 0 });
    expect(por("cafeteria")).toMatchObject({ largura: 0, percentual: 0, saidas: 0 });
  });

  it("saída de valor zero (material sem custo, D-26) conta como saída, sem largura", () => {
    const resultado = agregarParaOndeFoi([saida({ destino: "atelie", valorCentavos: 0 })], opcoes);
    expect(resultado.saidas).toBe(1);
    const atelie = resultado.barras.find((barra) => barra.chave === "atelie");
    expect(atelie).toMatchObject({ saidas: 1, valorCentavos: 0, largura: 0, percentual: 0 });
  });

  it("uma venda que baixa dois insumos são duas saídas na mesma barra (EST-05 · adjacency)", () => {
    const resultado = agregarParaOndeFoi(
      [
        saida({ origem: "venda", destino: null, area: "cafeteria", valorCentavos: -50 }),
        saida({ origem: "venda", destino: null, area: "cafeteria", valorCentavos: -30 }),
      ],
      opcoes,
    );
    expect(resultado.barras.find((barra) => barra.chave === "venda")?.saidas).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// A folha de um material (06-09-PLAN.md, Tarefa 1): o "Gasto por" (EST-20, D-08) e a entrada da
// ação que lê a folha.
// ---------------------------------------------------------------------------------------------

describe("textoGastoPor — onde o insumo é gasto pela ficha técnica (EST-20)", () => {
  it("dois produtos, separados por “ · ”, cada um com a quantidade e a unidade do insumo", () => {
    expect(
      textoGastoPor([
        { produto: "Café 200 ml", quantidade: "15", unidadeDoInsumo: "g" },
        { produto: "Café refil", quantidade: "30", unidadeDoInsumo: "g" },
      ]),
    ).toBe("Café 200 ml (15 g) · Café refil (30 g)");
  });

  it("um produto só mostra só ele, sem separador (zero-one-many)", () => {
    expect(textoGastoPor([{ produto: "Café 200 ml", quantidade: "15", unidadeDoInsumo: "g" }])).toBe(
      "Café 200 ml (15 g)",
    );
  });

  it("litro aparece “L” e a quantidade sai em pt-BR, sem zeros à direita", () => {
    expect(
      textoGastoPor([{ produto: "Leite vaporizado", quantidade: "0.150", unidadeDoInsumo: "l" }]),
    ).toBe("Leite vaporizado (0,15 L)");
  });

  it("nenhum produto dá texto vazio — a seção nem aparece (EST-20 · empty)", () => {
    expect(textoGastoPor([])).toBe("");
  });

  it("o nome do produto sai como gravado, nunca truncado (EST-20 · encoding)", () => {
    const longo = "Café coado na hora com leite vaporizado e canela ".repeat(2).trim();
    expect(textoGastoPor([{ produto: longo, quantidade: "15", unidadeDoInsumo: "g" }])).toBe(
      `${longo} (15 g)`,
    );
  });
});

describe("ordenarGastoPor — a ordem do “Gasto por” (EST-20 · ordering)", () => {
  it("ordena pelo nome do produto em pt-BR: “Água tônica” antes de “Café”", () => {
    const entrada = [
      { produto: "Café 200 ml", quantidade: "15", unidadeDoInsumo: "g" as const },
      { produto: "Água tônica", quantidade: "5", unidadeDoInsumo: "g" as const },
      { produto: "bolo de milho", quantidade: "20", unidadeDoInsumo: "g" as const },
    ];
    expect(ordenarGastoPor(entrada).map((linha) => linha.produto)).toEqual([
      "Água tônica",
      "bolo de milho",
      "Café 200 ml",
    ]);
  });

  it("não muta a lista recebida", () => {
    const entrada = [
      { produto: "Café", quantidade: "15", unidadeDoInsumo: "g" as const },
      { produto: "Água", quantidade: "5", unidadeDoInsumo: "g" as const },
    ];
    const copia = entrada.map((linha) => ({ ...linha }));
    ordenarGastoPor(entrada);
    expect(entrada).toEqual(copia);
  });
});

describe("esquemaLerMaterial — o pedido da folha do material", () => {
  const ITEM = "3f2c6a1e-8b4d-4c2a-9e1f-0a1b2c3d4e5f";

  it("aceita { itemId: uuid, limite: 50 }", () => {
    const resultado = esquemaLerMaterial.safeParse({ itemId: ITEM, limite: 50 });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ itemId: ITEM, limite: 50 });
  });

  it("aceita múltiplos de 50 até 1000", () => {
    expect(esquemaLerMaterial.parse({ itemId: ITEM, limite: 100 }).limite).toBe(100);
    expect(esquemaLerMaterial.parse({ itemId: ITEM, limite: 1000 }).limite).toBe(1000);
  });

  it("limite inválido, fora do passo ou acima do teto vira 50 (T-06-42)", () => {
    for (const limite of [undefined, null, "abc", "100", 0, -50, 75, 49.5, 1050, 5000, Number.NaN]) {
      expect(esquemaLerMaterial.parse({ itemId: ITEM, limite }).limite).toBe(50);
    }
  });

  it("recusa um id que não é uuid", () => {
    expect(esquemaLerMaterial.safeParse({ itemId: "abc", limite: 50 }).success).toBe(false);
  });
});

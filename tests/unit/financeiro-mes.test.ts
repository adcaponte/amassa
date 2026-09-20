import { describe, expect, it } from "vitest";

import {
  larguraDaRegua,
  resumoDoMes,
  type DocumentoParaMes,
  type LinhaDeDocumentoParaMes,
  type ParcelaPagaParaMes,
} from "@/lib/financeiro/mes";

// Fábricas com padrões sensatos — cada teste só passa os campos que importam para o fato sendo
// provado (mesmo estilo de `tests/unit/financeiro-extrato.test.ts`).
function linha(sobrescritas: Partial<LinhaDeDocumentoParaMes> = {}): LinhaDeDocumentoParaMes {
  return {
    grupo: "receita",
    area: "cafeteria",
    categoriaNome: "Bebidas e comidas",
    valorCentavos: 1000,
    ...sobrescritas,
  };
}

function documento(sobrescritas: Partial<DocumentoParaMes> = {}): DocumentoParaMes {
  return {
    data: "2026-06-15",
    tipo: "venda",
    cancelado: false,
    linhas: [linha()],
    ...sobrescritas,
  };
}

function parcelaPaga(sobrescritas: Partial<ParcelaPagaParaMes> = {}): ParcelaPagaParaMes {
  return {
    pagoEm: "2026-06-15",
    tipo: "venda",
    cancelado: false,
    forma: "pix",
    valorCentavos: 1000,
    taxaPontosBase: null,
    ...sobrescritas,
  };
}

describe("resumoDoMes", () => {
  it("venda de três linhas em áreas diferentes: Vendeu por área, Espaço com R$ 0,00, quatro áreas sempre presentes", () => {
    const doc = documento({
      linhas: [
        linha({ grupo: "receita", area: "cafeteria", categoriaNome: "Bebidas e comidas", valorCentavos: 800 }),
        linha({ grupo: "receita", area: "pecas", categoriaNome: "Peças prontas", valorCentavos: 22000 }),
        linha({ grupo: "receita", area: "loja", categoriaNome: "Materiais e papelaria", valorCentavos: 1400 }),
      ],
    });

    const resumo = resumoDoMes({ mes: "2026-06", documentos: [doc], parcelasPagas: [] });

    expect(resumo.areas.map((area) => area.area)).toEqual(["cafeteria", "espaco", "pecas", "loja"]);
    const porArea = new Map(resumo.areas.map((area) => [area.area, area]));
    expect(porArea.get("cafeteria")?.vendeuCentavos).toBe(800);
    expect(porArea.get("pecas")?.vendeuCentavos).toBe(22000);
    expect(porArea.get("loja")?.vendeuCentavos).toBe(1400);
    expect(porArea.get("espaco")?.vendeuCentavos).toBe(0);
  });

  it("despesa de custo da Loja: Custou da Loja; Deixou = Vendeu − Custou, podendo ser negativo", () => {
    const venda = documento({
      tipo: "venda",
      linhas: [linha({ grupo: "receita", area: "loja", valorCentavos: 500 })],
    });
    const despesa = documento({
      tipo: "despesa",
      linhas: [linha({ grupo: "custo", area: "loja", categoriaNome: "Mercadoria para revenda", valorCentavos: 800 })],
    });

    const resumo = resumoDoMes({ mes: "2026-06", documentos: [venda, despesa], parcelasPagas: [] });

    const loja = resumo.areas.find((area) => area.area === "loja");
    expect(loja?.custouCentavos).toBe(800);
    expect(loja?.deixouCentavos).toBe(500 - 800); // negativo
  });

  it("despesa de Aluguel entra no Geral por nome; duas despesas de Aluguel no mês somam numa linha", () => {
    const d1 = documento({
      tipo: "despesa",
      linhas: [linha({ grupo: "geral", area: "geral", categoriaNome: "Aluguel", valorCentavos: 1500 })],
    });
    const d2 = documento({
      tipo: "despesa",
      linhas: [linha({ grupo: "geral", area: "geral", categoriaNome: "Aluguel", valorCentavos: 200 })],
    });

    const resumo = resumoDoMes({ mes: "2026-06", documentos: [d1, d2], parcelasPagas: [] });

    const aluguel = resumo.geral.find((item) => item.nome === "Aluguel");
    expect(aluguel?.valorCentavos).toBe(1700);
    expect(resumo.geral.filter((item) => item.nome === "Aluguel")).toHaveLength(1);
  });

  it('parcela de venda paga no cartão no mês com taxa → "Taxa do cartão" no Geral; paga no mês seguinte não entra', () => {
    const pagaNoMes = parcelaPaga({ pagoEm: "2026-06-10", forma: "cartao", valorCentavos: 10000, taxaPontosBase: 350 });
    const pagaNoMesSeguinte = parcelaPaga({ pagoEm: "2026-07-01", forma: "cartao", valorCentavos: 5000, taxaPontosBase: 350 });

    const resumo = resumoDoMes({
      mes: "2026-06",
      documentos: [],
      parcelasPagas: [pagaNoMes, pagaNoMesSeguinte],
    });

    const taxa = resumo.geral.find((item) => item.nome === "Taxa do cartão");
    expect(taxa?.valorCentavos).toBe(350); // 3,5% de 10000 = 350, nunca a parcela de julho
  });

  it("linha de diferença: despesa +12 → Geral +12; despesa −10 → Geral −10; venda −5 → Geral +5; venda +5 → Geral −5", () => {
    const casos: { tipo: "venda" | "despesa"; valorCentavos: number; esperado: number }[] = [
      { tipo: "despesa", valorCentavos: 12, esperado: 12 },
      { tipo: "despesa", valorCentavos: -10, esperado: -10 },
      { tipo: "venda", valorCentavos: -5, esperado: 5 },
      { tipo: "venda", valorCentavos: 5, esperado: -5 },
    ];

    for (const caso of casos) {
      const doc = documento({
        tipo: caso.tipo,
        linhas: [
          linha({
            grupo: "geral",
            area: "geral",
            categoriaNome: "Juros, multas e descontos",
            valorCentavos: caso.valorCentavos,
          }),
        ],
      });
      const resumo = resumoDoMes({ mes: "2026-06", documentos: [doc], parcelasPagas: [] });
      const diferenca = resumo.geral.find((item) => item.nome === "Juros, multas e descontos");
      expect(diferenca?.valorCentavos, JSON.stringify(caso)).toBe(caso.esperado);
    }
  });

  it("veredito: deixou 1000 − geral 400 → sobrou 600; deixou 100 − geral 400 → faltou 300; zero → sobrou 0", () => {
    function comDeixouEGeral(deixouCentavos: number, geralCentavos: number) {
      const venda = documento({
        tipo: "venda",
        linhas: [linha({ grupo: "receita", area: "loja", valorCentavos: deixouCentavos })],
      });
      const despesa = documento({
        tipo: "despesa",
        linhas: [linha({ grupo: "geral", area: "geral", categoriaNome: "Aluguel", valorCentavos: geralCentavos })],
      });
      return resumoDoMes({ mes: "2026-06", documentos: [venda, despesa], parcelasPagas: [] });
    }

    const sobrou = comDeixouEGeral(1000, 400);
    expect(sobrou.veredicto).toBe("sobrou");
    expect(sobrou.resultadoCentavos).toBe(600);

    const faltou = comDeixouEGeral(100, 400);
    expect(faltou.veredicto).toBe("faltou");
    expect(faltou.resultadoCentavos).toBe(300);

    const zero = comDeixouEGeral(400, 400);
    expect(zero.veredicto).toBe("sobrou");
    expect(zero.resultadoCentavos).toBe(0);
  });

  it("dinheiro que se mexeu: entrou = líquido de venda paga no mês; saiu = despesa paga no mês; parcela de outro mês pago aqui entra só aqui", () => {
    const documentoDeMaio = documento({ data: "2026-05-01", tipo: "venda", linhas: [linha({ valorCentavos: 9999 })] });
    const parcelaDeMaioPagaEmJunho = parcelaPaga({ pagoEm: "2026-06-05", tipo: "venda", valorCentavos: 300 });
    const parcelaDespesaJunho = parcelaPaga({ pagoEm: "2026-06-06", tipo: "despesa", valorCentavos: 150 });

    const resumo = resumoDoMes({
      mes: "2026-06",
      documentos: [documentoDeMaio],
      parcelasPagas: [parcelaDeMaioPagaEmJunho, parcelaDespesaJunho],
    });

    expect(resumo.entrouCentavos).toBe(300);
    expect(resumo.saiuCentavos).toBe(150);
    // O documento de maio (mesmo pago em junho) não conta em "Vendeu" de nenhuma área em junho.
    expect(resumo.vendeuTotalCentavos).toBe(0);
  });

  it('fora: "Equipamento e obra" de despesa → −v; "Aporte dos sócios" de venda → +v; nenhum mexe no veredito', () => {
    const equipamento = documento({
      tipo: "despesa",
      linhas: [linha({ grupo: "fora", area: "geral", categoriaNome: "Equipamento e obra", valorCentavos: 2000 })],
    });
    const aporte = documento({
      tipo: "venda",
      linhas: [linha({ grupo: "fora", area: "geral", categoriaNome: "Aporte dos sócios", valorCentavos: 5000 })],
    });

    const resumo = resumoDoMes({ mes: "2026-06", documentos: [equipamento, aporte], parcelasPagas: [] });

    expect(resumo.fora.find((item) => item.nome === "Equipamento e obra")?.valorCentavos).toBe(-2000);
    expect(resumo.fora.find((item) => item.nome === "Aporte dos sócios")?.valorCentavos).toBe(5000);
    // Nenhum dos dois entrou em Vendeu/Custou/Geral — o veredito é 0 (sem nada mais no mês).
    expect(resumo.veredicto).toBe("sobrou");
    expect(resumo.resultadoCentavos).toBe(0);
  });

  it("documento cancelado não entra em nada; dia 31 conta no mês, dia 1 do mês seguinte não", () => {
    const cancelado = documento({
      cancelado: true,
      linhas: [linha({ grupo: "receita", area: "loja", valorCentavos: 99999 })],
    });
    const ultimoDia = documento({ data: "2026-06-30", linhas: [linha({ area: "loja", valorCentavos: 100 })] });
    const primeiroDiaSeguinte = documento({ data: "2026-07-01", linhas: [linha({ area: "loja", valorCentavos: 200 })] });

    const resumo = resumoDoMes({
      mes: "2026-06",
      documentos: [cancelado, ultimoDia, primeiroDiaSeguinte],
      parcelasPagas: [],
    });

    const loja = resumo.areas.find((area) => area.area === "loja");
    expect(loja?.vendeuCentavos).toBe(100); // só o de 30/06
  });

  it("mês totalmente vazio: as quatro áreas zeradas, Geral e Fora vazios, veredito sobrou R$ 0,00", () => {
    const resumo = resumoDoMes({ mes: "2026-06", documentos: [], parcelasPagas: [] });

    expect(resumo.areas.every((area) => area.vendeuCentavos === 0 && area.custouCentavos === 0)).toBe(true);
    expect(resumo.geral).toEqual([]);
    expect(resumo.fora).toEqual([]);
    expect(resumo.veredicto).toBe("sobrou");
    expect(resumo.resultadoCentavos).toBe(0);
  });
});

describe("larguraDaRegua", () => {
  it("percentuais relativos a max(deixou total, geral, 1)", () => {
    expect(larguraDaRegua(500, 1000, 400)).toBe(50); // 500 / 1000 * 100
    expect(larguraDaRegua(400, 1000, 400)).toBe(40); // Geral / max(1000,400,1)
  });

  it("área com deixou negativo → 0%", () => {
    expect(larguraDaRegua(-300, 1000, 400)).toBe(0);
  });

  it("mês totalmente vazio (max com o piso de 1) não divide por zero", () => {
    expect(larguraDaRegua(0, 0, 0)).toBe(0);
  });
});

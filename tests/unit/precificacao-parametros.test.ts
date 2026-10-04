import { describe, expect, it } from "vitest";

import {
  CATALOGO_DE_PARAMETROS,
  chavesQueFaltam,
  inteiroDaUnidade,
  semSeloDoParametro,
  valorNaUnidade,
  vigenteEm,
  type LinhaDeParametro,
} from "@/lib/precificacao/parametros";
import {
  FRASE_REGUA_AUSENTE,
  FRASE_REGUA_MAIOR_QUE_ZERO,
  FRASE_REGUA_P_MENOR_QUE_M,
} from "@/lib/precificacao/textos";
import { dicaDaReguaNosParametros } from "@/lib/queimas/textos";

// 04.5-01-PLAN.md, Tarefa 2 — o catálogo fechado de parâmetros, a conversão de unidade exibida
// ↔ inteiro guardado, e a leitura do "vigente na data".

describe("CATALOGO_DE_PARAMETROS", () => {
  // Fase 06.4 (D-03): as 18 do cálculo + as duas da régua P · M · G das Queimas.
  it("tem exatamente 20 entradas", () => {
    expect(CATALOGO_DE_PARAMETROS).toHaveLength(20);
  });

  it("os grupos, na ordem do catálogo, terminam em Queimas", () => {
    expect([...new Set(CATALOGO_DE_PARAMETROS.map((item) => item.grupo))]).toEqual([
      "Material",
      "Trabalho",
      "Forno",
      "Perda",
      "No preço",
      "Queimas",
    ]);
  });

  it("as duas da régua são em cm, escala 1000, e as ÚNICAS marcadas foraDoCalculo", () => {
    const fora = CATALOGO_DE_PARAMETROS.filter((item) => item.foraDoCalculo === true);
    expect(fora.map((item) => item.chave)).toEqual(["queima_regua_p_ate", "queima_regua_m_ate"]);
    for (const item of fora) {
      expect(item.grupo).toBe("Queimas");
      expect(item.unidade).toBe("cm");
      expect(item.escala).toBe(1000);
    }
    expect(fora.map((item) => item.rotulo)).toEqual([
      "P (pequena) vai até",
      "M (média) vai até — acima disso é G",
    ]);
  });

  it("semSeloDoParametro: só a régua não tem o selo estimado/medido", () => {
    expect(semSeloDoParametro("queima_regua_p_ate")).toBe(true);
    expect(semSeloDoParametro("queima_regua_m_ate")).toBe(true);
    expect(semSeloDoParametro("forno_fator_biscoito")).toBe(false);
    expect(semSeloDoParametro("material_argila")).toBe(false);
  });

  it("a taxa do cartão NÃO é uma chave de parâmetro (D-16)", () => {
    const chaves = CATALOGO_DE_PARAMETROS.map((item) => item.chave);
    expect(chaves.some((chave) => chave.includes("taxa"))).toBe(false);
  });

  it("cada entrada declara grupo, rótulo, unidade e escala", () => {
    for (const item of CATALOGO_DE_PARAMETROS) {
      expect(["Material", "Trabalho", "Forno", "Perda", "No preço", "Queimas"]).toContain(item.grupo);
      expect(item.rotulo.length).toBeGreaterThan(0);
      expect(item.unidade.length).toBeGreaterThan(0);
      expect(item.escala).toBeGreaterThan(0);
    }
  });

  it("nenhuma chave se repete", () => {
    const chaves = CATALOGO_DE_PARAMETROS.map((item) => item.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("inteiroDaUnidade / valorNaUnidade — inversas", () => {
  it.each([
    ["material_argila", 10, 1000], // R$ 10,00/kg ↔ 1000 centavos
    ["preco_lucro", 3.5, 350], // 3,5% ↔ 350 pontos-base
    ["forno_largura_util", 35, 35000], // 35 cm ↔ 35000 milésimos
    ["forno_fator_biscoito", 1.8, 1800], // 1,8× ↔ 1800 milésimos
    ["forno_kwh_biscoito", 18, 18000], // 18 kWh ↔ 18000 milésimos
  ] as const)("%s: %s na unidade ↔ %s inteiro", (chave, naUnidade, inteiro) => {
    expect(inteiroDaUnidade(chave, naUnidade)).toBe(inteiro);
    expect(valorNaUnidade(chave, inteiro)).toBeCloseTo(naUnidade, 6);
  });

  it("lança para uma chave desconhecida", () => {
    // @ts-expect-error — chave fora da união fechada, de propósito.
    expect(() => inteiroDaUnidade("chave_inventada", 10)).toThrow();
  });
});

describe("vigenteEm", () => {
  const historico: LinhaDeParametro[] = [
    { valorInteiro: 900, medido: false, vigenteDesde: "2026-01-01" },
    { valorInteiro: 1000, medido: false, vigenteDesde: "2026-06-01" },
    { valorInteiro: 1100, medido: true, vigenteDesde: "2027-01-01" }, // linha futura
  ];

  it("devolve a linha de maior vigenteDesde menor ou igual à data pedida", () => {
    expect(vigenteEm(historico, "2026-09-26")).toEqual({
      valorInteiro: 1000,
      medido: false,
      vigenteDesde: "2026-06-01",
    });
  });

  it("na data exata de uma vigência, escolhe aquela linha", () => {
    expect(vigenteEm(historico, "2026-06-01")?.valorInteiro).toBe(1000);
  });

  it("nunca escolhe uma linha futura", () => {
    expect(vigenteEm(historico, "2026-03-01")?.valorInteiro).toBe(900);
  });

  it("sem nenhuma linha vigente ainda (data antes de tudo), devolve null", () => {
    expect(vigenteEm(historico, "2025-12-31")).toBeNull();
  });

  it("histórico vazio devolve null", () => {
    expect(vigenteEm([], "2026-09-26")).toBeNull();
  });
});

// Fase 06.4, plano 03 — a régua fora do cálculo: `parametrosVigentes` decide o `faltando` por esta
// função pura, que só olha as 18 chaves do cálculo. É a prova, sem banco, de que Orçamentos,
// Produção, Estoque, Cadastros e o Financeiro continuam em `ok` antes da 0030 (régua ausente).
describe("chavesQueFaltam", () => {
  const DO_CALCULO = CATALOGO_DE_PARAMETROS.filter((item) => item.foraDoCalculo !== true).map(
    (item) => item.chave,
  );

  it("as 18 do cálculo são as 18 de sempre", () => {
    expect(DO_CALCULO).toHaveLength(18);
    expect(DO_CALCULO.some((chave) => chave.startsWith("queima_"))).toBe(false);
  });

  it("com as 18 do cálculo e sem a régua, nada falta", () => {
    expect(chavesQueFaltam(new Set(DO_CALCULO))).toEqual([]);
  });

  it("sem a argila, falta só a argila", () => {
    expect(
      chavesQueFaltam(new Set(DO_CALCULO.filter((chave) => chave !== "material_argila"))),
    ).toEqual(["material_argila"]);
  });

  it("com as 20, nada falta", () => {
    expect(chavesQueFaltam(new Set(CATALOGO_DE_PARAMETROS.map((item) => item.chave)))).toEqual([]);
  });

  it("vazio → as 18, na ordem do catálogo, sem nenhuma da régua", () => {
    expect(chavesQueFaltam(new Set())).toEqual(DO_CALCULO);
  });
});

describe("a régua em Parâmetros — frases (06.4-UI-SPEC.md)", () => {
  it("a dica com a régua de hoje por extenso", () => {
    expect(dicaDaReguaNosParametros({ pAte: 10000, mAte: 25000 })).toBe(
      "Régua de hoje: P até 10 cm · M de 10 a 25 cm · G maior que 25 cm. Vale para internas e externas; a contagem é no olho, pela maior medida da peça. Mudar a régua não muda as contagens já feitas.",
    );
    expect(dicaDaReguaNosParametros({ pAte: 12500, mAte: 30000 })).toContain(
      "P até 12,5 cm · M de 12,5 a 30 cm · G maior que 30 cm.",
    );
  });

  it("as recusas e a régua ausente", () => {
    expect(FRASE_REGUA_P_MENOR_QUE_M).toBe("O limite do P precisa ser menor que o do M.");
    expect(FRASE_REGUA_MAIOR_QUE_ZERO).toBe("A medida precisa ser maior que zero.");
    expect(FRASE_REGUA_AUSENTE).toBe(
      "A régua P · M · G ainda não está no banco. Ela chega com a atualização das Queimas — até lá, as queimas registram sem a folha de contagem.",
    );
  });
});

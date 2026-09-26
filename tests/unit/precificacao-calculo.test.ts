import { describe, expect, it } from "vitest";

import {
  arredondarBonito,
  calcularPeca,
  farolDoPreco,
  type ParametrosDoCalculo,
} from "@/lib/precificacao/calculo";
import type { CabemNoForno } from "@/lib/precificacao/forno";

// 04.5-01-PLAN.md, Tarefa 2 — o cálculo de precificação (BRIEFING §2): material, trabalho,
// queima, direto, custo, mínimo e zero, sempre em centavos inteiros. Divisor ≤ 0 (na prática,
// ≤ 500 pontos-base) é erro de parâmetro: a função RECUSA, nunca aplica o piso do protótipo.

// Parâmetros ilustrativos do protótipo (`PDEF`, 04.5-RESEARCH.md/BRIEFING §2) — os mesmos que a
// semente de `db/migrations/0019` grava, todos "estimado".
const PARAMETROS_ILUSTRATIVOS: ParametrosDoCalculo = {
  argilaReaisPorKgCentavos: 1000, // R$ 10,00/kg
  esmalteReaisPorKgCentavos: 8400, // R$ 84,00/kg
  horaTrabalhoCentavos: 3500, // R$ 35,00/h
  tarifaEnergiaCentavos: 78, // R$ 0,78/kWh
  kwhBiscoitoMilesimos: 18000, // 18 kWh
  kwhEsmalteMilesimos: 28000, // 28 kWh
  desgastePorFornadaCentavos: 1200, // R$ 12,00
  perdaPontosBase: 1500, // 15%
  lucroPontosBase: 1500, // 15%
  folgaNegociacaoPontosBase: 1000, // 10%
  impostoPontosBase: 0, // MEI: 0% (D-10)
  comissaoGaleriaPontosBase: 4000, // 40%
};

const TAXA_CARTAO_PONTOS_BASE = 350; // 3,5%, lida da parte 1 — D-16

// Caneca 300 ml do protótipo: 450 g argila, 60 g esmalte, 0,6 h, embalagem R$ 3,00.
const FICHA_CANECA = {
  argilaMiligramas: 450_000,
  esmalteMiligramas: 60_000,
  horasMilesimos: 600,
  embalagemCentavos: 300,
};

// Cabem calculados a partir das medidas da caneca (120×90×100 mm) no forno de referência
// (precificacao-forno.test.ts) — copiados aqui como valor fixo para não acoplar os dois módulos
// dentro do teste de cálculo (o próprio `lib/orcamentos/acoes.ts`, plano 04, é quem de fato
// encadeia `quantasCabem` → `calcularPeca`).
const CABEM_DA_CANECA: CabemNoForno = {
  cabe: true,
  porPrateleira: 6,
  niveis: 2,
  esmalte: 12,
  biscoito: 21,
  esmalteAutomatico: true,
  biscoitoAutomatico: true,
};

const NAO_CABE: CabemNoForno = {
  cabe: false,
  porPrateleira: 0,
  niveis: 0,
  esmalte: 0,
  biscoito: 0,
  esmalteAutomatico: true,
  biscoitoAutomatico: true,
};

describe("calcularPeca", () => {
  it("calcula material, trabalho, queima, direto, custo, mínimo e zero — canal direto", () => {
    const resultado = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros: PARAMETROS_ILUSTRATIVOS,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });

    expect(resultado).toEqual({
      ok: true,
      materialCentavos: 954, // 0,45kg×R$10 + 0,06kg×R$84 = R$4,50 + R$5,04
      trabalhoCentavos: 2100, // 0,6h × R$35
      queimaCentavos: 406, // ⌊2604/21⌋ + ⌊3384/12⌋ = 124 + 282
      embalagemCentavos: 300,
      diretoCentavos: 3760,
      perdaCentavos: 664, // custo − direto
      custoCentavos: 4424,
      minimoCentavos: 6187,
      zeroCentavos: 4584,
    });
  });

  it("mínimo ≥ custo e zero ≤ mínimo", () => {
    const resultado = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros: PARAMETROS_ILUSTRATIVOS,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });
    if (!resultado.ok) throw new Error("esperava ok:true");

    expect(resultado.minimoCentavos).toBeGreaterThanOrEqual(resultado.custoCentavos);
    expect(resultado.zeroCentavos).toBeLessThanOrEqual(resultado.minimoCentavos);
  });

  it("canal galeria tem mínimo maior que canal direto (a comissão soma ao divisor)", () => {
    const direto = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros: PARAMETROS_ILUSTRATIVOS,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });
    const galeria = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros: PARAMETROS_ILUSTRATIVOS,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "galeria",
    });
    if (!direto.ok || !galeria.ok) throw new Error("esperava ok:true nos dois");

    expect(galeria.minimoCentavos).toBe(14044);
    expect(galeria.minimoCentavos).toBeGreaterThan(direto.minimoCentavos);
  });

  it("ficha que não cabe no forno e não informou contagem: ok false, motivo nao-cabe", () => {
    const resultado = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: NAO_CABE,
      parametros: PARAMETROS_ILUSTRATIVOS,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });

    expect(resultado).toEqual({ ok: false, motivo: "nao-cabe" });
  });

  it("divisor inválido quando lucro+folga+imposto+taxa+comissão somam 9500 pontos-base ou mais", () => {
    const parametros: ParametrosDoCalculo = {
      ...PARAMETROS_ILUSTRATIVOS,
      lucroPontosBase: 4000,
      folgaNegociacaoPontosBase: 3000,
      impostoPontosBase: 1000,
      comissaoGaleriaPontosBase: 1500,
    };
    // 4000 + 3000 + 1000 + 350(taxa) + 1500(comissão galeria) = 9850 ≥ 9500.
    const resultado = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "galeria",
    });

    expect(resultado).toEqual({ ok: false, motivo: "divisor-invalido" });
  });

  it("divisor inválido (preço zero) quando imposto+taxa sozinhos somam 9500 ou mais — mesmo com lucro/folga/comissão em 0", () => {
    const parametros: ParametrosDoCalculo = {
      ...PARAMETROS_ILUSTRATIVOS,
      lucroPontosBase: 0,
      folgaNegociacaoPontosBase: 0,
      impostoPontosBase: 9000,
      comissaoGaleriaPontosBase: 0,
    };
    // imposto(9000) + taxa(500) = 9500 — o preço zero tem divisor próprio, mas aqui o divisor do
    // mínimo (10000 − 9500 = 500) também bate no limite: os dois recusam pelo mesmo motivo.
    const resultado = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros,
      taxaCartaoPontosBase: 500,
      canal: "direto",
    });

    expect(resultado).toEqual({ ok: false, motivo: "divisor-invalido" });
  });

  it("nunca aplica piso — nenhum resultado com divisor inválido carrega número nenhum além do motivo", () => {
    const parametros: ParametrosDoCalculo = {
      ...PARAMETROS_ILUSTRATIVOS,
      lucroPontosBase: 5000,
      folgaNegociacaoPontosBase: 5000,
    };
    const resultado = calcularPeca({
      ficha: FICHA_CANECA,
      cabem: CABEM_DA_CANECA,
      parametros,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });

    expect(resultado.ok).toBe(false);
    expect(Object.keys(resultado)).toEqual(["ok", "motivo"]);
  });
});

describe("farolDoPreco", () => {
  const MINIMO = 6187;
  const ZERO = 4584;

  it("null sem preço praticado", () => {
    expect(farolDoPreco(null, MINIMO, ZERO)).toBeNull();
  });

  it("verde quando o preço é exatamente o mínimo, e continua verde acima dele", () => {
    expect(farolDoPreco(MINIMO, MINIMO, ZERO)).toBe("verde");
    expect(farolDoPreco(MINIMO + 1, MINIMO, ZERO)).toBe("verde");
  });

  it("amarelo logo abaixo do mínimo, e ainda amarelo exatamente no zero", () => {
    expect(farolDoPreco(MINIMO - 1, MINIMO, ZERO)).toBe("amarelo");
    expect(farolDoPreco(ZERO, MINIMO, ZERO)).toBe("amarelo");
  });

  it("vermelho logo abaixo do zero", () => {
    expect(farolDoPreco(ZERO - 1, MINIMO, ZERO)).toBe("vermelho");
  });
});

describe("arredondarBonito", () => {
  it("até R$ 50, arredonda para o real inteiro acima", () => {
    expect(arredondarBonito(4650)).toBe(4700); // R$ 46,50 → R$ 47
    expect(arredondarBonito(101)).toBe(200); // R$ 1,01 → R$ 2
  });

  it("um valor já redondo (até R$ 50) não muda", () => {
    expect(arredondarBonito(5000)).toBe(5000); // R$ 50,00
    expect(arredondarBonito(4700)).toBe(4700); // R$ 47,00
  });

  it("acima de R$ 50, arredonda para o múltiplo de 5 reais acima", () => {
    expect(arredondarBonito(5200)).toBe(5500); // R$ 52,00 → R$ 55
    expect(arredondarBonito(6187)).toBe(6500); // R$ 61,87 → R$ 65
  });

  it("um múltiplo de 5 reais já redondo (acima de R$ 50) não muda", () => {
    expect(arredondarBonito(5500)).toBe(5500); // R$ 55,00
  });
});

import { describe, expect, it } from "vitest";

import {
  arredondarBonito,
  calcularPeca,
  farolDoPreco,
  parametrosDoPrecoFazemSentido,
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

  it("canal galeria = mínimo direto ÷ (1 − comissão) — D-16, 06/10/2026", () => {
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

    // 61,87 ÷ (1 − 0,40) = 103,12. Antes da D-16 (comissão no mesmo divisor) era R$ 140,44.
    expect(galeria.minimoCentavos).toBe(10312);
    expect(galeria.minimoCentavos).toBe(Math.round((direto.minimoCentavos * 10000) / 6000));
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

  it("divisor inválido nos dois canais quando lucro+folga+imposto+taxa somam 9500 pontos-base ou mais", () => {
    const parametros: ParametrosDoCalculo = {
      ...PARAMETROS_ILUSTRATIVOS,
      lucroPontosBase: 5000,
      folgaNegociacaoPontosBase: 3150,
      impostoPontosBase: 1000,
      comissaoGaleriaPontosBase: 0,
    };
    // 5000 + 3150 + 1000 + 350(taxa) = 9500 → divisor 500, não maior que o limite.
    for (const canal of ["direto", "galeria"] as const) {
      const resultado = calcularPeca({
        ficha: FICHA_CANECA,
        cabem: CABEM_DA_CANECA,
        parametros,
        taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
        canal,
      });
      expect(resultado).toEqual({ ok: false, motivo: "divisor-invalido" });
    }
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

// 06.5-29-PLAN.md — D-16. O dono respondeu "b-sobre-o-direto" em 06/10/2026: o preço mínimo em
// galeria ou consignado é o mínimo direto ÷ (1 − comissão da galeria), e o ateliê recebe o mesmo que
// na venda direta. A conta antiga (comissão no mesmo divisor do lucro) fica aqui só como
// referência, para provar que o canal direto não mudou e que o da galeria mudou.
describe("calcularPeca — galeria sobre o direto (D-16)", () => {
  function minimoAntigo(custoCentavos: number, somaPontosBase: number): number {
    return Math.round((custoCentavos * 10000) / (10000 - somaPontosBase));
  }

  // Uma ficha cujo custo é exatamente R$ 46,49 — o custo da caneca que o Cowork abriu (achado 24,
  // deduzido dos dois preços na tela; ver 06.5-CONTA-DA-GALERIA.md): sem material, trabalho,
  // queima nem perda, só a embalagem.
  const FICHA_DE_CUSTO_4649 = {
    argilaMiligramas: 0,
    esmalteMiligramas: 0,
    horasMilesimos: 0,
    embalagemCentavos: 4649,
  };
  const SEM_QUEIMA_NEM_PERDA: ParametrosDoCalculo = {
    ...PARAMETROS_ILUSTRATIVOS,
    tarifaEnergiaCentavos: 0,
    desgastePorFornadaCentavos: 0,
    perdaPontosBase: 0,
  };

  function calcular(parametros: ParametrosDoCalculo, taxa: number, canal: "direto" | "galeria") {
    return calcularPeca({
      ficha: FICHA_DE_CUSTO_4649,
      cabem: CABEM_DA_CANECA,
      parametros,
      taxaCartaoPontosBase: taxa,
      canal,
    });
  }

  it("a caneca do achado 24: direto R$ 101,07 e comissão 40 % → galeria R$ 168,45 (era R$ 774,83)", () => {
    // Lucro + folga + imposto + taxa = 54 % (a divisão entre eles é inventada; só a soma importa).
    const parametros: ParametrosDoCalculo = {
      ...SEM_QUEIMA_NEM_PERDA,
      lucroPontosBase: 3000,
      folgaNegociacaoPontosBase: 2000,
      impostoPontosBase: 0,
      comissaoGaleriaPontosBase: 4000,
    };
    const direto = calcular(parametros, 400, "direto");
    const galeria = calcular(parametros, 400, "galeria");
    if (!direto.ok || !galeria.ok) throw new Error("esperava ok:true nos dois");

    expect(direto.custoCentavos).toBe(4649);
    expect(direto.minimoCentavos).toBe(10107);
    expect(galeria.minimoCentavos).toBe(16845);
    // O que o ateliê recebe na galeria: 168,45 − 40 % = 101,07, o mesmo da venda direta.
    expect(Math.round(galeria.minimoCentavos * 0.6)).toBe(direto.minimoCentavos);
    // A conta de antes da D-16 dava os R$ 774,83 que o Cowork viu.
    expect(minimoAntigo(4649, 5400 + 4000)).toBe(77483);
    // O resto do resultado da galeria é o do direto: custo, zero e as fatias não mudam.
    expect({ ...galeria, minimoCentavos: 0 }).toEqual({ ...direto, minimoCentavos: 0 });
  });

  it("com os parâmetros de fábrica (semente 0019, taxa 0 %): direto R$ 61,99 e galeria R$ 103,32 (era R$ 132,83)", () => {
    const direto = calcular(SEM_QUEIMA_NEM_PERDA, 0, "direto");
    const galeria = calcular(SEM_QUEIMA_NEM_PERDA, 0, "galeria");
    if (!direto.ok || !galeria.ok) throw new Error("esperava ok:true nos dois");

    expect(direto.minimoCentavos).toBe(6199); // 46,49 ÷ 0,75
    expect(galeria.minimoCentavos).toBe(10332); // 61,99 ÷ 0,60
    expect(minimoAntigo(4649, 2500 + 4000)).toBe(13283);
  });

  it("o canal direto é o de antes da D-16 e não depende da comissão, em qualquer combinação", () => {
    for (const lucro of [0, 1500, 3000, 6000])
      for (const folga of [0, 1000, 2500])
        for (const taxa of [0, 350, 499])
          for (const comissao of [0, 4000, 9000, 9500, 12000]) {
            const parametros: ParametrosDoCalculo = {
              ...PARAMETROS_ILUSTRATIVOS,
              lucroPontosBase: lucro,
              folgaNegociacaoPontosBase: folga,
              comissaoGaleriaPontosBase: comissao,
            };
            const direto = calcularPeca({
              ficha: FICHA_CANECA,
              cabem: CABEM_DA_CANECA,
              parametros,
              taxaCartaoPontosBase: taxa,
              canal: "direto",
            });
            const diretoSemComissao = calcularPeca({
              ficha: FICHA_CANECA,
              cabem: CABEM_DA_CANECA,
              parametros: { ...parametros, comissaoGaleriaPontosBase: 0 },
              taxaCartaoPontosBase: taxa,
              canal: "direto",
            });
            if (!direto.ok) throw new Error("esperava ok:true no direto");
            expect(direto).toEqual(diretoSemComissao);
            expect(direto.minimoCentavos).toBe(
              minimoAntigo(direto.custoCentavos, lucro + folga + parametros.impostoPontosBase + taxa),
            );
          }
  });

  it("comissão de 95 % ou mais: a galeria recusa (a tela mostra “—”) e o direto continua calculando", () => {
    for (const comissao of [9500, 10000, 12000]) {
      const parametros = { ...SEM_QUEIMA_NEM_PERDA, comissaoGaleriaPontosBase: comissao };
      expect(calcular(parametros, 0, "galeria")).toEqual({ ok: false, motivo: "divisor-invalido" });
      expect(calcular(parametros, 0, "direto").ok).toBe(true);
    }
    // 94,99 % ainda fecha: 10000 − 9499 = 501 pontos-base, acima do limite.
    const noLimite = calcular({ ...SEM_QUEIMA_NEM_PERDA, comissaoGaleriaPontosBase: 9499 }, 0, "galeria");
    expect(noLimite.ok).toBe(true);
  });

  it("lucro + folga + imposto + taxa e comissão somando mais de 95 % não travam mais a galeria", () => {
    // Com a regra antiga, 54 % + 42 % = 96 % recusava; agora cada divisor fecha sozinho.
    const parametros: ParametrosDoCalculo = {
      ...SEM_QUEIMA_NEM_PERDA,
      lucroPontosBase: 3000,
      folgaNegociacaoPontosBase: 2000,
      comissaoGaleriaPontosBase: 4200,
    };
    const galeria = calcular(parametros, 400, "galeria");
    if (!galeria.ok) throw new Error("esperava ok:true");
    expect(galeria.minimoCentavos).toBe(Math.round((10107 * 10000) / 5800)); // 101,07 ÷ 0,58
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

// 04.5-02-PLAN.md, Tarefa 3 — o mesmo limite de divisor de `calcularPeca`, exposto para a tela de
// Parâmetros avisar ANTES de existir qualquer ficha (D-11).
describe("parametrosDoPrecoFazemSentido", () => {
  it("os parâmetros ilustrativos da semente fazem sentido", () => {
    expect(
      parametrosDoPrecoFazemSentido(PARAMETROS_ILUSTRATIVOS, TAXA_CARTAO_PONTOS_BASE),
    ).toBe(true);
  });

  it("lucro + folga + imposto + taxa chegando a 95% não fazem sentido", () => {
    expect(
      parametrosDoPrecoFazemSentido(
        {
          lucroPontosBase: 4000,
          folgaNegociacaoPontosBase: 3000,
          impostoPontosBase: 2150,
          comissaoGaleriaPontosBase: 0,
        },
        350, // soma 9500 → divisor 500
      ),
    ).toBe(false);
  });

  it("a comissão sozinha chegando a 95% não faz sentido (a galeria recusaria) — D-16", () => {
    expect(
      parametrosDoPrecoFazemSentido(
        { lucroPontosBase: 0, folgaNegociacaoPontosBase: 0, impostoPontosBase: 0, comissaoGaleriaPontosBase: 9500 },
        0,
      ),
    ).toBe(false);
  });

  it("desde a D-16 a comissão não soma com o resto: 54% + 42% faz sentido", () => {
    expect(
      parametrosDoPrecoFazemSentido(
        {
          lucroPontosBase: 3000,
          folgaNegociacaoPontosBase: 2000,
          impostoPontosBase: 0,
          comissaoGaleriaPontosBase: 4200,
        },
        400,
      ),
    ).toBe(true);
  });

  it("exatamente no limite (divisor = 500 pontos-base) também não faz sentido", () => {
    expect(
      parametrosDoPrecoFazemSentido(
        {
          lucroPontosBase: 5000,
          folgaNegociacaoPontosBase: 0,
          impostoPontosBase: 0,
          comissaoGaleriaPontosBase: 0,
        },
        4500, // soma 9500 → divisor 500, não maior que o limite
      ),
    ).toBe(false);
  });
});

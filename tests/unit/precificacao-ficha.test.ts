import { describe, expect, it } from "vitest";

import type { ParametrosDoCalculo, ResultadoDoCalculo } from "@/lib/precificacao/calculo";
import { calcularPeca, farolDoPreco } from "@/lib/precificacao/calculo";
import type { CabemNoForno } from "@/lib/precificacao/forno";
import {
  FRASE_NOME_OBRIGATORIO,
  FRASE_NOME_MUITO_LONGO,
  FRASE_SEM_CATEGORIA_DE_VENDA,
  camposCopiaveisDaFicha,
  paraContagemInformada,
  paraFichaDeCalculo,
  paraMedidasDaPeca,
  resultadoDaFicha,
  validarFicha,
  type CamposCopiaveisDaFicha,
  type FichaEmEdicao,
} from "@/lib/precificacao/ficha";
import { formatarCentimetros, formatarGramas, formatarHoras } from "@/lib/precificacao/formato";

// 04.5-04-PLAN.md, Tarefa 1 — a regra da ficha (D-18/D-19/D-11/D-12) e a ponte para
// `calcularPeca`/`quantasCabem`. Os mesmos números de referência de
// `tests/unit/precificacao-calculo.test.ts` (a "Caneca 300 ml" do protótipo) — nenhum dado real
// de peça ou preço do ateliê entra aqui.

const PARAMETROS_ILUSTRATIVOS: ParametrosDoCalculo = {
  argilaReaisPorKgCentavos: 1000,
  esmalteReaisPorKgCentavos: 8400,
  horaTrabalhoCentavos: 3500,
  tarifaEnergiaCentavos: 78,
  kwhBiscoitoMilesimos: 18000,
  kwhEsmalteMilesimos: 28000,
  desgastePorFornadaCentavos: 1200,
  perdaPontosBase: 1500,
  lucroPontosBase: 1500,
  folgaNegociacaoPontosBase: 1000,
  impostoPontosBase: 0,
  comissaoGaleriaPontosBase: 4000,
};
const TAXA_CARTAO_PONTOS_BASE = 350;

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

const CABEM_INFORMADO: CabemNoForno = {
  cabe: true,
  porPrateleira: 0,
  niveis: 0,
  esmalte: 5,
  biscoito: 9,
  esmalteAutomatico: false,
  biscoitoAutomatico: false,
};

function fichaBase(sobrescrever: Partial<FichaEmEdicao> = {}): FichaEmEdicao {
  return {
    nome: "Caneca 300 ml",
    argilaMiligramas: 450_000,
    esmalteMiligramas: 60_000,
    horasMilesimos: 600,
    larguraMm: 120,
    profundidadeMm: 90,
    alturaMm: 100,
    embalagemCentavos: 300,
    cabemBiscoitoInformado: null,
    cabemEsmalteInformado: null,
    precoMercadoCentavos: null,
    precoPraticadoCentavos: null,
    exclusiva: false,
    categoriaVendaId: "11111111-1111-1111-1111-111111111111",
    ...sobrescrever,
  };
}

describe("validarFicha", () => {
  it("ficha com nome, medidas e horas válidas, não exclusiva, categoria e preço praticado — válida", () => {
    const resultado = validarFicha(fichaBase({ precoPraticadoCentavos: 9500 }));
    expect(resultado).toEqual({ ok: true });
  });

  it("nome em branco recusa com 'Dê um nome à peça.'", () => {
    expect(validarFicha(fichaBase({ nome: "" }))).toEqual({ ok: false, erro: FRASE_NOME_OBRIGATORIO });
  });

  it("nome só com espaços recusa com a mesma frase", () => {
    expect(validarFicha(fichaBase({ nome: "   " }))).toEqual({
      ok: false,
      erro: FRASE_NOME_OBRIGATORIO,
    });
  });

  it("nome com 121 pontos de código recusa dizendo para encurtar", () => {
    const nomeGrande = "a".repeat(121);
    expect(validarFicha(fichaBase({ nome: nomeGrande }))).toEqual({
      ok: false,
      erro: FRASE_NOME_MUITO_LONGO,
    });
  });

  it("nome com exatamente 120 pontos de código é aceito", () => {
    const nomeNoLimite = "a".repeat(120);
    expect(validarFicha(fichaBase({ nome: nomeNoLimite }))).toEqual({ ok: true });
  });

  it("ficha não exclusiva sem categoria de venda recusa dizendo o que falta", () => {
    expect(validarFicha(fichaBase({ categoriaVendaId: null }))).toEqual({
      ok: false,
      erro: FRASE_SEM_CATEGORIA_DE_VENDA,
    });
  });

  it("ficha exclusiva com categoria escolhida — a categoria é ignorada, sem erro", () => {
    const resultado = validarFicha(fichaBase({ exclusiva: true, categoriaVendaId: "algo" }));
    expect(resultado).toEqual({ ok: true });
  });

  it("ficha exclusiva sem categoria nenhuma — também válida", () => {
    expect(validarFicha(fichaBase({ exclusiva: true, categoriaVendaId: null }))).toEqual({
      ok: true,
    });
  });

  it.each([
    ["argilaMiligramas", -1],
    ["esmalteMiligramas", -1],
    ["horasMilesimos", -1],
    ["larguraMm", -1],
    ["profundidadeMm", -1],
    ["alturaMm", -1],
    ["embalagemCentavos", -1],
  ] as const)("%s negativo recusa com a frase do campo", (campo, valor) => {
    const resultado = validarFicha(fichaBase({ [campo]: valor } as Partial<FichaEmEdicao>));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("não pode ser negativo");
    }
  });

  it("medida acima do teto (peça de 10 metros) recusa dizendo que o valor parece errado", () => {
    const resultado = validarFicha(fichaBase({ larguraMm: 10_000 }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("parece errado");
    }
  });

  it("medida de 3000 mm (3 m) no limite ainda é aceita", () => {
    expect(validarFicha(fichaBase({ larguraMm: 3000 }))).toEqual({ ok: true });
  });
});

describe("paraFichaDeCalculo / paraMedidasDaPeca / paraContagemInformada — a ponte", () => {
  it("paraFichaDeCalculo extrai só os quatro campos que calcularPeca usa", () => {
    expect(paraFichaDeCalculo(fichaBase())).toEqual({
      argilaMiligramas: 450_000,
      esmalteMiligramas: 60_000,
      horasMilesimos: 600,
      embalagemCentavos: 300,
    });
  });

  it("paraMedidasDaPeca extrai as três medidas", () => {
    expect(paraMedidasDaPeca(fichaBase())).toEqual({
      larguraMm: 120,
      profundidadeMm: 90,
      alturaMm: 100,
    });
  });

  it("paraContagemInformada: zero e null viram null (D-12, 'não contei')", () => {
    expect(
      paraContagemInformada(fichaBase({ cabemBiscoitoInformado: 0, cabemEsmalteInformado: null })),
    ).toEqual({ biscoito: null, esmalte: null });
  });

  it("paraContagemInformada: valor informado maior que zero passa direto", () => {
    expect(
      paraContagemInformada(fichaBase({ cabemBiscoitoInformado: 9, cabemEsmalteInformado: 5 })),
    ).toEqual({ biscoito: 9, esmalte: 5 });
  });
});

describe("resultadoDaFicha", () => {
  const resultadoDireto = calcularPeca({
    ficha: paraFichaDeCalculo(fichaBase()),
    cabem: CABEM_DA_CANECA,
    parametros: PARAMETROS_ILUSTRATIVOS,
    taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
    canal: "direto",
  });
  const resultadoGaleria = calcularPeca({
    ficha: paraFichaDeCalculo(fichaBase()),
    cabem: CABEM_DA_CANECA,
    parametros: PARAMETROS_ILUSTRATIVOS,
    taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
    canal: "galeria",
  });

  it("ficha que cabe: as cinco fatias somam exatamente o custo, sem resíduo de arredondamento", () => {
    const resultado = resultadoDaFicha({
      cabem: CABEM_DA_CANECA,
      resultadoDireto,
      resultadoGaleria,
      farol: null,
    });
    if (!resultado.ok) throw new Error("esperava ok:true");

    const somaDasFatias = resultado.fatias.reduce((soma, fatia) => soma + fatia.centavos, 0);
    expect(somaDasFatias).toBe(resultado.custoCentavos);
    expect(resultado.custoCentavos).toBe(4424);
    expect(resultado.minimoCentavos).toBe(6187);
    expect(resultado.minimoGaleriaCentavos).toBe(14044);
    expect(resultado.zeroCentavos).toBe(4584);
    expect(resultado.fatias).toEqual([
      { chave: "material", centavos: 954 },
      { chave: "trabalho", centavos: 2100 },
      { chave: "queima", centavos: 406 },
      { chave: "embalagem", centavos: 300 },
      { chave: "perda", centavos: 664 },
    ]);
  });

  it("devolve as duas contagens do forno e a origem 'calculado' quando ninguém informou", () => {
    const resultado = resultadoDaFicha({
      cabem: CABEM_DA_CANECA,
      resultadoDireto,
      resultadoGaleria,
      farol: null,
    });
    if (!resultado.ok) throw new Error("esperava ok:true");

    expect(resultado.forno).toEqual({
      esmalte: 12,
      biscoito: 21,
      porPrateleira: 6,
      niveis: 2,
      origemEsmalte: "calculado",
      origemBiscoito: "calculado",
    });
  });

  it("origem 'informado' quando 'já contei' substituiu o calculado", () => {
    const resultado = resultadoDaFicha({
      cabem: CABEM_INFORMADO,
      resultadoDireto,
      resultadoGaleria,
      farol: null,
    });
    if (!resultado.ok) throw new Error("esperava ok:true");

    expect(resultado.forno.origemEsmalte).toBe("informado");
    expect(resultado.forno.origemBiscoito).toBe("informado");
    expect(resultado.forno.esmalte).toBe(5);
    expect(resultado.forno.biscoito).toBe(9);
  });

  it("peça maior que o forno e sem 'já contei': motivo nao-cabe, nenhum número de preço", () => {
    const resultadoDiretoSemCaber = calcularPeca({
      ficha: paraFichaDeCalculo(fichaBase()),
      cabem: NAO_CABE,
      parametros: PARAMETROS_ILUSTRATIVOS,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });
    const resultado = resultadoDaFicha({
      cabem: NAO_CABE,
      resultadoDireto: resultadoDiretoSemCaber,
      resultadoGaleria: resultadoDiretoSemCaber,
      farol: null,
    });

    expect(resultado).toEqual({ ok: false, motivo: "nao-cabe" });
  });

  it("parâmetros que não fecham: motivo divisor-invalido, nenhum número de preço", () => {
    const parametrosSemSentido: ParametrosDoCalculo = {
      ...PARAMETROS_ILUSTRATIVOS,
      lucroPontosBase: 5000,
      folgaNegociacaoPontosBase: 5000,
    };
    const resultadoInvalido = calcularPeca({
      ficha: paraFichaDeCalculo(fichaBase()),
      cabem: CABEM_DA_CANECA,
      parametros: parametrosSemSentido,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });
    const resultado = resultadoDaFicha({
      cabem: CABEM_DA_CANECA,
      resultadoDireto: resultadoInvalido,
      resultadoGaleria: resultadoInvalido,
      farol: null,
    });

    expect(resultado).toEqual({ ok: false, motivo: "divisor-invalido" });
  });

  it("minimoGaleriaCentavos vira null quando só o divisor da galeria não fecha (direto continua ok)", () => {
    const parametrosSoGaleriaFalha: ParametrosDoCalculo = {
      ...PARAMETROS_ILUSTRATIVOS,
      lucroPontosBase: 4500,
      folgaNegociacaoPontosBase: 500,
      comissaoGaleriaPontosBase: 4500,
    };
    const direto = calcularPeca({
      ficha: paraFichaDeCalculo(fichaBase()),
      cabem: CABEM_DA_CANECA,
      parametros: parametrosSoGaleriaFalha,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "direto",
    });
    const galeria = calcularPeca({
      ficha: paraFichaDeCalculo(fichaBase()),
      cabem: CABEM_DA_CANECA,
      parametros: parametrosSoGaleriaFalha,
      taxaCartaoPontosBase: TAXA_CARTAO_PONTOS_BASE,
      canal: "galeria",
    });
    expect(direto.ok).toBe(true);
    expect(galeria.ok).toBe(false);

    const resultado = resultadoDaFicha({
      cabem: CABEM_DA_CANECA,
      resultadoDireto: direto,
      resultadoGaleria: galeria,
      farol: null,
    });
    if (!resultado.ok) throw new Error("esperava ok:true (o canal direto fechou)");

    expect(resultado.minimoGaleriaCentavos).toBeNull();
  });

  it.each([
    [null, null],
    ["verde" as const, "verde"],
    ["amarelo" as const, "amarelo"],
    ["vermelho" as const, "vermelho"],
  ])("carrega o farol %s exatamente como o caller calculou, sem recalcular", (farolDeEntrada, esperado) => {
    const resultado = resultadoDaFicha({
      cabem: CABEM_DA_CANECA,
      resultadoDireto,
      resultadoGaleria,
      farol: farolDeEntrada,
    });
    if (!resultado.ok) throw new Error("esperava ok:true");
    expect(resultado.farol).toBe(esperado);
  });

  it("o farol pass-through bate com farolDoPreco nas quatro fronteiras exatas", () => {
    if (!resultadoDireto.ok) throw new Error("esperava ok:true");
    const { minimoCentavos, zeroCentavos } = resultadoDireto;

    expect(farolDoPreco(null, minimoCentavos, zeroCentavos)).toBeNull();
    expect(farolDoPreco(minimoCentavos, minimoCentavos, zeroCentavos)).toBe("verde");
    expect(farolDoPreco(minimoCentavos - 1, minimoCentavos, zeroCentavos)).toBe("amarelo");
    expect(farolDoPreco(zeroCentavos, minimoCentavos, zeroCentavos)).toBe("amarelo");
    expect(farolDoPreco(zeroCentavos - 1, minimoCentavos, zeroCentavos)).toBe("vermelho");
  });

  it("nunca deixa passar número nenhum quando o motivo é uma recusa", () => {
    const resultado: ResultadoDoCalculo = { ok: false, motivo: "divisor-invalido" };
    const saida = resultadoDaFicha({
      cabem: CABEM_DA_CANECA,
      resultadoDireto: resultado,
      resultadoGaleria: resultado,
      farol: null,
    });
    expect(Object.keys(saida)).toEqual(["ok", "motivo"]);
  });
});

describe("formatarGramas / formatarHoras / formatarCentimetros", () => {
  it("formatarGramas(450000) devolve '450 g'", () => {
    expect(formatarGramas(450_000)).toBe("450 g");
  });

  it("formatarHoras(600) devolve '0,6 h'", () => {
    expect(formatarHoras(600)).toBe("0,6 h");
  });

  it("formatarCentimetros(120) devolve '12 cm'", () => {
    expect(formatarCentimetros(120)).toBe("12 cm");
  });

  it("os três aceitam zero devolvendo '0'", () => {
    expect(formatarGramas(0)).toBe("0 g");
    expect(formatarHoras(0)).toBe("0 h");
    expect(formatarCentimetros(0)).toBe("0 cm");
  });
});

// 04.5-05-PLAN.md, Tarefa 1 — "Começar a partir de uma peça parecida" (D-19): só os casos PUROS
// (esta função nunca toca banco); os que dependem do banco (apagarFicha permitida/recusada,
// listarFichas/listarFichasParaCopiar) ficam para o e2e da Tarefa 2 e, no caso da recusa por
// ficha em uso, para o e2e do plano 06 — ver SUMMARY.
describe("camposCopiaveisDaFicha", () => {
  const ORIGEM: CamposCopiaveisDaFicha = {
    argilaMiligramas: 450_000,
    esmalteMiligramas: 60_000,
    horasMilesimos: 600,
    larguraMm: 120,
    profundidadeMm: 90,
    alturaMm: 100,
    embalagemCentavos: 300,
    cabemBiscoitoInformado: 21,
    cabemEsmalteInformado: 12,
  };

  it("copia argila, esmalte, horas, medidas, embalagem e as duas contagens 'já contei'", () => {
    expect(camposCopiaveisDaFicha(ORIGEM)).toEqual(ORIGEM);
  });

  it("uma origem exclusiva é permitida — a função não sabe nem pergunta se `exclusiva` é true", () => {
    // `CamposCopiaveisDaFicha` nem tem o campo `exclusiva` — o TIPO já impede a pergunta. Uma
    // ficha exclusiva "vista" pelo caller entra aqui do mesmo jeito que qualquer outra.
    expect(camposCopiaveisDaFicha(ORIGEM)).toEqual(ORIGEM);
  });

  it("uma origem inexistente (null) devolve os campos em branco, nunca lança erro", () => {
    expect(camposCopiaveisDaFicha(null)).toEqual({
      argilaMiligramas: 0,
      esmalteMiligramas: 0,
      horasMilesimos: 0,
      larguraMm: 0,
      profundidadeMm: 0,
      alturaMm: 0,
      embalagemCentavos: 0,
      cabemBiscoitoInformado: null,
      cabemEsmalteInformado: null,
    });
  });

  it("NÃO copia nome, preço praticado, preço de mercado, exclusiva nem vínculo de catálogo — o tipo de saída não tem esses campos", () => {
    const saida = camposCopiaveisDaFicha(ORIGEM);
    expect(Object.keys(saida).sort()).toEqual(
      [
        "argilaMiligramas",
        "esmalteMiligramas",
        "horasMilesimos",
        "larguraMm",
        "profundidadeMm",
        "alturaMm",
        "embalagemCentavos",
        "cabemBiscoitoInformado",
        "cabemEsmalteInformado",
      ].sort(),
    );
  });
});

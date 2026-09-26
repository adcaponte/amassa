// Módulo puro (D-14): zero `import` de valor, nenhuma leitura do relógio, nenhum React, nenhum cliente
// de banco — "hoje" e os parâmetros entram por argumento. Só `import type` de `./forno`, para o
// formato de `CabemNoForno` (nenhum valor de lá é importado).
//
// Toda a aritmética é em INTEIROS: dinheiro em centavos, percentual em pontos-base (3,5% = 350,
// mesma convenção de `configuracao_financeira.taxa_cartao_pontos_base`), miligrama/milésimo para
// o resto. Divisão por percentual é sempre `Math.round(valor * 10000 / divisorEmPontosBase)` —
// nunca ponto flutuante acumulado.
//
// Fórmulas (BRIEFING §2, verbatim):
//   material   = argila_g/1000 × R$/kg argila + esmalte_g/1000 × R$/kg esmalte
//   trabalho   = horas × valor da hora
//   fornada_X  = kWh_X × tarifa + desgaste por fornada            (X = biscoito, esmalte)
//   queima     = fornada_biscoito ÷ cabem_biscoito + fornada_esmalte ÷ cabem_esmalte
//   direto     = material + trabalho + queima + embalagem
//   custo      = direto ÷ (1 − perda)
//   mínimo     = custo ÷ (1 − lucro − folga − imposto − taxa_cartão − comissão_do_canal)
//   zero       = custo ÷ (1 − imposto − taxa_cartão)
//
// Percentual do preço entra DIVIDINDO, nunca somando (fórmula do Sebrae, auditada em agosto —
// D-11). O protótipo aplicava um PISO ao divisor (`Math.max(0.05, ...)`, `prototipo.html`,
// função `calc`); a plataforma RECUSA em vez de aplicar piso — mostrar um número derivado de um
// divisor sem sentido é pior que não mostrar número nenhum. O limite do divisor é 500
// pontos-base: igual ou abaixo disso (ou negativo), a função recusa, para qualquer um dos três
// divisores da fórmula (perda, mínimo, zero) — nunca aplica piso, nunca devolve número.
import type { CabemNoForno } from "./forno";

// Limite comum aos três divisores da fórmula — abaixo (ou igual) a isto, o divisor não tem
// sentido econômico (o preço explodiria ou ficaria negativo).
const LIMITE_DO_DIVISOR_EM_PONTOS_BASE = 500;

export type ParametrosDoCalculo = {
  argilaReaisPorKgCentavos: number;
  esmalteReaisPorKgCentavos: number;
  horaTrabalhoCentavos: number;
  tarifaEnergiaCentavos: number;
  kwhBiscoitoMilesimos: number;
  kwhEsmalteMilesimos: number;
  desgastePorFornadaCentavos: number;
  perdaPontosBase: number;
  lucroPontosBase: number;
  folgaNegociacaoPontosBase: number;
  impostoPontosBase: number;
  comissaoGaleriaPontosBase: number;
};

export type FichaParaCalculo = {
  argilaMiligramas: number;
  esmalteMiligramas: number;
  horasMilesimos: number;
  embalagemCentavos: number;
};

export type CanalDeVenda = "direto" | "galeria";

export type MotivoDeCalculoInvalido = "divisor-invalido" | "nao-cabe";

export type ResultadoDoCalculo =
  | {
      ok: true;
      materialCentavos: number;
      trabalhoCentavos: number;
      queimaCentavos: number;
      embalagemCentavos: number;
      diretoCentavos: number;
      perdaCentavos: number;
      custoCentavos: number;
      minimoCentavos: number;
      zeroCentavos: number;
    }
  | { ok: false; motivo: MotivoDeCalculoInvalido };

// `Math.round(valor * 10000 / divisorEmPontosBase)` — a mesma disciplina de arredondamento
// meio-para-cima de `lib/financeiro/taxa.ts::taxaEmCentavos`, só que aqui o percentual DIVIDE em
// vez de multiplicar.
function dividirPorPontosBase(valorCentavos: number, divisorPontosBase: number): number {
  return Math.round((valorCentavos * 10000) / divisorPontosBase);
}

export function calcularPeca(entrada: {
  ficha: FichaParaCalculo;
  cabem: CabemNoForno;
  parametros: ParametrosDoCalculo;
  taxaCartaoPontosBase: number;
  canal: CanalDeVenda;
}): ResultadoDoCalculo {
  const { ficha, cabem, parametros, taxaCartaoPontosBase, canal } = entrada;

  // Sem quantas cabem no forno não há como ratear a queima — aviso, sem número (D-12).
  if (!cabem.cabe) {
    return { ok: false, motivo: "nao-cabe" };
  }

  const materialCentavos =
    Math.round((ficha.argilaMiligramas * parametros.argilaReaisPorKgCentavos) / 1_000_000) +
    Math.round((ficha.esmalteMiligramas * parametros.esmalteReaisPorKgCentavos) / 1_000_000);

  const trabalhoCentavos = Math.round(
    (ficha.horasMilesimos * parametros.horaTrabalhoCentavos) / 1000,
  );

  const fornadaBiscoitoCentavos =
    Math.round((parametros.kwhBiscoitoMilesimos * parametros.tarifaEnergiaCentavos) / 1000) +
    parametros.desgastePorFornadaCentavos;
  const fornadaEsmalteCentavos =
    Math.round((parametros.kwhEsmalteMilesimos * parametros.tarifaEnergiaCentavos) / 1000) +
    parametros.desgastePorFornadaCentavos;

  const queimaCentavos =
    Math.round(fornadaBiscoitoCentavos / cabem.biscoito) +
    Math.round(fornadaEsmalteCentavos / cabem.esmalte);

  const diretoCentavos =
    materialCentavos + trabalhoCentavos + queimaCentavos + ficha.embalagemCentavos;

  const divisorPerdaPontosBase = 10000 - parametros.perdaPontosBase;
  if (divisorPerdaPontosBase <= LIMITE_DO_DIVISOR_EM_PONTOS_BASE) {
    return { ok: false, motivo: "divisor-invalido" };
  }
  const custoCentavos = dividirPorPontosBase(diretoCentavos, divisorPerdaPontosBase);
  const perdaCentavos = custoCentavos - diretoCentavos;

  const comissaoDoCanalPontosBase = canal === "galeria" ? parametros.comissaoGaleriaPontosBase : 0;
  const somaDoMinimoPontosBase =
    parametros.lucroPontosBase +
    parametros.folgaNegociacaoPontosBase +
    parametros.impostoPontosBase +
    taxaCartaoPontosBase +
    comissaoDoCanalPontosBase;
  const divisorMinimoPontosBase = 10000 - somaDoMinimoPontosBase;
  if (divisorMinimoPontosBase <= LIMITE_DO_DIVISOR_EM_PONTOS_BASE) {
    return { ok: false, motivo: "divisor-invalido" };
  }
  const minimoCentavos = dividirPorPontosBase(custoCentavos, divisorMinimoPontosBase);

  // O preço zero tem divisor próprio (imposto + taxa, sem lucro/folga/comissão) — abaixo dele, a
  // venda paga para trabalhar.
  const somaDoZeroPontosBase = parametros.impostoPontosBase + taxaCartaoPontosBase;
  const divisorZeroPontosBase = 10000 - somaDoZeroPontosBase;
  if (divisorZeroPontosBase <= LIMITE_DO_DIVISOR_EM_PONTOS_BASE) {
    return { ok: false, motivo: "divisor-invalido" };
  }
  const zeroCentavos = dividirPorPontosBase(custoCentavos, divisorZeroPontosBase);

  return {
    ok: true,
    materialCentavos,
    trabalhoCentavos,
    queimaCentavos,
    embalagemCentavos: ficha.embalagemCentavos,
    diretoCentavos,
    perdaCentavos,
    custoCentavos,
    minimoCentavos,
    zeroCentavos,
  };
}

export type FarolDoPreco = "verde" | "amarelo" | "vermelho" | null;

// `null` sem preço praticado (a ficha ainda não tem um preço para comparar); "verde" quando o
// preço cobre lucro e folga; "amarelo" entre o zero e o mínimo (cobre o custo, come o lucro);
// "vermelho" abaixo do zero (a venda paga para trabalhar). Fronteiras INCLUSIVAS no lado de cima
// de cada faixa — preço exatamente igual ao mínimo é verde, exatamente igual ao zero é amarelo.
export function farolDoPreco(
  precoPraticadoCentavos: number | null,
  minimoCentavos: number,
  zeroCentavos: number,
): FarolDoPreco {
  if (precoPraticadoCentavos === null) {
    return null;
  }
  if (precoPraticadoCentavos >= minimoCentavos) {
    return "verde";
  }
  if (precoPraticadoCentavos >= zeroCentavos) {
    return "amarelo";
  }
  return "vermelho";
}

// Sugestão de preço "redondo" (D-23 usa a mesma regra para "Atualizar preços"): até R$ 50,
// arredonda para o real inteiro acima; acima de R$ 50, para o múltiplo de 5 reais acima; um valor
// que já satisfaz a própria régua não muda (`Math.ceil` de um valor exato devolve o próprio
// valor).
export function arredondarBonito(valorCentavos: number): number {
  const CINQUENTA_REAIS_EM_CENTAVOS = 5000;
  if (valorCentavos <= CINQUENTA_REAIS_EM_CENTAVOS) {
    return Math.ceil(valorCentavos / 100) * 100;
  }
  return Math.ceil(valorCentavos / 500) * 500;
}

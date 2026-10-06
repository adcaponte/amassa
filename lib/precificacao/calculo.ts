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
//   mínimo     = custo ÷ (1 − lucro − folga − imposto − taxa_cartão)
//   galeria    = mínimo ÷ (1 − comissão da galeria)
//   zero       = custo ÷ (1 − imposto − taxa_cartão)
//
// A linha da galeria é a decisão do dono de 06/10/2026 (D-16, 06.5-29-PLAN.md, resposta
// "b-sobre-o-direto"): a galeria fica com a comissão SOBRE O PREÇO DELA e o ateliê recebe o
// mesmo que na venda direta. Até essa data a comissão entrava no MESMO divisor que lucro, folga,
// imposto e taxa (custo ÷ (1 − … − comissão)) — com lucro + folga + imposto + taxa em 54 % e
// comissão em 40 %, a caneca saía a 7,7× o preço direto (achado 24 do Cowork; a conta inteira
// em `.planning/phases/06.5-polimento/06.5-CONTA-DA-GALERIA.md`). O canal direto não mudou.
//
// Percentual do preço entra DIVIDINDO, nunca somando (fórmula do Sebrae, auditada em agosto —
// D-11). O protótipo aplicava um PISO ao divisor (`Math.max(0.05, ...)`, `prototipo.html`,
// função `calc`); a plataforma RECUSA em vez de aplicar piso — mostrar um número derivado de um
// divisor sem sentido é pior que não mostrar número nenhum. O limite do divisor é 500
// pontos-base: igual ou abaixo disso (ou negativo), a função recusa, para qualquer um dos
// divisores da fórmula (perda, mínimo, zero e, no canal galeria, 1 − comissão) — nunca aplica
// piso, nunca devolve número.
import type { CabemNoForno } from "./forno";

// Limite comum aos três divisores da fórmula — abaixo (ou igual) a isto, o divisor não tem
// sentido econômico (o preço explodiria ou ficaria negativo). Exportado para quem precisa avisar
// ANTES de existir uma ficha para calcular (`parametrosDoPrecoFazemSentido` abaixo,
// 04.5-02-PLAN.md) — nunca duplicado como número solto em outro módulo.
export const LIMITE_DO_DIVISOR_EM_PONTOS_BASE = 500;

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

  // O mínimo da venda direta — a mesma conta para os dois canais; a comissão da galeria NÃO entra
  // aqui (D-16, 06/10/2026).
  const somaDoMinimoPontosBase =
    parametros.lucroPontosBase +
    parametros.folgaNegociacaoPontosBase +
    parametros.impostoPontosBase +
    taxaCartaoPontosBase;
  const divisorMinimoPontosBase = 10000 - somaDoMinimoPontosBase;
  if (divisorMinimoPontosBase <= LIMITE_DO_DIVISOR_EM_PONTOS_BASE) {
    return { ok: false, motivo: "divisor-invalido" };
  }
  const minimoDiretoCentavos = dividirPorPontosBase(custoCentavos, divisorMinimoPontosBase);

  // Galeria ou consignado (D-16, palavra do dono em 06/10/2026: "b-sobre-o-direto"): o mínimo
  // direto ÷ (1 − comissão). A galeria fica com a comissão sobre o preço dela; o que sobra para o
  // ateliê é o mínimo direto. Divide o valor JÁ ARREDONDADO do direto, de propósito: é a conta
  // que o dono faz de cabeça ("101,07 ÷ 0,60 = 168,45"), e a tela mostra os dois números.
  let minimoCentavos = minimoDiretoCentavos;
  if (canal === "galeria") {
    const divisorDaComissaoPontosBase = 10000 - parametros.comissaoGaleriaPontosBase;
    if (divisorDaComissaoPontosBase <= LIMITE_DO_DIVISOR_EM_PONTOS_BASE) {
      return { ok: false, motivo: "divisor-invalido" };
    }
    minimoCentavos = dividirPorPontosBase(minimoDiretoCentavos, divisorDaComissaoPontosBase);
  }

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

// A tela de Parâmetros (04.5-02-PLAN.md) precisa avisar quando os percentuais do preço passam do
// limite ANTES de existir qualquer ficha — os mesmos divisores de `calcularPeca` no pior caso, o
// canal galeria: o do mínimo (lucro + folga + imposto + taxa) e, desde a D-16 (06/10/2026), o da
// comissão sozinha (1 − comissão), que deixou de somar com os outros. `true` quando os parâmetros
// ainda fazem sentido juntos; `false` quando a tela deve mostrar o bloco vermelho no lugar de
// qualquer preço.
export function parametrosDoPrecoFazemSentido(
  parametros: Pick<
    ParametrosDoCalculo,
    "lucroPontosBase" | "folgaNegociacaoPontosBase" | "impostoPontosBase" | "comissaoGaleriaPontosBase"
  >,
  taxaCartaoPontosBase: number,
): boolean {
  const somaDoMinimoPontosBase =
    parametros.lucroPontosBase +
    parametros.folgaNegociacaoPontosBase +
    parametros.impostoPontosBase +
    taxaCartaoPontosBase;
  return (
    10000 - somaDoMinimoPontosBase > LIMITE_DO_DIVISOR_EM_PONTOS_BASE &&
    10000 - parametros.comissaoGaleriaPontosBase > LIMITE_DO_DIVISOR_EM_PONTOS_BASE
  );
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

// Módulo puro (D-14): zero `import` de valor, nenhuma leitura do relógio, nenhum React, nenhum cliente
// de banco. Mesmo molde de `lib/encomendas/cronograma.ts`/`lib/queimas/contador.ts`.
//
// Quantas peças cabem no forno sai das MEDIDAS (D-12/BRIEFING §2), nunca do volume — volume erra
// cerca de 2× numa peça plana (diagnóstico de agosto: um prato ocupa uma prateleira inteira, mas
// uma conta ingênua por volume "encaixaria" muito mais peças empilhadas no espaço vazio acima
// dele, que na prática não existe porque a peça é achatada e a prateleira seguinte já está logo
// ali). Por isso este módulo NUNCA multiplica as três dimensões — só o teste (`forno.test.ts`)
// calcula o número por volume, e só para provar a diferença.
//
// Todas as medidas entram em milímetros inteiros (mesma unidade de
// `fichas_precificacao.largura_mm` etc.) — a conversão de cm (o que a tela pede) para mm é feita
// na borda, nunca aqui.

export type MedidasDaPeca = {
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
};

export type MedidasUteisDoForno = {
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
  folgaMm: number;
  prateleiraEPilarMm: number;
  // "1,8×" guardado em milésimos (1800) — mesma escala de `forno_fator_biscoito` em
  // `lib/precificacao/parametros.ts`.
  fatorBiscoitoMilesimos: number;
};

export type ContagemInformada = {
  esmalte?: number | null;
  biscoito?: number | null;
};

export type CabemNoForno = {
  // `true` só quando esmalte E biscoito são ambos > 0 depois de aplicar qualquer "já contei" —
  // uma peça que não cabe pelas medidas E não tem contagem informada nunca fica `cabe: true`.
  cabe: boolean;
  porPrateleira: number;
  niveis: number;
  esmalte: number;
  biscoito: number;
  // `false` quando o número veio de "já contei" (D-12) — a ficha marca o campo como
  // não-calculado nesse caso.
  esmalteAutomatico: boolean;
  biscoitoAutomatico: boolean;
};

// Por prateleira, testando as duas orientações da peça (largura×profundidade e
// profundidade×largura) — o melhor encaixe das duas vence, porque uma peça retangular pode caber
// mais vezes girada 90°.
function porOrientacao(
  largura: number,
  profundidade: number,
  forno: MedidasUteisDoForno,
): number {
  const { larguraMm: L, profundidadeMm: P, folgaMm: f } = forno;
  return Math.floor((L + f) / (largura + f)) * Math.floor((P + f) / (profundidade + f));
}

// `quantasCabem` nunca multiplica as três dimensões da peça — por prateleira é
// `max(⌊(L+f)/(l+f)⌋×⌊(P+f)/(p+f)⌋, ⌊(L+f)/(p+f)⌋×⌊(P+f)/(l+f)⌋)`, níveis é
// `⌊A÷(alturaDaPeca+prateleiraEPilar)⌋`; o número do biscoito deriva do número do esmalte
// CALCULADO pela medida (nunca do valor final, já com "já contei" aplicado — mesmo comportamento
// do protótipo, `cabe()`: `b: +f.pfB || Math.floor(e*p.fatorB)` usa a variável local `e`, não o
// campo final) por um fator; os dois campos "já contei" substituem o calculado
// independentemente um do outro, e marcam o respectivo campo como não-calculado.
export function quantasCabem(
  peca: MedidasDaPeca,
  forno: MedidasUteisDoForno,
  informado?: ContagemInformada,
): CabemNoForno {
  const porPrateleira = Math.max(
    porOrientacao(peca.larguraMm, peca.profundidadeMm, forno),
    porOrientacao(peca.profundidadeMm, peca.larguraMm, forno),
  );
  const niveis = Math.floor(forno.alturaMm / (peca.alturaMm + forno.prateleiraEPilarMm));

  const esmalteCalculado = porPrateleira * niveis;
  const biscoitoCalculado = Math.floor((esmalteCalculado * forno.fatorBiscoitoMilesimos) / 1000);

  const esmalteInformado = informado?.esmalte ?? null;
  const biscoitoInformado = informado?.biscoito ?? null;

  const esmalte = esmalteInformado ?? esmalteCalculado;
  const biscoito = biscoitoInformado ?? biscoitoCalculado;

  return {
    cabe: esmalte > 0 && biscoito > 0,
    porPrateleira,
    niveis,
    esmalte,
    biscoito,
    esmalteAutomatico: esmalteInformado === null,
    biscoitoAutomatico: biscoitoInformado === null,
  };
}

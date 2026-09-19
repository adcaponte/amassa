// Módulo puro (D-09/D-10 do 04.4-CONTEXT.md): zero imports, mesma disciplina de
// `lib/financeiro/taxa.ts`/`lib/abertura/parcelas.ts`. A ÚNICA função que reparte um desconto de
// venda entre as linhas do carrinho — chamada tanto no cliente (para mostrar o total e as
// etiquetas "tabela R$ X" enquanto o dono digita) quanto no servidor (para gravar). O servidor
// NUNCA aceita valores de linha já descontados vindos do cliente: recebe o texto do desconto e
// refaz esta MESMA conta.
//
// Por que a recusa de "repartição impossível" existe: a regra do dono é "a sobra de centavos vai
// para a maior linha" (D-10), inclusive quando essa sobra deixaria a linha negativa. Isso só
// acontece no caso degenerado de um desconto quase igual ao total, repartido entre linhas de
// poucos centavos — um desconto legítimo (R$ 153 por R$ 150, por exemplo) nunca chega perto desse
// limite. Em vez de deixar uma linha negativa entrar no banco (violaria a restrição de
// `documento_linhas.valor_centavos >= 0`), a função recusa com uma frase que diz o que fazer.
export type Desconto =
  | { modo: "reais"; centavos: number }
  | { modo: "percentual"; pontosBase: number };

export type ResultadoDeDesconto =
  | { ok: true; valoresFinais: number[]; descontoTotalCentavos: number }
  | { ok: false; erro: string };

const FRASE_PERCENTUAL_FORA_DO_INTERVALO = "O percentual do desconto precisa estar entre 0 e 100.";
const FRASE_DESCONTO_NEGATIVO = "O desconto não pode ser negativo.";
const FRASE_DESCONTO_MAIOR_QUE_O_TOTAL = "O desconto é maior que o total.";
const FRASE_REPARTICAO_IMPOSSIVEL =
  "Esse desconto não dá para repartir entre as linhas — diminua o desconto ou tire uma linha.";

// Primeira ocorrência do maior valor — "empate: a primeira" (D-10, ao pé da letra).
function indiceDaMaiorLinha(subtotaisCentavos: readonly number[]): number {
  let indice = 0;
  for (let i = 1; i < subtotaisCentavos.length; i++) {
    if (subtotaisCentavos[i] > subtotaisCentavos[indice]) {
      indice = i;
    }
  }
  return indice;
}

// Desconto total: em reais, o próprio valor digitado; em percentual, total × pontos-base / 10000,
// arredondado meio-para-cima (`Math.round` do JavaScript já arredonda 0,5 para cima em valores
// positivos, mesma técnica de `lib/financeiro/taxa.ts::taxaEmCentavos`).
function descontoTotalDe(totalCentavos: number, desconto: Desconto): number {
  if (desconto.modo === "reais") {
    return desconto.centavos;
  }
  return Math.round((totalCentavos * desconto.pontosBase) / 10000);
}

// Reparte `desconto` entre `subtotaisCentavos` na proporção do valor de cada linha (D-09): parte
// de cada linha = piso(subtotal × desconto ÷ total); a sobra (desconto − soma das partes) vai
// inteira para a maior linha. Nunca muta a lista recebida — devolve sempre um array novo.
export function repartirDesconto(
  subtotaisCentavos: readonly number[],
  desconto: Desconto,
): ResultadoDeDesconto {
  if (
    desconto.modo === "percentual" &&
    (desconto.pontosBase < 0 || desconto.pontosBase > 10000)
  ) {
    return { ok: false, erro: FRASE_PERCENTUAL_FORA_DO_INTERVALO };
  }

  const totalCentavos = subtotaisCentavos.reduce((soma, valor) => soma + valor, 0);
  const descontoTotalCentavos = descontoTotalDe(totalCentavos, desconto);

  if (descontoTotalCentavos < 0) {
    return { ok: false, erro: FRASE_DESCONTO_NEGATIVO };
  }
  if (descontoTotalCentavos > totalCentavos) {
    return { ok: false, erro: FRASE_DESCONTO_MAIOR_QUE_O_TOTAL };
  }

  if (subtotaisCentavos.length === 0) {
    return { ok: true, valoresFinais: [], descontoTotalCentavos };
  }

  const partes = subtotaisCentavos.map((subtotal) =>
    totalCentavos === 0 ? 0 : Math.floor((subtotal * descontoTotalCentavos) / totalCentavos),
  );
  const somaDasPartes = partes.reduce((soma, parte) => soma + parte, 0);
  const sobra = descontoTotalCentavos - somaDasPartes;

  const indiceDaMaior = indiceDaMaiorLinha(subtotaisCentavos);
  partes[indiceDaMaior] += sobra;

  const valoresFinais = subtotaisCentavos.map((subtotal, indice) => subtotal - partes[indice]);

  if (valoresFinais.some((valor) => valor < 0)) {
    return { ok: false, erro: FRASE_REPARTICAO_IMPOSSIVEL };
  }

  return { ok: true, valoresFinais, descontoTotalCentavos };
}

// Módulo puro (D-14): zero `import` de valor, nenhuma leitura do relógio, nenhum React, nenhum
// cliente de banco — mesmo molde de `lib/precificacao/calculo.ts`/`lib/precificacao/forno.ts`.
//
// É por AQUI que custo fixo entra no preço (D-13, BRIEFING §2): a "retirada desejada" e a parte
// dos custos da casa que a produção sustenta viram a hora de trabalho, um parâmetro comum como
// qualquer outro — e é exatamente por isso que **não há rateio separado no Financeiro**. Tudo em
// inteiros: dinheiro em centavos, horas em milésimos (mesma escala de
// `lib/precificacao/parametros.ts`, `forno_kwh_biscoito` etc.).

export type EntradaDaHora = {
  retiradaCentavos: number;
  casaCentavos: number;
  horasMilesimos: number;
};

// `(retirada + casa) ÷ horas`, arredondada meio-para-cima — `Math.round` do JavaScript já
// arredonda 0,5 para cima em valores positivos (mesma disciplina de
// `lib/financeiro/taxa.ts::taxaEmCentavos`). Sem horas (zero ou negativo — nunca deveria chegar
// negativo, mas a defesa é a mesma), não há conta possível: devolve `null`, e é quem chama que
// mostra "Informe as horas." em vez de um número. Retirada e casa em zero, com horas positivas,
// devolvem 0 — zero é uma resposta válida, ausência de horas não é.
export function calcularHora({ retiradaCentavos, casaCentavos, horasMilesimos }: EntradaDaHora): number | null {
  if (horasMilesimos <= 0) {
    return null;
  }
  const somaCentavos = retiradaCentavos + casaCentavos;
  return Math.round((somaCentavos * 1000) / horasMilesimos);
}

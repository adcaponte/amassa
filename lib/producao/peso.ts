// Módulo puro da Produção — o peso de argila e de esmalte na tela e nas folhas impressas. Regra do
// dono, Parte 0 da verificação humana (30/09/2026): abaixo de 1 000 g, gramas inteiras ("850 g");
// a partir de 1 000 g, quilos com até duas casas e vírgula ("1 kg", "1,2 kg", "1,25 kg"). Uma porta
// só para a peça (a argila por peça da folha da ordem) e para a ordem (o previsto, o já baixado,
// o que falta e o que passou, no bloco "Material usado", na folha de baixa e na folha da ordem).
//
// NÃO vale para o livro do Estoque: a quantidade de uma baixa, o saldo e a prévia do saldo ficam na
// unidade do próprio item (`textoDeMilesimos` + a unidade), como o Estoque mostra.
//
// Nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`.

const QUILOS = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Miligramas (a unidade da ficha e das contas da Produção) → "850 g" / "1,25 kg". Negativo conta
// como zero (as contas de "faltam" e "a mais" já chegam com o sinal resolvido). O arredondamento é
// em inteiros, meio para cima: primeiro para a grama inteira; a partir de 1 000 g, da grama para o
// centésimo de quilo (1 005 g → 1,01 kg; 12 345 g → 12,35 kg) — sem a imprecisão de `1.005`.
export function textoDePeso(miligramas: number): string {
  const gramas = Math.round(Math.max(0, miligramas) / 1000);
  if (gramas < 1000) {
    return `${gramas} g`;
  }
  const centesimosDeQuilo = Math.round(gramas / 10);
  return `${QUILOS.format(centesimosDeQuilo / 100)} kg`;
}

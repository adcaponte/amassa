// Módulo puro da Produção (Fase 06.1) — as horas de trabalho estimadas da ordem (PRD-05: só a
// página da ordem mostra). Zero imports.
//
// As horas contam as peças FEITAS — o pedido MAIS as "a mais, de segurança" —, como o material
// previsto (`materialPrevisto` em `./material`): fazer uma peça a mais dá o mesmo trabalho que fazer
// uma do pedido. Decisão do dono em 01/10/2026, depois da verificação do Cowork de 30/09 (item 3:
// "Trabalho estimado: 9,0 h" não mudava com "+1 a mais", enquanto o material mudava). Até então a
// conta era horas da ficha × quantidade do pedido só.

// Uma peça no que a estimativa precisa: o pedido, as a mais e as horas de UMA peça na ficha, em
// milésimos de hora (a escala de `fichas_precificacao.horas_milesimos`). `null` = peça sem ficha.
export type PecaParaHoras = {
  quantidade: number;
  aMais: number;
  horasMilesimos: number | null;
};

// Horas de uma linha de peça, em milésimos: horas da ficha × (pedido + a mais). `null` sem ficha.
export function horasDaPeca(peca: PecaParaHoras): number | null {
  if (peca.horasMilesimos === null) {
    return null;
  }
  return peca.horasMilesimos * (peca.quantidade + peca.aMais);
}

// Horas da ordem, em milésimos: a soma das peças com ficha. `null` quando nenhuma tem ficha (a tela
// diz "sem estimativa"); peça sem ficha ao lado de outra com ficha só fica fora da soma.
export function horasDaOrdem(pecas: readonly PecaParaHoras[]): number | null {
  let total = 0;
  let algumaComFicha = false;
  for (const peca of pecas) {
    const horas = horasDaPeca(peca);
    if (horas !== null) {
      total += horas;
      algumaComFicha = true;
    }
  }
  return algumaComFicha ? total : null;
}

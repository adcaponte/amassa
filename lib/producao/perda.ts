// Módulo puro da Produção (Fase 06.1, plano 12) — a PERDA TÉCNICA medida (D-08, PRD-17, briefing
// §7). Nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite); "hoje" chega
// por argumento.
//
// A perda técnica é perdidas ÷ feitas, com feitas = pedido + a mais — a mesma "feitas" da conclusão
// (`lib/producao/conclusao.ts`). As extras boas que ficaram sem destino NÃO são perda: são peças
// boas que ninguém vai vender. Misturar as duas faria a taxa parecer pior do que é e calibraria o
// preço errado (o parâmetro "perda" entra dividindo no preço). Por isso a entrada desta conta nem
// tem campo para elas — a separação é por construção.
//
// A medida é SÓ LEITURA: ela aparece ao lado do parâmetro "perda" em Cadastros → Parâmetros, e
// trocar o parâmetro continua manual (D-08). Nada aqui escreve em lugar nenhum.

import { subtrairMeses } from "./calendario";

// Uma ordem CONCLUÍDA, somada por ordem: a data da conclusão, as perdidas e as feitas (pedido + a
// mais) de todas as suas peças. Canceladas nunca chegam aqui (quem lê só traz `concluida`); a
// produção da casa entra como qualquer outra.
export type ConclusaoParaAPerda = {
  concluidaEm: string;
  perdidas: number;
  feitas: number;
};

export type PerdaMedida = {
  // Pontos-base inteiros (400 = 4,00%); `null` sem medida (nenhuma peça feita na janela).
  pontosBase: number | null;
  perdidas: number;
  feitas: number;
  ordens: number;
};

// perdidas ÷ feitas em pontos-base inteiros, arredondados meio-para-cima (1 de 3 → 3333; 2 de 3 →
// 6667). Conta em inteiros: (2 × perdidas × 10 000 + feitas) ÷ (2 × feitas), por baixo. Feitas 0 →
// `null` (sem medida — nunca um zero inventado).
export function perdaTecnica(perdidas: number, feitas: number): number | null {
  if (feitas <= 0) {
    return null;
  }
  return Math.floor((2 * perdidas * 10_000 + feitas) / (2 * feitas));
}

// A perda medida dos últimos `meses` meses: as conclusões com `concluidaEm` ≥ hoje − `meses` (mês
// civil com dia ajustado, `subtrairMeses`; a do limite ENTRA), somadas — Σ perdidas ÷ Σ feitas,
// nunca a média das taxas de cada ordem (uma ordem de 2 peças pesaria como uma de 200). A soma não
// depende da ordem da lista.
export function perdaMedida(
  conclusoes: readonly ConclusaoParaAPerda[],
  hoje: string,
  meses = 6,
): PerdaMedida {
  const desde = subtrairMeses(hoje, meses);
  let perdidas = 0;
  let feitas = 0;
  let ordens = 0;
  for (const conclusao of conclusoes) {
    if (conclusao.concluidaEm < desde) {
      continue;
    }
    perdidas += conclusao.perdidas;
    feitas += conclusao.feitas;
    ordens += 1;
  }
  return { pontosBase: perdaTecnica(perdidas, feitas), perdidas, feitas, ordens };
}

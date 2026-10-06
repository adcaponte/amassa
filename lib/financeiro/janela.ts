// Módulo puro (06.5-12, D-03 / UI-D7): a janela do Caixa — "A pagar", "A receber" e os três tiles
// que somam o futuro falam das vencidas e das que vencem até HOJE + 30 dias; o resto fica a um
// toque. Só importa `./calendario` (puro, do mesmo módulo). Nem React, nem Next, nem o banco, nem
// `new Date()`: o "hoje" chega por argumento, calculado no servidor (`hojeEmBrasilia`).
import { mesSeguinte, somarDias } from "./calendario";

// Quantos dias corridos a janela alcança a partir de hoje (UI-D7: "vencidas + 30 dias corridos").
export const DIAS_DA_JANELA_DO_CAIXA = 30;

export type JanelaDoCaixa = { ate: string };

// O último dia civil (`YYYY-MM-DD`) que ainda entra na janela — inclusive.
export function janelaDoCaixa(hoje: string): JanelaDoCaixa {
  return { ate: somarDias(hoje, DIAS_DA_JANELA_DO_CAIXA) };
}

// Separa as contas em aberto em "da janela" (vencimento até `ate`, INCLUSIVE as vencidas — elas
// são o que mais importa) e "depois". A ordem de chegada se mantém nas duas partes (a consulta já
// ordena por vencimento e número do documento). Nunca muta a lista recebida.
export function separarPelaJanela<T extends { vencimento: string }>(
  contas: readonly T[],
  janela: JanelaDoCaixa,
): { daJanela: T[]; depois: T[] } {
  const daJanela: T[] = [];
  const depois: T[] = [];
  for (const conta of contas) {
    if (conta.vencimento <= janela.ate) {
      daJanela.push(conta);
    } else {
      depois.push(conta);
    }
  }
  return { daJanela, depois };
}

// As chaves `YYYY-MM` de cada mês que a janela toca, do mês de hoje ao mês de `ate`, em ordem —
// com virada de ano (dezembro → janeiro). Com 30 dias, quase sempre um ou dois meses; três quando
// a janela começa em 30 ou 31 de janeiro e atravessa um fevereiro inteiro.
export function mesesDaJanela(hoje: string, ate: string): string[] {
  const ultimo = ate.slice(0, 7);
  const meses: string[] = [];
  let mes = hoje.slice(0, 7);
  while (mes <= ultimo) {
    meses.push(mes);
    mes = mesSeguinte(mes);
  }
  return meses;
}

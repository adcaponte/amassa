// As vagas de uma data (AGE-11, briefing §2.8) — módulo puro: nenhuma linha alcança React, o banco ou
// a rede. É uma conta para MOSTRAR, nunca para recusar: não existe controle de lotação do espaço,
// nem soma de lugares entre eventos (decisão do dono de 29/09). `listaCheia` serve só ao aviso âmbar
// da folha do evento (UI-D16); colocar a pessoa seguinte grava do mesmo jeito. `rotuloDeVagas` é o
// do calendário público do site (plano 15).
import {
  ROTULO_ESGOTADO,
  ROTULO_ULTIMA_VAGA,
  rotuloNVagas,
  rotuloUltimasVagas,
} from "./textos";

// Vagas menos inscritos — fica negativo quando a lista passou das vagas (a lista cheia não bloqueia).
export function vagasRestantes(vagas: number, inscritos: number): number {
  return vagas - inscritos;
}

// "{n} vagas" · "últimas 2 vagas" · "última vaga" · "esgotado" (protótipo, linha 277); zero ou
// negativo é esgotado.
export function rotuloDeVagas(restantes: number): string {
  if (restantes <= 0) {
    return ROTULO_ESGOTADO;
  }
  if (restantes === 1) {
    return ROTULO_ULTIMA_VAGA;
  }
  if (restantes === 2) {
    return rotuloUltimasVagas(restantes);
  }
  return rotuloNVagas(restantes);
}

// Só o aviso "A lista já está cheia — dá para colocar mesmo assim, é só um aviso.".
export function listaCheia(vagas: number, inscritos: number): boolean {
  return inscritos >= vagas;
}

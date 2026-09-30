// Módulo puro da Produção (Fase 06.1, plano 11) — a CONCLUSÃO de uma ordem. A tela pergunta uma
// coisa por peça, quantas se perderam, e o resto sai daqui. As contas rodam no cliente (para mostrar
// enquanto se digita) e DE NOVO no servidor, sob a trava da ordem, para gravar — o cliente nunca
// manda boas, extras nem faltam (T-06.1-42). Nenhuma linha alcança React, Next, drizzle-orm, pg ou
// `@/db` (grep de aceite do plano 06.1-11).

import type { TipoOrdem } from "./etapas";

export type DestinoDasExtras = "estoque" | "sem_destino";

export type PecaDerivada = {
  ok: true;
  feitas: number;
  perdidas: number;
  boas: number;
  entregues: number;
  extrasBoas: number;
  faltam: number;
};

export type RecusaDaPeca = { ok: false; frase: string };

// As cinco fórmulas do BRIEFING.md §7, verbatim, em inteiros:
//
//   feitas      = pedido + a mais
//   boas        = feitas − perdidas
//   entregues   = mín(pedido, boas)            (produção da casa: não há entrega)
//   extras boas = máx(0, boas − pedido)        (produção da casa: todas as boas)
//   faltam      = máx(0, pedido − boas)  → permite "Concluir como entrega parcial", com aviso
//
// Na produção da casa não há cliente: entregues 0, as extras são todas as boas e nada falta.
// `perdidas` fora de 0..feitas, ou não inteira, é recusada com a frase da tela.
export function derivarPeca(p: {
  tipo: TipoOrdem;
  pedido: number;
  aMais: number;
  perdidas: number;
}): PecaDerivada | RecusaDaPeca {
  const feitas = p.pedido + p.aMais;
  if (!Number.isInteger(p.perdidas) || p.perdidas < 0 || p.perdidas > feitas) {
    return { ok: false, frase: `Diga um número de 0 a ${feitas}.` };
  }
  const boas = feitas - p.perdidas;
  if (p.tipo === "casa") {
    return { ok: true, feitas, perdidas: p.perdidas, boas, entregues: 0, extrasBoas: boas, faltam: 0 };
  }
  return {
    ok: true,
    feitas,
    perdidas: p.perdidas,
    boas,
    entregues: Math.min(p.pedido, boas),
    extrasBoas: Math.max(0, boas - p.pedido),
    faltam: Math.max(0, p.pedido - boas),
  };
}

// A sugestão do destino das extras boas (briefing §7; D-12, D-15). Casa: sempre o Estoque, sem
// escolha. Encomenda: peça de linha → Estoque; exclusiva → sem destino; peça em texto livre (sem
// ficha) → sem destino, e nesta fase só isso (D-12).
export function destinoSugerido(p: {
  tipo: TipoOrdem;
  exclusiva: boolean;
  temFicha: boolean;
}): DestinoDasExtras {
  if (p.tipo === "casa") {
    return "estoque";
  }
  if (!p.temFicha || p.exclusiva) {
    return "sem_destino";
  }
  return "estoque";
}

export type DistribuicaoDasExtras = { paraEstoque: number; semDestino: number };

// Quantas boas vão para o Estoque e quantas ficam sem destino. Casa: todas as boas para o Estoque
// (D-15), qualquer destino que chegue. Encomenda: as extras boas para o destino escolhido; sem
// extras, zero e zero. A soma nunca passa das boas (o `check` `ordem_pecas_destinos_cabem`).
export function distribuirExtras(
  peca: PecaDerivada,
  destino: DestinoDasExtras,
  tipo: TipoOrdem,
): DistribuicaoDasExtras {
  if (tipo === "casa") {
    return { paraEstoque: peca.boas, semDestino: 0 };
  }
  if (peca.extrasBoas === 0) {
    return { paraEstoque: 0, semDestino: 0 };
  }
  return destino === "estoque"
    ? { paraEstoque: peca.extrasBoas, semDestino: 0 }
    : { paraEstoque: 0, semDestino: peca.extrasBoas };
}

export type ResumoDaConclusao = {
  entregaParcial: boolean;
  paraEstoque: number;
  semDestino: number;
};

// O resumo da ordem: é entrega parcial se ALGUMA peça ficou faltando; e as somas do que entra no
// Estoque e do que fica sem destino (o toast e o rótulo do botão leem daqui).
export function resumoDaConclusao(
  pecas: readonly { faltam: number; paraEstoque: number; semDestino: number }[],
): ResumoDaConclusao {
  let entregaParcial = false;
  let paraEstoque = 0;
  let semDestino = 0;
  for (const peca of pecas) {
    if (peca.faltam > 0) {
      entregaParcial = true;
    }
    paraEstoque += peca.paraEstoque;
    semDestino += peca.semDestino;
  }
  return { entregaParcial, paraEstoque, semDestino };
}

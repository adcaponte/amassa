// Módulo puro da Produção (Fase 06.1, plano 08) — a fila do forno e as fornadas estimadas (PRD-13).
// Só imports de módulos puros da própria pasta; nenhuma linha alcança React, Next, drizzle-orm, pg
// ou `@/db` (grep de aceite do plano 06.1-01/08).
//
// Quantas peças cabem no forno NÃO é conta deste módulo: o número chega PRONTO, por ficha, calculado
// na borda (`cabemPorFicha` em `consultas.ts`) com `quantasCabem` da Precificação e os parâmetros
// vigentes — o mesmo número que a Precificação mostra (T-06.1-33). Aqui só se divide o que falta
// queimar pelo que cabe.

import { ETAPAS_DE_QUEIMA } from "./etapas";
import { etapaAtual, type OrdemParaLeitura } from "./leitura";
import { colunasDoQuadro } from "./quadro";

// Uma peça da ordem, só no que a fila precisa: a ficha (referência, ao vivo) e quantas são feitas
// (pedido + a mais).
export type PecaEmResumo = {
  fichaId: string | null;
  quantidade: number;
  aMais: number;
};

export type OrdemNaFilaDoForno = OrdemParaLeitura & {
  id: string;
  nome: string;
  pecasEmResumo: readonly PecaEmResumo[];
};

// O que cabe no forno por ficha — o recorte de `CabemNoForno` (lib/precificacao/forno.ts) que a fila
// usa: `biscoito` para a etapa `queima1`, `esmalte` para `queima2`.
export type CabemDaFicha = { cabe: boolean; biscoito: number; esmalte: number };

export type FornadasEstimadas = {
  // Uma casa decimal, meio para cima ("≈ 2,5 fornadas").
  biscoito: number;
  esmalte: number;
  // Peças restantes que ficaram fora da conta (sem ficha, ficha fora do mapa, `cabe: false` ou
  // cabem inválido) — arredondadas ao inteiro.
  pecasSemEstimativa: number;
};

// A fila do forno: as ordens ATIVAS cuja etapa atual é uma queima — exatamente as colunas "Queima
// de biscoito" e "Queima de esmalte" do quadro, na mesma ordem dos cartões (`inicio`, nome, id).
// Aguardando, concluída e cancelada nunca entram (o quadro já as deixa de fora).
export function esperandoOForno<T extends OrdemParaLeitura & { id: string; nome: string }>(
  ordens: readonly T[],
): T[] {
  return colunasDoQuadro(ordens)
    .filter((coluna) => ETAPAS_DE_QUEIMA.includes(coluna.etapa))
    .flatMap((coluna) => coluna.ordens);
}

function arredondarUmaCasa(valor: number): number {
  // `Number.EPSILON` corrige o 1,25 que vira 1,2499999… no ponto flutuante — meio para cima.
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

// As fornadas que a fila ainda pede ao forno. Por ordem, o parcial da etapa atual ("já passaram N
// de T") é repartido entre as peças em proporção às feitas de cada uma (protótipo, linha 273):
// restantes_i = feitas_i − passaram × feitas_i ÷ feitas_total. Cada peça divide as restantes pelo
// que cabe da SUA ficha — biscoito em `queima1`, esmalte em `queima2`. Peça sem ficha, ficha fora do
// mapa, `cabe: false` ou um cabem que não é número positivo finito fica FORA da conta e é somada em
// `pecasSemEstimativa` — nunca divisão por zero, nunca "0 fornadas" inventado. Ordem que não está
// numa queima (quem chama deveria ter passado `esperandoOForno`) é ignorada.
export function fornadasEstimadas(
  fila: readonly OrdemNaFilaDoForno[],
  cabemPorFicha: ReadonlyMap<string, CabemDaFicha>,
): FornadasEstimadas {
  let biscoito = 0;
  let esmalte = 0;
  let semEstimativa = 0;

  for (const ordem of fila) {
    const atual = etapaAtual(ordem);
    if (atual === null || !ETAPAS_DE_QUEIMA.includes(atual.etapa)) {
      continue;
    }
    const ehBiscoito = atual.etapa === "queima1";
    const feitasTotal = ordem.pecasEmResumo.reduce(
      (total, peca) => total + peca.quantidade + peca.aMais,
      0,
    );
    if (feitasTotal <= 0) {
      continue;
    }
    const passaram = Math.min(
      feitasTotal,
      Math.max(0, ordem.etapas.find((etapa) => etapa.etapa === atual.etapa)?.passaram ?? 0),
    );

    for (const peca of ordem.pecasEmResumo) {
      const feitas = peca.quantidade + peca.aMais;
      const restantes = Math.max(0, feitas - (passaram * feitas) / feitasTotal);
      const cabem = peca.fichaId === null ? undefined : cabemPorFicha.get(peca.fichaId);
      const divisor = cabem === undefined ? 0 : ehBiscoito ? cabem.biscoito : cabem.esmalte;
      if (cabem === undefined || !cabem.cabe || !Number.isFinite(divisor) || divisor <= 0) {
        semEstimativa += restantes;
        continue;
      }
      if (ehBiscoito) {
        biscoito += restantes / divisor;
      } else {
        esmalte += restantes / divisor;
      }
    }
  }

  return {
    biscoito: arredondarUmaCasa(biscoito),
    esmalte: arredondarUmaCasa(esmalte),
    pecasSemEstimativa: Math.round(semEstimativa),
  };
}

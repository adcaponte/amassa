// Módulo puro da Produção (Fase 06.1) — o quadro por etapa: seis colunas em ordem fixa, cada ordem
// ATIVA na coluna da sua etapa atual. Nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`
// (grep de aceite do plano 06.1-01). Filtros e os três números do topo são do plano 08.

import { ORDEM_DAS_COLUNAS, type EtapaProducao } from "./etapas";
import { etapaAtual, type OrdemParaLeitura } from "./leitura";

export type ColunaDoQuadro<T> = { etapa: EtapaProducao; ordens: T[] };

// Ordem dentro da coluna: `inicio`, depois nome (`localeCompare` pt-BR) e, em último caso, id —
// duas ordens começadas no mesmo dia e com o mesmo nome têm ordem determinística, nunca a que o
// banco devolveu por acaso (molde de `ordenarParaGantt`, PRD-01 · ordering). Sem início (só a
// aguardando tem), vem antes das que têm. Devolve uma cópia; a lista recebida não muda.
export function ordenarNaColuna<
  T extends { readonly inicio: string | null; readonly nome: string; readonly id: string },
>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => {
    const inicioA = a.inicio ?? "";
    const inicioB = b.inicio ?? "";
    if (inicioA !== inicioB) {
      return inicioA < inicioB ? -1 : 1;
    }
    const porNome = a.nome.localeCompare(b.nome, "pt-BR");
    if (porNome !== 0) {
      return porNome;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// As seis colunas, sempre todas (a coluna vazia também é informação). Aguardando, concluída e
// cancelada ficam de fora — aguardando tem seção própria (plano 03). Ordem do caminho que termina no
// biscoito, depois da queima de biscoito, está na etapa `entrega` — cai em "Entrega / estoque".
export function colunasDoQuadro<T extends OrdemParaLeitura & { id: string; nome: string }>(
  ordens: readonly T[],
): ColunaDoQuadro<T>[] {
  const porEtapa = new Map<EtapaProducao, T[]>(ORDEM_DAS_COLUNAS.map((etapa) => [etapa, []]));
  for (const ordem of ordens) {
    if (ordem.status !== "ativa") {
      continue;
    }
    const atual = etapaAtual(ordem);
    if (atual === null) {
      continue;
    }
    porEtapa.get(atual.etapa)?.push(ordem);
  }
  return ORDEM_DAS_COLUNAS.map((etapa) => ({
    etapa,
    ordens: ordenarNaColuna(porEtapa.get(etapa) ?? []),
  }));
}

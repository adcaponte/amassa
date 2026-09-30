// Módulo puro da Produção (Fase 06.1) — o quadro por etapa: seis colunas em ordem fixa, cada ordem
// ATIVA na coluna da sua etapa atual. Nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`
// (grep de aceite do plano 06.1-01). Filtros e os três números do topo: plano 08.

import { ETAPAS_DE_QUEIMA, ORDEM_DAS_COLUNAS, type EtapaProducao, type TipoOrdem } from "./etapas";
// Só o TIPO — `forno.ts` importa `colunasDoQuadro` daqui; um import de valor fecharia um ciclo.
import type { FornadasEstimadas } from "./forno";
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

// Os filtros do quadro (PRD-05), na ordem das pílulas "Tudo · Encomendas · Da casa". O filtro é
// estado do cliente (não vai para a URL) e começa em "todas".
export type FiltroDoQuadro = "todas" | TipoOrdem;
export const FILTROS_DO_QUADRO: readonly FiltroDoQuadro[] = ["todas", "encomenda", "casa"];

// "encomenda" e "casa" são disjuntos e cobrem tudo (cada ordem tem exatamente um tipo). Devolve uma
// cópia na mesma ordem; a lista recebida não muda.
export function filtrarOrdens<T extends { readonly tipo: TipoOrdem }>(
  ordens: readonly T[],
  filtro: FiltroDoQuadro,
): T[] {
  return filtro === "todas" ? [...ordens] : ordens.filter((ordem) => ordem.tipo === filtro);
}

// As duas vistas da Produção (plano 09, PRD-07, UI-D18): "Quadro por etapa" e "Linha do tempo". A
// escolha fica num cookie por navegador (`path=/gestao`, 1 ano), escrito no cliente ao trocar e lido
// no servidor antes de pintar — sem piscar a vista errada. O valor vem do navegador: qualquer coisa
// fora da união fechada vira "quadro" (T-06.1-34); o cookie não alimenta consulta nem HTML cru.
export type VistaDaProducao = "quadro" | "tempo";
export const NOME_DO_COOKIE_DA_VISTA = "producao_vista";

export function vistaDoCookie(valor: string | null | undefined): VistaDaProducao {
  return valor === "tempo" ? "tempo" : "quadro";
}

export type NumerosDoTopo = {
  // "EM PRODUÇÃO": as ordens liberadas e as peças delas (pedido + a mais).
  emProducao: { ordens: number; pecas: number };
  // "ESPERANDO O FORNO": as ordens nas colunas de queima e as fornadas estimadas da fila.
  esperandoOForno: { ordens: number; fornadas: FornadasEstimadas };
  // "AGUARDANDO SINAL".
  aguardando: number;
};

// Os três números do topo, sobre as ordens JÁ filtradas (os três obedecem ao filtro — protótipo
// 272-276). A fila do forno são as colunas de queima do próprio quadro, a mesma conta de
// `esperandoOForno`; as fornadas chegam prontas (`fornadasEstimadas` da mesma fila, filtrada igual).
export function numerosDoTopo<
  T extends OrdemParaLeitura & {
    id: string;
    nome: string;
    readonly totalPecas: number;
    readonly totalAMais: number;
  },
>(ordens: readonly T[], fornadas: FornadasEstimadas): NumerosDoTopo {
  const ativas = ordens.filter((ordem) => ordem.status === "ativa");
  const naFila = colunasDoQuadro(ativas)
    .filter((coluna) => ETAPAS_DE_QUEIMA.includes(coluna.etapa))
    .reduce((total, coluna) => total + coluna.ordens.length, 0);
  return {
    emProducao: {
      ordens: ativas.length,
      pecas: ativas.reduce((total, ordem) => total + ordem.totalPecas + ordem.totalAMais, 0),
    },
    esperandoOForno: { ordens: naFila, fornadas },
    aguardando: ordens.filter((ordem) => ordem.status === "aguardando_sinal").length,
  };
}

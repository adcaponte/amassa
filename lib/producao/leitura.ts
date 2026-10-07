// Módulo puro da Produção (Fase 06.1) — a LEITURA de uma ordem: qual é a etapa atual, há quantos
// dias ela está nesta etapa, a previsão de conclusão, a folga contra a entrega prometida e o selo.
// Só imports de módulos puros da própria pasta; nenhuma linha alcança React, Next, drizzle-orm, pg
// ou `@/db` (grep de aceite do plano 06.1-01). "Hoje" é sempre argumento (`YYYY-MM-DD`).
//
// O modelo novo só LÊ `feita_em` (PRD-12): a etapa atual é a primeira sem data, e nenhuma conta
// aqui deduz a etapa pelo calendário — isso era o cronograma calculado das Encomendas.

import { diasEntre, somarDias } from "./calendario";
import {
  etapasIniciais,
  type CaminhoOrdem,
  type EtapaProducao,
  type StatusOrdem,
  type TipoOrdem,
} from "./etapas";

export type EtapaDaOrdem = {
  etapa: EtapaProducao;
  posicao: number;
  diasPrevistos: number;
  feitaEm: string | null;
  passaram: number | null;
};

export type OrdemParaLeitura = {
  tipo: TipoOrdem;
  caminho: CaminhoOrdem;
  status: StatusOrdem;
  entregaPrometida: string | null;
  inicio: string | null;
  etapas: readonly EtapaDaOrdem[];
};

export type LeituraDaOrdem =
  | { tipo: "aguardando" }
  | { tipo: "concluida" }
  | { tipo: "cancelada" }
  | {
      tipo: "em-andamento";
      etapa: EtapaProducao;
      indice: number;
      // O dia em que esta etapa começou: o `feita_em` da anterior, ou o início da ordem.
      desde: string;
      diasNestaEtapa: number;
      previstoDaEtapa: number;
      // Dias nesta etapa além do previsto (0 se ainda dentro).
      estouroDias: number;
      previsaoDeConclusao: string;
      // Entrega prometida − previsão; `null` sem entrega prometida (casa, pedido de boca sem data).
      folgaDias: number | null;
    };

export type Selo =
  | { tipo: "aguardando-sinal" }
  | { tipo: "vai-atrasar"; dias: number }
  | { tipo: "passou-nesta-etapa"; dias: number }
  | { tipo: "no-ritmo" }
  | { tipo: "encerrada" }
  | { tipo: "cancelada" };

// As etapas por posição (cópia — nunca muda a lista de quem chamou), conferindo as duas invariantes
// que o banco não expressa: as feitas formam um PREFIXO do caminho, e o `feita_em` delas não
// decresce (uma etapa não termina antes da anterior; no mesmo dia pode). Qualquer das duas quebrada
// é dado corrompido — RangeError dizendo qual etapa, nunca uma leitura inventada.
export function etapasOrdenadas(ordem: Pick<OrdemParaLeitura, "etapas">): EtapaDaOrdem[] {
  const etapas = [...ordem.etapas].sort((a, b) => a.posicao - b.posicao);
  let achouNaoFeita = false;
  let anterior: EtapaDaOrdem | null = null;
  for (const etapa of etapas) {
    if (etapa.feitaEm === null) {
      achouNaoFeita = true;
      continue;
    }
    if (achouNaoFeita) {
      throw new RangeError(
        `Etapa "${etapa.etapa}" feita depois de uma etapa ainda não feita — as feitas precisam ser um prefixo do caminho.`,
      );
    }
    // Datas civis `YYYY-MM-DD`: a comparação de texto é a de calendário.
    if (anterior !== null && etapa.feitaEm < (anterior.feitaEm as string)) {
      throw new RangeError(
        `Etapa "${etapa.etapa}" feita em ${etapa.feitaEm}, antes de "${anterior.etapa}" (${anterior.feitaEm}) — as datas das feitas não podem voltar no tempo.`,
      );
    }
    anterior = etapa;
  }
  return etapas;
}

// A primeira etapa sem `feita_em`, com o índice dela no caminho; `null` se todas estão feitas.
export function etapaAtual(
  ordem: Pick<OrdemParaLeitura, "etapas">,
): { etapa: EtapaProducao; indice: number } | null {
  const etapas = etapasOrdenadas(ordem);
  const indice = etapas.findIndex((etapa) => etapa.feitaEm === null);
  return indice === -1 ? null : { etapa: etapas[indice].etapa, indice };
}

export function leituraDaOrdem(ordem: OrdemParaLeitura, hoje: string): LeituraDaOrdem {
  if (ordem.status === "aguardando_sinal") {
    return { tipo: "aguardando" };
  }
  if (ordem.status === "concluida") {
    return { tipo: "concluida" };
  }
  if (ordem.status === "cancelada") {
    return { tipo: "cancelada" };
  }

  if (ordem.inicio === null) {
    throw new RangeError("Ordem ativa sem início — o banco exige início em toda ordem liberada.");
  }
  const etapas = etapasOrdenadas(ordem);
  const indice = etapas.findIndex((etapa) => etapa.feitaEm === null);
  if (indice === -1) {
    throw new RangeError("Ordem ativa com todas as etapas feitas — isso é concluir, não andar.");
  }

  const atual = etapas[indice];
  const desde = indice === 0 ? ordem.inicio : (etapas[indice - 1].feitaEm as string);
  const diasNestaEtapa = Math.max(0, diasEntre(desde, hoje));
  const estouroDias = Math.max(0, diasNestaEtapa - atual.diasPrevistos);
  const futuras = etapas
    .slice(indice + 1)
    .reduce((total, etapa) => total + etapa.diasPrevistos, 0);
  const previsaoDeConclusao = somarDias(
    hoje,
    Math.max(0, atual.diasPrevistos - diasNestaEtapa) + futuras,
  );
  const folgaDias =
    ordem.entregaPrometida === null ? null : diasEntre(previsaoDeConclusao, ordem.entregaPrometida);

  return {
    tipo: "em-andamento",
    etapa: atual.etapa,
    indice,
    desde,
    diasNestaEtapa,
    previstoDaEtapa: atual.diasPrevistos,
    estouroDias,
    previsaoDeConclusao,
    folgaDias,
  };
}

// O selo do cartão, na prioridade do briefing §4: aguardando › vai atrasar › +N nesta etapa ›
// no ritmo. Atrasada E estourada mostra só "vai atrasar"; sem entrega prometida nunca "vai atrasar".
export function seloDaOrdem(leitura: LeituraDaOrdem): Selo {
  if (leitura.tipo === "aguardando") {
    return { tipo: "aguardando-sinal" };
  }
  if (leitura.tipo === "cancelada") {
    return { tipo: "cancelada" };
  }
  if (leitura.tipo !== "em-andamento") {
    return { tipo: "encerrada" };
  }
  if (leitura.folgaDias !== null && leitura.folgaDias < 0) {
    return { tipo: "vai-atrasar", dias: -leitura.folgaDias };
  }
  if (leitura.estouroDias > 0) {
    return { tipo: "passou-nesta-etapa", dias: leitura.estouroDias };
  }
  return { tipo: "no-ritmo" };
}

// Quantos dias cada etapa FEITA levou: do `desde` dela (o `feita_em` da anterior, ou o início) até
// o `feita_em` dela. Etapas não feitas não aparecem. Sem início (dado incoerente), a primeira não
// tem de onde contar e fica de fora.
export function levouDias(
  ordem: Pick<OrdemParaLeitura, "inicio" | "etapas">,
): ReadonlyMap<EtapaProducao, number> {
  const etapas = etapasOrdenadas(ordem);
  const levou = new Map<EtapaProducao, number>();
  let desde = ordem.inicio;
  for (const etapa of etapas) {
    if (etapa.feitaEm === null) {
      break;
    }
    if (desde !== null) {
      levou.set(etapa.etapa, Math.max(0, diasEntre(desde, etapa.feitaEm)));
    }
    desde = etapa.feitaEm;
  }
  return levou;
}

export type PrevisaoDaNovaOrdem = {
  // A soma dos previstos padrão do caminho (32 no completo, 27 no biscoito).
  diasDasEtapas: number;
  // A previsão de conclusão se a ordem começasse hoje.
  prontaEm: string;
  // Quantos dias a previsão passa da entrega prometida; `null` quando cabe ou não há data.
  diasDepoisDaEntrega: number | null;
};

// A previsão de uma ordem que AINDA NÃO EXISTE (Fase 06.5, D-11): a folha "Nova ordem" avisa, antes
// de criar, que a entrega escolhida não cabe. Monta a ordem como ela nasce — ativa, início hoje, as
// etapas de `etapasIniciais(caminho)`, nenhuma feita — e lê com `leituraDaOrdem`: a MESMA conta que
// dá o "vai atrasar N dias" do cartão depois de criada. A encomenda que nasce aguardando o sinal
// recebe a mesma conta (o melhor caso: se o sinal chegasse hoje). `hoje` vem do servidor.
export function previsaoDaNovaOrdem({
  caminho,
  hoje,
  entregaPrometida,
}: {
  caminho: CaminhoOrdem;
  hoje: string;
  entregaPrometida: string | null;
}): PrevisaoDaNovaOrdem {
  const etapas = etapasIniciais(caminho).map((etapa) => ({
    ...etapa,
    feitaEm: null,
    passaram: null,
  }));
  const leitura = leituraDaOrdem(
    { tipo: "encomenda", caminho, status: "ativa", entregaPrometida, inicio: hoje, etapas },
    hoje,
  );
  if (leitura.tipo !== "em-andamento") {
    // Inalcançável: uma ordem ativa com etapas por fazer sempre está em andamento.
    throw new RangeError("Ordem nova sem leitura em andamento.");
  }
  const diasDasEtapas = etapas.reduce((total, etapa) => total + etapa.diasPrevistos, 0);
  const diasDepoisDaEntrega =
    leitura.folgaDias !== null && leitura.folgaDias < 0 ? -leitura.folgaDias : null;
  return { diasDasEtapas, prontaEm: leitura.previsaoDeConclusao, diasDepoisDaEntrega };
}

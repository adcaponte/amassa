// Módulo puro da Produção (Fase 06.1) — as TRANSIÇÕES de uma ordem, decididas sem banco: quem chama
// lê a ordem sob a trava (`lib/producao/gravacao.ts::travarOrdem`), chama o plano daqui com o "hoje"
// do servidor e grava o que ele devolveu. Nenhuma linha alcança React, Next, drizzle-orm, pg ou
// `@/db` (grep de aceite do plano 06.1-01).
//
// "Terminei" (plano 01), "Liberar" (plano 03) e, no plano 05, desfazer a última, ajustar os dias
// previstos e o parcial; no plano 06, cancelar.

import type { EtapaProducao, StatusOrdem } from "./etapas";
import { etapasOrdenadas, type OrdemParaLeitura } from "./leitura";

export type PlanoDeTerminar =
  | {
      tipo: "ok";
      etapa: EtapaProducao;
      // Sempre o "hoje" do servidor — a data de uma etapa feita nunca vem do cliente.
      feitaEm: string;
      proxima: EtapaProducao;
      // O parcial ("já passaram N") é da etapa que termina — não sobrevive a ela (Pitfall 8).
      limparPassaram: true;
    }
  | { tipo: "recusa"; motivo: "ja-marcada" | "nao-ativa" | "ultima-etapa" };

// "Terminei: {etapa}" — a ação manda a etapa que o botão MOSTRAVA (`etapaEsperada`). Se a atual,
// lida sob a trava, já é outra, alguém marcou antes (toque duplo, outro celular): recusa sem
// gravar (Pitfall 7). A última etapa não se "termina" — isso é concluir a ordem (plano 11).
export function planejarTerminar(
  ordem: OrdemParaLeitura,
  etapaEsperada: EtapaProducao,
  hoje: string,
): PlanoDeTerminar {
  if (ordem.status !== "ativa") {
    return { tipo: "recusa", motivo: "nao-ativa" };
  }
  const etapas = etapasOrdenadas(ordem);
  const indice = etapas.findIndex((etapa) => etapa.feitaEm === null);
  if (indice === -1 || etapas[indice].etapa !== etapaEsperada) {
    return { tipo: "recusa", motivo: "ja-marcada" };
  }
  if (indice === etapas.length - 1) {
    return { tipo: "recusa", motivo: "ultima-etapa" };
  }
  return {
    tipo: "ok",
    etapa: etapaEsperada,
    feitaEm: hoje,
    proxima: etapas[indice + 1].etapa,
    limparPassaram: true,
  };
}

export type PlanoDeLiberacao =
  | {
      tipo: "ok";
      // Sempre o "hoje" do servidor — a data de início nunca vem do cliente.
      inicio: string;
    }
  | { tipo: "recusa"; motivo: "ja-liberada" | "cancelada" };

// "Sinal recebido — começar" / "Começar assim mesmo" (PRD-11): as duas liberam do mesmo jeito. Só
// a ordem aguardando o sinal se libera; o início vira o dia da liberação. Lida sob a trava, a ordem
// que já não aguarda foi liberada (ou até concluída) noutro celular — recusa sem gravar, e o início
// não muda. A cancelada tem frase própria.
export function planejarLiberacao(
  ordem: { status: StatusOrdem; inicio: string | null },
  hoje: string,
): PlanoDeLiberacao {
  if (ordem.status === "aguardando_sinal") {
    return { tipo: "ok", inicio: hoje };
  }
  if (ordem.status === "cancelada") {
    return { tipo: "recusa", motivo: "cancelada" };
  }
  return { tipo: "recusa", motivo: "ja-liberada" };
}

export type PlanoDeDesfazer =
  | {
      tipo: "ok";
      etapa: EtapaProducao;
      // Depois de desfazer, a etapa desfeita volta a ser a atual e a que era atual volta a ser
      // futura: nenhuma das duas guarda parcial (Pitfall 8 — o desfazer não restaura o parcial da
      // etapa desfeita, e o da que era atual não pode sobrar numa etapa futura).
      limparParciais: true;
    }
  | { tipo: "recusa"; motivo: "nao-ativa" | "nada-a-desfazer" | "ja-desfeita" };

// "Desfazer a última" (PRD-03) — a ação manda a etapa que a confirmação MOSTRAVA (`etapaEsperada`).
// Só a ÚLTIMA feita se desfaz; lida sob a trava, se a última feita já é outra (outro celular
// desfez ou marcou antes), recusa sem gravar (Pitfall 7). Só ordem ativa: aguardando não tem feita,
// e concluída/cancelada valem pelo que aconteceu.
export function planejarDesfazer(
  ordem: OrdemParaLeitura,
  etapaEsperada: EtapaProducao,
): PlanoDeDesfazer {
  if (ordem.status !== "ativa") {
    return { tipo: "recusa", motivo: "nao-ativa" };
  }
  const etapas = etapasOrdenadas(ordem);
  const primeiraNaoFeita = etapas.findIndex((etapa) => etapa.feitaEm === null);
  const indiceDaUltimaFeita = (primeiraNaoFeita === -1 ? etapas.length : primeiraNaoFeita) - 1;
  if (indiceDaUltimaFeita < 0) {
    return { tipo: "recusa", motivo: "nada-a-desfazer" };
  }
  if (etapas[indiceDaUltimaFeita].etapa !== etapaEsperada) {
    return { tipo: "recusa", motivo: "ja-desfeita" };
  }
  return { tipo: "ok", etapa: etapaEsperada, limparParciais: true };
}

// Os limites dos dias previstos de uma etapa — os mesmos do check `ordem_etapas_dias_previstos_faixa`.
export const DIAS_PREVISTOS_MINIMO = 1;
export const DIAS_PREVISTOS_MAXIMO = 365;

export type PlanoDeAjuste =
  | { tipo: "ok"; etapa: EtapaProducao; diasPrevistos: number }
  | { tipo: "recusa"; motivo: "nao-ativa" | "nao-futura" | "limite" | "delta-invalido" };

// "−"/"+" nos dias previstos (PRD-12): um dia por toque, SÓ em etapa futura — a feita e a atual
// valem pelo que aconteceu. Na ordem aguardando o sinal nada começou: todas as etapas são futuras
// (o dono configura a ordem inteira antes de liberar). Concluída ou cancelada não se ajusta. O
// resultado fica em 1..365; fora disso, recusa (o botão já estava desabilitado — só chega aqui se
// outro celular mexeu antes).
export function planejarAjusteDePrevisto(
  ordem: OrdemParaLeitura,
  etapa: EtapaProducao,
  delta: number,
): PlanoDeAjuste {
  if (delta !== 1 && delta !== -1) {
    return { tipo: "recusa", motivo: "delta-invalido" };
  }
  if (ordem.status !== "ativa" && ordem.status !== "aguardando_sinal") {
    return { tipo: "recusa", motivo: "nao-ativa" };
  }
  const etapas = etapasOrdenadas(ordem);
  const indice = etapas.findIndex((linha) => linha.etapa === etapa);
  if (indice === -1) {
    // Etapa fora do caminho (esmaltação numa ordem que termina no biscoito).
    return { tipo: "recusa", motivo: "nao-futura" };
  }
  if (ordem.status === "ativa") {
    const atual = etapas.findIndex((linha) => linha.feitaEm === null);
    if (atual === -1 || indice <= atual) {
      return { tipo: "recusa", motivo: "nao-futura" };
    }
  }
  const diasPrevistos = etapas[indice].diasPrevistos + delta;
  if (diasPrevistos < DIAS_PREVISTOS_MINIMO || diasPrevistos > DIAS_PREVISTOS_MAXIMO) {
    return { tipo: "recusa", motivo: "limite" };
  }
  return { tipo: "ok", etapa, diasPrevistos };
}

// Quantas peças a ordem faz de verdade: o pedido mais as a mais de segurança — o "{total}" do
// campo "já passaram [ ] de {total}".
export function totalDeFeitas(pecas: readonly { quantidade: number; aMais: number }[]): number {
  return pecas.reduce((total, peca) => total + peca.quantidade + peca.aMais, 0);
}

export type PlanoDoParcial =
  | {
      tipo: "ok";
      // `null` = sem parcial (campo vazio ou zero).
      passaram: number | null;
    }
  | { tipo: "recusa"; motivo: "nao-ativa" | "etapa-mudou" | "ultima-etapa" | "fora-da-faixa" };

// "Já passaram [ ] de {total}" (PRD-06): informativo — NUNCA move a ordem (a etapa só termina
// quando todas as peças passaram por ela, e quem diz isso é o "Terminei"). Só na etapa ATUAL de
// ordem ativa, contra a etapa que a tela mostrava; nunca na entrega (lá é a conclusão que conta).
// `passaram` já chega inteiro ≥ 0 ou `null` (o Zod converteu o texto); a faixa superior é o total
// de feitas, lido sob a trava. Vazio e zero são "sem parcial".
export function planejarParcial(
  ordem: OrdemParaLeitura,
  etapaEsperada: EtapaProducao,
  passaram: number | null,
  total: number,
): PlanoDoParcial {
  if (ordem.status !== "ativa") {
    return { tipo: "recusa", motivo: "nao-ativa" };
  }
  const etapas = etapasOrdenadas(ordem);
  const indice = etapas.findIndex((linha) => linha.feitaEm === null);
  if (indice === -1 || etapas[indice].etapa !== etapaEsperada) {
    return { tipo: "recusa", motivo: "etapa-mudou" };
  }
  if (indice === etapas.length - 1) {
    return { tipo: "recusa", motivo: "ultima-etapa" };
  }
  if (passaram === null || passaram === 0) {
    return { tipo: "ok", passaram: null };
  }
  if (!Number.isInteger(passaram) || passaram < 0 || passaram > total) {
    return { tipo: "recusa", motivo: "fora-da-faixa" };
  }
  return { tipo: "ok", passaram };
}

export type PlanoDeCancelamento = { tipo: "ok" } | { tipo: "recusa"; motivo: "ja-encerrada" };

// "Cancelar ordem" (PRD-18) — lida sob a trava. Só a ordem aguardando o sinal ou ativa se cancela;
// concluída e cancelada valem pelo que aconteceu (o segundo toque, noutro celular, recebe a frase
// de estado mudado e nada é gravado). O plano decide SÓ o status da ordem: cancelar a ordem nunca
// cancela a venda, nunca toca parcela e nunca devolve material ao estoque (briefing §6) — a ação
// não escreve em nenhuma dessas tabelas.
export function planejarCancelamento(ordem: { status: StatusOrdem }): PlanoDeCancelamento {
  if (ordem.status === "aguardando_sinal" || ordem.status === "ativa") {
    return { tipo: "ok" };
  }
  return { tipo: "recusa", motivo: "ja-encerrada" };
}

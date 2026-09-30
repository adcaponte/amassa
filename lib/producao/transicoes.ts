// Módulo puro da Produção (Fase 06.1) — as TRANSIÇÕES de uma ordem, decididas sem banco: quem chama
// lê a ordem sob a trava (`lib/producao/gravacao.ts::travarOrdem`), chama o plano daqui com o "hoje"
// do servidor e grava o que ele devolveu. Nenhuma linha alcança React, Next, drizzle-orm, pg ou
// `@/db` (grep de aceite do plano 06.1-01).
//
// Neste plano, só "Terminei". Desfazer, ajustar previsto, liberar, parcial e cancelar são dos planos
// 03, 05 e 06.

import type { EtapaProducao } from "./etapas";
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

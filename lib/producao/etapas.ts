// Módulo puro da Produção (Fase 06.1) — as etapas, os dois caminhos e os dias previstos padrão.
// Zero imports: nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db` (grep de aceite do
// plano 06.1-01). As uniões abaixo são REDECLARADAS à mão, espelhando os enums da migração 0024
// (`etapa_producao`, `caminho_ordem`, `tipo_ordem`, `status_ordem`) — nenhum import de
// `@/db/schema` é permitido aqui; `tests/unit/producao-etapas.test.ts` compara as listas com os
// `enumValues` de `db/schema.ts`.

export type EtapaProducao = "producao" | "secagem" | "queima1" | "esmaltacao" | "queima2" | "entrega";
export type CaminhoOrdem = "completo" | "biscoito";
export type TipoOrdem = "encomenda" | "casa";
export type StatusOrdem = "aguardando_sinal" | "ativa" | "concluida" | "cancelada";

// As seis colunas do quadro, em ordem fixa — as mesmas seis etapas, na ordem do caminho completo.
export const ORDEM_DAS_COLUNAS: readonly EtapaProducao[] = [
  "producao",
  "secagem",
  "queima1",
  "esmaltacao",
  "queima2",
  "entrega",
];

export const CAMINHOS_DE_ORDEM: readonly CaminhoOrdem[] = ["completo", "biscoito"];
export const TIPOS_DE_ORDEM: readonly TipoOrdem[] = ["encomenda", "casa"];
export const STATUS_DE_ORDEM: readonly StatusOrdem[] = [
  "aguardando_sinal",
  "ativa",
  "concluida",
  "cancelada",
];

// Os dois caminhos (PRD-04): o que termina no biscoito é subsequência do completo, e a entrega
// fecha os dois.
export const ETAPAS_DO_CAMINHO: Readonly<Record<CaminhoOrdem, readonly EtapaProducao[]>> = {
  completo: ORDEM_DAS_COLUNAS,
  biscoito: ["producao", "secagem", "queima1", "entrega"],
};

// D-10 (dono, 30/09/2026): os `DIAS_PADRAO` da 04.1 com a espera SOMADA à etapa seguinte —
// 32 dias no caminho completo (o mesmo total prometido até então) e 27 no que termina no
// biscoito. Existem TRÊS cópias destes números: esta, o bloco (b) do D-02 em
// `db/migrations/0024_producao.sql` e o teste que lê aquele arquivo e compara com esta.
export const DIAS_PREVISTOS_PADRAO: Readonly<Record<EtapaProducao, number>> = {
  producao: 5,
  secagem: 15,
  queima1: 1,
  esmaltacao: 1,
  queima2: 4,
  entrega: 6,
};

// As etapas que esperam o forno (a fila do forno, plano 08).
export const ETAPAS_DE_QUEIMA: readonly EtapaProducao[] = ["queima1", "queima2"];

export type EtapaInicial = { etapa: EtapaProducao; posicao: number; diasPrevistos: number };

// As linhas de `ordem_etapas` com que uma ordem nasce: uma por etapa do caminho, posição = índice
// no caminho, os previstos padrão, nenhuma feita.
export function etapasIniciais(caminho: CaminhoOrdem): EtapaInicial[] {
  return ETAPAS_DO_CAMINHO[caminho].map((etapa, posicao) => ({
    etapa,
    posicao,
    diasPrevistos: DIAS_PREVISTOS_PADRAO[etapa],
  }));
}

const ROTULO_DA_ETAPA: Readonly<Record<EtapaProducao, string>> = {
  producao: "Produção",
  secagem: "Secagem",
  queima1: "Queima de biscoito",
  esmaltacao: "Esmaltação",
  queima2: "Queima de esmalte",
  entrega: "Entrega",
};

// O nome da etapa como a tela escreve (UI-SPEC §Vocabulário): a última é "Entrega" na encomenda e
// "Guardar no estoque" na produção da casa.
export function rotuloDaEtapa(etapa: EtapaProducao, tipo: TipoOrdem): string {
  if (etapa === "entrega" && tipo === "casa") {
    return "Guardar no estoque";
  }
  return ROTULO_DA_ETAPA[etapa];
}

// O nome da coluna do quadro (e da seção da folha geral): a última junta os dois tipos.
export function rotuloDaColuna(etapa: EtapaProducao): string {
  return etapa === "entrega" ? "Entrega / estoque" : ROTULO_DA_ETAPA[etapa];
}

// Verdadeiro para um texto que é uma das seis etapas — a borda (URL, formulário) usa antes de
// confiar num valor vindo de fora.
export function ehEtapaProducao(valor: string): valor is EtapaProducao {
  return (ORDEM_DAS_COLUNAS as readonly string[]).includes(valor);
}

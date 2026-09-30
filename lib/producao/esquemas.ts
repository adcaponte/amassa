// Ponto único de validação das ações da Produção (CLAUDE.md §Validação): a Server Action valida
// AQUI, no servidor, sempre. Molde de `lib/estoque/esquemas.ts`.
//
// Do cliente chegam SÓ o id da ordem e a etapa que o botão mostrava (T-06.1-03). A data da etapa
// feita, a etapa atual e a próxima são decididas no servidor, sob a trava da ordem — nunca aceitas
// daqui.
import { z } from "zod";

import { ORDEM_DAS_COLUNAS, type EtapaProducao } from "./etapas";
import { FRASE_JA_MARCADA, FRASE_ORDEM_NAO_EXISTE } from "./textos";

const ETAPAS = ORDEM_DAS_COLUNAS as unknown as readonly [EtapaProducao, ...EtapaProducao[]];

export const esquemaTerminarEtapa = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
  etapaEsperada: z.enum(ETAPAS, { error: FRASE_JA_MARCADA }),
});

export type TerminarEtapaValidado = z.infer<typeof esquemaTerminarEtapa>;

// "Sinal recebido — começar" / "Começar assim mesmo" (plano 03): só o id da ordem. O status e a
// data de início são decididos no servidor, sob a trava da ordem (T-06.1-12).
export const esquemaLiberarOrdem = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
});

export type LiberarOrdemValidado = z.infer<typeof esquemaLiberarOrdem>;

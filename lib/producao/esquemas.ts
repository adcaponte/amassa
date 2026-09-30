// Ponto único de validação das ações da Produção (CLAUDE.md §Validação): a Server Action valida
// AQUI, no servidor, sempre. Molde de `lib/estoque/esquemas.ts`.
//
// Do cliente chegam SÓ o id da ordem e a etapa que o botão mostrava (T-06.1-03). A data da etapa
// feita, a etapa atual e a próxima são decididas no servidor, sob a trava da ordem — nunca aceitas
// daqui.
import { z } from "zod";

import { ORDEM_DAS_COLUNAS, type EtapaProducao } from "./etapas";
import {
  FRASE_A_MAIS_INVALIDO,
  FRASE_JA_MARCADA,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_PECA_NAO_EXISTE,
} from "./textos";

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

// "Fazer a mais, de segurança" (plano 04, PRD-08): o texto do campo vira inteiro UMA vez, aqui. Só
// dígitos (nada de vírgula, ponto, sinal ou expoente — "2,5" e "1e3" são recusados, não
// arredondados), de 0 a 100.000 — o mesmo intervalo do check `ordem_pecas_a_mais_faixa`. Vazio é
// zero: apagar o campo tira as a mais.
export const A_MAIS_MAXIMO = 100000;

const esquemaAMais = z.string({ error: FRASE_A_MAIS_INVALIDO }).transform((texto, contexto) => {
  const limpo = texto.trim();
  if (limpo === "") {
    return 0;
  }
  if (!/^\d{1,6}$/.test(limpo) || Number(limpo) > A_MAIS_MAXIMO) {
    contexto.addIssue({ code: "custom", message: FRASE_A_MAIS_INVALIDO });
    return z.NEVER;
  }
  return Number(limpo);
});

export const esquemaDefinirAMais = z
  .object({
    ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
    pecaId: z.string().uuid(FRASE_PECA_NAO_EXISTE),
    aMaisTexto: esquemaAMais,
  })
  .transform(({ ordemId, pecaId, aMaisTexto }) => ({ ordemId, pecaId, aMais: aMaisTexto }));

export type DefinirAMaisValidado = z.infer<typeof esquemaDefinirAMais>;

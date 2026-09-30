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
  FRASE_FALHA_AO_AJUSTAR,
  FRASE_JA_DESFEITA,
  FRASE_JA_MARCADA,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_PARCIAL_ETAPA_MUDOU,
  FRASE_PARCIAL_NAO_INTEIRO,
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

// "Desfazer a última" (plano 05, PRD-03): o id e a etapa que a confirmação mostrava — o servidor só
// desfaz se ela ainda for a última feita, sob a trava (Pitfall 7).
export const esquemaDesfazerEtapa = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
  etapaEsperada: z.enum(ETAPAS, { error: FRASE_JA_DESFEITA }),
});

export type DesfazerEtapaValidado = z.infer<typeof esquemaDesfazerEtapa>;

// "−"/"+" nos dias previstos (plano 05, PRD-12): um dia por toque — nunca um número digitado.
export const esquemaAjustarDiasPrevistos = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
  etapa: z.enum(ETAPAS, { error: FRASE_FALHA_AO_AJUSTAR }),
  delta: z.union([z.literal(-1), z.literal(1)], { error: FRASE_FALHA_AO_AJUSTAR }),
});

export type AjustarDiasPrevistosValidado = z.infer<typeof esquemaAjustarDiasPrevistos>;

// "Já passaram [ ] de {total}" (plano 05, PRD-06): o texto do campo vira inteiro ≥ 0 UMA vez, aqui.
// Só dígitos — "2,5", "1e3", "-1" são recusados, não arredondados. Vazio é `null` (sem parcial). A
// faixa superior (o total de feitas) não é daqui: o módulo puro a decide sob a trava, lendo as
// peças da ordem.
const esquemaPassaram = z
  .string({ error: FRASE_PARCIAL_NAO_INTEIRO })
  .transform((texto, contexto): number | null => {
    const limpo = texto.trim();
    if (limpo === "") {
      return null;
    }
    if (!/^\d{1,9}$/.test(limpo)) {
      contexto.addIssue({ code: "custom", message: FRASE_PARCIAL_NAO_INTEIRO });
      return z.NEVER;
    }
    return Number(limpo);
  });

export const esquemaRegistrarParcial = z
  .object({
    ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
    etapaEsperada: z.enum(ETAPAS, { error: FRASE_PARCIAL_ETAPA_MUDOU }),
    passaramTexto: esquemaPassaram,
  })
  .transform(({ ordemId, etapaEsperada, passaramTexto }) => ({
    ordemId,
    etapaEsperada,
    passaram: passaramTexto,
  }));

export type RegistrarParcialValidado = z.infer<typeof esquemaRegistrarParcial>;

// "Cancelar ordem" (plano 06, PRD-18): só o id da ordem. O status, a data e quem cancelou são
// decididos no servidor, sob a trava da ordem — nunca aceitos daqui (T-06.1-24/25).
export const esquemaCancelarOrdem = z.object({
  ordemId: z.string().uuid(FRASE_ORDEM_NAO_EXISTE),
});

export type CancelarOrdemValidado = z.infer<typeof esquemaCancelarOrdem>;

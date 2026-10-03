// Ponto único de validação dos Lembretes (CLAUDE.md §Validação): as Server Actions de
// `lib/lembretes/acoes.ts` validam AQUI, no servidor, sempre; a tela só mostra a frase.
//
// Os tetos são os checks da 0029 — duas cópias deliberadas: `lembretes_texto_comprimento`
// (`length(trim(texto)) between 1 and 200`) × `LIMITE_DO_TEXTO`. O Zod dá a frase humana; o check é
// a barreira se o Zod for contornado. Mudar um é mudar os dois, no mesmo commit. Contado em pontos
// de código, como o `length()` do Postgres (não em bytes nem em unidades UTF-16). O texto é gravado
// já aparado (o `trim` do JS e o do Postgres diferem em espaços Unicode exóticos — aparar aqui
// resolve).
//
// Nenhum esquema aceita `criadoPor`, `feitoPor`, `feitoEm` nem `criadoEm`: autoria e momentos são
// só do servidor (o `z.object` descarta chaves desconhecidas).
import { z } from "zod";

import { ehDataCivil } from "@/lib/producao/calendario";

import {
  FRASE_DATA_INVALIDA,
  FRASE_ESCREVA_O_LEMBRETE,
  FRASE_LEMBRETE_LONGO,
  FRASE_PESSOA_INVALIDA,
} from "./textos";

export const LIMITE_DO_TEXTO = 200;

// Os campos que a tela pode marcar com erro.
export type CampoDoLembrete = "texto" | "paraQuando" | "quem";

function aparar(texto: string): string {
  return texto.normalize("NFC").trim();
}

function caracteres(texto: string): number {
  return [...texto].length;
}

const campoTexto = z
  .string({ error: FRASE_ESCREVA_O_LEMBRETE })
  .transform(aparar)
  .refine((texto) => texto.length > 0, { error: FRASE_ESCREVA_O_LEMBRETE })
  .refine((texto) => caracteres(texto) <= LIMITE_DO_TEXTO, { error: FRASE_LEMBRETE_LONGO });

// Dia civil `AAAA-MM-DD` que existe no calendário; ausente, nulo ou vazio = sem data.
const campoParaQuando = z
  .string({ error: FRASE_DATA_INVALIDA })
  .nullish()
  .transform((data) => (data ?? "").trim())
  .refine((data) => data === "" || ehDataCivil(data), { error: FRASE_DATA_INVALIDA })
  .transform((data) => (data === "" ? null : data));

// Uma pessoa de `usuarios` (a conferência de que ela está ATIVA é do servidor, na ação); ausente,
// nulo ou vazio = "geral".
const campoQuem = z
  .union([z.literal(""), z.uuid({ error: FRASE_PESSOA_INVALIDA })], { error: FRASE_PESSOA_INVALIDA })
  .nullish()
  .transform((quem) => (quem === undefined || quem === null || quem === "" ? null : quem));

export const esquemaCriarLembrete = z.object({
  texto: campoTexto,
  paraQuando: campoParaQuando,
  quem: campoQuem,
});

export const esquemaEditarLembrete = z.object({
  id: z.uuid(),
  texto: campoTexto,
  paraQuando: campoParaQuando,
  quem: campoQuem,
});

// `feito` é o estado DESEJADO, nunca "inverter": dois toques (ou duas pessoas) convergem.
export const esquemaMarcarFeito = z.object({
  id: z.uuid(),
  feito: z.boolean(),
});

export const esquemaExcluirLembrete = z.object({
  id: z.uuid(),
});

export type NovoLembrete = z.infer<typeof esquemaCriarLembrete>;
export type EdicaoDeLembrete = z.infer<typeof esquemaEditarLembrete>;
export type MarcacaoDeFeito = z.infer<typeof esquemaMarcarFeito>;
export type ExclusaoDeLembrete = z.infer<typeof esquemaExcluirLembrete>;

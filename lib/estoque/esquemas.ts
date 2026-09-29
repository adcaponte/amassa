// Ponto único de validação das ações do Estoque (CLAUDE.md §Validação): a Server Action valida
// AQUI, no servidor, sempre; a folha no celular pode reusar `textoParaMilesimos` para avisar antes,
// mas isso é conveniência, não segurança. Molde de `lib/anotacoes/esquemas.ts`.
//
// Do cliente chegam SÓ o id do item, o tipo, os TEXTOS de quantidade e de custo e o destino (T-06-03).
// Área, valor e custo médio são decididos no servidor, sob a trava — nunca aceitos daqui.
import { z } from "zod";

import { converterQuantidade, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";

import { ehDestinoDeSaida, type DestinoDeSaida } from "./destinos";
import {
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
} from "./textos";

export type ResultadoDeMilesimos = { ok: true; milesimos: number } | { ok: false; erro: string };

// "2" → 2000; "0,5" → 500; "2,250" → 2250 — MILÉSIMOS INTEIROS da unidade do item, pela mesma
// conversão de texto do resto do sistema (`converterQuantidade`, vírgula ou ponto, até 3 casas, até
// 999.999). O texto vira inteiro UMA vez, aqui; daí em diante tudo é soma de inteiros (EST-01
// precision: 5 kg − 2 kg dá 3000 milésimos exatos). Zero é recusado com a frase própria do Estoque
// (entrada e saída — o saldo contado, que aceita zero, é de outro plano).
export function textoParaMilesimos(texto: string): ResultadoDeMilesimos {
  const normalizado = texto.replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") {
    return { ok: false, erro: FRASE_QUANTIDADE_INVALIDA };
  }
  const formatoValido = /^\d+(\.\d{1,3})?$/.test(normalizado);
  if (formatoValido && Number(normalizado) === 0) {
    return { ok: false, erro: FRASE_QUANTIDADE_ZERO };
  }
  const conversao = converterQuantidade(normalizado);
  if (!conversao.ok) {
    // Formato certo mas recusado = passou do teto (a frase de `converterQuantidade` diz qual).
    return { ok: false, erro: formatoValido ? conversao.erro : FRASE_QUANTIDADE_INVALIDA };
  }
  return { ok: true, milesimos: Math.round(Number(conversao.quantidade) * 1000) };
}

const esquemaItemId = z.string().uuid(FRASE_MATERIAL_NAO_EXISTE_MAIS);

const esquemaQuantidade = z
  .string({ error: FRASE_QUANTIDADE_INVALIDA })
  .transform((texto, contexto) => {
    const resultado = textoParaMilesimos(texto);
    if (!resultado.ok) {
      contexto.addIssue({ code: "custom", message: resultado.erro });
      return z.NEVER;
    }
    return resultado.milesimos;
  });

// "Quanto custou ao todo" — obrigatório na entrada (é daí que sai o custo médio). Zero é aceito:
// uma doação ou amostra entra de graça, e o custo médio a absorve.
const esquemaCusto = z.string({ error: FRASE_CUSTO_OBRIGATORIO }).transform((texto, contexto) => {
  const conversao = converterReaisParaCentavos(texto);
  if (!conversao.ok) {
    contexto.addIssue({ code: "custom", message: conversao.erro });
    return z.NEVER;
  }
  if (conversao.centavos === null) {
    contexto.addIssue({ code: "custom", message: FRASE_CUSTO_OBRIGATORIO });
    return z.NEVER;
  }
  return conversao.centavos;
});

const esquemaDestino = z
  .unknown()
  .refine((valor): valor is DestinoDeSaida => ehDestinoDeSaida(valor), FRASE_DESTINO_OBRIGATORIO)
  .transform((valor) => valor as DestinoDeSaida);

export const esquemaRegistrarMovimentacao = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("entrada"),
    itemId: esquemaItemId,
    quantidadeTexto: esquemaQuantidade,
    custoTexto: esquemaCusto,
  }),
  z.object({
    tipo: z.literal("saida"),
    itemId: esquemaItemId,
    quantidadeTexto: esquemaQuantidade,
    destino: esquemaDestino,
  }),
]);

export type RegistrarMovimentacaoValidado = z.infer<typeof esquemaRegistrarMovimentacao>;

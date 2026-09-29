// Ponto único de validação das ações do Estoque (CLAUDE.md §Validação): a Server Action valida
// AQUI, no servidor, sempre; a folha no celular pode reusar `textoParaMilesimos` para avisar antes,
// mas isso é conveniência, não segurança. Molde de `lib/anotacoes/esquemas.ts`.
//
// Do cliente chegam SÓ o id do item, o tipo, os TEXTOS de quantidade, de custo e do contado, o
// destino e os vínculos (T-06-03). Área, valor, custo médio, a DIFERENÇA do ajuste (T-06-22) e se o
// item é peça pronta (T-06-23) são decididos no servidor, sob a trava — nunca aceitos daqui.
import { z } from "zod";

import { converterQuantidade, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";

import { DESTINOS_DE_SAIDA, ehDestinoDeSaida, type DestinoDeSaida } from "./destinos";
import {
  FRASE_CONTADO_VAZIO,
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_ENCOMENDA_FORA_DE_ANDAMENTO,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  FRASE_TEXTO_INVALIDO,
  FRASE_VINCULO_LONGO,
  LIMITE_DO_VINCULO,
} from "./textos";

export type ResultadoDeMilesimos = { ok: true; milesimos: number } | { ok: false; erro: string };

// "2" → 2000; "0,5" → 500; "2,250" → 2250 — MILÉSIMOS INTEIROS da unidade do item, pela mesma
// conversão de texto do resto do sistema (`converterQuantidade`, vírgula ou ponto, até 3 casas, até
// 999.999). O texto vira inteiro UMA vez, aqui; daí em diante tudo é soma de inteiros (EST-01
// precision: 5 kg − 2 kg dá 3000 milésimos exatos). Zero é recusado com a frase própria do Estoque
// (entrada e saída — o saldo contado, que aceita zero, passa por `contadoParaMilesimos`).
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

// O SALDO CONTADO do ajuste (EST-07, D-32): aceita zero — "a prateleira está vazia" é resposta
// válida —, pela variante EXPLÍCITA de `converterQuantidade` (Pitfall 9). Vazio tem frase própria;
// negativo, texto e mais de 3 casas recebem a frase da quantidade.
export function contadoParaMilesimos(texto: string): ResultadoDeMilesimos {
  const normalizado = texto.replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") {
    return { ok: false, erro: FRASE_CONTADO_VAZIO };
  }
  const formatoValido = /^\d+(\.\d{1,3})?$/.test(normalizado);
  const conversao = converterQuantidade(normalizado, { aceitaZero: true });
  if (!conversao.ok) {
    return { ok: false, erro: formatoValido ? conversao.erro : FRASE_QUANTIDADE_INVALIDA };
  }
  return { ok: true, milesimos: Math.round(Number(conversao.quantidade) * 1000) };
}

const esquemaContado = z.string({ error: FRASE_CONTADO_VAZIO }).transform((texto, contexto) => {
  const resultado = contadoParaMilesimos(texto);
  if (!resultado.ok) {
    contexto.addIssue({ code: "custom", message: resultado.erro });
    return z.NEVER;
  }
  return resultado.milesimos;
});

// Texto livre curto (EST-11: turma, "o que aconteceu?", motivo do ajuste): normalizado em NFC,
// aparado, CONTADO EM PONTOS DE CÓDIGO (`[...texto]`, não `.length`, que conta unidades UTF-16 —
// um emoji contaria 2) de 0 a 160; vazio vira nulo. Espelha o `check`
// `movimentacoes_estoque_nota_comprimento` do banco (`length(trim(nota)) between 1 and 160`, que
// conta caracteres), por isso nenhum texto que passa aqui é recusado lá.
const esquemaTextoLivre = z
  .string({ error: FRASE_TEXTO_INVALIDO })
  .nullish()
  .transform((texto, contexto) => {
    if (texto === null || texto === undefined) {
      return null;
    }
    const normalizado = texto.normalize("NFC").trim();
    if (normalizado === "") {
      return null;
    }
    if ([...normalizado].length > LIMITE_DO_VINCULO) {
      contexto.addIssue({ code: "custom", message: FRASE_VINCULO_LONGO });
      return z.NEVER;
    }
    return normalizado;
  });

// A encomenda do destino "Consumo em encomenda" (D-15): referência opcional à encomenda real, por
// id. "Nenhuma" chega como texto vazio → nulo. Se ela existe e está em andamento é a AÇÃO que
// confere, dentro da transação (T-06-24) — aqui só a forma.
const esquemaEncomendaId = z
  .union([z.literal(""), z.string().uuid(FRASE_ENCOMENDA_FORA_DE_ANDAMENTO)])
  .nullish()
  .transform((valor) => (valor ? valor : null));

const esquemaPorTipo = z.discriminatedUnion("tipo", [
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
    turmaTexto: esquemaTextoLivre,
    encomendaId: esquemaEncomendaId,
    oQueAconteceuTexto: esquemaTextoLivre,
  }),
  z.object({
    tipo: z.literal("ajuste"),
    itemId: esquemaItemId,
    contadoTexto: esquemaContado,
    motivoTexto: esquemaTextoLivre,
  }),
]);

// Vínculo que não corresponde ao destino marcado é IGNORADO (a folha preserva o que foi digitado
// em cada destino; só o do destino escolhido vale). A lista de destinos é a de `destinos.ts`.
export const esquemaRegistrarMovimentacao = esquemaPorTipo.transform((dados) => {
  if (dados.tipo !== "saida") {
    return dados;
  }
  const vinculo = DESTINOS_DE_SAIDA.find((destino) => destino.valor === dados.destino)?.vinculo;
  return {
    ...dados,
    turmaTexto: vinculo === "turma" ? dados.turmaTexto : null,
    encomendaId: vinculo === "encomenda" ? dados.encomendaId : null,
    oQueAconteceuTexto: vinculo === "o-que-aconteceu" ? dados.oQueAconteceuTexto : null,
  };
});

export type RegistrarMovimentacaoValidado = z.infer<typeof esquemaRegistrarMovimentacao>;

// Ponto único de validação do módulo Encomendas (D-15): os dois caminhos de escrita da fase —
// o formulário completo (`criarEncomenda`, este plano) e o ajuste rápido da trilha (plano 03) —
// atravessam este mesmo arquivo. Nenhum dos dois reimplementa a regra por conta própria.
// Validação no cliente é conveniência; esta é a que vale (CLAUDE.md §Validação).
import { z } from "zod";

import { ETAPAS_MARCO, ORDEM_DAS_ETAPAS, type Etapa } from "./cronograma";

export const esquemaItem = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, "Descreva o item — o campo não pode ficar em branco.")
    .max(200, "Descrição muito longa — no máximo 200 caracteres."),
  quantidade: z
    .number()
    .int("Quantidade precisa ser um número inteiro.")
    .positive("Quantidade precisa ser maior que zero."),
});

export type ItemDeEncomenda = z.infer<typeof esquemaItem>;

const esquemaEtapaIndividual = z.object({
  etapa: z.enum(ORDEM_DAS_ETAPAS as [Etapa, ...Etapa[]]),
  dias: z
    .number()
    .int("Dias precisa ser um número inteiro.")
    .min(0, "Dias não pode ser negativo."),
});

// Array de exatamente 6, uma por valor de `Etapa`, e os marcos (queima1/queima2/entrega)
// restritos a {0, 1} — o mesmo predicado da restrição `marcos_zero_ou_um` do banco (T-03-03:
// o banco é a rede para o dia em que um caminho de escrita novo esquecer este `refine`).
export const esquemaEtapas = z
  .array(esquemaEtapaIndividual)
  .length(6, "A encomenda precisa das 6 etapas fixas — nenhuma pode faltar ou sobrar.")
  .refine(
    (etapas) => new Set(etapas.map((etapa) => etapa.etapa)).size === 6,
    "Cada etapa só pode aparecer uma vez.",
  )
  .refine(
    (etapas) => ORDEM_DAS_ETAPAS.every((etapaFixa) => etapas.some((e) => e.etapa === etapaFixa)),
    "Faltou uma das 6 etapas fixas (produção, secagem, queima, esmaltação, queima, entrega).",
  )
  .refine(
    (etapas) =>
      etapas.every((e) => !ETAPAS_MARCO.includes(e.etapa) || e.dias === 0 || e.dias === 1),
    "Queima (biscoito), Queima (esmalte) e Entrega só podem valer 0 ou 1 dia — é um interruptor, não uma duração.",
  );

export type EtapasDeEncomenda = z.infer<typeof esquemaEtapas>;

// Validação de data civil sem `Date`, no mesmo espírito de `lib/encomendas/cronograma.ts`
// (PD-05): confere mês 1–12 e dia dentro do número de dias daquele mês, incluindo o ano
// bissexto — nunca `new Date(...)`, que aceitaria "2026-02-31" rolando para março em silêncio.
function ehDataCivilValida(valor: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) {
    return false;
  }
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12) {
    return false;
  }
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia >= 1 && dia <= diasNoMes[mes - 1];
}

export const esquemaEncomenda = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Dê um nome para a encomenda.")
    .max(120, "Nome muito longo — no máximo 120 caracteres."),
  clienteNome: z
    .string()
    .trim()
    .max(120, "Nome do cliente muito longo — no máximo 120 caracteres.")
    .optional(),
  dataInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início precisa estar no formato AAAA-MM-DD.")
    .refine(ehDataCivilValida, "Data de início inválida — confira o dia e o mês."),
  itens: z
    .array(esquemaItem)
    .min(1, "A encomenda precisa de ao menos 1 item.")
    .max(50, "No máximo 50 itens por encomenda."),
  etapas: esquemaEtapas,
});

export type EntradaDeEncomenda = z.infer<typeof esquemaEncomenda>;

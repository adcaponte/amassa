// Ponto único de validação do módulo Encomendas (D-15): os dois caminhos de escrita da fase —
// o formulário completo (`criarEncomenda`, este plano) e o ajuste rápido da trilha (plano 03) —
// atravessam este mesmo arquivo. Nenhum dos dois reimplementa a regra por conta própria.
// Validação no cliente é conveniência; esta é a que vale (CLAUDE.md §Validação).
import { z } from "zod";

import { ETAPAS_MARCO, ORDEM_DAS_ETAPAS, type Etapa } from "./cronograma";

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 (`String.length`) —
// é assim que o `length()` do Postgres conta, e os dois divergem para qualquer texto fora do
// plano básico (emoji, alguns acentos compostos). Medir do jeito errado aqui deixaria passar
// pelo Zod uma descrição que o `check` do banco recusaria depois, com uma mensagem que o
// usuário não entende.
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

export const esquemaItem = z.object({
  descricao: z
    .string()
    // NFC ANTES de medir: acento composto ("é" pré-composto) e acento decomposto ("e" +
    // combinante) precisam contar o mesmo comprimento — sem isso a mesma palavra, digitada de
    // dois jeitos, teria dois vereditos diferentes.
    .transform((valor) => valor.normalize("NFC").trim())
    .refine(
      (valor) => contarPontosDeCodigo(valor) >= 1,
      "Descreva o item — o campo não pode ficar em branco.",
    )
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 200,
      "A descrição do item passa de 200 caracteres — encurte um pouco.",
    ),
  quantidade: z
    .number()
    .int("A quantidade precisa ser um número inteiro maior que zero.")
    .positive("A quantidade precisa ser um número inteiro maior que zero."),
});

export type ItemDeEncomenda = z.infer<typeof esquemaItem>;

const esquemaEtapaIndividual = z.object({
  etapa: z.enum(ORDEM_DAS_ETAPAS as [Etapa, ...Etapa[]]),
  dias: z
    .number()
    .int("Dias precisa ser um número inteiro.")
    .min(0, "Dias não pode ser negativo."),
  // Espera ANTES do marco (D-01/D-07), nunca a duração dele — só marco usa um valor diferente
  // de 0 (D-03, ver o `refine` abaixo). Teto de 365: um número acima de um ano é erro de
  // digitação, não espera de ateliê (o maior valor real dado pelo dono foi 5).
  esperaDias: z
    .number()
    .int("A espera precisa ser um número inteiro de dias.")
    .min(0, "A espera não pode ser negativa.")
    .max(365, "A espera não pode passar de 365 dias."),
});

// Array de exatamente 6, uma por valor de `Etapa`. A partir da fase 04.1 (D-06) os marcos
// (queima1/queima2/entrega) SEMPRE acontecem e SEMPRE duram 1 dia — o mesmo predicado da
// restrição `marcos_sempre_um_dia` do banco (T-04.1-05: o banco é a rede para o dia em que um
// caminho de escrita novo esquecer este `refine`).
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
    (etapas) => etapas.every((e) => !ETAPAS_MARCO.includes(e.etapa) || e.dias === 1),
    "Queima (biscoito), Queima (esmalte) e Entrega sempre acontecem e sempre duram 1 dia — o " +
      "número que se digita para elas é a espera ANTES do marco, não a duração dele.",
  )
  .refine(
    (etapas) => etapas.every((e) => ETAPAS_MARCO.includes(e.etapa) || e.esperaDias === 0),
    "Produção, secagem e esmaltação são trabalho contínuo e não têm espera — só queima " +
      "(biscoito), queima (esmalte) e entrega aceitam dias de espera.",
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
  // Ausente, vazio ou só com espaços — os três viram `null`, nunca cadeia vazia (D-05/03-03).
  // `.optional()` aceita a chave faltando; o `.transform` roda sobre o resultado (inclusive
  // `undefined`) e normaliza os três casos no mesmo valor.
  clienteNome: z
    .string()
    .max(120, "Nome do cliente muito longo — no máximo 120 caracteres.")
    .optional()
    .transform((valor) => {
      const normalizado = (valor ?? "").trim();
      return normalizado === "" ? null : normalizado;
    }),
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

// Usado por `cancelarEncomenda`, `concluirEncomenda`, `excluirEncomenda` e como campo dentro do
// ajuste rápido e da reordenação — a mesma fronteira de "isso parece um `id` de verdade" antes
// de qualquer um deles tocar o banco (T-03-17).
export const esquemaId = z
  .string()
  .uuid("Esse identificador não é válido — recarregue a página e tente de novo.");

const ETAPAS_DE_INTERVALO = ORDEM_DAS_ETAPAS.filter(
  (etapa) => !ETAPAS_MARCO.includes(etapa),
) as [Etapa, ...Etapa[]];

// União: etapa de intervalo só aceita `delta` (-1 | 1) sobre `dias`; etapa de marco só aceita
// `deltaEspera` (-1 | 1) sobre `esperaDias` — a partir da fase 04.1 (D-06) marco não tem mais
// interruptor, e o número que o ajuste rápido soma/subtrai é a espera antes do marco, nunca a
// duração dele (D-07). O ESQUEMA sabe que marco é espera relativa e intervalo é dias relativos
// — não o componente — porque é isso que impede a interface de um dia mandar `delta: 1` num
// marco (T-03-16). Implementa PD-02: nenhuma das duas formas recebe um valor absoluto.
const esquemaAjusteDeIntervalo = z.object({
  encomendaId: esquemaId,
  etapa: z.enum(ETAPAS_DE_INTERVALO),
  delta: z.union([z.literal(1), z.literal(-1)], {
    message: "O ajuste só pode ser de mais um dia ou menos um dia por vez.",
  }),
});

const esquemaAjusteDeMarco = z.object({
  encomendaId: esquemaId,
  etapa: z.enum(ETAPAS_MARCO as [Etapa, ...Etapa[]]),
  deltaEspera: z.union([z.literal(1), z.literal(-1)], {
    message: "O ajuste da espera só pode ser de mais um dia ou menos um dia por vez.",
  }),
});

export const esquemaAjusteDeEtapa = z.union([esquemaAjusteDeIntervalo, esquemaAjusteDeMarco], {
  message:
    "Não deu para entender esse ajuste — etapa de marco soma ou subtrai um dia de espera, etapa de intervalo soma ou subtrai um dia de duração.",
});

export type EntradaDeAjuste = z.infer<typeof esquemaAjusteDeEtapa>;

// Reordenação por setas (D-16) — nunca arrastar-e-soltar.
export const esquemaReordenacao = z.object({
  itemId: esquemaId,
  direcao: z.enum(["cima", "baixo"], {
    message: 'A direção precisa ser "cima" ou "baixo".',
  }),
});

export type EntradaDeReordenacao = z.infer<typeof esquemaReordenacao>;

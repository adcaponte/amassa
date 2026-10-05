// Ponto único de validação do módulo Fornos, no molde de `lib/encomendas/esquemas.ts` (D-15):
// todos os caminhos de escrita desta fase importam daqui, nenhum reimplementa a regra por conta
// própria. Validação no cliente é conveniência; esta é a que vale (CLAUDE.md §Validação).
import { z } from "zod";

import { FORMAS_DE_RECEBER } from "@/lib/agenda/esquemas";
import { FRASE_FALHA_AO_RECEBER } from "@/lib/agenda/textos";

import { TETO_DO_CONTADOR, totalDaContagem, totalDasQuantidades } from "./contagem";
import {
  FRASE_CONTAGEM_VAZIA,
  FRASE_NENHUMA_PECA_PARA_COBRAR,
  FRASE_TELA_DESATUALIZADA,
  FRASE_TETO_DO_CONTADOR,
} from "./textos";

// Conta em PONTOS DE CÓDIGO (`[...texto].length`), não em unidades UTF-16 (`String.length`) —
// é assim que o `length()` do Postgres conta (`fornos_nome_comprimento`), e os dois divergem
// para qualquer texto fora do plano básico (emoji, acentos compostos). Mesma disciplina de
// `lib/encomendas/esquemas.ts`.
function contarPontosDeCodigo(texto: string): number {
  return [...texto].length;
}

// Usado por toda ação que recebe um identificador (`criarForno` não usa, mas `registrarQueima`,
// `excluirQueima` e as ações dos planos irmãos usam) — a mesma fronteira de "isso parece um
// `id` de verdade" antes de qualquer uma delas tocar o banco.
export const esquemaId = z
  .string()
  .uuid("Esse identificador não é válido — recarregue a página e tente de novo.");

// D-02: não existe tela de cadastro dedicada — o botão do estado vazio/índice cria o forno com
// este esquema, e o resto (nome, descrição, limite) se edita depois na página do próprio forno.
// `nome` e `limite` refletem os `check`s do banco (`fornos_nome_comprimento`,
// `fornos_limite_minimo`) — defesa em duas camadas para o dia em que um caminho de escrita novo
// esquecer o Zod (T-04-04).
export const esquemaForno = z.object({
  nome: z
    .string()
    // NFC ANTES de medir — acento composto e decomposto precisam contar o mesmo comprimento
    // (mesma disciplina de `lib/encomendas/esquemas.ts`).
    .transform((valor) => valor.normalize("NFC").trim())
    .refine(
      (valor) => contarPontosDeCodigo(valor) >= 1,
      "Dê um nome para o forno.",
    )
    .refine(
      (valor) => contarPontosDeCodigo(valor) <= 80,
      "Nome muito longo — no máximo 80 caracteres.",
    ),
  // Ausente, vazio ou só com espaços viram `null`, nunca cadeia vazia — mesma normalização de
  // `encomendas.clienteNome`.
  descricao: z
    .string()
    .optional()
    .transform((valor) => {
      const normalizado = (valor ?? "").trim();
      return normalizado === "" ? null : normalizado;
    }),
  limite: z
    .number()
    .int("O limite precisa ser um número inteiro.")
    .min(10, "O limite de um forno não pode ser menor que 10.")
    .default(100),
});

export type EntradaDeForno = z.infer<typeof esquemaForno>;

// O fluxo de dois toques (D-04): exatamente dois campos, nenhum a mais — a proibição deste plano
// é acrescentar qualquer campo obrigatório, confirmação ou passo extra a este fluxo. `registrado_por`
// de PROPÓSITO não existe aqui: é derivado de `exigirUsuario()` dentro de `registrarQueima`,
// nunca aceito do cliente (T-04-02).
export const esquemaQueima = z.object({
  fornoId: esquemaId,
  tipo: z.enum(["biscoito", "esmalte", "ouro"], {
    message: "Esse tipo de queima não é válido — recarregue a página e tente de novo.",
  }),
});

export type EntradaDeQueima = z.infer<typeof esquemaQueima>;

// D-02: editar nome/descrição/limite acontece na página do próprio forno — mesma regra do
// servidor de `esquemaForno` (nunca uma segunda cópia), só acrescentando o `id` do forno alvo.
// Mesmo molde de `esquemaAtualizacaoDeEncomenda` (`lib/encomendas/acoes.ts`).
export const esquemaAtualizacaoDeForno = esquemaForno.extend({ id: esquemaId });

export type EntradaDeAtualizacaoDeForno = z.infer<typeof esquemaAtualizacaoDeForno>;

// FOR-07: a manutenção zera o contador SEM apagar nada. `responsavel`/`observacoes` são os
// únicos dois campos aceitos do cliente — os dois opcionais, nenhum obrigatório além do
// `fornoId` (D-04-adjacent: nada de campo extra num fluxo que já é raro por natureza).
// **`queimasAcumuladas` DELIBERADAMENTE não entra neste esquema**: é derivado no servidor, a
// partir da contagem real dentro da mesma transação que grava a linha — um N vindo do
// navegador corromperia o histórico de desgaste do forno (T-04-15). Ausente, vazio ou só com
// espaços viram `null` nos dois campos, mesma normalização de `encomendas.clienteNome`.
export const esquemaManutencao = z.object({
  fornoId: esquemaId,
  responsavel: z
    .string()
    .optional()
    .transform((valor) => {
      const normalizado = (valor ?? "").normalize("NFC").trim();
      return normalizado === "" ? null : normalizado;
    })
    .refine(
      (valor) => valor === null || contarPontosDeCodigo(valor) <= 120,
      "Responsável muito longo — no máximo 120 caracteres.",
    ),
  observacoes: z
    .string()
    .optional()
    .transform((valor) => {
      const normalizado = (valor ?? "").normalize("NFC").trim();
      return normalizado === "" ? null : normalizado;
    })
    .refine(
      (valor) => valor === null || contarPontosDeCodigo(valor) <= 500,
      "Observações muito longas — no máximo 500 caracteres.",
    ),
});

export type EntradaDeManutencao = z.infer<typeof esquemaManutencao>;

// Fase 06.4 — a contagem opcional de uma queima (QMC-01/QMC-03; BRIEFING §2). Seis contadores
// inteiros 0..10000 e "o forno saiu cheio". Os tetos são os checks `queima_contagens_*` da 0030 —
// duas cópias deliberadas (o Zod dá a frase; o check é a barreira se o Zod for contornado): mudar
// um é mudar os dois, no mesmo commit. Total 0 é recusado (o check `queima_contagens_alguma_peca`):
// "sem contagem" é a ausência da linha — a tela nunca manda isso (fecha como "Pular").
//
// O esquema NÃO aceita vínculo com venda nem quantidade de venda: esses só nascem nas ações de
// cobrança (planos 04 e 05), sob a trava da queima. `contado_por` vem da sessão, nunca daqui.
const contador = z
  .number({ error: FRASE_TETO_DO_CONTADOR })
  .int({ error: FRASE_TETO_DO_CONTADOR })
  .min(0, { error: FRASE_TETO_DO_CONTADOR })
  .max(TETO_DO_CONTADOR, { error: FRASE_TETO_DO_CONTADOR });

// Os seis contadores e o "saiu cheio" — a contagem que se grava, e a que a folha VIU ao abrir.
const NUMEROS_DA_CONTAGEM = {
  internasP: contador,
  internasM: contador,
  internasG: contador,
  externasP: contador,
  externasM: contador,
  externasG: contador,
  saiuCheio: z.boolean({ error: "Não deu para validar os dados enviados." }),
};
const esquemaNumerosDaContagem = z.object(NUMEROS_DA_CONTAGEM);
// A contagem que a tela VIU: ausente ou fora de forma → a frase de tela desatualizada.
const contagemVista = z.object(NUMEROS_DA_CONTAGEM, { error: FRASE_TELA_DESATUALIZADA });

// Quick 261005-2yu (05/10/2026), 06.4-WR-01/02/03 — o retrato da tela. O navegador manda o que a tela
// MOSTROU (a contagem com que a folha abriu; os números das vendas ativas que a folha ou a confirmação
// mostraram) e o servidor confere sob a trava da queima. OBRIGATÓRIO: ausente nunca pula a conferência —
// uma aba velha depois do deploy recebe a frase de tela desatualizada. Forjar só causa recusa ou equivale
// a ter visto o estado atual (T-2yu-04); o teto de 500 só fecha o tamanho.
const vendasVistas = z
  .array(z.number({ error: FRASE_TELA_DESATUALIZADA }).int({ error: FRASE_TELA_DESATUALIZADA }).positive({ error: FRASE_TELA_DESATUALIZADA }), {
    error: FRASE_TELA_DESATUALIZADA,
  })
  .max(500, { error: FRASE_TELA_DESATUALIZADA });

export const esquemaContagem = esquemaNumerosDaContagem
  .extend({
    queimaId: esquemaId,
    // `null` = a folha abriu sem contagem.
    esperada: contagemVista.nullable(),
  })
  .refine((dados) => totalDaContagem(dados) > 0, { error: FRASE_CONTAGEM_VAZIA });

export type EntradaDeContagem = z.infer<typeof esquemaContagem>;

// Fase 06.4, plano 02 — apagar a contagem de uma queima ("Salvar" com tudo zero numa contagem
// existente, depois de confirmar — UI-D6).
export const esquemaApagarContagem = z.object({
  queimaId: esquemaId,
  // Só se apaga uma contagem que existe: a que a folha abriu.
  esperada: contagemVista,
});

export type EntradaDeApagarContagem = z.infer<typeof esquemaApagarContagem>;

// Fase 06.4, plano 04 — "Recebi agora" das externas (QMC-08; D-07). Do navegador chegam SÓ a queima,
// a forma, as quantidades pedidas por tamanho (o passo de quantidade) e, OPCIONAL, a pessoa (decisão do
// dono de 04/10/2026 — UI-D13 revista: o id de um cadastro de `clientes`; o NOME gravado na venda é lido
// do banco, nunca daqui). O que falta, os preços e as linhas são relidos no banco sob a trava da queima
// (`cobrarQueimaNaTransacao`) — nenhum valor, linha ou preço vem do navegador (T-06.4-22).
const quantidadeDaCobranca = z
  .number({ error: FRASE_FALHA_AO_RECEBER })
  .int({ error: FRASE_FALHA_AO_RECEBER })
  .min(0, { error: FRASE_FALHA_AO_RECEBER })
  .max(TETO_DO_CONTADOR, { error: FRASE_FALHA_AO_RECEBER });

export const esquemaReceberQueima = z.object(
  {
    queimaId: esquemaId,
    forma: z.enum(FORMAS_DE_RECEBER, { error: FRASE_FALHA_AO_RECEBER }),
    quantidades: z
      .object(
        { p: quantidadeDaCobranca, m: quantidadeDaCobranca, g: quantidadeDaCobranca },
        { error: FRASE_FALHA_AO_RECEBER },
      )
      .refine((quantidades) => totalDasQuantidades(quantidades) > 0, {
        error: FRASE_NENHUMA_PECA_PARA_COBRAR,
      }),
    clienteId: z.uuid({ error: FRASE_FALHA_AO_RECEBER }).nullable().default(null),
    // As vendas ativas que a folha mostrou ao ABRIR (06.4-WR-02).
    vendasVistas,
  },
  { error: FRASE_FALHA_AO_RECEBER },
);

// 06.4-WR-03: excluir a queima (o "Desfazer" do registro e a exclusão confirmada do Histórico) com os
// números das vendas ativas que a confirmação mostrou (o "Desfazer" manda a lista vazia).
export const esquemaExcluirQueima = z.object({ id: esquemaId, vendasVistas });

export type EntradaDeExcluirQueima = z.infer<typeof esquemaExcluirQueima>;

export type EntradaDeReceberQueima = z.infer<typeof esquemaReceberQueima>;

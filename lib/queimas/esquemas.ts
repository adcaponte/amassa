// Ponto único de validação do módulo Fornos, no molde de `lib/encomendas/esquemas.ts` (D-15):
// todos os caminhos de escrita desta fase importam daqui, nenhum reimplementa a regra por conta
// própria. Validação no cliente é conveniência; esta é a que vale (CLAUDE.md §Validação).
import { z } from "zod";

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

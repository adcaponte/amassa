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

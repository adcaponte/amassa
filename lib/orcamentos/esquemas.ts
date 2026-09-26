// Ponto único de validação do módulo Orçamentos — molde de `lib/financeiro/esquemas.ts`,
// REDECLARADO aqui (nunca importado de `@/lib/financeiro`, mesma disciplina de D-15 do projeto:
// cada módulo tem sua própria cópia).
import { z } from "zod";

// Usado por toda ação que recebe um identificador.
export const esquemaId = z
  .string()
  .uuid("Esse identificador não é válido — recarregue a página e tente de novo.");

// "Novo orçamento" (D-06/D-21): o rascunho nasce vazio — sem cliente, sem título, sem peça — e
// esta validação só confirma que a entrada é um objeto (nenhum campo obrigatório ainda). Os
// planos seguintes (edição do rascunho) acrescentam campos aqui, sempre opcionais até "Marcar
// como enviado" exigir cliente e ao menos uma peça (D-21).
export const esquemaNovoOrcamento = z.object({});

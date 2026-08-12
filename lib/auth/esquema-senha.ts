// Schema Zod da troca voluntária de senha (BRIEF-NOTURNO.md, Lote C). Comprimento, não
// regrinha de símbolo: uma frase de quatro palavras (`panela-barro-forno-quente`) é mais fácil
// de lembrar e mais difícil de quebrar que `Amassa@2026`, e é o que o Core Value do ateliê pede
// — digitar 20 caracteres aleatórios num teclado de celular é atrito que faz desistir do
// sistema.
//
// Esta política vale SÓ para a troca. `lib/auth/entrada-credenciais.ts` (`senha:
// z.string().min(1)`) fica como está de propósito — existe para não vazar informação na tela
// de entrada, e não é alterado aqui.
import { z } from "zod";

export const TAMANHO_MINIMO_SENHA = 12;

export const esquemaTrocaDeSenha = z
  .object({
    senhaAtual: z.string().min(1, "Digite sua senha atual."),
    senhaNova: z
      .string()
      .min(TAMANHO_MINIMO_SENHA, "A senha nova precisa ter pelo menos 12 caracteres."),
    confirmacao: z.string(),
  })
  .refine((dados) => dados.senhaNova === dados.confirmacao, {
    message: "A confirmação não bate com a senha nova.",
    path: ["confirmacao"],
  });

export type EntradaTrocaDeSenha = z.infer<typeof esquemaTrocaDeSenha>;

// Schema Zod de entrada compartilhado entre os dois lugares que validam e-mail/senha antes de
// autenticar: a Server Action de login (`lib/auth/acoes.ts`) e o `authorize()` do provedor de
// credenciais (`lib/auth/auth.ts`). As duas validações são independentes de propósito — o
// `authorize()` precisa revalidar por conta própria, porque qualquer chamador de
// `signIn("credentials", ...)`, não só este formulário, passa por ali —, mas a REGRA de
// validação (formato de e-mail, senha não vazia) é uma só, e definir o schema em dois lugares
// deixava as duas cópias livres para divergir silenciosamente (WR-03 da revisão de 02a-08).
//
// Não vive em `lib/auth/credenciais.ts`: aquele módulo é propositalmente "zero imports"
// (`tests/unit/credenciais.test.ts` prova isso lendo o próprio arquivo-fonte), então o schema
// — que precisa importar `zod` — ganhou este arquivo dedicado.
import { z } from "zod";

export const credenciaisEntradaSchema = z.object({
  email: z.email(),
  senha: z.string().min(1),
});

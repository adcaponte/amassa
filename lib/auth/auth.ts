// A metade de runtime Node da configuração do Auth.js. Importa `configuracaoBase` e
// acrescenta o provedor de credenciais, o hash e o banco — é o que rotas, páginas e Server
// Actions importam. NUNCA o middleware (ver `lib/auth/auth.config.ts` e
// `tests/unit/auth-borda.test.ts`).
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { db } from "@/db";
import { usuarios } from "@/db/schema";

import { configuracaoBase } from "./auth.config";
import { conferirHash } from "./senha";

const credenciaisSchema = z.object({
  email: z.email(),
  senha: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...configuracaoBase,
  providers: [
    Credentials({
      credentials: {
        email: {},
        senha: {},
      },
      async authorize(credenciaisBrutas) {
        const resultado = credenciaisSchema.safeParse(credenciaisBrutas);
        if (!resultado.success) return null;

        const email = resultado.data.email.toLowerCase();

        const [usuario] = await db
          .select()
          .from(usuarios)
          .where(eq(sql`lower(${usuarios.email})`, email))
          .limit(1);

        if (!usuario || !usuario.ativo) return null;

        const senhaConfere = await conferirHash(usuario.senhaHash, resultado.data.senha);
        if (!senhaConfere) return null;

        return { id: usuario.id, name: usuario.nome, email: usuario.email };
      },
    }),
  ],
});

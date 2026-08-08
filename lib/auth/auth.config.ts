import type { NextAuthConfig } from "next-auth";

import { ehRotaPublica } from "./rotas-publicas";

// A metade de borda da configuração do Auth.js — a ÚNICA que `middleware.ts` importa,
// porque o middleware roda no runtime Edge. Ela nunca pode alcançar, nem por
// transitividade, o módulo nativo de hash, o cliente do banco (`@/db`), nem a função de
// checagem de credenciais do provedor: qualquer um deles quebra o middleware na
// inicialização. `lib/auth/auth.ts` importa este arquivo e acrescenta o que falta.
// Ver `01-ARQUITETURA.md` §4 e `tests/unit/auth-borda.test.ts`, que prova esta regra.
export const configuracaoBase = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias, renovados a cada uso
  },
  callbacks: {
    authorized({ request, auth }) {
      if (ehRotaPublica(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;

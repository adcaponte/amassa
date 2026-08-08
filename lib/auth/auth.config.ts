import type { NextAuthConfig } from "next-auth";

import { ehRotaPublica } from "./rotas-publicas";

// A metade de borda da configuração do Auth.js — a ÚNICA que `middleware.ts` importa,
// porque o middleware roda no runtime Edge. Ela nunca pode alcançar, nem por
// transitividade, o módulo nativo de hash, o cliente do banco (`@/db`), nem a função de
// checagem de credenciais do provedor: qualquer um deles quebra o middleware na
// inicialização. `lib/auth/auth.ts` importa este arquivo e acrescenta o que falta.
// Ver `01-ARQUITETURA.md` §4 e `tests/unit/auth-borda.test.ts`, que prova esta regra.

// Sessão longa de propósito — "ninguém quer digitar senha com barro na mão"
// (`01-ARQUITETURA.md` §4). Expressão legível (dias × horas × minutos × segundos), não um
// número solto, para quem ler daqui a um ano não precisar calcular de cabeça.
const DIAS_DE_SESSAO = 30;
const DURACAO_DA_SESSAO_EM_SEGUNDOS = DIAS_DE_SESSAO * 24 * 60 * 60;

// Intervalo a partir do qual o token é reescrito — não a cada requisição (caro e
// desnecessário), mas uma vez por dia de uso. Renova a sessão de quem usa o sistema todo
// dia sem forçar login de novo, sem reescrever o cookie a cada clique.
const RENOVACAO_DA_SESSAO_EM_SEGUNDOS = 24 * 60 * 60;

export const configuracaoBase = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: DURACAO_DA_SESSAO_EM_SEGUNDOS,
    updateAge: RENOVACAO_DA_SESSAO_EM_SEGUNDOS,
  },
  // As três propriedades são o padrão da biblioteca hoje — escrevê-las explicitamente é o
  // que impede uma atualização futura do Auth.js de mudar a política em silêncio
  // (T-02a-18): só o servidor lê o cookie, o canal precisa ser seguro, e a política de
  // mesmo sítio é a relaxada (necessária para o redirect de login funcionar).
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      },
    },
  },
  callbacks: {
    authorized({ request, auth }) {
      if (ehRotaPublica(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;

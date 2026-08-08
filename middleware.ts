// Constrói o Auth.js SÓ a partir de `configuracaoBase` — nunca de `lib/auth/auth.ts`. É o
// que mantém o middleware fora do alcance do módulo nativo de hash e do cliente do banco,
// que quebrariam a inicialização no runtime Edge (`01-ARQUITETURA.md` §4).
import NextAuth from "next-auth";

import { configuracaoBase } from "./lib/auth/auth.config";

export default NextAuth(configuracaoBase).auth;

export const config = {
  // Deixa passar sem checagem: arquivos internos do Next, arquivos estáticos e a própria
  // rota de callback de autenticação (`/api/auth/*`) — ela precisa responder mesmo sem
  // sessão, ou ninguém consegue entrar.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};

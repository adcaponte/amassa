// Constrói o Auth.js SÓ a partir de `configuracaoBase` — nunca de `lib/auth/auth.ts`. É o
// que mantém o middleware fora do alcance do módulo nativo de hash e do cliente do banco,
// que quebrariam a inicialização no runtime Edge (`01-ARQUITETURA.md` §4).
import NextAuth from "next-auth";
import type { NextMiddleware } from "next/server";

import { configuracaoBase } from "./lib/auth/auth.config";
import { ehRotaPublica } from "./lib/auth/rotas-publicas";

// O `auth` do Auth.js já É um `NextMiddleware` (decide liberar ou redirecionar para
// /login). O `as` abaixo só declara o tipo que o próprio pacote usa para essa forma de
// exportação — não muda o comportamento herdado do plano 01.
const autenticar = NextAuth(configuracaoBase).auth as NextMiddleware;

// Envolve o manipulador de autenticação só para acrescentar, na resposta, o cabeçalho que
// impede o navegador de guardar a página em cache — mas SÓ para rota protegida. Sem ele, o
// botão de voltar do navegador serve a tela do próprio cache depois da saída, mostrando
// conteúdo do ateliê sem sessão (o que AUTH-06 proíbe; ver tests/e2e/sessao.spec.ts). As
// rotas públicas (`/login`, `/api/health`) não têm nada sensível a esconder do cache e não
// recebem o cabeçalho.
const middleware: NextMiddleware = async (requisicao, evento) => {
  const resposta = await autenticar(requisicao, evento);

  if (resposta && !ehRotaPublica(requisicao.nextUrl.pathname)) {
    resposta.headers.set("Cache-Control", "no-store, must-revalidate");
  }

  return resposta;
};

export default middleware;

export const config = {
  // Deixa passar sem checagem: arquivos internos do Next, arquivos estáticos e a própria
  // rota de callback de autenticação (`/api/auth/*`) — ela precisa responder mesmo sem
  // sessão, ou ninguém consegue entrar.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};

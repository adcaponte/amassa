// Constrói o Auth.js SÓ a partir de `configuracaoBase` — nunca de `lib/auth/auth.ts`. É o
// que mantém o middleware fora do alcance do módulo nativo de hash e do cliente do banco,
// que quebrariam a inicialização no runtime Edge (`01-ARQUITETURA.md` §4).
import NextAuth from "next-auth";
import { NextResponse, type NextMiddleware } from "next/server";

import { configuracaoBase } from "./lib/auth/auth.config";
import { podeRenovarSessao, semRenovacaoDaSessao } from "./lib/auth/renovacao-sessao";
import { ehRotaPublica } from "./lib/auth/rotas-publicas";

// O `auth` do Auth.js já É um `NextMiddleware` (decide liberar ou redirecionar para
// /login). O `as` abaixo só declara o tipo que o próprio pacote usa para essa forma de
// exportação — não muda o comportamento herdado do plano 01.
const autenticar = NextAuth(configuracaoBase).auth as NextMiddleware;

// Fase 04.5, plano 10 — a primeira rota de API autenticada da plataforma
// (`GET /api/orcamentos/fotos/[id]`, D-27/T-04.5-48). O `authorized()` de `configuracaoBase`
// decide "sem sessão" IGUAL para toda rota não pública, mas o comportamento PADRÃO do Auth.js
// para essa decisão é sempre um redirect para `pages.signIn` — certo para navegação de página
// (`fundacao.spec.ts`), errado para uma rota de API: uma tag `<img>` ou um `fetch()` não
// "segue" um redirect para HTML de forma útil, e o redirect chegaria como 200 (a página de
// login), escondendo exatamente o caso que precisa ficar visível como falha. Só o FORMATO da
// resposta muda aqui — a decisão de autorização continua inteiramente do Auth.js.
function ehRotaDeApiNaoPublica(caminho: string): boolean {
  return caminho.startsWith("/api/") && !ehRotaPublica(caminho);
}

function ehRedirecionamento(resposta: Response): boolean {
  return resposta.status >= 300 && resposta.status < 400;
}

// Envolve o manipulador de autenticação só para acrescentar, na resposta, o cabeçalho que
// impede o navegador de guardar a página em cache — mas SÓ para rota protegida. Sem ele, o
// botão de voltar do navegador serve a tela do próprio cache depois da saída, mostrando
// conteúdo do ateliê sem sessão (o que AUTH-06 proíbe; ver tests/e2e/sessao.spec.ts). As
// rotas públicas (`/login`, `/api/health`) não têm nada sensível a esconder do cache e não
// recebem o cabeçalho.
//
// E, em resposta a um fetch() de leitura do roteador (prefetch ou navegação RSC), tira a
// renovação do token de sessão que o Auth.js anexa a toda resposta: um prefetch que sai antes da
// saída e volta depois dela regravaria o cookie apagado e ressuscitaria a sessão (AUTH-06; ver
// lib/auth/renovacao-sessao.ts). A renovação segue em carregamento de página e Server Action.
const middleware: NextMiddleware = async (requisicao, evento) => {
  let resposta = await autenticar(requisicao, evento);

  if (resposta && ehRedirecionamento(resposta) && ehRotaDeApiNaoPublica(requisicao.nextUrl.pathname)) {
    resposta = NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  if (resposta && !podeRenovarSessao(requisicao.method, requisicao.headers)) {
    const linhas = resposta.headers.getSetCookie();
    const mantidas = semRenovacaoDaSessao(linhas);
    if (mantidas.length !== linhas.length) {
      resposta.headers.delete("set-cookie");
      for (const linha of mantidas) resposta.headers.append("set-cookie", linha);
    }
  }

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

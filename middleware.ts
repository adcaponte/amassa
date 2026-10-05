// Constrói o Auth.js SÓ a partir de `configuracaoBase` — nunca de `lib/auth/auth.ts`. É o
// que mantém o middleware fora do alcance do módulo nativo de hash e do cliente do banco,
// que quebrariam a inicialização no runtime Edge (`01-ARQUITETURA.md` §4).
import NextAuth from "next-auth";
import { NextResponse, type NextMiddleware } from "next/server";

import { configuracaoBase } from "./lib/auth/auth.config";
import { podeRenovarSessao, semRenovacaoDaSessao } from "./lib/auth/renovacao-sessao";
import { ehRotaPublica } from "./lib/auth/rotas-publicas";
import { ehNavegacao, ehRotaDeApi } from "./lib/rotas/gestao";

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
//
// 06.2-WR-02 (quick 261005-2yu, 05/10/2026): a exceção da exceção — a NAVEGAÇÃO da aba a uma rota de
// API (tocar "Baixar"/"Abrir" num anexo de fornecedor com a sessão vencida) não pode terminar no JSON
// cru. Em navegação (`ehNavegacao`: `Sec-Fetch-Mode: navigate`, ou `Accept` com HTML sem ele), a
// resposta é 303 para `/gestao/login?sessao=encerrada`. A `<img>`, o `fetch()` e o `request` dos
// testes continuam recebendo o 401 JSON de sempre. O destino é FIXO; a URL é montada sobre
// `requisicao.nextUrl` só porque o adaptador do Next exige URL absoluta num `Location` de middleware — e
// ele mesmo a devolve RELATIVA quando o host é o da requisição (`getRelativeURL` em
// `next/dist/server/web/adapter.js`), então o `0.0.0.0:3000` de trás do Caddy nunca chega ao navegador.
const DESTINO_SEM_SESSAO = "/gestao/login?sessao=encerrada";

function ehRotaDeApiNaoPublica(caminho: string): boolean {
  return ehRotaDeApi(caminho) && !ehRotaPublica(caminho);
}

function ehRedirecionamento(resposta: Response): boolean {
  return resposta.status >= 300 && resposta.status < 400;
}

// Envolve o manipulador de autenticação só para acrescentar, na resposta, o cabeçalho que
// impede o navegador de guardar a página em cache — mas SÓ para rota protegida. Sem ele, o
// botão de voltar do navegador serve a tela do próprio cache depois da saída, mostrando
// conteúdo do ateliê sem sessão (o que AUTH-06 proíbe; ver tests/e2e/sessao.spec.ts). As
// rotas públicas (`/gestao/login`, `/api/health`) não têm nada sensível a esconder do cache e
// não recebem o cabeçalho.
//
// E, em resposta a um fetch() de leitura do roteador (prefetch ou navegação RSC), tira a
// renovação do token de sessão que o Auth.js anexa a toda resposta: um prefetch que sai antes da
// saída e volta depois dela regravaria o cookie apagado e ressuscitaria a sessão (AUTH-06; ver
// lib/auth/renovacao-sessao.ts). A renovação segue em carregamento de página e Server Action.
const middleware: NextMiddleware = async (requisicao, evento) => {
  let resposta = await autenticar(requisicao, evento);

  if (resposta && ehRedirecionamento(resposta) && ehRotaDeApiNaoPublica(requisicao.nextUrl.pathname)) {
    resposta = ehNavegacao(requisicao.headers)
      ? NextResponse.redirect(new URL(DESTINO_SEM_SESSAO, requisicao.nextUrl), 303)
      : NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
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
  // Fase 04.6 (D-03): o proxy passa a proteger SÓ `/gestao` — leitura literal da decisão do
  // dono, e o que garante D-15 (o site público sobrevive ao Postgres cair): para qualquer
  // caminho fora de `/gestao`, `autenticar()` acima nem roda, então o `authorized()` do Auth.js
  // nunca é consultado e nenhuma requisição à raiz ou ao site toca sessão ou banco. O matcher
  // antigo (tudo, exceto estáticos e o callback) cobria a plataforma inteira porque ela vivia na
  // raiz; agora que ela vive só sob `/gestao`, é este prefixo — nomeado, não mais implícito — que
  // é a cerca real. `tests/unit/arvore-de-rotas.test.ts` é o portão que grita se uma rota
  // autenticada nascer fora dele sem ninguém notar.
  //
  // Fase 06.2 (D-08, pesquisa Achado 1): UMA exceção, e só ela — o caminho EXATO do PUT de upload
  // dos anexos de fornecedor, `/gestao/api/fornecedores/anexos`. O Next 16.3.5 clona o corpo de toda
  // requisição que o middleware intercepta e o TRUNCA em 10 MB (`proxyClientMaxBodySize`,
  // `next/dist/server/body-streams.js`), sem erro nenhum para o cliente: um PDF de 15 MB chegaria ao
  // handler com 10 MB e seria gravado corrompido. Fora do matcher, o corpo chega cru e em stream.
  // O `$` dentro da lookahead é o que mantém a exceção estreita: `/gestao/api/fornecedores/anexos/<id>`
  // (o GET que serve o arquivo), `…/anexos/` e `…/anexosX` continuam casando — só o caminho exato sai.
  // O handler do PUT começa por `exigirUsuario()` e devolve o 401 JSON sozinho, sem o middleware.
  // `tests/unit/middleware-matcher.test.ts` lê ESTE literal e afirma a tabela de caminhos.
  // Continua literal estático: o Next lê o matcher em tempo de build.
  matcher: ["/gestao", "/gestao/((?!api/fornecedores/anexos$).*)"],
};

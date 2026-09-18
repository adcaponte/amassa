// Módulo puro, sem nenhum import (roda no middleware, runtime Edge): impede que a renovação do
// token de sessão saia numa resposta a um fetch() de LEITURA do roteador do Next (prefetch ou
// navegação RSC) — ela continua saindo em carregamento de página e em Server Action.
//
// Por quê: a sessão é JWT, sem estado no servidor, e o middleware do Auth.js reemite o token em
// TODA resposta que passa por ele. Abrir o menu do usuário e tocar em "Sair" disparam prefetch;
// os que saem antes de a resposta da saída chegar levam o cookie ainda válido e, quando voltam
// DEPOIS dela, regravam o cookie que a saída acabou de apagar — a sessão ressuscita por 30 dias,
// e um documento novo abre o painel sem login (AUTH-06). Medido na sessão de debug
// e2e-toque-nao-navega-ci: em 43/43 ressurreições havia uma resposta de prefetch chegando depois
// da saída; em 0/17 casos limpos.
//
// Por que `Sec-Fetch-Dest` e não o cabeçalho de prefetch do Next: o Next REMOVE `rsc`,
// `next-router-prefetch` e os outros cabeçalhos do roteador da requisição que o middleware
// enxerga (next/dist/server/web/adapter.js), então no middleware prefetch e navegação RSC são
// indistinguíveis. `Sec-Fetch-Dest` vem do navegador e o Next não mexe nele: `empty` num GET é um
// fetch() (o roteador), `document` é um carregamento de página.
//
// AUTH-05 continua valendo: a sessão de 30 dias é renovada a cada página aberta (reabrir o app é
// sempre um carregamento de página) e a cada Server Action (salvar qualquer coisa).

// Sem o cabeçalho (navegador antigo, ferramenta de linha de comando), renova como antes.
export function podeRenovarSessao(metodo: string, cabecalhos: Headers): boolean {
  const ehLeituraPorFetch = metodo === "GET" && cabecalhos.get("sec-fetch-dest") === "empty";
  return !ehLeituraPorFetch;
}

// Nome padrão do Auth.js v5: `authjs.session-token`, com o prefixo `__Secure-` quando o cookie é
// seguro, e com sufixo `.0`, `.1`… quando o token passa de ~4 KB e é dividido em pedaços.
const COOKIE_DE_SESSAO = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/;

// Recebe as linhas `Set-Cookie` de uma resposta e devolve as mesmas linhas sem nenhuma do token de
// sessão. Os outros cookies passam intactos.
export function semRenovacaoDaSessao(linhasSetCookie: string[]): string[] {
  return linhasSetCookie.filter((linha) => !COOKIE_DE_SESSAO.test(linha.trimStart()));
}

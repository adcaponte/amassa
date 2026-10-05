// Módulo puro, sem nenhum import: a fonte única do prefixo que separa as duas superfícies da
// Fase 04.6 — o site público (raiz) e a plataforma (`/gestao`). Mantê-lo sem import é o que
// permite testar as três funções sem subir middleware nem servidor
// (`tests/unit/rotas-gestao.test.ts`), e é o mesmo motivo de `lib/auth/rotas-publicas.ts` ser
// puro: um módulo consultado por `middleware.ts` (runtime Edge) não pode alcançar, nem por
// transitividade, o módulo nativo de hash nem o cliente do banco.
export const PREFIXO_GESTAO = "/gestao";

// Prefixa um caminho da plataforma com `/gestao` — a porta única de montagem de URL da
// plataforma (o mesmo papel de `lib/precificacao/navegacao.ts` para as URLs do Financeiro).
// `"/"` e `""` devolvem só `PREFIXO_GESTAO` (nunca `/gestao/`, que duplicaria a barra); qualquer
// outro caminho é prefixado, normalizando uma barra dupla se o chamador já tiver escrito uma no
// início (`rotaDeGestao("/financeiro")` e `rotaDeGestao("financeiro")` nunca devem divergir).
export function rotaDeGestao(caminho: string): string {
  if (caminho === "" || caminho === "/") return PREFIXO_GESTAO;
  const caminhoComBarra = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return `${PREFIXO_GESTAO}${caminhoComBarra}`.replace(/\/{2,}/g, "/");
}

// Verdadeiro para `/gestao` exato ou para `/gestao/` seguido de qualquer coisa — NUNCA para um
// prefixo de texto solto: `/gestaoqualquercoisa` é falso, porque "qualquercoisa" não é uma
// sub-rota da plataforma, é uma rota (talvez futura) do site que por acaso começa com as mesmas
// oito letras. Essa distinção é a aresta `adjacency` de GES-01: sem o corte na barra, o prefixo
// de string sozinho confundiria as duas superfícies.
export function ehRotaDeGestao(caminho: string): boolean {
  return caminho === PREFIXO_GESTAO || caminho.startsWith(`${PREFIXO_GESTAO}/`);
}

// Verdadeiro para qualquer rota de API — as que já viviam em `/api/...` (saúde, callback do
// Auth.js) e as que se moveram para dentro da cerca em `/gestao/api/...` (orçamentos, T-04.6-04).
// É esta função, e não um teste de prefixo literal `/api/`, que `middleware.ts` passa a usar
// para decidir "isto é uma rota de API, devolva 401 em JSON, nunca um redirect": sem reconhecer
// o novo endereço, a rota da foto de orçamento voltaria a receber um redirect de 200 com HTML de
// login em vez do 401 que uma tag `<img>` ou um `fetch()` conseguem interpretar (regra geral
// criada em 04.5-10, T-04.5-48).
export function ehRotaDeApi(caminho: string): boolean {
  return caminho.startsWith("/api/") || caminho.startsWith(`${PREFIXO_GESTAO}/api/`);
}

// 06.2-WR-02 (quick 261005-2yu, 05/10/2026): a requisição é a NAVEGAÇÃO da aba (um link, a barra
// de endereço) — e não um `fetch`, uma `<img>` ou um teste por `request`? Com `Sec-Fetch-Mode`
// (todo navegador atual manda), só `navigate` é navegação. Sem ele (navegador antigo), cai para o
// `Accept` com `text/html`, que só a navegação manda. Quem navega recebe um redirecionamento para
// uma página com aviso em português; o resto continua recebendo o JSON. Cabeçalhos forjados só
// trocam um formato de erro pelo outro — nunca abrem nada.
export function ehNavegacao(cabecalhos: { get(nome: string): string | null }): boolean {
  const modo = cabecalhos.get("sec-fetch-mode");
  if (modo !== null && modo !== "") {
    return modo === "navigate";
  }
  return (cabecalhos.get("accept") ?? "").includes("text/html");
}

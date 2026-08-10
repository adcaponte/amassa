import { defineConfig, devices } from "@playwright/test";

// Localmente, sobe a build real (nunca o modo dev): é na build que as variáveis
// NEXT_PUBLIC_* são embutidas, e testar contra `next dev` esconderia exatamente a classe de
// falha que a Fase 1 existe para prevenir. `DATABASE_URL` do processo do servidor vem de
// `DATABASE_URL_TESTE` — nunca do banco real (D-09).
//
// No job `e2e` do workflow (plano 01-05), quem sobe o servidor não é este arquivo: o
// workflow constrói a MESMA imagem Docker que o job `imagem` publica (alvo `app`, saída
// `standalone`) e já a deixa respondendo em http://127.0.0.1:3000 antes de rodar
// `npx playwright test` diretamente. `reuseExistingServer: true` é o que permite os dois
// mundos convivirem no mesmo arquivo: se já existe um servidor respondendo na `url` (o
// contêiner, em CI), o Playwright reaproveita e nunca chega a executar o `command` abaixo;
// se não existe (uso local), ele sobe via `next build && next start`. Isso importa porque
// "next start" não é compatível com `output: "standalone"` — testar via `command` em CI
// estaria validando um processo diferente do que sobe em produção.
//
// Dois projetos porque o sistema é usado em pé, no ateliê, numa tela de celular — testar só
// no desktop não mede o que importa (Core Value, PROJECT.md). Ambos usam Chromium (só um
// motor instalado); o de celular usa o preset "Pixel 7" para viewport, toque e user agent
// de um Android real, sem precisar do motor WebKit.
export default defineConfig({
  testDir: "./tests/e2e",
  // Cria a conta de gestor rodando o próprio scripts/criar-usuario.ts contra o banco de
  // teste, e publica e-mail/senha em variáveis de ambiente para as specs (AUTH-07 de
  // verdade, ver tests/e2e/apoio/preparar-usuario.ts).
  globalSetup: "./tests/e2e/apoio/preparar-usuario.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    // "localhost", não "127.0.0.1": o `NextURL` interno do Next.js normaliza QUALQUER
    // hostname 127.x.x.x para o literal "localhost" ao montar URLs (inclusive o redirect do
    // middleware para /login). Testar com "127.0.0.1" faria o redirect de autenticação
    // trocar de origem no meio do fluxo (127.0.0.1 → localhost) — origens diferentes não
    // compartilham cookie de sessão, o que quebraria login de verdade sem ser um bug da
    // aplicação. Não é o AUTH_TRUST_HOST: é puramente esse detalhe de teste local.
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // Quatro testes afirmam uma condição GLOBAL do banco ("nenhuma encomenda existe", "nenhuma
  // concluída existe"). Com `fullyParallel: true` e mais de um worker, outro arquivo de spec cria
  // encomendas ao mesmo tempo e a premissa deixa de valer — não é instabilidade de ambiente, é uma
  // afirmação global disputada por escritas concorrentes. Eles passavam só quando rodados isolados
  // por `--grep`, o que mascarou o problema durante a Fase 3 e barrou o primeiro deploy dela.
  //
  // A correção é ordem explícita, via `dependencies`: o Playwright roda um projeto de dependência
  // até o fim antes de iniciar quem depende dele. A cadeia é
  //
  //   vazio-celular → vazio-desktop → vazio-historico → { desktop, celular }
  //
  // Os dois primeiros rodam os testes `@vazio-global` (só leitura, banco intacto) um viewport de
  // cada vez — em paralelo eles não se atrapalhariam, mas `vazio-historico` CRIA uma encomenda,
  // então precisa vir depois dos dois. Só então `desktop` e `celular` rodam todo o resto em
  // paralelo, com `grepInvert` para não repetir os quatro.
  //
  // Custo: alguns segundos de login a mais por etapa da cadeia. O que se compra é a prova de
  // ENC-13 (o estado vazio "A roda ainda não gira.") rodando na suíte completa, não só sob grep.
  projects: [
    {
      name: "vazio-celular",
      use: { ...devices["Pixel 7"] },
      grep: /@vazio-global/,
    },
    {
      name: "vazio-desktop",
      use: { ...devices["Desktop Chrome"] },
      grep: /@vazio-global/,
      dependencies: ["vazio-celular"],
    },
    {
      name: "vazio-historico",
      use: { ...devices["Desktop Chrome"] },
      grep: /@vazio-historico/,
      dependencies: ["vazio-desktop"],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@vazio-(global|historico)/,
      dependencies: ["vazio-historico"],
    },
    {
      name: "celular",
      use: { ...devices["Pixel 7"] },
      grepInvert: /@vazio-(global|historico)/,
      dependencies: ["vazio-historico"],
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "",
      // Valor de teste explicitamente descartável, no mesmo espírito da senha efêmera de
      // docker/compose.teste.yml — nunca o AUTH_SECRET real.
      AUTH_SECRET: "segredo-de-teste-efemero-sem-valor-real",
      // Obrigatório atrás de proxy reverso (Caddy) — sem ela o Auth.js ignora
      // X-Forwarded-* e monta URLs de callback erradas (01-ARQUITETURA.md §6). Exercitada
      // aqui para não descobrir a falta só em produção.
      AUTH_TRUST_HOST: "true",
    },
  },
});

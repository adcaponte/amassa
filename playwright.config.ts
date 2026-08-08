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
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "celular",
      use: { ...devices["Pixel 7"] },
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

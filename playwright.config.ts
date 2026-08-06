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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
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
    },
  },
});

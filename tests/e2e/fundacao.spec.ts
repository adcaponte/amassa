import { test, expect } from "@playwright/test";

import { FRASE_NO_AR } from "@/app/frase-no-ar";

// Cobre o caminho inteiro da autenticação (D1/D2/D3 do 02a-01-PLAN.md), /api/health e, desde a
// Fase 04.6 (D-03/D-21), a fronteira entre a raiz pública e `/gestao` protegido. A conta usada
// no segundo caso vem do globalSetup (tests/e2e/apoio/preparar-usuario.ts), que roda o próprio
// scripts/criar-usuario.ts — não semeia a tabela por fora.
// Roda nos dois projetos (desktop e celular) declarados em playwright.config.ts.
test.describe("fundação", () => {
  test("sem sessão, /gestao redireciona para /gestao/login", async ({ page }) => {
    await page.goto("/gestao");
    // O middleware acrescenta `?callbackUrl=...` ao redirecionar — a asserção cobre o
    // caminho, não a query string.
    await expect(page).toHaveURL(/\/gestao\/login(\?|$)/);

    // A frase da Fase 1 (INFRA-02) precisa continuar visível sem sessão — agora em
    // `/gestao/login`, depois que a plataforma inteira desceu para o prefixo (Fase 04.6).
    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();
    await expect(page.getByText(FRASE_NO_AR)).toBeVisible();
  });

  test("entrar com a conta criada pelo script abre /gestao", async ({ page }) => {
    await page.goto("/gestao/login");

    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/gestao$/);
    // O Início continua sendo o painel (D-16, 02b-03): a saudação ao usuário substitui o antigo
    // heading "AMASSA. Você está autenticado." A prova pública de INFRA-02 (heading "AMASSA")
    // continua só em `/gestao/login`, no caso "sem sessão" acima — não muda.
    await expect(page.getByRole("heading", { name: /^Olá, / })).toBeVisible();
  });

  // Fase 04.6 (D-03): a raiz não é mais protegida — o `config.matcher` de `middleware.ts` só
  // alcança `/gestao/:path*`, então uma requisição a "/" nunca passa pelo `authorized()` do
  // Auth.js. Na onda 1 (este plano) `app/page.tsx` ainda não existe — o site chega no plano 03
  // desta fase — então esta asserção cobre só o STATUS da raiz, nunca o conteúdo: o que importa
  // aqui é que ela NÃO redireciona para login, não o que ela mostra.
  test("a raiz não exige sessão e não redireciona para /gestao/login (D-03)", async ({
    request,
  }) => {
    const resposta = await request.get("/", { maxRedirects: 0 });
    // Nunca um redirecionamento (3xx) — se o middleware ainda protegesse a raiz, esta resposta
    // seria um 307/302 para `/gestao/login`. Sem `app/page.tsx` nesta onda (o site é o plano
    // 03), o Next devolve o 404 público — o que importa aqui é a AUSÊNCIA de redirecionamento e
    // de cabeçalho `Location`, não o conteúdo do corpo.
    const eRedirecionamento = resposta.status() >= 300 && resposta.status() < 400;
    expect(eRedirecionamento).toBe(false);
    expect(resposta.headers()["location"]).toBeUndefined();
  });

  test("/api/health responde 200 com o banco em ordem", async ({ request }) => {
    const resposta = await request.get("/api/health");
    expect(resposta.status()).toBe(200);

    const corpo = await resposta.json();
    expect(corpo.status).toBe("ok");
    expect(corpo.banco).toBe("ok");
  });
});

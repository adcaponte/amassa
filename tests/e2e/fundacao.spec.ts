import { test, expect } from "@playwright/test";

import { FRASE_NO_AR } from "@/app/frase-no-ar";

// Cobre o caminho inteiro da autenticação (D1/D2/D3 do 02a-01-PLAN.md) e /api/health. A
// conta usada no segundo caso vem do globalSetup (tests/e2e/apoio/preparar-usuario.ts), que
// roda o próprio scripts/criar-usuario.ts — não semeia a tabela por fora.
// Roda nos dois projetos (desktop e celular) declarados em playwright.config.ts.
test.describe("fundação", () => {
  test("sem sessao a raiz redireciona para /login", async ({ page }) => {
    await page.goto("/");
    // O middleware acrescenta `?callbackUrl=...` ao redirecionar — a asserção cobre o
    // caminho, não a query string.
    await expect(page).toHaveURL(/\/login(\?|$)/);

    // A frase da Fase 1 (INFRA-02) precisa continuar visível sem sessão — agora aqui,
    // já que a raiz deixou de ser pública.
    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();
    await expect(page.getByText(FRASE_NO_AR)).toBeVisible();
  });

  test("entrar com a conta criada pelo script abre a raiz", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();
  });

  test("/api/health responde 200 com o banco em ordem", async ({ request }) => {
    const resposta = await request.get("/api/health");
    expect(resposta.status()).toBe(200);

    const corpo = await resposta.json();
    expect(corpo.status).toBe("ok");
    expect(corpo.banco).toBe("ok");
  });
});

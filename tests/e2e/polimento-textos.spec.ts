import { test, expect, type Page } from "@playwright/test";

// Três textos que o Cowork achou (06.5-13-PLAN.md, D-14, POL-07):
// - o mês por extenso como título é “Outubro de 2026” — o “de” minúsculo, sem CSS que transforme a
//   caixa (achado 21);

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

test.describe("polimento textos — mês", () => {
  for (const aba of ["caixa", "mes"] as const) {
    test(`?aba=${aba}: o título do mês é “Outubro de 2026”, sem transformação de caixa`, async ({ page }) => {
      await fazerLogin(page);
      await page.goto(`/gestao/financeiro?aba=${aba}&mes=2026-10`);

      const titulo = page.getByTestId("mes-nav").getByRole("heading", { level: 2 });
      await expect(titulo).toBeVisible();
      await expect(titulo).toHaveText("Outubro de 2026");
      // `toHaveText` lê o texto do DOM; é o CSS que punha “De” na tela. Ele não pode voltar.
      await expect(titulo).toHaveCSS("text-transform", "none");
    });
  }
});

import { test, expect, type Page } from "@playwright/test";

import { FRASE_VAZIO_TITULO, ROTULO_NOVO_FORNO } from "@/lib/queimas/textos";

// O traçado ponta a ponta do módulo de Fornos (04-01-PLAN.md, Tarefa 2): das três tabelas até um
// forno cadastrado pela interface aparecendo no índice, sobrevivendo a um recarregamento. Dois
// casos: (1) `@vazio-global`, só leitura — entra na cadeia `vazio-celular → vazio-desktop`
// (playwright.config.ts), antes de qualquer teste que crie dado, a mesma disciplina que
// `tests/e2e/encomendas-indice.spec.ts` já segue; (2) sem etiqueta — cria um forno de verdade
// pela Server Action `criarForno`, nunca por INSERT direto no banco.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Nome inventado e reconhecível como tal (nunca dado real do ateliê), único por chamada — evita
// colisão entre os projetos `desktop`/`celular` rodando contra o mesmo banco de teste efêmero.
function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("traçado do módulo de Fornos", () => {
  test.describe.configure({ mode: "serial" });

  test("com o banco vazio, 'Nenhum forno cadastrado ainda.' aparece e o botão 'Novo forno' está habilitado @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/queimas");

    const frase = page.getByRole("heading", { name: FRASE_VAZIO_TITULO, level: 2 });
    await expect(frase).toHaveCount(1);
    await expect(frase).toBeVisible();

    const botaoDoEstadoVazio = page
      .getByTestId("estado-vazio")
      .getByRole("link", { name: ROTULO_NOVO_FORNO });
    await expect(botaoDoEstadoVazio).toBeVisible();
    await expect(botaoDoEstadoVazio).not.toHaveAttribute("aria-disabled", "true");
    await expect(botaoDoEstadoVazio).toHaveAttribute("href", "/queimas?novo");
  });

  test("um forno cadastrado pelo botão do estado vazio aparece como cartão no índice, e sobrevive a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Forno traçado");

    await page.goto("/queimas?novo");
    await page.getByLabel("Nome").fill(nome);
    await page.getByLabel("Descrição").fill("Forno de teste [e2e]");
    await page.getByLabel("Limite").fill("50");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/queimas$/, { timeout: 10000 });

    const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("0 / 50");

    // Sobrevive a um recarregamento imediato — a prova contra a perda silenciosa que este plano
    // existe para impedir (04-CONTEXT.md, Specific Ideas).
    await page.reload();
    const cartaoAposRecarregar = page
      .locator('[data-testid^="cartao-forno-"]')
      .filter({ hasText: nome });
    await expect(cartaoAposRecarregar).toBeVisible();
  });
});

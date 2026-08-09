import { test, expect } from "@playwright/test";

// Traçado de ponta a ponta desta fase (03-01-PLAN.md, Tarefa 2): logar, abrir
// `/encomendas?nova` (contrato de URL de D-03), criar uma encomenda com um item, e confirmar
// que a lista de `/encomendas` mostra o nome e a data de conclusão calculada em cascata pelo
// módulo puro `lib/encomendas/cronograma.ts`. Depois, recarregar e confirmar que a encomenda
// continua lá — a prova de que a persistência é real (ENC-12), não estado de cliente.
//
// Mesmo helper `fazerLogin` de tests/e2e/casca.spec.ts, duplicado aqui por convenção do
// projeto (cada spec é independente, sem módulo de apoio compartilhado além do globalSetup).
async function fazerLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("encomendas — traçado de ponta a ponta", () => {
  test("criar uma encomenda com um item mostra a data de conclusão em cascata, e sobrevive a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Nome exclusivo por execução — evita colisão entre projetos (desktop/celular) rodando
    // em paralelo contra o mesmo banco de teste efêmero. Dado inventado, reconhecível como
    // inventado (proibição PR-1 do plano): nenhum nome real de cliente ou encomenda do ateliê.
    const nomeDaEncomenda = `[e2e] Peças de teste ${test.info().project.name} ${Date.now()}`;

    await page.goto("/encomendas?nova");

    await page.getByLabel("Nome da encomenda").fill(nomeDaEncomenda);
    await page.getByLabel("Cliente").fill("Cliente inventado para teste");
    await page.getByLabel("Data de início").fill("2026-08-12");
    await page.getByLabel("Descrição do item").fill("Caneca cônica de teste");
    await page.getByLabel("Quantidade").fill("10");

    await page.getByRole("button", { name: "Salvar" }).click();

    // A ação redireciona para /encomendas ao concluir a transação.
    await expect(page).toHaveURL(/\/encomendas$/);

    // producao 3 + secagem 6 + queima1 1 + esmaltacao 1 + queima2 1 + entrega 1 = 13 dias,
    // fim exclusivo a partir de 2026-08-12 → último dia de "entrega" é 2026-08-24.
    const linhaDaEncomenda = page.getByText(nomeDaEncomenda).locator("..");
    await expect(linhaDaEncomenda).toContainText("24/08/2026");

    // Recarregar prova que a gravação é real (ENC-12), não estado de cliente.
    await page.reload();
    await expect(page.getByText(nomeDaEncomenda)).toBeVisible();
  });
});

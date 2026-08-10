import { test, expect, type Page } from "@playwright/test";

// Registro de queima em dois toques (D-04, FOR-01) e o "Desfazer" de 7 segundos (FOR-02) —
// 04-01-PLAN.md, Tarefa 3. Sem etiqueta de vazio: cria dado, roda em `desktop`/`celular` depois
// da cadeia `vazio-*` (playwright.config.ts).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarForno(page: Page, nome: string): Promise<void> {
  await page.goto("/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill("50");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/queimas$/, { timeout: 10000 });
}

function cartaoDoForno(page: Page, nome: string) {
  return page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
}

test.describe("registro de queima em dois toques", () => {
  test.describe.configure({ mode: "serial" });

  test("dois toques — 'Queimar' e depois o tipo — registram a queima, o toast aparece em menos de 5s, e o contador sobrevive a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Forno dois toques");
    await cadastrarForno(page, nome);

    const cartao = cartaoDoForno(page, nome);
    await expect(cartao).toBeVisible();
    await expect(cartao.getByTestId(/^contador-forno-/)).toContainText("0 / 50");

    const inicio = Date.now();

    // Toque 1: abre o seletor de tipo. Nenhum indicador de carregamento entre os dois toques
    // (E3/loading, backstop, FOR-01) — o seletor precisa estar pronto para o segundo toque
    // IMEDIATAMENTE, sem spinner/skeleton no meio.
    await cartao.getByRole("button", { name: "Queimar" }).click();
    const seletor = cartao.getByTestId("seletor-tipo-queima");
    await expect(seletor).toBeVisible();
    await expect(page.locator('[class*="animate-spin"]')).toHaveCount(0);

    // Toque 2: escolhe o tipo. É a gravação em si — a queima existe porque o servidor confirmou.
    await cartao.getByTestId("tipo-queima-biscoito").click();

    await expect(page.getByText("Queima registrada.")).toBeVisible({ timeout: 5000 });
    const decorrido = Date.now() - inicio;
    expect(decorrido).toBeLessThan(5000);

    // O contador do cartão avança para 1 depois da resposta confirmada do servidor
    // (`router.refresh()`), nunca antes (fluxo não otimista, de propósito).
    await expect(cartao.getByTestId(/^contador-forno-/)).toContainText("1 / 50");

    // Sobrevive a um recarregamento imediato — a prova contra a perda silenciosa que este plano
    // existe para impedir.
    await page.reload();
    const cartaoAposRecarregar = cartaoDoForno(page, nome);
    await expect(cartaoAposRecarregar.getByTestId(/^contador-forno-/)).toContainText("1 / 50");
  });

  test("'Desfazer' remove a queima recém-registrada e o contador volta ao valor anterior, também depois de recarregar", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Forno desfazer");
    await cadastrarForno(page, nome);

    const cartao = cartaoDoForno(page, nome);
    await cartao.getByRole("button", { name: "Queimar" }).click();
    await cartao.getByTestId("tipo-queima-esmalte").click();

    await expect(page.getByText("Queima registrada.")).toBeVisible({ timeout: 5000 });
    await expect(cartao.getByTestId(/^contador-forno-/)).toContainText("1 / 50");

    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByText("Queima desfeita.")).toBeVisible({ timeout: 5000 });

    await expect(cartao.getByTestId(/^contador-forno-/)).toContainText("0 / 50");

    await page.reload();
    const cartaoAposRecarregar = cartaoDoForno(page, nome);
    await expect(cartaoAposRecarregar.getByTestId(/^contador-forno-/)).toContainText("0 / 50");
  });
});

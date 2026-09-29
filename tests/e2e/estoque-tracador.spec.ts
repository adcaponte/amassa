import { test, expect, type Page } from "@playwright/test";

import { movimentacoesDoItem, saldoNoBanco, semearMaterial } from "./apoio/semear-estoque";

// O traçador da Fase 06 (plano 06-01, critério 1 do ROADMAP, EST-01): 5 kg de argila entram por
// R$ 21,00, 2 kg saem para "Uso do ateliê", e o cartão mostra 3 kg — pelo caminho inteiro, tela →
// Server Action → `lib/estoque/gravacao.ts` → banco → `listarSaldos` → tela, sem atalho. Cada teste
// semeia o próprio material com sufixo único e o acha pelo `data-item-id` — nenhuma afirmação global
// do banco fora do caso `@vazio-global`, que roda na cadeia `vazio-*` de `playwright.config.ts`
// (CLAUDE.md: nunca `--grep` como muleta). Nomes inventados com prefixo `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const CATEGORIA_DE_COMPRA = "Argila, esmalte e insumos";

function cartaoDoItem(page: Page, itemId: string) {
  // Cartão (< 980px) e linha da tabela (≥ 980px) levam o mesmo `data-testid` desde o plano 06-04;
  // só um dos dois está visível em cada largura.
  return page
    .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
    .filter({ visible: true });
}

test.describe("estoque tracador", () => {
  test("5 kg entram por R$ 21,00, 2 kg saem para o uso do ateliê, e o cartão mostra 3 kg", async ({
    page,
  }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("0");

    // Entrada: a folha abre em Saída ("Dar baixa"); troca para Entrada.
    await cartao.getByTestId("estoque-dar-baixa").click();
    const folha = page.getByTestId("folha-movimentacao");
    await expect(folha).toBeVisible();
    await folha.getByTestId("folha-tipo-entrada").click();
    await expect(folha.getByTestId("folha-tipo-entrada")).toHaveAttribute("aria-checked", "true");
    await folha.getByTestId("folha-quantidade").fill("5");
    await folha.getByTestId("folha-custo").fill("21,00");
    await expect(folha.getByTestId("folha-registrar")).toHaveText("Registrar entrada");
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Entrada de 5 kg em ${nome}.`)).toBeVisible();
    await expect(folha).toBeHidden();
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("5");

    // Baixa: 2 kg para "Uso do ateliê".
    await cartao.getByTestId("estoque-dar-baixa").click();
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("folha-tipo-saida")).toHaveAttribute("aria-checked", "true");
    await folha.getByTestId("folha-quantidade").fill("2");
    await folha.getByTestId("folha-destino-atelie").click();
    // A grade virou `radiogroup` no plano 06-06 (uma saída tem exatamente um destino — EST-11).
    await expect(folha.getByTestId("folha-destino-atelie")).toHaveAttribute("aria-checked", "true");
    await expect(folha.getByTestId("folha-registrar")).toHaveText("Registrar baixa");
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Baixa de 2 kg em ${nome}.`)).toBeVisible();
    await expect(folha).toBeHidden();
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("3");
    await expect(cartao.getByTestId("estoque-cartao-unidade")).toHaveText("kg");

    // O livro: duas linhas, na ordem de `numero`, com o valor decidido no servidor (casos 1/1b da
    // pesquisa) e a área que pagou vinda do destino (D-14).
    const linhas = await movimentacoesDoItem(itemId);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      origem: "manual",
      tipo: "entrada",
      destino: null,
      area: null,
      quantidadeMilesimos: 5000,
      valorCentavos: 2100,
      valorInformadoCentavos: 2100,
    });
    expect(linhas[1]).toMatchObject({
      origem: "manual",
      tipo: "saida",
      destino: "atelie",
      area: "pecas",
      quantidadeMilesimos: -2000,
      valorCentavos: -840,
      valorInformadoCentavos: null,
    });
    expect(await saldoNoBanco(itemId)).toBe(3000);
  });

  test("um toque duplo em Registrar baixa grava UMA linha só", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    const cartao = cartaoDoItem(page, itemId);
    await cartao.getByTestId("estoque-dar-baixa").click();
    const folha = page.getByTestId("folha-movimentacao");
    await folha.getByTestId("folha-quantidade").fill("1");
    await folha.getByTestId("folha-destino-perda").click();
    await folha.getByTestId("folha-registrar").dblclick();

    // Sem entrada anterior, a baixa deixa o saldo negativo — permitido, com aviso no toast (D-06).
    await expect(page.getByText(`Baixa de 1 kg em ${nome}. O saldo ficou em −1 kg.`)).toBeVisible();
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("−1");
    await page.waitForLoadState("networkidle");

    expect(await movimentacoesDoItem(itemId)).toHaveLength(1);
    expect(await saldoNoBanco(itemId)).toBe(-1000);
  });

  test("uma saída sem destino avisa embaixo da grade e não grava nada", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = page.getByTestId("folha-movimentacao");
    await folha.getByTestId("folha-quantidade").fill("2");
    await folha.getByTestId("folha-registrar").click();

    const erro = folha.getByTestId("folha-erro");
    await expect(erro).toHaveText("Escolha para onde o material foi.");
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(folha).toBeVisible();
    // O que foi digitado continua lá.
    await expect(folha.getByTestId("folha-quantidade")).toHaveValue("2");

    expect(await movimentacoesDoItem(itemId)).toHaveLength(0);
  });

  // Afirma uma condição GLOBAL do banco ("nenhum item com estoque próprio") — só vale na cadeia
  // `vazio-celular → vazio-desktop`, que roda ANTES de qualquer teste que semeie material. Só leitura.
  test("sem nenhum item com estoque próprio, a página mostra o estado vazio @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    const vazio = page.getByTestId("estoque-vazio");
    await expect(vazio).toBeVisible();
    await expect(vazio.getByRole("heading", { name: "Nada no estoque ainda.", level: 2 })).toBeVisible();
    await expect(vazio).toContainText(
      "Cadastre o primeiro material — argila, esmalte, café, embalagem — para acompanhar o que entra e o que sai.",
    );
    await expect(page.getByTestId("estoque-cartao")).toHaveCount(0);
  });
});

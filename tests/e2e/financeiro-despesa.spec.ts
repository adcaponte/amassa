import { test, expect, type Page } from "@playwright/test";

import { semearItem } from "./apoio/semear-financeiro";

// A Despesa com os três caminhos do protótipo (04.4-07-PLAN.md): compra de material · outra
// despesa · pagar conta que já existe (leva ao Caixa) — os exemplos 2 (5 kg de pão de queijo) e 4
// (ferramenta de cerâmica) de despesa do protótipo. Cada caso semeia os próprios itens com
// sufixo único e usa a BUSCA para achá-los.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function irParaDespesa(page: Page) {
  await page.goto("/financeiro?aba=despesa");
}

function atalhoDeCompra(page: Page, nome: string) {
  return page.getByTestId("compra-atalho").filter({ hasText: nome });
}

// Confere que "Lançar despesa" navegou de verdade — só o fragmento ESTÁVEL "aba=despesa" (nunca
// "&aviso=lancado&documento=", que `AvisoFinanceiro` limpa da URL no mesmo instante em que mostra
// o toast — mesmo achado real do plano 03, ver `financeiro-venda.spec.ts`).
async function esperarDespesaLancada(page: Page) {
  await expect(page).toHaveURL(/\?aba=despesa/, { timeout: 10000 });
}

const botaoLancar = (page: Page) => page.getByRole("button", { name: "Lançar despesa" });

test.describe("financeiro despesa", () => {
  test("a aba Despesa existe e abre nas três pílulas", async ({ page }) => {
    await fazerLogin(page);
    await irParaDespesa(page);
    await expect(page.getByTestId("financeiro-aba-despesa")).toBeVisible();
    await expect(page.getByTestId("despesa-modo-compra")).toBeVisible();
    await expect(page.getByTestId("despesa-modo-outra")).toBeVisible();
    await expect(page.getByTestId("despesa-modo-conta")).toBeVisible();
  });

  test("exemplo 2 — 5 kg de pão de queijo por R$ 160: o que põe no estoque e o extrato", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeQueijo = `[e2e] Pão de queijo congelado ${suf}`;
    await semearItem({
      nome: nomeQueijo,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "kg",
      categoriaCompra: "Insumos da cafeteria",
      atalhoCompra: true,
    });

    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-compra").click();

    await page.getByTestId("compra-busca").fill(suf);
    await atalhoDeCompra(page, nomeQueijo).click();
    // Tocar duas vezes no mesmo material não duplica a linha (must_have do plano).
    await atalhoDeCompra(page, nomeQueijo).click();
    await expect(page.getByTestId("compra-linha")).toHaveCount(1);

    await page.getByLabel("Fornecedor (opcional)").fill(`Laticínio da Serra ${suf}`);
    await page.getByTestId("compra-quantos").fill("5");
    await page.getByTestId("compra-custou").fill("160");

    await expect(page.getByTestId("despesa-total")).toContainText("R$ 160,00");

    const efeito = page.getByTestId("despesa-efeito");
    await expect(efeito).toBeVisible();
    await expect(efeito).toContainText(`+5 kg · ${nomeQueijo}`);

    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarDespesaLancada(page);

    // `formatarReais` usa o espaço NÃO SEPARÁVEL do `Intl.NumberFormat` pt-BR entre "R$" e o
    // valor (U+00A0, não U+0020) — `\s` casa os dois.
    await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s160,00$/)).toBeVisible({ timeout: 5000 });

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nomeQueijo });
    await expect(linhaDoExtrato).toBeVisible();
    await expect(linhaDoExtrato).toContainText("− R$ 160,00");
  });

  test("compra em 3x (Esmalte, R$ 2.400,00): as três parcelas, com 'já paguei' só na primeira", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeEsmalte = `[e2e] Esmalte (pote) ${suf}`;
    await semearItem({
      nome: nomeEsmalte,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Argila, esmalte e insumos",
      atalhoCompra: true,
    });

    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-compra").click();
    await page.getByTestId("compra-busca").fill(suf);
    await atalhoDeCompra(page, nomeEsmalte).click();
    await page.getByTestId("compra-quantos").fill("100");
    await page.getByTestId("compra-custou").fill("2400");
    await expect(page.getByTestId("despesa-total")).toContainText("R$ 2.400,00");

    await page.getByTestId("pagamento-plano").selectOption("3");
    const parcelas = page.getByTestId("parcela-linha");
    await expect(parcelas).toHaveCount(3);
    await expect(parcelas.nth(0).locator('input[type="checkbox"]')).toBeChecked();
    await expect(parcelas.nth(1).locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(parcelas.nth(2).locator('input[type="checkbox"]')).not.toBeChecked();

    await expect(botaoLancar(page)).toBeEnabled();
  });

  test("a 320px, a Despesa não rola na horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await irParaDespesa(page);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Despesa rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test("exemplo 4 — Jogo de estecas e desbastadores, Ferramentas e utensílios, R$ 185", async ({ page }) => {
    const suf = sufixoUnico();
    const descricao = `Jogo de estecas e desbastadores ${suf}`;

    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-outra").click();

    await page.getByLabel("Descrição").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Ferramentas e utensílios" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("185");

    await expect(page.getByTestId("despesa-total")).toContainText("R$ 185,00");
    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarDespesaLancada(page);
    // A página parte JÁ de `?aba=despesa` (irParaDespesa) — o fragmento estável sozinho não
    // detecta a navegação de verdade. O toast é o sinal real de que o lançamento terminou antes
    // de seguir para o Caixa (mesmo cuidado de `financeiro-pagamento.spec.ts`).
    await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s185,00$/)).toBeVisible({ timeout: 5000 });

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await expect(linhaDoExtrato).toContainText("− R$ 185,00");
  });

  test("a dica do Fora aparece com 'Equipamento e obra' e some com 'Aluguel'", async ({ page }) => {
    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-outra").click();

    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Equipamento e obra" }).click();
    await expect(page.getByTestId("despesa-dica-fora")).toBeVisible();

    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aluguel" }).click();
    await expect(page.getByTestId("despesa-dica-fora")).toHaveCount(0);
  });

  test("sem descrição, 'Lançar despesa' fica desabilitado", async ({ page }) => {
    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-outra").click();

    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aluguel" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("100");

    await expect(botaoLancar(page)).toBeDisabled();
  });

  test("'+ outra forma' numa outra despesa de R$ 150 (Pix 100 + Dinheiro 50) lança duas linhas, sem taxa", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Despesa mista ${suf}`;

    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-outra").click();

    await page.getByLabel("Descrição").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aluguel" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");

    await page.getByTestId("pagamento-outra-forma").click();
    const parcelas = page.getByTestId("parcela-linha");
    await expect(parcelas).toHaveCount(2);

    await parcelas.nth(0).getByRole("button", { name: "Pix", exact: true }).click();
    await parcelas.nth(0).locator('input[inputmode="decimal"]').fill("100,00");
    await parcelas.nth(1).getByRole("button", { name: "Dinheiro", exact: true }).click();
    await parcelas.nth(1).locator('input[inputmode="decimal"]').fill("50,00");

    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarDespesaLancada(page);
    await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s150,00$/)).toBeVisible({ timeout: 5000 });

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhasDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await expect(linhasDoExtrato).toHaveCount(2);
    await expect(linhasDoExtrato.filter({ hasText: "Pix" })).toContainText("− R$ 100,00");
    await expect(linhasDoExtrato.filter({ hasText: "Dinheiro" })).toContainText("− R$ 50,00");
    await expect(linhasDoExtrato.first().getByTestId("extrato-taxa")).toHaveCount(0);
  });

  test("'Pagar conta que já existe' leva a ?aba=caixa", async ({ page }) => {
    await fazerLogin(page);
    await irParaDespesa(page);
    await page.getByTestId("despesa-modo-conta").click();
    await expect(page).toHaveURL(/\/financeiro\?aba=caixa$/);
  });
});

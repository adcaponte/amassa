import { test, expect, type Page } from "@playwright/test";

import { buscarCategoriaPorNome } from "./apoio/semear-financeiro";
import { diaDoMes, mesReservado } from "./apoio/mes-reservado";

// O extrato por mês e por forma (D-11/D-12, 04.4-09-PLAN.md Tarefa 2): navegação ◀ mês ▶, filtro
// Todas · Dinheiro · Pix · Cartão, o total filtrado ("quanto entrou em dinheiro?") e o saldo
// "depois" continuando o acumulado GLOBAL mesmo com filtro aplicado. Cada caso roda no PRÓPRIO mês
// reservado (`mes-reservado.ts`) — nenhuma afirmação de número global do banco.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function esperarVendaLancada(page: Page) {
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

async function esperarDespesaLancada(page: Page) {
  await expect(page).toHaveURL(/\?aba=despesa/, { timeout: 10000 });
}

// Lança uma venda "valor livre" na data pedida, à vista, na forma pedida — o caso mais simples
// para encher o extrato sem depender de nenhum item do catálogo.
async function lancarVendaLivre(
  page: Page,
  { data, descricao, valor, forma }: { data: string; descricao: string; valor: string; forma: "Pix" | "Dinheiro" | "Cartão" },
) {
  await page.goto("/financeiro");
  await page.getByLabel("Data").fill(data);
  await page.getByRole("button", { name: "+ Valor livre" }).click();
  await page.getByLabel("O que é").fill(descricao);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Bebidas e comidas" }).click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page.getByRole("button", { name: "Pôr na venda" }).click();
  await page.getByRole("button", { name: forma, exact: true }).click();
  await page.getByRole("button", { name: "Lançar venda" }).click();
  await esperarVendaLancada(page);
}

// Lança uma "outra despesa" na data pedida, à vista, na forma pedida.
async function lancarDespesaLivre(
  page: Page,
  { data, descricao, valor, forma }: { data: string; descricao: string; valor: string; forma: "Pix" | "Dinheiro" | "Cartão" },
) {
  await page.goto("/financeiro?aba=despesa");
  await page.getByTestId("despesa-modo-outra").click();
  await page.getByLabel("Data").fill(data);
  await page.getByLabel("Descrição").fill(descricao);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Aluguel" }).click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page.getByRole("button", { name: forma, exact: true }).click();
  await page.getByRole("button", { name: "Lançar despesa" }).click();
  await esperarDespesaLancada(page);
}

function linhaDoExtrato(page: Page, texto: string) {
  return page.getByTestId("extrato-linha").filter({ hasText: texto });
}

async function saldoDepoisCentavos(page: Page, texto: string): Promise<number> {
  const conteudo = await linhaDoExtrato(page, texto).getByTestId("extrato-saldo-depois").innerText();
  // "saldo R$ 1.234,56" → 123456 (centavos), sem depender de locale de número do runner.
  const numero = conteudo
    .replace("saldo", "")
    .replace("R$", "")
    .trim()
    .replaceAll(".", "")
    .replace(",", ".");
  return Math.round(Number(numero) * 100);
}

test.describe("financeiro extrato", () => {
  test("navega por mês, filtra por forma, mantém o saldo global, e mostra os dois vazios", async ({ page }) => {
    await buscarCategoriaPorNome("Bebidas e comidas");
    await buscarCategoriaPorNome("Aluguel");

    const mes = mesReservado("extrato-lancamentos", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    const nome10 = `[e2e] Extrato dia10 ${suf}`;
    const nome12 = `[e2e] Extrato dia12 ${suf}`;
    const nome14 = `[e2e] Extrato despesa dia14 ${suf}`;
    const nome15 = `[e2e] Extrato dia15 ${suf}`;

    await fazerLogin(page);

    await lancarVendaLivre(page, { data: diaDoMes(mes, 10), descricao: nome10, valor: "100", forma: "Pix" });
    await lancarVendaLivre(page, { data: diaDoMes(mes, 12), descricao: nome12, valor: "50", forma: "Dinheiro" });
    await lancarDespesaLivre(page, { data: diaDoMes(mes, 14), descricao: nome14, valor: "20", forma: "Dinheiro" });
    await lancarVendaLivre(page, { data: diaDoMes(mes, 15), descricao: nome15, valor: "30", forma: "Pix" });

    await page.goto(`/financeiro?aba=caixa&mes=${mes}`);

    // As quatro linhas em ordem do mais recente (dia15, dia14, dia12, dia10).
    const linhas = page.getByTestId("extrato-linha");
    await expect(linhas).toHaveCount(4);
    await expect(linhas.nth(0)).toContainText(nome15);
    await expect(linhas.nth(1)).toContainText(nome14);
    await expect(linhas.nth(2)).toContainText(nome12);
    await expect(linhas.nth(3)).toContainText(nome10);

    const saldo15Antes = await saldoDepoisCentavos(page, nome15);
    const saldo14Antes = await saldoDepoisCentavos(page, nome14);
    const saldo12Antes = await saldoDepoisCentavos(page, nome12);
    const saldo10Antes = await saldoDepoisCentavos(page, nome10);

    // A diferença entre o saldo depois de duas linhas consecutivas é o valor com sinal da mais
    // nova: dia15 é uma venda de +R$30 (Pix); dia14 é uma despesa de −R$20; dia12 é uma venda de
    // +R$50.
    expect(saldo15Antes - saldo14Antes).toBe(3000);
    expect(saldo14Antes - saldo12Antes).toBe(-2000);
    expect(saldo12Antes - saldo10Antes).toBe(5000);

    // Lançamento retroativo (dia 5, R$ 7,00 no Pix) — o saldo depois de TODAS as quatro linhas
    // anteriores aumenta exatamente R$ 7,00 (recálculo retroativo, key_link do plano 09).
    const nome05 = `[e2e] Extrato retroativo dia05 ${suf}`;
    await lancarVendaLivre(page, { data: diaDoMes(mes, 5), descricao: nome05, valor: "7", forma: "Pix" });
    await page.goto(`/financeiro?aba=caixa&mes=${mes}`);

    expect(await saldoDepoisCentavos(page, nome15)).toBe(saldo15Antes + 700);
    expect(await saldoDepoisCentavos(page, nome14)).toBe(saldo14Antes + 700);
    expect(await saldoDepoisCentavos(page, nome12)).toBe(saldo12Antes + 700);
    expect(await saldoDepoisCentavos(page, nome10)).toBe(saldo10Antes + 700);

    // Filtro Dinheiro → só as duas de dinheiro (dia12 venda, dia14 despesa), com os MESMOS saldos
    // depois de antes do filtro (D-12 — o filtro esconde linhas, não recalcula saldo).
    const saldo12ComTudo = await saldoDepoisCentavos(page, nome12);
    const saldo14ComTudo = await saldoDepoisCentavos(page, nome14);

    await page.getByTestId("extrato-filtro-dinheiro").click();
    await expect(page).toHaveURL(/forma=dinheiro/);
    await expect(page.getByTestId("extrato-linha")).toHaveCount(2);
    await expect(linhaDoExtrato(page, nome10)).toHaveCount(0);
    await expect(linhaDoExtrato(page, nome15)).toHaveCount(0);
    expect(await saldoDepoisCentavos(page, nome12)).toBe(saldo12ComTudo);
    expect(await saldoDepoisCentavos(page, nome14)).toBe(saldo14ComTudo);
    await expect(page.getByTestId("extrato-total-filtrado")).toContainText("Total em Dinheiro neste mês: + R$ 30,00");

    // Filtro Cartão → nenhuma linha nesta forma, com o vazio distinto do "sem movimento".
    await page.getByTestId("extrato-filtro-cartao").click();
    await expect(page.getByText("Nada neste mês, nesta forma.")).toBeVisible();

    // ◀ para o mês anterior (garantidamente vazio — meses reservados espaçados de 3 em 3) →
    // "Nada neste mês ainda."; ▶ volta ao mês de origem.
    await page.getByTestId("extrato-filtro-todas").click();
    await page.getByLabel("mês anterior").click();
    await expect(page.getByText("Nada neste mês ainda.")).toBeVisible();
    await page.getByLabel("mês seguinte").click();
    await expect(page.getByTestId("extrato-linha")).toHaveCount(5);
  });

  test("a 320px de largura, o extrato não rola na horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/financeiro?aba=caixa");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Extrato rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

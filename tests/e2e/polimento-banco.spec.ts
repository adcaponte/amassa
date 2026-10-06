import { test, expect, type Page } from "@playwright/test";

import { mesesParaGeracao, tituloDaContaFixa } from "@/lib/cadastros/contas-fixas";

import { hojeNoAtelie } from "./apoio/semear-financeiro";

// O banco da Fase 06.5 (06.5-11-PLAN.md, D-26 / migração 0031): uma conta fixa cancelada libera o
// mês e é gerada de novo pela tela — o índice único parcial `documentos_conta_fixa_mes_ativo_uk` e
// o `onConflictDoNothing` com o predicado `cancelado_em is null` de `gerarContasDoMes`.

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

async function irParaContasFixas(page: Page) {
  await page.goto("/gestao/cadastros?sub=fixas");
}

// O botão "+ Nova conta fixa" mora no rodapé da lista ou no estado vazio, conforme outro worker já
// ter criado alguma conta — o mesmo padrão de `cadastros-contas-fixas.spec.ts`.
async function abrirNovaContaFixa(page: Page) {
  const botaoPopulado = page.getByTestId("nova-conta-fixa");
  const botaoVazio = page
    .getByTestId("cadastros-vazio-fixas")
    .getByRole("button", { name: "+ Nova conta fixa" });
  await Promise.race([
    botaoPopulado.waitFor({ state: "visible" }),
    botaoVazio.waitFor({ state: "visible" }),
  ]);
  if (await botaoPopulado.isVisible()) {
    await botaoPopulado.click();
  } else {
    await botaoVazio.click();
  }
}

function linhaDaContaFixa(page: Page, nome: string) {
  return page
    .getByTestId("conta-fixa-linha")
    .filter({ has: page.getByText(nome, { exact: true }) });
}

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

async function gerarContasDoMes(page: Page, mes: string) {
  await irParaContasFixas(page);
  await page.getByTestId("gerar-contas-mes").selectOption(mes);
  await page.getByTestId("gerar-contas").click();
  // "N conta(s) de {mês} criada(s) no Caixa." — nunca "já existiam": a conta deste teste é nova
  // (primeira geração) ou acabou de ser cancelada (segunda), e nos dois casos o mês é criado.
  await expect(page.getByText(/conta\(s\) de .+ criada\(s\) no Caixa\.$/)).toBeVisible({
    timeout: 10000,
  });
}

test.describe("polimento banco — conta fixa", () => {
  // "Gerar" é GLOBAL (toda conta fixa ativa do banco). Para não disputar mês com
  // `cadastros-contas-fixas` (que gera o 2º, o 3º e o 4º mês da faixa) nem pôr despesas no mês
  // corrente que outros testes leem, cada projeto gera um mês PRÓPRIO, no fim da faixa: o último
  // no desktop, o penúltimo no celular. A afirmação é sempre sobre o título da PRÓPRIA conta.
  test("uma conta fixa cancelada no Caixa é gerada de novo para o mesmo mês", async ({
    page,
  }, testInfo) => {
    const faixa = mesesParaGeracao(hojeNoAtelie());
    const mes =
      testInfo.project.name === "desktop"
        ? faixa[faixa.length - 1]
        : faixa[faixa.length - 2];
    const nome = `[e2e] Conta da 0031 ${sufixoUnico()}`;
    const titulo = tituloDaContaFixa(nome, mes);

    await fazerLogin(page);
    await irParaContasFixas(page);

    await abrirNovaContaFixa(page);
    await expect(page.getByRole("heading", { name: "Nova conta fixa" })).toBeVisible();
    await page.getByLabel("Nome").fill(nome);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aluguel", exact: true }).click();
    await page.getByLabel("Valor esperado", { exact: true }).fill("321");
    await page.getByLabel("Dia de vencimento").fill("12");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(linhaDaContaFixa(page, nome)).toBeVisible();

    // 1ª geração: a conta aparece em "A pagar".
    await gerarContasDoMes(page, mes);
    await page.goto("/gestao/financeiro?aba=caixa");
    await expect(cartaoDaConta(page, titulo)).toHaveCount(1);

    // Cancela a despesa gerada pelo detalhe do Caixa.
    await cartaoDaConta(page, titulo).getByRole("button", { name: "Ver" }).click();
    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await detalhe.getByRole("button", { name: "Cancelar esta despesa" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar despesa", exact: true })
      .click();
    await expect(
      page.getByText(/^Lançamento nº \d+ cancelado\. Continua visível, riscado\.$/),
    ).toBeVisible({
      timeout: 10000,
    });
    await page.goto("/gestao/financeiro?aba=caixa");
    await expect(page.getByTestId("caixa-a-pagar")).toBeVisible();
    await expect(cartaoDaConta(page, titulo)).toHaveCount(0);

    // 2ª geração do MESMO mês: a cancelada não segura o mês (D-26) — a conta volta, uma vez só.
    await gerarContasDoMes(page, mes);
    await page.goto("/gestao/financeiro?aba=caixa");
    await expect(cartaoDaConta(page, titulo)).toHaveCount(1);

    // Faxina: desativa a conta, para ela não entrar nas gerações de outros testes.
    await irParaContasFixas(page);
    await linhaDaContaFixa(page, nome).getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Conta fixa desativada.")).toBeVisible({
      timeout: 10000,
    });
  });
});

import { test, expect, type Page } from "@playwright/test";

import { movimentacoesDoItem, saldoNoBanco, semearMaterial } from "./apoio/semear-estoque";

// Fase 06.5, plano 10 (D-04, D-06, D-13, D-17 no seletor; POL-06). O Estoque aceita a entrada sem
// custo (doação, sobra) como R$ 0 e a lista diz "sem custo"; a contagem continua cega; o "Qual
// material?" começa pela categoria da compra e busca por palavras. Cada teste semeia os SEUS
// materiais com nome inventado e sufixo único e os acha pelo `data-item-id` ou pelo sufixo —
// nenhuma afirmação sobre o banco inteiro (CLAUDE.md).

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
const DICA_CUSTO = "o valor da nota, em reais — vazio conta como R$ 0 (doação, sobra)";

// Cartão (celular) ou linha da tabela (1280 px) — levam o mesmo `data-testid`; só um está visível.
function cartaoDoItem(page: Page, itemId: string) {
  return page
    .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
    .filter({ visible: true });
}

async function abrirEstoque(page: Page) {
  await fazerLogin(page);
  await page.goto("/gestao/estoque");
  await expect(page.getByTestId("estoque-busca")).toBeVisible();
}

test.describe("polimento estoque — custo", () => {
  test("a entrada sem “Quanto custou ao todo” grava R$ 0 e o material diz “sem custo”, nunca “R$ 0,00”", async ({
    page,
  }) => {
    const nome = `[e2e] Argila doada ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);

    const cartao = cartaoDoItem(page, itemId);
    const custoMedio = cartao.getByTestId("estoque-cartao-custo");
    // Sem nenhuma entrada, o custo é desconhecido: "—" (D-26), não "sem custo".
    await expect(custoMedio).toHaveText("—");

    // A dica nova do campo, e o campo vazio não é recusado (D-04).
    await cartao.getByTestId("estoque-dar-baixa").click();
    const folha = page.getByTestId("folha-movimentacao");
    await folha.getByTestId("folha-tipo-entrada").click();
    await expect(folha.getByTestId("folha-custo-dica")).toHaveText(DICA_CUSTO);
    await expect(folha.getByTestId("folha-custo")).toHaveValue("");
    await folha.getByTestId("folha-quantidade").fill("5");
    await folha.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Entrada de 5 kg em ${nome}.`)).toBeVisible();
    await expect(folha).toBeHidden();

    // O livro: uma entrada de 5 kg, informada a 0 centavos.
    const linhas = await movimentacoesDoItem(itemId);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ tipo: "entrada", valorInformadoCentavos: 0 });
    expect(await saldoNoBanco(itemId)).toBe(5000);

    // A tela: saldo 5 e "sem custo" — nunca "R$ 0,00/kg".
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("5");
    await expect(custoMedio).toHaveText("sem custo");
    await expect(custoMedio.getByTestId("estoque-sem-custo")).toHaveText("sem custo");
    await expect(cartao).not.toContainText("R$ 0,00/kg");
  });
});

import { test, expect, type Page } from "@playwright/test";

import {
  contagensDoItem,
  movimentacoesDoItem,
  saldoNoBanco,
  semearMaterial,
  semearMaterialSemMovimentacao,
} from "./apoio/semear-estoque";

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

// Entrada pela folha, a partir do cartão: Dar baixa → Entrada → quantidade → custo (o texto dado).
async function registrarEntrada(page: Page, itemId: string, nome: string, quantidade: string, custo: string) {
  await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
  const folha = page.getByTestId("folha-movimentacao");
  await expect(folha).toBeVisible();
  await folha.getByTestId("folha-tipo-entrada").click();
  await folha.getByTestId("folha-quantidade").fill(quantidade);
  await folha.getByTestId("folha-custo").fill(custo);
  await folha.getByTestId("folha-registrar").click();
  await expect(page.getByText(`Entrada de ${quantidade} kg em ${nome}.`)).toBeVisible();
  await expect(folha).toBeHidden();
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

test.describe("polimento estoque — zero e contagem", () => {
  test("o “0” digitado também é “sem custo”, no cartão e na tabela de 1280 px", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Esmalte de sobra ${suf}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);
    await registrarEntrada(page, itemId, nome, "3", "0");
    expect((await movimentacoesDoItem(itemId))[0].valorInformadoCentavos).toBe(0);
    await page.getByTestId("estoque-busca").fill(suf);

    // A tabela, a 1280 px; o cartão, a 390 px. Os dois pelo mesmo `textoDoCustoMedio`.
    for (const largura of [1280, 390]) {
      await page.setViewportSize({ width: largura, height: 800 });
      const visivel = cartaoDoItem(page, itemId);
      await expect(visivel).toHaveCount(1);
      await expect(visivel).toHaveJSProperty("tagName", largura === 1280 ? "TR" : "ARTICLE");
      await expect(visivel.getByTestId("estoque-cartao-custo")).toHaveText("sem custo");
      await expect(visivel.getByTestId("estoque-sem-custo")).toBeVisible();
      await expect(visivel).not.toContainText("R$ 0,00/kg");
    }
  });

  test("a contagem continua cega (D-06) e o ajuste positivo sem estimativa grava a R$ 0 (UI-D14)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // Um material COM saldo — 7,125 kg, número que não aparece por acaso na linha.
    const comSaldo = `[e2e] Argila contada ${suf}`;
    const comSaldoId = await semearMaterial({ nome: comSaldo, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    // Um material sem nenhuma movimentação: a primeira contagem dele fica positiva.
    const novo = `[e2e] Argila achada ${suf}`;
    const novoId = await semearMaterialSemMovimentacao({ nome: novo, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await abrirEstoque(page);
    await registrarEntrada(page, comSaldoId, comSaldo, "7,125", "30,00");
    expect(await saldoNoBanco(comSaldoId)).toBe(7125);

    await page.goto("/gestao/estoque/contagem");
    await expect(page.getByRole("heading", { name: "Contagem do estoque", level: 1 })).toBeVisible();
    await page.getByTestId("contagem-busca").fill(suf);

    // D-06: antes de digitar, o "Contado" está vazio e o saldo esperado não aparece na linha.
    const linha = page.locator(`[data-testid="contagem-linha"][data-item-id="${comSaldoId}"]`);
    await expect(linha).toBeVisible();
    const contado = linha.getByTestId("contagem-contado");
    await expect(contado).toHaveValue("");
    expect((await contado.getAttribute("placeholder")) ?? "").not.toContain("7,125");
    await expect(linha).not.toContainText("7,125");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("");
    await expect(page.locator("main")).not.toContainText("7,125");

    // UI-D14: a primeira contagem do material novo fica positiva, e o "Custou ao todo" vazio vale
    // R$ 0 — grava, sem a frase "Diga quanto custou — uma estimativa serve.".
    const linhaNova = page
      .getByTestId("contagem-grupo-primeira")
      .locator(`[data-testid="contagem-linha"][data-item-id="${novoId}"]`);
    await linhaNova.getByTestId("contagem-contado").fill("3");
    await expect(linhaNova.getByTestId("contagem-custou")).toBeVisible();
    await expect(linhaNova.getByTestId("contagem-custou")).toHaveValue("");
    await linhaNova.getByTestId("contagem-confirmar").click();
    await expect(linhaNova.getByTestId("contagem-feito")).toContainText("✓ Contado: 3 kg");
    await expect(linhaNova.getByTestId("contagem-erro")).toHaveCount(0);
    expect(await contagensDoItem(novoId)).toEqual([
      {
        origem: "manual",
        tipo: "entrada",
        motivo: "saldo_inicial",
        quantidadeMilesimos: 3000,
        valorInformadoCentavos: 0,
        saldoContadoMilesimos: 3000,
      },
    ]);

    // E o Estoque diz "sem custo" para ele.
    await page.goto("/gestao/estoque");
    await page.getByTestId("estoque-busca").fill(suf);
    await expect(cartaoDoItem(page, novoId).getByTestId("estoque-cartao-custo")).toHaveText("sem custo");
  });
});

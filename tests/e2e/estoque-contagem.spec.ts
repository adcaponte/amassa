import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  contagensDoItem,
  desativarNoBanco,
  movimentacoesDoItem,
  saldoNoBanco,
  semearMaterialSemMovimentacao,
} from "./apoio/semear-estoque";
import { semearItem } from "./apoio/semear-financeiro";

// A contagem do estoque (plano 06-10, D-16, D-17 refinado, D-18, D-32, EST-17, UI-D2, UI-D3).
//
// Dois blocos:
//
// 1. `estoque primeira abertura @vazio-historico` — SERIAL, no projeto `vazio-historico` da cadeia
//    de `dependencies` do `playwright.config.ts` (depois dos `vazio-*` só de leitura, antes de
//    `desktop`/`celular`). Neste ponto nenhum outro teste criou material com estoque nem
//    movimentação manual: é aqui, e só aqui, que se afirmam os estados GLOBAIS — a primeira
//    abertura, o Início "nunca contado", "Nada acabando.", "Nenhum material desativado.", o banner
//    no singular e os valores exatos do Para onde foi. Nunca por `--grep` como muleta (CLAUDE.md).
//    Depois dele o banco tem uma movimentação manual — e o resto da suíte vê o Estoque "normal".
//
// 2. `estoque contagem` — desktop e celular, cada caso com os SEUS materiais (sufixo único),
//    achados pela busca da contagem; nenhuma afirmação global.
//
// Nomes inventados, prefixo `[e2e]` — nenhum dado real.

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

const CATEGORIA_DE_COMPRA = "Argila, esmalte e insumos"; // área Peças

// O cartão (< 980px) OU a linha da tabela (≥ 980px) — o que estiver visível na largura.
function cartaoDoItem(page: Page, itemId: string): Locator {
  return page
    .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
    .filter({ visible: true });
}

function linhaDaContagem(page: Page, itemId: string): Locator {
  return page.locator(`[data-testid="contagem-linha"][data-item-id="${itemId}"]`);
}

async function abrirContagem(page: Page, busca?: string) {
  await page.goto("/gestao/estoque/contagem");
  await expect(page.getByRole("heading", { name: "Contagem do estoque", level: 1 })).toBeVisible();
  if (busca) {
    await page.getByTestId("contagem-busca").fill(busca);
  }
}

// Registra uma saída pela folha, a partir do cartão do material na aba Saldos.
async function saidaPelaFolha(page: Page, itemId: string, quantidade: string, destino: string) {
  await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
  const folha = page.getByTestId("folha-movimentacao");
  await expect(folha).toBeVisible();
  await folha.getByTestId("folha-tipo-saida").click();
  await folha.getByTestId("folha-quantidade").fill(quantidade);
  await folha.getByTestId(`folha-destino-${destino}`).click();
  await folha.getByTestId("folha-registrar").click();
  await expect(folha).toBeHidden({ timeout: 10000 });
}

// Lança uma venda pela tela (molde de `estoque-financeiro.spec.ts`).
async function venderPelaTela(page: Page, busca: string, nome: string, vezes: number) {
  await page.goto("/gestao/financeiro");
  await page.getByTestId("venda-busca").fill(busca);
  for (let vez = 0; vez < vezes; vez++) {
    await page.getByTestId("venda-atalho").filter({ hasText: nome }).click();
  }
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  const botao = page.getByRole("button", { name: "Lançar venda" });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

// Lança uma compra de material pela tela, uma linha (molde de `estoque-financeiro.spec.ts`).
async function comprarPelaTela(page: Page, nome: string, quantos: string, custou: string) {
  await page.goto("/gestao/financeiro?aba=despesa");
  await page.getByTestId("despesa-modo-compra").click();
  await page.getByTestId("compra-busca").fill(nome);
  await page.getByTestId("compra-atalho").filter({ hasText: nome }).click();
  await page.getByTestId("compra-quantos").fill(quantos);
  await page.getByTestId("compra-custou").fill(custou);
  const botao = page.getByRole("button", { name: "Lançar despesa" });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page).toHaveURL(/\?aba=despesa/, { timeout: 10000 });
  await expect(page.getByText(/^Despesa nº \d+ lançada/)).toBeVisible({ timeout: 5000 });
}

test.describe.serial("estoque primeira abertura @vazio-historico", () => {
  const nome = `[e2e] Caneca da prateleira ${Date.now()}`;
  let itemId = "";

  test("(1) um material e nenhuma contagem: o Início convida a contar e o Estoque mostra só o painel", async ({
    page,
  }) => {
    itemId = await semearMaterialSemMovimentacao({
      nome,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await fazerLogin(page);

    const bloco = page.getByTestId("inicio-bloco-estoque");
    await expect(bloco.getByTestId("inicio-estoque-nao-contado")).toContainText(
      "O estoque ainda não foi contado.",
    );
    await expect(bloco.getByRole("link", { name: "começar a contagem" })).toHaveAttribute(
      "href",
      "/gestao/estoque/contagem",
    );
    await expect(bloco.getByTestId("inicio-estoque-linha")).toHaveCount(0);

    await page.goto("/gestao/estoque");
    const painel = page.getByTestId("estoque-primeira-abertura");
    await expect(painel).toBeVisible();
    await expect(painel).toContainText("Antes de tudo, conte o que tem na prateleira.");
    await expect(painel).toContainText("Falta algum material?");
    await expect(painel.getByTestId("estoque-comecar-contagem")).toBeVisible();
    await expect(painel.getByRole("button", { name: "+ Novo material" })).toBeVisible();
    // Banner, barra fixa, ações do cabeçalho, busca e lista: nada disso existe (UI-D3).
    await expect(page.getByTestId("estoque-banner")).toHaveCount(0);
    await expect(page.getByTestId("estoque-registrar-movimentacao")).toHaveCount(0);
    await expect(page.getByTestId("estoque-contar")).toHaveCount(0);
    await expect(page.getByTestId("estoque-novo-material")).toHaveCount(0);
    await expect(page.getByTestId("estoque-acao-fixa")).toHaveCount(0);
    await expect(page.getByTestId("estoque-busca")).toHaveCount(0);
    // As outras abas continuam acessíveis.
    await expect(page.getByTestId("estoque-aba-historico")).toBeVisible();
    await expect(page.getByTestId("estoque-aba-destino")).toBeVisible();
  });

  test("(2) a primeira contagem é às cegas, pergunta o custo e sobrevive a recarregar", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await page.getByTestId("estoque-comecar-contagem").click();
    await expect(page).toHaveURL(/\/gestao\/estoque\/contagem$/);

    const linha = page
      .getByTestId("contagem-grupo-primeira")
      .locator(`[data-testid="contagem-linha"][data-item-id="${itemId}"]`);
    await expect(linha).toBeVisible();
    await expect(page.getByTestId("contagem-grupo-conferencia")).toHaveCount(0);
    await expect(page.getByTestId("contagem-progresso")).toHaveText("0 de 1 contados hoje");
    // Às cegas (UI-D16): antes de digitar, nenhuma prévia e nenhum saldo na linha.
    await expect(linha.getByTestId("contagem-previa")).toHaveText("");
    await expect(linha).not.toContainText("saldo");

    await linha.getByTestId("contagem-contado").fill("10");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("o saldo passa de 0 para 10 un");
    // O "Custou ao todo" aparece. Até 05/10/2026, confirmar com ele vazio era recusado ("Diga
    // quanto custou — uma estimativa serve."); desde a 06.5 o vazio vale R$ 0 (UI-D14), provado em
    // `polimento-estoque.spec.ts`. Aqui o custo é digitado: os valores do Para onde foi (5) dependem dele.
    await expect(linha.getByTestId("contagem-custou")).toBeVisible();
    expect(await movimentacoesDoItem(itemId)).toHaveLength(0);

    await linha.getByTestId("contagem-custou").fill("50,00");
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 10 un · hoje ");

    const gravadas = await contagensDoItem(itemId);
    expect(gravadas).toEqual([
      {
        origem: "manual",
        tipo: "entrada",
        motivo: "saldo_inicial",
        quantidadeMilesimos: 10000,
        valorInformadoCentavos: 5000,
        saldoContadoMilesimos: 10000,
      },
    ]);

    await page.reload();
    await expect(page.getByTestId("contagem-progresso")).toHaveText("1 de 1 contados hoje");
    await expect(linhaDaContagem(page, itemId).getByTestId("contagem-feito")).toContainText(
      "✓ Contado: 10 un",
    );
  });

  test("(3) contado, o Estoque é o de sempre: o cartão mostra 10, nada acaba, nada desativado", async ({
    page,
  }) => {
    await fazerLogin(page);
    await expect(page.getByTestId("inicio-bloco-estoque")).toContainText(
      "Nenhum material abaixo do mínimo.",
    );

    await page.goto("/gestao/estoque");
    await expect(page.getByTestId("estoque-primeira-abertura")).toHaveCount(0);
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("10");
    await expect(page.getByTestId("estoque-contar")).toBeVisible();
    await expect(page.getByTestId("estoque-banner")).toHaveCount(0);

    await page.getByTestId("estoque-pilula-acabando").click();
    await expect(page.getByTestId("estoque-vazio-acabando")).toContainText("Nada acabando.");
    await page.getByTestId("estoque-pilula-acabando").click();

    await page.getByTestId("estoque-filtro-situacao-desativados").click();
    await expect(page.getByTestId("estoque-vazio-desativados")).toContainText(
      "Nenhum material desativado.",
    );
  });

  test("(4) mínimo 10: o banner no singular e uma linha Acabando no Início", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await cartaoDoItem(page, itemId).getByTestId("estoque-historico-material").click();
    const folha = page.getByTestId("folha-material");
    await expect(folha.getByTestId("folha-material-resumo")).toBeVisible();
    await folha.getByTestId("folha-material-editar").click();
    const edicao = page.getByTestId("folha-editar-material");
    await edicao.getByTestId("editar-material-minimo").fill("10");
    await edicao.getByTestId("editar-material-salvar").click();
    await expect(edicao).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId("estoque-banner-titulo")).toHaveText("1 material está acabando");

    await page.goto("/gestao");
    const linhas = page.getByTestId("inicio-estoque-linha");
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText(nome);
    await expect(linhas.first()).toContainText("Acabando");
    await expect(linhas.first()).toContainText("10 un · mínimo 10 un");
    await expect(page.getByTestId("inicio-estoque-mais")).toHaveCount(0);
  });

  test("(5) a perda de 4 é o Para onde foi inteiro; Vendido diz nenhuma saída", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await saidaPelaFolha(page, itemId, "4", "perda");

    await page.goto("/gestao/estoque?aba=destino&periodo=tudo");
    // 10 un por R$ 50,00 → R$ 5,00/un; 4 un ao custo médio = R$ 20,00.
    await expect(page.getByTestId("destino-total")).toContainText("20,00");
    const perda = page.locator('[data-testid="destino-barra"][data-destino="perda"]');
    await expect(perda).toHaveAttribute("data-valor-centavos", "2000");
    const vendido = page.locator('[data-testid="destino-barra"][data-destino="venda"]');
    await expect(vendido).toContainText("Vendido · pelo Financeiro");
    await expect(vendido).toContainText("nenhuma saída");
    await expect(vendido).toHaveAttribute("data-valor-centavos", "0");
  });

  test("(6) na contagem ele está em Conferência: 6 já está certo e não grava; 5 grava −1", async ({
    page,
  }) => {
    await fazerLogin(page);
    await abrirContagem(page);
    const linha = page
      .getByTestId("contagem-grupo-conferencia")
      .locator(`[data-testid="contagem-linha"][data-item-id="${itemId}"]`);
    await expect(linha).toBeVisible();
    await expect(page.getByTestId("contagem-grupo-primeira")).toHaveCount(0);

    // Foi contado HOJE (passo 2): a linha já abre compacta, lida do banco — sem rascunho.
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 10 un · hoje ");
    await linha.getByTestId("contagem-contar-de-novo").click();

    const antes = (await movimentacoesDoItem(itemId)).length;
    await linha.getByTestId("contagem-contado").fill("6");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("já está certo — nada será gravado");
    await expect(linha.getByTestId("contagem-custou")).toHaveCount(0);
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toHaveText("✓ Conferido — já estava certo");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(antes);

    await linha.getByTestId("contagem-contar-de-novo").click();
    await linha.getByTestId("contagem-contado").fill("5");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("o saldo passa de 6 para 5 un");
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 5 un");

    const gravadas = await contagensDoItem(itemId);
    expect(gravadas).toHaveLength(antes + 1);
    expect(gravadas[gravadas.length - 1]).toEqual({
      origem: "manual",
      tipo: "ajuste",
      motivo: null,
      quantidadeMilesimos: -1000,
      valorInformadoCentavos: null,
      saldoContadoMilesimos: 5000,
    });
    expect(await saldoNoBanco(itemId)).toBe(5000);
  });
});

test.describe("estoque contagem", () => {
  test("(a) uma venda antes da contagem: o saldo passa de −2 para 10, e termina no contado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Copo para pintar ${suf}`;
    const itemId = await semearItem({
      nome,
      categoriaVenda: "Peças para pintar",
      precoCentavos: 4500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await venderPelaTela(page, suf, nome, 2);
    expect(await saldoNoBanco(itemId)).toBe(-2000);

    await abrirContagem(page, suf);
    const linha = page
      .getByTestId("contagem-grupo-primeira")
      .locator(`[data-testid="contagem-linha"][data-item-id="${itemId}"]`);
    await expect(linha).toBeVisible();
    await linha.getByTestId("contagem-contado").fill("10");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("o saldo passa de −2 para 10 un");
    await expect(linha).toContainText("o que você pagou por 12 un");
    await linha.getByTestId("contagem-custou").fill("30,00");
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 10 un");

    expect(await saldoNoBanco(itemId)).toBe(10000);
    const gravadas = await contagensDoItem(itemId);
    expect(gravadas[gravadas.length - 1]).toMatchObject({
      tipo: "entrada",
      motivo: "saldo_inicial",
      quantidadeMilesimos: 12000,
      valorInformadoCentavos: 3000,
      saldoContadoMilesimos: 10000,
    });

    await page.goto("/gestao/estoque");
    await page.getByTestId("estoque-busca").fill(suf);
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("10");
  });

  test("(b) primeira contagem abaixo do saldo grava um ajuste saldo_inicial, sem pedir custo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Esmalte comprado ${suf}`;
    const itemId = await semearMaterialSemMovimentacao({
      nome,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });

    await fazerLogin(page);
    await comprarPelaTela(page, nome, "5", "25,00");
    expect(await saldoNoBanco(itemId)).toBe(5000);

    await abrirContagem(page, suf);
    const linha = page
      .getByTestId("contagem-grupo-primeira")
      .locator(`[data-testid="contagem-linha"][data-item-id="${itemId}"]`);
    await linha.getByTestId("contagem-contado").fill("3");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("o saldo passa de 5 para 3 un");
    await expect(linha.getByTestId("contagem-custou")).toHaveCount(0);
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 3 un");

    const gravadas = await contagensDoItem(itemId);
    expect(gravadas[gravadas.length - 1]).toEqual({
      origem: "manual",
      tipo: "ajuste",
      motivo: "saldo_inicial",
      quantidadeMilesimos: -2000,
      valorInformadoCentavos: null,
      saldoContadoMilesimos: 3000,
    });
    expect(await saldoNoBanco(itemId)).toBe(3000);
  });

  test("(c) conferência com contado zero deixa o saldo em zero (D-32)", async ({ page }) => {
    const suf = sufixoUnico();
    const itemId = await semearMaterialSemMovimentacao({
      nome: `[e2e] Pincel ${suf}`,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });

    await fazerLogin(page);
    await abrirContagem(page, suf);
    const linha = linhaDaContagem(page, itemId);
    await linha.getByTestId("contagem-contado").fill("3");
    await linha.getByTestId("contagem-custou").fill("9,00");
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 3 un");

    // Agora ele tem movimentação manual: a próxima contagem é conferência, e zero vale.
    await linha.getByTestId("contagem-contar-de-novo").click();
    await linha.getByTestId("contagem-contado").fill("0");
    await expect(linha.getByTestId("contagem-previa")).toHaveText("o saldo passa de 3 para 0 un");
    await expect(linha.getByTestId("contagem-custou")).toHaveCount(0);
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 0 un");

    expect(await saldoNoBanco(itemId)).toBe(0);
    const gravadas = await contagensDoItem(itemId);
    expect(gravadas[gravadas.length - 1]).toMatchObject({
      tipo: "ajuste",
      motivo: null,
      quantidadeMilesimos: -3000,
      saldoContadoMilesimos: 0,
    });
  });

  test("(d) Enter no Contado confirma e leva o foco ao Contado da linha seguinte", async ({ page }) => {
    const suf = sufixoUnico();
    const primeiro = await semearMaterialSemMovimentacao({
      nome: `[e2e] A-fita ${suf}`,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    const segundo = await semearMaterialSemMovimentacao({
      nome: `[e2e] B-fita ${suf}`,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });

    await fazerLogin(page);
    await abrirContagem(page, suf);
    await expect(page.getByTestId("contagem-linha")).toHaveCount(2);

    const campo = linhaDaContagem(page, primeiro).getByTestId("contagem-contado");
    await campo.fill("0");
    await campo.press("Enter");
    await expect(linhaDaContagem(page, primeiro).getByTestId("contagem-feito")).toHaveText(
      "✓ Conferido — já estava certo",
    );
    await expect(linhaDaContagem(page, segundo).getByTestId("contagem-contado")).toBeFocused();
  });

  test("(e) material desativado depois de a tela carregar: a frase fica na linha e o número também", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Argila parada ${suf}`;
    const itemId = await semearMaterialSemMovimentacao({
      nome,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });

    await fazerLogin(page);
    await abrirContagem(page, suf);
    const linha = linhaDaContagem(page, itemId);
    await expect(linha).toBeVisible();
    await desativarNoBanco(itemId);

    await linha.getByTestId("contagem-contado").fill("2");
    await linha.getByTestId("contagem-custou").fill("10,00");
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-erro")).toHaveText(
      `${nome} foi desativado enquanto você registrava. Reative-o para movimentar.`,
    );
    await expect(linha.getByTestId("contagem-contado")).toHaveValue("2");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(0);
  });

  test("(f) uma venda depois de a tela carregar: o custo digitado não vai para outra diferença (revisão WR-03)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Prato para pintar ${suf}`;
    const itemId = await semearItem({
      nome,
      categoriaVenda: "Peças para pintar",
      precoCentavos: 4500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await abrirContagem(page, suf);
    const linha = linhaDaContagem(page, itemId);
    await expect(linha).toBeVisible();

    // Com a contagem aberta (saldo 0 na tela), outra aba vende 1 un: o saldo real vai a −1.
    const outraAba = await page.context().newPage();
    await venderPelaTela(outraAba, suf, nome, 1);
    await outraAba.close();
    expect(await saldoNoBanco(itemId)).toBe(-1000);

    await linha.getByTestId("contagem-contado").fill("10");
    await expect(linha).toContainText("o que você pagou por 10 un");
    await linha.getByTestId("contagem-custou").fill("100,00");
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-erro")).toHaveText(
      "O saldo mudou de 0 para −1 un enquanto você contava — confira o custo e confirme de novo.",
    );
    // A dica se refaz com a diferença do servidor, e nada da contagem foi gravado.
    await expect(linha).toContainText("o que você pagou por 11 un");
    await expect(linha.getByTestId("contagem-custou")).toHaveValue("100,00");
    const soAVenda = await contagensDoItem(itemId);
    expect(soAVenda).toHaveLength(1);
    expect(soAVenda[0]).toMatchObject({ origem: "venda", tipo: "saida" });

    // Conferido o custo, confirmar de novo grava a diferença que a pessoa viu.
    await linha.getByTestId("contagem-confirmar").click();
    await expect(linha.getByTestId("contagem-feito")).toContainText("✓ Contado: 10 un");
    expect(await saldoNoBanco(itemId)).toBe(10000);
    const gravadas = await contagensDoItem(itemId);
    expect(gravadas[gravadas.length - 1]).toMatchObject({
      tipo: "entrada",
      quantidadeMilesimos: 11000,
      valorInformadoCentavos: 10000,
    });
  });
});

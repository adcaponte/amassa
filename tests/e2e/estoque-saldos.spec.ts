import { test, expect, type Page } from "@playwright/test";

import { desativarNoBanco, semearMaterial } from "./apoio/semear-estoque";

// A aba Saldos (plano 06-04): acabando, negativo, mínimo zero, busca sem acento, pílulas de área,
// "Ver só esses", tabela × cartões, 320px, desativados e o vazio de filtro. A lista é GLOBAL e
// outros testes criam materiais em paralelo: cada teste semeia os SEUS com `sufixoUnico` e os acha
// pelo `data-item-id` ou pela busca. Nenhuma afirmação sobre contagem global (quantos no banner) —
// essa condição do banco inteiro fica para o `@vazio-historico` do plano 06-10.
//
// Nomes que precisam aparecer entre os 3 primeiros do banner começam com um dígito ("0-…"): a
// ordem do banner é por nome pt-BR, e dígito vem antes de letra — os demais materiais de teste
// começam com letra ("[e2e] Argila…", "[e2e] Caneca…"). Nomes inventados, prefixo `[e2e]`.

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

const ARGILA = "Argila, esmalte e insumos"; // área Peças
const CAFETERIA = "Insumos da cafeteria"; // área Cafeteria
const AGUA_E_LUZ = "Água e luz"; // área Geral — o acento que a busca precisa ignorar

const AMBAR = "rgb(180, 83, 9)"; // --color-atencao
const VERMELHO = "rgb(185, 28, 28)"; // --color-erro

// O cartão (< 980px) OU a linha da tabela (≥ 980px) — o que estiver visível na largura.
function cartaoDoItem(page: Page, itemId: string) {
  return page
    .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
    .filter({ visible: true });
}

async function abrirEstoque(page: Page, caminho = "/gestao/estoque") {
  await fazerLogin(page);
  await page.goto(caminho);
  await expect(page.getByTestId("estoque-busca")).toBeVisible();
}

async function buscar(page: Page, termo: string) {
  await page.getByTestId("estoque-busca").fill(termo);
}

// Uma entrada pela folha — o livro só se escreve pela tela.
async function darEntrada(page: Page, itemId: string, nome: string, quantidade: string) {
  await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
  const folha = page.getByTestId("folha-movimentacao");
  await folha.getByTestId("folha-tipo-entrada").click();
  await folha.getByTestId("folha-quantidade").fill(quantidade);
  await folha.getByTestId("folha-custo").fill("10,00");
  await folha.getByTestId("folha-registrar").click();
  await expect(page.getByText(`Entrada de ${quantidade} kg em ${nome}.`)).toBeVisible();
  await expect(folha).toBeHidden();
}

test.describe("estoque saldos", () => {
  test("(a) saldo igual ao mínimo aparece como Acabando, em âmbar, e o banner o cita pelo nome", async ({
    page,
  }) => {
    const nome = `[e2e] 0-acabando ${sufixoUnico()}`;
    const itemId = await semearMaterial({
      nome,
      unidade: "kg",
      categoriaCompra: ARGILA,
      minimoMilesimos: 2000,
    });

    await abrirEstoque(page);
    await darEntrada(page, itemId, nome, "2");

    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("2");
    await expect(cartao.getByTestId("estoque-chip-acabando")).toHaveText("Acabando");
    await expect(cartao.getByTestId("estoque-chip-negativo")).toHaveCount(0);
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveCSS("color", AMBAR);
    await expect(cartao).toHaveAttribute("data-alerta", "acabando");
    if ((page.viewportSize()?.width ?? 0) < 980) {
      // O cartão tem a borda esquerda de 4px na cor do alerta (a tabela não tem borda por linha).
      await expect(cartao).toHaveCSS("border-left-color", AMBAR);
      await expect(cartao.getByTestId("estoque-cartao-meta")).toContainText("mínimo 2 kg");
    }

    const banner = page.getByTestId("estoque-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByTestId("estoque-banner-nomes")).toContainText(`${nome} (2 kg)`);
  });

  test("(b) material levado a negativo mostra Saldo negativo, nunca Acabando, e a linha própria do banner", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] 0-negativo ${sufixo}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: ARGILA });
    // Um material acabando ao lado, para o banner ter "acabando" e o negativo ir para a linha
    // "Com saldo negativo" (e não virar o título só-negativos).
    await semearMaterial({
      nome: `[e2e] 1-apoio-acabando ${sufixo}`,
      unidade: "kg",
      categoriaCompra: ARGILA,
      minimoMilesimos: 1000,
    });

    await abrirEstoque(page);
    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = page.getByTestId("folha-movimentacao");
    await folha.getByTestId("folha-quantidade").fill("1");
    await folha.getByTestId("folha-destino-perda").click();
    await folha.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Baixa de 1 kg em ${nome}. O saldo ficou em −1 kg.`)).toBeVisible();

    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("−1");
    await expect(cartao.getByTestId("estoque-chip-negativo")).toHaveText("Saldo negativo");
    await expect(cartao.getByTestId("estoque-chip-acabando")).toHaveCount(0);
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveCSS("color", VERMELHO);
    if ((page.viewportSize()?.width ?? 0) < 980) {
      await expect(cartao).toHaveCSS("border-left-color", VERMELHO);
    }

    const negativos = page.getByTestId("estoque-banner").getByTestId("estoque-banner-negativos");
    await expect(negativos).toContainText("Com saldo negativo:");
    await expect(negativos).toContainText(`${nome} (−1 kg)`);
  });

  test("(c) mínimo zero com saldo positivo nunca aparece com Acabando ligado", async ({ page }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] Sem-minimo ${sufixo}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: ARGILA });

    await abrirEstoque(page);
    await darEntrada(page, itemId, nome, "3");

    await buscar(page, sufixo);
    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao).toBeVisible();
    await expect(cartao).toHaveAttribute("data-alerta", "ok");
    await expect(cartao.getByTestId("estoque-chip-acabando")).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) < 980) {
      await expect(cartao.getByTestId("estoque-cartao-meta")).toContainText("sem mínimo");
    }

    await page.getByTestId("estoque-pilula-acabando").click();
    await expect(page.getByTestId("estoque-pilula-acabando")).toHaveAttribute("aria-pressed", "true");
    await expect(cartaoDoItem(page, itemId)).toHaveCount(0);
    await expect(page.getByTestId("estoque-vazio-filtro")).toContainText("Nada com esse filtro");
  });

  test("(d) a busca ignora acento e caixa, e casa o nome e a categoria", async ({ page }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] Grão de CAFÉ ${sufixo}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: AGUA_E_LUZ });

    await abrirEstoque(page);

    await buscar(page, `grao de cafe ${sufixo}`);
    await expect(cartaoDoItem(page, itemId)).toBeVisible();
    await expect(page.getByTestId("estoque-contador")).toContainText(/^1 de \d+ · /);

    // A categoria "Água e luz", buscada sem acento — o nome do material não contém "agua".
    await buscar(page, "agua e luz");
    await expect(cartaoDoItem(page, itemId)).toBeVisible();
  });

  test("(e) a pílula da área Peças filtra e “Tudo” volta", async ({ page }) => {
    const sufixo = sufixoUnico();
    const pecas = await semearMaterial({
      nome: `[e2e] Area-pecas ${sufixo}`,
      unidade: "kg",
      categoriaCompra: ARGILA,
    });
    const cafe = await semearMaterial({
      nome: `[e2e] Area-cafe ${sufixo}`,
      unidade: "kg",
      categoriaCompra: CAFETERIA,
    });

    await abrirEstoque(page);
    await buscar(page, sufixo);
    await expect(cartaoDoItem(page, pecas)).toBeVisible();
    await expect(cartaoDoItem(page, cafe)).toBeVisible();

    const pilulaPecas = page.getByTestId("estoque-pilula-area-pecas");
    await expect(pilulaPecas).toContainText("Peças");
    await pilulaPecas.click();
    await expect(pilulaPecas).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("estoque-pilula-tudo")).toHaveAttribute("aria-pressed", "false");
    await expect(cartaoDoItem(page, pecas)).toBeVisible();
    await expect(cartaoDoItem(page, cafe)).toHaveCount(0);

    await page.getByTestId("estoque-pilula-tudo").click();
    await expect(cartaoDoItem(page, pecas)).toBeVisible();
    await expect(cartaoDoItem(page, cafe)).toBeVisible();
  });

  test("(f) “Ver só esses” liga Acabando e a URL ganha acabando=1", async ({ page }) => {
    const sufixo = sufixoUnico();
    const itemId = await semearMaterial({
      nome: `[e2e] Ver-so-esses ${sufixo}`,
      unidade: "kg",
      categoriaCompra: ARGILA,
      minimoMilesimos: 1000,
    });

    await abrirEstoque(page);
    const pilula = page.getByTestId("estoque-pilula-acabando");
    await expect(pilula).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("estoque-banner-ver").click();
    await expect(pilula).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]acabando=1/);
    await expect(cartaoDoItem(page, itemId)).toBeVisible();

    await pilula.click();
    await expect(pilula).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/acabando=1/);

    // Chegando pela URL (o "e mais N" do Início, plano 06-10), a pílula já vem ligada.
    await page.goto("/gestao/estoque?acabando=1");
    await expect(page.getByTestId("estoque-pilula-acabando")).toHaveAttribute("aria-pressed", "true");
  });

  test("(g) a partir de 980px a lista é tabela; no celular, cartões", async ({ page }) => {
    const nome = `[e2e] Layout ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: ARGILA });

    await abrirEstoque(page);
    const artigo = page.locator(`article[data-testid="estoque-cartao"][data-item-id="${itemId}"]`);
    const linha = page.locator(`tr[data-testid="estoque-cartao"][data-item-id="${itemId}"]`);

    if (test.info().project.name === "desktop") {
      await expect(page.getByTestId("estoque-tabela")).toBeVisible();
      await expect(linha).toBeVisible();
      await expect(artigo).toBeHidden();
    } else {
      await expect(page.getByTestId("estoque-tabela")).toBeHidden();
      await expect(artigo).toBeVisible();
      await expect(linha).toBeHidden();
    }
  });

  test("(h) a 320px a página não rola na horizontal, nem com nome de 120 letras", async ({ page }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] ${sufixo} argila de alta temperatura para torno e modelagem manual `
      .repeat(3)
      .slice(0, 120)
      .trim();
    const itemId = await semearMaterial({
      nome,
      unidade: "kg",
      categoriaCompra: ARGILA,
      minimoMilesimos: 1000,
    });

    await page.setViewportSize({ width: 320, height: 720 });
    await abrirEstoque(page);
    await expect(cartaoDoItem(page, itemId)).toBeVisible();
    await expect(page.getByTestId("estoque-banner")).toBeVisible();

    const semRolagem = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(semRolagem).toBe(true);
  });

  test("(i) material desativado some do padrão e aparece em Desativados, com o chip e sem Dar baixa", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const itemId = await semearMaterial({
      nome: `[e2e] Desativado ${sufixo}`,
      unidade: "kg",
      categoriaCompra: ARGILA,
    });
    await desativarNoBanco(itemId);

    await abrirEstoque(page);
    await expect(page.getByTestId("estoque-filtro-situacao-ativos")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await buscar(page, sufixo);
    await expect(cartaoDoItem(page, itemId)).toHaveCount(0);

    await page.getByTestId("estoque-filtro-situacao-desativados").click();
    await expect(page.getByTestId("estoque-filtro-situacao-desativados")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao).toBeVisible();
    await expect(cartao.getByTestId("estoque-chip-desativado")).toHaveText("Desativado");
    await expect(cartao.getByTestId("estoque-dar-baixa")).toHaveCount(0);

    await page.getByTestId("estoque-filtro-situacao-todos").click();
    await expect(cartaoDoItem(page, itemId)).toBeVisible();
  });

  test("(j) busca sem resultado mostra “Nada com esse filtro” e “Limpar filtros” volta a lista", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const itemId = await semearMaterial({
      nome: `[e2e] Limpar ${sufixo}`,
      unidade: "kg",
      categoriaCompra: ARGILA,
    });

    await abrirEstoque(page);
    await buscar(page, `nada-assim-existe-${sufixo}`);
    const vazio = page.getByTestId("estoque-vazio-filtro");
    await expect(vazio).toBeVisible();
    await expect(vazio.getByRole("heading", { name: "Nada com esse filtro" })).toBeVisible();

    await vazio.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByTestId("estoque-busca")).toHaveValue("");
    await expect(vazio).toBeHidden();
    await expect(cartaoDoItem(page, itemId)).toBeVisible();
  });
});

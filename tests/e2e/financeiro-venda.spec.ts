import { test, expect, type Page } from "@playwright/test";

import {
  buscarCategoriaPorNome,
  definirPrecoDoItem,
  hojeNoAtelie,
  semearItem,
  somarDiasAoHoje,
} from "./apoio/semear-financeiro";

// A Venda completa (04.4-03-PLAN.md): carrinho pelo catálogo (atalhos, busca, lista completa,
// valor livre), quantidade, preço editável com etiqueta "tabela", desconto (04.4-03-PLAN.md
// Tarefa 3, casos à parte), data retroativa e o que a venda tira do estoque. Os treze exemplos do
// protótipo viram casos de teste — aqui, os exemplos 1, 2, 3, 5 e 7 (Tarefa 2). Cada caso semeia
// os próprios itens com sufixo único e usa a BUSCA para achá-los — a grade de atalhos é global,
// compartilhada por qualquer outro teste que rode ao mesmo tempo. Nenhuma afirmação GLOBAL do
// banco (CLAUDE.md).

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

// Digita o sufixo na busca da Venda — a lista agrupada por área passa a mostrar só os itens
// semeados por ESTE teste (nomes únicos, "[e2e] Nome {sufixo}").
async function buscarNaVenda(page: Page, texto: string) {
  await page.getByTestId("venda-busca").fill(texto);
}

function atalho(page: Page, nome: string) {
  return page.getByTestId("venda-atalho").filter({ hasText: nome });
}

function linhaDoCarrinho(page: Page, nome: string) {
  return page.getByTestId("venda-linha").filter({ hasText: nome });
}

test.describe("financeiro venda", () => {
  test("exemplo 1 — Café + 2 pães de queijo, sem dica de área, com o efeito no estoque", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const grao = await semearItem({
      nome: `[e2e] Grão de café ${suf}`,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "g",
      categoriaCompra: "Insumos da cafeteria",
      atalhoCompra: false,
    });
    const paoCongelado = await semearItem({
      nome: `[e2e] Pão de queijo congelado ${suf}`,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "kg",
      categoriaCompra: "Insumos da cafeteria",
      atalhoCompra: false,
    });
    const nomeCafe = `[e2e] Café 200 ml ${suf}`;
    const nomePao = `[e2e] Pão de queijo ${suf}`;
    await semearItem({
      nome: nomeCafe,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: grao, quantidade: "15" }],
    });
    await semearItem({
      nome: nomePao,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 400,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: paoCongelado, quantidade: "0.04" }],
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);

    await atalho(page, nomeCafe).click();
    await atalho(page, nomePao).click();
    await atalho(page, nomePao).click();

    // O mesmo item tocado duas vezes soma quantidade, nunca cria outra linha.
    await expect(linhaDoCarrinho(page, nomePao).getByTestId("venda-linha-quantidade")).toHaveText(
      "2",
    );
    await expect(page.getByTestId("venda-dica-areas")).toHaveCount(0);
    await expect(page.getByTestId("venda-total")).toContainText("R$ 16,00");

    const efeito = page.getByTestId("venda-efeito");
    await efeito.locator("summary").click();
    await expect(efeito).toContainText(`−15 g · [e2e] Grão de café ${suf}`);
    await expect(efeito).toContainText(`−0,08 kg · [e2e] Pão de queijo congelado ${suf}`);

    await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
    const botaoLancar = page.getByRole("button", { name: "Lançar venda" });
    await expect(botaoLancar).toBeEnabled();
    await botaoLancar.click();
    await expect(page).toHaveURL(/\/financeiro\?aba=venda&aviso=lancado&documento=/, {
      timeout: 10000,
    });
  });

  test("exemplo 2 — Refil + Copo para pintar, dica Cafeteria e Peças", async ({ page }) => {
    const suf = sufixoUnico();
    const grao = await semearItem({
      nome: `[e2e] Grão de café ${suf}`,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "g",
      categoriaCompra: "Insumos da cafeteria",
      atalhoCompra: false,
    });
    const nomeRefil = `[e2e] Café refil ${suf}`;
    const nomeCopo = `[e2e] Copo 10 cm para pintar ${suf}`;
    await semearItem({
      nome: nomeRefil,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 1400,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: grao, quantidade: "30" }],
    });
    await semearItem({
      nome: nomeCopo,
      categoriaVenda: "Peças para pintar",
      precoCentavos: 4500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Argila, esmalte e insumos",
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeRefil).click();
    await atalho(page, nomeCopo).click();

    await expect(page.getByTestId("venda-total")).toContainText("R$ 59,00");
    await expect(page.getByTestId("venda-dica-areas")).toContainText("Cafeteria e Peças");

    const efeito = page.getByTestId("venda-efeito");
    await efeito.locator("summary").click();
    await expect(efeito).toContainText(`−30 g · [e2e] Grão de café ${suf}`);
    await expect(efeito).toContainText(`−1 un · ${nomeCopo}`);
  });

  test("exemplo 3 — 2 Queimas externa M + Argila 1 kg, dica Peças e Loja", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeQueima = `[e2e] Queima externa M ${suf}`;
    const nomeArgila = `[e2e] Argila 1 kg ${suf}`;
    await semearItem({
      nome: nomeQueima,
      categoriaVenda: "Queima externa",
      precoCentavos: 1500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeArgila,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 1400,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "kg",
      categoriaCompra: "Mercadoria para revenda",
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeQueima).click();
    await atalho(page, nomeQueima).click();
    await atalho(page, nomeArgila).click();

    await expect(page.getByTestId("venda-total")).toContainText("R$ 44,00");
    await expect(page.getByTestId("venda-dica-areas")).toContainText("Peças e Loja");
  });

  test("exemplo 5 — 3h de espaço, 3 queimas M, refil, fatia de bolo, 4 pães, boleira → R$ 382,00, três áreas", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeHora = `[e2e] Hora de uso do espaço ${suf}`;
    const nomeQueima = `[e2e] Queima externa M cinco ${suf}`;
    const nomeRefil = `[e2e] Café refil cinco ${suf}`;
    const nomeBolo = `[e2e] Fatia de bolo ${suf}`;
    const nomePao = `[e2e] Pão de queijo cinco ${suf}`;
    const nomeBoleira = `[e2e] Boleira ${suf}`;

    await semearItem({
      nome: nomeHora,
      categoriaVenda: "Uso do espaço",
      precoCentavos: 2500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeQueima,
      categoriaVenda: "Queima externa",
      precoCentavos: 1500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeRefil,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 1400,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeBolo,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 1200,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomePao,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 400,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeBoleira,
      categoriaVenda: "Peças prontas",
      precoCentavos: 22000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Argila, esmalte e insumos",
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);

    await atalho(page, nomeHora).click();
    await atalho(page, nomeHora).click();
    await atalho(page, nomeHora).click();
    await atalho(page, nomeQueima).click();
    await atalho(page, nomeQueima).click();
    await atalho(page, nomeQueima).click();
    await atalho(page, nomeRefil).click();
    await atalho(page, nomeBolo).click();
    await atalho(page, nomePao).click();
    await atalho(page, nomePao).click();
    await atalho(page, nomePao).click();
    await atalho(page, nomePao).click();
    await atalho(page, nomeBoleira).click();

    await expect(page.getByTestId("venda-total")).toContainText("R$ 382,00");
    await expect(page.getByTestId("venda-dica-areas")).toBeVisible();
  });

  test("exemplo 7 — Aula de pintura + dois pincéis + kit de tintas → R$ 253,00", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeAula = `[e2e] Aula de pintura em cerâmica ${suf}`;
    const nomePincel8 = `[e2e] Pincel nº 8 ${suf}`;
    const nomePincel10 = `[e2e] Pincel nº 10 ${suf}`;
    const nomeKit = `[e2e] Kit 5 tintas ${suf}`;

    await semearItem({
      nome: nomeAula,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 12000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    for (const [nome, preco] of [
      [nomePincel8, 2200],
      [nomePincel10, 2600],
      [nomeKit, 8500],
    ] as const) {
      await semearItem({
        nome,
        categoriaVenda: "Materiais e papelaria",
        precoCentavos: preco,
        apareceNaVenda: true,
        atalhoVenda: false,
        controlaEstoque: true,
        unidade: "un",
        categoriaCompra: "Mercadoria para revenda",
        atalhoCompra: false,
      });
    }

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeAula).click();
    await atalho(page, nomePincel8).click();
    await atalho(page, nomePincel10).click();
    await atalho(page, nomeKit).click();

    await expect(page.getByTestId("venda-total")).toContainText("R$ 253,00");
  });

  test('item "valor na hora" deixa "Lançar venda" desabilitado até o valor ser digitado', async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Sinal de encomenda ${suf}`;
    await semearItem({
      nome,
      categoriaVenda: "Encomendas",
      precoCentavos: null,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nome).click();

    const botaoLancar = page.getByRole("button", { name: "Lançar venda" });
    await expect(botaoLancar).toBeDisabled();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 0,00");

    await linhaDoCarrinho(page, nome).getByPlaceholder("R$").fill("120");
    await expect(botaoLancar).toBeEnabled();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 120,00");
  });

  test('editar o "cada" mostra a etiqueta "tabela R$ X"', async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Fatia de bolo tabela ${suf}`;
    await semearItem({
      nome,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nome).click();

    const linha = linhaDoCarrinho(page, nome);
    await expect(linha.getByTestId("venda-linha-tabela")).toHaveCount(0);

    await linha.getByPlaceholder("R$").fill("10,00");
    await expect(linha.getByTestId("venda-linha-tabela")).toContainText("tabela R$ 8,00");
  });

  test("filtro por área: Loja mostra o atalho da Loja e esconde o da Cafeteria", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeLoja = `[e2e] Bloco de papel aquarela ${suf}`;
    const nomeCafeteria = `[e2e] Fatia de bolo filtro ${suf}`;
    await semearItem({
      nome: nomeLoja,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 5800,
      apareceNaVenda: true,
      atalhoVenda: true,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeCafeteria,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 1200,
      apareceNaVenda: true,
      atalhoVenda: true,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");

    await page.getByTestId("venda-filtro-loja").click();
    await expect(atalho(page, nomeLoja)).toBeVisible();
    await expect(atalho(page, nomeCafeteria)).toHaveCount(0);
  });

  test("a estrela na lista completa marca o atalho e continua marcada depois de recarregar", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Kit 4 xícaras de café ${suf}`;
    await semearItem({
      nome,
      categoriaVenda: "Peças prontas",
      precoCentavos: 18000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "Lista completa e atalhos" }).click();
    await page.getByLabel("Buscar", { exact: true }).fill(suf);

    const estrela = page.getByRole("button", { name: `Atalho: ${nome}` });
    await expect(estrela).toHaveAttribute("aria-pressed", "false");
    await estrela.click();
    await expect(estrela).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Pronto" }).click();

    await page.reload();
    await page.getByRole("button", { name: "Lista completa e atalhos" }).click();
    await page.getByLabel("Buscar", { exact: true }).fill(suf);
    await expect(page.getByRole("button", { name: `Atalho: ${nome}` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("o carrinho sobrevive a ir ao Caixa e voltar", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Prato 15 cm ${suf}`;
    await semearItem({
      nome,
      categoriaVenda: "Peças prontas",
      precoCentavos: 3800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nome).click();
    await expect(linhaDoCarrinho(page, nome)).toBeVisible();

    await page.getByTestId("financeiro-aba-caixa").click();
    await expect(page).toHaveURL(/\?aba=caixa$/);
    await page.getByTestId("financeiro-aba-venda").click();
    await expect(page).toHaveURL(/\?aba=venda$/);

    await expect(linhaDoCarrinho(page, nome)).toBeVisible();
  });

  test("data retroativa mostra a dica e o lançamento aparece no extrato naquela data", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    // Evita a virada de mês (achado do próprio plano 03): perto do dia 1, "ontem" pertenceria a
    // outro mês e o extrato (filtrado pelo mês corrente na página) nunca mostraria a linha.
    test.skip(hoje.endsWith("-01"), "hoje é dia 1 — pularia para o mês anterior");
    const ontem = somarDiasAoHoje(-1);

    const suf = sufixoUnico();
    const nome = `[e2e] Hora de uso do espaço retroativa ${suf}`;
    await semearItem({
      nome,
      categoriaVenda: "Uso do espaço",
      precoCentavos: 2500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nome).click();
    await page.getByLabel("Data").fill(ontem);

    await expect(page.getByText("serve para fechar um dia que já passou.")).toBeVisible();

    await page.getByRole("button", { name: "Pix", exact: true }).click();
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda&aviso=lancado&documento=/, { timeout: 10000 });

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nome });
    await expect(linhaDoExtrato).toBeVisible();
    await expect(linhaDoExtrato).toContainText("+ R$ 25,00");
  });

  test("mudar o preço do catálogo depois de lançar não muda a venda já lançada", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Pincel preço fixo ${suf}`;
    const itemId = await semearItem({
      nome,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nome).click();
    await page.getByRole("button", { name: "Pix", exact: true }).click();
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda&aviso=lancado&documento=/, { timeout: 10000 });

    await definirPrecoDoItem(itemId, 999900);

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nome });
    await expect(linhaDoExtrato).toContainText("+ R$ 8,00");
  });

  test('valor livre com "Aporte dos sócios" é aceito', async ({ page }) => {
    // Confere que a categoria existe de verdade antes do teste depender dela (a semente 0016
    // precisa estar aplicada no banco de teste).
    await buscarCategoriaPorNome("Aporte dos sócios");

    const suf = sufixoUnico();
    const descricao = `[e2e] Aporte dos sócios ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aporte dos sócios" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("500");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await expect(linhaDoCarrinho(page, descricao)).toBeVisible();
    await page.getByRole("button", { name: "Pix", exact: true }).click();
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda&aviso=lancado&documento=/, { timeout: 10000 });
  });

  test("a 320px de largura, a Venda não rola na horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/financeiro");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Venda rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";

import { criarOrcamentoPelaTela, esperarHidratacao } from "./apoio/novo-orcamento";

// O editor do orçamento (04.5-06-PLAN.md): cabeçalho, "Para quem e para quando", "Peças" com as
// duas portas de entrada de peça, e o cálculo ao vivo (D-21) enquanto o orçamento é rascunho.
// Nomes inventados e únicos por execução ("[e2e] ... {sufixo}") — nenhum dado real do ateliê, o
// repositório é público.
//
// Os mesmos números da "Caneca 300 ml" de `tests/e2e/precificacao-ficha.spec.ts`/
// `precificacao-pecas.spec.ts`, contra os parâmetros ILUSTRATIVOS da semente e o forno 35×35×35 cm
// (D-08): custo R$ 44,24, mínimo R$ 61,87, zero R$ 45,84 — R$ 95 dá verde, R$ 50 dá âmbar (entre o
// zero e o mínimo), R$ 20 dá vermelho.

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

async function abrirNovaPeca(page: Page) {
  await page.goto("/gestao/financeiro?aba=pecas");
  await page.getByTestId("nova-peca").first().click();
  await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
}

async function preencherCaneca(page: Page, nome: string) {
  await page.getByTestId("ficha-campo-nome").fill(nome);
  await page.getByTestId("ficha-campo-argila").fill("450");
  await page.getByTestId("ficha-campo-esmalte").fill("60");
  await page.getByTestId("ficha-campo-horas").fill("0,6");
  await page.getByTestId("ficha-campo-largura").fill("12");
  await page.getByTestId("ficha-campo-profundidade").fill("9");
  await page.getByTestId("ficha-campo-altura").fill("10");
  await page.getByTestId("ficha-campo-embalagem").fill("3");
}

async function escolherCategoriaDeVenda(page: Page) {
  await page.getByRole("combobox", { name: "Categoria de venda" }).click();
  await page.getByRole("option", { name: "Peças prontas" }).click();
}

// Cria uma peça DE LINHA (não exclusiva), com preço praticado — usada por "+ Peça da lista".
async function criarPecaDeLinha(page: Page, nome: string, precoReais: string): Promise<void> {
  await abrirNovaPeca(page);
  await preencherCaneca(page, nome);
  await page.getByTestId("ficha-campo-preco-praticado").fill(precoReais);
  await escolherCategoriaDeVenda(page);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Peça salva.")).toBeVisible();
}

// Cria um orçamento novo a partir da lista e devolve a página já no editor. Desde o 06.5-14 (D-15)
// o registro nasce no primeiro campo preenchido: este cria pelo Título, para o Cliente começar
// vazio como antes — o (a) troca o título e preenche o cliente depois.
async function criarOrcamento(page: Page): Promise<void> {
  await criarOrcamentoPelaTela(page, `[e2e] Pedido inicial ${sufixoUnico()}`, { campo: "titulo" });
}

function orcamentoIdDaUrl(page: Page): string {
  const url = new URL(page.url());
  return url.searchParams.get("orcamento") ?? "";
}

// Sai do campo (dispara `onBlur`, que chama a Server Action e termina em navegação COMPLETA para
// a MESMA URL — `window.location.assign`) e espera a navegação de verdade, nunca `waitForLoadState`
// isolado: como a URL final é IDÊNTICA à atual, `waitForLoadState("load")` chamado DEPOIS do
// `blur()` corre risco de resolver contra o carregamento ANTIGO (que já tinha terminado antes do
// clique) em vez do NOVO — o listener precisa estar armado ANTES do evento que dispara a
// navegação, por isso o `Promise.all`.
async function blurEEsperarNavegacao(page: Page, campo: Locator): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

test.describe("orcamentos editor", () => {
  test.describe.configure({ mode: "serial" });

  let orcamentoId = "";
  let nomeDaPecaDeLinha = "";

  test("(a) criar um orçamento, preencher cliente/título/entrega/validade, e manter tudo depois de recarregar", async ({
    page,
  }) => {
    await fazerLogin(page);
    await criarOrcamento(page);
    orcamentoId = orcamentoIdDaUrl(page);
    expect(orcamentoId).not.toBe("");

    await expect(page.getByTestId("orcamento-cabecalho")).toBeVisible();
    await expect(page.getByTestId("orcamento-numero")).toHaveText(/^nº ORC-\d{4}-\d{3}$/);

    const suf = sufixoUnico();
    const cliente = `[e2e] Cliente ${suf}`;
    const titulo = `[e2e] Pedido ${suf}`;

    // Cada campo grava por `atualizarCabecalhoDoOrcamento` e termina em navegação COMPLETA
    // (`window.location.assign`) para a MESMA URL — `blurEEsperarNavegacao` é o que distingue
    // "gravou de verdade" de um falso positivo. E cada campo espera a hidratação antes de ser
    // preenchido: preenchido antes dela, o React assume o valor antigo e o `blur` grava o antigo.
    const campoCliente = page.getByTestId("orcamento-campo-cliente");
    await esperarHidratacao(campoCliente);
    await campoCliente.fill(cliente);
    await blurEEsperarNavegacao(page, campoCliente);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoTitulo = page.getByTestId("orcamento-campo-titulo");
    await esperarHidratacao(campoTitulo);
    await campoTitulo.fill(titulo);
    await blurEEsperarNavegacao(page, campoTitulo);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoEntrega = page.getByTestId("orcamento-campo-entrega");
    await esperarHidratacao(campoEntrega);
    await campoEntrega.fill("2027-03-15");
    await blurEEsperarNavegacao(page, campoEntrega);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoValidade = page.getByTestId("orcamento-campo-validade");
    await esperarHidratacao(campoValidade);
    await campoValidade.fill("20");
    await blurEEsperarNavegacao(page, campoValidade);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    await page.reload();
    await expect(page.getByTestId("orcamento-campo-cliente")).toHaveValue(cliente);
    await expect(page.getByTestId("orcamento-campo-titulo")).toHaveValue(titulo);
    await expect(page.getByTestId("orcamento-campo-entrega")).toHaveValue("2027-03-15");
    await expect(page.getByTestId("orcamento-campo-validade")).toHaveValue("20");
  });

  test("(b) '+ Peça da lista' acrescenta a peça com quantidade 1 e o preço praticado; mudar 'quantas' muda o subtotal e o total", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    nomeDaPecaDeLinha = `[e2e] Caneca de linha ${suf}`;

    await fazerLogin(page);
    await criarPecaDeLinha(page, nomeDaPecaDeLinha, "95");

    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await page.getByRole("button", { name: "+ Peça da lista" }).click();

    const dialogoEscolher = page.getByTestId("orcamento-escolher-peca");
    await expect(dialogoEscolher).toBeVisible();
    // `getByRole(..., { name })` casa por REGEX quando `name` não é string — e o nome da peça
    // contém colchetes ("[e2e] ..."), que são metacaracteres de regex. `.filter({ hasText })`
    // com STRING faz correspondência literal por substring, nunca interpreta colchete como
    // classe de caracteres.
    const itemDaPeca = dialogoEscolher.getByRole("button").filter({ hasText: nomeDaPecaDeLinha });
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), itemDaPeca.click()]);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const linha = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPecaDeLinha });
    await expect(linha).toBeVisible();
    await expect(linha.getByTestId("orcamento-linha-quantidade")).toHaveValue("1");
    await expect(linha.getByTestId("orcamento-linha-preco")).toHaveValue("95,00");
    await expect(linha).toContainText("R$ 95,00");
    await expect(page.getByTestId("orcamento-total-pecas")).toContainText("R$ 95,00");

    const campoQuantidade = linha.getByTestId("orcamento-linha-quantidade");
    await campoQuantidade.fill("3");
    await blurEEsperarNavegacao(page, campoQuantidade);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const linhaAtualizada = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPecaDeLinha });
    await expect(linhaAtualizada.getByTestId("orcamento-linha-quantidade")).toHaveValue("3");
    // 3 × R$ 95,00 = R$ 285,00
    await expect(linhaAtualizada).toContainText("R$ 285,00");
    await expect(page.getByTestId("orcamento-total-pecas")).toContainText("R$ 285,00");
  });

  test("(c) mudar 'cada' para um valor abaixo do mínimo vira o selo âmbar ou vermelho", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const linha = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPecaDeLinha });
    const campoPreco = linha.getByTestId("orcamento-linha-preco");
    await campoPreco.fill("50");
    await blurEEsperarNavegacao(page, campoPreco);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const linhaAtualizada = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPecaDeLinha });
    const selo = linhaAtualizada.getByTestId("ficha-selo");
    await expect(selo).toBeVisible();
    const texto = await selo.textContent();
    expect(texto).toMatch(/cobre o custo, mas come o lucro|abaixo do custo: você paga para trabalhar/);
  });

  test("(d) '+ Peça exclusiva deste pedido' cria a ficha e já a acrescenta ao orçamento; a peça não aparece na aba Peças", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeExclusiva = `[e2e] Exclusiva do pedido ${suf}`;

    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    await page.getByRole("link", { name: "+ Peça exclusiva deste pedido" }).click();
    await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
    // Já nasce marcada como exclusiva (must_have) — o dono não precisa marcar de novo.
    await expect(page.getByRole("checkbox", { name: /Peça exclusiva deste pedido/ })).toBeChecked();

    await preencherCaneca(page, nomeExclusiva);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");
    await page.getByRole("button", { name: "Salvar" }).click();

    // Volta para o editor do MESMO orçamento — um caminho só, nenhuma segunda busca.
    await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${orcamentoId}$`), {
      timeout: 10000,
    });
    await expect(
      page.getByTestId("orcamento-linha").filter({ hasText: nomeExclusiva }),
    ).toBeVisible();

    // D-19: uma exclusiva de pedido não aparece na aba Peças.
    await page.goto("/gestao/financeiro?aba=pecas");
    await expect(page.getByText(nomeExclusiva, { exact: true })).toHaveCount(0);
  });

  test("(e) 'tirar' pede confirmação nomeando a peça e, ao confirmar, ela sai e o total cai", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const linha = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPecaDeLinha });
    await expect(linha).toBeVisible();
    const totalAntes = await page.getByTestId("orcamento-total-pecas").textContent();

    await linha.getByRole("button", { name: "tirar" }).click();
    const dialogo = page.getByTestId("dialogo-tirar-linha");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(`Tirar «${nomeDaPecaDeLinha}» deste orçamento?`);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      dialogo.getByRole("button", { name: "tirar" }).click(),
    ]);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    await expect(page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPecaDeLinha })).toHaveCount(0);
    const totalDepois = await page.getByTestId("orcamento-total-pecas").textContent();
    expect(totalDepois).not.toBe(totalAntes);
  });

  test("(f) a lista de orçamentos mostra o total do orçamento editado", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    const totalNoEditor = await page.getByTestId("orcamento-total-pecas").textContent();

    await page.goto("/gestao/financeiro?aba=orcamentos");
    // Localiza a linha da lista pelo id do orçamento, dentro do link "Abrir" (o href carrega o
    // id) — nunca por texto de título/cliente, que outra suíte/worker também pode gerar.
    const linhaDoOrcamento = page.locator(`li:has(a[href*="orcamento=${orcamentoId}"])`);
    await expect(linhaDoOrcamento).toBeVisible();
    await expect(linhaDoOrcamento.getByTestId("orcamento-total")).toHaveText(totalNoEditor ?? "");
  });

  test("(g) a 320px o editor não rola na horizontal, todo campo mede ao menos 16px e todo alvo de toque ao menos 44px", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-cabecalho")).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `o editor rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const tamanhosDeFonte = await page.locator("main input").evaluateAll((elementos) =>
      elementos
        .filter((elemento) => (elemento as HTMLElement).offsetParent !== null)
        .map((elemento) => parseFloat(getComputedStyle(elemento).fontSize)),
    );
    for (const tamanho of tamanhosDeFonte) {
      expect(tamanho).toBeGreaterThanOrEqual(16);
    }

    const alvosDeToque = page.locator("main button, main a");
    const contagem = await alvosDeToque.count();
    expect(contagem).toBeGreaterThan(0);
    for (let indice = 0; indice < contagem; indice += 1) {
      const alvo = alvosDeToque.nth(indice);
      if (await alvo.isVisible()) {
        const caixa = await alvo.boundingBox();
        expect(caixa?.height ?? 0, `alvo de toque ${indice} mede menos que 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

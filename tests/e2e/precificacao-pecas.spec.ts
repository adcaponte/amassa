import { test, expect, type Page } from "@playwright/test";

// A aba Peças do Financeiro (04.5-05-PLAN.md): a lista do que já foi precificado, as exclusivas
// de pedido escondidas por padrão (D-19), "começar a partir de uma peça parecida", e a exclusão
// que pergunta antes e nomeia o que se perde (D-20). Nomes inventados e únicos por execução
// ("[e2e] ... {sufixo}") — nenhum dado real do ateliê, o repositório é público.
//
// O caso de recusa por peça EM USO ("Esta peça está em N orçamento(s). Não dá para apagar.") NÃO
// é provado aqui: só existe linha de orçamento criada pela interface a partir do plano 06 — este
// arquivo só prova o caminho de exclusão PERMITIDA (peça em nenhum orçamento). Ver
// 04.5-05-SUMMARY.md.

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

async function abrirNovaPeca(page: Page) {
  await page.goto("/financeiro?aba=pecas");
  await page.getByTestId("nova-peca").first().click();
  await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
}

// A mesma "Caneca 300 ml" de `tests/e2e/precificacao-ficha.spec.ts` — números conhecidos contra o
// forno/parâmetros da semente: custo R$ 44,24, mínimo R$ 61,87. R$ 95 dá selo verde.
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

function linhaDaPeca(page: Page, nome: string) {
  return page.getByTestId("peca-linha").filter({ has: page.getByText(nome, { exact: true }) });
}

function linhaDoCatalogo(page: Page, nome: string) {
  return page.getByTestId("catalogo-item").filter({ has: page.getByText(nome, { exact: true }) });
}

test.describe("precificacao pecas", () => {
  test.describe.configure({ mode: "serial" });

  test("com o banco sem nenhuma peça, a aba mostra o vazio e o botão abre o diálogo de verdade @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/financeiro?aba=pecas");

    const titulo = page.getByRole("heading", { name: "Nenhuma peça precificada ainda.", level: 2 });
    await expect(titulo).toHaveCount(1);
    await expect(titulo).toBeVisible();
    await expect(
      page.getByText("Cadastre a primeira peça para saber quanto ela custa e qual é o preço mínimo."),
    ).toBeVisible();

    // Só leitura: confere que o diálogo de verdade abre e fecha sem salvar nada.
    await page.getByTestId("nova-peca").first().click();
    await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  // Compartilhado entre os testes (b)/(d)/(e), que rodam em ordem (serial) no mesmo worker.
  let nomeDaPecaA = "";
  let nomeDaPecaB = "";
  let idDaPecaB = "";

  test("(b) duas peças de linha aparecem na lista com custo, mínimo e selo", async ({ page }) => {
    const suf = sufixoUnico();
    nomeDaPecaA = `[e2e] Caneca A ${suf}`;
    nomeDaPecaB = `[e2e] Caneca B ${suf}`;

    await fazerLogin(page);

    await abrirNovaPeca(page);
    await preencherCaneca(page, nomeDaPecaA);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");
    await escolherCategoriaDeVenda(page);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    await abrirNovaPeca(page);
    await preencherCaneca(page, nomeDaPecaB);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");
    await escolherCategoriaDeVenda(page);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    const url = new URL(page.url());
    idDaPecaB = url.searchParams.get("peca") ?? "";
    expect(idDaPecaB).not.toBe("");
    await page.getByRole("button", { name: "Cancelar" }).click();

    await page.goto("/financeiro?aba=pecas");
    for (const nome of [nomeDaPecaA, nomeDaPecaB]) {
      const linha = linhaDaPeca(page, nome);
      await expect(linha).toBeVisible();
      await expect(linha).toContainText("R$ 95,00");
      // O custo (material + trabalho + queima + embalagem + perda) não depende da taxa do cartão
      // — R$ 44,24 é estável. O MÍNIMO depende de `taxaCartaoPontosBase`
      // (`configuracaoFinanceira`, global e SEM histórico) e outra suíte de e2e rodando no mesmo
      // banco efêmero pode tê-la mudado; por isso não fixamos o número exato aqui, só o formato.
      await expect(linha).toContainText("custo R$ 44,24 · mínimo R$");
      await expect(linha.getByTestId("peca-selo")).toContainText("paga tudo, com lucro e folga");
    }
  });

  test("(c) peça marcada exclusiva não aparece na lista; o alternador some/mostra", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeExclusiva = `[e2e] Exclusiva ${suf}`;

    await fazerLogin(page);
    await abrirNovaPeca(page);

    await page.getByTestId("ficha-campo-nome").fill(nomeExclusiva);
    await page.getByRole("checkbox", { name: /Peça exclusiva deste pedido/ }).click();
    await preencherCaneca(page, nomeExclusiva);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    await page.goto("/financeiro?aba=pecas");
    await expect(page.getByText(nomeExclusiva, { exact: true })).toHaveCount(0);

    const alternador = page.getByTestId("pecas-alternar-exclusivas");
    await expect(alternador).toBeVisible();
    await expect(alternador).toContainText("Mostrar peças exclusivas de pedidos (");

    await alternador.click();
    await expect(page).toHaveURL(/exclusivas=1/);
    await expect(linhaDaPeca(page, nomeExclusiva)).toBeVisible();
    // `getByText` não é usado aqui: o próprio nome ("[e2e] Exclusiva ...") contém a substring
    // "exclusiva" (a busca por texto do Playwright é case-insensitive), o que bateria duas vezes.
    await expect(linhaDaPeca(page, nomeExclusiva).getByTestId("peca-etiqueta-exclusiva")).toBeVisible();
    await expect(page.getByTestId("pecas-alternar-exclusivas")).toContainText(
      "Esconder peças exclusivas de pedidos (",
    );
  });

  test("(d) 'Começar a partir de' preenche medida e material, e o nome vem vazio", async ({ page }) => {
    await fazerLogin(page);
    await abrirNovaPeca(page);

    await page.getByRole("combobox", { name: "Começar a partir de uma peça parecida (opcional)" }).click();
    await page.getByRole("option", { name: nomeDaPecaA, exact: true }).click();

    await expect(page.getByTestId("ficha-campo-nome")).toHaveValue("");
    await expect(page.getByTestId("ficha-campo-argila")).toHaveValue("450");
    await expect(page.getByTestId("ficha-campo-esmalte")).toHaveValue("60");
    await expect(page.getByTestId("ficha-campo-horas")).toHaveValue("0,6");
    await expect(page.getByTestId("ficha-campo-largura")).toHaveValue("12");
    await expect(page.getByTestId("ficha-campo-profundidade")).toHaveValue("9");
    await expect(page.getByTestId("ficha-campo-altura")).toHaveValue("10");
    await expect(page.getByTestId("ficha-campo-embalagem")).toHaveValue("3,00");
    // Nem preço praticado nem preço de mercado são copiados (D-19).
    await expect(page.getByTestId("ficha-campo-preco-praticado")).toHaveValue("");

    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("(e) apagar uma peça que não está em orçamento nenhum: o diálogo nomeia a peça, e o item continua no Catálogo", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=pecas&peca=${idDaPecaB}`);
    await expect(page.getByRole("heading", { name: "Precificar peça" })).toBeVisible();

    await page.getByRole("button", { name: "Apagar" }).click();
    await expect(page).toHaveURL(new RegExp(`apagarPeca=${idDaPecaB}`));

    const dialogo = page.getByTestId("dialogo-apagar-peca");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(`Apagar a peça «${nomeDaPecaB}»?`);
    await expect(dialogo).toContainText(
      "Ela sai da lista e do Catálogo. Só é possível apagar uma peça que não está em nenhum orçamento.",
    );

    await dialogo.getByRole("button", { name: "Apagar" }).click();
    await expect(page).toHaveURL("/financeiro?aba=pecas");
    await expect(linhaDaPeca(page, nomeDaPecaB)).toHaveCount(0);

    // O item correspondente CONTINUA no Catálogo — apagar a ficha nunca apaga `itens_catalogo`.
    await page.goto("/cadastros?sub=catalogo");
    await expect(linhaDoCatalogo(page, nomeDaPecaB)).toBeVisible();
  });

  test("(f) a 320px a lista não rola na horizontal e todo alvo de toque mede ao menos 44px", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/financeiro?aba=pecas");
    await expect(linhaDaPeca(page, nomeDaPecaA)).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `a lista de peças rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const caixaDoNovaPeca = await page.getByTestId("nova-peca").first().boundingBox();
    expect(caixaDoNovaPeca?.height ?? 0).toBeGreaterThanOrEqual(44);

    const caixaDoAbrir = await linhaDaPeca(page, nomeDaPecaA).getByRole("link", { name: "Abrir" }).boundingBox();
    expect(caixaDoAbrir?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("(g) um nome de peça de 120 caracteres quebra em mais de uma linha sem estourar a largura a 320px", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeLongo = `[e2e] ${suf} ${"nome comprido de peça ".repeat(6)}`.slice(0, 120);
    expect(nomeLongo.length).toBe(120);

    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await abrirNovaPeca(page);

    await preencherCaneca(page, nomeLongo);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");
    await escolherCategoriaDeVenda(page);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    await page.goto("/financeiro?aba=pecas");
    const nomeNaLista = page.getByText(nomeLongo, { exact: true });
    await expect(nomeNaLista).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const caixaDoNome = await nomeNaLista.boundingBox();
    // Uma linha de `text-corpo` (16px/1.5) mede uns 24px — mais de uma linha passa bem de 30px.
    expect(caixaDoNome?.height ?? 0).toBeGreaterThan(30);
  });
});

import { test, expect, type Page } from "@playwright/test";

// A ficha de precificação de uma peça (04.5-04-PLAN.md): D-18 (peça de linha compartilha um
// preço só com o item do Catálogo), D-19 (peça exclusiva não aparece no Catálogo), D-12 (peça que
// não cabe avisa sem número). Nomes inventados e únicos por execução ("[e2e] ... {sufixo}") —
// nenhum dado real do ateliê, o repositório é público.
//
// Os números da "Caneca 300 ml" (argila 450 g, esmalte 60 g, 0,6 h, 12×9×10 cm, embalagem R$ 3)
// são os mesmos de `tests/unit/precificacao-calculo.test.ts`/`precificacao-ficha.test.ts`, contra
// os parâmetros ILUSTRATIVOS da semente (`db/migrations/0019`) e o forno de 35×35×35 cm (D-08):
// custo R$ 44,24, mínimo R$ 61,87, zero R$ 45,84 — por isso R$ 95 dá verde e R$ 20 dá vermelho.
//
// O aviso de divisor inválido (mexer nos parâmetros globais em /cadastros?sub=parametros) NÃO é
// testado aqui — disputaria estado com `tests/e2e/precificacao-parametros.spec.ts`, que roda no
// MESMO banco efêmero. Coberto por `tests/unit/precificacao-ficha.test.ts` (Tarefa 1) e pela
// verificação humana do plano 13. Registrado no SUMMARY.

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
  await page.getByTestId("nova-peca").click();
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

function linhaDoCatalogo(page: Page, nome: string) {
  return page.getByTestId("catalogo-item").filter({ has: page.getByText(nome, { exact: true }) });
}

test.describe("precificacao ficha", () => {
  test.describe.configure({ mode: "serial" });

  // Compartilhado entre os testes (a)/(b)/(c), que rodam em ordem (serial) no mesmo worker.
  let nomeDaPecaDeLinha = "";
  let idDaPecaDeLinha = "";

  test("(a) cria peça de linha com preço acima do mínimo — selo verde antes de salvar, e a peça existe depois", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    nomeDaPecaDeLinha = `[e2e] Caneca 300 ml ${suf}`;

    await fazerLogin(page);
    await abrirNovaPeca(page);

    await preencherCaneca(page, nomeDaPecaDeLinha);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");
    await page.getByRole("combobox", { name: "Categoria de venda" }).click();
    await page.getByRole("option", { name: "Peças prontas" }).click();

    await expect(page.getByTestId("ficha-selo")).toContainText("paga tudo, com lucro e folga");

    await page.getByRole("button", { name: "Salvar" }).click();

    // O aviso some da URL logo depois de mostrar o toast (`AvisoFinanceiro`, mesmo padrão da
    // 04.4) — a asserção de URL não exige `&aviso=peca-salva` sobrevivendo, só o `?peca=<id>`.
    await expect(page).toHaveURL(/\/financeiro\?aba=pecas&peca=[0-9a-f-]{36}/, { timeout: 10000 });
    await expect(page.getByText("Peça salva.")).toBeVisible();
    // O diálogo reabre em modo edição com a peça recém-criada — prova de que ela existe.
    await expect(page.getByRole("heading", { name: "Precificar peça" })).toBeVisible();
    await expect(page.getByTestId("ficha-campo-nome")).toHaveValue(nomeDaPecaDeLinha);

    const url = new URL(page.url());
    idDaPecaDeLinha = url.searchParams.get("peca") ?? "";
    expect(idDaPecaDeLinha).not.toBe("");
  });

  test("(b) o item correspondente aparece no Catálogo com o mesmo preço — prova de D-18, um preço só", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/cadastros?sub=catalogo");

    const linha = linhaDoCatalogo(page, nomeDaPecaDeLinha);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("R$ 95,00");
  });

  test("(c) mudar o preço praticado da ficha atualiza o MESMO valor no Catálogo — nunca um segundo campo", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=pecas&peca=${idDaPecaDeLinha}`);
    await expect(page.getByRole("heading", { name: "Precificar peça" })).toBeVisible();
    await expect(page.getByTestId("ficha-campo-preco-praticado")).toHaveValue("95,00");

    await page.getByTestId("ficha-campo-preco-praticado").fill("110");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    await page.goto("/cadastros?sub=catalogo");
    const linha = linhaDoCatalogo(page, nomeDaPecaDeLinha);
    await expect(linha).toContainText("R$ 110,00");
  });

  test("(d) prato grande demais para o forno cadastrado mostra o aviso e nenhum preço", async ({ page }) => {
    const suf = sufixoUnico();
    await fazerLogin(page);
    await abrirNovaPeca(page);

    await page.getByTestId("ficha-campo-nome").fill(`[e2e] Prato grande demais ${suf}`);
    // Forno de 35×35×35 cm (D-08): 40×40 cm não cabe em nenhuma das duas orientações.
    await page.getByTestId("ficha-campo-largura").fill("40");
    await page.getByTestId("ficha-campo-profundidade").fill("40");
    await page.getByTestId("ficha-campo-altura").fill("5");

    await expect(page.getByTestId("aviso-nao-cabe")).toBeVisible();
    await expect(page.getByTestId("aviso-nao-cabe")).toContainText(
      "Com essas medidas a peça não cabe no forno cadastrado.",
    );
    await expect(page.getByTestId("ficha-selo")).toHaveCount(0);
    await expect(page.getByTestId("ficha-barra-custo")).toHaveCount(0);

    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("(e) preço praticado abaixo do zero mostra o selo vermelho", async ({ page }) => {
    const suf = sufixoUnico();
    await fazerLogin(page);
    await abrirNovaPeca(page);

    await preencherCaneca(page, `[e2e] Xícara de café ${suf}`);
    await page.getByTestId("ficha-campo-preco-praticado").fill("20");

    await expect(page.getByTestId("ficha-selo")).toContainText("abaixo do custo: você paga para trabalhar");

    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("(f) salvar sem nome recusa com 'Dê um nome à peça.' e o diálogo continua aberto e preenchido", async ({
    page,
  }) => {
    await fazerLogin(page);
    await abrirNovaPeca(page);

    await page.getByTestId("ficha-campo-argila").fill("450");
    await page.getByTestId("ficha-campo-embalagem").fill("3");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dê um nome à peça.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
    await expect(page.getByTestId("ficha-campo-argila")).toHaveValue("450");
    await expect(page.getByTestId("ficha-campo-embalagem")).toHaveValue("3");
  });

  test("(g) marcar 'Peça exclusiva deste pedido' esconde a categoria e salva sem item de catálogo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Peça exclusiva ${suf}`;

    await fazerLogin(page);
    await abrirNovaPeca(page);

    await page.getByTestId("ficha-campo-nome").fill(nome);
    await expect(page.getByRole("combobox", { name: "Categoria de venda" })).toBeVisible();

    await page.getByRole("checkbox", { name: /Peça exclusiva deste pedido/ }).click();
    await expect(page.getByRole("combobox", { name: "Categoria de venda" })).toHaveCount(0);

    await preencherCaneca(page, nome);
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    await page.goto("/cadastros?sub=catalogo");
    await expect(page.getByText(nome, { exact: true })).toHaveCount(0);
  });

  test("(h) a 320px o diálogo não provoca rolagem horizontal, campos ≥16px e alvos ≥44px, incluindo a caixa de marcação", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await abrirNovaPeca(page);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `o diálogo da ficha rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const tamanhoDaFonteDoNome = await page
      .getByTestId("ficha-campo-nome")
      .evaluate((elemento) => parseFloat(getComputedStyle(elemento).fontSize));
    expect(tamanhoDaFonteDoNome).toBeGreaterThanOrEqual(16);

    const caixaDoSalvar = await page.getByRole("button", { name: "Salvar" }).boundingBox();
    expect(caixaDoSalvar?.height ?? 0).toBeGreaterThanOrEqual(44);

    const caixaDaExclusiva = await page.getByTestId("ficha-campo-exclusiva").boundingBox();
    expect(caixaDaExclusiva?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(caixaDaExclusiva?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

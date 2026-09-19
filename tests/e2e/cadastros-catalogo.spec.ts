import { test, expect, type Page } from "@playwright/test";

// O traçado ponta a ponta do Catálogo em Cadastros (04.4-05-PLAN.md): criar um insumo só com
// estoque próprio, criar um item vendável, editar a ficha técnica dele, ver o efeito na Venda, e
// as recusas humanas (nem venda nem estoque; item em uso como insumo de outro). Nomes inventados
// e únicos por execução ("[e2e] ... {sufixo}") — nenhum dado real, o repositório é público. O
// primeiro teste afirma uma condição GLOBAL do banco ("nenhum item no catálogo") e por isso é
// marcado `@vazio-global`, rodando na cadeia `vazio-celular → vazio-desktop` de
// `playwright.config.ts`, ANTES de qualquer teste que escreva (mesma disciplina de
// `tests/e2e/abertura-tracador.spec.ts`/`tests/e2e/cotacoes-categorias.spec.ts`) — nunca isolado
// por `--grep` como muleta.

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

// O catálogo é GLOBAL e compartilhado por qualquer outro teste rodando ao mesmo tempo (nenhuma
// afirmação de condição vazia fora do caso `@vazio-global`) — o botão "+ Novo item" existe em DOIS
// lugares (o cabeçalho da lista populada, ou dentro do estado vazio), dependendo de outro worker
// já ter criado algum item do catálogo ou não. Espera por QUALQUER um dos dois e clica no que
// apareceu, em vez de supor qual estado o catálogo está.
async function abrirNovoItem(page: Page) {
  const botaoPopulado = page.getByTestId("novo-item");
  const botaoVazio = page
    .getByTestId("cadastros-vazio-catalogo")
    .getByRole("button", { name: "+ Novo item" });
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

// A linha do item pelo NOME EXATO — nunca `hasText` simples: a etiqueta "gasta 15 g de {insumo}"
// do CAFÉ contém o nome inteiro do GRÃO como substring, então `filter({ hasText: nomeDoGrao })`
// acha as duas linhas (achado real desta suíte). `getByText(nome, { exact: true })` só bate no
// `<span>` do nome propriamente dito, nunca na etiqueta que o cita por extenso.
function linhaDoCatalogo(page: Page, nome: string) {
  return page.getByTestId("catalogo-item").filter({ has: page.getByText(nome, { exact: true }) });
}

test.describe("cadastros catalogo — criar, editar, ficha técnica e o efeito na Venda", () => {
  test.describe.configure({ mode: "serial" });

  test("com o banco sem nenhum item, a sub-aba Catálogo mostra o estado vazio e o botão abre o diálogo de verdade @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/cadastros?sub=catalogo");

    const titulo = page.getByRole("heading", { name: "Nada no catálogo ainda.", level: 2 });
    await expect(titulo).toHaveCount(1);
    await expect(titulo).toBeVisible();
    await expect(page.getByText("Cadastre o primeiro item que você vende ou compra.")).toBeVisible();

    const botaoDoEstadoVazio = page.getByTestId("cadastros-vazio-catalogo").getByRole("button", {
      name: "+ Novo item",
    });
    await expect(botaoDoEstadoVazio).toBeVisible();
    await botaoDoEstadoVazio.click();

    // A etapa de vazio é só leitura — confere que o diálogo de verdade abriu e fecha sem salvar
    // nada.
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("cria insumo, item vendável, edita a ficha técnica, mostra o efeito na Venda, e as duas recusas humanas", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeGrao = `[e2e] Grão de café ${suf}`;
    const nomeCafe = `[e2e] Café 200 ml ${suf}`;

    await fazerLogin(page);
    await page.goto("/cadastros?sub=catalogo");

    // 1. Cria o insumo "Grão de café" — só estoque próprio, unidade g, categoria da compra
    // "Insumos da cafeteria". O catálogo pode estar vazio ou não neste ponto (outro worker pode
    // já ter escrito) — `abrirNovoItem` cobre os dois estados.
    await abrirNovoItem(page);
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await page.getByLabel("Nome").fill(nomeGrao);
    await page.getByRole("checkbox", { name: "Tem estoque próprio" }).click();
    await page.getByRole("combobox", { name: "Unidade" }).click();
    await page.getByRole("option", { name: "g", exact: true }).click();
    await page.getByRole("combobox", { name: "Categoria da compra" }).click();
    await page.getByRole("option", { name: "Insumos da cafeteria" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=catalogo$/);
    const linhaGrao = linhaDoCatalogo(page, nomeGrao);
    await expect(linhaGrao).toBeVisible();
    await expect(linhaGrao).toContainText("só insumo");
    await expect(linhaGrao).toContainText("estoque em g");

    // 2. Cria "Café 200 ml" — aparece na venda, nos mais usados, R$ 8, categoria "Bebidas e
    // comidas".
    await page.getByTestId("novo-item").click();
    await page.getByLabel("Nome").fill(nomeCafe);
    await page.getByRole("checkbox", { name: "Aparece na venda" }).click();
    await page.getByRole("combobox", { name: "Categoria de venda" }).click();
    await page.getByRole("option", { name: "Bebidas e comidas" }).click();
    await page.getByLabel("Preço de venda").fill("8");
    await page.getByRole("checkbox", { name: "Nos mais usados" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=catalogo$/);
    const linhaCafe = linhaDoCatalogo(page, nomeCafe);
    await expect(linhaCafe).toBeVisible();
    await expect(linhaCafe).toContainText("R$ 8,00");

    // 3. Edita o café e adiciona 15 g do grão na ficha técnica.
    await linhaCafe.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible();
    await page.getByRole("combobox", { name: "Insumo" }).click();
    await page.getByRole("option", { name: nomeGrao }).click();
    await page.getByLabel("Quantidade").fill("15");
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByTestId("ficha-linha")).toContainText(`15 g de ${nomeGrao}`);
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=catalogo$/);
    await expect(linhaCafe).toContainText(`gasta 15 g de ${nomeGrao}`);

    // 4. Na Venda, busca o café, põe na venda e o efeito mostra o que sai do estoque.
    await page.goto("/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await page.getByTestId("venda-atalho").filter({ hasText: nomeCafe }).click();

    const efeito = page.getByTestId("venda-efeito");
    await efeito.locator("summary").click();
    await expect(efeito).toContainText(`−15 g · ${nomeGrao}`);

    // 5. Tenta salvar um item sem "Aparece na venda" e sem "Tem estoque próprio" — a frase
    // aparece e o diálogo continua aberto e preenchido (nunca chega a submeter: o botão fica
    // desabilitado pela MESMA validação que o servidor usa).
    await page.goto("/cadastros?sub=catalogo");
    await page.getByTestId("novo-item").click();
    const nomeSemNada = `[e2e] Sem nada ${sufixoUnico()}`;
    await page.getByLabel("Nome").fill(nomeSemNada);
    await expect(
      page.getByText(
        "Marque Aparece na venda ou Tem estoque próprio — senão o item não aparece em lugar nenhum.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveValue(nomeSemNada);
    await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // 6. Tenta tirar o estoque do grão, que agora é insumo do café — recusado com o nome do
    // café.
    await linhaGrao.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Tem estoque próprio" }).click();
    await expect(
      page.getByText(`Esse item é insumo de ${nomeCafe} — tire da ficha técnica antes.`),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // 7. Cria um item sem preço — a lista mostra "valor na hora".
    await page.getByTestId("novo-item").click();
    const nomeSemPreco = `[e2e] Item sem preço ${sufixoUnico()}`;
    await page.getByLabel("Nome").fill(nomeSemPreco);
    await page.getByRole("checkbox", { name: "Aparece na venda" }).click();
    await page.getByRole("combobox", { name: "Categoria de venda" }).click();
    await page.getByRole("option", { name: "Bebidas e comidas" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=catalogo$/);
    await expect(
      linhaDoCatalogo(page, nomeSemPreco),
    ).toContainText("valor na hora");
  });

  test("a 320px de largura, /cadastros?sub=catalogo não exige rolagem horizontal", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/cadastros?sub=catalogo");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/cadastros?sub=catalogo rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

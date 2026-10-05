import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";

import {
  contarFornecedoresComNome,
  fornecedorNoBanco,
  idDoUsuarioDoTeste,
} from "./apoio/semear-fornecedores";

// Cadastros → Fornecedores, o traçador da Fase 06.2 (06.2-02-PLAN.md, Tarefa 1; FRN-01, FRN-02, UI-D1):
// da sétima pílula à folha "Novo fornecedor", à Server Action `criarFornecedor`, à tabela
// `fornecedores` e de volta à lista com a ficha aberta. E as bordas do caminho: toque duplo grava um
// só, nome repetido entre ativos volta com a frase embaixo do Nome, nome vazio não fecha a folha, e a
// fileira de sete pílulas a 320 px e no computador.
//
// Nenhum teste aqui afirma condição global do banco ("nenhum fornecedor"): todos usam nomes com
// sufixo único e prefixo `[e2e]` (CLAUDE.md). O vazio total é do plano 03, na cadeia `vazio-*`.

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

const FORMATO_DO_ID = /fornecedor=([0-9a-f-]{36})/;

async function abrirFolhaNova(page: Page) {
  await page.getByTestId("novo-fornecedor").click();
  const folha = page.getByTestId("folha-fornecedor");
  await expect(folha.getByRole("heading", { name: "Novo fornecedor" })).toBeVisible();
  return folha;
}

test.describe("fornecedores tracador", () => {
  test("(a) da sétima pílula ao banco: cadastrar um fornecedor e vê-lo na lista, com a ficha aberta", async ({
    page,
  }) => {
    const nome = `[e2e] Fornecedor ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto("/gestao/cadastros");
    await page.getByTestId("cadastros-sub-fornecedores").click();
    await expect(page).toHaveURL(/sub=fornecedores/);
    await expect(page.getByTestId("cadastros-sub-fornecedores")).toHaveAttribute("aria-selected", "true");

    const folha = await abrirFolhaNova(page);
    await expect(folha.getByText("Só o nome é obrigatório.")).toBeVisible();
    // Com espaços em volta: o servidor apara.
    await folha.getByLabel("Nome", { exact: true }).fill(`  ${nome}  `);
    await folha.getByLabel("O que vende").fill("argila, esmalte");
    await folha.getByRole("combobox", { name: "Área que mais usa" }).click();
    await page.getByRole("option", { name: "Cafeteria" }).click();
    await folha.getByRole("button", { name: "Salvar fornecedor" }).click();

    await expect(page.getByText("Fornecedor cadastrado. Agora suba a tabela de preços dele.").first()).toBeVisible();
    await expect(folha).toBeHidden();
    await expect(page).toHaveURL(FORMATO_DO_ID);
    const id = FORMATO_DO_ID.exec(page.url())?.[1] ?? "";

    // A linha aparece na lista, marcada como a aberta; a ficha abre com o nome no h2.
    const linha = page.locator(`[data-testid="fornecedor-linha"][data-fornecedor-id="${id}"]`);
    await expect(linha).toHaveAttribute("aria-current", "true");
    await expect(linha).toContainText(nome);
    const ficha = page.getByTestId("fornecedor-ficha");
    await expect(ficha.getByRole("heading", { level: 2, name: nome })).toBeVisible();
    await expect(ficha).toContainText("Fornecedor não se apaga");

    // No banco: o nome aparado, ativo, e o autor é o usuário da sessão — a folha não decide nada disso.
    const noBanco = await fornecedorNoBanco(id);
    expect(noBanco).not.toBeNull();
    expect(noBanco?.nome).toBe(nome);
    expect(noBanco?.vende).toBe("argila, esmalte");
    expect(noBanco?.area).toBe("cafeteria");
    expect(noBanco?.ativo).toBe(true);
    const usuarioId = await idDoUsuarioDoTeste();
    expect(noBanco?.criadoPor).toBe(usuarioId);
    expect(noBanco?.atualizadoPor).toBe(usuarioId);
  });

  test("(b) toque duplo em Salvar cria um só; o mesmo nome em outra caixa, sem acento e com espaços volta com a frase embaixo do Nome", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Fornecedor Goiás ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");

    const folha = await abrirFolhaNova(page);
    await folha.getByLabel("Nome", { exact: true }).fill(nome);
    await folha.getByRole("button", { name: "Salvar fornecedor" }).dblclick();

    await expect(page.getByText("Fornecedor cadastrado. Agora suba a tabela de preços dele.").first()).toBeVisible();
    await expect(page).toHaveURL(FORMATO_DO_ID);
    expect(await contarFornecedoresComNome(nome)).toBe(1);

    // De novo, com o mesmo nome em CAIXA ALTA, sem o acento e com espaços: o índice único entre
    // ativos (`nome_normalizado`, D-06 — troca do dono, 03/10/2026) recusa.
    const repetido = `  [E2E] FORNECEDOR GOIAS ${suf.toUpperCase()}  `;
    const segunda = await abrirFolhaNova(page);
    const campoNome = segunda.getByLabel("Nome", { exact: true });
    await campoNome.fill(repetido);
    await segunda.getByLabel("O que vende").fill("feldspato");
    await segunda.getByRole("button", { name: "Salvar fornecedor" }).click();

    await expect(segunda.getByTestId("fornecedor-erro-nome")).toHaveText(
      "Já existe um fornecedor ativo com esse nome. Use outro nome — ou abra o que já existe na lista.",
    );
    // A folha continua aberta e preenchida — nada do que foi digitado se perde.
    await expect(segunda).toBeVisible();
    await expect(campoNome).toHaveValue(repetido);
    await expect(segunda.getByLabel("O que vende")).toHaveValue("feldspato");
    await expect(campoNome).toBeFocused();
    expect(await contarFornecedoresComNome(nome)).toBe(1);
  });

  test("(c) Salvar com o Nome vazio mostra a frase embaixo do campo e não fecha a folha", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");

    const folha = await abrirFolhaNova(page);
    await folha.getByLabel("O que vende").fill("argila");
    await folha.getByRole("button", { name: "Salvar fornecedor" }).click();

    await expect(folha.getByTestId("fornecedor-erro-nome")).toHaveText("Diga o nome do fornecedor.");
    await expect(folha).toBeVisible();
    await expect(folha.getByLabel("Nome", { exact: true })).toBeFocused();
    await expect(folha.getByLabel("O que vende")).toHaveValue("argila");
  });

  // Fase 06.5 (D-09, 06.5-04-PLAN.md): o 3 + 3 + 1 da Fase 06.2 deu lugar a UMA fileira com rolagem
  // lateral. "Fornecedores" é a terceira pílula; aberta, ela fica inteira à vista dentro do trilho.
  test("(d) a 320 px, “Fornecedores” fica na fileira única, inteira dentro do trilho, numa linha só, e a página não rola de lado", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/gestao/cadastros?sub=fornecedores");
    const pilula = page.getByTestId("cadastros-sub-fornecedores");
    await expect(pilula).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth, `rola de lado a 320px (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(clientWidth);

    // Uma fileira só: Clientes, Fornecedores e Contas fixas na mesma altura.
    const caixaClientes = await medirCaixa(page.getByTestId("cadastros-sub-clientes"));
    const caixaFixas = await medirCaixa(page.getByTestId("cadastros-sub-fixas"));
    const caixaFornecedores = await medirCaixa(pilula);
    expect(Math.abs(caixaFornecedores.y - caixaClientes.y)).toBeLessThan(2);
    expect(Math.abs(caixaFixas.y - caixaFornecedores.y)).toBeLessThan(2);
    expect(caixaFornecedores.height).toBeGreaterThanOrEqual(44);

    // Inteira dentro do trilho (a centralização roda na hidratação — por isso a espera).
    const trilho = page.getByTestId("cadastros-abas-trilho");
    await expect
      .poll(async () => {
        const caixaTrilho = await medirCaixa(trilho);
        const caixa = await medirCaixa(pilula);
        return caixa.x >= caixaTrilho.x - 0.5 && caixa.x + caixa.width <= caixaTrilho.x + caixaTrilho.width + 0.5;
      })
      .toBe(true);

    // "Fornecedores" numa linha só, dentro da pílula.
    const linhasDoRotulo = await pilula.evaluate((elemento) => {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(elemento);
      return new Set([...intervalo.getClientRects()].map((retangulo) => Math.round(retangulo.top))).size;
    });
    expect(linhasDoRotulo).toBe(1);
  });

  test("(e) no computador (≥ 1024 px), as sete pílulas ficam numa fileira só, cada rótulo numa linha", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "desktop", "Só o projeto desktop tem 1024 px ou mais.");

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");
    await expect(page.getByTestId("cadastros-sub-fornecedores")).toBeVisible();

    const subs = ["catalogo", "clientes", "fornecedores", "fixas", "categorias", "parametros", "taxas"];
    const tops: number[] = [];
    for (const sub of subs) {
      const pilula = page.getByTestId(`cadastros-sub-${sub}`);
      const caixa = await pilula.boundingBox();
      expect(caixa, `pílula "${sub}"`).not.toBeNull();
      tops.push(caixa?.y ?? -1);
      const linhas = await pilula.evaluate((elemento) => {
        const intervalo = document.createRange();
        intervalo.selectNodeContents(elemento);
        return new Set([...intervalo.getClientRects()].map((retangulo) => Math.round(retangulo.top))).size;
      });
      expect(linhas, `rótulo de "${sub}" numa linha`).toBe(1);
    }
    for (const top of tops) {
      expect(Math.abs(top - tops[0])).toBeLessThan(2);
    }
  });
});

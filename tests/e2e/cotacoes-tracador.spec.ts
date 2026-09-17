import { test, expect, type Page } from "@playwright/test";

// O traçado ponta a ponta do Comparador de Compras (04.3-01-PLAN.md, Tarefa 1): da quarta aba
// `/abertura?aba=cotacoes` até uma categoria e uma cotação reais, criadas pela tela, com o preço
// convertido para centavos no Postgres e voltando formatado — a prova de que o dado saiu do
// protótipo com `localStorage` e foi para o banco, que é a razão desta fase existir. "cotacoes
// tracador" no título do bloco é o recorte usado pelo orçamento de e2e deste plano
// (`npm run test:e2e -- --grep "cotacoes tracador"`).
//
// Nenhuma condição GLOBAL do banco é afirmada aqui (nenhuma marca `@vazio-global` é necessária):
// toda categoria/cotação criada tem nome inventado e único (`nomeUnico`), e cada asserção mira
// SÓ o que este teste acabou de criar — nunca "a lista está vazia" nem "existe exatamente N".
//
// Nomes inventados e reconhecíveis como tal ("Fornos de Teste", "Cerâmica Modelo") — nenhum dado
// real de fornecedor, telefone ou pessoa em lugar nenhum (o repositório é público).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// A cotação aparece como CARTÃO (<660px, celular) ou como LINHA de tabela (≥660px, desktop) — as
// DUAS formas do mesmo dado ficam no DOM ao mesmo tempo (alternadas só por CSS, UI-SPEC
// §"Responsivo"), então `filter({ visible: true })` é obrigatório: sem ele, `.or()` resolve para
// os dois elementos (um deles com `display: none`) e o modo estrito do Playwright reprova por
// ambiguidade, não por o dado estar ausente.
function linhaOuCartaoDaCotacao(page: Page, empresa: string) {
  return page
    .getByTestId("cotacoes-linha")
    .filter({ hasText: empresa, visible: true })
    .or(page.getByTestId("cotacoes-cartao").filter({ hasText: empresa, visible: true }));
}

test.describe("cotacoes tracador — traçado do Comparador de Compras", () => {
  test.describe.configure({ mode: "serial" });

  test("a aba Cotações existe, navega por query string e cabe a 320px", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/abertura");

    const abaCotacoes = page.getByTestId("abertura-aba-cotacoes");
    await expect(abaCotacoes).toBeVisible();
    await expect(abaCotacoes).toHaveAttribute("aria-selected", "false");

    const caixaDaAba = await abaCotacoes.boundingBox();
    expect(caixaDaAba?.height, "a pílula da aba mede menos que 44px").toBeGreaterThanOrEqual(44);

    await abaCotacoes.click();
    await expect(page).toHaveURL(/\?aba=cotacoes$/);
    await expect(abaCotacoes).toHaveAttribute("aria-selected", "true");

    // 320px (iPhone SE) — a página não pode exigir rolagem horizontal (UI-SPEC §"Cabimento em
    // 320px, calculado").
    await page.setViewportSize({ width: 320, height: 800 });
    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/abertura?aba=cotacoes rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test("uma categoria criada pelo diálogo e uma cotação com os seis campos longos sobrevivem a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeDaCategoria = nomeUnico("Fornos de Teste");
    const nomeDaEmpresa = nomeUnico("Cerâmica Modelo");

    // --- Criar categoria (D-14, <10s: um diálogo, um campo, um clique) ---
    await page.goto("/abertura?aba=cotacoes");
    // O comparador pode subir vazio (D-18 a D-21 retiradas): sem NENHUMA categoria, o botão fica
    // no estado vazio (`BotaoVazioCotacoes`); com pelo menos uma, na pílula tracejada
    // (`PilulaNovaCategoria`) — os dois têm o mesmo texto visível "+ Nova categoria".
    await page.getByRole("link", { name: "+ Nova categoria" }).first().click();

    const dialogoCategoria = page.getByRole("heading", { name: "Nova categoria" });
    await expect(dialogoCategoria).toBeVisible();

    await page.getByLabel("Nome").fill(nomeDaCategoria);
    await page.getByRole("button", { name: "Criar" }).click();

    // Navegação COMPLETA (D-23) para a categoria recém-criada — só o servidor sabe o
    // identificador que nasceu.
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, {
      timeout: 10000,
    });
    const urlComACategoria = page.url();

    const pilulaDaCategoria = page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeDaCategoria });
    await expect(pilulaDaCategoria).toBeVisible();
    await expect(pilulaDaCategoria).toHaveAttribute("aria-selected", "true");
    // Contagem "0" visível — nunca omitida (UI-SPEC §Assunções item 4). `data-testid` próprio:
    // o nome único de teste pode conter dígitos, então a contagem precisa do próprio elemento.
    await expect(pilulaDaCategoria.getByTestId("cotacoes-sub-aba-contagem")).toHaveText("0");

    // --- Criar cotação: preço com símbolo da moeda e separador de milhar (D-08), os seis campos
    // longos preenchidos (D-06) ---
    await page.getByRole("link", { name: "+ Nova cotação" }).first().click();
    await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeVisible();

    await page.getByLabel("Empresa").fill(nomeDaEmpresa);
    await page.getByLabel("Especificação do produto").fill("Forno JC 0613 · 180 L · 1300 °C");
    await page.getByLabel("Preço").fill("R$ 24.900");
    await page.getByLabel("Diferenciais").fill("Controlador digital com 8 rampas.");
    await page.getByLabel("Assistência técnica").fill("Assistência em Goiânia. Garantia de 12 meses.");
    await page.getByLabel("Condições de pagamento").fill("10x sem juros no cartão.");
    await page.getByLabel("Contato").fill("Time de teste — telefone mascarado (11) 9xxxx-xxxx");
    await page.getByLabel("Observações").fill("Prazo de entrega: 45 dias.");
    await page.getByLabel("Alertas").fill("Voltagem 380V — confirmar se o espaço comporta.");

    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(urlComACategoria, { timeout: 10000 });

    const linhaDaCotacao = linhaOuCartaoDaCotacao(page, nomeDaEmpresa);
    await expect(linhaDaCotacao).toBeVisible();
    // O preço volta FORMATADO — a prova de que "R$ 24.900" saiu do navegador, virou centavos no
    // Postgres, e voltou pronto para a tela (a razão desta fase existir).
    await expect(linhaDaCotacao).toContainText("R$ 24.900");
    await expect(pilulaDaCategoria.getByTestId("cotacoes-sub-aba-contagem")).toHaveText("1");

    // Sobrevive a um recarregamento — a mesma prova contra perda silenciosa de
    // `abertura-tracador.spec.ts`/`queimas-tracador.spec.ts`.
    await page.reload();
    await expect(linhaOuCartaoDaCotacao(page, nomeDaEmpresa)).toBeVisible();
    await expect(linhaOuCartaoDaCotacao(page, nomeDaEmpresa)).toContainText("R$ 24.900");

    // --- Segunda cotação, SEM preço: travessão visível e frase acessível de "sob consulta" (D-07) ---
    const nomeSemPreco = nomeUnico("Importados Sem Preço");
    await page.getByRole("link", { name: "+ Nova cotação" }).first().click();
    await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeVisible();
    await page.getByLabel("Empresa").fill(nomeSemPreco);
    // "Preço" fica em branco de propósito.
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(urlComACategoria, { timeout: 10000 });

    const linhaSemPreco = linhaOuCartaoDaCotacao(page, nomeSemPreco);
    await expect(linhaSemPreco).toBeVisible();
    await expect(linhaSemPreco).toContainText("—");
    await expect(linhaSemPreco.locator('[aria-label="Preço sob consulta"]')).toBeVisible();
  });
});

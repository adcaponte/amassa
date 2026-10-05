import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";

// Fase 06.5 (Polimento), plano 04 — D-09, POL-02, achado 25 do Cowork: as sete abas dos Cadastros
// tomavam ~40 % da tela do celular em três fileiras. Viram UMA fileira com rolagem lateral, na ordem
// do dono, com a aba ativa centralizada ao abrir e um sinal de que a fileira continua.
//
// Toda caixa é medida por `medirCaixa` (D-23) — nunca `boundingBox()` direto. Nada aqui escreve no
// banco: só navega e mede.

const ORDEM_D09 = [
  "cadastros-sub-catalogo",
  "cadastros-sub-clientes",
  "cadastros-sub-fornecedores",
  "cadastros-sub-fixas",
  "cadastros-sub-categorias",
  "cadastros-sub-parametros",
  "cadastros-sub-taxas",
] as const;

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

async function paginaSemRolagemLateral(page: Page, onde: string) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(
    scrollWidth,
    `${onde}: a PÁGINA rola de lado (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth);
}

async function larguras(elemento: Locator): Promise<{ scrollWidth: number; clientWidth: number }> {
  return elemento.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
}

// Quantas linhas de texto o rótulo ocupa dentro da pílula (mesmo método de `fornecedores-tracador`).
async function linhasDoRotulo(pilula: Locator): Promise<number> {
  return pilula.evaluate((elemento) => {
    const intervalo = document.createRange();
    intervalo.selectNodeContents(elemento);
    return new Set([...intervalo.getClientRects()].map((retangulo) => Math.round(retangulo.top))).size;
  });
}

test.describe("polimento cadastros — abas", () => {
  for (const largura of [320, 375] as const) {
    test(`a ${largura} px: uma fileira que rola sozinha, na ordem do dono, pílulas de 44 px numa linha só`, async ({
      page,
    }) => {
      await fazerLogin(page);
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto("/gestao/cadastros?sub=catalogo");

      const trilho = page.getByTestId("cadastros-abas-trilho");
      await expect(trilho).toBeVisible();
      await expect(trilho).toHaveAttribute("role", "tablist");
      await expect(trilho).toHaveAttribute("aria-label", "Sub-navegação de Cadastros");

      // O trilho rola; a página, não.
      const medidas = await larguras(trilho);
      expect(
        medidas.scrollWidth,
        `a ${largura} px o trilho deveria rolar (scrollWidth ${medidas.scrollWidth} ≤ clientWidth ${medidas.clientWidth})`,
      ).toBeGreaterThan(medidas.clientWidth);
      await paginaSemRolagemLateral(page, `/gestao/cadastros a ${largura} px`);

      // A ordem do DOM é a de D-09.
      const ordem = await trilho
        .locator('[role="tab"]')
        .evaluateAll((pilulas) => pilulas.map((pilula) => pilula.getAttribute("data-testid")));
      expect(ordem).toEqual([...ORDEM_D09]);

      // Cada pílula: ≥ 44 px de altura, rótulo numa linha só, e todas da mesma altura.
      const alturas: number[] = [];
      for (const testid of ORDEM_D09) {
        const pilula = page.getByTestId(testid);
        const caixa = await medirCaixa(pilula, testid);
        expect(caixa.height, `altura de ${testid}`).toBeGreaterThanOrEqual(44);
        alturas.push(caixa.height);
        expect(await linhasDoRotulo(pilula), `rótulo de ${testid} numa linha`).toBe(1);
      }
      for (const altura of alturas) {
        expect(Math.abs(altura - alturas[0])).toBeLessThan(0.5);
      }

      // "Contas fixas" com f minúsculo (UI-D5).
      await expect(page.getByTestId("cadastros-sub-fixas")).toHaveText("Contas fixas");
    });

    test(`a ${largura} px, abrindo ?sub=taxas, a pílula “Taxas” fica inteira dentro do trilho`, async ({
      page,
    }) => {
      await fazerLogin(page);
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto("/gestao/cadastros?sub=taxas");

      const trilho = page.getByTestId("cadastros-abas-trilho");
      const taxas = page.getByTestId("cadastros-sub-taxas");
      await expect(taxas).toHaveAttribute("aria-selected", "true");

      // A centralização roda na hidratação (useLayoutEffect); até lá o HTML do servidor está com o
      // trilho no começo — por isso a espera.
      await expect
        .poll(async () => {
          const caixaTrilho = await medirCaixa(trilho, "trilho");
          const caixaTaxas = await medirCaixa(taxas, "pílula Taxas");
          return (
            caixaTaxas.x >= caixaTrilho.x - 0.5 &&
            caixaTaxas.x + caixaTaxas.width <= caixaTrilho.x + caixaTrilho.width + 0.5
          );
        }, { message: "a pílula “Taxas” deveria estar inteira dentro do trilho" })
        .toBe(true);

      // A centralização é só horizontal: a página não desceu.
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await paginaSemRolagemLateral(page, `/gestao/cadastros?sub=taxas a ${largura} px`);
    });
  }

  // O segundo sinal de que a fileira continua (UI-SPEC §"Sinal de que rola"): o degradê só existe do
  // lado que tem conteúdo escondido, e acompanha a rolagem.
  test("a 375 px, os degradês mostram de que lado a fileira continua e acompanham a rolagem", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/gestao/cadastros?sub=catalogo");

    const trilho = page.getByTestId("cadastros-abas-trilho");
    const esquerda = page.getByTestId("cadastros-abas-degrade-esquerda");
    const direita = page.getByTestId("cadastros-abas-degrade-direita");
    await expect(trilho).toBeVisible();

    // No começo: só o da direita (o estado vem do ResizeObserver, depois da hidratação).
    await expect(direita).toHaveCount(1);
    await expect(direita).toHaveAttribute("aria-hidden", "true");
    await expect(esquerda).toHaveCount(0);

    // Rolado até o fim, instantâneo: só o da esquerda.
    await trilho.evaluate((elemento) => {
      elemento.scrollLeft = elemento.scrollWidth;
    });
    await expect(esquerda).toHaveCount(1);
    await expect(esquerda).toHaveAttribute("aria-hidden", "true");
    await expect(direita).toHaveCount(0);

    // A rolagem do trilho não arrastou a página.
    await paginaSemRolagemLateral(page, "/gestao/cadastros a 375 px, trilho rolado até o fim");
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });

  test("a 1280 px as sete cabem sem rolar", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/gestao/cadastros?sub=catalogo");

    const trilho = page.getByTestId("cadastros-abas-trilho");
    await expect(trilho).toBeVisible();
    const medidas = await larguras(trilho);
    expect(
      medidas.scrollWidth,
      `a 1280 px o trilho rola (scrollWidth ${medidas.scrollWidth} > clientWidth ${medidas.clientWidth})`,
    ).toBeLessThanOrEqual(medidas.clientWidth);

    // Nada escondido, nenhum degradê.
    await expect(page.getByTestId("cadastros-abas-degrade-esquerda")).toHaveCount(0);
    await expect(page.getByTestId("cadastros-abas-degrade-direita")).toHaveCount(0);

    const caixaTrilho = await medirCaixa(trilho, "trilho");
    for (const testid of ORDEM_D09) {
      const caixa = await medirCaixa(page.getByTestId(testid), testid);
      expect(caixa.x + caixa.width, `${testid} dentro do trilho`).toBeLessThanOrEqual(
        caixaTrilho.x + caixaTrilho.width + 0.5,
      );
    }
  });
});

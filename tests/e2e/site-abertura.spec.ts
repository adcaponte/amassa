import { test, expect, type Page } from "@playwright/test";

// O traçador do site público (SIT-01/SIT-02/SIT-05): a raiz abre sem login, com a faixa "em
// construção", a abertura e as duas barras fixas na mesma ordem — e a âncora para junto ABAIXO
// da barra fixa, nunca atrás dela. Rodam nos dois projetos (desktop e celular) do
// playwright.config.ts.
//
// Escrito no plano 03 (28/09/2026), quando as seções #espaco, #agenda, #encomendas e #onde
// ainda não existiam — os botões fixos já apontavam para lá, mas sem destino. O plano 04 as
// construiu; o caso (f) aqui continua medindo só a âncora de `#topo` (a marca), e o caso
// equivalente para `#agenda`/`#encomendas` está em tests/e2e/site-secoes.spec.ts, caso (b).
test.describe("site abertura", () => {
  test.beforeEach(async ({ page }) => {
    // scroll-behavior: smooth só se aplica sem esta preferência (app/globals.css) — desligá-la
    // aqui torna o salto de âncora instantâneo e o teste determinístico, sem precisar esperar
    // uma animação terminar.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("(a) / responde sem nenhum login", async ({ page }) => {
    await page.goto("/");

    expect(page.url()).not.toContain("/gestao");
    await expect(page).toHaveTitle(/AMASSA CERRADO/);
    await expect(page.getByTestId("site-abertura")).toBeVisible();
  });

  test("(b) a faixa \"em construção\" é o primeiro bloco visível, com o texto de CONTEUDO_SITE.obra", async ({
    page,
  }) => {
    await page.goto("/");

    const faixa = page.getByTestId("site-faixa-obra");
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText("Nosso site ainda está em construção");
    await expect(faixa).toContainText("mas pode ir xeretando aí.");

    // "Primeiro bloco visível" = a faixa está acima da abertura no fluxo do documento (a barra
    // fixa não conta: ela é `position: fixed`, fora do fluxo, chrome permanente).
    const caixaFaixa = await faixa.boundingBox();
    const caixaAbertura = await page.getByTestId("site-abertura").boundingBox();
    expect(caixaFaixa).not.toBeNull();
    expect(caixaAbertura).not.toBeNull();
    expect(caixaFaixa!.y).toBeLessThan(caixaAbertura!.y);
  });

  test("(c) no computador, a barra superior fica visível mesmo depois de rolar 2000px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "position: fixed do computador — só o projeto desktop.");

    await page.goto("/");
    const barraSuperior = page.getByTestId("site-barra-superior");
    await expect(barraSuperior).toBeVisible();

    await page.mouse.wheel(0, 2000);
    await expect(barraSuperior).toBeVisible();

    const caixa = await barraSuperior.boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.y).toBe(0); // fixa no topo — não "sticky" que some ao rolar.
  });

  test("(d) no celular, a barra inferior fixa está visível e a superior não mostra os quatro links", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "celular", "Chrome específico do celular — só o projeto celular.");

    await page.goto("/");

    await expect(page.getByTestId("site-barra-inferior")).toBeVisible();
    // `exact: true` é obrigatório aqui: por padrão o Playwright casa por SUBSTRING no nome
    // acessível, e "Conhecer o espaço" (o botão de rolagem da abertura) contém "o espaço" —
    // sem `exact`, o teste "encontraria" o botão errado e a asserção de link do menu passaria
    // por acidente, não por medir o que deveria.
    await expect(page.getByRole("link", { name: "O espaço", exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: "Aulas e oficinas", exact: true })).toBeHidden();
  });

  test("(e) os dois botões fixos aparecem, na ordem Agenda → Encomendas", async ({ page }, testInfo) => {
    await page.goto("/");

    const barra =
      testInfo.project.name === "celular"
        ? page.getByTestId("site-barra-inferior")
        : page.getByTestId("site-barra-superior");

    await expect(barra).toBeVisible();
    // Pelos `data-testid`, não pelo nome acessível: a barra superior também tem um link de
    // navegação rotulado exatamente "Encomendas" (`LINKS_DE_SECAO`), que colidiria com um
    // filtro por nome/regex.
    const botaoAgenda = barra.getByTestId("site-botao-agenda");
    const botaoEncomendas = barra.getByTestId("site-botao-encomendas");
    await expect(botaoAgenda).toHaveText("Agenda");
    await expect(botaoEncomendas).toHaveText("Encomendas");
    await expect(botaoAgenda).toHaveAttribute("href", "#agenda");
    await expect(botaoEncomendas).toHaveAttribute("href", "#encomendas");

    // Ordem: Agenda aparece ANTES de Encomendas no DOM (SIT-05) — comparado pela posição
    // horizontal (os dois são vizinhos na mesma linha, `flex`).
    const caixaAgenda = await botaoAgenda.boundingBox();
    const caixaEncomendas = await botaoEncomendas.boundingBox();
    expect(caixaAgenda).not.toBeNull();
    expect(caixaEncomendas).not.toBeNull();
    expect(caixaAgenda!.x).toBeLessThan(caixaEncomendas!.x);
  });

  test("(f) a âncora fica ABAIXO da barra fixa — clicar na marca (#topo) não deixa o título atrás dela", async ({
    page,
  }) => {
    await page.goto("/");

    // Rola para longe do topo primeiro — sem isso, o teste passaria mesmo se scroll-margin-top
    // não existisse, porque a página já carrega em y=0.
    await page.mouse.wheel(0, 800);

    await page.getByRole("link", { name: "AMASSA CERRADO" }).first().click();

    const alturaDaBarra = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--altura-barra-site")),
    );
    expect(alturaDaBarra).toBeGreaterThan(0);

    const caixaTitulo = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(caixaTitulo).not.toBeNull();
    // Pequena folga (1px) para arredondamento de subpixel entre navegadores.
    expect(caixaTitulo!.y).toBeGreaterThanOrEqual(alturaDaBarra - 1);
  });

  test("(g) a 320px de largura, / não exige rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/ rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test("(h) todo botão e link das duas barras fixas mede ao menos 44px de altura", async ({ page }) => {
    await page.goto("/");

    const barras = [page.getByTestId("site-barra-superior"), page.getByTestId("site-barra-inferior")];

    for (const barra of barras) {
      const links = barra.getByRole("link");
      const total = await links.count();
      for (let indice = 0; indice < total; indice++) {
        const link = links.nth(indice);
        if (!(await link.isVisible())) continue; // a barra inferior não existe no desktop, e vice-versa.
        const caixa = await link.boundingBox();
        expect(caixa, "link visível sem boundingBox mensurável").not.toBeNull();
        expect(caixa!.height, `${await link.textContent()} mede menos de 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("(i) nenhum link da página aponta para /gestao", async ({ page }) => {
    await page.goto("/");

    const hrefs = await page.locator("a[href]").evaluateAll((elementos) =>
      elementos.map((elemento) => elemento.getAttribute("href") ?? ""),
    );

    const paraAPlataforma = hrefs.filter((href) => href.includes("/gestao"));
    expect(paraAPlataforma, `links para /gestao encontrados: ${paraAPlataforma.join(", ")}`).toEqual([]);
  });

  test("(j) o rodapé traz o Instagram e um link de WhatsApp com mensagem preenchida", async ({ page }) => {
    await page.goto("/");

    const rodape = page.getByTestId("site-rodape");
    await expect(rodape).toBeVisible();

    const linkInstagram = rodape.getByRole("link", { name: "Instagram" });
    await expect(linkInstagram).toHaveAttribute("href", /instagram\.com/);

    const linkWhatsapp = rodape.getByRole("link", { name: "WhatsApp" });
    const hrefWhatsapp = await linkWhatsapp.getAttribute("href");
    expect(hrefWhatsapp).not.toBeNull();
    expect(hrefWhatsapp!.startsWith("https://wa.me/")).toBe(true);
    const url = new URL(hrefWhatsapp!);
    expect(url.searchParams.get("text")?.length ?? 0).toBeGreaterThan(0);
  });
});

// O caso equivalente para `#agenda`/`#encomendas` (a âncora dos botões fixos, não a da marca)
// está em tests/e2e/site-secoes.spec.ts, caso (b) — as seções existem a partir do plano 04.
async function irParaTopo(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
}
void irParaTopo; // sem uso neste arquivo — mantido por se um caso futuro do traçador precisar.

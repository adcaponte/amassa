import { test, expect, type Page } from "@playwright/test";

// Prova automatizada de UI-01 (D-09) — "parece certo na minha tela" não é teste. Corre em
// /login (rota pública, sem precisar de sessão), nos dois projetos (desktop e celular)
// declarados em playwright.config.ts. Cobre a "armadilha de silêncio" do @theme inline: um
// componente instalado sem o mapeamento não quebra o build nem aparece no console — só uma
// leitura de cor computada no navegador pega isso.
//
// Nomes de família de fonte: medidos de verdade no navegador durante o portão de retorno do
// tracer da Tarefa 2 (02b-01) — com `variable: "--fonte-archivo"` (a CSS custom property que
// D-10 pede, consumida pelo bloco @theme), o next/font/google gera o nome LEGÍVEL da família
// ("Archivo Narrow", "Inter") mais o par "* Fallback" com métricas ajustadas — nunca o nome
// com hash (`__Archivo_Narrow_<hash>`) que só aparece no padrão de uso via `.className`
// direto, que este projeto não usa. Qualquer teste futuro de nome de fonte deve usar o nome
// medido, não o presumido.
//
// D-13 (fechado nesta mudança) trocou o "AMASSA" de texto em Archivo Narrow por um SVG da
// marca — o heading continua se chamando "AMASSA" (aria-label do <svg>, para o INFRA-02 de
// tests/e2e/fundacao.spec.ts), mas não sobra texto nele para medir fonte. Ancorar a prova de
// Archivo Narrow num único elemento foi exatamente o que mascarou, por toda a Fase 2b, o
// defeito real: `font-titulo` só era aplicado pelo `Logo`, nunca pelos papéis `display`/
// `título` em si (04-DESIGN-SYSTEM.md §4, 02b-UI-SPEC.md) — os outros seis usos reais desses
// papéis (saudação do painel, título de página, cabeçalho móvel, título de cartão, estado
// vazio, estado de erro) sempre renderizaram em Inter. A correção mora agora em
// `app/globals.css` (`@utility text-display`/`@utility text-titulo`, comentário lá explica o
// porquê), então a prova aqui mede TRÊS pontos reais e independentes — título de tela de
// módulo, saudação do painel e título de um cartão do painel — para que ancorar em um só nunca
// mais esconda uma regressão nos outros.
async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("design system — cor e tipografia computadas no navegador (UI-01, D-09)", () => {
  test("botão 'Entrar' resolve para o terracota do design system", async ({ page }) => {
    await page.goto("/login");

    const botao = page.getByRole("button", { name: "Entrar" });
    const cor = await botao.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Igualdade exata de string — nunca uma comparação frouxa sobre "rgb" solto. É a prova
    // de que #894025 (--color-acento) chegou ao navegador através do mapeamento inteiro:
    // token cru → @theme inline → --color-primary → utilitário do Button.
    expect(cor).toBe("rgb(137, 64, 37)");
  });

  test("o <body> resolve para o fundo areia do design system", async ({ page }) => {
    await page.goto("/login");

    const cor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(cor).toBe("rgb(246, 243, 240)");
  });

  test("papel 'display'/'título' usa Archivo Narrow em três pontos independentes, e o corpo usa Inter", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Ponto 1 — saudação do painel inicial ("Olá, ..."), papel `display`. Rota "/" pós-login,
    // mesmo heading que tests/e2e/fundacao.spec.ts usa para provar o pós-login.
    const familiaSaudacao = await page
      .getByRole("heading", { name: /^Olá, / })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // Ponto 2 — título de um cartão do painel, papel `título`. `CardTitle` (shadcn) é um
    // <div data-slot="card-title">, não um heading — sem papel de acessibilidade próprio —
    // então a busca é pelo texto exato, não por getByRole.
    const familiaCartao = await page
      .getByText("Encomendas por etapa", { exact: true })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // O corpo da própria rota autenticada — mesma fonte em toda a aplicação, então medir
    // aqui é equivalente a medir em /login.
    const familiaCorpo = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

    // Ponto 3 — título de uma tela de módulo (`CabecalhoPagina`, papel `display`).
    await page.goto("/encomendas");
    const familiaTituloModulo = await page
      .getByRole("heading", { name: "Encomendas", level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // Ancorado no início da lista de fontes — não basta "conter" Archivo Narrow em algum
    // lugar da pilha; a família real precisa vir PRIMEIRO (antes do "* Fallback" e de
    // qualquer fonte de sistema). Uma âncora solta passaria mesmo se só a "Archivo Narrow
    // Fallback" sobrevivesse em primeiro lugar — a âncora não deixa.
    expect(familiaSaudacao).toMatch(/^"?Archivo Narrow"?,/);
    expect(familiaCartao).toMatch(/^"?Archivo Narrow"?,/);
    expect(familiaTituloModulo).toMatch(/^"?Archivo Narrow"?,/);
    expect(familiaCorpo).toMatch(/^"?Inter"?,/);
  });

  test("os campos de login têm fonte de pelo menos 16px e altura mínima de 44px (UI-09)", async ({
    page,
  }) => {
    await page.goto("/login");

    for (const rotulo of ["E-mail", "Senha"]) {
      const campo = page.getByLabel(rotulo);
      const tamanhoFonte = await campo.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      );
      const caixa = await campo.boundingBox();

      expect(tamanhoFonte).toBeGreaterThanOrEqual(16);
      expect(caixa?.height).toBeGreaterThanOrEqual(44);
    }

    const botao = page.getByRole("button", { name: "Entrar" });
    const caixaBotao = await botao.boundingBox();
    expect(caixaBotao?.height).toBeGreaterThanOrEqual(44);
  });
});

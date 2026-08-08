import { test, expect } from "@playwright/test";

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

  test("o título 'AMASSA' usa Archivo Narrow, e o corpo usa Inter", async ({ page }) => {
    await page.goto("/login");

    const familiaTitulo = await page
      .getByRole("heading", { name: "AMASSA" })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    const familiaCorpo = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

    // Ancorado no início da lista de fontes — não basta "conter" Archivo Narrow em algum
    // lugar da pilha; a família real precisa vir PRIMEIRO (antes do "* Fallback" e de
    // qualquer fonte de sistema). Uma âncora solta passaria mesmo se só a "Archivo Narrow
    // Fallback" sobrevivesse em primeiro lugar — a âncora não deixa.
    expect(familiaTitulo).toMatch(/^"?Archivo Narrow"?,/);
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

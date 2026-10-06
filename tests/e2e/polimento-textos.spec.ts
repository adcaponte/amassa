import { test, expect, type Page } from "@playwright/test";

// Três textos que o Cowork achou (06.5-13-PLAN.md, D-14, POL-07):
// - o mês por extenso como título é “Outubro de 2026” — o “de” minúsculo, sem CSS que transforme a
//   caixa (achado 21);
// - o placeholder do fornecedor na Despesa é “Escolha ou escreva o nome” e cabe inteiro a 375 px
//   (achado 19);

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

test.describe("polimento textos — mês", () => {
  for (const aba of ["caixa", "mes"] as const) {
    test(`?aba=${aba}: o título do mês é “Outubro de 2026”, sem transformação de caixa`, async ({ page }) => {
      await fazerLogin(page);
      await page.goto(`/gestao/financeiro?aba=${aba}&mes=2026-10`);

      const titulo = page.getByTestId("mes-nav").getByRole("heading", { level: 2 });
      await expect(titulo).toBeVisible();
      await expect(titulo).toHaveText("Outubro de 2026");
      // `toHaveText` lê o texto do DOM; é o CSS que punha “De” na tela. Ele não pode voltar.
      await expect(titulo).toHaveCSS("text-transform", "none");
    });
  }
});

// A largura do texto do placeholder, medida num <span> com a fonte do ::placeholder do campo, contra a
// largura útil do campo (clientWidth menos os paddings). O `scrollWidth` de um <input> vazio não é prova
// sozinho: se o navegador não o fizer refletir o placeholder, ele sai igual ao `clientWidth` e passaria
// sempre. Por isso as duas medidas — e a do texto antigo fica anotada no relatório, para comparar.
async function medirPlaceholder(campo: ReturnType<Page["getByTestId"]>, textoAntigo: string) {
  return campo.evaluate((input: HTMLInputElement, antigo: string) => {
    const estilo = getComputedStyle(input, "::placeholder");
    const doCampo = getComputedStyle(input);
    const larguraDoTexto = (texto: string) => {
      const span = document.createElement("span");
      span.textContent = texto;
      span.style.position = "absolute";
      span.style.visibility = "hidden";
      span.style.whiteSpace = "pre";
      span.style.fontFamily = estilo.fontFamily || doCampo.fontFamily;
      span.style.fontSize = estilo.fontSize || doCampo.fontSize;
      span.style.fontWeight = estilo.fontWeight || doCampo.fontWeight;
      span.style.fontStyle = estilo.fontStyle || doCampo.fontStyle;
      span.style.letterSpacing = estilo.letterSpacing || doCampo.letterSpacing;
      document.body.appendChild(span);
      const largura = span.getBoundingClientRect().width;
      span.remove();
      return largura;
    };
    return {
      scrollWidth: input.scrollWidth,
      clientWidth: input.clientWidth,
      larguraUtil:
        input.clientWidth - parseFloat(doCampo.paddingLeft) - parseFloat(doCampo.paddingRight),
      larguraDoPlaceholder: larguraDoTexto(input.placeholder),
      larguraDoAntigo: larguraDoTexto(antigo),
    };
  }, textoAntigo);
}

test.describe("polimento textos — fornecedor", () => {
  test("a 375 px, o placeholder “Escolha ou escreva o nome” cabe inteiro no campo, nos dois modos da Despesa", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=despesa");

    for (const modo of ["compra", "outra"] as const) {
      await page.getByTestId(`despesa-modo-${modo}`).click();
      const campo = page.getByTestId("despesa-fornecedor-campo");
      await expect(campo).toBeVisible();
      await expect(campo).toHaveValue("");
      await expect(campo).toHaveAttribute("placeholder", "Escolha ou escreva o nome");

      const medida = await medirPlaceholder(campo, "Escolha da lista ou escreva o nome");
      test.info().annotations.push({ type: `medida-${modo}`, description: JSON.stringify(medida) });
      expect(medida.scrollWidth, `scrollWidth do campo (${modo})`).toBeLessThanOrEqual(medida.clientWidth);
      expect(medida.larguraDoPlaceholder, `texto do placeholder contra a largura útil (${modo})`).toBeLessThanOrEqual(
        medida.larguraUtil,
      );
      console.log(`[polimento textos — fornecedor] ${test.info().project.name} ${modo}: ${JSON.stringify(medida)}`);
    }
  });
});

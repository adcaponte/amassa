import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { criarOrcamentoPelaTela } from "./apoio/novo-orcamento";

// Três textos que o Cowork achou (06.5-13-PLAN.md, D-14, POL-07):
// - o mês por extenso como título é “Outubro de 2026” — o “de” minúsculo, sem CSS que transforme a
//   caixa (achado 21);
// - o placeholder do fornecedor na Despesa é “Escolha ou escreva o nome” e cabe inteiro a 375 px
//   (achado 19);
// - no documento do orçamento, “Qtd.” e “Cada” ficam separados — nunca “1R$ 70,00” (achado 23).

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

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Um orçamento de uma linha: a peça exclusiva a R$ 70,00, quantidade 1 (o padrão da linha). O mesmo
// caminho de `orcamentos-pdf.spec.ts`; nomes inventados e únicos — o repositório é público.
async function criarOrcamentoDeUmaLinha(page: Page, nome: string): Promise<string> {
  // Desde o 06.5-14 (D-15) o orçamento nasce no primeiro campo preenchido — um cliente inventado.
  const orcamentoId = await criarOrcamentoPelaTela(page, `[e2e] Cliente da ${nome}`);

  await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  await page.getByRole("link", { name: "+ Peça exclusiva deste pedido" }).click();
  await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
  await page.getByTestId("ficha-campo-nome").fill(nome);
  await page.getByTestId("ficha-campo-argila").fill("450");
  await page.getByTestId("ficha-campo-esmalte").fill("60");
  await page.getByTestId("ficha-campo-horas").fill("0,6");
  await page.getByTestId("ficha-campo-largura").fill("12");
  await page.getByTestId("ficha-campo-profundidade").fill("9");
  await page.getByTestId("ficha-campo-altura").fill("10");
  await page.getByTestId("ficha-campo-embalagem").fill("3");
  await page.getByTestId("ficha-campo-preco-praticado").fill("70");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${orcamentoId}$`), { timeout: 10000 });
  await expect(page.getByTestId("orcamento-linha").filter({ hasText: nome })).toBeVisible();
  return orcamentoId;
}

test.describe("polimento textos — orçamento", () => {
  test("a 375 px, em “Ver como o cliente vê”, a quantidade e o preço de cada ficam separados — nunca “1R$ 70,00”", async ({
    page,
  }) => {
    const nome = `[e2e] Tigela da Clarice Inventada ${sufixoUnico()}`;
    await fazerLogin(page);
    const orcamentoId = await criarOrcamentoDeUmaLinha(page, nome);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await page.getByRole("button", { name: "Ver como o cliente vê" }).click();

    const tabela = page.getByTestId("folha-tabela-peca");
    await expect(tabela).toBeVisible();
    await expect(page.getByTestId("documento-coluna-qtd")).toHaveText("Qtd.");
    const linha = tabela.locator("tbody tr").filter({ hasText: nome });
    await expect(linha).toHaveCount(1);
    const celulaQtd = linha.locator("td").nth(1);
    const celulaCada = linha.locator("td").nth(2);
    await expect(celulaQtd).toHaveText("1");
    await expect(celulaCada).toHaveText("R$ 70,00");

    // As caixas das células: a da quantidade termina antes (ou exatamente onde) começa a do “Cada”.
    const caixaQtd = await medirCaixa(celulaQtd, "célula da quantidade");
    const caixaCada = await medirCaixa(celulaCada, "célula Cada");
    expect(caixaQtd.x + caixaQtd.width).toBeLessThanOrEqual(caixaCada.x + 0.5);

    // E os TEXTOS: do fim do “1” ao começo do “R$”, ao menos 16 px (o px-4 de cada lado dá 32).
    const folga = await linha.evaluate((tr) => {
      const textoDe = (celula: Element) => {
        const intervalo = document.createRange();
        intervalo.selectNodeContents(celula);
        return intervalo.getBoundingClientRect();
      };
      const [, qtd, cada] = Array.from(tr.querySelectorAll("td"));
      return textoDe(cada).left - textoDe(qtd).right;
    });
    expect(folga, "folga entre o texto da quantidade e o do preço de cada").toBeGreaterThanOrEqual(16);

    // O texto como se LÊ (innerText: as células saem separadas). O textContent junta as células sem
    // separador nenhum e teria “1R$” mesmo com as colunas afastadas — não serve de prova.
    await expect(linha).not.toContainText("1R$", { useInnerText: true });
  });
});

import { test, expect, type Page } from "@playwright/test";

import { FRASE_VAZIO_CORPO, FRASE_VAZIO_TITULO, ROTULO_NOVO_ORCAMENTO } from "@/lib/orcamentos/textos";

// O traçador do módulo Orçamentos (04.5-01-PLAN.md, Tarefa 4): schema novo, cálculo puro, aba
// nova dentro do Financeiro, e "Novo orçamento" gravando um rascunho que aparece na lista como
// `nº ORC-2026-001` — de ponta a ponta, num caminho só.
//
// O primeiro teste afirma uma condição GLOBAL do banco ("nenhum orçamento existe") e por isso é
// marcado `@vazio-global`, rodando na cadeia `vazio-celular → vazio-desktop` de
// `playwright.config.ts`, ANTES de qualquer teste que escreva — nunca isolado por `--grep` como
// muleta (mesma disciplina de `tests/e2e/abertura-tracador.spec.ts`).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("orcamentos tracador — traçado do módulo Orçamentos", () => {
  test("com o banco sem nenhum orçamento, a aba mostra o vazio e o botão 'Novo orçamento' — só leitura @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/financeiro?aba=orcamentos");

    await expect(page.getByRole("heading", { name: FRASE_VAZIO_TITULO, level: 2 })).toBeVisible();
    await expect(page.getByText(FRASE_VAZIO_CORPO)).toBeVisible();

    const botao = page
      .getByTestId("orcamentos-lista")
      .getByRole("button", { name: ROTULO_NOVO_ORCAMENTO });
    await expect(botao).toBeVisible();
    // Este caso é SÓ LEITURA — nenhum clique, nenhuma gravação. A criação de verdade é o caso
    // seguinte, fora da cadeia @vazio-global.
  });

  test("'Novo orçamento' leva ao orçamento criado, com um número ORC-AAAA-NNN na lista", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/financeiro?aba=orcamentos");

    const botao = page.getByRole("button", { name: ROTULO_NOVO_ORCAMENTO });
    await expect(botao).toBeVisible();
    await botao.click();

    // Navegação COMPLETA para `/financeiro?aba=orcamentos&orcamento=<id>` (component
    // `NovoOrcamentoBotao`, `window.location.assign`) — a URL final carrega o id do rascunho.
    await expect(page).toHaveURL(/\/financeiro\?aba=orcamentos&orcamento=/, { timeout: 10000 });

    // O número já vem pronto no primeiro carregamento — sem nenhum estado intermediário "sem
    // número ainda" (04.5-UI-SPEC.md, seção "Numeração"). Usa o primeiro da lista (ordenada por
    // ano/sequencial decrescente) porque outro worker (desktop/celular rodando em paralelo)
    // também cria um orçamento ao mesmo tempo — nunca um valor absoluto fixo.
    const numero = page.getByTestId("orcamento-numero").first();
    await expect(numero).toBeVisible();
    await expect(numero).toHaveText(/^nº ORC-\d{4}-\d{3}$/);
  });

  test("a 320px, a aba não rola na horizontal e as sete pílulas do Financeiro estão em duas fileiras", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/financeiro?aba=orcamentos");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/financeiro?aba=orcamentos rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    // A quebra em duas fileiras é determinística (espaçador `basis-full`, não o navegador) — a
    // pílula "Venda" (fileira 1) e a pílula "Orçamentos" (fileira 2) têm posições verticais
    // diferentes em QUALQUER largura de tela, inclusive 320px.
    const caixaVenda = await page.getByTestId("financeiro-aba-venda").boundingBox();
    const caixaOrcamentos = await page.getByTestId("financeiro-aba-orcamentos").boundingBox();
    expect(caixaVenda?.y).not.toBe(caixaOrcamentos?.y);
  });

  test("todo botão visível da aba Orçamentos mede ao menos 44px de altura", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/financeiro?aba=orcamentos");

    // Escopado a <main> — a casca ao redor (avatar/menu do usuário) tem seus próprios botões,
    // que não são o que este critério mede (mesmo padrão de tests/e2e/casca.spec.ts).
    const botoes = page.locator("main").getByRole("button");
    const contagem = await botoes.count();
    expect(contagem).toBeGreaterThan(0);

    for (let indice = 0; indice < contagem; indice += 1) {
      const botao = botoes.nth(indice);
      if (await botao.isVisible()) {
        const caixa = await botao.boundingBox();
        expect(caixa?.height, `botão ${indice} mede menos que 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

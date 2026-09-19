import { test, expect, type Page } from "@playwright/test";

// O traçado ponta a ponta do módulo Financeiro (04.4-01-PLAN.md, Tarefa 1): uma venda de "valor
// livre" lançada à vista em `/financeiro` chega ao extrato e ao saldo do Caixa, sobrevivendo a
// um recarregamento. Nomes inventados e reconhecíveis como tal ("[e2e] ..."), nenhuma afirmação
// GLOBAL do banco (CLAUDE.md: "Teste não pode afirmar condição global do banco sem isolamento") —
// a única condição conferida é a consistência do tile de saldo contra o saldo depois do próprio
// movimento mais recente desenhado na mesma execução, nunca um valor absoluto.

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

test.describe("financeiro tracador — traçado do módulo Financeiro", () => {
  test("uma venda de valor livre lançada à vista chega ao extrato e ao saldo do Caixa", async ({
    page,
  }) => {
    await fazerLogin(page);

    const descricao = nomeUnico("Uso do espaço (oficina fechada)");

    await page.goto("/financeiro");
    await expect(page.getByRole("heading", { name: "Financeiro", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await expect(page.getByRole("heading", { name: "Valor livre" })).toBeVisible();

    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    const linhaDaVenda = page.getByTestId("venda-linha").filter({ hasText: descricao });
    await expect(linhaDaVenda).toBeVisible();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 150,00");

    await page.getByRole("button", { name: "Pix", exact: true }).click();

    const botaoLancar = page.getByRole("button", { name: "Lançar venda" });
    await expect(botaoLancar).toBeEnabled();
    await botaoLancar.click();

    // Navegação completa para `/financeiro?aba=venda&aviso=lancado&documento=<id>` — o aviso é
    // montado pela página a partir do banco. A asserção confere só "aba=venda" (estável), NUNCA
    // o fragmento "&aviso=lancado&documento=": `AvisoFinanceiro` mostra o toast e, no MESMO
    // efeito, já limpa `aviso`/`documento`/`parcela` da URL com `history.replaceState` (por
    // desenho — recarregar não deve repetir o aviso). Sob a suíte inteira (8 workers, servidor
    // único) esse `replaceState` pode disparar antes da primeira checagem do `toHaveURL`,
    // fazendo a asserção testar um estado já limpo e nunca mais bater com o fragmento transiente
    // — achado real (04.4-03, `tests/e2e/financeiro-venda.spec.ts`, diagnosticado com
    // `--trace on`), não flakiness de infraestrutura. "aba=venda" é estável nos dois momentos e
    // só aparece depois da navegação de sucesso (o `goto("/financeiro")" do teste começa sem
    // query string nenhuma).
    await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
    await expect(
      page.getByText(/^Venda nº \d+ lançada · R\$\s150,00$/),
    ).toBeVisible({ timeout: 5000 });

    // Aba Caixa: a linha do extrato com a descrição mostra "+ R$ 150,00" e um saldo depois.
    await page.getByTestId("financeiro-aba-caixa").click();
    await expect(page).toHaveURL(/\?aba=caixa$/);

    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await expect(linhaDoExtrato).toBeVisible();
    await expect(linhaDoExtrato).toContainText("+ R$ 150,00");
    await expect(linhaDoExtrato.getByTestId("extrato-saldo-depois")).toBeVisible();

    // Consistência: o tile "Saldo em caixa" bate com o "saldo depois" do movimento NÃO cancelado
    // mais recente desenhado (mais recente primeiro) — dentro da MESMA renderização, nunca um
    // valor absoluto fixo (outro worker/execução pode ter lançado outra venda ao mesmo tempo).
    const saldoDoTile = (await page.getByTestId("caixa-tile-saldo").innerText()).trim();
    const primeiraLinhaNaoCancelada = page
      .getByTestId("extrato-linha")
      .filter({ hasNotText: "cancelada" })
      .first();
    const saldoDaPrimeiraLinha = (
      await primeiraLinhaNaoCancelada.getByTestId("extrato-saldo-depois").innerText()
    ).trim();
    // "saldo R$ X" → só a parte "R$ X" importa na comparação.
    expect(saldoDoTile).toContain(saldoDaPrimeiraLinha.replace(/^saldo\s*/, ""));

    // Recarregar mantém a linha — nada se perde entre a gravação e a leitura seguinte.
    await page.reload();
    await expect(page.getByTestId("extrato-linha").filter({ hasText: descricao })).toBeVisible();
  });

  // Acessibilidade (UI-06/FNC-17): nenhuma rolagem horizontal a 320px, e o botão principal e o
  // campo de valor medem 44px ou mais.
  test("a 320px de largura, /financeiro não exige rolagem horizontal e os alvos de toque têm 44px", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/financeiro");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/financeiro rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const caixaBotaoLancar = await page.getByRole("button", { name: "Lançar venda" }).boundingBox();
    expect(caixaBotaoLancar?.height).toBeGreaterThanOrEqual(44);

    await page.getByRole("button", { name: "+ Valor livre" }).click();
    const caixaValor = await page.getByLabel("Valor", { exact: true }).boundingBox();
    expect(caixaValor?.height).toBeGreaterThanOrEqual(44);
  });
});

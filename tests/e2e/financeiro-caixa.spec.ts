import { test, expect, type Page } from "@playwright/test";

import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { hojeNoAtelie, semearItem, somarDiasAoHoje } from "./apoio/semear-financeiro";

// O Caixa que age (04.4-08-PLAN.md): as listas "A pagar"/"A receber" com as vencidas marcadas, o
// detalhe do documento e o cancelamento que risca sem apagar (FNC-07, FNC-10). O "Paguei"/
// "Recebi" e o "Desfazer" (D-01/D-02/D-03) ficam no bloco "financeiro caixa pagamento" mais
// abaixo (Tarefa 3).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function irParaCaixa(page: Page) {
  await page.goto("/financeiro?aba=caixa");
}

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

function linhaDoExtrato(page: Page, titulo: string) {
  return page.getByTestId("extrato-linha").filter({ hasText: titulo });
}

async function abrirDetalhePorVer(alvo: ReturnType<typeof cartaoDaConta>) {
  await alvo.getByRole("button", { name: "Ver" }).click();
}

test.describe("financeiro caixa contas", () => {
  test("com o banco vazio, as duas listas mostram o próprio vazio @vazio-global", async ({ page }) => {
    await fazerLogin(page);
    await irParaCaixa(page);

    await expect(page.getByTestId("caixa-a-pagar")).toContainText("Nenhuma conta em aberto.");
    await expect(page.getByTestId("caixa-a-receber")).toContainText("Ninguém deve nada.");
  });

  test("conta vencida cinco dias atrás mostra 'vencida'; vencendo hoje não mostra", async ({ page }) => {
    const suf = sufixoUnico();
    const tituloVencida = `[e2e] Conta vencida ${suf}`;
    const tituloHoje = `[e2e] Conta de hoje ${suf}`;

    await semearContaAPagar({
      titulo: tituloVencida,
      categoria: "Aluguel",
      valorCentavos: 10000,
      vencimento: somarDiasAoHoje(-5),
    });
    await semearContaAPagar({
      titulo: tituloHoje,
      categoria: "Aluguel",
      valorCentavos: 20000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);

    await expect(cartaoDaConta(page, tituloVencida).getByTestId("conta-vencida")).toBeVisible();
    await expect(cartaoDaConta(page, tituloHoje).getByTestId("conta-vencida")).toHaveCount(0);
  });

  test("uma venda 3x lançada pela tela aparece em 'A receber' com '2 de 3' e '3 de 3', nunca '1 de 1'", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeItem = `[e2e] Pacote 3x ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 90000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    // Uma segunda conta, de uma parcela só — prova que "1 de 1" nunca aparece em lugar nenhum.
    const tituloUmaParcela = `[e2e] Conta única ${suf}`;
    await semearContaAPagar({
      titulo: tituloUmaParcela,
      categoria: "Bebidas e comidas",
      valorCentavos: 5000,
      vencimento: hojeNoAtelie(),
      tipo: "venda",
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await page.getByTestId("venda-atalho").filter({ hasText: nomeItem }).click();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 900,00");
    await page.getByTestId("pagamento-plano").selectOption("3");
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });

    await irParaCaixa(page);

    const cartaoConta = cartaoDaConta(page, nomeItem);
    await expect(cartaoConta.filter({ hasText: "2 de 3" })).toBeVisible();
    await expect(cartaoConta.filter({ hasText: "3 de 3" })).toBeVisible();
    await expect(page.getByText("1 de 1")).toHaveCount(0);
    await expect(cartaoDaConta(page, tituloUmaParcela).getByTestId("conta-rotulo")).toHaveCount(0);

    // "Ver" mostra as três parcelas, com "recebida em" só na primeira (já paga no lançamento).
    await abrirDetalhePorVer(cartaoConta.first());
    const parcelasDoDetalhe = page.getByTestId("documento-parcela");
    await expect(parcelasDoDetalhe).toHaveCount(3);
    await expect(parcelasDoDetalhe.nth(0)).toContainText("recebida em");
    await expect(parcelasDoDetalhe.nth(1)).not.toContainText("recebida em");
    await expect(parcelasDoDetalhe.nth(2)).not.toContainText("recebida em");
  });

  test("cancelar a venda de valor livre risca o extrato, tira do saldo, e o detalhe mostra quem cancelou", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Valor livre para cancelar ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aporte dos sócios" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("321");
    await page.getByRole("button", { name: "Pôr na venda" }).click();
    await page.getByRole("button", { name: "Pix", exact: true }).click();
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });

    await irParaCaixa(page);

    const linha = linhaDoExtrato(page, descricao);
    await expect(linha).toBeVisible();
    await linha.getByTestId("extrato-ver").click();

    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    const numeroMatch = /nº (\d+)/.exec(await detalhe.innerText());
    const numero = numeroMatch?.[1] ?? "";

    await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
    const confirmacao = page.getByRole("alertdialog");
    await expect(confirmacao).toContainText(`Cancelar esta venda nº ${numero}`);
    await expect(confirmacao).toContainText("Isso não pode ser desfeito");
    await confirmacao.getByRole("button", { name: "Cancelar venda", exact: true }).click();

    // Sinal REAL de que a resposta do servidor chegou: o TOAST — nunca "?aviso=cancelado" na
    // URL, que `AvisoFinanceiro` limpa com `history.replaceState` no mesmo instante em que mostra
    // o toast (achado real do plano 03, documentado em `financeiro-pagamento.spec.ts`).
    await expect(
      page.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`),
    ).toBeVisible({ timeout: 10000 });

    const linhaCancelada = linhaDoExtrato(page, descricao);
    await expect(linhaCancelada).toContainText("cancelada");
    await expect(linhaCancelada.getByTestId("extrato-saldo-depois")).toHaveCount(0);

    // O tile bate com o "saldo depois" do movimento NÃO cancelado mais recente — nunca com um
    // valor absoluto (o resto da suíte também escreve no Caixa em paralelo).
    const primeiraLinhaComSaldo = page
      .getByTestId("extrato-linha")
      .filter({ hasNotText: "cancelada" })
      .first();
    const saldoDaLinha = await primeiraLinhaComSaldo.getByTestId("extrato-saldo-depois").innerText();
    const saldoDoTile = await page.getByTestId("caixa-tile-saldo").innerText();
    expect(saldoDoTile.replace(/\s/g, "")).toContain(saldoDaLinha.replace(/^saldo\s*/, "").replace(/\s/g, ""));

    await linhaCancelada.getByTestId("extrato-ver").click();
    await expect(page.getByTestId("documento-detalhe")).toContainText("Cancelado por");
    await expect(page.getByTestId("documento-detalhe").getByRole("button", { name: "Cancelar esta venda" })).toHaveCount(0);
  });

  test("cancelar a venda 3x tira as duas parcelas dela de 'A receber'", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeItem = `[e2e] Pacote para cancelar ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 60000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await page.getByTestId("venda-atalho").filter({ hasText: nomeItem }).click();
    await page.getByTestId("pagamento-plano").selectOption("3");
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });

    await irParaCaixa(page);

    const cartaoConta = cartaoDaConta(page, nomeItem).first();
    await abrirDetalhePorVer(cartaoConta);
    const detalhe = page.getByTestId("documento-detalhe");
    const numeroMatch = /nº (\d+)/.exec(await detalhe.innerText());
    const numero = numeroMatch?.[1] ?? "";
    await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar venda", exact: true }).click();
    // Sinal REAL: o toast — nunca "?aviso=cancelado" na URL (limpo por `history.replaceState`
    // no mesmo instante em que o toast aparece).
    await expect(
      page.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`),
    ).toBeVisible({ timeout: 10000 });

    await expect(cartaoDaConta(page, nomeItem)).toHaveCount(0);
  });

  test("cancelar duas vezes: a segunda confirmação recebe 'Esse lançamento já foi cancelado.'", async ({
    page,
    browser,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Conta para cancelar duas vezes ${suf}`;
    await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 7000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);
    await abrirDetalhePorVer(cartaoDaConta(page, titulo));
    await page.getByTestId("documento-detalhe").getByRole("button", { name: "Cancelar esta despesa" }).click();
    // A primeira página ABRE a confirmação, mas ainda NÃO confirma.
    await expect(page.getByRole("alertdialog")).toBeVisible();

    const segundoContexto = await browser.newContext();
    try {
      const segundaPagina = await segundoContexto.newPage();
      await fazerLogin(segundaPagina);
      await irParaCaixa(segundaPagina);
      const cartaoNaSegunda = cartaoDaConta(segundaPagina, titulo);
      await abrirDetalhePorVer(cartaoNaSegunda);
      const detalheNaSegunda = segundaPagina.getByTestId("documento-detalhe");
      const numeroMatch = /nº (\d+)/.exec(await detalheNaSegunda.innerText());
      const numero = numeroMatch?.[1] ?? "";
      await detalheNaSegunda.getByRole("button", { name: "Cancelar esta despesa" }).click();
      await segundaPagina
        .getByRole("alertdialog")
        .getByRole("button", { name: "Cancelar despesa", exact: true })
        .click();
      // A segunda página confirma PRIMEIRO — sinal REAL de que a resposta do servidor chegou é o
      // TOAST, nunca "?aviso=cancelado" na URL (limpo por `history.replaceState` no mesmo
      // instante em que o toast aparece — sem esperar por ele, a primeira página confirmaria
      // antes de a segunda terminar).
      await expect(
        segundaPagina.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await segundoContexto.close();
    }

    // A primeira página, com o diálogo já aberto desde antes, confirma DEPOIS — e recebe a
    // recusa, sem navegar (o erro aparece DENTRO do diálogo, que continua aberto).
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar despesa", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Esse lançamento já foi cancelado.");
    await expect(page).toHaveURL(/\?aba=caixa/);
  });

  test("a 320px, o Caixa não rola na horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await irParaCaixa(page);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Caixa rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

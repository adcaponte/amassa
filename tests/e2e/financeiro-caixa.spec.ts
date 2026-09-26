import { test, expect, type Page } from "@playwright/test";

import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import {
  garantirTaxaDeTeste,
  hojeNoAtelie,
  semearItem,
  somarDiasAoHoje,
  TAXA_DE_TESTE,
} from "./apoio/semear-financeiro";

// O Caixa que age (04.4-08-PLAN.md): as listas "A pagar"/"A receber" com as vencidas marcadas, o
// detalhe do documento e o cancelamento que risca sem apagar (FNC-07, FNC-10). O "Paguei"/
// "Recebi" e o "Desfazer" (D-01/D-02/D-03) ficam no bloco "financeiro caixa pagamento" abaixo
// (Tarefa 3).

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

// Abre "Paguei"/"Recebi" a partir do cartão da conta — o rótulo do botão muda por tipo
// (`rotuloBotaoBaixa`), então casamos por qualquer um dos dois nomes.
async function abrirBaixa(alvo: ReturnType<typeof cartaoDaConta>) {
  await alvo.getByRole("button", { name: /^(Paguei|Recebi)$/ }).click();
}

// Contorna o `max` do `<input type="date">` (o navegador clampa/ignora `.fill()` além do limite)
// escrevendo o valor pelo setter NATIVO do DOM e disparando um evento `input` de verdade — é
// assim que o valor chega ao estado controlado do React mesmo passando por cima da validação do
// próprio campo, provando que a RECUSA de "data futura" é do SERVIDOR, não só da tela.
async function forcarValorDoCampoDeData(page: Page, testId: string, valor: string) {
  await page.getByTestId(testId).evaluate((elemento: HTMLInputElement, novoValor: string) => {
    const definidorNativo = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    definidorNativo.call(elemento, novoValor);
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
  }, valor);
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

test.describe("financeiro caixa pagamento", () => {
  test("exemplo 3 — Financiamento, parcela 26 de 60: paga integralmente, some de 'A pagar'", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Financiamento ${suf}`;
    await semearContaAPagar({
      titulo,
      pessoa: "Banco Exemplo",
      categoria: "Financiamento (parcela)",
      valorCentavos: 148000,
      vencimento: hojeNoAtelie(),
      rotulo: "parcela 26 de 60",
    });

    await fazerLogin(page);
    await irParaCaixa(page);

    const cartao = cartaoDaConta(page, titulo);
    await expect(cartao.getByTestId("conta-rotulo")).toContainText("parcela 26 de 60");

    await abrirBaixa(cartao);
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(page.getByText("Pago: R$ 1.480,00")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("viraram uma linha de diferença")).toHaveCount(0);
    await expect(cartaoDaConta(page, titulo)).toHaveCount(0);
    await expect(linhaDoExtrato(page, titulo)).toContainText("− R$ 1.480,00");
  });

  test("linha única ajustada: paga com valor diferente, sem diferença, e 'Desfazer' devolve o valor previsto", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Conta linha única ${suf}`;
    await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 148000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);

    await abrirBaixa(cartaoDaConta(page, titulo));
    await page.getByTestId("baixa-valor").fill("1500,00");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(page.getByText("Pago: R$ 1.500,00")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("viraram uma linha de diferença")).toHaveCount(0);

    // O detalhe mostra a linha ÚNICA ajustada para R$ 1.500,00 — nenhuma linha de diferença.
    await linhaDoExtrato(page, titulo).getByTestId("extrato-ver").click();
    const linhasDoDetalhe = page.getByTestId("documento-linha");
    await expect(linhasDoDetalhe).toHaveCount(1);
    await expect(linhasDoDetalhe.first()).toContainText("R$ 1.500,00");
    await expect(page.getByTestId("documento-detalhe")).not.toContainText("Diferença");
    await page.getByTestId("documento-detalhe").getByRole("button", { name: "Fechar" }).click();

    // "Desfazer" (dentro dos 7 segundos) devolve a conta a R$ 1.480,00, em aberto.
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(
      page.getByText("Desfeito. A conta voltou a R$ 1.480,00 em aberto."),
    ).toBeVisible({ timeout: 10000 });
    await expect(cartaoDaConta(page, titulo)).toContainText("R$ 1.480,00");
  });

  test("no celular, o aviso do 'Desfazer' fica inteiro acima da barra inferior e o botão é clicável", async ({
    page,
  }) => {
    // 360×740 ANTES do login: é a LARGURA REAL (nunca `project.name`) que decide se a barra
    // inferior aparece — mesma convenção de `acessibilidade.spec.ts` (localizarGatilhoDoMenu).
    // 360px também prova a faixa 601–767px que o plano registra: o sonner já pensa que está no
    // celular (`max-width: 600px` da própria biblioteca), mas a barra só some no breakpoint `md`
    // do Tailwind (768px) — os dois projetos do Playwright (desktop e celular) exercitam a MESMA
    // geometria aqui, porque os dois recebem este viewport forçado.
    await page.setViewportSize({ width: 360, height: 740 });

    const suf = sufixoUnico();
    const titulo = `[e2e] Conta para o aviso acima da barra ${suf}`;
    await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 148000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);

    // Valor DIFERENTE do previsto é o único caminho que produz o aviso com "Desfazer" (D-03).
    await abrirBaixa(cartaoDaConta(page, titulo));
    await page.getByTestId("baixa-valor").fill("1500,00");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    // Seletor ESTÁVEL do item de aviso do sonner (`data-sonner-toast`) — nunca o rótulo acessível
    // do contêiner, que é só o nome do grupo, não do item.
    const aviso = page.locator("[data-sonner-toast]").filter({ hasText: "Pago: R$ 1.500,00" });
    await expect(aviso).toBeVisible({ timeout: 10000 });

    const barra = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(barra).toBeVisible();

    const botaoDesfazer = aviso.getByRole("button", { name: "Desfazer" });
    await expect(botaoDesfazer).toBeVisible();

    const caixaAviso = await aviso.boundingBox();
    const caixaBarra = await barra.boundingBox();
    const caixaBotao = await botaoDesfazer.boundingBox();
    if (!caixaAviso || !caixaBarra || !caixaBotao) {
      throw new Error(
        "Geometria do aviso, da barra ou do botão 'Desfazer' não pôde ser lida (bounding box nula).",
      );
    }

    const fundoDoAviso = caixaAviso.y + caixaAviso.height;
    expect(
      fundoDoAviso,
      `o fundo do aviso (${fundoDoAviso}) passa do topo da barra (${caixaBarra.y})`,
    ).toBeLessThanOrEqual(caixaBarra.y);

    const respiroDoBotao = caixaBarra.y - (caixaBotao.y + caixaBotao.height);
    expect(
      respiroDoBotao,
      `sobram só ${respiroDoBotao}px entre o botão "Desfazer" e a barra (esperado ao menos 8px)`,
    ).toBeGreaterThanOrEqual(8);

    // O clique REAL do Playwright (sem `force`) confere o alvo de verdade — falha se algo
    // estiver por cima do botão, o que é metade da prova de que o "Desfazer" está alcançável.
    await botaoDesfazer.click();
    await expect(
      page.getByText("Desfeito. A conta voltou a R$ 1.480,00 em aberto."),
    ).toBeVisible({ timeout: 10000 });
    await expect(cartaoDaConta(page, titulo)).toContainText("R$ 1.480,00");
  });

  test("exemplo 5 — Esmalte (pote) em 3x: diferença no pagamento, 'Desfazer' e nova diferença negativa", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeEsmalte = `[e2e] Esmalte pagamento ${suf}`;
    await semearItem({
      nome: nomeEsmalte,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Argila, esmalte e insumos",
      atalhoCompra: true,
    });

    await fazerLogin(page);
    await page.goto("/financeiro?aba=despesa");
    await page.getByTestId("despesa-modo-compra").click();
    await page.getByTestId("compra-busca").fill(suf);
    await page.getByTestId("compra-atalho").filter({ hasText: nomeEsmalte }).click();
    await page.getByTestId("compra-quantos").fill("100");
    await page.getByTestId("compra-custou").fill("2400");
    await page.getByTestId("pagamento-plano").selectOption("3");
    await page.getByRole("button", { name: "Lançar despesa" }).click();
    // Sinal REAL de que o lançamento terminou é o TOAST — a página já estava em "?aba=despesa"
    // antes de lançar, então essa fração da URL sozinha não prova nada (mesmo cuidado documentado
    // em `financeiro-despesa.spec.ts`).
    await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s2\.400,00/)).toBeVisible({
      timeout: 10000,
    });

    await irParaCaixa(page);

    const parcela2 = cartaoDaConta(page, nomeEsmalte).filter({ hasText: "2 de 3" });
    const parcela3 = cartaoDaConta(page, nomeEsmalte).filter({ hasText: "3 de 3" });
    await expect(parcela2).toBeVisible();
    await expect(parcela3).toBeVisible();

    // Paga a parcela 2 (R$ 800,00 previstos) com R$ 812,00 — diferença de +R$ 12,00.
    await abrirBaixa(parcela2);
    await page.getByTestId("baixa-valor").fill("812,00");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(
      page.getByText("Pago: R$ 812,00. R$ 12,00 a mais viraram uma linha de diferença."),
    ).toBeVisible({ timeout: 10000 });

    await linhaDoExtrato(page, nomeEsmalte).first().getByTestId("extrato-ver").click();
    const linhaDeDiferenca = page
      .getByTestId("documento-linha")
      .filter({ hasText: "Diferença no pagamento da parcela 2 de 3" });
    await expect(linhaDeDiferenca).toBeVisible();
    await expect(linhaDeDiferenca).toContainText("Juros, multas e descontos");
    await expect(linhaDeDiferenca).toContainText("R$ 12,00");
    await page.getByTestId("documento-detalhe").getByRole("button", { name: "Fechar" }).click();

    // "Desfazer" (dentro dos 7 segundos): a parcela volta a R$ 800,00, e a linha de diferença some.
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(
      page.getByText("Desfeito. A conta voltou a R$ 800,00 em aberto."),
    ).toBeVisible({ timeout: 10000 });
    await expect(cartaoDaConta(page, nomeEsmalte).filter({ hasText: "2 de 3" })).toContainText(
      "R$ 800,00",
    );

    await linhaDoExtrato(page, nomeEsmalte).first().getByTestId("extrato-ver").click();
    await expect(page.getByTestId("documento-detalhe")).not.toContainText("Diferença");
    await page.getByTestId("documento-detalhe").getByRole("button", { name: "Fechar" }).click();

    // Paga de novo, agora com R$ 790,00 — diferença de −R$ 10,00.
    await abrirBaixa(cartaoDaConta(page, nomeEsmalte).filter({ hasText: "2 de 3" }));
    await page.getByTestId("baixa-valor").fill("790,00");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(
      page.getByText("Pago: R$ 790,00. R$ 10,00 a menos viraram uma linha de diferença."),
    ).toBeVisible({ timeout: 10000 });

    await linhaDoExtrato(page, nomeEsmalte).first().getByTestId("extrato-ver").click();
    const linhaDeDiferencaNegativa = page
      .getByTestId("documento-linha")
      .filter({ hasText: "Diferença no pagamento da parcela 2 de 3" });
    await expect(linhaDeDiferencaNegativa).toContainText("-R$ 10,00");
  });

  test("recebida no cartão: a taxa congelada aparece na linha do extrato", async ({ page }) => {
    await garantirTaxaDeTeste();

    const suf = sufixoUnico();
    const nomeItem = `[e2e] Pacote cartão ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 90000,
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

    const parcela2 = cartaoDaConta(page, nomeItem).filter({ hasText: "2 de 3" });
    await abrirBaixa(parcela2);
    await page.getByTestId("baixa-forma").getByRole("button", { name: "Cartão", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(page.getByText("Recebido: R$ 300,00")).toBeVisible({ timeout: 10000 });

    const taxaCentavos = Math.round((30000 * TAXA_DE_TESTE) / 10000);
    const taxaFormatada = (taxaCentavos / 100).toFixed(2).replace(".", ",");
    await expect(linhaDoExtrato(page, nomeItem).filter({ hasText: "2 de 3" })).toContainText(
      `taxa R$ ${taxaFormatada}`,
    );
  });

  test("duas pessoas pagando a mesma conta: a segunda vê a recusa exata", async ({ page, browser }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Duas pessoas pagando ${suf}`;
    await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 9000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);
    await abrirBaixa(cartaoDaConta(page, titulo));
    // Ainda NÃO confirma.

    const segundoContexto = await browser.newContext();
    try {
      const segundaPagina = await segundoContexto.newPage();
      await fazerLogin(segundaPagina);
      await irParaCaixa(segundaPagina);
      await abrirBaixa(cartaoDaConta(segundaPagina, titulo));
      await segundaPagina.getByRole("button", { name: "Confirmar", exact: true }).click();
      // A segunda página confirma PRIMEIRO e paga de verdade — sinal real é o toast.
      await expect(segundaPagina.getByText("Pago: R$ 90,00")).toBeVisible({ timeout: 10000 });
    } finally {
      await segundoContexto.close();
    }

    // A primeira página, com o diálogo já aberto desde antes, confirma DEPOIS — recusada com a
    // frase exata, mostrada DENTRO do diálogo (que continua aberto).
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Essa conta já foi paga — recarregue a página para ver como ela está.",
    );
  });

  test("pagar conta cancelada por outra página recebe a frase do cancelado", async ({ page, browser }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Pagar conta cancelada por outra ${suf}`;
    await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 6000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);
    await abrirBaixa(cartaoDaConta(page, titulo));
    // Ainda NÃO confirma o pagamento.

    const segundoContexto = await browser.newContext();
    try {
      const segundaPagina = await segundoContexto.newPage();
      await fazerLogin(segundaPagina);
      await irParaCaixa(segundaPagina);
      await abrirDetalhePorVer(cartaoDaConta(segundaPagina, titulo));
      const detalhe = segundaPagina.getByTestId("documento-detalhe");
      const numeroMatch = /nº (\d+)/.exec(await detalhe.innerText());
      const numero = numeroMatch?.[1] ?? "";
      await detalhe.getByRole("button", { name: "Cancelar esta despesa" }).click();
      await segundaPagina
        .getByRole("alertdialog")
        .getByRole("button", { name: "Cancelar despesa", exact: true })
        .click();
      await expect(
        segundaPagina.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await segundoContexto.close();
    }

    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Esse lançamento foi cancelado — ele não recebe mais pagamento.",
    );
  });

  test("data futura: o campo não aceita amanhã, e o servidor recusa se forçado", async ({ page }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Data futura ${suf}`;
    await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 5000,
      vencimento: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await irParaCaixa(page);
    await abrirBaixa(cartaoDaConta(page, titulo));

    await expect(page.getByTestId("baixa-data")).toHaveAttribute("max", hojeNoAtelie());

    await forcarValorDoCampoDeData(page, "baixa-data", somarDiasAoHoje(1));
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "A data do pagamento não pode ser depois de hoje.",
    );
  });
});

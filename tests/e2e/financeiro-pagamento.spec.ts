import { test, expect, type Page } from "@playwright/test";

import { formatarDataCurta } from "@/lib/financeiro/formato";

import {
  garantirTaxaDeTeste,
  hojeNoAtelie,
  semearItem,
  somarDiasAoHoje,
  TAXA_DE_TESTE,
} from "./apoio/semear-financeiro";

// O pagamento da Venda E da Despesa (04.4-06-PLAN.md, 04.4-12-PLAN.md): à vista, sinal de 50% +
// saldo, 2x a 12x, pagamento misto com "+ outra forma" (D-07/D-08), o cartão com a taxa congelada
// na parcela — os exemplos 4 e 8 do protótipo, o exemplo do dono (R$ 100 Pix + R$ 50 dinheiro), o
// contorno do cliente — e, desde o 04.4-12, o à vista que pode nascer EM ABERTO (a caixinha "já
// recebi/já paguei"), na Venda e na Despesa "outra despesa" (o mesmo `BlocoPagamento`). Cada caso
// semeia os próprios itens com sufixo único e usa a BUSCA para achá-los.

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

async function buscarNaVenda(page: Page, texto: string) {
  await page.getByTestId("venda-busca").fill(texto);
}

function atalho(page: Page, nome: string) {
  return page.getByTestId("venda-atalho").filter({ hasText: nome });
}

// Confere que "Lançar venda" navegou de verdade — só o fragmento ESTÁVEL "aba=venda" (nunca
// "&aviso=lancado&documento=", que `AvisoFinanceiro` limpa da URL no mesmo instante em que mostra
// o toast — achado real do plano 04.4-03, ver `financeiro-venda.spec.ts`).
async function esperarVendaLancada(page: Page) {
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

function linhaDePagamento(page: Page, indice: number) {
  return page.getByTestId("parcela-linha").nth(indice);
}

function valorDaParcela(page: Page, indice: number) {
  return linhaDePagamento(page, indice).locator('input[inputmode="decimal"]');
}

function jaMarcadaDaParcela(page: Page, indice: number) {
  return linhaDePagamento(page, indice).locator('input[type="checkbox"]');
}

// A ZONA de toque de 44×44 é o `<span data-testid="parcela-paga">` que envolve o `<input
// type="checkbox">` nativo (mesma disciplina de `marcar-cotacao.tsx`, 04.3-04) — medir o input em
// si mediria só o glifo visual de 20px, não o alvo real.
function zonaDeToqueDaParcela(page: Page, indice: number) {
  return linhaDePagamento(page, indice).getByTestId("parcela-paga");
}

function formaDoPlano(page: Page) {
  return page.getByTestId("pagamento-forma");
}

const botaoLancar = (page: Page) => page.getByRole("button", { name: "Lançar venda" });
const botaoLancarDespesa = (page: Page) => page.getByRole("button", { name: "Lançar despesa" });

// A caixinha "Já recebi"/"Já paguei" do à vista de uma parcela só (04.4-12-PLAN.md) — a zona de
// toque de 44×44 é o `<span data-testid="pagamento-ja-pago">` que envolve o `<input
// type="checkbox">` nativo, mesma disciplina de `jaMarcadaDaParcela`/`zonaDeToqueDaParcela` acima.
function caixinhaJaPago(page: Page) {
  return page.getByTestId("pagamento-ja-pago").locator('input[type="checkbox"]');
}

function campoVenceEm(page: Page) {
  return page.getByTestId("pagamento-vence-em");
}

function dicaAvistaAberto(page: Page) {
  return page.getByTestId("pagamento-dica-aberto");
}

async function irParaCaixa(page: Page) {
  await page.goto("/financeiro?aba=caixa");
}

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

// Abre "Paguei"/"Recebi" a partir do cartão da conta (mesmo auxiliar de `financeiro-caixa.spec.ts`).
async function abrirBaixa(alvo: ReturnType<typeof cartaoDaConta>) {
  await alvo.getByRole("button", { name: /^(Paguei|Recebi)$/ }).click();
}

test.describe("financeiro pagamento", () => {
  test("exemplo 8 — Pacote trimestral R$ 900 em 3x: a primeira parcela paga, duas em aberto", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomePacote = `[e2e] Pacote trimestral ${suf}`;
    await semearItem({
      nome: nomePacote,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 90000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomePacote).click();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 900,00");

    await page.getByTestId("pagamento-plano").selectOption("3");

    await expect(page.getByTestId("parcela-linha")).toHaveCount(3);
    await expect(valorDaParcela(page, 0)).toHaveValue("300,00");
    await expect(valorDaParcela(page, 1)).toHaveValue("300,00");
    await expect(valorDaParcela(page, 2)).toHaveValue("300,00");
    await expect(jaMarcadaDaParcela(page, 0)).toBeChecked();
    await expect(jaMarcadaDaParcela(page, 1)).not.toBeChecked();

    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarVendaLancada(page);

    await expect(page.getByText(/· 2 parcelas em aberto no Caixa$/)).toBeVisible({ timeout: 5000 });

    await page.getByTestId("financeiro-aba-caixa").click();
    await expect(page).toHaveURL(/\?aba=caixa$/);

    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nomePacote });
    await expect(linhaDoExtrato).toBeVisible();
    await expect(linhaDoExtrato).toContainText("+ R$ 300,00");
    await expect(linhaDoExtrato.getByTestId("extrato-parcela")).toContainText("1 de 3");
  });

  test("sinal de 50% + saldo: R$ 150,01 vira R$ 75,01 pago hoje + R$ 75,00 em aberto em 30 dias", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeItem = `[e2e] Sinal e saldo ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 15001,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeItem).click();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 150,01");

    await page.getByTestId("pagamento-plano").selectOption("sinal");

    await expect(page.getByTestId("parcela-linha")).toHaveCount(2);
    await expect(valorDaParcela(page, 0)).toHaveValue("75,01");
    await expect(valorDaParcela(page, 1)).toHaveValue("75,00");
    await expect(jaMarcadaDaParcela(page, 0)).toBeChecked();
    await expect(jaMarcadaDaParcela(page, 1)).not.toBeChecked();

    await expect(botaoLancar(page)).toBeEnabled();
  });

  test("exemplo 4 no cartão: o aviso mostra 3,5% (R$ 3,47), entram R$ 95,53, e o extrato mostra a taxa", async ({
    page,
  }) => {
    await garantirTaxaDeTeste();
    const suf = sufixoUnico();
    const nomePapel = `[e2e] Bloco de papel ${suf}`;
    const nomePincel = `[e2e] Pincel nº 8 ${suf}`;
    const nomeTinta = `[e2e] Tinta amarela ${suf}`;
    await semearItem({
      nome: nomePapel,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 5800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Mercadoria para revenda",
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomePincel,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 2200,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Mercadoria para revenda",
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeTinta,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 1900,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Mercadoria para revenda",
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomePapel).click();
    await atalho(page, nomePincel).click();
    await atalho(page, nomeTinta).click();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 99,00");

    await formaDoPlano(page).getByRole("button", { name: "Cartão", exact: true }).click();

    await expect(page.getByTestId("pagamento-aviso-cartao")).toContainText("3,5%");
    await expect(page.getByTestId("pagamento-aviso-cartao")).toContainText("R$ 3,47");
    await expect(page.getByTestId("pagamento-aviso-cartao")).toContainText("Entram R$ 95,53");

    await botaoLancar(page).click();
    await esperarVendaLancada(page);

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nomePapel });
    await expect(linhaDoExtrato).toContainText("+ R$ 95,53");
    await expect(linhaDoExtrato.getByTestId("extrato-taxa")).toContainText("R$ 3,47");
  });

  test("pagamento misto (o exemplo do dono): R$ 100,00 no Pix + R$ 50,00 em dinheiro", async ({ page }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Valor livre misto ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await expect(page.getByTestId("venda-total")).toContainText("R$ 150,00");

    await page.getByTestId("pagamento-outra-forma").click();
    await expect(page.getByTestId("parcela-linha")).toHaveCount(2);

    await linhaDePagamento(page, 0).getByRole("button", { name: "Pix", exact: true }).click();
    await valorDaParcela(page, 0).fill("100,00");
    await linhaDePagamento(page, 1).getByRole("button", { name: "Dinheiro", exact: true }).click();
    await valorDaParcela(page, 1).fill("50,00");

    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarVendaLancada(page);

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhasDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await expect(linhasDoExtrato).toHaveCount(2);
    await expect(linhasDoExtrato.filter({ hasText: "Pix" })).toContainText("+ R$ 100,00");
    await expect(linhasDoExtrato.filter({ hasText: "Dinheiro" })).toContainText("+ R$ 50,00");
  });

  test("misto no cartão: R$ 100 no cartão + R$ 50 em dinheiro — a taxa incide só na parcela do cartão", async ({
    page,
  }) => {
    await garantirTaxaDeTeste();
    const suf = sufixoUnico();
    const descricao = `[e2e] Valor livre misto cartão ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await page.getByTestId("pagamento-outra-forma").click();
    await linhaDePagamento(page, 0).getByRole("button", { name: "Cartão", exact: true }).click();
    await valorDaParcela(page, 0).fill("100,00");
    await linhaDePagamento(page, 1).getByRole("button", { name: "Dinheiro", exact: true }).click();
    await valorDaParcela(page, 1).fill("50,00");

    await expect(page.getByTestId("pagamento-aviso-cartao")).toContainText("R$ 3,50");
    await expect(page.getByTestId("pagamento-aviso-cartao")).toContainText(`${TAXA_DE_TESTE / 100}%`.replace(".", ","));
  });

  test("falta/sobra: mudar a segunda parcela de um 3x mostra a frase e desabilita o botão", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeItem = `[e2e] Falta sobra ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 30000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeItem).click();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 300,00");

    await page.getByTestId("pagamento-plano").selectOption("3");
    await expect(page.getByTestId("parcela-linha")).toHaveCount(3);
    // 3x de R$ 300,00 → R$ 100,00 cada. Subir a segunda para R$ 150,00 faz a soma passar do
    // total em exatamente R$ 50,00 — "Sobram", não "Faltam".
    await valorDaParcela(page, 1).fill("150,00");

    await expect(page.getByTestId("pagamento-falta")).toContainText(
      "Sobram R$ 50,00 para fechar com o total.",
    );
    await expect(botaoLancar(page)).toBeDisabled();

    // Contorno do cliente: tira o `disabled` na marra e clica — a frase do SERVIDOR aparece
    // (mesma função `conferirParcelas`, chamada de novo em `lancarVenda`), a URL não ganha
    // `aviso=` e nada foi lançado.
    await page.evaluate(() => {
      const botao = [...document.querySelectorAll("button")].find(
        (elemento) => elemento.textContent?.trim() === "Lançar venda",
      );
      botao?.removeAttribute("disabled");
    });
    await botaoLancar(page).click();

    await expect(page.getByTestId("pagamento-falta")).toContainText(
      "Sobram R$ 50,00 para fechar com o total.",
    );
    await expect(page).not.toHaveURL(/aviso=/);
  });

  test("parcela marcada como paga não pode vencer depois de hoje", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeItem = `[e2e] Paga no futuro ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 30000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeItem).click();

    await page.getByTestId("pagamento-plano").selectOption("3");
    await expect(page.getByTestId("parcela-linha")).toHaveCount(3);

    await jaMarcadaDaParcela(page, 2).check();

    await expect(page.getByTestId("pagamento-falta")).toContainText(
      "Uma parcela que vence depois de hoje não pode estar paga",
    );
    await expect(botaoLancar(page)).toBeDisabled();
  });

  test("a 320px, com 12x, a página não rola na horizontal e a caixa 'já recebi' tem 44px de zona de toque", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeItem = `[e2e] Doze vezes ${suf}`;
    await semearItem({
      nome: nomeItem,
      categoriaVenda: "Aulas e oficinas",
      precoCentavos: 120000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/financeiro");
    await buscarNaVenda(page, suf);
    await atalho(page, nomeItem).click();

    await page.getByTestId("pagamento-plano").selectOption("12");
    await expect(page.getByTestId("parcela-linha")).toHaveCount(12);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Venda com 12x rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const zonaDeToque = await zonaDeToqueDaParcela(page, 1).boundingBox();
    expect(zonaDeToque?.width).toBeGreaterThanOrEqual(44);
    expect(zonaDeToque?.height).toBeGreaterThanOrEqual(44);
  });

  // Os quatro casos novos do 04.4-12-PLAN.md: o à vista que pode nascer EM ABERTO (resposta do
  // dono de 20/09/2026) — a caixinha "já recebi/já paguei" desmarcada vira uma conta no Caixa, sem
  // remarcar sozinha quando o carrinho muda, e a taxa do cartão só congela quando o dinheiro entra.

  test("venda à vista em aberto — a caixinha desmarcada vira uma conta a receber, e mudar o carrinho não a remarca", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Venda avista aberta ${suf}`;
    const descricaoExtra = `[e2e] Venda avista aberta extra ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await expect(page.getByTestId("venda-total")).toContainText("R$ 150,00");
    await expect(caixinhaJaPago(page)).toBeChecked();
    await expect(page.getByTestId("parcela-linha")).toHaveCount(0);

    await caixinhaJaPago(page).uncheck();
    await expect(campoVenceEm(page)).toHaveValue(hojeNoAtelie());
    await expect(dicaAvistaAberto(page)).toContainText('Fica em "A receber" no Caixa');

    const vencimentoEscolhido = somarDiasAoHoje(10);
    await campoVenceEm(page).fill(vencimentoEscolhido);

    // Acrescenta uma SEGUNDA linha de valor livre — mudar o carrinho regenera as parcelas, mas a
    // intenção do dono (desmarcada) e a data digitada sobrevivem (04.4-12-PLAN.md, key_links).
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricaoExtra);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await expect(caixinhaJaPago(page)).not.toBeChecked();
    await expect(campoVenceEm(page)).toHaveValue(vencimentoEscolhido);

    // Tira a segunda linha de volta.
    await page
      .getByTestId("venda-linha")
      .filter({ hasText: descricaoExtra })
      .getByRole("button", { name: "tirar" })
      .click();
    await expect(page.getByTestId("venda-total")).toContainText("R$ 150,00");

    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarVendaLancada(page);

    await expect(page.getByText(/· 1 parcela em aberto no Caixa$/)).toBeVisible({ timeout: 5000 });

    await irParaCaixa(page);
    const cartao = page.getByTestId("caixa-a-receber").getByTestId("conta-cartao").filter({ hasText: descricao });
    await expect(cartao).toHaveCount(1);
    await expect(cartao).toContainText(formatarDataCurta(vencimentoEscolhido));

    await abrirBaixa(cartao);
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Recebido: R$ 150,00")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("viraram uma linha de diferença")).toHaveCount(0);
    await expect(cartaoDaConta(page, descricao)).toHaveCount(0);
  });

  test("'+ outra forma' com uma parte já recebida e a outra a receber (D-08)", async ({ page }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Outra forma parcial ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await page.getByTestId("pagamento-outra-forma").click();
    await expect(page.getByTestId("parcela-linha")).toHaveCount(2);
    // As duas linhas nascem com a PRÓPRIA caixa de marcação, herdada do estado do à vista (marcada).
    await expect(jaMarcadaDaParcela(page, 0)).toBeChecked();
    await expect(jaMarcadaDaParcela(page, 1)).toBeChecked();

    await linhaDePagamento(page, 0).getByRole("button", { name: "Pix", exact: true }).click();
    await valorDaParcela(page, 0).fill("75,00");
    await linhaDePagamento(page, 1).getByRole("button", { name: "Dinheiro", exact: true }).click();
    await valorDaParcela(page, 1).fill("75,00");

    await jaMarcadaDaParcela(page, 1).uncheck();
    const vencimentoSegunda = somarDiasAoHoje(10);
    await linhaDePagamento(page, 1).locator('input[type="date"]').fill(vencimentoSegunda);

    await expect(botaoLancar(page)).toBeEnabled();
    await botaoLancar(page).click();
    await esperarVendaLancada(page);

    await expect(page.getByText(/· 1 parcela em aberto no Caixa$/)).toBeVisible({ timeout: 5000 });

    await page.getByTestId("financeiro-aba-caixa").click();
    const linhasDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await expect(linhasDoExtrato).toHaveCount(1);
    await expect(linhasDoExtrato).toContainText("+ R$ 75,00");

    const contaAReceber = page.getByTestId("caixa-a-receber").getByTestId("conta-cartao").filter({ hasText: descricao });
    await expect(contaAReceber).toHaveCount(1);
    await expect(contaAReceber).toContainText("R$ 75,00");
  });

  test("cartão à vista em aberto: a taxa só congela quando o dinheiro entra (FNC-05)", async ({ page }) => {
    await garantirTaxaDeTeste();
    const suf = sufixoUnico();
    const descricao = `[e2e] Cartao avista aberto ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Uso do espaço" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Pôr na venda" }).click();

    await formaDoPlano(page).getByRole("button", { name: "Cartão", exact: true }).click();
    await caixinhaJaPago(page).uncheck();

    await botaoLancar(page).click();
    await esperarVendaLancada(page);

    await irParaCaixa(page);
    const cartao = page.getByTestId("caixa-a-receber").getByTestId("conta-cartao").filter({ hasText: descricao });
    await expect(cartao).toContainText("R$ 100,00");

    await abrirBaixa(cartao);
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Recebido: R$ 100,00")).toBeVisible({ timeout: 10000 });

    const linhaDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await expect(linhaDoExtrato).toContainText("+ R$ 96,50");
    await expect(linhaDoExtrato.getByTestId("extrato-taxa")).toContainText("R$ 3,50");
  });

  test("despesa à vista em aberto — a conta que vence dia 30, paga depois com valor diferente", async ({ page }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Despesa avista aberta ${suf}`;

    await fazerLogin(page);
    await page.goto("/financeiro?aba=despesa");
    await page.getByTestId("despesa-modo-outra").click();

    await page.getByLabel("Descrição").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Ferramentas e utensílios" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("185");

    await expect(page.getByText("Já paguei", { exact: true })).toBeVisible();
    await expect(caixinhaJaPago(page)).toBeChecked();

    await caixinhaJaPago(page).uncheck();
    const vencimentoEscolhido = somarDiasAoHoje(10);
    await campoVenceEm(page).fill(vencimentoEscolhido);
    await expect(dicaAvistaAberto(page)).toContainText('Fica em "A pagar" no Caixa');

    await expect(page.getByTestId("despesa-total")).toContainText("R$ 185,00");
    await expect(botaoLancarDespesa(page)).toBeEnabled();
    await botaoLancarDespesa(page).click();
    await expect(page).toHaveURL(/\?aba=despesa/, { timeout: 10000 });
    await expect(page.getByText(/· 1 parcela em aberto no Caixa$/)).toBeVisible({ timeout: 5000 });

    await irParaCaixa(page);
    const cartao = page.getByTestId("caixa-a-pagar").getByTestId("conta-cartao").filter({ hasText: descricao });
    await expect(cartao).toHaveCount(1);

    await abrirBaixa(cartao);
    await page.getByTestId("baixa-valor").fill("190,00");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Pago: R$ 190,00")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("viraram uma linha de diferença")).toHaveCount(0);

    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByText("Desfeito. A conta voltou a R$ 185,00 em aberto.")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByTestId("caixa-a-pagar").getByTestId("conta-cartao").filter({ hasText: descricao }),
    ).toContainText("R$ 185,00");
  });
});

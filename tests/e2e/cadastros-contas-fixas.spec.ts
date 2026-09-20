import { test, expect, type Page } from "@playwright/test";

import { mesDaGeracao, tituloDaContaFixa } from "@/lib/cadastros/contas-fixas";
import { nomeDoMes } from "@/lib/financeiro/formato";

import { hojeNoAtelie } from "./apoio/semear-financeiro";

// Contas fixas com CRUD completo (04.4-10-PLAN.md, D-13): criar, ajustar o valor esperado na
// própria linha, desativar/reativar, e "Gerar as contas de {mês}" que nunca duplica (critério 6
// do ROADMAP) — provado com o exemplo 1 de despesa do protótipo (aluguel).

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

async function irParaContasFixas(page: Page) {
  await page.goto("/cadastros?sub=fixas");
}

// A tabela de contas fixas é GLOBAL e compartilhada — o botão "+ Nova conta fixa" existe em DOIS
// lugares (o rodapé da lista populada, ou dentro do estado vazio), dependendo de outro worker já
// ter criado alguma conta fixa ou não. Mesmo padrão de `abrirNovoItem`
// (tests/e2e/cadastros-catalogo.spec.ts): espera por QUALQUER um dos dois e clica no que apareceu.
async function abrirNovaContaFixa(page: Page) {
  const botaoPopulado = page.getByTestId("nova-conta-fixa");
  const botaoVazio = page
    .getByTestId("cadastros-vazio-fixas")
    .getByRole("button", { name: "+ Nova conta fixa" });
  await Promise.race([
    botaoPopulado.waitFor({ state: "visible" }),
    botaoVazio.waitFor({ state: "visible" }),
  ]);
  if (await botaoPopulado.isVisible()) {
    await botaoPopulado.click();
  } else {
    await botaoVazio.click();
  }
}

// A linha pelo NOME EXATO — nunca `hasText` simples: "todo dia 5 · Aluguel" citaria o nome da
// categoria, mas nunca o nome da PRÓPRIA conta por extenso, então aqui a colisão é teórica; ainda
// assim, mesma disciplina de `linhaDoCatalogo` (tests/e2e/cadastros-catalogo.spec.ts).
function linhaDaContaFixa(page: Page, nome: string) {
  return page.getByTestId("conta-fixa-linha").filter({ has: page.getByText(nome, { exact: true }) });
}

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

function linhaDoExtrato(page: Page, titulo: string) {
  return page.getByTestId("extrato-linha").filter({ hasText: titulo });
}

async function criarContaFixaPelaTela(
  page: Page,
  dados: { nome: string; categoria: string; valor: string; dia: string },
) {
  await abrirNovaContaFixa(page);
  await expect(page.getByRole("heading", { name: "Nova conta fixa" })).toBeVisible();
  await page.getByLabel("Nome").fill(dados.nome);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: dados.categoria, exact: true }).click();
  await page.getByLabel("Valor esperado", { exact: true }).fill(dados.valor);
  await page.getByLabel("Dia de vencimento").fill(dados.dia);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/cadastros\?sub=fixas$/);
}

test.describe("cadastros contas fixas", () => {
  test.describe.configure({ mode: "serial" });

  test("com o banco sem nenhuma conta fixa, o vazio aparece e o botão abre o diálogo de verdade @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await irParaContasFixas(page);

    const titulo = page.getByRole("heading", { name: "Nenhuma conta fixa ainda.", level: 2 });
    await expect(titulo).toHaveCount(1);
    await expect(titulo).toBeVisible();
    await expect(
      page.getByText("Cadastre o aluguel, a internet e outras contas que se repetem todo mês."),
    ).toBeVisible();

    const botaoDoEstadoVazio = page
      .getByTestId("cadastros-vazio-fixas")
      .getByRole("button", { name: "+ Nova conta fixa" });
    await expect(botaoDoEstadoVazio).toBeVisible();
    await botaoDoEstadoVazio.click();

    // Só leitura: confere que o diálogo de verdade abriu e fecha sem salvar nada.
    await expect(page.getByRole("heading", { name: "Nova conta fixa" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  // "Gerar" é GLOBAL (cria uma despesa para TODA conta fixa ativa do banco, não só as deste
  // teste) — rodar este teste no celular AO MESMO TEMPO que no desktop poderia gerar, para o mês
  // deste teste, uma conta que o desktop ainda não tinha desativado (a corrida entre "desativa a
  // Internet" e "Gerar" de outro worker). Restrito ao desktop e em série (a configuração acima)
  // para ser a ÚNICA execução deste fluxo em toda a suíte.
  test("cria, desativa, gera duas vezes sem duplicar, paga o aluguel com valor diferente (exemplo 1), desfaz, reativa e edita o valor esperado", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Gerar é global — evita a corrida com o celular gerando o mesmo mês (04.4-10-PLAN.md)",
    );

    const suf = sufixoUnico();
    const nomeAluguel = `[e2e] Aluguel ${suf}`;
    const nomeInternet = `[e2e] Internet ${suf}`;

    await fazerLogin(page);
    await irParaContasFixas(page);

    // Cria "Aluguel" R$ 1.500,00, dia 5, categoria "Aluguel".
    await criarContaFixaPelaTela(page, {
      nome: nomeAluguel,
      categoria: "Aluguel",
      valor: "1500",
      dia: "5",
    });
    const linhaAluguel = linhaDaContaFixa(page, nomeAluguel);
    await expect(linhaAluguel).toBeVisible();
    await expect(linhaAluguel).toContainText("todo dia 5");

    // Cria "Internet" R$ 120,00, dia 31, categoria "Internet e sistemas".
    await criarContaFixaPelaTela(page, {
      nome: nomeInternet,
      categoria: "Internet e sistemas",
      valor: "120",
      dia: "31",
    });
    const linhaInternet = linhaDaContaFixa(page, nomeInternet);
    await expect(linhaInternet).toBeVisible();

    // Desativa a Internet — risca a linha, sem AlertDialog (reversível).
    await linhaInternet.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Conta fixa desativada.")).toBeVisible({ timeout: 10000 });
    await expect(linhaInternet.locator("span", { hasText: nomeInternet })).toHaveClass(
      /line-through/,
    );

    const mes = mesDaGeracao(hojeNoAtelie());
    const mesPorExtenso = nomeDoMes(mes);
    const tituloAluguelGerado = tituloDaContaFixa(nomeAluguel, mes);
    const tituloInternetGerado = tituloDaContaFixa(nomeInternet, mes);

    // "Gerar as contas de {mês}" — primeira vez: cria a do Aluguel, nunca a da Internet
    // (desativada).
    await page.getByTestId("gerar-contas").click();
    await expect(page.getByText(/conta\(s\) de .+ criada\(s\) no Caixa\.$/)).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/financeiro?aba=caixa");
    await expect(cartaoDaConta(page, tituloAluguelGerado)).toHaveCount(1);
    await expect(cartaoDaConta(page, tituloInternetGerado)).toHaveCount(0);

    // Gera de novo — idempotente: continua exatamente uma, e o aviso muda de forma.
    await irParaContasFixas(page);
    await page.getByTestId("gerar-contas").click();
    await expect(page.getByText(`As contas de ${mesPorExtenso} já existiam.`)).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/financeiro?aba=caixa");
    await expect(cartaoDaConta(page, tituloAluguelGerado)).toHaveCount(1);
    await expect(cartaoDaConta(page, tituloInternetGerado)).toHaveCount(0);

    // Exemplo 1 de despesa do protótipo: paga o aluguel com R$ 1.512,00 (previsto R$ 1.500,00) —
    // uma linha, uma parcela: ajusta a PRÓPRIA linha, sem linha de diferença (D-01).
    const cartaoAluguel = cartaoDaConta(page, tituloAluguelGerado);
    await cartaoAluguel.getByRole("button", { name: "Paguei" }).click();
    await page.getByTestId("baixa-valor").fill("1512,00");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();

    await expect(page.getByText("Pago: R$ 1.512,00")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("viraram uma linha de diferença")).toHaveCount(0);

    // A parcela paga some de "A pagar" — o detalhe agora vem do EXTRATO (mesmo mês, "hoje" é a
    // data do pagamento), mesma disciplina de `financeiro-caixa.spec.ts`.
    await linhaDoExtrato(page, tituloAluguelGerado).getByTestId("extrato-ver").click();
    const linhasDoDetalhe = page.getByTestId("documento-linha");
    await expect(linhasDoDetalhe).toHaveCount(1);
    await expect(linhasDoDetalhe.first()).toContainText("R$ 1.512,00");
    await page.getByTestId("documento-detalhe").getByRole("button", { name: "Fechar" }).click();

    // "Desfazer" (dentro dos 7 segundos) devolve a conta a R$ 1.500,00, em aberto (D-03).
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(
      page.getByText("Desfeito. A conta voltou a R$ 1.500,00 em aberto."),
    ).toBeVisible({ timeout: 10000 });
    await expect(cartaoDaConta(page, tituloAluguelGerado)).toContainText("R$ 1.500,00");

    // Reativa a Internet.
    await irParaContasFixas(page);
    await linhaDaContaFixa(page, nomeInternet).getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("Conta fixa reativada.")).toBeVisible({ timeout: 10000 });
    await expect(
      linhaDaContaFixa(page, nomeInternet).locator("span", { hasText: nomeInternet }),
    ).not.toHaveClass(/line-through/);

    // Muda o valor esperado do aluguel para 1.600 na linha (campo editável, sem navegação) —
    // recarrega e vê 1.600 (mudar o valor esperado vale só para as PRÓXIMAS gerações). O campo
    // formata com separador de milhar ao gravar (`centavosParaTexto`), nunca o texto cru digitado.
    const campoValor = linhaDaContaFixa(page, nomeAluguel).getByTestId("conta-fixa-valor");
    await campoValor.fill("1600,00");
    await campoValor.blur();
    await expect(campoValor).toHaveValue("1.600,00", { timeout: 10000 });

    await page.reload();
    await expect(linhaDaContaFixa(page, nomeAluguel).getByTestId("conta-fixa-valor")).toHaveValue(
      "1.600,00",
    );
  });

  test("o diálogo recusa dia 32 e valor vazio com frase, e a 320px a sub-aba não rola na horizontal", async ({
    page,
  }) => {
    await fazerLogin(page);
    await irParaContasFixas(page);

    await abrirNovaContaFixa(page);
    await expect(page.getByRole("heading", { name: "Nova conta fixa" })).toBeVisible();
    await page.getByLabel("Nome").fill(`[e2e] Validação ${sufixoUnico()}`);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aluguel", exact: true }).click();
    await page.getByLabel("Valor esperado", { exact: true }).fill("100");
    await page.getByLabel("Dia de vencimento").fill("32");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("O dia de vencimento precisa ser de 1 a 31.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nova conta fixa" })).toBeVisible();

    await page.getByLabel("Dia de vencimento").fill("10");
    await page.getByLabel("Valor esperado", { exact: true }).fill("");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Dê um valor esperado maior que zero.")).toBeVisible();

    // Cancela sem salvar nada.
    await page.getByRole("button", { name: "Cancelar" }).click();

    await page.setViewportSize({ width: 320, height: 800 });
    await page.reload();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/cadastros?sub=fixas rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

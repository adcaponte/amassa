import { test, expect, type Page } from "@playwright/test";

// Manutenção zera o contador sem apagar nada, e o ciclo desativar/reativar (`04-04-PLAN.md`,
// FOR-07/FOR-11). Sem etiqueta de vazio — cada teste cadastra o próprio forno, roda em
// `desktop`/`celular` depois da cadeia `vazio-*` (playwright.config.ts). Mesma prudência das
// specs irmãs de Fornos: servidor Next único compartilhado por toda a suíte.

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

// Cadastra o forno pelo índice (D-02: sem tela de cadastro dedicada) e navega para a página de
// detalhe pelo Link do próprio nome no cartão — nunca por inserção direta no banco. Mesmo
// helper de `tests/e2e/queimas-detalhe.spec.ts`.
async function cadastrarFornoEAbrirDetalhe(page: Page, nome: string): Promise<string> {
  await page.goto("/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill("50");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/queimas$/, { timeout: 10000 });

  const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
  await expect(cartao).toHaveCount(1);
  const testId = await cartao.getAttribute("data-testid");
  if (!testId) {
    throw new Error(`Não encontrou o cartão do forno "${nome}" para descobrir o id.`);
  }
  const id = testId.replace("cartao-forno-", "");
  await page.goto(`/queimas/${id}`);
  return id;
}

// "Registrar manutenção" só existe na página do forno (D-03), mas "Queimar" só existe no cartão
// do índice — o registro acontece lá e a navegação volta ao detalhe em seguida.
async function registrarQueimaEVoltarAoDetalhe(page: Page, id: string, nome: string): Promise<void> {
  await page.goto("/queimas");
  const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId("tipo-queima-biscoito").click();
  await expect(page.getByText("Queima registrada.")).toBeVisible({ timeout: 5000 });
  await page.goto(`/queimas/${id}`);
}

test.describe("manutenção e ciclo desativar/reativar", () => {
  test.describe.configure({ mode: "serial", retries: 2 });

  test("registrar manutenção zera o contador sem apagar nenhuma queima, e registrar de novo mantém o histórico", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Manutenção zera");
    const id = await cadastrarFornoEAbrirDetalhe(page, nome);

    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await expect(page.getByTestId("medidor-contador")).toContainText("3 / 50");
    await expect(page.getByTestId("lista-historico-queimas").locator("li")).toHaveCount(3);

    // FOR-07: a frase lê o N do contador NO MOMENTO em que o dialog abre.
    await page.getByTestId("botao-registrar-manutencao").click();
    await expect(page.getByTestId("dialog-registrar-manutencao")).toBeVisible();
    await expect(page.getByTestId("frase-contador-zerando")).toHaveText(
      "O contador vai de 3 para 0.",
    );

    // Os dois campos ficam vazios — submissão válida, o botão já nasce habilitado.
    await expect(page.getByTestId("confirmar-registrar-manutencao")).toBeEnabled();
    await page.getByTestId("confirmar-registrar-manutencao").click();

    await expect(page.getByText("Manutenção registrada.")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("dialog-registrar-manutencao")).toBeHidden();

    // A prova de FOR-07 que importa: contador 0, mas o total na vida e a lista das 3 queimas
    // continuam intactos — nenhuma linha de `queimas` foi apagada.
    await expect(page.getByTestId("medidor-contador")).toContainText("0 / 50", { timeout: 10000 });
    await expect(page.getByTestId("lista-historico-queimas").locator("li")).toHaveCount(3);
    await expect(page.getByTestId("lista-historico-manutencoes").locator("li")).toHaveCount(1, {
      timeout: 10000,
    });

    // Registrar de novo: idempotência do edge probe — o contador vai de 0 para 0, e a segunda
    // manutenção soma no histórico sem tocar as queimas.
    await page.getByTestId("botao-registrar-manutencao").click();
    await expect(page.getByTestId("frase-contador-zerando")).toHaveText(
      "O contador vai de 0 para 0.",
    );
    await page.getByTestId("confirmar-registrar-manutencao").click();

    await expect(page.getByText("Manutenção registrada.")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("medidor-contador")).toContainText("0 / 50", { timeout: 10000 });
    await expect(page.getByTestId("lista-historico-manutencoes").locator("li")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(page.getByTestId("lista-historico-queimas").locator("li")).toHaveCount(3);
  });

  test("desativar tira o botão Queimar do cartão; reativar devolve o contador exatamente ao valor anterior", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Desativar reativar");
    const id = await cadastrarFornoEAbrirDetalhe(page, nome);

    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await expect(page.getByTestId("medidor-contador")).toContainText("2 / 50");

    await page.getByTestId(`acoes-forno-${id}`).click();
    await page.getByTestId("desativar-forno").click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(`Forno «${nome}»`);
    await dialogo.getByRole("button", { name: "Desativar forno" }).click();

    await expect(page.getByText("Forno desativado.")).toBeVisible({ timeout: 5000 });
    await expect(dialogo).toBeHidden();

    // D-05: o cartão do índice fica esmaecido e sem "Queimar"; a página do forno continua
    // abrindo normalmente com todo o histórico.
    await page.goto("/queimas");
    const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
    await expect(cartao).toHaveCount(1);
    await expect(cartao.getByRole("button", { name: "Queimar" })).toHaveCount(0);
    await expect(cartao.getByRole("link", { name: nome })).toBeVisible();

    await page.goto(`/queimas/${id}`);
    await expect(page.getByTestId("medidor-contador")).toContainText("2 / 50");
    await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();

    // D-06: reativar é direto (sem confirmação), pelo mesmo lugar que desativou — o contador
    // volta EXATAMENTE ao valor anterior, porque nada foi apagado.
    await page.getByTestId(`acoes-forno-${id}`).click();
    await page.getByTestId("reativar-forno").click();

    await expect(page.getByText("Forno reativado.")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("medidor-contador")).toContainText("2 / 50", { timeout: 10000 });

    await page.goto("/queimas");
    const cartaoReativado = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
    await expect(cartaoReativado.getByRole("button", { name: "Queimar" })).toBeVisible();
  });
});

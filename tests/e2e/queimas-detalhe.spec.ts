import { test, expect, type Page } from "@playwright/test";

// Página de detalhe do forno (`/queimas/[id]`, FOR-09/FOR-10) — 04-03-PLAN.md, Tarefa 3. Sem
// etiqueta de vazio: cada teste cadastra o próprio forno, roda em `desktop`/`celular` depois da
// cadeia `vazio-*` (playwright.config.ts).

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
// detalhe pelo Link do próprio nome no cartão — nunca por inserção direta no banco.
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

// Registra uma queima direto na página do forno via cartão do índice — a página de detalhe
// ainda não tem o botão "Queimar" (chega no plano 04-04); por isso o registro acontece no
// índice e a navegação volta para o detalhe em seguida, sempre pela interface, nunca por SQL.
async function registrarQueimaEVoltarAoDetalhe(page: Page, id: string, nome: string): Promise<void> {
  await page.goto("/queimas");
  const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId("tipo-queima-biscoito").click();
  await expect(page.getByText("Queima registrada.")).toBeVisible({ timeout: 5000 });
  await expect(cartao.getByTestId("medidor-contador")).toContainText(/^\d+ \/ 50$/, {
    timeout: 10000,
  });
  await page.goto(`/queimas/${id}`);
}

test.describe("detalhe do forno", () => {
  // Mesma prudência de outros specs da fase: servidor Next único compartilhado por toda a suíte.
  test.describe.configure({ mode: "serial", retries: 2 });

  test("forno recém-cadastrado abre com os dois vazios inline distintos", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe vazio");
    await cadastrarFornoEAbrirDetalhe(page, nome);

    await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();
    await expect(page.getByTestId("historico-manutencoes-vazio")).toHaveText(
      "Sem manutenção registrada.",
    );
    await expect(page.getByTestId("historico-queimas-vazio")).toHaveText(
      "Nenhuma queima registrada ainda.",
    );

    // Nenhum `EstadoVazio` de página inteira — os dois vazios ficam inline, dentro da própria
    // sub-seção; o resto da página (medidor, cabeçalho) continua visível ao mesmo tempo.
    await expect(page.getByTestId("medidor")).toBeVisible();
  });

  test("registrar duas queimas mostra as duas no histórico, mais-recente-primeiro", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe duas queimas");
    const id = await cadastrarFornoEAbrirDetalhe(page, nome);

    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await expect(page.getByTestId("historico-queimas-vazio")).toHaveCount(0);
    const primeiraLinha = page.getByTestId("lista-historico-queimas").locator("li").first();
    await expect(primeiraLinha).toContainText("Biscoito");

    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    const linhas = page.getByTestId("lista-historico-queimas").locator("li");
    await expect(linhas).toHaveCount(2);
    // A queima mais recente (a segunda registrada) aparece PRIMEIRO — ordenação decrescente por
    // `ocorridaEm`.
    await expect(linhas.first()).toContainText("Biscoito");
    await expect(linhas.last()).toContainText("Biscoito");
  });

  test("excluir uma queima pelo dialog: cancelar não exclui nada, confirmar remove a linha e baixa o contador em um", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe excluir uma");
    const id = await cadastrarFornoEAbrirDetalhe(page, nome);

    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    await registrarQueimaEVoltarAoDetalhe(page, id, nome);

    const linhas = page.getByTestId("lista-historico-queimas").locator("li");
    await expect(linhas).toHaveCount(2);
    await expect(page.getByTestId("medidor-contador")).toContainText("2 / 50");

    const primeiraLinha = linhas.first();
    const idDaLinhaExcluida = (await primeiraLinha.getAttribute("data-testid"))?.replace(
      "linha-queima-",
      "",
    );
    if (!idDaLinhaExcluida) {
      throw new Error("Não encontrou o id da primeira linha do histórico.");
    }

    await primeiraLinha.getByTestId(`excluir-queima-${idDaLinhaExcluida}`).click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Excluir esta queima?" })).toBeVisible();
    await expect(dialogo).toContainText(`Forno «${nome}»`);

    // Cancelar não exclui nada — o dialog fecha e as duas linhas continuam lá.
    await dialogo.getByRole("button", { name: "Voltar" }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(linhas).toHaveCount(2);
    await expect(page.getByTestId("medidor-contador")).toContainText("2 / 50");

    // Confirmar remove exatamente a linha confirmada e baixa o contador em um — sem sair da
    // página do forno (nenhuma navegação depois do sucesso).
    await primeiraLinha.getByTestId(`excluir-queima-${idDaLinhaExcluida}`).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/queimas/${id}$`));
    await expect(page.getByTestId(`linha-queima-${idDaLinhaExcluida}`)).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(linhas).toHaveCount(1, { timeout: 10000 });
    await expect(page.getByTestId("medidor-contador")).toContainText("1 / 50", { timeout: 10000 });
  });

  test("excluir a última queima leva a lista ao vazio inline e o contador a 0", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe excluir última");
    const id = await cadastrarFornoEAbrirDetalhe(page, nome);

    await registrarQueimaEVoltarAoDetalhe(page, id, nome);
    const linha = page.getByTestId("lista-historico-queimas").locator("li");
    await expect(linha).toHaveCount(1);
    await expect(page.getByTestId("medidor-contador")).toContainText("1 / 50");

    const idDaQueima = (await linha.getAttribute("data-testid"))?.replace("linha-queima-", "");
    if (!idDaQueima) {
      throw new Error("Não encontrou o id da linha do histórico.");
    }

    await linha.getByTestId(`excluir-queima-${idDaQueima}`).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page.getByTestId("historico-queimas-vazio")).toHaveText(
      "Nenhuma queima registrada ainda.",
      { timeout: 10000 },
    );
    await expect(page.getByTestId("medidor-contador")).toContainText("0 / 50", { timeout: 10000 });
  });
});

import { test, expect, type Page, type Locator } from "@playwright/test";

// O ciclo de vida das duas listas do módulo Abertura do Espaço (04.2-03-PLAN.md): marcar como
// resolvido/concluído (otimista, D-07), o destaque de entrega vencida (D-04/ABE-04), editar no
// lugar (D-18/ABE-11) e remover com confirmação nomeando o que se perde (D-14/ABE-10). Nenhum
// teste deste arquivo afirma uma condição GLOBAL do banco — cada caso cria seus próprios itens e
// tarefas com nome único e filtra por ele, então não precisa de `@vazio-global` nem de rodar em
// série (mesma disciplina de `tests/e2e/abertura-tracador.spec.ts` para os casos que não são o
// primeiro).
//
// Nomes inventados e reconhecíveis como tal — nenhum dado de pessoa real, o repositório é
// público.

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

function linhaDeItem(page: Page, nome: string): Locator {
  return page.getByTestId("abertura-linha-item").filter({ hasText: nome });
}

function linhaDeTarefa(page: Page, descricao: string): Locator {
  return page.getByTestId("abertura-linha-tarefa").filter({ hasText: descricao });
}

async function criarItem(
  page: Page,
  opcoes: {
    nome: string;
    categoria?: string;
    valor: string;
    entregaPrevistaEm?: string;
  },
) {
  await page.goto("/abertura?item=novo");
  await page.getByLabel("O que é").fill(opcoes.nome);
  if (opcoes.categoria) {
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: opcoes.categoria }).click();
  }
  await page.getByLabel("Valor total").fill(opcoes.valor);
  if (opcoes.entregaPrevistaEm) {
    await page.getByLabel("Chega em (opcional)").fill(opcoes.entregaPrevistaEm);
  }
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });
}

async function criarTarefa(
  page: Page,
  opcoes: { descricao: string; vinculoAoItem?: string },
) {
  await page.goto("/abertura?aba=tarefas&tarefa=nova");
  await page.getByLabel("O que fazer").fill(opcoes.descricao);
  if (opcoes.vinculoAoItem) {
    await page.getByRole("combobox", { name: "Ligada a algum item?" }).click();
    await page.getByRole("option", { name: opcoes.vinculoAoItem }).click();
  }
  await page.getByRole("button", { name: "Adicionar tarefa" }).click();
  await expect(page).toHaveURL(/\?aba=tarefas$/, { timeout: 10000 });
}

test.describe("abertura edicao — marcar, editar e remover no módulo Abertura do Espaço", () => {
  // Tarefa 1: a marcação que responde na hora, e o item que não chegou (D-04/D-07/ABE-04).
  test("um item com entrega vencida aparece destacado como 'não chegou', e o destaque some ao marcar como resolvido", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Torno elétrico usado");

    // Entrega prevista muito no passado — sempre vencida, qualquer que seja o dia do teste.
    await criarItem(page, {
      nome,
      categoria: "Equipamentos",
      valor: "3200",
      entregaPrevistaEm: "2020-01-01",
    });

    const linha = linhaDeItem(page, nome);
    await expect(linha).toBeVisible();
    await expect(linha.getByTestId("abertura-nao-chegou")).toHaveText("não chegou · 01/01");
    // "chega" nunca aparece ao lado de "não chegou" — são a mesma etiqueta, uma ou outra.
    await expect(linha).not.toContainText("chega 01/01");

    const grupo = page
      .getByTestId("abertura-grupo-categoria")
      .filter({ hasText: "Equipamentos" });
    await expect(grupo.getByTestId("abertura-nao-chegaram-do-grupo")).toBeVisible();

    const caixa = linha.getByTestId("abertura-caixa-item");
    await expect(caixa).toHaveAttribute("aria-pressed", "false");
    await expect(caixa).toHaveAttribute("aria-label", `Marcar como resolvido: ${nome}`);

    // A caixa de marcação: alvo de toque de 44px ou mais (CLAUDE.md §Acessibilidade).
    const caixaBox = await caixa.boundingBox();
    expect(caixaBox?.width, "caixa de marcação mede menos que 44px de largura").toBeGreaterThanOrEqual(44);
    expect(caixaBox?.height, "caixa de marcação mede menos que 44px de altura").toBeGreaterThanOrEqual(44);

    await caixa.click();

    // Otimista (UI-SPEC §"Salvamento otimista"): o destaque some SEM recarregar a página à mão —
    // a marcação é a ÚNICA coisa que apaga o alerta (D-07).
    await expect(linha.getByTestId("abertura-nao-chegou")).toHaveCount(0);
    await expect(caixa).toHaveAttribute("aria-pressed", "true");
    await expect(caixa).toHaveAttribute("aria-label", `Desmarcar: ${nome}`);

    // Sobrevive a um recarregamento — a marcação foi de fato gravada, não só otimista na tela.
    await page.reload();
    await expect(linhaDeItem(page, nome).getByTestId("abertura-nao-chegou")).toHaveCount(0);
    await expect(linhaDeItem(page, nome).getByTestId("abertura-caixa-item")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("um item sem entrega prevista, ou com entrega hoje, nunca aparece como 'não chegou'", async ({
    page,
  }) => {
    await fazerLogin(page);
    const semData = nomeUnico("Mesa de apoio");
    const hojeStr = new Date().toISOString().slice(0, 10);
    const comHoje = nomeUnico("Rack de secagem");

    await criarItem(page, { nome: semData, valor: "500" });
    await expect(linhaDeItem(page, semData).getByTestId("abertura-nao-chegou")).toHaveCount(0);

    await criarItem(page, { nome: comHoje, valor: "700", entregaPrevistaEm: hojeStr });
    await expect(linhaDeItem(page, comHoje).getByTestId("abertura-nao-chegou")).toHaveCount(0);
  });

  test("marcar uma tarefa como concluída responde na hora e reaparece esmaecida", async ({
    page,
  }) => {
    await fazerLogin(page);
    const descricao = nomeUnico("Instalar tomadas 220V");

    await criarTarefa(page, { descricao });

    const linha = linhaDeTarefa(page, descricao);
    const caixa = linha.getByTestId("abertura-caixa-tarefa");
    await expect(caixa).toHaveAttribute("aria-pressed", "false");
    await expect(caixa).toHaveAttribute("aria-label", `Concluir: ${descricao}`);

    await caixa.click();

    await expect(caixa).toHaveAttribute("aria-pressed", "true");
    await expect(caixa).toHaveAttribute("aria-label", `Reabrir: ${descricao}`);
    // Concluída fica esmaecida e com o texto riscado (Tarefa 1, ação do plano) — a div do
    // próprio texto da descrição é que ganha a classe, não a linha inteira.
    await expect(linha.locator("div.font-medium", { hasText: descricao })).toHaveClass(
      /line-through/,
    );
  });
});

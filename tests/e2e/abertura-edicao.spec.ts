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
    await expect(linha.getByTestId("abertura-nao-chegou")).toHaveCount(0, { timeout: 10000 });
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
      { timeout: 10000 },
    );
  });

  // Tarefa 2: editar no lugar, no mesmo formulário (D-18/ABE-11).
  test("editar um item com tarefa ligada atualiza a linha e preserva o vínculo", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeItem = nomeUnico("Forno de segunda mão");
    const nomeItemEditado = nomeUnico("Forno de segunda mão (revisado)");
    const descricaoTarefa = nomeUnico("Instalar o forno usado");

    await criarItem(page, { nome: nomeItem, categoria: "Equipamentos", valor: "5000" });
    await criarTarefa(page, { descricao: descricaoTarefa, vinculoAoItem: nomeItem });

    // `criarTarefa` deixa a página na aba Tarefas — volta para a aba Itens (a etiqueta "N
    // tarefas abertas" só é desenhada por `lista-itens.tsx`).
    await page.goto("/abertura");

    // O item mostra 1 tarefa aberta (D-13) antes de editar.
    await expect(
      linhaDeItem(page, nomeItem).getByTestId("abertura-tarefas-abertas"),
    ).toHaveText("1 tarefa aberta");

    // Abre "Editar" pelo botão da linha (não digitando a URL à mão) — prova que o botão FUNCIONA.
    // `next/link` faz navegação client-side (sem evento "load" de página inteira), por isso a
    // espera aqui é pelo CONTEÚDO do diálogo (auto-retry), nunca por `waitForURL`/`waitForLoadState`.
    await linhaDeItem(page, nomeItem).getByTestId("abertura-editar-item").click();
    await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Salvar alterações" })).toBeVisible();

    // Os campos vieram preenchidos com os valores atuais.
    await expect(page.getByLabel("O que é")).toHaveValue(nomeItem);
    await expect(page.getByLabel("Valor total")).toHaveValue("5000");

    // Troca valor, categoria e forma de pagamento (que muda o número de parcelas).
    await page.getByLabel("O que é").fill(nomeItemEditado);
    await page.getByLabel("Valor total").fill("6000");
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Móveis" }).click();
    await page.getByRole("combobox", { name: "Pagamento" }).click();
    await page.getByRole("option", { name: "A prazo" }).click();
    await page.getByLabel("Em quantas vezes").fill("3");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });

    // (a) a linha mostra os valores novos — e o nome antigo não sobrevive em lugar nenhum
    // (a linha foi ATUALIZADA, nunca apagada e recriada ao lado da antiga: se tivesse apagado e
    // inserido de novo com o nome velho por engano, esta contagem seria > 0).
    await expect(page.getByTestId("abertura-linha-item").filter({ hasText: nomeItem })).toHaveCount(
      0,
    );
    const linhaEditada = linhaDeItem(page, nomeItemEditado);
    await expect(linhaEditada).toBeVisible();
    await expect(linhaEditada.getByTestId("abertura-valor-item")).toHaveText("R$ 6.000");
    await expect(linhaEditada).toContainText("a prazo");

    // (b) a tarefa continua ligada a ele — o vínculo sobreviveu à edição (D-18).
    await expect(
      linhaEditada.getByTestId("abertura-tarefas-abertas"),
    ).toHaveText("1 tarefa aberta");

    // (c) o item continua mostrando a tarefa aberta, do lado da tarefa também — precisa da aba
    // Tarefas (a linha da tarefa não existe na aba Itens).
    await page.goto("/abertura?aba=tarefas");
    await expect(
      linhaDeTarefa(page, descricaoTarefa).getByTestId("abertura-vinculo-item"),
    ).toHaveText(nomeItemEditado);
  });

  test("editar uma tarefa preserva o vínculo dela com o item", async ({ page }) => {
    await fazerLogin(page);
    const nomeItem = nomeUnico("Estante modular");
    const descricao = nomeUnico("Montar a estante");
    const descricaoEditada = nomeUnico("Montar e nivelar a estante");

    await criarItem(page, { nome: nomeItem, valor: "800" });
    await criarTarefa(page, { descricao, vinculoAoItem: nomeItem });

    await linhaDeTarefa(page, descricao).getByTestId("abertura-editar-tarefa").click();
    await expect(page.getByRole("heading", { name: "Editar tarefa" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByLabel("O que fazer").fill(descricaoEditada);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page).toHaveURL(/\?aba=tarefas$/, { timeout: 10000 });

    const linhaEditada = linhaDeTarefa(page, descricaoEditada);
    await expect(linhaEditada).toBeVisible();
    await expect(linhaEditada.getByTestId("abertura-vinculo-item")).toHaveText(nomeItem);
  });

  test("um identificador de item inexistente na URL abre o formulário vazio em vez de quebrar a página", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/abertura?item=00000000-0000-0000-0000-000000000000");

    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await expect(page.getByLabel("O que é")).toHaveValue("");
  });

  // Os botões só com ícone (editar/remover) vivem dentro de uma linha de 44px ou mais.
  test("os botões de editar e remover têm aria-label nomeando a linha, e a linha mede 44px ou mais", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Bancada auxiliar");

    await criarItem(page, { nome, valor: "400" });

    const linha = linhaDeItem(page, nome);
    const editar = linha.getByTestId("abertura-editar-item");
    const remover = linha.getByTestId("abertura-remover-item");

    await expect(editar).toHaveAttribute("aria-label", `Editar ${nome}`);
    await expect(remover).toHaveAttribute("aria-label", `Remover ${nome}`);

    const alturaDaLinha = await linha.boundingBox();
    expect(alturaDaLinha?.height, "linha do item mede menos que 44px").toBeGreaterThanOrEqual(44);
  });

  // Tarefa 3: remover dizendo o que se perde — e o que não se perde (D-14/ABE-10).
  test("remover um item com duas tarefas ligadas avisa quantas ficam soltas, e nenhuma tarefa é apagada", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeItem = nomeUnico("Compressor de ar");
    const descricaoTarefa1 = nomeUnico("Instalar o compressor");
    const descricaoTarefa2 = nomeUnico("Testar a pressão do compressor");

    await criarItem(page, { nome: nomeItem, categoria: "Equipamentos", valor: "2400" });
    await criarTarefa(page, { descricao: descricaoTarefa1, vinculoAoItem: nomeItem });
    await criarTarefa(page, { descricao: descricaoTarefa2, vinculoAoItem: nomeItem });

    await page.goto("/abertura");
    await linhaDeItem(page, nomeItem).getByTestId("abertura-remover-item").click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible({ timeout: 10000 });
    await expect(dialogo).toContainText(`Remover "${nomeItem}"?`);
    await expect(dialogo).toContainText("R$ 2.400");
    // A segunda metade da frase ("mas não são apagadas") é a parte que não pode faltar (D-14).
    await expect(dialogo).toContainText(
      "2 tarefas ligadas a ele ficam soltas, mas não são apagadas.",
    );

    await dialogo.getByRole("button", { name: "Remover" }).click();
    await expect(dialogo).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId("abertura-linha-item").filter({ hasText: nomeItem })).toHaveCount(
      0,
    );

    // As duas tarefas continuam na lista, agora sem vínculo — nenhuma foi apagada.
    await page.goto("/abertura?aba=tarefas");
    const linhaTarefa1 = linhaDeTarefa(page, descricaoTarefa1);
    const linhaTarefa2 = linhaDeTarefa(page, descricaoTarefa2);
    await expect(linhaTarefa1).toBeVisible();
    await expect(linhaTarefa2).toBeVisible();
    await expect(linhaTarefa1.getByTestId("abertura-vinculo-item")).toHaveCount(0);
    await expect(linhaTarefa2.getByTestId("abertura-vinculo-item")).toHaveCount(0);
  });

  test("remover um item sem tarefa ligada não mostra o aviso de tarefas soltas", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeItem = nomeUnico("Prateleira avulsa");

    await criarItem(page, { nome: nomeItem, valor: "300" });
    await linhaDeItem(page, nomeItem).getByTestId("abertura-remover-item").click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible({ timeout: 10000 });
    await expect(dialogo).not.toContainText("ficam soltas");
    await expect(dialogo).not.toContainText("fica solta");

    await dialogo.getByRole("button", { name: "Remover" }).click();
    await expect(dialogo).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId("abertura-linha-item").filter({ hasText: nomeItem })).toHaveCount(
      0,
    );
  });

  test("remover uma tarefa pede confirmação nomeando a tarefa", async ({ page }) => {
    await fazerLogin(page);
    const descricao = nomeUnico("Pintar a parede do fundo");

    await criarTarefa(page, { descricao });
    await linhaDeTarefa(page, descricao).getByTestId("abertura-remover-tarefa").click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible({ timeout: 10000 });
    await expect(dialogo).toContainText(`Remover a tarefa "${descricao}"?`);

    await dialogo.getByRole("button", { name: "Remover" }).click();
    await expect(dialogo).toBeHidden({ timeout: 10000 });
    await expect(linhaDeTarefa(page, descricao)).toHaveCount(0);
  });

  test("cancelar a remoção (Voltar) mantém a linha intacta", async ({ page }) => {
    await fazerLogin(page);
    const nomeItem = nomeUnico("Armário de ferramentas");

    await criarItem(page, { nome: nomeItem, valor: "900" });
    await linhaDeItem(page, nomeItem).getByTestId("abertura-remover-item").click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible({ timeout: 10000 });
    await dialogo.getByRole("button", { name: "Voltar" }).click();
    await expect(dialogo).toBeHidden({ timeout: 10000 });

    await expect(linhaDeItem(page, nomeItem)).toBeVisible();
  });
});

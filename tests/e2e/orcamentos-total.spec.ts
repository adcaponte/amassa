import { test, expect, type Locator, type Page } from "@playwright/test";

// A metade de baixo do editor do orçamento (04.5-07-PLAN.md): "Custos do projeto e frete",
// "Total e pagamento" e o painel "Só para você". Nomes inventados e únicos por execução
// ("[e2e] ... {sufixo}") — nenhum dado real do ateliê, o repositório é público.
//
// A contagem do aviso de estimados NUNCA é afirmada com um número fixo: `parametros_precificacao`
// é estado GLOBAL do banco, e `precificacao-parametros.spec.ts` alterna o selo estimado/medido de
// um parâmetro sem desfazer — afirmar "18" aqui disputaria esse estado sob execução paralela
// (mesma armadilha que a regra do CLAUDE.md sobre "nenhuma encomenda existe" descreve). O caso (d)
// confere só que o aviso aparece com ALGUMA contagem positiva.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function criarOrcamento(page: Page): Promise<void> {
  await page.goto("/gestao/financeiro?aba=orcamentos");
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=orcamentos&orcamento=/, { timeout: 10000 });
}

function orcamentoIdDaUrl(page: Page): string {
  const url = new URL(page.url());
  return url.searchParams.get("orcamento") ?? "";
}

// Sai do campo e espera a navegação de verdade — nunca `waitForLoadState` isolado, porque a URL
// final é IDÊNTICA à atual (mesma armadilha documentada em `orcamentos-editor.spec.ts`).
async function blurEEsperarNavegacao(page: Page, campo: Locator): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

async function acrescentarPecaExclusiva(page: Page, orcamentoId: string, nome: string, precoReais: string): Promise<void> {
  await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  await page.getByRole("link", { name: "+ Peça exclusiva deste pedido" }).click();
  await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();

  await page.getByTestId("ficha-campo-nome").fill(nome);
  await page.getByTestId("ficha-campo-argila").fill("450");
  await page.getByTestId("ficha-campo-esmalte").fill("60");
  await page.getByTestId("ficha-campo-horas").fill("0,6");
  await page.getByTestId("ficha-campo-largura").fill("12");
  await page.getByTestId("ficha-campo-profundidade").fill("9");
  await page.getByTestId("ficha-campo-altura").fill("10");
  await page.getByTestId("ficha-campo-embalagem").fill("3");
  await page.getByTestId("ficha-campo-preco-praticado").fill(precoReais);
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${orcamentoId}$`), { timeout: 10000 });
  await expect(page.getByTestId("orcamento-linha").filter({ hasText: nome })).toBeVisible();
}

// Extrai só a parte "R$ 1.234,56" de um texto maior (o rótulo da parcela também tem números e
// vírgula — "1ª parcela, na aprovação" — então nunca limpar o texto inteiro) e devolve 123456
// (centavos). Só para conferir soma na tela, nunca lógica de produção.
function reaisParaCentavos(texto: string): number {
  const casamento = texto.match(/R\$\s*([\d.]+,\d{2})/);
  if (!casamento) {
    throw new Error(`Não encontrei um valor em reais no texto: "${texto}"`);
  }
  const limpo = casamento[1].replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

test.describe("orcamentos total", () => {
  test.describe.configure({ mode: "serial" });

  let orcamentoId = "";
  let suf = "";

  test("(a) acrescentar um custo de projeto e um frete soma exatamente ao total das peças", async ({ page }) => {
    suf = sufixoUnico();
    await fazerLogin(page);
    await criarOrcamento(page);
    orcamentoId = orcamentoIdDaUrl(page);
    expect(orcamentoId).not.toBe("");

    await acrescentarPecaExclusiva(page, orcamentoId, `[e2e] Total Peça A ${suf}`, "100");
    await acrescentarPecaExclusiva(page, orcamentoId, `[e2e] Total Peça B ${suf}`, "50");

    // Peças: 100 + 50 = 150,00 — projeto e frete ainda zero.
    await expect(page.getByTestId("orcamento-total")).toContainText("R$ 150,00");

    await page.getByRole("button", { name: "+ Custo do projeto" }).click();
    const linhaDeProjeto = page.getByTestId("projeto-linha").last();
    const campoDescricao = linhaDeProjeto.getByTestId("projeto-linha-descricao");
    const campoValor = linhaDeProjeto.getByTestId("projeto-linha-valor");
    await campoDescricao.fill(`[e2e] Molde ${suf}`);
    await campoValor.fill("20");
    await blurEEsperarNavegacao(page, campoValor);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoFrete = page.getByTestId("orcamento-frete");
    await campoFrete.fill("10");
    await blurEEsperarNavegacao(page, campoFrete);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    // 150 (peças) + 20 (projeto) + 10 (frete) = 180,00 — a soma EXATA dos três.
    await expect(page.getByTestId("orcamento-total")).toContainText("R$ 180,00");
  });

  test("(b) trocar o plano para '3 parcelas' mostra três parcelas cuja soma é igual ao total", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const totalTexto = (await page.getByTestId("orcamento-total").textContent()) ?? "";
    const totalCentavos = reaisParaCentavos(totalTexto);

    const selectPlano = page.getByTestId("orcamento-plano-select");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      selectPlano.selectOption("3x"),
    ]);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const parcelas = page.getByTestId("orcamento-parcela");
    await expect(parcelas).toHaveCount(3);

    let somaCentavos = 0;
    for (const parcela of await parcelas.all()) {
      const texto = (await parcela.textContent()) ?? "";
      somaCentavos += reaisParaCentavos(texto);
    }
    expect(somaCentavos).toBe(totalCentavos);
  });

  test("(c) trocar para 'Sinal + saldo na entrega' com 50% mostra duas parcelas com o porcento escolhido", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const selectPlano = page.getByTestId("orcamento-plano-select");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      selectPlano.selectOption("sinal"),
    ]);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoSinal = page.getByTestId("orcamento-sinal-input");
    await campoSinal.fill("50");
    await blurEEsperarNavegacao(page, campoSinal);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const parcelas = page.getByTestId("orcamento-parcela");
    await expect(parcelas).toHaveCount(2);
    await expect(parcelas.first()).toContainText("Sinal de 50%, na aprovação");
    await expect(parcelas.last()).toContainText("Saldo, na entrega");

    const totalTexto = (await page.getByTestId("orcamento-total").textContent()) ?? "";
    const totalCentavos = reaisParaCentavos(totalTexto);
    let somaCentavos = 0;
    for (const parcela of await parcelas.all()) {
      somaCentavos += reaisParaCentavos((await parcela.textContent()) ?? "");
    }
    expect(somaCentavos).toBe(totalCentavos);
  });

  test("(d) o painel 'Só para você' mostra custo, sobra, horas e fornadas, e o aviso de estimados com contagem positiva", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const painel = page.getByTestId("orcamento-so-para-voce");
    await expect(painel).toBeVisible();
    await expect(painel).toContainText("Nada disto aparece para o cliente.");
    await expect(painel).toContainText("Custo de produzir tudo");
    await expect(painel).toContainText("Sobra depois de imposto e taxa");
    await expect(painel).toContainText("Horas de trabalho");
    await expect(painel).toContainText("Ocupa do forno");
    await expect(painel).toContainText("fornada(s) de biscoito");

    // A semente nasce com todos os parâmetros estimados — nesta fase da suíte é esperado ao
    // menos um estimado, mas a CONTAGEM exata não é afirmada (estado global compartilhado com
    // `precificacao-parametros.spec.ts`, que alterna o selo sem desfazer).
    const aviso = page.getByTestId("orcamento-aviso-estimados");
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveText(/^\d+ parâmetro\(s\) deste cálculo ainda são estimados\./);
    const textoAviso = (await aviso.textContent()) ?? "";
    const quantidade = Number(textoAviso.match(/^(\d+)/)?.[1] ?? "0");
    expect(quantidade).toBeGreaterThan(0);
  });

  test("(e) escrever observações e recarregar mantém o texto", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const observacoes = `[e2e] Entrega em caixa reforçada ${suf}`;
    const campoObservacoes = page.getByTestId("orcamento-observacoes");
    await campoObservacoes.fill(observacoes);
    await blurEEsperarNavegacao(page, campoObservacoes);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    await page.reload();
    await expect(page.getByTestId("orcamento-observacoes")).toHaveValue(observacoes);
  });

  test("(f) a 320px o total não provoca rolagem horizontal e os blocos ficam empilhados; a 1280px ficam lado a lado", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Observações no limite de 300 caracteres (must_have backstop) — preenchido ANTES da
    // conferência de rolagem a 320px, para que o texto mais longo possível já esteja na tela.
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    const observacoesNoLimite = `[e2e] ${"x".repeat(294)}`.slice(0, 300);
    const campoObservacoes = page.getByTestId("orcamento-observacoes");
    await campoObservacoes.fill(observacoesNoLimite);
    await blurEEsperarNavegacao(page, campoObservacoes);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-total")).toBeVisible();

    const larguraDeRolagem = await page.evaluate(() => document.documentElement.scrollWidth);
    const larguraDaJanela = await page.evaluate(() => document.documentElement.clientWidth);
    expect(larguraDeRolagem).toBeLessThanOrEqual(larguraDaJanela + 1);

    // Compara o `x` dos TÍTULOS dos blocos (`<h2>`, alinhados à ESQUERDA da própria seção) —
    // nunca o `x` dos valores em si, que são alinhados à DIREITA e por isso variam de posição
    // conforme o tamanho do próprio texto (Display 28px do total é mais largo por caractere que
    // o texto corpo do subtotal de peças, o que corrompe a comparação por `x` do valor).
    const boxTotalEstreito = await page.getByRole("heading", { name: "Total e pagamento" }).boundingBox();
    const boxPecasEstreito = await page.getByRole("heading", { name: "Peças", exact: true }).boundingBox();
    expect(boxTotalEstreito).not.toBeNull();
    expect(boxPecasEstreito).not.toBeNull();
    // Empilhados: os dois títulos começam na MESMA coluna (mesma coluna única).
    expect(Math.abs((boxTotalEstreito?.x ?? 0) - (boxPecasEstreito?.x ?? 0))).toBeLessThan(5);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-total")).toBeVisible();

    const boxTotalLargo = await page.getByRole("heading", { name: "Total e pagamento" }).boundingBox();
    const boxPecasLargo = await page.getByRole("heading", { name: "Peças", exact: true }).boundingBox();
    expect(boxTotalLargo).not.toBeNull();
    expect(boxPecasLargo).not.toBeNull();
    // Lado a lado: o título de "Total e pagamento" começa bem à direita do título de "Peças"
    // (colunas `1.15fr 1fr`).
    expect((boxTotalLargo?.x ?? 0) - (boxPecasLargo?.x ?? 0)).toBeGreaterThan(200);
  });
});

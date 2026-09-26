import { test, expect, type Locator, type Page } from "@playwright/test";

// O ciclo de vida do orçamento (04.5-08-PLAN.md): congelar ao enviar, a prova de que mudar um
// parâmetro ou criar um rascunho novo depois não mexe no que já foi congelado, recusar, voltar
// para rascunho e duplicar com número novo. Nomes inventados e únicos por execução
// ("[e2e] ... {sufixo}") — nenhum dado real do ateliê, o repositório é público.
//
// A ORDEM dos testes abaixo NÃO segue a ordem das letras do plano (b, c, d, e-duplicar, g, f-
// recusar) — decisão do executor (ver SUMMARY, "Decidido sem o dono"): "Recusou" só é aceito a
// partir de "enviado" (guarda do servidor), e "Duplicar a partir de um enviado" e o backstop de
// responsivo (com os CINCO botões do estado "enviado") precisam rodar ENQUANTO o orçamento ainda
// está enviado — então "recusar" (que tira o orçamento do estado enviado) fica por último. Todas
// as SETE letras do plano são cobertas; só a ORDEM de execução muda, para que o estado do
// orçamento sempre permita a próxima ação sem reabrir/reenviar sem necessidade.
//
// O parâmetro usado na prova de congelamento (caso 3) é DEDICADO a este teste — `forno_desgaste_
// por_fornada` (desktop) / `forno_tarifa_energia` (celular), nenhum dos dois tocado por
// `precificacao-parametros.spec.ts` (que usa material_argila/material_esmalte/perda_unica/
// preco_lucro/trabalho_hora) — para não disputar estado global do banco sob execução paralela.
// Os dois entram na MESMA conta (fornada = kWh × tarifa + desgaste): aumentar qualquer um dos dois
// só pode AUMENTAR o custo/mínimo de uma peça, nunca diminuir — a mesma garantia para os dois
// projetos, sem depender de qual valor exato cada um grava.

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

function chaveDoParametroDedicado(): "forno_desgaste_por_fornada" | "forno_tarifa_energia" {
  return test.info().project.name === "celular" ? "forno_tarifa_energia" : "forno_desgaste_por_fornada";
}

async function criarOrcamento(page: Page): Promise<string> {
  await page.goto("/financeiro?aba=orcamentos");
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await expect(page).toHaveURL(/\/financeiro\?aba=orcamentos&orcamento=/, { timeout: 10000 });
  return orcamentoIdDaUrl(page);
}

function orcamentoIdDaUrl(page: Page): string {
  const url = new URL(page.url());
  return url.searchParams.get("orcamento") ?? "";
}

// Sai do campo e espera a navegação de verdade — nunca `waitForLoadState` isolado, porque a URL
// final pode ser IDÊNTICA à atual (mesma armadilha documentada em `orcamentos-editor.spec.ts`/
// `orcamentos-total.spec.ts`).
async function blurEEsperarNavegacao(page: Page, campo: Locator): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

async function preencherCliente(page: Page, orcamentoId: string, nome: string): Promise<void> {
  const campo = page.getByTestId("orcamento-campo-cliente");
  await campo.fill(nome);
  await blurEEsperarNavegacao(page, campo);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
}

// A MESMA receita (medidas/material/horas) em toda chamada — a prova do caso 3 depende de duas
// peças com a receita IDÊNTICA calcularem valores diferentes só porque o parâmetro global mudou.
async function acrescentarPecaExclusiva(page: Page, orcamentoId: string, nome: string, precoReais: string): Promise<void> {
  await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
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

// Extrai só a parte "R$ 1.234,56" de um texto maior (mesma técnica de `orcamentos-total.spec.ts`
// — nunca limpar o texto inteiro, que pode ter outros dígitos/vírgulas).
function reaisParaCentavos(texto: string): number {
  const casamento = texto.match(/R\$\s*([\d.]+,\d{2})/);
  if (!casamento) {
    throw new Error(`Não encontrei um valor em reais no texto: "${texto}"`);
  }
  const limpo = casamento[1].replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

test.describe("orcamentos ciclo", () => {
  test.describe.configure({ mode: "serial" });

  let orcamentoId = "";
  let suf = "";
  let nomeDaPeca = "";
  let minimoAntesDoParametroNovo = "";
  let totalAntesDoParametroNovo = "";
  let painelAntesDoParametroNovo = "";
  let minimoComParametroNovo = "";

  test("(1) sem cliente ou peça 'Marcar como enviado' fica desabilitado e mostra a frase de falta; preencher os dois habilita", async ({
    page,
  }) => {
    suf = sufixoUnico();
    await fazerLogin(page);
    orcamentoId = await criarOrcamento(page);

    const botaoEnviar = page.getByRole("button", { name: "Marcar como enviado" });
    await expect(botaoEnviar).toBeDisabled();
    await expect(page.getByTestId("orcamento-falta-enviar")).toHaveText(
      "Para enviar, falta o cliente e ao menos uma peça.",
    );

    await preencherCliente(page, orcamentoId, `[e2e] Cliente do ciclo ${suf}`);
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeDisabled();
    await expect(page.getByTestId("orcamento-falta-enviar")).toBeVisible();

    nomeDaPeca = `[e2e] Ciclo Caneca ${suf}`;
    await acrescentarPecaExclusiva(page, orcamentoId, nomeDaPeca, "100");

    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeEnabled();
    await expect(page.getByTestId("orcamento-falta-enviar")).toHaveCount(0);
  });

  test("(2) 'Marcar como enviado' congela: toast, chip âmbar com os dias restantes, e o cabeçalho vira texto", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page).toHaveURL(/aviso=orcamento-enviado/, { timeout: 10000 });
    await expect(page.getByText("Marcado como enviado. Preços e custos ficaram congelados.")).toBeVisible();

    // Validade padrão de 10 dias, orçamento acabado de enviar hoje: exatamente "vale mais 10
    // dia(s)" — determinístico, `validadeDias` nunca foi tocado por este teste.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("enviado · vale mais 10 dia(s)");

    // Congelamento visual (04.5-UI-SPEC.md): nenhum `input` sobra visível na tela inteira.
    await expect(page.locator("main").locator("input")).toHaveCount(0);
    await expect(page.getByTestId("orcamento-para-quem").locator("input")).toHaveCount(0);

    minimoAntesDoParametroNovo = (await page.getByTestId("orcamento-linha-minimo").first().textContent()) ?? "";
    totalAntesDoParametroNovo = (await page.getByTestId("orcamento-total").textContent()) ?? "";
    painelAntesDoParametroNovo = (await page.getByTestId("orcamento-so-para-voce").textContent()) ?? "";

    await expect(page.getByTestId("orcamento-aviso-congelado")).toContainText(
      "Mudar parâmetros depois não altera este orçamento.",
    );
  });

  test("(3) 🔴 mudar um parâmetro depois de enviado não altera nenhum número congelado; um rascunho novo já usa o valor novo", async ({
    page,
  }) => {
    await fazerLogin(page);

    const chave = chaveDoParametroDedicado();
    const novoValorTexto = "900";

    await page.goto("/cadastros?sub=parametros");
    const campo = page.getByTestId(`parametro-${chave}`).locator("input");
    await campo.fill(novoValorTexto);
    await blurEEsperarNavegacao(page, campo);
    await expect(page).toHaveURL(/\/cadastros\?sub=parametros$/);

    // O orçamento já enviado: total, mínimo da linha e o painel inteiro continuam EXATAMENTE os
    // mesmos de antes da mudança — é o coração do plano.
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-total")).toHaveText(totalAntesDoParametroNovo);
    await expect(page.getByTestId("orcamento-linha-minimo").first()).toHaveText(minimoAntesDoParametroNovo);
    await expect(page.getByTestId("orcamento-so-para-voce")).toHaveText(painelAntesDoParametroNovo);

    // Um rascunho NOVO, com a MESMA receita (mesma ficha), já usa o valor novo — o mínimo sobe.
    const novoOrcamentoId = await criarOrcamento(page);
    const nomeDaPecaNova = `[e2e] Ciclo Caneca Depois ${suf}`;
    await acrescentarPecaExclusiva(page, novoOrcamentoId, nomeDaPecaNova, "100");

    minimoComParametroNovo = (await page.getByTestId("orcamento-linha-minimo").first().textContent()) ?? "";
    expect(reaisParaCentavos(minimoComParametroNovo)).toBeGreaterThan(
      reaisParaCentavos(minimoAntesDoParametroNovo),
    );
  });

  test("(4) 'Voltar para rascunho' descongela: toast, chip neutro, campos editáveis, e o cálculo volta a usar os parâmetros de hoje", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    await page.getByRole("button", { name: "Voltar para rascunho" }).click();
    await expect(page).toHaveURL(/aviso=orcamento-reaberto/, { timeout: 10000 });
    await expect(page.getByText("Voltou para rascunho. O cálculo usa os parâmetros de hoje.")).toBeVisible();
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("rascunho");

    // Os campos voltaram a ser editáveis.
    await expect(page.getByTestId("orcamento-campo-cliente")).toBeVisible();

    // O cálculo ao vivo agora usa o parâmetro NOVO — o mesmo valor que o rascunho do caso (3)
    // calculou para a MESMA receita (mesmo parâmetro, mesma peça).
    await expect(page.getByTestId("orcamento-linha-minimo").first()).toHaveText(minimoComParametroNovo);
  });

  test("(5) 'Duplicar' a partir de um orçamento enviado: nasce um rascunho com número DIFERENTE, mesma peça e mesmo preço", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    // Reenvia (o caso (4) devolveu para rascunho) para testar "Duplicar" a partir de um enviado,
    // como o plano descreve.
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page).toHaveURL(/aviso=orcamento-enviado/, { timeout: 10000 });

    const numeroOriginalTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";

    await page.getByRole("button", { name: "Duplicar" }).click();
    await expect(page).toHaveURL(/aviso=orcamento-duplicado/, { timeout: 10000 });

    const numeroNovoTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";
    expect(numeroNovoTexto).not.toBe(numeroOriginalTexto);
    expect(numeroNovoTexto).toMatch(/^nº ORC-\d{4}-\d{3}$/);

    const numeroSemPrefixo = numeroNovoTexto.replace(/^nº /, "");
    await expect(page.getByText(`Cópia criada como rascunho nº ${numeroSemPrefixo}.`)).toBeVisible();

    // Rascunho novo: mesma peça, mesma quantidade × preço (editável de novo, por ser rascunho),
    // chip neutro.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("rascunho");
    const linhaDuplicada = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPeca });
    await expect(linhaDuplicada).toBeVisible();
    await expect(linhaDuplicada).toContainText("R$ 100,00");
    await expect(linhaDuplicada.getByTestId("orcamento-linha-quantidade")).toHaveValue("1");
    await expect(linhaDuplicada.getByTestId("orcamento-linha-preco")).toHaveValue("100,00");
  });

  test("(6) a 320px a barra de ações (5 botões, o estado 'enviado') não provoca rolagem horizontal e cada botão mede ao menos 44px", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-acoes")).toBeVisible();

    const larguraDeRolagem = await page.evaluate(() => document.documentElement.scrollWidth);
    const larguraDaJanela = await page.evaluate(() => document.documentElement.clientWidth);
    expect(larguraDeRolagem).toBeLessThanOrEqual(larguraDaJanela + 1);

    const botoes = page.getByTestId("orcamento-acoes").getByRole("button");
    const contagem = await botoes.count();
    expect(contagem).toBe(5);

    const alturas: number[] = [];
    const posicoesY: number[] = [];
    for (let indice = 0; indice < contagem; indice += 1) {
      const caixa = await botoes.nth(indice).boundingBox();
      expect(caixa, `botão ${indice}`).not.toBeNull();
      alturas.push(caixa!.height);
      posicoesY.push(caixa!.y);
    }
    for (const altura of alturas) {
      expect(altura).toBeGreaterThanOrEqual(44);
    }
    // "quebra em mais de uma fileira" — nem todo botão está na mesma linha vertical.
    expect(new Set(posicoesY).size).toBeGreaterThan(1);
  });

  test("(7) 'Recusou' marca vermelho sem descongelar — os números não mudam", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const totalAntes = (await page.getByTestId("orcamento-total").textContent()) ?? "";
    const minimoAntes = (await page.getByTestId("orcamento-linha-minimo").first().textContent()) ?? "";

    await page.getByRole("button", { name: "Recusou" }).click();
    await expect(page).toHaveURL(/aviso=orcamento-recusado/, { timeout: 10000 });
    await expect(page.getByText("Marcado como recusado.")).toBeVisible();
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("recusado");

    await expect(page.getByTestId("orcamento-total")).toHaveText(totalAntes);
    await expect(page.getByTestId("orcamento-linha-minimo").first()).toHaveText(minimoAntes);
  });
});

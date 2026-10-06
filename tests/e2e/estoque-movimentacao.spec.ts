import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  desativarNoBanco,
  ligarFichaDePrecificacao,
  movimentacoesDoItem,
  saldoNoBanco,
  semearMaterial,
  semearOrdemAtiva,
  vinculosDoItem,
} from "./apoio/semear-estoque";

// A folha de movimentação completa (plano 06-06): os 4 toques da baixa (EST-09), o ajuste pelo
// CONTADO (EST-07/EST-08), os cinco destinos e os vínculos (EST-11), a peça pronta com o custo da
// ficha (EST-21), a prévia "o saldo passa de X para Y" e o caminho pelo seletor "Qual material?".
// Cada teste semeia os SEUS materiais com sufixo único e os acha pelo `data-item-id` ou pela busca —
// nenhuma afirmação sobre o banco inteiro (CLAUDE.md). Nomes inventados, prefixo `[e2e]`.

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

const CATEGORIA_DE_COMPRA = "Argila, esmalte e insumos";

// Cartão (< 980px) ou linha da tabela (≥ 980px) — o que estiver visível na largura.
function cartaoDoItem(page: Page, itemId: string) {
  return page
    .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
    .filter({ visible: true });
}

function folhaDe(page: Page): Locator {
  return page.getByTestId("folha-movimentacao");
}

function atalho(folha: Locator, valor: number): Locator {
  return folha.locator(`[data-testid="folha-atalho"][data-valor="${valor}"]`);
}

async function abrirEstoque(page: Page) {
  await fazerLogin(page);
  await page.goto("/gestao/estoque");
  await expect(page.getByTestId("estoque-busca")).toBeVisible();
}

// Deixa o material com `contado` pelo AJUSTE — o livro só se escreve pela tela. Uma linha no livro.
async function ajustarPara(page: Page, itemId: string, nome: string, contado: string, un: string) {
  await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
  const folha = folhaDe(page);
  await folha.getByTestId("folha-tipo-ajuste").click();
  await folha.getByTestId("folha-contado").fill(contado);
  await folha.getByTestId("folha-registrar").click();
  await expect(page.getByText(`Ajuste em ${nome}: +${contado} ${un}.`)).toBeVisible();
  await expect(folha).toBeHidden();
  await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText(contado);
}

test.describe("estoque movimentacao", () => {
  test("(a) a baixa em 4 toques a partir da aba Saldos: Dar baixa, +1, Uso do ateliê, Registrar baixa", async ({
    page,
  }) => {
    const nome = `[e2e] Caneca ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);
    await ajustarPara(page, itemId, nome, "10", "un");

    const cartao = cartaoDoItem(page, itemId);
    const folha = folhaDe(page);

    // Toque 1 — a folha abre em Saída, com o material escolhido e SEM teclado.
    await cartao.getByTestId("estoque-dar-baixa").click();
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("folha-tipo-saida")).toHaveAttribute("aria-checked", "true");
    await expect(folha.getByTestId("folha-escolhido")).toContainText(nome);
    await expect(folha.getByTestId("folha-escolhido")).toContainText("saldo de agora: 10 un");
    if (test.info().project.name === "celular") {
      const focado = await page.evaluate(() => document.activeElement?.tagName ?? "");
      expect(["INPUT", "TEXTAREA", "SELECT"]).not.toContain(focado);
    }
    // Com o campo vazio, a frase neutra (UI-D8).
    await expect(folha.getByTestId("folha-previa")).toHaveText(
      "Digite a quantidade para ver o saldo novo.",
    );

    // Toque 2 — o atalho soma ao campo, e a prévia mostra o saldo novo (h).
    await atalho(folha, 1).click();
    await expect(folha.getByTestId("folha-quantidade")).toHaveValue("1");
    await expect(folha.getByTestId("folha-previa")).toContainText("O saldo passa de 10 para 9 un.");

    // Toque 3 — o destino.
    await folha.getByTestId("folha-destino-atelie").click();

    // Toque 4 — "Registrar baixa", no rodapé preso.
    await expect(folha.getByTestId("folha-registrar")).toHaveText("Registrar baixa");
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Baixa de 1 un em ${nome}.`)).toBeVisible();
    await expect(folha).toBeHidden();
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("9");
    expect(await saldoNoBanco(itemId)).toBe(9000);
  });

  test("(b) ajuste com o contado igual ao saldo: Conferido, e nenhuma linha nova", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);
    await ajustarPara(page, itemId, nome, "10", "kg");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(1);

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    await folha.getByTestId("folha-tipo-ajuste").click();
    // O ajuste pergunta o CONTADO — nunca a diferença; os atalhos não aparecem.
    await expect(folha.getByText("Quanto tem na prateleira agora?")).toBeVisible();
    await expect(folha.getByTestId("folha-atalho")).toHaveCount(0);
    await folha.getByTestId("folha-contado").fill("10");
    await expect(folha.getByTestId("folha-previa")).toHaveText(
      "O saldo já está certo. Nada será gravado.",
    );
    await expect(folha.getByTestId("folha-registrar")).toHaveText("Registrar ajuste");
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText("Conferido. O saldo já estava correto.")).toBeVisible();
    await expect(folha).toBeHidden();
    await page.waitForLoadState("networkidle");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(1);
    expect(await saldoNoBanco(itemId)).toBe(10000);
  });

  test("(c) ajuste com contado 0 zera o saldo e grava o contado 0", async ({ page }) => {
    const nome = `[e2e] Esmalte ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);
    await ajustarPara(page, itemId, nome, "10", "kg");

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    await folha.getByTestId("folha-tipo-ajuste").click();
    await folha.getByTestId("folha-contado").fill("0");
    await expect(folha.getByTestId("folha-previa")).toContainText("Diferença de −10 kg.");
    await folha.getByTestId("folha-motivo").fill("Prateleira vazia na conferência [e2e]");
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Ajuste em ${nome}: −10 kg.`)).toBeVisible();
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("0");
    expect(await saldoNoBanco(itemId)).toBe(0);
    const vinculos = await vinculosDoItem(itemId);
    expect(vinculos).toHaveLength(2);
    expect(vinculos[1].saldoContadoMilesimos).toBe(0);
    expect(vinculos[1].nota).toBe("Prateleira vazia na conferência [e2e]");
  });

  test("(d) ajuste com contado maior deixa o saldo igual ao contado", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);
    await ajustarPara(page, itemId, nome, "10", "kg");

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    await folha.getByTestId("folha-tipo-ajuste").click();
    await folha.getByTestId("folha-contado").fill("12,5");
    await expect(folha.getByTestId("folha-previa")).toContainText(
      "Diferença de +2,5 kg. O saldo passa de 10 para 12,5 kg.",
    );
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Ajuste em ${nome}: +2,5 kg.`)).toBeVisible();
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("12,5");
    expect(await saldoNoBanco(itemId)).toBe(12500);
    const vinculos = await vinculosDoItem(itemId);
    expect(vinculos[1].saldoContadoMilesimos).toBe(12500);
  });

  test("(e) a grade tem os cinco destinos, na ordem da constante, e pede um", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    const grade = folha.getByRole("radiogroup", { name: "Para onde foi?" });
    await expect(grade).toHaveAttribute("aria-required", "true");
    const destinos = grade.getByRole("radio");
    await expect(destinos).toHaveCount(5);
    await expect(destinos).toHaveText([
      "Consumo em aulaEspaço",
      "Consumo em encomendaPeças",
      "Consumo na cafeteriaCafeteria",
      "Uso do ateliêPeças",
      "Perda ou quebraPeças",
    ]);
    await expect(folha.getByText("Venda na loja")).toHaveCount(0);

    // Tocar de novo no marcado desmarca.
    const atelie = folha.getByTestId("folha-destino-atelie");
    await atelie.click();
    await expect(atelie).toHaveAttribute("aria-checked", "true");
    await atelie.click();
    await expect(atelie).toHaveAttribute("aria-checked", "false");

    // A cafeteria mostra a dica de que o vendido com ficha já sai pela venda.
    await folha.getByTestId("folha-destino-cafeteria").click();
    await expect(folha.getByTestId("folha-dica-cafeteria")).toContainText(
      "O que é vendido com ficha técnica já sai pela venda.",
    );
    await folha.getByTestId("folha-destino-cafeteria").click();

    // Sem destino: o aviso embaixo da grade, nunca um toast.
    await atalho(folha, 1).click();
    await folha.getByTestId("folha-registrar").click();
    const erro = folha.getByTestId("folha-erro");
    await expect(erro).toHaveText("Escolha para onde o material foi.");
    await expect(erro).toHaveAttribute("role", "alert");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(0);
  });

  test("(f) os vínculos: a ordem escolhida e a turma ficam gravados", async ({ page }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] Argila ${sufixo}`;
    const nomeDaOrdem = `[e2e] Ordem ${sufixo}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    // Fase 06.1: o vínculo aponta para a ORDEM de produção (aqui, da casa).
    const ordemId = await semearOrdemAtiva(nomeDaOrdem);
    await abrirEstoque(page);

    const folha = folhaDe(page);
    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    await atalho(folha, 1).click();
    await folha.getByTestId("folha-destino-encomenda").click();
    const seletorDeOrdem = folha.getByLabel("Qual ordem?");
    await expect(seletorDeOrdem).toHaveAttribute("data-testid", "folha-vinculo-encomenda");
    await expect(folha.getByText("opcional — ordens em andamento ou aguardando o sinal")).toBeVisible();
    // "Nenhuma" é a primeira opção — o vínculo é opcional.
    await expect(seletorDeOrdem.locator("option").first()).toHaveText("Nenhuma");
    await expect(seletorDeOrdem.locator(`option[value="${ordemId}"]`)).toHaveText(
      `${nomeDaOrdem} · da casa`,
    );
    await seletorDeOrdem.selectOption(ordemId);
    await folha.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Baixa de 1 kg em ${nome}.`)).toBeVisible();
    await expect(folha).toBeHidden();

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    await atalho(folha, 1).click();
    await folha.getByTestId("folha-destino-aula").click();
    await folha.getByTestId("folha-vinculo-turma").fill("Turma de terça [e2e]");
    await folha.getByTestId("folha-registrar").click();
    await expect(folha).toBeHidden();
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("−2");

    const linhas = await movimentacoesDoItem(itemId);
    const vinculos = await vinculosDoItem(itemId);
    expect(linhas.map((linha) => linha.destino)).toEqual(["encomenda", "aula"]);
    expect(linhas.map((linha) => linha.area)).toEqual(["pecas", "espaco"]);
    // `encomenda_id` do livro = id da ORDEM; a nota congela o nome dela.
    expect(vinculos[0]).toMatchObject({ encomendaId: ordemId, nota: nomeDaOrdem });
    expect(vinculos[1]).toMatchObject({ encomendaId: null, nota: "Turma de terça [e2e]" });
  });

  test("(g) peça pronta com ficha: custo preenchido que segue a quantidade até ser editado; sem ficha, vazio vale R$ 0", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nomePeca = `[e2e] Caneca pronta ${sufixo}`;
    const pecaId = await semearMaterial({
      nome: nomePeca,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await ligarFichaDePrecificacao(pecaId);
    const nomeComum = `[e2e] Argila ${sufixo}`;
    const comumId = await semearMaterial({
      nome: nomeComum,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await abrirEstoque(page);

    const folha = folhaDe(page);
    await cartaoDoItem(page, pecaId).getByTestId("estoque-dar-baixa").click();
    await folha.getByTestId("folha-tipo-entrada").click();
    // Peça pronta não leva a nota da compra.
    await expect(folha.getByTestId("folha-nota-compra")).toHaveCount(0);
    const custo = folha.getByTestId("folha-custo");
    await expect(custo).toHaveValue("");

    await folha.getByTestId("folha-quantidade").fill("1");
    await expect(custo).not.toHaveValue("");
    const porPeca = await custo.inputValue();
    await expect(folha.getByTestId("folha-custo-dica")).toContainText("Pela ficha de precificação:");
    await expect(folha.getByTestId("folha-custo-dica")).toContainText(porPeca);
    await expect(folha.getByTestId("folha-custo-dica")).toContainText("por peça. Pode mudar.");
    const centavosPorPeca = Math.round(Number(porPeca.replace(",", ".")) * 100);
    expect(centavosPorPeca).toBeGreaterThan(0);

    // Recalcula a cada mudança de quantidade...
    await folha.getByTestId("folha-quantidade").fill("2");
    await expect(custo).toHaveValue(((centavosPorPeca * 2) / 100).toFixed(2).replace(".", ","));
    // ...ATÉ a pessoa editar o custo: daí em diante fica o que ela digitou.
    await custo.fill("50,00");
    await folha.getByTestId("folha-quantidade").fill("3");
    await expect(custo).toHaveValue("50,00");
    await folha.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Entrada de 3 un em ${nomePeca}.`)).toBeVisible();
    await expect(folha).toBeHidden();
    const vinculosDaPeca = await vinculosDoItem(pecaId);
    expect(vinculosDaPeca[0].motivo).toBe("peca_pronta");
    expect((await movimentacoesDoItem(pecaId))[0].valorInformadoCentavos).toBe(5000);

    // A peça pronta com o custo APAGADO continua recusada (EST-21 não muda com a 06.5), com a
    // frase embaixo do campo.
    await cartaoDoItem(page, pecaId).getByTestId("estoque-dar-baixa").click();
    await folha.getByTestId("folha-tipo-entrada").click();
    await folha.getByTestId("folha-quantidade").fill("1");
    await expect(custo).not.toHaveValue("");
    await custo.fill("");
    await folha.getByTestId("folha-registrar").click();
    const erro = folha.getByTestId("folha-erro");
    await expect(erro).toHaveText("Diga quanto custou ao todo — é daí que sai o custo médio.");
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(custo).toBeFocused();
    expect(await movimentacoesDoItem(pecaId)).toHaveLength(1);
    await folha.getByTestId("folha-fechar").click();
    await expect(folha).toBeHidden();

    // Sem ficha: até 05/10/2026 o custo vazio era recusado com a mesma frase; desde a 06.5 (D-04)
    // ele vale R$ 0 — doação, sobra — e a entrada grava.
    await cartaoDoItem(page, comumId).getByTestId("estoque-dar-baixa").click();
    await folha.getByTestId("folha-tipo-entrada").click();
    await folha.getByTestId("folha-quantidade").fill("2");
    await expect(folha.getByTestId("folha-custo")).toHaveValue("");
    await folha.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Entrada de 2 kg em ${nomeComum}.`)).toBeVisible();
    await expect(folha).toBeHidden();
    const linhasDaComum = await movimentacoesDoItem(comumId);
    expect(linhasDaComum).toHaveLength(1);
    expect(linhasDaComum[0].valorInformadoCentavos).toBe(0);
  });

  test("(h) saída maior que o saldo avisa na prévia, não bloqueia e grava", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    await atalho(folha, 2).click();
    await atalho(folha, 1).click();
    await expect(folha.getByTestId("folha-quantidade")).toHaveValue("3");
    const previa = folha.getByTestId("folha-previa");
    await expect(previa).toContainText("O saldo passa de 0 para −3 un.");
    await expect(previa).toContainText("Isso deixa o saldo negativo — só registre se tiver certeza.");
    await folha.getByTestId("folha-destino-perda").click();
    await folha.getByTestId("folha-vinculo-perda").fill("Caiu da prateleira [e2e]");
    await expect(folha.getByTestId("folha-registrar")).toBeEnabled();
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Baixa de 3 un em ${nome}. O saldo ficou em −3 un.`)).toBeVisible();
    expect(await saldoNoBanco(itemId)).toBe(-3000);
    expect((await vinculosDoItem(itemId))[0].nota).toBe("Caiu da prateleira [e2e]");
  });

  test("(i) Registrar movimentação abre o seletor; busca, escolha e folha com o material; desativado não aparece", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] Argila seletor ${sufixo}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    const desativadoId = await semearMaterial({
      nome: `[e2e] Argila desativada ${sufixo}`,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await desativarNoBanco(desativadoId);
    await abrirEstoque(page);

    const noCelular = (page.viewportSize()?.width ?? 0) < 768;
    if (noCelular) {
      await expect(page.getByTestId("estoque-registrar-movimentacao")).toBeHidden();
      await page.getByTestId("estoque-acao-fixa").click();
    } else {
      await expect(page.getByTestId("estoque-acao-fixa")).toBeHidden();
      await page.getByTestId("estoque-registrar-movimentacao").click();
    }

    const seletor = page.getByTestId("seletor-material");
    await expect(seletor).toBeVisible();
    await expect(seletor.getByRole("heading", { name: "Qual material?" })).toBeVisible();
    if (noCelular) {
      const focado = await page.evaluate(() => document.activeElement?.tagName ?? "");
      expect(focado).not.toBe("INPUT");
    } else {
      await expect(seletor.getByTestId("seletor-busca")).toBeFocused();
    }

    // Busca sem resultado.
    await seletor.getByTestId("seletor-busca").fill(`nada-disso-${sufixo}`);
    await expect(seletor.getByText("Nenhum material com esse nome")).toBeVisible();
    await expect(seletor.getByText("Confira a escrita, ou toque em Tudo.")).toBeVisible();

    // Busca pelo sufixo: só o ativo.
    await seletor.getByTestId("seletor-busca").fill(sufixo);
    await expect(seletor.getByTestId("seletor-contador")).toHaveText("1 material encontrado");
    await expect(seletor.locator(`[data-testid="seletor-linha"][data-item-id="${desativadoId}"]`)).toHaveCount(0);
    await seletor.locator(`[data-testid="seletor-linha"][data-item-id="${itemId}"]`).click();

    const folha = folhaDe(page);
    await expect(seletor).toBeHidden();
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("folha-escolhido")).toContainText(nome);
    await expect(folha.getByTestId("folha-tipo-saida")).toHaveAttribute("aria-checked", "true");

    // "Trocar material" volta ao seletor mantendo o tipo.
    await folha.getByTestId("folha-tipo-entrada").click();
    await folha.getByTestId("folha-trocar-material").click();
    await expect(folha).toBeHidden();
    await expect(seletor).toBeVisible();
    await seletor.getByTestId("seletor-busca").fill(sufixo);
    await seletor.locator(`[data-testid="seletor-linha"][data-item-id="${itemId}"]`).click();
    await expect(folha.getByTestId("folha-tipo-entrada")).toHaveAttribute("aria-checked", "true");
  });

  test("(j) a entrada de material comum mostra a nota da compra com o link", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    await expect(folha.getByTestId("folha-nota-compra")).toHaveCount(0);
    await folha.getByTestId("folha-tipo-entrada").click();
    const nota = folha.getByTestId("folha-nota-compra");
    await expect(nota).toContainText(
      "Comprou? Lance em Financeiro → Despesa → Compra de material — ela já dá entrada aqui sozinha.",
    );
    await expect(nota.getByRole("link", { name: "Ir para Compra de material" })).toHaveAttribute(
      "href",
      "/gestao/financeiro?aba=despesa",
    );
  });

  test("(k) um duplo clique em Registrar ajuste grava UMA linha só", async ({ page }) => {
    const nome = `[e2e] Argila ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    await abrirEstoque(page);

    await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
    const folha = folhaDe(page);
    await folha.getByTestId("folha-tipo-ajuste").click();
    await folha.getByTestId("folha-contado").fill("5");
    await folha.getByTestId("folha-registrar").dblclick();

    await expect(page.getByText(`Ajuste em ${nome}: +5 kg.`)).toBeVisible();
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("5");
    await page.waitForLoadState("networkidle");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(1);
    expect(await saldoNoBanco(itemId)).toBe(5000);
  });
});

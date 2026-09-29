import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  movimentacoesDoItem,
  nomeDoUsuario,
  semearMaterial,
  semearMovimentacoesEmMassa,
} from "./apoio/semear-estoque";
import { semearItem } from "./apoio/semear-financeiro";

// As abas Histórico e Para onde foi, e a barra que as liga (plano 06-07): o livro legível — cada
// entrada, saída e ajuste com quem fez e quando, inclusive o que veio do Financeiro, sem nenhuma
// forma de mexer no passado (EST-05, EST-06, EST-16) — e quanto de material cada área consumiu,
// sem contar venda cancelada (D-12, D-31, Pitfall 15).
//
// O livro é GLOBAL e os testes rodam em paralelo (desktop e celular, e os outros arquivos do
// Estoque): cada teste acha as SUAS linhas pelo `data-item-id` do material que semeou, e o
// Histórico é aberto com `limite=1000` quando a afirmação depende de as linhas estarem na página —
// outro teste pode gravar 50 linhas no meio. Condição global do banco ("nada registrado", "nenhuma
// saída") só no caso `@vazio-global`, que roda na cadeia `vazio-*` antes de qualquer semeadura.
// Valores exatos das barras ficam para o `@vazio-historico` do plano 06-10. Nomes inventados,
// prefixo `[e2e]`.

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

function linhasDoItem(page: Page, itemId: string): Locator {
  return page.locator(`[data-testid="historico-linha"][data-item-id="${itemId}"]`);
}

function linhaDeNumero(page: Page, numero: number): Locator {
  return page.locator(`[data-testid="historico-linha"][data-numero="${numero}"]`);
}

// O Histórico com as 1000 mais recentes — a página inteira do teto (T-06-28) —, para as linhas do
// teste estarem nela mesmo com outros testes gravando em paralelo.
async function abrirHistoricoLongo(page: Page, tipo?: "entrada" | "saida" | "ajuste") {
  const filtro = tipo ? `&tipo=${tipo}` : "";
  await page.goto(`/gestao/estoque?aba=historico${filtro}&limite=1000`);
  await expect(page.getByTestId("historico-lista")).toBeVisible();
}

// Registra uma movimentação pela folha, a partir do cartão do material na aba Saldos.
async function registrarPelaFolha(
  page: Page,
  itemId: string,
  dados:
    | { tipo: "entrada"; quantidade: string; custo: string }
    | { tipo: "saida"; quantidade: string; destino: string; oQueAconteceu?: string }
    | { tipo: "ajuste"; contado: string },
) {
  await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
  const folha = page.getByTestId("folha-movimentacao");
  await expect(folha).toBeVisible();
  await folha.getByTestId(`folha-tipo-${dados.tipo}`).click();
  if (dados.tipo === "entrada") {
    await folha.getByTestId("folha-quantidade").fill(dados.quantidade);
    await folha.getByTestId("folha-custo").fill(dados.custo);
  } else if (dados.tipo === "saida") {
    await folha.getByTestId("folha-quantidade").fill(dados.quantidade);
    await folha.getByTestId(`folha-destino-${dados.destino}`).click();
    if (dados.oQueAconteceu) {
      await folha.getByTestId("folha-vinculo-perda").fill(dados.oQueAconteceu);
    }
  } else {
    await folha.getByTestId("folha-contado").fill(dados.contado);
  }
  await folha.getByTestId("folha-registrar").click();
  await expect(folha).toBeHidden({ timeout: 10000 });
}

// Um produto de venda com ficha técnica de UM insumo (molde de `estoque-financeiro.spec.ts`).
async function semearProdutoComFicha(dados: {
  nome: string;
  insumoId: string;
  quantidade: string;
}): Promise<string> {
  return semearItem({
    nome: dados.nome,
    categoriaVenda: "Peças prontas",
    precoCentavos: 5000,
    apareceNaVenda: true,
    atalhoVenda: false,
    controlaEstoque: false,
    atalhoCompra: false,
    ficha: [{ insumoId: dados.insumoId, quantidade: dados.quantidade }],
  });
}

async function venderPelaTela(page: Page, busca: string, nome: string) {
  await page.goto("/gestao/financeiro");
  await page.getByTestId("venda-busca").fill(busca);
  await page.getByTestId("venda-atalho").filter({ hasText: nome }).click();
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  const botao = page.getByRole("button", { name: "Lançar venda" });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

async function cancelarVendaPeloCaixa(page: Page, texto: string) {
  await page.goto("/gestao/financeiro?aba=caixa");
  const linha = page.getByTestId("extrato-linha").filter({ hasText: texto });
  await expect(linha).toBeVisible();
  await linha.getByTestId("extrato-ver").click();
  const detalhe = page.getByTestId("documento-detalhe");
  await expect(detalhe).toBeVisible();
  const numero = /nº (\d+)/.exec(await detalhe.innerText())?.[1] ?? "";
  await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancelar venda", exact: true })
    .click();
  await expect(
    page.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`),
  ).toBeVisible({ timeout: 10000 });
  return numero;
}

test.describe("estoque abas", () => {
  // Afirma uma condição GLOBAL do banco (livro vazio) — só vale na cadeia `vazio-celular →
  // vazio-desktop`, que roda ANTES de qualquer teste que semeie material. Só leitura.
  test("(a) sem nada no livro, o Histórico diz Nada registrado ainda e o Para onde foi, Nenhuma saída no período @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);

    await page.goto("/gestao/estoque?aba=historico");
    await expect(page.getByTestId("estoque-aba-historico")).toHaveAttribute("aria-selected", "true");
    const vazioHistorico = page.getByTestId("historico-vazio");
    await expect(vazioHistorico).toBeVisible();
    await expect(
      vazioHistorico.getByRole("heading", { name: "Nada registrado ainda", level: 2 }),
    ).toBeVisible();
    await expect(vazioHistorico).toContainText("inclusive o que vem das vendas e compras do Financeiro");
    await expect(page.getByTestId("historico-contador")).toHaveText("0 movimentações");
    await expect(page.getByTestId("historico-linha")).toHaveCount(0);

    await page.goto("/gestao/estoque?aba=destino");
    await expect(page.getByTestId("estoque-aba-destino")).toHaveAttribute("aria-selected", "true");
    const vazioDestino = page.getByTestId("destino-vazio");
    await expect(vazioDestino).toBeVisible();
    await expect(
      vazioDestino.getByRole("heading", { name: "Nenhuma saída no período", level: 2 }),
    ).toBeVisible();
    // Período de 30 dias: "Ver tudo" leva ao período inteiro, que também está vazio (sem o botão).
    await vazioDestino.getByRole("link", { name: "Ver tudo" }).click();
    await expect(page).toHaveURL(/periodo=tudo/);
    await expect(page.getByTestId("destino-periodo-tudo")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("destino-vazio")).toBeVisible();
    await expect(page.getByTestId("destino-vazio").getByRole("link", { name: "Ver tudo" })).toHaveCount(0);
    await expect(page.getByTestId("destino-total")).toHaveText(/R\$\s0,00/);
    await expect(page.getByTestId("destino-barra")).toHaveCount(0);
  });

  test("(b) entrada, saída e ajuste pela folha aparecem no Histórico com quem fez e quando; a pílula Saídas filtra", async ({
    page,
  }) => {
    const nome = `[e2e] Argila do histórico ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    const autor = await nomeDoUsuario(process.env.E2E_EMAIL_TESTE ?? "");
    expect(autor).not.toBe("");

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await registrarPelaFolha(page, itemId, { tipo: "entrada", quantidade: "10", custo: "50,00" });
    await registrarPelaFolha(page, itemId, {
      tipo: "saida",
      quantidade: "2",
      destino: "perda",
      oQueAconteceu: "caiu da prateleira",
    });
    await registrarPelaFolha(page, itemId, { tipo: "ajuste", contado: "9" });

    const livro = await movimentacoesDoItem(itemId);
    expect(livro.map((linha) => linha.tipo)).toEqual(["entrada", "saida", "ajuste"]);
    const [entrada, saida, ajuste] = livro;

    await page.getByTestId("estoque-aba-historico").click();
    await expect(page).toHaveURL(/aba=historico/);
    await expect(page.getByTestId("estoque-aba-historico")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("estoque-aba-saldos")).toHaveAttribute("aria-selected", "false");

    await abrirHistoricoLongo(page);
    const linhas = linhasDoItem(page, itemId);
    await expect(linhas).toHaveCount(3);
    // Mais novas primeiro, pela ordem de gravação (`numero` decrescente).
    await expect(linhas.nth(0)).toHaveAttribute("data-numero", String(ajuste.numero));
    await expect(linhas.nth(1)).toHaveAttribute("data-numero", String(saida.numero));
    await expect(linhas.nth(2)).toHaveAttribute("data-numero", String(entrada.numero));

    const quando = new RegExp(`^Hoje, \\d{2}:\\d{2} · ${autor}$`);
    for (let indice = 0; indice < 3; indice++) {
      await expect(linhas.nth(indice).getByTestId("historico-material")).toHaveText(nome);
      await expect(linhas.nth(indice).getByTestId("historico-quando")).toHaveText(quando);
    }

    const linhaEntrada = linhaDeNumero(page, entrada.numero);
    await expect(linhaEntrada.getByTestId("historico-quantidade")).toHaveText("+10");
    await expect(linhaEntrada.getByTestId("historico-quantidade")).toHaveAttribute("data-tom", "sucesso");
    await expect(linhaEntrada.getByTestId("historico-detalhe")).toHaveText(
      /^Entrada · R\$\s50,00 · R\$\s5,00\/kg$/,
    );

    const linhaSaida = linhaDeNumero(page, saida.numero);
    await expect(linhaSaida.getByTestId("historico-quantidade")).toHaveText("−2");
    await expect(linhaSaida.getByTestId("historico-quantidade")).toHaveAttribute("data-tom", "tinta");
    await expect(linhaSaida.getByTestId("historico-detalhe")).toHaveText(
      /^Perda ou quebra · paga por Peças · caiu da prateleira · R\$\s10,00$/,
    );
    await expect(linhaSaida.getByTestId("historico-chip")).toHaveText(["Perda"]);

    // O ajuste leva o sentido da diferença (8 → 9 = +1) em terracota.
    const linhaAjuste = linhaDeNumero(page, ajuste.numero);
    await expect(linhaAjuste.getByTestId("historico-quantidade")).toHaveText("+1");
    await expect(linhaAjuste.getByTestId("historico-quantidade")).toHaveAttribute("data-tom", "acento");
    await expect(linhaAjuste.getByTestId("historico-detalhe")).toHaveText(
      "Ajuste de conferência · contado 9 kg na prateleira",
    );

    // (d) EST-06: a lista é texto — nenhum botão, link ou menu dentro dela.
    const lista = page.getByTestId("historico-lista");
    await expect(lista.locator("button, a, [role=menu], [role=menuitem], [draggable=true]")).toHaveCount(0);
    await expect(page.getByText("Nada aqui pode ser apagado nem editado.")).toBeVisible();

    // A pílula Saídas: marcada, na URL, e entre as linhas deste material só a saída.
    await page.getByTestId("historico-pilula-saida").click();
    await expect(page).toHaveURL(/tipo=saida/);
    await expect(page.getByTestId("historico-pilula-saida")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("historico-pilula-tudo")).not.toHaveAttribute("aria-current", "true");
    await abrirHistoricoLongo(page, "saida");
    await expect(linhasDoItem(page, itemId)).toHaveCount(1);
    await expect(linhasDoItem(page, itemId)).toHaveAttribute("data-numero", String(saida.numero));
  });

  test("(c) venda cancelada deixa as duas linhas: a original Estornada e o estorno do Financeiro (EST-16)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const argila = await semearMaterial({
      nome: `[e2e] Argila da venda cancelada ${suf}`,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    const nomeCaneca = `[e2e] Caneca cancelada ${suf}`;
    await semearProdutoComFicha({ nome: nomeCaneca, insumoId: argila, quantidade: "0.08" });

    await fazerLogin(page);
    await venderPelaTela(page, suf, nomeCaneca);
    const numeroDaVenda = await cancelarVendaPeloCaixa(page, nomeCaneca);

    const livro = await movimentacoesDoItem(argila);
    expect(livro).toHaveLength(2);
    const [saida, estorno] = livro;
    expect(estorno.estornoDeId).toBe(saida.id);

    await abrirHistoricoLongo(page);
    // As duas ficam, lado a lado na ordem do livro: o estorno (mais novo) em cima.
    const linhas = linhasDoItem(page, argila);
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(0)).toHaveAttribute("data-numero", String(estorno.numero));
    await expect(linhas.nth(1)).toHaveAttribute("data-numero", String(saida.numero));

    const original = linhaDeNumero(page, saida.numero);
    await expect(original.getByTestId("historico-chip")).toHaveText([
      "Venda",
      "do Financeiro",
      "Estornada",
    ]);
    await expect(original.getByTestId("historico-quantidade")).toHaveText("−0,08");
    await expect(original.getByTestId("historico-detalhe")).toHaveText(
      new RegExp(`^Vendido · venda nº ${numeroDaVenda} · paga por Peças · R\\$\\s0,00$`),
    );

    const linhaDoEstorno = linhaDeNumero(page, estorno.numero);
    await expect(linhaDoEstorno.getByTestId("historico-chip")).toHaveText(["Estorno", "do Financeiro"]);
    await expect(linhaDoEstorno.getByTestId("historico-quantidade")).toHaveText("+0,08");
    await expect(linhaDoEstorno.getByTestId("historico-detalhe")).toHaveText(
      new RegExp(`^Estorno · venda nº ${numeroDaVenda} cancelada · R\\$\\s0,00$`),
    );

    // (d) EST-06 também aqui, com linhas do Financeiro na página.
    await expect(
      page.getByTestId("historico-lista").locator("button, a, [role=menu]"),
    ).toHaveCount(0);
  });

  test("(e) o Para onde foi tem sempre seis barras, com Vendido · pelo Financeiro, e a perda do teste pesa na barra dela", async ({
    page,
  }) => {
    const nome = `[e2e] Argila da perda ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await registrarPelaFolha(page, itemId, { tipo: "entrada", quantidade: "10", custo: "50,00" });
    await registrarPelaFolha(page, itemId, { tipo: "saida", quantidade: "1", destino: "perda" });

    await page.getByTestId("estoque-aba-destino").click();
    await expect(page).toHaveURL(/aba=destino/);
    await expect(page.getByTestId("destino-periodo-30")).toHaveAttribute("aria-current", "true");

    const barras = page.getByTestId("destino-barra");
    await expect(barras).toHaveCount(6);
    await expect(barras.filter({ hasText: "Vendido · pelo Financeiro" })).toHaveCount(1);
    for (let indice = 0; indice < 6; indice++) {
      const grafico = barras.nth(indice).getByRole("img");
      await expect(grafico).toHaveCount(1);
      await expect(grafico).toHaveAttribute("aria-label", /: R\$\s[\d.,]+, \d+% do período$/);
    }

    // A perda deste teste vale R$ 5,00 (1 kg a R$ 5,00/kg) — o total da barra, global, é maior que 0.
    const perda = page.locator('[data-testid="destino-barra"][data-destino="perda"]');
    const valor = Number(await perda.getAttribute("data-valor-centavos"));
    expect(valor).toBeGreaterThanOrEqual(500);
    await expect(perda.getByRole("img")).toHaveAttribute("aria-label", /^Perda ou quebra: R\$/);

    // Ordem decrescente de valor.
    const valores = await barras.evaluateAll((elementos) =>
      elementos.map((elemento) => Number(elemento.getAttribute("data-valor-centavos"))),
    );
    expect(valores).toEqual([...valores].sort((a, b) => b - a));

    await expect(page.getByTestId("destino-total")).toBeVisible();
    await expect(page.getByText("Como o valor é calculado.")).toBeVisible();

    // Os três períodos são links da URL.
    await page.getByTestId("destino-periodo-90").click();
    await expect(page).toHaveURL(/periodo=90/);
    await expect(page.getByTestId("destino-periodo-90")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("destino-barra")).toHaveCount(6);
  });

  test("(f) com 51 entradas a mais, a pílula Entradas mostra 50 linhas e Mostrar mais 50 leva a no máximo 100", async ({
    page,
  }) => {
    const nome = `[e2e] Argila em massa ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    await semearMovimentacoesEmMassa(itemId, 51, process.env.E2E_EMAIL_TESTE ?? "");
    expect(await movimentacoesDoItem(itemId)).toHaveLength(51);

    await fazerLogin(page);
    await page.goto("/gestao/estoque?aba=historico");
    await page.getByTestId("historico-pilula-entrada").click();
    await expect(page).toHaveURL(/tipo=entrada/);
    await expect(page.getByTestId("historico-pilula-entrada")).toHaveAttribute("aria-current", "true");

    const linhas = page.getByTestId("historico-linha");
    await expect(linhas).toHaveCount(50);
    const mais = page.getByTestId("historico-mais");
    await expect(mais).toBeVisible();
    await expect(mais).toHaveText("Mostrar mais 50");

    await mais.click();
    await expect(page).toHaveURL(/limite=100/);
    await expect.poll(() => linhas.count()).toBeGreaterThan(50);
    expect(await linhas.count()).toBeLessThanOrEqual(100);
    // Todas as linhas do filtro são entradas.
    const tons = await page
      .getByTestId("historico-quantidade")
      .evaluateAll((elementos) => elementos.map((elemento) => elemento.getAttribute("data-tom")));
    expect(new Set(tons)).toEqual(new Set(["sucesso"]));
  });

  test("(g) ?aba=xyz mostra Saldos, e as abas têm aria-selected coerente", async ({ page }) => {
    await semearMaterial({
      nome: `[e2e] Argila das abas ${sufixoUnico()}`,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });

    await fazerLogin(page);
    await page.goto("/gestao/estoque?aba=xyz");
    const barra = page.getByRole("tablist", { name: "Ver" });
    await expect(barra).toBeVisible();
    await expect(barra.getByRole("tab")).toHaveText(["Saldos", "Histórico", "Para onde foi"]);
    await expect(page.getByTestId("estoque-aba-saldos")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("estoque-aba-historico")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("estoque-aba-destino")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("estoque-busca")).toBeVisible();

    await page.getByTestId("estoque-aba-destino").click();
    await expect(page).toHaveURL(/aba=destino/);
    await expect(page.getByTestId("estoque-aba-destino")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("estoque-aba-saldos")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("estoque-busca")).toHaveCount(0);

    await page.getByTestId("estoque-aba-saldos").click();
    await expect(page.getByTestId("estoque-aba-saldos")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("estoque-busca")).toBeVisible();
  });

  test("(h) a 320px, Histórico e Para onde foi não rolam na horizontal, nem com vínculo de 160 letras", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] ${sufixo} argila de alta temperatura para torno e modelagem manual `
      .repeat(3)
      .slice(0, 120)
      .trim();
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    const vinculo = "a prateleira de cima cedeu e derrubou os sacos no chão molhado do ateliê "
      .repeat(3)
      .slice(0, 160)
      .trim();

    await page.setViewportSize({ width: 320, height: 720 });
    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await registrarPelaFolha(page, itemId, { tipo: "entrada", quantidade: "1234,567", custo: "123456,78" });
    await registrarPelaFolha(page, itemId, {
      tipo: "saida",
      quantidade: "1",
      destino: "perda",
      oQueAconteceu: vinculo,
    });

    async function semRolagemHorizontal(): Promise<boolean> {
      return page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
    }

    await abrirHistoricoLongo(page);
    await expect(linhasDoItem(page, itemId)).toHaveCount(2);
    await expect(page.getByTestId("estoque-aba-destino")).toBeVisible();
    expect(await semRolagemHorizontal()).toBe(true);

    await page.goto("/gestao/estoque?aba=destino");
    await expect(page.getByTestId("destino-barra")).toHaveCount(6);
    expect(await semRolagemHorizontal()).toBe(true);
  });

  test("(i) no Histórico, Registrar movimentação abre o seletor e a folha grava — e a linha nova aparece", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nome = `[e2e] Argila pelo histórico ${sufixo}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque?aba=historico");
    await expect(page.getByTestId("estoque-aba-historico")).toHaveAttribute("aria-selected", "true");

    const noCelular = (page.viewportSize()?.width ?? 0) < 768;
    if (noCelular) {
      await page.getByTestId("estoque-acao-fixa").click();
    } else {
      await page.getByTestId("estoque-registrar-movimentacao").click();
    }

    const seletor = page.getByTestId("seletor-material");
    await expect(seletor).toBeVisible();
    await seletor.getByTestId("seletor-busca").fill(sufixo);
    await expect(seletor.getByTestId("seletor-contador")).toHaveText("1 material encontrado");
    await seletor.locator(`[data-testid="seletor-linha"][data-item-id="${itemId}"]`).click();

    const folha = page.getByTestId("folha-movimentacao");
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("folha-escolhido")).toContainText(nome);
    await folha.getByTestId("folha-tipo-entrada").click();
    await folha.getByTestId("folha-quantidade").fill("3");
    await folha.getByTestId("folha-custo").fill("9,00");
    await folha.getByTestId("folha-registrar").click();

    await expect(page.getByText(`Entrada de 3 kg em ${nome}.`)).toBeVisible();
    await expect(folha).toBeHidden();
    expect(await movimentacoesDoItem(itemId)).toHaveLength(1);

    // Continua no Histórico; a linha gravada está no livro. (Aberto com o teto de 1000: um teste em
    // paralelo pode gravar 50 linhas entre a gravação e a leitura.)
    await expect(page).toHaveURL(/aba=historico/);
    await expect(page.getByTestId("estoque-aba-historico")).toHaveAttribute("aria-selected", "true");
    await abrirHistoricoLongo(page);
    await expect(linhasDoItem(page, itemId)).toHaveCount(1);
    await expect(linhasDoItem(page, itemId).getByTestId("historico-quantidade")).toHaveText("+3");
  });
});

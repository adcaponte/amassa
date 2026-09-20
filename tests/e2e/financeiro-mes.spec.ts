import { test, expect, type Page } from "@playwright/test";

import { ultimoDiaDoMes, mesSeguinte } from "@/lib/financeiro/calendario";

import { buscarCategoriaPorNome, garantirTaxaDeTeste, semearItem, TAXA_DE_TESTE } from "./apoio/semear-financeiro";
import { diaDoMes, mesReservado } from "./apoio/mes-reservado";

// A tela Mês completa (04.4-09-PLAN.md, Tarefa 3): quanto cada área deixou, o Geral num bloco só
// com a taxa do cartão, o veredito, o dinheiro que se mexeu e o fora do resultado (FNC-11) — cada
// caso no PRÓPRIO mês reservado (`mes-reservado.ts`), nenhuma afirmação de número global do banco.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function esperarVendaLancada(page: Page) {
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

// NUNCA `toHaveURL(/\?aba=despesa/)` — a Despesa parte de `/financeiro?aba=despesa` (o fragmento
// já é verdade ANTES de qualquer ação), então essa checagem não provaria nada (mesma classe de
// achado real documentada em `04.4-08-SUMMARY.md`: asserção de URL trivialmente verdadeira). O
// TOAST "Despesa nº N lançada" só aparece depois da navegação de sucesso — é o sinal real.
async function esperarDespesaLancada(page: Page) {
  await expect(page.getByText(/^Despesa nº \d+ lançada/)).toBeVisible({ timeout: 10000 });
}

async function irParaMes(page: Page, mes: string) {
  await page.goto(`/financeiro?aba=mes&mes=${mes}`);
}

async function lancarVendaLivre(
  page: Page,
  {
    data,
    descricao,
    categoria,
    valor,
    forma,
  }: { data: string; descricao: string; categoria: string; valor: string; forma: "Pix" | "Dinheiro" | "Cartão" },
) {
  await page.goto("/financeiro");
  // `page.goto` só espera o evento `load` — a hidratação do React (que anexa o `onChange` do
  // campo "Data" controlado) roda um instante depois, ainda mais sob 8 workers disputando CPU.
  // Sem esta espera, `.fill()` no campo pode escrever o valor no DOM ANTES do handler existir; o
  // React, ao hidratar, sobrescreve de volta para o valor do próprio estado (hoje) — o documento
  // nasce com a data ERRADA sem nenhum erro reportado (mesmo achado de `encomendas-filtros.spec.ts`).
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByLabel("Data").fill(data);
  await page.getByRole("button", { name: "+ Valor livre" }).click();
  await page.getByLabel("O que é").fill(descricao);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: categoria }).click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page.getByRole("button", { name: "Pôr na venda" }).click();
  await page.getByRole("button", { name: forma, exact: true }).click();
  await page.getByRole("button", { name: "Lançar venda" }).click();
  await esperarVendaLancada(page);
}

async function lancarDespesaOutra(
  page: Page,
  {
    data,
    descricao,
    categoria,
    valor,
    forma,
  }: { data: string; descricao: string; categoria: string; valor: string; forma: "Pix" | "Dinheiro" | "Cartão" },
) {
  await page.goto("/financeiro?aba=despesa");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByTestId("despesa-modo-outra").click();
  await page.getByLabel("Data").fill(data);
  await page.getByLabel("Descrição").fill(descricao);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: categoria, exact: true }).click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page.getByRole("button", { name: forma, exact: true }).click();
  await page.getByRole("button", { name: "Lançar despesa" }).click();
  await esperarDespesaLancada(page);
}

function areaDaTabela(page: Page, area: string) {
  return page.getByTestId(`mes-area-${area}`);
}

test.describe("financeiro mes", () => {
  test("a aba Mês existe e navega por mês", async ({ page }) => {
    const mes = mesReservado("mes-vazio", test.info().project.name);
    await fazerLogin(page);
    await irParaMes(page, mes);
    await expect(page.getByTestId("financeiro-aba-mes")).toBeVisible();
    await expect(page.getByTestId("mes-nav")).toBeVisible();
  });

  test("mês vazio: as quatro áreas zeradas, Geral e Fora vazios, veredito sobrou R$ 0,00", async ({ page }) => {
    const mes = mesReservado("mes-vazio", test.info().project.name);
    await fazerLogin(page);
    await irParaMes(page, mes);

    for (const area of ["cafeteria", "espaco", "pecas", "loja"]) {
      await expect(areaDaTabela(page, area)).toContainText("R$ 0,00");
    }
    await expect(page.getByText("Nenhum custo geral lançado neste mês.")).toBeVisible();
    await expect(page.getByText("Nada neste mês.")).toBeVisible();
    await expect(page.getByTestId("mes-veredito")).toContainText("Sobrou R$ 0,00 no mês.");
  });

  test("áreas (critério 1 do ROADMAP): venda de três áreas paga no Pix aparece cada valor na sua área", async ({
    page,
  }) => {
    await buscarCategoriaPorNome("Bebidas e comidas");
    await buscarCategoriaPorNome("Peças prontas");
    await buscarCategoriaPorNome("Materiais e papelaria");

    const mes = mesReservado("mes-areas", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    const nomeCafe = `[e2e] Mês café ${suf}`;
    const nomePeca = `[e2e] Mês peça ${suf}`;
    const nomeLoja = `[e2e] Mês loja ${suf}`;
    await semearItem({
      nome: nomeCafe,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomePeca,
      categoriaVenda: "Peças prontas",
      precoCentavos: 22000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeLoja,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 1400,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/financeiro");
    await page.getByLabel("Data").fill(diaDoMes(mes, 10));
    await page.getByTestId("venda-busca").fill(suf);
    await page.getByTestId("venda-atalho").filter({ hasText: nomeCafe }).click();
    await page.getByTestId("venda-atalho").filter({ hasText: nomePeca }).click();
    await page.getByTestId("venda-atalho").filter({ hasText: nomeLoja }).click();
    await page.getByRole("button", { name: "Pix", exact: true }).click();
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await esperarVendaLancada(page);

    await irParaMes(page, mes);
    await expect(areaDaTabela(page, "cafeteria")).toContainText("R$ 8,00");
    await expect(areaDaTabela(page, "pecas")).toContainText("R$ 220,00");
    await expect(areaDaTabela(page, "loja")).toContainText("R$ 14,00");
    await expect(areaDaTabela(page, "espaco")).toContainText("R$ 0,00");
    await expect(page.getByTestId("mes-juntas")).toContainText("R$ 242,00");
  });

  test("custo e veredito: compra de material da Loja e despesa de Aluguel", async ({ page }) => {
    await buscarCategoriaPorNome("Mercadoria para revenda");
    await buscarCategoriaPorNome("Aluguel");
    await buscarCategoriaPorNome("Materiais e papelaria");

    const mes = mesReservado("mes-custo-veredito", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    const nomeVenda = `[e2e] Mês venda loja ${suf}`;
    const nomeMaterial = `[e2e] Mês material loja ${suf}`;
    await semearItem({
      nome: nomeVenda,
      categoriaVenda: "Materiais e papelaria",
      precoCentavos: 5000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    await semearItem({
      nome: nomeMaterial,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "kg",
      categoriaCompra: "Mercadoria para revenda",
      atalhoCompra: false,
    });

    await fazerLogin(page);

    await lancarVendaLivre(page, {
      data: diaDoMes(mes, 5),
      descricao: nomeVenda,
      categoria: "Materiais e papelaria",
      valor: "50",
      forma: "Pix",
    });

    await page.goto("/financeiro?aba=despesa");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByTestId("despesa-modo-compra").click();
    await page.getByLabel("Data").fill(diaDoMes(mes, 8));
    await page.getByTestId("compra-busca").fill(suf);
    await page.getByTestId("compra-atalho").filter({ hasText: nomeMaterial }).click();
    await page.getByTestId("compra-custou").fill("300");
    await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
    await page.getByRole("button", { name: "Lançar despesa" }).click();
    await esperarDespesaLancada(page);

    await lancarDespesaOutra(page, {
      data: diaDoMes(mes, 9),
      descricao: `[e2e] Mês aluguel ${suf}`,
      categoria: "Aluguel",
      valor: "150",
      forma: "Dinheiro",
    });

    await irParaMes(page, mes);
    await expect(areaDaTabela(page, "loja")).toContainText("R$ 50,00"); // Vendeu
    await expect(areaDaTabela(page, "loja")).toContainText("R$ 300,00"); // Custou
    await expect(areaDaTabela(page, "loja")).toContainText("-R$ 250,00"); // Deixou negativo (formatarReais nativo)
    await expect(page.getByTestId("mes-geral-linha").filter({ hasText: "Aluguel" })).toContainText("R$ 150,00");
    await expect(page.getByTestId("mes-veredito")).toContainText("Faltaram R$ 400,00 para o mês se pagar.");
  });

  test('taxa: venda no cartão vira "Taxa do cartão" no Geral', async ({ page }) => {
    await garantirTaxaDeTeste();
    await buscarCategoriaPorNome("Bebidas e comidas");

    const mes = mesReservado("mes-taxa", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    await fazerLogin(page);
    await lancarVendaLivre(page, {
      data: diaDoMes(mes, 6),
      descricao: `[e2e] Mês taxa ${suf}`,
      categoria: "Bebidas e comidas",
      valor: "1000",
      forma: "Cartão",
    });

    await irParaMes(page, mes);
    const taxaEsperadaCentavos = Math.round((100000 * TAXA_DE_TESTE) / 10000); // 3,5% de R$1000
    const taxaFormatada = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      taxaEsperadaCentavos / 100,
    );
    await expect(page.getByTestId("mes-geral-linha").filter({ hasText: "Taxa do cartão" })).toContainText(
      taxaFormatada,
    );
  });

  test('fora: "Equipamento e obra" de despesa e "Aporte dos sócios" de venda, sem mexer no veredito', async ({
    page,
  }) => {
    await buscarCategoriaPorNome("Equipamento e obra");
    await buscarCategoriaPorNome("Aporte dos sócios");

    const mes = mesReservado("mes-fora", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    await fazerLogin(page);
    await lancarDespesaOutra(page, {
      data: diaDoMes(mes, 3),
      descricao: `[e2e] Mês equipamento ${suf}`,
      categoria: "Equipamento e obra",
      valor: "2000",
      forma: "Dinheiro",
    });
    await lancarVendaLivre(page, {
      data: diaDoMes(mes, 4),
      descricao: `[e2e] Mês aporte ${suf}`,
      categoria: "Aporte dos sócios",
      valor: "5000",
      forma: "Pix",
    });

    await irParaMes(page, mes);
    await expect(page.getByTestId("mes-fora-linha").filter({ hasText: "Equipamento e obra" })).toContainText(
      "− R$ 2.000,00",
    );
    await expect(page.getByTestId("mes-fora-linha").filter({ hasText: "Aporte dos sócios" })).toContainText(
      "+ R$ 5.000,00",
    );
    // Nenhum dos dois é custo geral nem vendeu de área — o veredito continua "sobrou R$ 0,00".
    await expect(page.getByTestId("mes-veredito")).toContainText("Sobrou R$ 0,00 no mês.");
  });

  test("cancelado: cancelar uma venda do mês tira o valor dela do Mês", async ({ page }) => {
    await buscarCategoriaPorNome("Bebidas e comidas");

    const mes = mesReservado("mes-cancelado", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;
    const descricao = `[e2e] Mês cancelado ${suf}`;

    await fazerLogin(page);
    await lancarVendaLivre(page, {
      data: diaDoMes(mes, 12),
      descricao,
      categoria: "Bebidas e comidas",
      valor: "999",
      forma: "Pix",
    });

    // Antes de cancelar, a venda já conta na área.
    await irParaMes(page, mes);
    await expect(areaDaTabela(page, "cafeteria")).toContainText("R$ 999,00");

    // Cancela pelo extrato do MESMO mês reservado (nunca uma afirmação global).
    await page.goto(`/financeiro?aba=caixa&mes=${mes}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    const linha = page.getByTestId("extrato-linha").filter({ hasText: descricao });
    await linha.getByTestId("extrato-ver").click();
    const detalhe = page.getByTestId("documento-detalhe");
    await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar venda", exact: true }).click();
    await expect(page.getByText("cancelado. Continua visível, riscado.")).toBeVisible({ timeout: 10000 });

    await irParaMes(page, mes);
    await expect(areaDaTabela(page, "cafeteria")).toContainText("R$ 0,00");
  });

  test("fronteira: venda no último dia do mês conta nele, não no seguinte", async ({ page }) => {
    await buscarCategoriaPorNome("Bebidas e comidas");

    const mes = mesReservado("mes-fronteira", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;
    const [ano, mesNumero] = mes.split("-").map(Number);
    const ultimoDia = ultimoDiaDoMes(ano, mesNumero);
    const proximoMes = mesSeguinte(mes);

    await fazerLogin(page);
    await lancarVendaLivre(page, {
      data: diaDoMes(mes, ultimoDia),
      descricao: `[e2e] Mês fronteira último dia ${suf}`,
      categoria: "Bebidas e comidas",
      valor: "42",
      forma: "Pix",
    });
    await lancarVendaLivre(page, {
      data: `${proximoMes}-01`,
      descricao: `[e2e] Mês fronteira mês seguinte ${suf}`,
      categoria: "Bebidas e comidas",
      valor: "9999",
      forma: "Pix",
    });

    await irParaMes(page, mes);
    // Só a venda do último dia conta — a do dia 1 do mês seguinte (R$ 9.999,00) NÃO aparece aqui,
    // senão o total explodiria para R$ 10.041,00.
    await expect(areaDaTabela(page, "cafeteria")).toContainText("R$ 42,00");
  });

  test("a 320px, a barra de cinco pílulas não rola na horizontal e a página do Mês também não", async ({ page }) => {
    const mes = mesReservado("mes-vazio", test.info().project.name);
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await irParaMes(page, mes);

    const pilulas = page.getByRole("tab");
    await expect(pilulas).toHaveCount(5);
    for (const pilula of await pilulas.all()) {
      const altura = await pilula.evaluate((elemento) => elemento.getBoundingClientRect().height);
      expect(altura).toBeGreaterThanOrEqual(44);
    }

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Mês rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

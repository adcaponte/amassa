import { test, expect, type Locator, type Page } from "@playwright/test";

import { semearVendaSemMovimentacao } from "./apoio/semear-documento-antigo";
import { movimentacoesDoItem, saldoNoBanco, semearMaterial } from "./apoio/semear-estoque";
import { semearItem } from "./apoio/semear-financeiro";

// O Financeiro GRAVA o efeito no estoque (plano 06-03, critério 7 do ROADMAP): a venda baixa, a
// compra dá entrada, o cancelamento estorna — dentro da transação do próprio documento. Cada caso
// semeia os próprios itens com sufixo único, lança PELA TELA e confere o livro no banco — nenhuma
// afirmação global do banco (CLAUDE.md). Nomes inventados com prefixo `[e2e]`.

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

function cartaoDoItem(page: Page, itemId: string) {
  // Cartão (< 980px) e linha da tabela (≥ 980px) levam o mesmo `data-testid` desde o plano 06-04;
  // só um dos dois está visível em cada largura.
  return page
    .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
    .filter({ visible: true });
}

// Um produto de venda com ficha técnica de UM insumo.
async function semearProdutoComFicha(dados: {
  nome: string;
  categoriaVenda: string;
  precoCentavos: number;
  insumoId: string;
  quantidade: string;
}): Promise<string> {
  return semearItem({
    nome: dados.nome,
    categoriaVenda: dados.categoriaVenda,
    precoCentavos: dados.precoCentavos,
    apareceNaVenda: true,
    atalhoVenda: false,
    controlaEstoque: false,
    atalhoCompra: false,
    ficha: [{ insumoId: dados.insumoId, quantidade: dados.quantidade }],
  });
}

// Lança uma venda pela tela: busca pelo sufixo, toca cada item quantas vezes pedir (o mesmo item
// tocado de novo soma quantidade), paga em dinheiro e espera a navegação de sucesso — o fragmento
// estável "aba=venda" (ver `esperarVendaLancada` em `financeiro-venda.spec.ts`).
async function venderPelaTela(page: Page, busca: string, itens: { nome: string; vezes: number }[]) {
  await page.goto("/gestao/financeiro");
  await page.getByTestId("venda-busca").fill(busca);
  for (const item of itens) {
    for (let vez = 0; vez < item.vezes; vez++) {
      await page.getByTestId("venda-atalho").filter({ hasText: item.nome }).click();
    }
  }
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  const botao = page.getByRole("button", { name: "Lançar venda" });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

// Lança uma compra de material pela tela, uma linha.
async function comprarPelaTela(page: Page, nome: string, quantos: string, custou: string) {
  await page.goto("/gestao/financeiro?aba=despesa");
  await page.getByTestId("despesa-modo-compra").click();
  await page.getByTestId("compra-busca").fill(nome);
  await page.getByTestId("compra-atalho").filter({ hasText: nome }).click();
  await page.getByTestId("compra-quantos").fill(quantos);
  await page.getByTestId("compra-custou").fill(custou);
  const botao = page.getByRole("button", { name: "Lançar despesa" });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page).toHaveURL(/\?aba=despesa/, { timeout: 10000 });
  await expect(page.getByText(/^Despesa nº \d+ lançada/)).toBeVisible({ timeout: 5000 });
}

// Cancela pelo Caixa, a partir da linha do extrato: "Ver" → "Cancelar esta venda/despesa" →
// confirmação → o TOAST (o sinal real de que o servidor respondeu — ver `financeiro-caixa.spec.ts`).
async function cancelarPeloCaixa(page: Page, linha: Locator, tipo: "venda" | "despesa") {
  await expect(linha).toBeVisible();
  await linha.getByTestId("extrato-ver").click();
  const detalhe = page.getByTestId("documento-detalhe");
  await expect(detalhe).toBeVisible();
  const numero = /nº (\d+)/.exec(await detalhe.innerText())?.[1] ?? "";
  await detalhe.getByRole("button", { name: `Cancelar esta ${tipo}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: `Cancelar ${tipo}`, exact: true })
    .click();
  await expect(
    page.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`),
  ).toBeVisible({ timeout: 10000 });
}

function linhaDoExtrato(page: Page, texto: string) {
  return page.getByTestId("extrato-linha").filter({ hasText: texto });
}

test.describe("estoque financeiro", () => {
  test("(a) a venda de 2 canecas baixa 0,16 kg de argila, na área da categoria de venda, e o negativo não bloqueia", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const argila = await semearMaterial({
      nome: `[e2e] Argila ${suf}`,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    const nomeCaneca = `[e2e] Caneca ${suf}`;
    await semearProdutoComFicha({
      nome: nomeCaneca,
      categoriaVenda: "Peças prontas",
      precoCentavos: 5000,
      insumoId: argila,
      quantidade: "0.08",
    });

    await fazerLogin(page);
    await venderPelaTela(page, suf, [{ nome: nomeCaneca, vezes: 2 }]);

    const linhas = await movimentacoesDoItem(argila);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      origem: "venda",
      tipo: "saida",
      area: "pecas",
      destino: null,
      quantidadeMilesimos: -160,
      // Sem nenhuma entrada no livro, a saída vale zero (D-26) — nunca NaN.
      valorCentavos: 0,
      valorInformadoCentavos: null,
      estornoDeId: null,
    });
    expect(linhas[0].documentoId).not.toBeNull();
    expect(linhas[0].documentoLinhaId).not.toBeNull();

    await page.goto("/gestao/estoque");
    await expect(cartaoDoItem(page, argila).getByTestId("estoque-cartao-saldo")).toHaveText("−0,16");
  });

  test("(b) o mesmo insumo em dois produtos de áreas diferentes gera duas saídas, cada uma com a sua área", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const argila = await semearMaterial({
      nome: `[e2e] Argila ${suf}`,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    const nomeCaneca = `[e2e] Caneca ${suf}`;
    const nomeXicara = `[e2e] Xícara do café ${suf}`;
    await semearProdutoComFicha({
      nome: nomeCaneca,
      categoriaVenda: "Peças prontas",
      precoCentavos: 5000,
      insumoId: argila,
      quantidade: "0.08",
    });
    await semearProdutoComFicha({
      nome: nomeXicara,
      categoriaVenda: "Bebidas e comidas",
      precoCentavos: 1200,
      insumoId: argila,
      quantidade: "0.05",
    });

    await fazerLogin(page);
    await venderPelaTela(page, suf, [
      { nome: nomeCaneca, vezes: 1 },
      { nome: nomeXicara, vezes: 1 },
    ]);

    const linhas = await movimentacoesDoItem(argila);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((linha) => [linha.area, linha.quantidadeMilesimos])).toEqual([
      ["pecas", -80],
      ["cafeteria", -50],
    ]);
    expect(linhas[0].documentoId).toBe(linhas[1].documentoId);
    expect(linhas[0].documentoLinhaId).not.toBe(linhas[1].documentoLinhaId);
    expect(await saldoNoBanco(argila)).toBe(-130);
  });

  test("(c) a compra de 25 kg por R$ 125,00 dá entrada de 25 kg com o valor da nota", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Argila para compra ${suf}`;
    const argila = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await comprarPelaTela(page, nome, "25", "125");

    const linhas = await movimentacoesDoItem(argila);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      origem: "compra",
      tipo: "entrada",
      area: null,
      quantidadeMilesimos: 25000,
      valorCentavos: 12500,
      valorInformadoCentavos: 12500,
      estornoDeId: null,
    });
    expect(linhas[0].documentoLinhaId).not.toBeNull();

    await page.goto("/gestao/estoque");
    await expect(cartaoDoItem(page, argila).getByTestId("estoque-cartao-saldo")).toHaveText("25");
  });

  test("(d) comprar 25 kg com o saldo em −1 kg reprecifica pela regra R3", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Argila negativa ${suf}`;
    const argila = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    const nomeBloco = `[e2e] Bloco de 1 kg ${suf}`;
    await semearProdutoComFicha({
      nome: nomeBloco,
      categoriaVenda: "Peças prontas",
      precoCentavos: 3000,
      insumoId: argila,
      quantidade: "1",
    });

    await fazerLogin(page);
    await venderPelaTela(page, suf, [{ nome: nomeBloco, vezes: 1 }]);
    expect(await saldoNoBanco(argila)).toBe(-1000);

    await comprarPelaTela(page, nome, "25", "125");

    const linhas = await movimentacoesDoItem(argila);
    expect(linhas).toHaveLength(2);
    const compra = linhas[1];
    expect(compra).toMatchObject({ origem: "compra", tipo: "entrada", quantidadeMilesimos: 25000 });
    // R3: vinha de −1 kg (valor 0) e ficou em +24 kg — o custo vira o da nota: 24 × 125/25 = 120,00.
    expect(compra.valorInformadoCentavos).toBe(12500);
    expect(compra.valorCentavos).toBe(12000);
    expect(compra.valorCentavos).not.toBe(12500);
    expect(await saldoNoBanco(argila)).toBe(24000);
  });

  test("(e) uma venda só de valor livre não grava movimentação nenhuma", async ({ page }) => {
    const suf = sufixoUnico();
    const argila = await semearMaterial({
      nome: `[e2e] Argila intocada ${suf}`,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });

    await fazerLogin(page);
    await page.goto("/gestao/financeiro");
    await page.getByRole("button", { name: "+ Valor livre" }).click();
    await page.getByLabel("O que é").fill(`[e2e] Valor livre ${suf}`);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aporte dos sócios" }).click();
    await page.getByLabel("Valor", { exact: true }).fill("50");
    await page.getByRole("button", { name: "Pôr na venda" }).click();
    await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });

    expect(await movimentacoesDoItem(argila)).toHaveLength(0);
  });
  test("(f) cancelar a venda devolve ao insumo exatamente o que ela tirou, com as duas linhas no livro (D-23)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeArgila = `[e2e] Argila do estorno ${suf}`;
    const argila = await semearMaterial({
      nome: nomeArgila,
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    const nomeCaneca = `[e2e] Caneca do estorno ${suf}`;
    await semearProdutoComFicha({
      nome: nomeCaneca,
      categoriaVenda: "Peças prontas",
      precoCentavos: 5000,
      insumoId: argila,
      quantidade: "0.08",
    });

    await fazerLogin(page);
    await comprarPelaTela(page, nomeArgila, "25", "125");
    expect(await saldoNoBanco(argila)).toBe(25000);

    await venderPelaTela(page, suf, [{ nome: nomeCaneca, vezes: 2 }]);
    expect(await saldoNoBanco(argila)).toBe(24840);

    await page.goto("/gestao/financeiro?aba=caixa");
    await cancelarPeloCaixa(page, linhaDoExtrato(page, nomeCaneca), "venda");

    // O saldo volta ao de antes da venda — e nada foi apagado: compra, saída e estorno no livro.
    expect(await saldoNoBanco(argila)).toBe(25000);
    const linhas = await movimentacoesDoItem(argila);
    expect(linhas).toHaveLength(3);
    const [, saida, estorno] = linhas;
    expect(saida).toMatchObject({ origem: "venda", tipo: "saida", quantidadeMilesimos: -160 });
    // 160 g de 25 kg que custaram R$ 125,00 → R$ 0,80.
    expect(saida.valorCentavos).toBe(-80);
    expect(estorno).toMatchObject({
      origem: "venda",
      tipo: "entrada",
      quantidadeMilesimos: 160,
      // D-23: volta ao custo que a venda levou.
      valorCentavos: 80,
      valorInformadoCentavos: 80,
      area: saida.area,
      estornoDeId: saida.id,
      documentoId: saida.documentoId,
      documentoLinhaId: saida.documentoLinhaId,
    });

    await page.goto("/gestao/estoque");
    await expect(cartaoDoItem(page, argila).getByTestId("estoque-cartao-saldo")).toHaveText("25");
  });

  test("(g) cancelar uma compra já consumida em parte sai ao custo médio corrente, sem valor de sinal trocado (D-24)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeCopo = `[e2e] Copo para pintar ${suf}`;
    const copo = await semearItem({
      nome: nomeCopo,
      categoriaVenda: "Peças para pintar",
      precoCentavos: 4500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await comprarPelaTela(page, nomeCopo, "10", "30");
    await venderPelaTela(page, suf, [{ nome: nomeCopo, vezes: 4 }]);
    expect(await saldoNoBanco(copo)).toBe(6000);

    await page.goto("/gestao/financeiro?aba=caixa");
    // O nome do copo aparece na compra E na venda — a compra é a linha de saída de dinheiro.
    await cancelarPeloCaixa(
      page,
      linhaDoExtrato(page, nomeCopo).filter({ hasText: /−\s*R\$/ }),
      "despesa",
    );

    const linhas = await movimentacoesDoItem(copo);
    expect(linhas).toHaveLength(3);
    const [compra, venda, estorno] = linhas;
    expect(compra).toMatchObject({ origem: "compra", tipo: "entrada", quantidadeMilesimos: 10000, valorCentavos: 3000 });
    expect(venda).toMatchObject({ origem: "venda", tipo: "saida", quantidadeMilesimos: -4000, valorCentavos: -1200 });
    // D-24: a saída do estorno vale 10 un ao custo médio do instante (R$ 18,00 / 6 un = R$ 3,00).
    expect(estorno).toMatchObject({
      origem: "compra",
      tipo: "saida",
      quantidadeMilesimos: -10000,
      valorCentavos: -3000,
      valorInformadoCentavos: null,
      area: null,
      estornoDeId: compra.id,
      documentoId: compra.documentoId,
    });
    const quantidade = linhas.reduce((soma, linha) => soma + linha.quantidadeMilesimos, 0);
    const valor = linhas.reduce((soma, linha) => soma + linha.valorCentavos, 0);
    expect(quantidade).toBe(-4000);
    expect(valor).toBe(-1200);
    // O valor nunca tem o sinal trocado em relação à quantidade.
    expect(Math.sign(valor) === Math.sign(quantidade) || valor === 0).toBe(true);
  });

  test("(h) cancelar uma venda de antes do Estoque funciona e não inventa movimentação (EST-17/D-05)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const copo = await semearItem({
      nome: `[e2e] Copo antigo ${suf}`,
      categoriaVenda: "Peças para pintar",
      precoCentavos: 4500,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: CATEGORIA_DE_COMPRA,
      atalhoCompra: false,
    });
    const descricao = `[e2e] Venda antiga ${suf}`;
    await semearVendaSemMovimentacao({
      itemId: copo,
      categoria: "Peças para pintar",
      quantidade: 2,
      valorCentavos: 9000,
      descricao,
    });
    expect(await movimentacoesDoItem(copo)).toHaveLength(0);

    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=caixa");
    await cancelarPeloCaixa(page, linhaDoExtrato(page, descricao), "venda");

    await expect(linhaDoExtrato(page, descricao)).toContainText("cancelada");
    expect(await movimentacoesDoItem(copo)).toHaveLength(0);
    expect(await saldoNoBanco(copo)).toBe(0);
  });
});

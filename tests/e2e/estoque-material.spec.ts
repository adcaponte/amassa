import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  movimentacoesDoItem,
  saldoNoBanco,
  semearMaterial,
  semearMovimentacoesEmMassa,
} from "./apoio/semear-estoque";
import { semearItem } from "./apoio/semear-financeiro";

// O material de perto (plano 06-09): a folha de um material — o resumo, o "Gasto por" e o livro
// DELE, onde a soma das quantidades listadas bate com o saldo do cartão (EST-10, critério 6 do
// ROADMAP) — e o material novo pelo Estoque. Cada teste semeia os próprios materiais com sufixo
// único e os acha pelo `data-item-id`; nenhuma afirmação global do banco (CLAUDE.md). Nomes
// inventados com prefixo `[e2e]` — nenhum dado real.

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

// "+5", "−2", "−0,16", "+1.234,5" → milésimos inteiros. A tela usa vírgula decimal, ponto de
// milhar e o sinal de menos TIPOGRÁFICO; a conta do teste é em inteiros, como a do sistema
// (EST-10 · precision).
function paraMilesimos(texto: string): number {
  const limpo = texto.trim();
  const negativo = limpo.startsWith("−") || limpo.startsWith("-");
  const numero = limpo.replace(/^[+−-]/, "").replace(/\./g, "").replace(",", ".");
  const milesimos = Math.round(Number(numero) * 1000);
  if (Number.isNaN(milesimos)) {
    throw new Error(`Quantidade ilegível: "${texto}"`);
  }
  return negativo ? -milesimos : milesimos;
}

async function abrirFolhaDoMaterial(page: Page, itemId: string): Promise<Locator> {
  await cartaoDoItem(page, itemId).getByTestId("estoque-historico-material").click();
  const folha = page.getByTestId("folha-material");
  await expect(folha).toBeVisible();
  // Espera a leitura: o esqueleto some e o resumo aparece.
  await expect(folha.getByTestId("folha-material-resumo")).toBeVisible();
  return folha;
}

// A soma das quantidades listadas na folha, em milésimos.
async function somaDaFolha(folha: Locator): Promise<number> {
  const textos = await folha.getByTestId("historico-quantidade").allInnerTexts();
  return textos.reduce((soma, texto) => soma + paraMilesimos(texto), 0);
}

// Entrada, saída ou ajuste pela folha de movimentação, a partir do "Dar baixa" do cartão.
async function movimentarPelaFolha(
  page: Page,
  itemId: string,
  pedido:
    | { tipo: "entrada"; quantidade: string; custo: string }
    | { tipo: "saida"; quantidade: string; destino: string }
    | { tipo: "ajuste"; contado: string },
) {
  await cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa").click();
  const folha = page.getByTestId("folha-movimentacao");
  await expect(folha).toBeVisible();
  if (pedido.tipo === "entrada") {
    await folha.getByTestId("folha-tipo-entrada").click();
    await folha.getByTestId("folha-quantidade").fill(pedido.quantidade);
    await folha.getByTestId("folha-custo").fill(pedido.custo);
  } else if (pedido.tipo === "saida") {
    await folha.getByTestId("folha-quantidade").fill(pedido.quantidade);
    await folha.getByTestId(`folha-destino-${pedido.destino}`).click();
  } else {
    await folha.getByTestId("folha-tipo-ajuste").click();
    await folha.getByTestId("folha-contado").fill(pedido.contado);
  }
  await folha.getByTestId("folha-registrar").click();
  await expect(folha).toBeHidden();
}

// Lança uma venda pela tela (molde de `estoque-financeiro.spec.ts`).
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

// Cancela a venda pelo Caixa e espera o toast (o sinal de que o servidor respondeu).
async function cancelarVendaPeloCaixa(page: Page, textoDaLinha: string) {
  await page.goto("/gestao/financeiro?aba=caixa");
  const linha = page.getByTestId("extrato-linha").filter({ hasText: textoDaLinha });
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
}

test.describe("estoque material folha", () => {
  test("(a) EST-10: entrada, saída, ajuste e uma venda cancelada — a soma da folha é o saldo do cartão", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Argila da soma ${suf}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });
    const nomeCaneca = `[e2e] Caneca da soma ${suf}`;
    await semearItem({
      nome: nomeCaneca,
      categoriaVenda: "Peças prontas",
      precoCentavos: 5000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: itemId, quantidade: "0.08" }],
    });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await movimentarPelaFolha(page, itemId, { tipo: "entrada", quantidade: "5", custo: "21,00" });
    await movimentarPelaFolha(page, itemId, { tipo: "saida", quantidade: "2", destino: "atelie" });
    await movimentarPelaFolha(page, itemId, { tipo: "ajuste", contado: "2,5" });

    await venderPelaTela(page, suf, nomeCaneca);
    await cancelarVendaPeloCaixa(page, nomeCaneca);
    // Entrada, saída, ajuste, a baixa da venda e o estorno dela: cinco linhas; nada se apagou.
    expect(await movimentacoesDoItem(itemId)).toHaveLength(5);
    expect(await saldoNoBanco(itemId)).toBe(2500);

    await page.goto("/gestao/estoque");
    const saldoDoCartao = paraMilesimos(
      await cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo").innerText(),
    );
    expect(saldoDoCartao).toBe(2500);

    const folha = await abrirFolhaDoMaterial(page, itemId);
    await expect(folha.getByTestId("historico-linha")).toHaveCount(5);
    // A venda cancelada deixa as duas linhas na folha (EST-10 · adjacency), que se anulam.
    await expect(folha.getByTestId("historico-chip").filter({ hasText: "Estornada" })).toHaveCount(1);
    await expect(folha.getByTestId("historico-chip").filter({ hasText: /^Estorno$/ })).toHaveCount(1);
    expect(await somaDaFolha(folha)).toBe(saldoDoCartao);
    await expect(folha.getByTestId("folha-material-saldo")).toHaveText("2,5");
    await expect(folha.getByTestId("folha-material-nota-soma")).toHaveText(
      "Somando de cima para baixo você chega ao saldo de 2,5 kg. É assim que o sistema calcula — não há outra fonte.",
    );
    // A linha da folha não repete o nome do material (ele já está no cabeçalho).
    await expect(folha.getByTestId("historico-material")).toHaveCount(0);
    // A ordem é a do livro: a mais recente (o estorno) primeiro.
    const numeros = await folha
      .getByTestId("historico-linha")
      .evaluateAll((linhas) => linhas.map((linha) => Number(linha.getAttribute("data-numero"))));
    expect([...numeros].sort((a, b) => b - a)).toEqual(numeros);
  });

  test("(b) EST-10: com o saldo negativo e uma movimentação só, a soma continua batendo", async ({
    page,
  }) => {
    const nome = `[e2e] Esmalte negativo ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await movimentarPelaFolha(page, itemId, { tipo: "saida", quantidade: "1,5", destino: "perda" });
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("−1,5");

    const folha = await abrirFolhaDoMaterial(page, itemId);
    await expect(folha.getByTestId("historico-linha")).toHaveCount(1);
    expect(await somaDaFolha(folha)).toBe(-1500);
    await expect(folha.getByTestId("folha-material-saldo")).toHaveText("−1,5");
    await expect(folha.getByTestId("folha-material-resumo")).toHaveAttribute("data-alerta", "negativo");
    await expect(folha.getByTestId("folha-material-nota-soma")).toContainText("saldo de −1,5 kg");
  });

  test("(c) EST-20: o insumo de duas fichas mostra o Gasto por em ordem de nome; o que não é insumo não tem a seção", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const insumo = await semearMaterial({
      nome: `[e2e] Grão de café ${suf}`,
      unidade: "g",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    const outro = await semearMaterial({
      nome: `[e2e] Barbante ${suf}`,
      unidade: "m",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    // Semeados fora de ordem: a folha ordena por nome.
    for (const [produto, quantidade] of [
      [`[e2e] Café refil ${suf}`, "30"],
      [`[e2e] Café 200 ml ${suf}`, "15"],
    ] as const) {
      await semearItem({
        nome: produto,
        categoriaVenda: "Peças prontas",
        precoCentavos: 900,
        apareceNaVenda: true,
        atalhoVenda: false,
        controlaEstoque: false,
        atalhoCompra: false,
        ficha: [{ insumoId: insumo, quantidade }],
      });
    }

    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    const folha = await abrirFolhaDoMaterial(page, insumo);
    const gastoPor = folha.getByTestId("folha-material-gasto-por");
    await expect(gastoPor).toBeVisible();
    await expect(folha.getByTestId("folha-material-gasto-por-lista")).toHaveText(
      `[e2e] Café 200 ml ${suf} (15 g) · [e2e] Café refil ${suf} (30 g)`,
    );
    await expect(gastoPor.getByRole("link", { name: "Editar fichas em Cadastros → Catálogo" })).toBeVisible();
    await folha.getByTestId("folha-material-fechar").click();
    await expect(folha).toBeHidden();

    const folhaDoOutro = await abrirFolhaDoMaterial(page, outro);
    await expect(folhaDoOutro.getByTestId("folha-material-gasto-por")).toHaveCount(0);
  });

  test("(d) material sem movimentação: “Nenhuma movimentação”, saldo 0 e o rodapé já tem Registrar movimentação", async ({
    page,
  }) => {
    const nome = `[e2e] Embalagem nova ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const folha = await abrirFolhaDoMaterial(page, itemId);

    const vazio = folha.getByTestId("folha-material-vazio");
    await expect(vazio).toBeVisible();
    await expect(vazio.getByRole("heading", { name: "Nenhuma movimentação" })).toBeVisible();
    await expect(vazio).toContainText(
      "Este material foi cadastrado, mas ainda não entrou nem saiu nada.",
    );
    await expect(folha.getByTestId("folha-material-saldo")).toHaveText("0");
    await expect(folha.getByTestId("folha-material-lista")).toHaveCount(0);
    await expect(folha.getByTestId("folha-material-registrar")).toBeVisible();
    // Sem observações, a caixa não aparece.
    await expect(folha.getByTestId("folha-material-observacoes")).toHaveCount(0);
  });

  test("(e) com 51 movimentações: 50 linhas e Mostrar mais 50, sem a nota da soma; depois, as 51 e a nota", async ({
    page,
  }) => {
    const nome = `[e2e] Argila em massa da folha ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    await semearMovimentacoesEmMassa(itemId, 51, process.env.E2E_EMAIL_TESTE ?? "");

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const folha = await abrirFolhaDoMaterial(page, itemId);

    await expect(folha.getByTestId("historico-linha")).toHaveCount(50);
    const mais = folha.getByTestId("folha-material-mais");
    await expect(mais).toHaveText("Mostrar mais 50");
    // Com a lista parcial, somar não dá o saldo — a nota não pode aparecer.
    await expect(folha.getByTestId("folha-material-nota-soma")).toHaveCount(0);

    await mais.click();
    await expect(folha.getByTestId("historico-linha")).toHaveCount(51);
    await expect(folha.getByTestId("folha-material-mais")).toHaveCount(0);
    await expect(folha.getByTestId("folha-material-nota-soma")).toContainText("saldo de 51 un");
    expect(await somaDaFolha(folha)).toBe(51000);
  });

  test("(f) o botão Histórico do cartão diz de qual material é", async ({ page }) => {
    const nome = `[e2e] Pincel ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    const botao = cartaoDoItem(page, itemId).getByTestId("estoque-historico-material");
    await expect(botao).toHaveAttribute("aria-label", `Histórico de ${nome}`);
    await expect(botao).toHaveText("Histórico");
    await expect(page.getByRole("button", { name: `Histórico de ${nome}` })).toBeVisible();
  });

  test("(g) Registrar movimentação do rodapé abre a folha de movimentação em Saída para o material", async ({
    page,
  }) => {
    const nome = `[e2e] Esmalte azul ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const folha = await abrirFolhaDoMaterial(page, itemId);
    await folha.getByTestId("folha-material-registrar").click();

    await expect(folha).toBeHidden();
    const movimentacao = page.getByTestId("folha-movimentacao");
    await expect(movimentacao).toBeVisible();
    await expect(movimentacao.getByTestId("folha-tipo-saida")).toHaveAttribute("aria-checked", "true");
    await expect(movimentacao.getByTestId("folha-escolhido")).toContainText(nome);
  });
});

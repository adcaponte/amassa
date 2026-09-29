import { test, expect, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";

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

// ---------------------------------------------------------------------------------------------
// "+ Novo material", "Editar material" e desativar pelo Estoque (Tarefa 2).
// ---------------------------------------------------------------------------------------------

// Quantos itens do catálogo têm estas observações — para provar que um cadastro recusado não gravou
// nada (o nome, vazio, não serve para achar a linha). Só leitura.
async function itensComObservacoes(observacoes: string): Promise<number> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    const resultado = await cliente.query<{ quantos: string }>(
      "select count(*) as quantos from itens_catalogo where observacoes = $1",
      [observacoes],
    );
    return Number(resultado.rows[0]?.quantos ?? 0);
  } finally {
    await cliente.end();
  }
}

function ehDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 768;
}

// "+ Novo material" no cabeçalho a partir de 768px; "+ Material" na barra fixa abaixo (UI-D5).
async function abrirNovoMaterial(page: Page): Promise<Locator> {
  if (ehDesktop(page)) {
    await expect(page.getByTestId("estoque-acao-fixa-material")).toBeHidden();
    await page.getByTestId("estoque-novo-material").click();
  } else {
    await expect(page.getByTestId("estoque-novo-material")).toBeHidden();
    await expect(page.getByTestId("estoque-acao-fixa-material")).toHaveText("+ Material");
    await page.getByTestId("estoque-acao-fixa-material").click();
  }
  const folha = page.getByTestId("folha-novo-material");
  await expect(folha).toBeVisible();
  return folha;
}

async function escolherCategoria(folha: Locator, nome: string) {
  const seletor = folha.getByTestId("novo-material-categoria");
  const valor = await seletor.locator("option", { hasText: nome }).first().getAttribute("value");
  await seletor.selectOption(valor ?? "");
}

// O cartão (ou a linha da tabela) visível de um material, achado pelo NOME — o material nasceu pela
// tela, e o teste ainda não sabe o id.
function cartaoPeloNome(page: Page, nome: string) {
  return page.getByTestId("estoque-cartao").filter({ visible: true }).filter({ hasText: nome });
}

async function abrirEdicao(page: Page, itemId: string): Promise<Locator> {
  const folha = await abrirFolhaDoMaterial(page, itemId);
  await folha.getByTestId("folha-material-editar").click();
  const edicao = page.getByTestId("folha-editar-material");
  await expect(edicao).toBeVisible();
  return edicao;
}

test.describe("estoque material cadastro", () => {
  test("(a) critério 1 pelo caminho do dono: cadastrar Argila em kg, a entrada de 5 kg que a folha abre sozinha, a baixa de 2 — 3 kg", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // Garante que a página tem material (senão ela mostra o vazio, sem cabeçalho nem barra).
    await semearMaterial({ nome: `[e2e] Âncora ${suf}`, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    const nome = `[e2e] Argila ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/estoque");

    const folha = await abrirNovoMaterial(page);
    // Nenhum campo de saldo (D-17): a nota diz onde o saldo inicial entra.
    await expect(folha).toContainText(
      "Não existe campo de saldo aqui. O saldo inicial entra pela contagem, com custo — assim ele nasce dentro do histórico.",
    );
    await expect(folha).toContainText("Preço de venda, atalhos e ficha técnica ficam em Cadastros → Catálogo.");
    await expect(folha.getByTestId("novo-material-minimo")).toHaveValue("0");
    await folha.getByTestId("novo-material-nome").fill(nome);
    await folha.getByTestId("novo-material-unidade").selectOption("kg");
    await escolherCategoria(folha, CATEGORIA_DE_COMPRA);
    await expect(folha.getByText(/^diz a área — /)).toBeVisible();
    await folha.getByTestId("novo-material-cadastrar").click();

    await expect(page.getByText(`${nome} cadastrado. Registre a entrada para dar saldo a ele.`)).toBeVisible();
    await expect(folha).toBeHidden();

    // UI-D12: a folha de movimentação abre sozinha, em Entrada, para o material novo.
    const movimentacao = page.getByTestId("folha-movimentacao");
    await expect(movimentacao).toBeVisible();
    await expect(movimentacao.getByTestId("folha-tipo-entrada")).toHaveAttribute("aria-checked", "true");
    await expect(movimentacao.getByTestId("folha-escolhido")).toContainText(nome);
    await movimentacao.getByTestId("folha-quantidade").fill("5");
    await movimentacao.getByTestId("folha-custo").fill("21,00");
    await expect(movimentacao.getByTestId("folha-registrar")).toHaveText("Registrar entrada");
    await movimentacao.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Entrada de 5 kg em ${nome}.`)).toBeVisible();
    await expect(movimentacao).toBeHidden();

    const cartao = cartaoPeloNome(page, nome);
    await expect(cartao.getByTestId("estoque-cartao-saldo")).toHaveText("5");
    const itemId = (await cartao.getAttribute("data-item-id")) ?? "";

    await movimentarPelaFolha(page, itemId, { tipo: "saida", quantidade: "2", destino: "atelie" });
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("3");
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-unidade")).toHaveText("kg");
    expect(await saldoNoBanco(itemId)).toBe(3000);
  });

  test("(b) nome vazio: “Dê um nome ao item.” embaixo do campo, a folha continua preenchida e nada grava", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    await semearMaterial({ nome: `[e2e] Âncora ${suf}`, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    const marcador = `[e2e] marcador do cadastro recusado ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const folha = await abrirNovoMaterial(page);
    await folha.getByTestId("novo-material-nome").fill("   ");
    await folha.getByTestId("novo-material-unidade").selectOption("g");
    await escolherCategoria(folha, CATEGORIA_DE_COMPRA);
    await folha.getByTestId("novo-material-observacoes").fill(marcador);
    await folha.getByTestId("novo-material-cadastrar").click();

    const erro = folha.getByTestId("material-erro");
    await expect(erro).toHaveText("Dê um nome ao item.");
    await expect(erro).toHaveAttribute("data-campo", "nome");
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("novo-material-observacoes")).toHaveValue(marcador);
    await expect(folha.getByTestId("novo-material-unidade")).toHaveValue("g");

    // Sem unidade: a frase do Cadastros, embaixo da unidade.
    await folha.getByTestId("novo-material-nome").fill(`[e2e] Sem unidade ${suf}`);
    await folha.getByTestId("novo-material-unidade").selectOption("");
    await folha.getByTestId("novo-material-cadastrar").click();
    await expect(folha.getByTestId("material-erro")).toHaveText("Escolha a unidade do estoque.");
    await expect(folha.getByTestId("material-erro")).toHaveAttribute("data-campo", "unidade");

    expect(await itensComObservacoes(marcador)).toBe(0);
  });

  test("(c) Editar muda só o mínimo e as observações: mínimo 4 deixa o cartão Acabando; 501 letras são recusadas", async ({
    page,
  }) => {
    const nome = `[e2e] Esmalte editado ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    await semearMovimentacoesEmMassa(itemId, 3, process.env.E2E_EMAIL_TESTE ?? "");

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-cartao-saldo")).toHaveText("3");

    const edicao = await abrirEdicao(page, itemId);
    // Nome, unidade e categoria só para leitura (D-01): os dois únicos campos são mínimo e observações.
    await expect(edicao.getByTestId("editar-material-catalogo")).toContainText(nome);
    await expect(edicao.getByTestId("editar-material-catalogo")).toContainText(CATEGORIA_DE_COMPRA);
    await expect(
      edicao.getByRole("link", { name: "Nome, unidade e categoria mudam em Cadastros → Catálogo" }),
    ).toBeVisible();
    await expect(edicao.getByRole("textbox")).toHaveCount(2);
    await expect(edicao.getByTestId("editar-material-minimo")).toHaveValue("0");

    await edicao.getByTestId("editar-material-minimo").fill("4");
    await edicao.getByTestId("editar-material-observacoes").fill("x".repeat(501));
    await edicao.getByTestId("editar-material-salvar").click();
    const erro = edicao.getByTestId("material-erro");
    await expect(erro).toHaveText("As observações cabem em até 500 letras.");
    await expect(erro).toHaveAttribute("data-campo", "observacoes");

    await edicao.getByTestId("editar-material-observacoes").fill("Secar antes de pesar.");
    await edicao.getByTestId("editar-material-salvar").click();
    await expect(page.getByText("Material atualizado.")).toBeVisible();
    await expect(edicao).toBeHidden();

    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao).toContainText("4 un");
    await expect(cartao.getByTestId("estoque-chip-acabando")).toBeVisible();
    await expect(cartao).toHaveAttribute("data-alerta", "acabando");

    const folha = await abrirFolhaDoMaterial(page, itemId);
    await expect(folha.getByTestId("folha-material-observacoes")).toHaveText("Secar antes de pesar.");
    await expect(folha.getByTestId("folha-material-resumo")).toContainText("mínimo 4 un");
    await expect(folha.getByTestId("folha-material-resumo")).toHaveAttribute("data-alerta", "acabando");
  });

  test("(d) Desativar diz que nada é apagado, tira o material do padrão, e Reativar o traz de volta", async ({
    page,
  }) => {
    const nome = `[e2e] Barbante desativado ${sufixoUnico()}`;
    const itemId = await semearMaterial({ nome, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    await semearMovimentacoesEmMassa(itemId, 2, process.env.E2E_EMAIL_TESTE ?? "");

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const edicao = await abrirEdicao(page, itemId);
    await edicao.getByTestId("editar-material-desativar").click();

    const confirmacao = page.getByTestId("confirmar-desativacao");
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao).toContainText(`Desativar ${nome}?`);
    await expect(confirmacao).toContainText(
      "Ele some da Venda, da Compra e da lista do Estoque. O histórico (2 movimentações) e o saldo de 2 un continuam guardados — nada é apagado — e dá para reativar quando quiser.",
    );
    await confirmacao.getByTestId("confirmar-desativacao-botao").click();
    await expect(page.getByText(`${nome} desativado. Continua no filtro Desativados.`)).toBeVisible();
    await expect(confirmacao).toBeHidden();
    await expect(edicao).toBeHidden();

    // Some do padrão ("Ativos") e aparece em "Desativados", com o chip e sem "Dar baixa".
    await expect(cartaoDoItem(page, itemId)).toHaveCount(0);
    await page.getByTestId("estoque-filtro-situacao-desativados").click();
    const cartao = cartaoDoItem(page, itemId);
    await expect(cartao.getByTestId("estoque-chip-desativado")).toBeVisible();
    await expect(cartao.getByTestId("estoque-dar-baixa")).toHaveCount(0);
    // O livro continua lá: nada foi apagado.
    expect(await movimentacoesDoItem(itemId)).toHaveLength(2);

    const folha = await abrirFolhaDoMaterial(page, itemId);
    await expect(folha.getByTestId("folha-material-registrar")).toHaveCount(0);
    await expect(folha.getByTestId("historico-linha")).toHaveCount(2);
    const reativar = folha.getByTestId("folha-material-reativar");
    await expect(reativar).toHaveText("Reativar material");
    await reativar.click();
    await expect(page.getByText(`${nome} reativado.`)).toBeVisible();
    await expect(folha.getByTestId("folha-material-registrar")).toBeVisible();
    await expect(folha.getByTestId("folha-material-reativar")).toHaveCount(0);

    await folha.getByTestId("folha-material-fechar").click();
    await page.getByTestId("estoque-filtro-situacao-ativos").click();
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-dar-baixa")).toBeVisible();
  });

  test("(e) insumo da ficha de um produto ativo: desativar é recusado com a frase dentro do diálogo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Grão em uso ${suf}`;
    const itemId = await semearMaterial({ nome, unidade: "g", categoriaCompra: CATEGORIA_DE_COMPRA });
    const produto = `[e2e] Café coado ${suf}`;
    await semearItem({
      nome: produto,
      categoriaVenda: "Peças prontas",
      precoCentavos: 800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: itemId, quantidade: "15" }],
    });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const edicao = await abrirEdicao(page, itemId);
    await edicao.getByTestId("editar-material-desativar").click();
    const confirmacao = page.getByTestId("confirmar-desativacao");
    await confirmacao.getByTestId("confirmar-desativacao-botao").click();

    const recusa = confirmacao.getByRole("alert");
    await expect(recusa).toContainText(`Esse item é insumo de ${produto} — tire da ficha técnica antes.`);
    await expect(recusa.getByRole("link", { name: "Abrir Cadastros → Catálogo" })).toBeVisible();
    await expect(confirmacao).toBeVisible();

    await confirmacao.getByRole("button", { name: "Voltar" }).click();
    await edicao.getByRole("button", { name: "Fechar" }).click();
    await expect(cartaoDoItem(page, itemId).getByTestId("estoque-chip-desativado")).toHaveCount(0);
  });

  test("(f) o material do “+ Novo material” aparece no Catálogo com estoque próprio e fora da venda", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    await semearMaterial({ nome: `[e2e] Âncora ${suf}`, unidade: "un", categoriaCompra: CATEGORIA_DE_COMPRA });
    const nome = `[e2e] Embalagem do catálogo ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    const folha = await abrirNovoMaterial(page);
    await folha.getByTestId("novo-material-nome").fill(nome);
    await folha.getByTestId("novo-material-unidade").selectOption("un");
    await escolherCategoria(folha, CATEGORIA_DE_COMPRA);
    await folha.getByTestId("novo-material-minimo").fill("2");
    await folha.getByTestId("novo-material-cadastrar").click();
    await expect(page.getByText(`${nome} cadastrado. Registre a entrada para dar saldo a ele.`)).toBeVisible();
    await page.getByTestId("folha-movimentacao").getByRole("button", { name: "Fechar" }).click();

    await page.goto("/gestao/cadastros?sub=catalogo");
    const item = page
      .getByTestId("catalogo-item")
      .filter({ has: page.getByText(nome, { exact: true }) });
    await expect(item).toBeVisible();
    await expect(item.getByTestId("catalogo-etiqueta").filter({ hasText: "só insumo" })).toBeVisible();
    await expect(item.getByTestId("catalogo-etiqueta").filter({ hasText: "estoque em un" })).toBeVisible();
    await item.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Tem estoque próprio" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Aparece na venda" })).not.toBeChecked();
  });
});

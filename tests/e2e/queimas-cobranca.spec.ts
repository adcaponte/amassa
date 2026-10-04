import { test, expect, type Locator, type Page } from "@playwright/test";

import { cancelarDocumentoNoBanco, semearCliente } from "./apoio/semear-agenda";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import { idDoUsuarioDoTeste } from "./apoio/semear-fornecedores";
import {
  contarDocumentos,
  lerContagem,
  lerVendasDaQueima,
  travarPrecosDasQueimas,
  type TravaDosPrecosDasQueimas,
} from "./apoio/semear-queimas";

// A cobrança da queima externa (Fase 06.4, plano 04 — QMC-07, QMC-08; D-07, decisão do dono de
// 04/10/2026: várias vendas por queima, uma por pessoa). Cada teste cadastra o próprio forno, de nome
// único, e conta a própria fornada; "a cobrar" é GLOBAL (todos os fornos), então cada teste acha a SUA
// linha por `data-queima-id` e nunca afirma a lista inteira.
//
// Os preços dos três itens "Queima externa P/M/G" são estado GLOBAL: todo teste que depende deles roda
// sob `travarPrecosDasQueimas` (trava consultiva; `desktop` e `celular` se revezam) e os devolve a nulo
// no fim. Preços de teste inventados.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixo(): string {
  return `${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarForno(page: Page, nome: string): Promise<void> {
  await page.goto("/gestao/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill("50");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/gestao\/queimas$/, { timeout: 10000 });
}

type Externas = { p?: number; m?: number; g?: number };

// Registra uma queima de biscoito no forno pela interface e conta as externas pedidas na folha que abre
// depois ("+" de cada tamanho). Devolve o id da queima.
async function registrarEContar(page: Page, nomeDoForno: string, externas: Externas): Promise<string> {
  const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nomeDoForno });
  await cartao.scrollIntoViewIfNeeded();
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId("tipo-queima-biscoito").click();
  const folha = page.getByTestId("folha-contagem");
  await expect(folha).toBeVisible({ timeout: 10000 });
  const id = (await folha.getAttribute("data-queima-id")) ?? "";
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  for (const [tamanho, quantidade] of Object.entries(externas)) {
    for (let vez = 0; vez < (quantidade ?? 0); vez += 1) {
      await folha.getByTestId(`contador-externas-${tamanho}-mais`).click();
    }
  }
  await folha.getByTestId("contagem-salvar").click();
  await expect(folha).toBeHidden({ timeout: 10000 });
  return id;
}

function linhaACobrar(page: Page, queimaId: string): Locator {
  return page.getByTestId("queimas-a-cobrar").locator(`[data-testid="a-cobrar-linha"][data-queima-id="${queimaId}"]`);
}

async function abrirRecebi(page: Page, queimaId: string): Promise<Locator> {
  await linhaACobrar(page, queimaId).getByTestId("recebi-agora").click();
  const folha = page.getByTestId("folha-recebi-agora");
  await expect(folha).toBeVisible();
  await expect(folha).toHaveAttribute("data-cobranca-tipo", "queima");
  return folha;
}

test.describe("cobrança da queima — recebi agora", () => {
  test("sem pessoa: a cobrar com o que falta → Recebi agora com 1 P · 1 G em pix → o resto continua → segunda venda em dinheiro tira a linha; o preço novo não muda as vendas", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const nome = `[e2e] cobrança ${sufixo()}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { p: 2, g: 1 });

      // "a cobrar" com o que falta e o valor do Catálogo: 2 × 11,00 + 1 × 37,00.
      const linha = linhaACobrar(page, queimaId);
      await expect(linha).toBeVisible({ timeout: 10000 });
      await expect(linha).toHaveAttribute("data-situacao", "a_cobrar");
      await expect(linha.getByTestId("a-cobrar-falta")).toHaveText("falta: 2 P · 1 G");
      await expect(linha.getByTestId("a-cobrar-valor")).toHaveText(/R\$\s59,00/);
      await expect(linha.getByTestId("a-cobrar-venda")).toHaveCount(0);

      // O passo de quantidade começa com TUDO o que falta; sem linha de M.
      let folha = await abrirRecebi(page, queimaId);
      await expect(folha.getByTestId("recebi-quantidade-p")).toHaveValue("2");
      await expect(folha.getByTestId("recebi-quantidade-g")).toHaveValue("1");
      await expect(folha.getByTestId("recebi-quantidade-m")).toHaveCount(0);
      await expect(folha.getByTestId("recebi-quantidade-p-mais")).toBeDisabled();
      await expect(folha.getByTestId("recebi-agora-topo")).toContainText("2 P · 1 G");

      await folha.getByTestId("recebi-quantidade-p-menos").click();
      await expect(folha.getByTestId("recebi-agora-topo")).toContainText("1 P · 1 G");
      await expect(folha.getByTestId("recebi-agora-topo")).toHaveText(/R\$\s48,00/);
      await folha.getByTestId("forma-pix").click();
      await expect(folha).toBeHidden({ timeout: 10000 });
      await expect(page.getByText(/Venda nº \d+ lançada e paga em pix\./)).toBeVisible();

      // O resto continua em "a cobrar", com a venda ativa como linha de apoio.
      await expect(linha.getByTestId("a-cobrar-falta")).toHaveText("falta: 1 P", { timeout: 10000 });
      await expect(linha).toHaveAttribute("data-situacao", "parcial");
      await expect(linha.getByTestId("a-cobrar-valor")).toHaveText(/R\$\s11,00/);

      const usuario = await idDoUsuarioDoTeste();
      let vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(1);
      const [primeira] = vendas;
      expect(primeira).toMatchObject({
        quantidadeP: 1,
        quantidadeM: 0,
        quantidadeG: 1,
        lancadoPor: usuario,
        data: hojeNoAtelie(),
        pessoaNome: null,
        clienteId: null,
        cancelado: false,
      });
      expect(primeira.linhas.map((item) => [item.quantidade, item.valorCentavos])).toEqual([
        [1, 1100],
        [1, 3700],
      ]);
      expect(primeira.parcelas).toEqual([
        { vencimento: hojeNoAtelie(), valorCentavos: 4800, forma: "pix", pagoEm: hojeNoAtelie() },
      ]);
      await expect(linha.getByTestId("a-cobrar-venda")).toHaveText(
        `já lançado: venda nº ${primeira.numero} (1 P · 1 G)`,
      );
      await expect(linha.getByTestId("a-cobrar-venda")).toHaveAttribute("data-documento-id", primeira.documentoId);

      // Segunda venda: abre com a 1 P que falta; em dinheiro; a linha sai.
      folha = await abrirRecebi(page, queimaId);
      await expect(folha.getByTestId("recebi-quantidade-p")).toHaveValue("1");
      await expect(folha.getByTestId("recebi-quantidade-g")).toHaveCount(0);
      await folha.getByTestId("forma-dinheiro").click();
      await expect(folha).toBeHidden({ timeout: 10000 });
      await expect(linha).toHaveCount(0, { timeout: 10000 });

      vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(2);
      expect(vendas.reduce((soma, venda) => soma + venda.quantidadeP, 0)).toBe(2);
      expect(vendas.reduce((soma, venda) => soma + venda.quantidadeM, 0)).toBe(0);
      expect(vendas.reduce((soma, venda) => soma + venda.quantidadeG, 0)).toBe(1);
      expect(vendas[1].parcelas).toEqual([
        { vencimento: hojeNoAtelie(), valorCentavos: 1100, forma: "dinheiro", pagoEm: hojeNoAtelie() },
      ]);

      // U33: a venda congela o valor ao nascer — o preço novo do Catálogo não muda nenhuma das duas.
      await trava.definirPrecos({ P: 1999 });
      const depois = await lerVendasDaQueima(queimaId);
      expect(depois.map((venda) => venda.parcelas[0]?.valorCentavos)).toEqual([4800, 1100]);
      expect(depois.flatMap((venda) => venda.linhas.map((item) => item.valorCentavos))).toEqual([1100, 3700, 1100]);
    } finally {
      await trava?.soltar();
    }
  });

  test("com pessoa: o seletor de pessoas grava quem levou (nome e cadastro); nome digitado e não escolhido segura a venda", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const suf = sufixo();
      const nomeDaPessoa = `[e2e] Pessoa da queima ${suf}`;
      const clienteId = await semearCliente({ nome: nomeDaPessoa });
      const nome = `[e2e] cobrança pessoa ${suf}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { m: 2 });

      const linha = linhaACobrar(page, queimaId);
      await expect(linha.getByTestId("a-cobrar-valor")).toHaveText(/R\$\s46,00/, { timeout: 10000 });

      const folha = await abrirRecebi(page, queimaId);
      await expect(folha.getByTestId("recebi-quantidade-m")).toHaveValue("2");
      const campo = folha.getByRole("combobox", { name: "Pessoa (opcional)" });

      // Nome digitado e NÃO escolhido: a forma não grava — a venda não sai sem pessoa por engano.
      await campo.fill("[e2e] ninguém com este nome");
      await folha.getByTestId("forma-pix").click();
      await expect(folha.getByTestId("recebi-agora-erro")).toHaveText(
        "Escolha a pessoa na lista, ou apague o nome para lançar sem pessoa.",
      );
      expect(await lerVendasDaQueima(queimaId)).toHaveLength(0);

      await campo.fill(nomeDaPessoa);
      const opcao = folha.locator(`[data-testid="seletor-opcao"][data-cliente-id="${clienteId}"]`);
      await expect(opcao).toHaveCount(1);
      await opcao.click();
      await expect(campo).toHaveAttribute("aria-expanded", "false");
      await folha.getByTestId("forma-pix").click();
      await expect(folha).toBeHidden({ timeout: 10000 });
      await expect(linha).toHaveCount(0, { timeout: 10000 });

      const vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(1);
      expect(vendas[0]).toMatchObject({
        quantidadeP: 0,
        quantidadeM: 2,
        quantidadeG: 0,
        pessoaNome: nomeDaPessoa,
        clienteId,
        cancelado: false,
      });
      expect(vendas[0].parcelas).toEqual([
        { vencimento: hojeNoAtelie(), valorCentavos: 4600, forma: "pix", pagoEm: hojeNoAtelie() },
      ]);
    } finally {
      await trava?.soltar();
    }
  });
});

async function abrirDetalhe(page: Page, nomeDoForno: string): Promise<void> {
  await page.goto("/gestao/queimas");
  const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nomeDoForno });
  await cartao.getByRole("link", { name: nomeDoForno }).click();
  await expect(page).toHaveURL(/\/gestao\/queimas\/[0-9a-f-]{36}$/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: nomeDoForno, level: 1 })).toBeVisible();
}

// "Recebi agora" pela linha, tirando `menos` peças P do que a folha abre, na forma pedida.
async function receberP(page: Page, queimaId: string, menos: number, forma: "pix" | "dinheiro"): Promise<void> {
  const folha = await abrirRecebi(page, queimaId);
  for (let vez = 0; vez < menos; vez += 1) {
    await folha.getByTestId("recebi-quantidade-p-menos").click();
  }
  await folha.getByTestId(`forma-${forma}`).click();
  await expect(folha).toBeHidden({ timeout: 10000 });
}

test.describe("cobrança da queima — vendas e piso", () => {
  test("(a) o piso das externas na folha e as tags do Histórico; (b) a venda cancelada devolve a quantidade", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const nome = `[e2e] piso ${sufixo()}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { p: 3 });
      await expect(linhaACobrar(page, queimaId)).toBeVisible({ timeout: 10000 });

      // (a) 2 P em pix: falta 1 P.
      await receberP(page, queimaId, 1, "pix");
      await expect(linhaACobrar(page, queimaId).getByTestId("a-cobrar-falta")).toHaveText("falta: 1 P", {
        timeout: 10000,
      });
      const [venda] = await lerVendasDaQueima(queimaId);
      expect(venda).toMatchObject({ quantidadeP: 2, cancelado: false });

      await abrirDetalhe(page, nome);
      const situacao = page.getByTestId(`historico-situacao-${queimaId}`);
      await expect(situacao).toContainText(/a cobrar · R\$\s11,00/);
      await expect(page.getByTestId(`historico-venda-${venda.documentoId}`)).toHaveText(
        `venda nº ${venda.numero} · 2 P · paga`,
      );

      await page.getByTestId(`corrigir-contagem-${queimaId}`).click();
      let folha = page.getByTestId("folha-contagem");
      await expect(folha).toBeVisible({ timeout: 5000 });
      await expect(folha.getByTestId("externas-lancadas")).toContainText(`venda nº ${venda.numero} (2 P)`);
      await expect(folha.getByTestId("contagem-valor-externas")).toHaveText(/R\$\s33,00/);
      const externasP = folha.getByTestId("contador-externas-p");
      await expect(externasP).toHaveValue("3");
      await folha.getByTestId("contador-externas-p-menos").click();
      await expect(externasP).toHaveValue("2");
      await expect(folha.getByTestId("contador-externas-p-menos")).toBeDisabled();
      await externasP.fill("1");
      await externasP.blur();
      await expect(externasP).toHaveValue("2");
      await expect(folha.getByTestId("contagem-erro")).toHaveText(
        `Já foram lançadas 2 externas P; para baixar daí, cancele a venda nº ${venda.numero} no Caixa.`,
      );
      await folha.getByTestId("contador-externas-p-mais").click();
      await expect(externasP).toHaveValue("3");
      await folha.getByTestId("contador-internas-p-mais").click();
      await folha.getByTestId("contagem-salvar").click();
      await expect(folha).toBeHidden({ timeout: 10000 });
      await expect(page.getByText("Contagem corrigida: 4 peças.")).toBeVisible({ timeout: 5000 });
      await expect.poll(async () => (await lerContagem(queimaId))?.internas_p, { timeout: 10000 }).toBe(1);
      expect((await lerContagem(queimaId))?.externas_p).toBe(3);

      // (b) a venda cancelada no Caixa devolve as 2 P: no Histórico, a tag “cancelada” e nenhum piso.
      await cancelarDocumentoNoBanco(venda.documentoId);
      await page.reload();
      await expect(page.getByTestId(`historico-venda-${venda.documentoId}`)).toHaveText(
        `venda nº ${venda.numero} · 2 P · cancelada`,
      );
      await expect(page.getByTestId(`historico-situacao-${queimaId}`)).toContainText(/a cobrar · R\$\s33,00/);
      await page.getByTestId(`corrigir-contagem-${queimaId}`).click();
      folha = page.getByTestId("folha-contagem");
      await expect(folha).toBeVisible({ timeout: 5000 });
      await expect(folha.getByTestId("externas-lancadas")).toHaveCount(0);
      await expect(folha.getByTestId("contador-externas-p-menos")).toBeEnabled();
      await folha.getByTestId("contagem-fechar-sem-salvar").click();
      await expect(folha).toBeHidden();

      // No índice: a falta voltou a 3 P, com a tag da venda cancelada; o "Recebi agora" abre com as 3.
      await page.goto("/gestao/queimas");
      const linha = linhaACobrar(page, queimaId);
      await expect(linha.getByTestId("a-cobrar-falta")).toHaveText("falta: 3 P", { timeout: 10000 });
      await expect(linha).toHaveAttribute("data-situacao", "a_cobrar");
      const tag = linha.locator('[data-testid="a-cobrar-venda"][data-cancelada="true"]');
      await expect(tag).toHaveText(`venda nº ${venda.numero} cancelada`);
      await expect(linha.locator('[data-testid="a-cobrar-venda"][data-cancelada="false"]')).toHaveCount(0);
      const recebi = await abrirRecebi(page, queimaId);
      await expect(recebi.getByTestId("recebi-quantidade-p")).toHaveValue("3");
      await recebi.getByTestId("recebi-agora-voltar").click();
      await expect(recebi).toBeHidden();
      expect(await lerVendasDaQueima(queimaId)).toHaveLength(1);
    } finally {
      await trava?.soltar();
    }
  });

  test("(c) duas vendas de 1 P; excluir a queima diz que as duas continuam no Caixa e não leva nenhuma", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const nome = `[e2e] excluir com vendas ${sufixo()}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { p: 2 });
      await expect(linhaACobrar(page, queimaId)).toBeVisible({ timeout: 10000 });

      await receberP(page, queimaId, 1, "pix");
      await expect(linhaACobrar(page, queimaId).getByTestId("a-cobrar-falta")).toHaveText("falta: 1 P", {
        timeout: 10000,
      });
      await receberP(page, queimaId, 0, "dinheiro");
      await expect(linhaACobrar(page, queimaId)).toHaveCount(0, { timeout: 10000 });
      const vendas = await lerVendasDaQueima(queimaId);
      expect(vendas.map((venda) => venda.quantidadeP)).toEqual([1, 1]);

      await abrirDetalhe(page, nome);
      await page.getByTestId(`excluir-queima-${queimaId}`).click();
      const dialogo = page.getByRole("alertdialog");
      await expect(dialogo).toContainText(
        `As vendas nº ${vendas[0].numero} e ${vendas[1].numero} continuam no Caixa — se for o caso, cancele por lá.`,
      );
      await expect(dialogo).toContainText("A contagem desta fornada (2 peças) vai junto.");
      await dialogo.getByRole("button", { name: "Excluir" }).click();
      await expect(dialogo).toBeHidden({ timeout: 10000 });
      await expect(page.getByTestId(`linha-queima-${queimaId}`)).toHaveCount(0, { timeout: 10000 });

      expect(await lerContagem(queimaId)).toBeNull();
      expect(await lerVendasDaQueima(queimaId)).toEqual([]);
      expect(await contarDocumentos(vendas.map((venda) => venda.documentoId))).toBe(2);
    } finally {
      await trava?.soltar();
    }
  });
});

import { test, expect, type Locator, type Page, type Route } from "@playwright/test";

import { FRASE_RECEBER_SEM_RESPOSTA } from "@/lib/queimas/textos";

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
//
// O tempo de cada teste inclui a ESPERA pela trava dos preços: com os dois projetos se revezando nela,
// um teste pode esperar o teste inteiro do outro projeto antes do primeiro passo. Os 30 s padrão não
// cabem nisso (a primeira invocação de e2e do plano 04 estourou neles esperando a trava) — o prazo é do
// arquivo, nenhuma afirmação muda.
test.describe.configure({ timeout: 180_000 });

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

      // A lista aberta FLUTUA por cima das formas: abrir e fechar nunca move os botões de pagamento (o
      // toque numa forma tira o foco do campo e fecha a lista antes do clique — se a forma andasse, o
      // toque cairia noutro lugar).
      const pixAntes = await folha.getByTestId("forma-pix").boundingBox();
      await campo.fill("[e2e] ninguém com este nome");
      await expect(campo).toHaveAttribute("aria-expanded", "true");
      expect((await folha.getByTestId("forma-pix").boundingBox())?.y).toBe(pixAntes?.y);

      // Nome digitado e NÃO escolhido: a forma não grava — a venda não sai sem pessoa por engano.
      await campo.press("Escape");
      await expect(campo).toHaveAttribute("aria-expanded", "false");
      await expect(folha).toBeVisible();
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

// Quick 261005-2yu (05/10/2026): a tela velha nas cobranças — o servidor recusa sob a trava da queima
// quando as vendas ativas mudaram desde o que a tela mostrou.
test.describe("cobrança da queima — tela velha", () => {
  // 06.4-WR-02: o servidor grava a venda e a RESPOSTA se perde. A folha não afirma mais "nenhuma venda foi
  // criada"; tocar de novo, da mesma folha, é recusado citando a venda — nunca uma segunda venda paga.
  test("WR-02: a resposta do Recebi agora se perde — a folha diz o que fazer, e o segundo toque é recusado citando a venda, sem criar outra", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const nome = `[e2e] resposta perdida ${sufixo()}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { p: 5 });
      await expect(linhaACobrar(page, queimaId)).toBeVisible({ timeout: 10000 });

      const folha = await abrirRecebi(page, queimaId);
      for (let vez = 0; vez < 3; vez += 1) {
        await folha.getByTestId("recebi-quantidade-p-menos").click();
      }
      await expect(folha.getByTestId("recebi-quantidade-p")).toHaveValue("2");

      // Só a PRIMEIRA chamada de Server Action: o servidor recebe e grava (`route.fetch`), e a resposta
      // nunca chega ao navegador (`abort`).
      let perdida = false;
      const perderAResposta = async (route: Route) => {
        const pedido = route.request();
        if (!perdida && pedido.method() === "POST" && pedido.headers()["next-action"] !== undefined) {
          perdida = true;
          await route.fetch();
          await route.abort("failed");
          return;
        }
        await route.fallback();
      };
      await page.route("**/*", perderAResposta);
      await folha.getByTestId("forma-pix").click();

      await expect(folha.getByTestId("recebi-agora-erro")).toHaveText(FRASE_RECEBER_SEM_RESPOSTA, {
        timeout: 10000,
      });
      await expect(folha).toBeVisible();
      expect(perdida).toBe(true);
      await expect.poll(async () => (await lerVendasDaQueima(queimaId)).length, { timeout: 10000 }).toBe(1);
      const [gravada] = await lerVendasDaQueima(queimaId);

      await page.unroute("**/*", perderAResposta);
      await folha.getByTestId("forma-pix").click();
      await expect(
        page.getByText(`Esta queima ganhou a venda nº ${gravada.numero} desde que a folha abriu`),
      ).toBeVisible({ timeout: 10000 });
      await expect(folha).toBeHidden({ timeout: 10000 });
      const vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(1);
      expect(vendas[0].quantidadeP).toBe(2);
    } finally {
      await trava?.soltar();
    }
  });

  // 06.4-WR-03: a página do forno carregou ANTES de uma venda nova (outra aba); a exclusão confirmada é
  // recusada sob a trava citando a venda, a queima continua, o diálogo passa a citá-la; confirmar de novo
  // exclui, e a venda continua no Caixa.
  test("WR-03: excluir uma queima que ganhou venda depois de a página carregar é recusado citando a venda; confirmar de novo exclui e a venda fica", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const nome = `[e2e] excluir tela velha ${sufixo()}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { p: 2 });
      await expect(linhaACobrar(page, queimaId)).toBeVisible({ timeout: 10000 });

      // Aba A: o detalhe do forno, carregado sem venda nenhuma.
      await abrirDetalhe(page, nome);
      await expect(page.getByTestId(`linha-queima-${queimaId}`)).toBeVisible();

      // Outra aba do mesmo navegador: "Recebi agora" de 1 P.
      const outra = await page.context().newPage();
      try {
        await outra.goto("/gestao/queimas");
        await expect(linhaACobrar(outra, queimaId)).toBeVisible({ timeout: 10000 });
        await receberP(outra, queimaId, 1, "pix");
      } finally {
        await outra.close();
      }
      const [venda] = await lerVendasDaQueima(queimaId);
      expect(venda.quantidadeP).toBe(1);

      // Aba A, sem recarregar: a lixeira e "Excluir".
      await page.getByTestId(`excluir-queima-${queimaId}`).click();
      const dialogo = page.getByRole("alertdialog");
      await expect(dialogo).toBeVisible();
      await expect(dialogo).not.toContainText("continua no Caixa");
      await dialogo.getByRole("button", { name: "Excluir", exact: true }).click();

      await expect(dialogo.getByRole("alert")).toHaveText(
        `Esta queima tem a venda nº ${venda.numero}, que a tela não mostrava. A tela foi atualizada — leia o aviso de novo e confirme se ainda quiser excluir.`,
        { timeout: 10000 },
      );
      await expect(dialogo).toBeVisible();
      expect(await lerContagem(queimaId)).not.toBeNull();
      expect(await lerVendasDaQueima(queimaId)).toHaveLength(1);

      // Depois do refresh, o diálogo cita a venda; confirmar de novo exclui, e a venda continua.
      await expect(dialogo).toContainText(`A venda nº ${venda.numero} continua no Caixa`, { timeout: 10000 });
      await dialogo.getByRole("button", { name: "Excluir", exact: true }).click();
      await expect(dialogo).toBeHidden({ timeout: 10000 });
      await expect(page.getByTestId(`linha-queima-${queimaId}`)).toHaveCount(0, { timeout: 10000 });
      expect(await lerContagem(queimaId)).toBeNull();
      expect(await contarDocumentos([venda.documentoId])).toBe(1);
    } finally {
      await trava?.soltar();
    }
  });
});

// O aviso do registro, atualizado no lugar pelo "Salvar" da folha (UI-D12 item 4) — o que tem o texto.
function avisoComTexto(page: Page, texto: string): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: texto });
}

test.describe("itens das queimas no catálogo", () => {
  test("os três itens “Queima externa P/M/G” têm o chip “do sistema”, a linha das Queimas e nenhum “Desativar”", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      // A trava só serializa com quem renomeia ou põe preço nos itens — os nomes lidos são os de agora.
      trava = await travarPrecosDasQueimas({ P: null, M: null, G: null });
      await page.goto("/gestao/cadastros?sub=catalogo");
      for (const tamanho of ["P", "M", "G"] as const) {
        const linha = page
          .getByTestId("catalogo-item")
          .filter({ has: page.getByText(trava.nomes[tamanho], { exact: true }) });
        await expect(linha).toHaveCount(1);
        await expect(linha.getByTestId("chip-do-sistema")).toHaveText("do sistema");
      }
      await page
        .getByTestId("catalogo-item")
        .filter({ has: page.getByText(trava.nomes.M, { exact: true }) })
        .getByRole("button", { name: "Editar" })
        .click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo).toBeVisible();
      await expect(dialogo.getByTestId("linha-item-do-sistema")).toHaveText(
        "Usado pelas Queimas — não se desativa nem sai da Venda. Nome, preço e categoria podem mudar.",
      );
      await expect(dialogo.getByTestId("catalogo-desativar")).toHaveCount(0);
      await expect(dialogo.getByRole("button", { name: "Desativar item" })).toHaveCount(0);
    } finally {
      await trava?.soltar();
    }
  });
});

test.describe("cobrança da queima — sem preço", () => {
  test("G sem preço: a linha diz “falta preço”, avisa onde cadastrar e não deixa cobrar; a folha e o aviso dizem o mesmo; nada vai ao Caixa", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: null });
      const nome = `[e2e] sem preço ${sufixo()}`;
      await cadastrarForno(page, nome);

      // Contagem NOVA com 1 externa G, com o aviso do registro ainda vivo: o mesmo aviso, com o
      // "Desfazer", diz que falta o preço.
      const queimaId = await registrarEContar(page, nome, { g: 1 });
      const aviso = avisoComTexto(page, "Contagem salva: 1 peça.");
      await expect(aviso).toContainText(
        "Contagem salva: 1 peça. Externas a cobrar — falta o preço no Catálogo.",
      );
      await expect(aviso.locator("button", { hasText: "Desfazer" })).toBeVisible();

      const linha = linhaACobrar(page, queimaId);
      await expect(linha.getByTestId("a-cobrar-valor")).toHaveText("falta preço", { timeout: 10000 });
      const semPreco = linha.getByTestId("a-cobrar-sem-preco");
      await expect(semPreco).toContainText("O preço da queima externa G ainda não foi cadastrado.");
      await expect(semPreco).toContainText(`“${trava.nomes.G}”`);
      await expect(semPreco.getByRole("link", { name: "abrir o Catálogo" })).toHaveAttribute(
        "href",
        "/gestao/cadastros?sub=catalogo",
      );
      const recebi = linha.getByTestId("recebi-agora");
      await expect(recebi).toBeDisabled();
      const idDoAviso = await semPreco.getAttribute("id");
      await expect(recebi).toHaveAttribute("aria-describedby", idDoAviso ?? "");

      // A folha ("Corrigir contagem") diz qual preço falta no cabeçalho de Externas.
      await abrirDetalhe(page, nome);
      await page.getByTestId(`corrigir-contagem-${queimaId}`).click();
      const folha = page.getByTestId("folha-contagem");
      await expect(folha).toBeVisible({ timeout: 5000 });
      await expect(folha.getByTestId("contagem-valor-externas")).toHaveText("falta o preço de G");
      await folha.getByTestId("contagem-fechar-sem-salvar").click();
      await expect(folha).toBeHidden();
      await expect(page.getByTestId(`historico-situacao-${queimaId}`)).toContainText("a cobrar · falta preço");
      expect(await lerVendasDaQueima(queimaId)).toEqual([]);

      // Outra contagem nova, com 2 externas P (P = 11,00): o aviso traz o valor.
      await page.goto("/gestao/queimas");
      await registrarEContar(page, nome, { p: 2 });
      await expect(avisoComTexto(page, "Contagem salva: 2 peças.")).toContainText(
        /Contagem salva: 2 peças\. Externas a cobrar: R\$\s22,00\./,
      );
    } finally {
      await trava?.soltar();
    }
  });
});

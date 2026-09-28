import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

// O documento do cliente (04.5-11-PLAN.md): a tela "Ver como o cliente vê" e o PDF gerado no
// servidor, os dois saindo de `lib/orcamentos/documento-cliente.ts`. Nomes inventados e únicos
// por execução ("[e2e] ... {sufixo}") — nenhum dado real do ateliê, o repositório é público.
//
// 🔴 Cobertura de (b)/(c)/(d) — SEM biblioteca de extração de texto de PDF: o checkpoint da
// Tarefa 1 (`04.5-11-PLAN.md`) oferecia `pdfjs-dist` como quarta dependência, mas a resposta do
// dono autoriza só TRÊS pacotes para a fase inteira ("qualquer quarto pacote volta a ser ponto
// de parada") e não confirma explicitamente a quarta — na ausência de confirmação explícita,
// ela NÃO foi instalada (regra do executor: pacote a mais é sempre parada, nunca suposição a
// favor). Por isso:
//   (b) confere que o arquivo baixado É um PDF de verdade (assinatura `%PDF-`, `Content-Type`,
//       tamanho > 0, nome do arquivo) — a paridade de CONTEÚDO fica coberta pelo teste unitário
//       de estrutura (`tests/unit/orcamentos-documento-cliente.test.ts`), que prova que a tela e
//       o PDF leem do MESMO `DocumentoDoCliente`.
//   (c) a acentuação é conferida na TELA (extraída do DOM) — dentro do arquivo PDF em si, vira
//       item de verificação humana do plano 13 (registrado no SUMMARY).
//   (d) confere que a folha ("Ver como o cliente vê") não contém os números do painel "Só para
//       você" — a AUSÊNCIA desses campos no PDF é garantida por CONSTRUÇÃO (o tipo
//       `DocumentoDoCliente` não tem esses campos; `documento.tsx` só consome esse tipo — os dois
//       provados por teste unitário/acceptance_criteria), não por leitura do arquivo final.

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

async function criarOrcamento(page: Page): Promise<string> {
  await page.goto("/gestao/financeiro?aba=orcamentos");
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=orcamentos&orcamento=/, { timeout: 10000 });
  const url = new URL(page.url());
  return url.searchParams.get("orcamento") ?? "";
}

async function blurEEsperarNavegacao(page: Page, campo: ReturnType<Page["getByTestId"]>): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

async function acrescentarPecaExclusiva(
  page: Page,
  orcamentoId: string,
  nome: string,
  precoReais: string,
): Promise<void> {
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

async function construirJpegPequeno(cor: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 12, height: 12, channels: 3, background: cor } }).jpeg().toBuffer();
}

// Extrai um número em pontos-base/reais de um texto de painel — só para a comparação do caso
// (d), nunca lógica de produção.
function reaisParaCentavos(texto: string): number {
  const casamento = texto.match(/R\$\s*([\d.]+,\d{2})/);
  if (!casamento) throw new Error(`Não encontrei um valor em reais no texto: "${texto}"`);
  return Math.round(Number(casamento[1].replace(/\./g, "").replace(",", ".")) * 100);
}

async function abrirDocumentoDoCliente(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Ver como o cliente vê" }).click();
  await expect(page.getByTestId("folha-a4")).toBeVisible();
}

test.describe("orcamentos pdf", () => {
  test.describe.configure({ mode: "serial" });

  let orcamentoId = "";
  let suf = "";

  test("(a) a folha mostra todos os blocos na ordem do protótipo: peças, referências, pagamento, prazo e observações", async ({
    page,
  }) => {
    suf = sufixoUnico();
    await fazerLogin(page);
    orcamentoId = await criarOrcamento(page);
    expect(orcamentoId).not.toBe("");
    await page.waitForTimeout(500);

    const campoCliente = page.getByTestId("orcamento-campo-cliente");
    await campoCliente.fill(`[e2e] José Conceição ${suf}`);
    await blurEEsperarNavegacao(page, campoCliente);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoTitulo = page.getByTestId("orcamento-campo-titulo");
    await campoTitulo.fill(`[e2e] Orçamento de teste ${suf}`);
    await blurEEsperarNavegacao(page, campoTitulo);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    await acrescentarPecaExclusiva(page, orcamentoId, `[e2e] PDF Peça A ${suf}`, "100");
    await acrescentarPecaExclusiva(page, orcamentoId, `[e2e] PDF Peça B ${suf}`, "50");

    const primeiraLinha = page.getByTestId("orcamento-linha").filter({ hasText: `[e2e] PDF Peça A ${suf}` });
    const campoCor = primeiraLinha.getByTestId("orcamento-linha-cor");
    await campoCor.fill("verde-musgo fosco");
    await blurEEsperarNavegacao(page, campoCor);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const linhaAtualizada = page.getByTestId("orcamento-linha").filter({ hasText: `[e2e] PDF Peça A ${suf}` });
    const campoPersonalizacao = linhaAtualizada.getByTestId("orcamento-linha-personalizacao");
    await campoPersonalizacao.fill("gravação: Zeca");
    await blurEEsperarNavegacao(page, campoPersonalizacao);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    await page.getByRole("button", { name: "+ Custo do projeto" }).click();
    const linhaDeProjeto = page.getByTestId("projeto-linha").last();
    await linhaDeProjeto.getByTestId("projeto-linha-descricao").fill(`[e2e] Molde ${suf}`);
    const campoValorProjeto = linhaDeProjeto.getByTestId("projeto-linha-valor");
    await campoValorProjeto.fill("20");
    await blurEEsperarNavegacao(page, campoValorProjeto);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoFrete = page.getByTestId("orcamento-frete");
    await campoFrete.fill("10");
    await blurEEsperarNavegacao(page, campoFrete);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    const campoObservacoes = page.getByTestId("orcamento-observacoes");
    await campoObservacoes.fill(`[e2e] Embrulhar para presente ${suf}`);
    await blurEEsperarNavegacao(page, campoObservacoes);
    await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));

    // A mesma folga de hidratação documentada em `tests/e2e/orcamentos-fotos.spec.ts` (a última
    // navegação — observações, acima — reidrata a página inteira, e o `onChange` que torna o
    // input de arquivo funcional só existe depois que o React termina de hidratar).
    await page.waitForTimeout(500);
    const inputDeArquivo = page.getByLabel("adicionar foto de referência");
    const jpeg = await construirJpegPequeno({ r: 200, g: 60, b: 30 });
    await inputDeArquivo.setInputFiles({ name: "referencia.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await expect(page.getByText("Foto de referência anexada.")).toBeVisible({ timeout: 15000 });

    await page.reload();
    await abrirDocumentoDoCliente(page);

    const folha = page.getByTestId("folha-a4");
    await expect(folha).toContainText("José Conceição");
    await expect(folha.getByTestId("folha-tabela-peca")).toContainText(`[e2e] PDF Peça A ${suf}`);
    await expect(folha.getByTestId("folha-tabela-peca")).toContainText("Cor: verde-musgo fosco");
    await expect(folha.getByTestId("folha-tabela-peca")).toContainText("gravação: Zeca");
    await expect(folha.getByTestId("folha-tabela-peca")).toContainText(`[e2e] PDF Peça B ${suf}`);
    await expect(folha.getByTestId("folha-tabela-peca")).toContainText(`[e2e] Molde ${suf}`);
    await expect(folha.getByTestId("folha-tabela-peca")).toContainText("Frete");
    await expect(folha.getByTestId("folha-total")).toContainText("R$ 180,00");
    await expect(folha.getByTestId("folha-referencia")).toBeVisible();
    await expect(folha).toContainText("Pagamento");
    await expect(folha).toContainText("Prazo");
    await expect(folha).toContainText("Observações");
    await expect(folha).toContainText(`[e2e] Embrulhar para presente ${suf}`);
    await expect(folha).toContainText("Ao aprovar, você confirma as peças, as cores e as referências mostradas acima.");
    await expect(folha).toContainText("Cada peça é feita à mão e queimada em alta temperatura.");
  });

  test("(b) 'Baixar PDF' entrega um arquivo PDF de verdade, com o número do orçamento no nome", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await abrirDocumentoDoCliente(page);

    const numeroTexto = (await page.getByTestId("folha-a4").locator("header").textContent()) ?? "";
    const numeroFormatado = numeroTexto.match(/ORC-\d{4}-\d{3}/)?.[0];
    expect(numeroFormatado).toBeTruthy();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("baixar-pdf").click(),
    ]);

    expect(download.suggestedFilename()).toBe(`${numeroFormatado}.pdf`);
    const caminho = await download.path();
    expect(caminho).not.toBeNull();
    const bytes = await (await import("node:fs/promises")).readFile(caminho!);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("(c) acentuação: 'José Conceição' e 'Orçamento' aparecem íntegros na tela do documento", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await abrirDocumentoDoCliente(page);

    const folha = page.getByTestId("folha-a4");
    await expect(folha).toContainText("José Conceição");
    await expect(folha).toContainText(/Orçamento nº ORC-\d{4}-\d{3}/);
  });

  test("(d) nada de custo no PDF: os números do painel 'Só para você' não aparecem na folha do cliente", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const painel = page.getByTestId("orcamento-so-para-voce");
    await expect(painel).toBeVisible();
    const textoDoPainel = (await painel.textContent()) ?? "";
    const custoCentavos = reaisParaCentavos(textoDoPainel);
    const custoFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      custoCentavos / 100,
    );

    await abrirDocumentoDoCliente(page);
    const folha = page.getByTestId("folha-a4");
    const textoDaFolha = (await folha.textContent()) ?? "";

    expect(textoDaFolha).not.toContain("Nada disto aparece para o cliente.");
    expect(textoDaFolha).not.toContain("Custo de produzir tudo");
    expect(textoDaFolha).not.toContain("Horas de trabalho");
    expect(textoDaFolha).not.toContain("Ocupa do forno");
    // O custo lido do painel "Só para você" nunca aparece na folha do cliente — comparado com o
    // NÚMERO lido do painel, nunca um literal escrito à mão neste teste.
    expect(custoCentavos, "o painel 'Só para você' deveria ter um custo positivo para este caso valer algo").toBeGreaterThan(0);
    expect(textoDaFolha.includes(custoFormatado)).toBe(false);
  });

  test("(e) 'Baixar PDF' mostra 'Gerando PDF…' desabilitado durante a espera e volta ao normal depois", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await abrirDocumentoDoCliente(page);

    let liberarResposta: (() => void) | null = null;
    const respostaLiberada = new Promise<void>((resolve) => {
      liberarResposta = resolve;
    });
    await page.route(`**/gestao/api/orcamentos/${orcamentoId}/pdf`, async (route) => {
      await respostaLiberada;
      await route.continue();
    });

    const botao = page.getByTestId("baixar-pdf");
    await botao.click();

    await expect(botao).toBeDisabled();
    await expect(botao).toContainText("Gerando PDF…");

    liberarResposta!();

    await expect(botao).toContainText("Baixar PDF", { timeout: 15000 });
    await expect(botao).toBeEnabled();
  });

  test("(f) a rota do PDF pedida sem sessão responde 401 e não devolve o arquivo", async ({ page, browser }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const contextoSemSessao = await browser.newContext();
    try {
      const resposta = await contextoSemSessao.request.get(
        new URL(`/gestao/api/orcamentos/${orcamentoId}/pdf`, page.url()).toString(),
      );
      expect(resposta.status()).toBe(401);
      expect(resposta.headers()["content-type"]).not.toContain("application/pdf");
    } finally {
      await contextoSemSessao.close();
    }
  });

  test("(g) a 320px a folha rola dentro do próprio contêiner, e a PÁGINA não rola na horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await abrirDocumentoDoCliente(page);

    await expect(page.getByTestId("folha-a4")).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `a página rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

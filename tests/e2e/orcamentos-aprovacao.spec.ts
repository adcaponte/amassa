import { test, expect, type Locator, type Page } from "@playwright/test";

import { formatarDataCurta } from "@/lib/financeiro/formato";
import { medirCaixa } from "./apoio/medir-caixa";
import { criarOrcamentoPelaTela } from "./apoio/novo-orcamento";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import {
  cancelarOrdemNoBanco,
  diaEmBrasilia,
  etapasDaOrdemNoBanco,
  linhasDoOrcamentoNoBanco,
  ordemNoBanco,
  pecasDaOrdemNoBanco,
  vinculoDoOrcamento,
} from "./apoio/semear-producao";

// A aprovação (04.5-12-PLAN.md, D-25/ORC-11): "Cliente aprovou" cria, numa transação só, a venda
// na parte 1 (sinal EM ABERTO vencendo hoje, saldo na entrega prevista) e, se marcado, a ORDEM DE
// PRODUÇÃO (Fase 06.1, plano 03: aguardando o sinal, sem início, com as peças das linhas e as seis
// etapas) — com os vínculos navegáveis nos dois sentidos. Cancelar a venda depois não
// apaga nem reabre o orçamento. Nomes inventados e únicos por execução ("[e2e] ... {sufixo}") —
// nenhum dado real do ateliê, o repositório é público.

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

// Sai do campo e espera a navegação de verdade — mesma armadilha documentada em
// `orcamentos-total.spec.ts`/`orcamentos-ciclo.spec.ts` (a URL final pode ser IDÊNTICA à atual).
async function blurEEsperarNavegacao(page: Page, campo: Locator): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

async function preencherTitulo(page: Page, orcamentoId: string, titulo: string): Promise<void> {
  const campo = page.getByTestId("orcamento-campo-titulo");
  await campo.fill(titulo);
  await blurEEsperarNavegacao(page, campo);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
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

async function definirCorDaLinha(page: Page, orcamentoId: string, nomeDaPeca: string, cor: string): Promise<void> {
  const linha = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPeca });
  const campoCor = linha.getByTestId("orcamento-linha-cor");
  await campoCor.fill(cor);
  await blurEEsperarNavegacao(page, campoCor);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
}

async function acrescentarCustoDeProjeto(
  page: Page,
  orcamentoId: string,
  descricao: string,
  valorReais: string,
): Promise<void> {
  await page.getByRole("button", { name: "+ Custo do projeto" }).click();
  const linhaDeProjeto = page.getByTestId("projeto-linha").last();
  await linhaDeProjeto.getByTestId("projeto-linha-descricao").fill(descricao);
  const campoValor = linhaDeProjeto.getByTestId("projeto-linha-valor");
  await campoValor.fill(valorReais);
  await blurEEsperarNavegacao(page, campoValor);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
}

async function definirFrete(page: Page, orcamentoId: string, valorReais: string): Promise<void> {
  const campoFrete = page.getByTestId("orcamento-frete");
  await campoFrete.fill(valorReais);
  await blurEEsperarNavegacao(page, campoFrete);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
}

async function marcarComoEnviado(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Marcar como enviado" }).click();
  // "Cliente aprovou" só aparece em status "enviado" — sinal DURÁVEL. A query string
  // `?aviso=orcamento-enviado` é limpa por `AvisoFinanceiro` (history.replaceState) segundos
  // depois de montar, e esperar por ela é uma corrida que a suíte perde de vez em quando (mesma
  // classe de achado documentada no caso (b) deste arquivo).
  await expect(page.getByRole("button", { name: "Cliente aprovou" })).toBeVisible({ timeout: 15000 });
}

async function abrirAprovacao(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Cliente aprovou" }).click();
  await expect(page).toHaveURL(/aprovar=1/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Cliente aprovou" })).toBeVisible();
}

// Extrai só a parte "R$ 1.234,56" de um texto maior (mesma técnica de `orcamentos-total.spec.ts`).
function reaisParaCentavos(texto: string): number {
  const casamento = texto.match(/R\$\s*([\d.]+,\d{2})/);
  if (!casamento) {
    throw new Error(`Não encontrei um valor em reais no texto: "${texto}"`);
  }
  const limpo = casamento[1].replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

async function somaDosLocators(locators: Locator): Promise<number> {
  let soma = 0;
  for (const locator of await locators.all()) {
    soma += reaisParaCentavos((await locator.textContent()) ?? "");
  }
  return soma;
}

test.describe("orcamentos aprovacao", () => {
  test.describe.configure({ mode: "serial" });

  let suf = "";
  let orcamentoId = "";
  let orcamentoNumero = "";
  let nomeDaPeca1 = "";
  let nomeDaPeca2 = "";
  let entregaFormatada = "";
  let totalAntesDeAprovar = "";
  let documentoHref = "";
  let encomendaHref = "";

  test("(a) 'Cliente aprovou' abre o diálogo com as linhas, as parcelas e a caixa da ordem marcada, somando o total do orçamento", async ({
    page,
  }) => {
    suf = sufixoUnico();
    await fazerLogin(page);

    orcamentoId = await criarOrcamentoPelaTela(page, `[e2e] Cliente Aprovação ${suf}`);
    await preencherTitulo(page, orcamentoId, `[e2e] Jogo Aprovação ${suf}`);

    nomeDaPeca1 = `[e2e] Aprovação Caneca ${suf}`;
    nomeDaPeca2 = `[e2e] Aprovação Prato ${suf}`;
    await acrescentarPecaExclusiva(page, orcamentoId, nomeDaPeca1, "100");
    await definirCorDaLinha(page, orcamentoId, nomeDaPeca1, "verde-musgo");
    await acrescentarPecaExclusiva(page, orcamentoId, nomeDaPeca2, "50");

    await acrescentarCustoDeProjeto(page, orcamentoId, `[e2e] Molde ${suf}`, "20");
    await definirFrete(page, orcamentoId, "10");

    // Peças 100 + 50, projeto 20, frete 10 = 180,00 — plano "sinal" 50% é o padrão de todo
    // orçamento novo (`criarOrcamento`, lib/orcamentos/acoes.ts), nunca tocado por este teste.
    await expect(page.getByTestId("orcamento-total")).toContainText("R$ 180,00");

    entregaFormatada = formatarDataCurta(await page.getByTestId("orcamento-campo-entrega").inputValue());
    orcamentoNumero = ((await page.getByTestId("orcamento-numero").textContent()) ?? "").replace(/^nº /, "");

    await marcarComoEnviado(page);
    totalAntesDeAprovar = (await page.getByTestId("orcamento-total").textContent()) ?? "";

    await abrirAprovacao(page);

    const linhasDaVenda = page.getByTestId("aprovar-linha-venda");
    await expect(linhasDaVenda).toHaveCount(4); // 2 peças + 1 custo de projeto + 1 frete
    await expect(linhasDaVenda.filter({ hasText: nomeDaPeca1 })).toBeVisible();
    await expect(linhasDaVenda.filter({ hasText: "Frete" })).toBeVisible();

    const somaDasLinhas = await somaDosLocators(linhasDaVenda);
    expect(somaDasLinhas).toBe(reaisParaCentavos(totalAntesDeAprovar));

    const parcelas = page.getByTestId("aprovar-parcela");
    await expect(parcelas).toHaveCount(2);
    await expect(parcelas.first()).toContainText("a receber hoje");
    await expect(parcelas.last()).toContainText("a receber");
    const somaDasParcelas = await somaDosLocators(parcelas);
    expect(somaDasParcelas).toBe(reaisParaCentavos(totalAntesDeAprovar));

    await expect(page.getByTestId("aprovar-ordem")).toBeChecked();
  });

  test("(b) confirmar cria a venda, o orçamento vira aprovado e o veredito mostra os dois links", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}&aprovar=1`);
    await expect(page.getByRole("heading", { name: "Cliente aprovou" })).toBeVisible();

    const botaoCriar = page.getByRole("button", { name: "Criar" });
    await expect(botaoCriar).toBeEnabled();
    await botaoCriar.click();

    // A confirmação termina em navegação COMPLETA para `?aviso=orcamento-aprovado`, mas
    // `AvisoFinanceiro` limpa esse parâmetro da URL segundos depois de montar (`history.
    // replaceState`, componente já existente) — esperar a query string transitória é uma corrida
    // que a suíte perde de vez em quando (mais rápido no desktop, quase sempre no celular). O
    // CHIP "aprovado" é servido pronto no HTML da navegação, nunca some — sinal confiável.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("aprovado", { timeout: 15000 });
    await expect(page.getByText(/Venda \d+ criada no Financeiro e ordem aberta na Produção\./)).toBeVisible();

    const linkVenda = page.getByTestId("veredito-ver-venda");
    const linkEncomenda = page.getByTestId("veredito-ver-encomenda");
    await expect(linkVenda).toBeVisible();
    await expect(linkEncomenda).toBeVisible();
    documentoHref = (await linkVenda.getAttribute("href")) ?? "";
    encomendaHref = (await linkEncomenda.getAttribute("href")) ?? "";
    expect(documentoHref).toMatch(/^\/gestao\/financeiro\?aba=caixa&documentoId=/);
    expect(encomendaHref).toMatch(/^\/gestao\/producao\/[0-9a-f-]{36}$/);

    // Fase 06.1 (PRD-10/PRD-11): a ordem gravada na MESMA transação — aguardando o sinal, sem
    // início, com o nome, o cliente e a entrega do orçamento; o orçamento aponta para ela.
    const ordemId = encomendaHref.split("/").pop() ?? "";
    expect(await vinculoDoOrcamento(orcamentoId)).toBe(ordemId);
    const ordem = await ordemNoBanco(ordemId);
    expect(ordem).toEqual({
      tipo: "encomenda",
      caminho: "completo",
      status: "aguardando_sinal",
      nome: `[e2e] Jogo Aprovação ${suf}`,
      clienteNome: `[e2e] Cliente Aprovação ${suf}`,
      entregaPrometida: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      inicio: null,
    });
    expect(formatarDataCurta(ordem?.entregaPrometida ?? "")).toBe(entregaFormatada);

    // As seis etapas do caminho completo, nenhuma feita, com os previstos do D-10.
    const etapas = await etapasDaOrdemNoBanco(ordemId);
    expect(etapas.map((etapa) => [etapa.etapa, etapa.diasPrevistos, etapa.feitaEm])).toEqual([
      ["producao", 5, null],
      ["secagem", 15, null],
      ["queima1", 1, null],
      ["esmaltacao", 4, null],
      ["queima2", 1, null],
      ["entrega", 6, null],
    ]);

    // Uma peça por linha, na ordem das linhas, com a ficha, a quantidade e a cor da linha; a
    // descrição é o nome congelado (sem a cor, que tem coluna própria). Custo de projeto e frete
    // não viram peça.
    const linhas = await linhasDoOrcamentoNoBanco(orcamentoId);
    const pecas = await pecasDaOrdemNoBanco(ordemId);
    expect(pecas).toEqual([
      {
        posicao: 0,
        fichaId: linhas[0].fichaId,
        descricao: nomeDaPeca1,
        quantidade: linhas[0].quantidade,
        cor: "verde-musgo",
        personalizacao: null,
      },
      {
        posicao: 1,
        fichaId: linhas[1].fichaId,
        descricao: nomeDaPeca2,
        quantidade: linhas[1].quantidade,
        cor: null,
        personalizacao: null,
      },
    ]);
  });

  test("(c) 🔴 'Ver venda no Financeiro' mostra o documento com o total certo e o sinal a receber (não recebido), vencendo hoje; o saldo vence na entrega", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(documentoHref);

    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible({ timeout: 10000 });

    const somaDasLinhas = await somaDosLocators(detalhe.getByTestId("documento-linha"));
    expect(somaDasLinhas).toBe(reaisParaCentavos(totalAntesDeAprovar));

    const parcelas = detalhe.getByTestId("documento-parcela");
    await expect(parcelas).toHaveCount(2);

    const hojeFormatado = formatarDataCurta(hojeNoAtelie());
    const textoSinal = (await parcelas.first().textContent()) ?? "";
    expect(textoSinal).toContain(`vence ${hojeFormatado}`);
    expect(textoSinal).not.toContain("recebida em");

    const textoSaldo = (await parcelas.last().textContent()) ?? "";
    expect(textoSaldo).toContain(`vence ${entregaFormatada}`);
    expect(textoSaldo).not.toContain("recebida em");
  });

  test("(d) o documento mostra 'Criado a partir do orçamento' e o link volta ao orçamento", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(documentoHref);

    const origem = page.getByTestId("documento-origem-orcamento");
    await expect(origem).toBeVisible();
    await expect(origem).toContainText(`Criado a partir do orçamento ${orcamentoNumero}`);

    await origem.getByRole("link", { name: "Ver orçamento" }).click();
    await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${orcamentoId}`));
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("aprovado");
  });

  test("(e) 'Ver encomenda na Produção' abre a ordem na Produção com o título e uma peça por linha, com a cor", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    await page.getByTestId("veredito-ver-encomenda").click();
    await expect(page).toHaveURL(new RegExp(encomendaHref.replace(/\//g, "\\/")));

    await expect(page.getByRole("heading", { name: `[e2e] Jogo Aprovação ${suf}` })).toBeVisible();

    // A cor fica na sub-linha da peça, não na descrição. A linha de origem ("Criado a partir do
    // orçamento") da página da ordem é do plano 06.1-04.
    const pecas = page.getByTestId("ordem-peca");
    await expect(pecas).toHaveCount(2);
    await expect(pecas.nth(0)).toContainText(nomeDaPeca1);
    await expect(pecas.nth(0)).toContainText("verde-musgo");
    await expect(pecas.nth(1)).toContainText(nomeDaPeca2);
  });

  test("(f) 🔴 cancelar a venda no Financeiro não apaga nem reabre o orçamento — ele continua aprovado e mostra o aviso", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(documentoHref);

    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar venda", exact: true }).click();
    // `ConfirmarCancelarDocumento` termina em NAVEGAÇÃO COMPLETA para `?aviso=cancelado&documento=
    // <id>` (nunca `?documentoId=` — propósitos diferentes) — o detalhe fecha junto com a página
    // antiga. Reabre o MESMO documento numa navegação fresca para confirmar o estado gravado.
    // NUNCA `toHaveURL(/aviso=.../)`: o `AvisoFinanceiro` apaga `aviso` da URL com
    // `history.replaceState` no mesmo instante em que mostra o toast, então a asserção de URL
    // aposta numa janela de milissegundos e perde a corrida sob carga (WINDOWS #49/#52). A regra
    // já estava escrita em `cadastros-base.spec.ts` desde a 04.4 — esperar o TOAST.
    //
    // Aqui o ponto é só sincronizar: só depois que o cancelamento concluiu é que faz sentido
    // reabrir o documento numa navegação fresca, logo abaixo.
    await expect(page.getByText(/Lançamento nº \d+ cancelado\. Continua visível, riscado\./)).toBeVisible({
      timeout: 10000,
    });

    await page.goto(documentoHref);
    await expect(page.getByTestId("documento-detalhe")).toContainText("Cancelado por");

    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("aprovado");

    const aviso = page.getByTestId("orcamento-aviso-venda-cancelada");
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveText(
      "A venda criada a partir deste orçamento foi cancelada. O orçamento continua aprovado.",
    );
  });

  test("(g) no orçamento aprovado não existe botão de editar, marcar como enviado ou atualizar preços — só 'Duplicar' (e 'Ver como o cliente vê')", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const botoes = page.getByTestId("orcamento-acoes").getByRole("button");
    await expect(botoes).toHaveCount(2);
    await expect(page.getByTestId("orcamento-acoes").getByRole("button", { name: "Ver como o cliente vê" })).toBeVisible();
    await expect(page.getByTestId("orcamento-acoes").getByRole("button", { name: "Duplicar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Atualizar preços" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cliente aprovou" })).toHaveCount(0);
  });

  test("(h) desmarcar a caixa da ordem cria só a venda — nenhuma ordem, e o veredito mostra um único link", async ({
    page,
  }) => {
    await fazerLogin(page);

    const orcamentoId2 = await criarOrcamentoPelaTela(page, `[e2e] Cliente Sem Ordem ${suf}`);
    await acrescentarPecaExclusiva(page, orcamentoId2, `[e2e] Sem Ordem Caneca ${suf}`, "80");
    await marcarComoEnviado(page);

    await abrirAprovacao(page);
    await page.getByTestId("aprovar-ordem").uncheck();
    await page.getByRole("button", { name: "Criar" }).click();

    // Mesma corrida documentada no caso (b) — o chip é o sinal durável, nunca a query string.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("aprovado", { timeout: 15000 });
    await expect(page.getByText(/^Venda \d+ criada no Financeiro\.$/)).toBeVisible();
    await expect(page.getByTestId("veredito-ver-venda")).toBeVisible();
    await expect(page.getByTestId("veredito-ver-encomenda")).toHaveCount(0);
    expect(await vinculoDoOrcamento(orcamentoId2)).toBeNull();
  });

  test("(i) a 320px o diálogo de aprovação rola no corpo, o rodapé continua visível e os alvos de toque medem ao menos 44px (backstop com oito peças)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const orcamentoId3 = await criarOrcamentoPelaTela(page, `[e2e] Cliente Oito Peças ${suf}`);
    for (let indice = 1; indice <= 8; indice += 1) {
      await acrescentarPecaExclusiva(page, orcamentoId3, `[e2e] Peça ${indice} ${suf}`, "30");
    }
    await marcarComoEnviado(page);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId3}&aprovar=1`);
    await expect(page.getByRole("heading", { name: "Cliente aprovou" })).toBeVisible();
    await expect(page.getByTestId("aprovar-linha-venda")).toHaveCount(8);

    const larguraDeRolagem = await page.evaluate(() => document.documentElement.scrollWidth);
    const larguraDaJanela = await page.evaluate(() => document.documentElement.clientWidth);
    expect(larguraDeRolagem).toBeLessThanOrEqual(larguraDaJanela + 1);

    const botaoVoltar = page.getByRole("button", { name: "Voltar" });
    const botaoCriar = page.getByRole("button", { name: "Criar" });
    await expect(botaoVoltar).toBeVisible();
    await expect(botaoCriar).toBeVisible();

    for (const botao of [botaoVoltar, botaoCriar]) {
      const caixa = await medirCaixa(botao);
      expect(caixa.height).toBeGreaterThanOrEqual(44);
      expect(caixa.y).toBeLessThan(700);
    }

    const caixaDoCheckbox = await medirCaixa(
      page.getByTestId("aprovar-ordem").locator("xpath=.."),
      "rótulo da caixa de abrir ordem",
    );
    expect(caixaDoCheckbox.height).toBeGreaterThanOrEqual(44);
    expect(caixaDoCheckbox.width).toBeGreaterThanOrEqual(44);
  });

  // 04.5-14-PLAN.md — o achado 14 da verificação humana: "na produção ela fica cancelada e vai
  // pro historico, mas tambem segue em verde com 'ordem aberta na Produção'". O irmão do caso
  // (f) acima, do outro lado do vínculo: lá a VENDA é cancelada, aqui a ENCOMENDA. Este lado do
  // critério 14 nunca foi implementado — `textoVeredito` recebia `encomendaId !== null`, que
  // responde "o id existe?", nunca "a ordem está aberta?".
  test("(j) 🔴 a ORDEM cancelada tira o 'ordem aberta' do veredito e avisa — o orçamento continua aprovado", async ({
    page,
  }) => {
    const sufDaOrdem = sufixoUnico();
    await fazerLogin(page);

    const orcamentoId4 = await criarOrcamentoPelaTela(
      page,
      `[e2e] Cliente Ordem Cancelada ${sufDaOrdem}`,
    );
    await acrescentarPecaExclusiva(page, orcamentoId4, `[e2e] Ordem Cancelada Caneca ${sufDaOrdem}`, "70");
    await marcarComoEnviado(page);

    await abrirAprovacao(page);
    await expect(page.getByTestId("aprovar-ordem")).toBeChecked();
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("aprovado", { timeout: 15000 });

    // Antes: a ordem existe e está aberta — o veredito pode dizer isso, e é verde.
    const bloco = page.getByTestId("orcamento-aviso-aprovado");
    await expect(bloco).toContainText("ordem aberta na Produção");
    const hrefDaOrdem = (await page.getByTestId("veredito-ver-encomenda").getAttribute("href")) ?? "";
    expect(hrefDaOrdem).toMatch(/^\/gestao\/producao\/[0-9a-f-]{36}$/);

    // Fase 06.1: a ordem é liberada e cancelada direto no banco (com os checks de
    // `inicio`/`cancelada_em`/`cancelada_por`). O que este caso prova é o que o ORÇAMENTO diz de
    // uma ordem cancelada; o caminho da tela ("Cancelar ordem", plano 06.1-06) tem o próprio e2e em
    // `producao-cancelar.spec.ts`.
    await cancelarOrdemNoBanco(hrefDaOrdem.split("/").pop() ?? "", diaEmBrasilia());

    // Depois: o orçamento continua aprovado, e o veredito para de afirmar uma ordem que a
    // Produção já não tem aberta.
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId4}`);
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("aprovado");

    const blocoDepois = page.getByTestId("orcamento-aviso-aprovado");
    await expect(blocoDepois).not.toContainText("ordem aberta na Produção");
    await expect(blocoDepois).toContainText("criada no Financeiro");

    const aviso = page.getByTestId("orcamento-aviso-encomenda-cancelada");
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveText(
      "A encomenda criada a partir deste orçamento foi cancelada na Produção. O orçamento continua aprovado, e nada foi apagado.",
    );

    // E deixa de ser verde: um bloco de "sucesso" afirmando uma coisa com um aviso desmentindo
    // logo abaixo é o defeito, não a solução.
    await expect(blocoDepois).not.toHaveClass(/bg-sucesso-fundo/);
    await expect(blocoDepois).toHaveClass(/bg-atencao-fundo/);

    // A VENDA não foi cancelada — o aviso dela não aparece, e o link para ela continua válido.
    await expect(page.getByTestId("orcamento-aviso-venda-cancelada")).toHaveCount(0);
    await expect(page.getByTestId("veredito-ver-venda")).toBeVisible();
  });
});

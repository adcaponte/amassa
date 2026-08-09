import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { marcarComoRascunho } from "./apoio/marcar-rascunho";

// A folha A4 de impressão (`/encomendas/imprimir`, D-18/ENC-14, 03-08-PLAN.md Tarefa 1):
// escopo próprio e fixo (sempre `rascunho`+`em_producao`, nunca o filtro/busca/ordenação da
// tela), quatro colunas exatas, sem truncamento, `@media print` medido de verdade com
// `page.emulateMedia({ media: "print" })` — nunca por leitura do CSS.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Desde o plano 06, `FormularioEncomenda` monta `Dialog` (desktop) E `Sheet` (celular) ao mesmo
// tempo — os dois existem no HTML, um escondido por CSS a cada largura (mesmo princípio de D-02
// para Gantt/lista). `:visible` escolhe a metade real do viewport do projeto Playwright atual.
function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Data civil `YYYY-MM-DD` a partir de hoje + `deslocamento` dias, calculada em Brasília — mesmo
// método de `hojeEmBrasilia` (lib/encomendas/formato.ts), nunca UTC puro (mesma justificativa
// de tests/e2e/encomendas-indice.spec.ts para a fronteira 21h-23h59).
function dataEmDias(deslocamento: number): string {
  const agora = new Date();
  const hojeEmBrasiliaTexto = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [ano, mes, dia] = hojeEmBrasiliaTexto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + deslocamento);
  return data.toISOString().slice(0, 10);
}

function hojeBrasilia(): string {
  return dataEmDias(0);
}

// Mesmo helper de retry de tests/e2e/encomendas-indice.spec.ts/encomendas-detalhe.spec.ts: sob
// o webServer local em paralelo, uma submissão isolada ocasionalmente fica presa em `?nova` sem
// redirecionar mesmo com a transação já concluída no servidor — reenviar sem checar duplicaria
// a encomenda. Devolve o `id` da encomenda (lido do cartão mobile, sempre no DOM por D-02),
// necessário para os `data-testid` que a folha expõe por linha.
async function criarEncomenda(
  page: Page,
  opcoes: { nome: string; cliente?: string; dataInicio: string },
): Promise<string> {
  const TENTATIVAS_MAXIMAS = 3;

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Nome da encomenda").fill(opcoes.nome);
    if (opcoes.cliente) {
      await campoVisivel(page, "Cliente").fill(opcoes.cliente);
    }
    await campoVisivel(page, "Data de início").fill(opcoes.dataInicio);
    await campoVisivel(page, "Descrição do item 1").fill("Item de teste [e2e]");
    await campoVisivel(page, "Quantidade do item 1").fill("1");
    await botaoVisivel(page, "Salvar").click();

    try {
      await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
      break;
    } catch (erro) {
      await page.goto("/encomendas");
      const jaFoiCriada = await page.getByText(opcoes.nome, { exact: true }).count();
      if (jaFoiCriada === 0) {
        if (tentativa === TENTATIVAS_MAXIMAS) throw erro;
        continue;
      }
      break;
    }
  }

  const cartao = page.locator('[data-testid^="cartao-encomenda-"]').filter({ hasText: opcoes.nome });
  await expect(cartao).toHaveCount(1);
  const testId = await cartao.getAttribute("data-testid");
  if (!testId) {
    throw new Error(`Não encontrou o cartão da encomenda "${opcoes.nome}" para descobrir o id.`);
  }
  return testId.replace("cartao-encomenda-", "");
}

async function abrirDetalhe(page: Page, id: string) {
  await page.goto(`/encomendas/${id}`);
}

test.describe("impressão de encomendas", () => {
  test.describe.configure({ mode: "serial" });

  // Primeiro teste do describe, de propósito: o total GLOBAL de encomendas ativas precisa
  // estar em zero para provar o estado vazio — confiável só quando rodado isolado
  // (`--grep "impressão de encomendas"`, o comando de verificação literal desta tarefa), mesma
  // limitação estrutural já documentada em `.planning/WINDOWS.md` (id 5) para
  // `encomendas-indice.spec.ts` sob a suíte completa em paralelo.
  test("sem nenhuma encomenda ativa, o botão do índice fica desabilitado com a nota, e a rota mostra a mesma frase", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas");

    // `expect(...).toBeDisabled()`/`toBeVisible()` fazem o auto-retry do Playwright (ao
    // contrário de `.count()`, que lê o DOM uma única vez sem esperar) — é o que torna esta
    // asserção confiável mesmo no instante exato em que a SSR ainda está assentando.
    const botaoImprimir = page.getByRole("button", { name: "Imprimir" }).and(page.locator(":visible"));
    await expect(botaoImprimir).toBeDisabled();
    await expect(page.getByText("Nada ativo para imprimir agora.")).toBeVisible();

    await page.goto("/encomendas/imprimir");
    await expect(page.getByText("Nada ativo para imprimir agora.")).toBeVisible();
  });

  test("/encomendas/imprimir sem sessão redireciona para /login", async ({ page }) => {
    await page.goto("/encomendas/imprimir");
    await expect(page).toHaveURL(/\/login/);
  });

  test("mostra o cabeçalho, a tabela de 4 colunas exatas e uma linha por encomenda ativa, com nome e caractere composto idênticos ao banco", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = `[e2e] Coleção Açúcar Ñ ${test.info().project.name} ${Date.now()}`;
    const id = await criarEncomenda(page, { nome, cliente: "Cliente inventado", dataInicio: hojeBrasilia() });

    await page.goto("/encomendas/imprimir");

    await expect(page.getByRole("heading", { name: "AMASSA — Encomendas ativas" })).toBeVisible();
    await expect(page.getByTestId("impresso-em")).toContainText("Impresso em");

    const cabecalhos = page.getByRole("columnheader");
    await expect(cabecalhos).toHaveText(["Nome", "Cliente", "Etapa atual", "Conclusão prevista"]);

    await expect(page.getByTestId(`impressao-nome-${id}`)).toHaveText(nome);
    await expect(page.getByTestId(`impressao-cliente-${id}`)).toHaveText("Cliente inventado");
    await expect(page.getByTestId(`impressao-etapa-${id}`)).not.toHaveText("");
    await expect(page.getByTestId(`impressao-conclusao-${id}`)).not.toHaveText("");
  });

  test("só rascunho e em_producao aparecem — concluída e cancelada nunca", async ({ page }) => {
    await fazerLogin(page);

    const nomeAtiva = nomeUnico("Impressão ativa fica");
    const nomeCancelada = nomeUnico("Impressão cancelada some");
    const nomeConcluida = nomeUnico("Impressão concluída some");

    const idAtiva = await criarEncomenda(page, { nome: nomeAtiva, dataInicio: hojeBrasilia() });

    const idCancelada = await criarEncomenda(page, { nome: nomeCancelada, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, idCancelada);
    await page.getByRole("button", { name: "Cancelar encomenda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar encomenda" }).click();
    await expect(page.getByText("Encomenda cancelada.")).toBeVisible();

    // 60 dias atrás: a conclusão prevista já passou, "Marcar como concluída" conclui direto,
    // sem confirmação prévia.
    const idConcluida = await criarEncomenda(page, { nome: nomeConcluida, dataInicio: dataEmDias(-60) });
    await abrirDetalhe(page, idConcluida);
    await page.getByRole("button", { name: "Marcar como concluída" }).click();
    await expect(page.getByRole("button", { name: "Marcar como concluída" })).toHaveCount(0, {
      timeout: 10000,
    });

    await page.goto("/encomendas/imprimir");
    await expect(page.getByTestId(`linha-impressao-${idAtiva}`)).toBeVisible();
    await expect(page.getByTestId(`linha-impressao-${idCancelada}`)).toHaveCount(0);
    await expect(page.getByTestId(`linha-impressao-${idConcluida}`)).toHaveCount(0);
  });

  test("um filtro aplicado no índice não muda o que a folha mostra", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Impressão ignora filtro");
    const id = await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });

    // Filtro no índice que EXCLUI a encomenda recém-criada (D-11, roda no cliente).
    await page.goto("/encomendas");
    const busca = page.getByPlaceholder("Buscar por nome, cliente ou item…").and(page.locator(":visible"));
    await busca.fill("um termo que não bate com nada disto");
    await expect(page.getByText("Nada por aqui com esse filtro.")).toBeVisible();

    // A folha usa escopo PRÓPRIO — o filtro acima nunca chega até ela.
    await page.goto("/encomendas/imprimir");
    await expect(page.getByTestId(`linha-impressao-${id}`)).toBeVisible();
  });

  test("nome de encomenda rascunho leva o sufixo ' (rascunho)'", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Impressão rascunho");
    const id = await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await marcarComoRascunho(id);

    await page.goto("/encomendas/imprimir");
    await expect(page.getByTestId(`impressao-nome-${id}`)).toHaveText(`${nome} (rascunho)`);
  });

  test("encomenda atrasada mostra o sufixo textual '(atrasada)' na coluna de etapa atual, sem depender de cor", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Impressão atrasada");
    // 30 dias atrás: a cascata padrão (13 dias) já terminou há muito, e a encomenda continua
    // em_producao (D-05 — atraso nunca é deduzido automaticamente para "concluída").
    const id = await criarEncomenda(page, { nome, dataInicio: dataEmDias(-30) });

    await page.goto("/encomendas/imprimir");
    const celulaEtapa = page.getByTestId(`impressao-etapa-${id}`);
    await expect(celulaEtapa).toContainText("(atrasada)");

    // Sem cor: nenhum elemento dentro da célula depende de --color-atencao para carregar o
    // significado — é texto puro, legível em P&B.
    const corDoTexto = await celulaEtapa.evaluate((el) => getComputedStyle(el).color);
    expect(corDoTexto).not.toBe("rgb(180, 83, 9)");
  });

  test("encomenda que ainda não começou mostra o rótulo do caso, nunca célula vazia", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Impressão futuro");
    const id = await criarEncomenda(page, { nome, dataInicio: dataEmDias(30) });

    await page.goto("/encomendas/imprimir");
    const celulaEtapa = page.getByTestId(`impressao-etapa-${id}`);
    await expect(celulaEtapa).toContainText("Começa em 30 dias");
  });

  test("um nome de 120 caracteres sem espaço quebra na célula, nunca é truncado", async ({ page }) => {
    await fazerLogin(page);
    const base = "PecaEncomendadaComNomeMuitoCompridoDePropositoParaTestarQuebraDeLinhaNaFolha";
    const sufixo = `${test.info().project.name}${Date.now()}`;
    const nomeLongo = (base + sufixo).padEnd(120, "x").slice(0, 120);
    const id = await criarEncomenda(page, { nome: nomeLongo, dataInicio: hojeBrasilia() });

    await page.goto("/encomendas/imprimir");
    const celula = page.getByTestId(`impressao-nome-${id}`);
    await expect(celula).toContainText(nomeLongo);

    const estilo = await celula.evaluate((el) => getComputedStyle(el).overflowWrap);
    expect(estilo).toBe("anywhere");

    const [scrollWidth, clientWidth] = await celula.evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("com 20 encomendas ativas, nenhuma some da folha", async ({ page }) => {
    // 20 criações sequenciais pela UI real cabem nos 30s padrão quando rodadas isoladas
    // (~16-20s medido), mas a suíte inteira sob `--grep "encomenda"` disputa o mesmo webServer
    // com 8 workers simultâneos — o mesmo tipo de folga que 03-05-SUMMARY.md já registrou para
    // asserções pós-`router.refresh()` sob carga. Timeout alargado, não a lógica do teste.
    test.setTimeout(120_000);

    await fazerLogin(page);
    const prefixo = nomeUnico("Impressão volume");
    const ids: string[] = [];

    for (let indice = 0; indice < 20; indice++) {
      const id = await criarEncomenda(page, {
        nome: `${prefixo} #${indice}`,
        dataInicio: hojeBrasilia(),
      });
      ids.push(id);
    }

    await page.goto("/encomendas/imprimir");
    for (const id of ids) {
      await expect(page.getByTestId(`linha-impressao-${id}`)).toBeVisible();
    }
  });

  test("sob @media print, a escala tipográfica não encolhe abaixo de 8pt/10pt, e o cabeçalho de coluna repete via table-header-group", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Impressão escala");
    const id = await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });

    await page.goto("/encomendas/imprimir");
    await page.emulateMedia({ media: "print" });

    const th = page.getByRole("columnheader", { name: "Nome" });
    const tamanhoTh = await th.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(tamanhoTh).toBeCloseTo(8 * (96 / 72), 1);

    const celula = page.getByTestId(`impressao-nome-${id}`);
    const tamanhoTd = await celula.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(tamanhoTd).toBeCloseTo(10 * (96 / 72), 1);

    const thead = page.locator("table thead");
    const display = await thead.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("table-header-group");

    const linha = page.getByTestId(`linha-impressao-${id}`);
    const breakInside = await linha.evaluate((el) => getComputedStyle(el).breakInside);
    expect(breakInside).toBe("avoid");

    // O botão que dispara `window.print()` não faz sentido NO PAPEL.
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden();
  });

  test("axe-core não encontra violação de nível A/AA em /encomendas/imprimir", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Impressão axe");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });

    await page.goto("/encomendas/imprimir");
    const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    expect(
      resultado.violations,
      resultado.violations
        .map((violacao) => `${violacao.id}: ${violacao.help} (${violacao.nodes.length} nó(s))`)
        .join("\n"),
    ).toEqual([]);
  });
});

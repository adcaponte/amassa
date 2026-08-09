import { test, expect, type Page } from "@playwright/test";

import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { formatarDiaCurto, formatarIntervalo } from "@/lib/encomendas/formato";
import { ROTULO_ETAPA, textoDaSituacao } from "@/lib/encomendas/textos";

// Página de detalhe (`/encomendas/[id]`, D-01/D-04): a trilha vertical de seis etapas com as
// datas certas (Tarefa 1), o ajuste rápido sem otimismo (Tarefa 2) e as ações de ciclo de vida
// com a hierarquia cancelar/excluir (Tarefa 3) — 03-05-PLAN.md. `calcularCronograma`/
// `situacaoEm`/`textoDaSituacao` são importados diretos dos módulos puros de produção (zero
// import cada um) — o teste RECOMPUTA o valor esperado com a MESMA função que o servidor usa,
// nunca duplica a aritmética de cascata/fim-exclusivo aqui (mesmo princípio de
// tests/e2e/encomendas-indice.spec.ts).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Mesmo helper de retry de tests/e2e/encomendas-indice.spec.ts: no ambiente local (webServer
// único, sem retry do Playwright fora do CI), uma submissão isolada ocasionalmente fica presa em
// `?nova` sem redirecionar mesmo com a transação já concluída — reenviar sem checar duplicaria a
// encomenda.
async function criarEncomenda(
  page: Page,
  opcoes: {
    nome: string;
    cliente?: string;
    dataInicio: string;
    itemDescricao?: string;
    itemQuantidade?: string;
  },
) {
  const TENTATIVAS_MAXIMAS = 3;

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    await page.goto("/encomendas?nova");
    await page.getByLabel("Nome da encomenda").fill(opcoes.nome);
    if (opcoes.cliente) {
      await page.getByLabel("Cliente").fill(opcoes.cliente);
    }
    await page.getByLabel("Data de início").fill(opcoes.dataInicio);
    await page.getByLabel("Descrição do item").fill(opcoes.itemDescricao ?? "Item de teste [e2e]");
    await page.getByLabel("Quantidade").fill(opcoes.itemQuantidade ?? "1");
    await page.getByRole("button", { name: "Salvar" }).click();

    try {
      await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
      return;
    } catch (erro) {
      await page.goto("/encomendas");
      const jaFoiCriada = await page.getByText(opcoes.nome, { exact: true }).count();
      if (jaFoiCriada > 0) {
        return;
      }
      if (tentativa === TENTATIVAS_MAXIMAS) {
        throw erro;
      }
    }
  }
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Data civil `YYYY-MM-DD` a partir de hoje + `deslocamento` dias, calculada em Brasília — mesmo
// método de `hojeEmBrasilia` (lib/encomendas/formato.ts), não UTC puro (ver
// tests/e2e/encomendas-indice.spec.ts para a justificativa completa da fronteira 21h-23h59).
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

// Navega para `/encomendas`, acha o cartão da lista mobile pelo nome (existe no DOM nos dois
// projetos — D-02, só escondido por CSS no desktop) e lê o `id` do próprio `data-testid` que
// `cartao-encomenda.tsx` expõe — nunca clica (o Gantt desktop ainda não linka para o detalhe,
// só o cartão mobile faz isso), e nunca INSERE direto no banco: o `id` sai do mesmo dado real
// que a Server Action gravou.
async function abrirDetalhe(page: Page, nome: string): Promise<string> {
  await page.goto("/encomendas");
  const cartao = page.locator('[data-testid^="cartao-encomenda-"]').filter({ hasText: nome });
  await expect(cartao).toHaveCount(1);
  const testId = await cartao.getAttribute("data-testid");
  if (!testId) {
    throw new Error(`Não encontrou o cartão da encomenda "${nome}" para descobrir o id.`);
  }
  const id = testId.replace("cartao-encomenda-", "");
  await page.goto(`/encomendas/${id}`);
  return id;
}

test.describe("detalhe da encomenda", () => {
  // Mesma prudência de outros specs da fase: login é uma conferência argon2id deliberadamente
  // lenta.
  test.describe.configure({ mode: "serial" });

  test("mostra o nome no cabeçalho e as seis linhas da trilha", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe populado");
    await criarEncomenda(page, { nome, cliente: "Cliente inventado", dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();

    for (const etapa of Object.keys(ROTULO_ETAPA) as (keyof typeof ROTULO_ETAPA)[]) {
      await expect(page.getByTestId(`trilha-linha-${etapa}`)).toBeVisible();
      await expect(page.getByTestId(`trilha-linha-${etapa}`)).toContainText(ROTULO_ETAPA[etapa]);
    }
  });

  test("um id inexistente responde 404 pela tela de not-found do grupo protegido", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas/00000000-0000-0000-0000-000000000000");

    await expect(page.getByRole("heading", { name: "Esta página não existe." })).toBeVisible();
  });

  test("uma etapa de intervalo mostra o par de datas, e a data de fim é o último dia que a etapa ocupa (nunca o fimExclusivo)", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe intervalo");
    const dataInicio = hojeBrasilia();
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
    const producao = cronograma.faixas.find((faixa) => faixa.etapa === "producao");
    if (!producao || producao.ultimoDia === null) {
      throw new Error("Fixture inesperada: produção sem ultimoDia.");
    }

    const textoEsperado = formatarIntervalo(producao.inicio, producao.ultimoDia);
    await expect(page.getByTestId("trilha-linha-producao")).toContainText(textoEsperado);
    // fimExclusivo é o dia em que a PRÓXIMA etapa começa — nunca deve aparecer como "fim" desta
    // linha (só a asserção acima, com ultimoDia, é suficiente para provar isso: fimExclusivo e
    // ultimoDia diferem em 1 dia civil, e formatarIntervalo com fimExclusivo produziria um texto
    // diferente do afirmado).
  });

  test("um marco mostra uma data única", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe marco");
    const dataInicio = hojeBrasilia();
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
    const queima1 = cronograma.faixas.find((faixa) => faixa.etapa === "queima1");
    if (!queima1) {
      throw new Error("Fixture inesperada: queima1 ausente.");
    }

    const textoEsperado = formatarDiaCurto(queima1.inicio);
    await expect(page.getByTestId("trilha-linha-queima1")).toContainText(textoEsperado);
  });

  test("a linha da etapa de hoje ganha o selo HOJE, e o texto de contexto bate com textoDaSituacao", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe hoje");
    const dataInicio = hojeBrasilia();
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    // Encomenda criada hoje: a cascata começa em produção, então a etapa de hoje é produção.
    const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
    const situacao = situacaoEm(cronograma, "em_producao", hojeBrasilia());

    await expect(page.getByTestId("selo-hoje")).toHaveCount(1);
    await expect(page.getByTestId("trilha-linha-producao").getByTestId("selo-hoje")).toBeVisible();
    await expect(page.locator("body")).toContainText(textoDaSituacao(situacao));
  });

  test("uma encomenda que ainda não começou não tem nenhuma linha com o selo HOJE", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe futuro");
    await criarEncomenda(page, { nome, dataInicio: dataEmDias(30) });
    await abrirDetalhe(page, nome);

    await expect(page.getByTestId("selo-hoje")).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Começa em 30 dias");
  });

  test("na fronteira exata entre duas etapas, o selo HOJE fica na que COMEÇA naquele dia", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe fronteira");
    // Produção dura 3 dias (padrão) — começando 3 dias atrás, hoje é exatamente o dia em que
    // produção termina (fimExclusivo) e secagem começa.
    const dataInicio = dataEmDias(-3);
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    await expect(page.getByTestId("selo-hoje")).toHaveCount(1);
    await expect(page.getByTestId("trilha-linha-secagem").getByTestId("selo-hoje")).toBeVisible();
    await expect(
      page.getByTestId("trilha-linha-producao").getByTestId("selo-hoje"),
    ).toHaveCount(0);
  });

  test("a lista de itens mostra descrição e quantidade, e uma descrição longa quebra em linha sem cortar", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Detalhe item longo");
    // Comprida o bastante para não caber numa única linha estreita, mas dentro do limite de 200
    // pontos de código de `esquemaItem.descricao` — passar do limite falha a validação Zod em
    // silêncio (stub conhecido, 03-01-SUMMARY.md: o formulário não mostra erro na tela), o que
    // prenderia o teste em `?nova` para sempre.
    const descricaoLonga =
      "Descrição de item bem comprida de propósito para testar a quebra de linha na lista de itens da página de detalhe, sem cortar em nenhum ponto do texto — dentro do limite, mas bem longa.";
    await criarEncomenda(page, {
      nome,
      dataInicio: hojeBrasilia(),
      itemDescricao: descricaoLonga,
      itemQuantidade: "7",
    });

    await abrirDetalhe(page, nome);

    const secaoDeItens = page.getByRole("region", { name: "Itens da encomenda" });
    await expect(secaoDeItens).toContainText(descricaoLonga);
    await expect(secaoDeItens).toContainText("7");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const descricaoNaTela = secaoDeItens.getByText(descricaoLonga, { exact: true });
    const estiloDeQuebra = await descricaoNaTela.evaluate((el) => getComputedStyle(el).overflowWrap);
    expect(estiloDeQuebra).toBe("break-word");
  });

  test("no projeto celular, a página de detalhe não rola horizontalmente", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "celular", "Regra dura de rolagem horizontal — só celular");

    await fazerLogin(page);
    const nome = nomeUnico("Detalhe sem rolagem");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});

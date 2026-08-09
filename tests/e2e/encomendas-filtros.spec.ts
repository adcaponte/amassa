import { test, expect, type Page } from "@playwright/test";

import { calcularCronograma, DIAS_PADRAO } from "@/lib/encomendas/cronograma";
import { calcularIntervalo } from "@/lib/encomendas/gantt";
import {
  FRASE_FILTRO_VAZIO_TITULO,
  FRASE_VAZIO_TITULO,
  ROTULO_FILTRAR_E_ORDENAR,
  ROTULO_LIMPAR_FILTROS,
  ROTULO_ORDENACAO,
  ROTULO_STATUS,
} from "@/lib/encomendas/textos";

// Filtro, busca e ordenação no cliente (D-11 a D-14, 03-07-PLAN.md) e o histórico como o próprio
// índice com o filtro em "Concluídas"/"Canceladas" (D-07). Os dois describes de topo casam com
// os dois comandos de verificação do plano: `--grep "filtro de encomendas"` (Tarefa 1/2) e
// `--grep "histórico de encomendas"` (Tarefa 3).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo, { exact: true }).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
}

function textoVisivel(page: Page, texto: string) {
  return page.getByText(texto, { exact: true }).and(page.locator(":visible"));
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Mesmo método de `hojeEmBrasilia` (lib/encomendas/formato.ts) — nunca UTC puro nem o fuso local
// do processo de teste (o mesmo cuidado de 03-04-SUMMARY.md, Deviation 7).
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

// Cria pela Server Action real via formulário — nunca INSERT direto no banco. As 6 etapas nascem
// com `DIAS_PADRAO` (produção 3 · secagem 6 · queima1 1 · esmaltação 1 · queima2 1 · entrega 1).
// Retry com checagem de duplicidade — mesma proteção de 03-04/03-05/03-06 contra a submissão que
// ocasionalmente fica presa em `?nova` sob o webServer local.
async function criarEncomenda(
  page: Page,
  opcoes: { nome: string; cliente?: string; dataInicio: string; itemDescricao?: string },
) {
  const TENTATIVAS_MAXIMAS = 3;

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Nome da encomenda").fill(opcoes.nome);
    if (opcoes.cliente) {
      await campoVisivel(page, "Cliente").fill(opcoes.cliente);
    }
    await campoVisivel(page, "Data de início").fill(opcoes.dataInicio);
    await campoVisivel(page, "Descrição do item 1").fill(opcoes.itemDescricao ?? "Item de teste [e2e]");
    await campoVisivel(page, "Quantidade do item 1").fill("1");
    await botaoVisivel(page, "Salvar").click();

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

// No celular, status/ordenação vivem DENTRO do `Sheet` (03-UI-SPEC.md "Filtro, Busca e
// Ordenação — Celular") — o `Select` só existe no DOM depois que o botão `SlidersHorizontal`
// abre a folha. No desktop, os dois `Select` já estão visíveis na barra fixa.
async function abrirControlesSeCelular(page: Page) {
  const botaoFiltrar = page.getByRole("button", { name: ROTULO_FILTRAR_E_ORDENAR });
  if (await botaoFiltrar.isVisible()) {
    await botaoFiltrar.click();
  }
}

async function selecionarOpcao(page: Page, rotuloDoControle: string, rotuloDaOpcao: string) {
  await abrirControlesSeCelular(page);
  await page
    .getByRole("combobox", { name: rotuloDoControle })
    .and(page.locator(":visible"))
    .click();
  await page.getByRole("option", { name: rotuloDaOpcao, exact: true }).click();
}

test.describe("filtro de encomendas", () => {
  // Mesma prudência de tests/e2e/encomendas-indice.spec.ts: login é uma conferência argon2id
  // deliberadamente lenta, e o primeiro teste depende do banco de teste efêmero estar
  // genuinamente vazio — precisa ser o PRIMEIRO a tocar `/encomendas` neste arquivo.
  test.describe.configure({ mode: "serial" });

  // Declarado ANTES dos demais de propósito (mesma disciplina de 03-04): rodando com o grep
  // deste describe (`--grep "filtro de encomendas"`, o comando de verificação da Tarefa 2),
  // nenhum outro arquivo de spec entra na mesma execução, então o banco efêmero (recriado do
  // zero a cada `npm run test:e2e`) está genuinamente vazio aqui.
  test('com o banco vazio, "A roda ainda não gira." aparece e "Nada por aqui com esse filtro." não', async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/encomendas");

    await expect(page.getByText(FRASE_FILTRO_VAZIO_TITULO)).toHaveCount(0);
    await expect(page.getByText(FRASE_VAZIO_TITULO)).toHaveCount(1);
  });

  test("digitar um termo reduz a lista sem recarregar a página e sem nenhuma requisição de rede", async ({
    page,
  }) => {
    await fazerLogin(page);

    const marcador = `busca-${Date.now()}`;
    const nomeA = `[e2e] ${marcador} Alfa`;
    const nomeB = nomeUnico("Fora do termo de busca");

    await criarEncomenda(page, { nome: nomeA, dataInicio: dataEmDias(3) });
    await criarEncomenda(page, { nome: nomeB, dataInicio: dataEmDias(4) });

    await page.goto("/encomendas");
    await expect(textoVisivel(page, nomeA)).toBeVisible();
    await expect(textoVisivel(page, nomeB)).toBeVisible();

    // Marcador de `window` que só sobrevive se NENHUMA navegação de página inteira acontecer —
    // filtrar é puro estado de cliente (D-11), nunca uma ida ao servidor.
    await page.evaluate(() => {
      (window as unknown as { __semRecarregar: boolean }).__semRecarregar = true;
    });
    const urlAntes = page.url();

    await campoVisivel(page, "Buscar encomendas").fill(marcador);

    await expect(textoVisivel(page, nomeA)).toBeVisible();
    await expect(page.getByText(nomeB, { exact: true })).toHaveCount(0);

    expect(page.url()).toBe(urlAntes);
    const marcadorSobreviveu = await page.evaluate(
      () => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar === true,
    );
    expect(marcadorSobreviveu).toBe(true);
  });

  test('termo sem resultado mostra "Nada por aqui com esse filtro." com "Limpar filtros" ativo, e limpar devolve a lista inteira', async ({
    page,
  }) => {
    await fazerLogin(page);

    const nome = nomeUnico("Encontrável de novo após limpar");
    await criarEncomenda(page, { nome, dataInicio: dataEmDias(5) });

    await page.goto("/encomendas");
    await campoVisivel(page, "Buscar encomendas").fill("termo-que-nao-existe-em-nenhuma-encomenda-xyz");

    await expect(textoVisivel(page, FRASE_FILTRO_VAZIO_TITULO)).toBeVisible();
    const botaoLimpar = botaoVisivel(page, ROTULO_LIMPAR_FILTROS);
    await expect(botaoLimpar).toBeVisible();
    await expect(botaoLimpar).toBeEnabled();

    await botaoLimpar.click();

    await expect(page.getByText(FRASE_FILTRO_VAZIO_TITULO)).toHaveCount(0);
    await expect(textoVisivel(page, nome)).toBeVisible();
    await expect(campoVisivel(page, "Buscar encomendas")).toHaveValue("");
  });

  test("filtrar reduz o intervalo do Gantt (D-14): a largura do contêiner rolável diminui e passa a cobrir só o que sobrou", async ({
    page,
  }) => {
    await fazerLogin(page);

    const marcador = `d14-${Date.now()}`;
    const nomeLonginqua = nomeUnico("Bem longe do filtro de março");
    const nomeA = `[e2e] ${marcador} A`;
    const nomeB = `[e2e] ${marcador} B`;
    const dataA = dataEmDias(10);
    const dataB = dataEmDias(20);

    // A encomenda "longínqua" só serve para garantir que o intervalo ANTES do filtro seja bem
    // mais largo que o intervalo DEPOIS — sem ela, um banco de teste com poucas encomendas
    // poderia coincidentemente já ter um intervalo estreito antes de filtrar.
    await criarEncomenda(page, { nome: nomeLonginqua, dataInicio: dataEmDias(-200) });
    await criarEncomenda(page, { nome: nomeA, dataInicio: dataA });
    await criarEncomenda(page, { nome: nomeB, dataInicio: dataB });

    await page.goto("/encomendas");

    const larguraAntes = Number(
      await page.getByTestId("intervalo-do-gantt").getAttribute("data-largura-em-pixels"),
    );

    await campoVisivel(page, "Buscar encomendas").fill(marcador);
    await expect(page.getByText(nomeLonginqua, { exact: true })).toHaveCount(0);
    await expect(textoVisivel(page, nomeA)).toBeVisible();
    await expect(textoVisivel(page, nomeB)).toBeVisible();

    const hoje = await page.getByTestId("linha-hoje").getAttribute("data-hoje");
    const larguraDepois = Number(
      await page.getByTestId("intervalo-do-gantt").getAttribute("data-largura-em-pixels"),
    );

    expect(larguraDepois).toBeLessThan(larguraAntes);

    // Confirma o valor EXATO recomputando com a MESMA função de produção (`calcularIntervalo`)
    // sobre os cronogramas reais das duas encomendas que sobraram — nunca um valor solto
    // "menor que antes" sem prova do quanto.
    const cronogramaA = calcularCronograma(dataA, DIAS_PADRAO);
    const cronogramaB = calcularCronograma(dataB, DIAS_PADRAO);
    const intervaloEsperado = calcularIntervalo([cronogramaA, cronogramaB], hoje ?? dataEmDias(0));
    expect(larguraDepois).toBe(intervaloEsperado.larguraEmPixels);
  });

  test("trocar a ordenação para «Nome» reordena o Gantt e os cartões juntos", async ({ page }) => {
    await fazerLogin(page);

    const marcador = `ordem-${Date.now()}`;
    const nomeZebra = `[e2e] ${marcador} Zebra`; // data mais cedo, nome no fim do alfabeto
    const nomeAbaco = `[e2e] ${marcador} Ábaco`; // data mais tarde, nome no início do alfabeto

    await criarEncomenda(page, { nome: nomeZebra, dataInicio: dataEmDias(1) });
    await criarEncomenda(page, { nome: nomeAbaco, dataInicio: dataEmDias(2) });

    await page.goto("/encomendas");
    await campoVisivel(page, "Buscar encomendas").fill(marcador);

    // Padrão (D-12: data de início) — Zebra (data mais cedo) vem antes de Ábaco.
    const textosGanttPadrao = await page.locator('[data-testid^="gantt-linha-"]').allTextContents();
    expect(
      textosGanttPadrao.findIndex((t) => t.includes("Zebra")) <
        textosGanttPadrao.findIndex((t) => t.includes("Ábaco")),
    ).toBe(true);
    const textosCartaoPadrao = await page
      .locator('[data-testid^="cartao-encomenda-"]')
      .allTextContents();
    expect(
      textosCartaoPadrao.findIndex((t) => t.includes("Zebra")) <
        textosCartaoPadrao.findIndex((t) => t.includes("Ábaco")),
    ).toBe(true);

    await selecionarOpcao(page, ROTULO_ORDENACAO, "Nome");

    // Depois de "Nome" — Ábaco (localeCompare pt-BR) vem antes de Zebra, no Gantt E nos cartões.
    const textosGanttDepois = await page.locator('[data-testid^="gantt-linha-"]').allTextContents();
    expect(
      textosGanttDepois.findIndex((t) => t.includes("Ábaco")) <
        textosGanttDepois.findIndex((t) => t.includes("Zebra")),
    ).toBe(true);
    const textosCartaoDepois = await page
      .locator('[data-testid^="cartao-encomenda-"]')
      .allTextContents();
    expect(
      textosCartaoDepois.findIndex((t) => t.includes("Ábaco")) <
        textosCartaoDepois.findIndex((t) => t.includes("Zebra")),
    ).toBe(true);
  });

  test("recarregar a página perde o filtro e volta ao padrão", async ({ page }) => {
    await fazerLogin(page);

    const nome = nomeUnico("Reaparece após recarregar");
    await criarEncomenda(page, { nome, dataInicio: dataEmDias(6) });

    await page.goto("/encomendas");
    await campoVisivel(page, "Buscar encomendas").fill("termo-que-nao-existe-em-nenhuma-encomenda-xyz");
    await expect(textoVisivel(page, FRASE_FILTRO_VAZIO_TITULO)).toBeVisible();

    await page.reload();

    await expect(campoVisivel(page, "Buscar encomendas")).toHaveValue("");
    await expect(page.getByText(FRASE_FILTRO_VAZIO_TITULO)).toHaveCount(0);
    await expect(textoVisivel(page, nome)).toBeVisible();
  });

  test("no desktop, os três controles ficam lado a lado, sempre visíveis, acima do Gantt", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Barra do desktop só é exercitada no projeto desktop.");
    await fazerLogin(page);
    await criarEncomenda(page, { nome: nomeUnico("Para a barra do desktop existir"), dataInicio: dataEmDias(7) });

    await page.goto("/encomendas");
    const barra = page.getByTestId("filtro-desktop");
    await expect(barra).toBeVisible();
    await expect(barra.getByLabel("Buscar encomendas")).toBeVisible();
    await expect(barra.getByRole("combobox", { name: ROTULO_STATUS })).toBeVisible();
    await expect(barra.getByRole("combobox", { name: ROTULO_ORDENACAO })).toBeVisible();
  });

  test("no celular, a busca fica numa barra fixa e status/ordenação abrem um Sheet de 44×44px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "celular", "Barra do celular só é exercitada no projeto celular.");
    await fazerLogin(page);
    await criarEncomenda(page, { nome: nomeUnico("Para a barra do celular existir"), dataInicio: dataEmDias(8) });

    await page.goto("/encomendas");
    const barra = page.getByTestId("filtro-celular");
    await expect(barra).toBeVisible();
    await expect(barra.getByLabel("Buscar encomendas")).toBeVisible();

    const botaoFiltrar = page.getByRole("button", { name: ROTULO_FILTRAR_E_ORDENAR });
    await expect(botaoFiltrar).toBeVisible();
    const caixa = await botaoFiltrar.boundingBox();
    expect(caixa?.width).toBeGreaterThanOrEqual(44);
    expect(caixa?.height).toBeGreaterThanOrEqual(44);

    await botaoFiltrar.click();
    const folha = page.getByTestId("filtro-sheet");
    await expect(folha).toBeVisible();
    await expect(folha.getByRole("combobox", { name: ROTULO_STATUS })).toBeVisible();
    await expect(folha.getByRole("combobox", { name: ROTULO_ORDENACAO })).toBeVisible();
  });
});

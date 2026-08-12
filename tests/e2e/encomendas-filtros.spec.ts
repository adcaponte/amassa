import { test, expect, type Page } from "@playwright/test";

import { calcularCronograma, DIAS_PADRAO } from "@/lib/encomendas/cronograma";
import { calcularIntervalo } from "@/lib/encomendas/gantt";
import {
  FRASE_FILTRO_VAZIO_TITULO,
  FRASE_HISTORICO_VAZIO,
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
// ocasionalmente fica presa em `?nova` sob o webServer local. `itensExtras` (Tarefa 3) clica
// "Adicionar item" pelo formulário antes de enviar — nunca edita depois, para testar a criação
// com vários itens de uma vez.
async function criarEncomenda(
  page: Page,
  opcoes: {
    nome: string;
    cliente?: string;
    dataInicio: string;
    itemDescricao?: string;
    itensExtras?: string[];
  },
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

    for (const [indice, descricao] of (opcoes.itensExtras ?? []).entries()) {
      await botaoVisivel(page, "Adicionar item").click();
      const numero = indice + 2;
      await campoVisivel(page, `Descrição do item ${numero}`).fill(descricao);
      await campoVisivel(page, `Quantidade do item ${numero}`).fill("1");
    }

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

// Localiza o cartão da encomenda no índice (D-02: sempre no DOM, mesmo escondido por CSS) para
// descobrir o `id` sem depender de clicar num elemento visível — a mesma técnica de
// `tests/e2e/encomendas-detalhe.spec.ts`.
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
  // `page.goto` só espera o evento `load` — a hidratação do React (que anexa o `onClick` dos
  // botões da trilha) roda um instante depois, ainda mais sob os dois workers do Playwright
  // disputando CPU. Sem esta espera, um clique imediato em "Marcar como concluída"/"Cancelar
  // encomenda" pode chegar ANTES do listener existir: o Playwright vê o botão visível e estável
  // (checagem de DOM/CSS) e clica, mas nada acontece (o clique nativo não tem handler nenhum
  // ainda) — sintoma observado direto: o botão continua lá, sem erro nenhum reportado.
  await page.waitForLoadState("networkidle").catch(() => {});
  return id;
}

// Conclui pela trilha vertical real (plano 05) — nunca a Server Action chamada direto. Confirma
// o alert-dialog não-destrutivo só se ele aparecer (conclusão antes da data prevista) — com
// ESPERA de verdade (`waitFor`), não um retrato instantâneo (`isVisible()` sem espera corria o
// risco de checar ANTES da animação de abertura do diálogo terminar, pulando o clique em
// "Concluir" e deixando a encomenda sem concluir de verdade). A confirmação de sucesso é o texto
// "Concluída em" na página — o mesmo critério, mais forte, que
// `tests/e2e/encomendas-detalhe.spec.ts` já usa; o botão "Marcar como concluída" sumir sozinho
// NÃO é prova suficiente (um diálogo aberto por cima também tira o botão da árvore de
// acessibilidade via `aria-hidden`, sem a encomenda ter sido concluída de verdade).
async function concluirViaDetalhe(page: Page, nome: string): Promise<string> {
  const id = await abrirDetalhe(page, nome);
  const botaoConcluir = page.getByRole("button", { name: "Marcar como concluída" });
  const dialogo = page.getByRole("alertdialog");

  await botaoConcluir.click();
  await dialogo
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => dialogo.getByRole("button", { name: "Concluir" }).click())
    .catch(() => {});

  try {
    await expect(page.locator("body")).toContainText("Concluída em", { timeout: 4000 });
  } catch {
    // Retry de clique: mesmo com `networkidle` esperado em `abrirDetalhe`, um clique isolado
    // logo após a navegação pode ainda chegar antes do React terminar de anexar o `onClick`,
    // sob os dois workers do Playwright disputando CPU — o Playwright vê o botão visível e
    // estável (checagem de DOM/CSS) e clica, mas nada acontece (sem handler nenhum ainda). Sem
    // reação nenhuma da tela nos primeiros 4s, clica de novo em vez de assumir sucesso.
    if (await botaoConcluir.isVisible().catch(() => false)) {
      await botaoConcluir.click();
      await dialogo
        .waitFor({ state: "visible", timeout: 2000 })
        .then(() => dialogo.getByRole("button", { name: "Concluir" }).click())
        .catch(() => {});
    }
    await expect(page.locator("body")).toContainText("Concluída em", { timeout: 10000 });
  }

  return id;
}

// Cancela pelo cabeçalho da página de detalhe real (plano 05). `dialogo.getByRole(...).click()`
// abre o diálogo com auto-espera; se o PRIMEIRO clique em "Cancelar encomenda" chegar antes da
// hidratação anexar o `onClick` (mesmo risco documentado em `concluirViaDetalhe`), o diálogo
// nunca abre — clica de novo antes de desistir.
async function cancelarViaDetalhe(page: Page, nome: string): Promise<string> {
  const id = await abrirDetalhe(page, nome);
  const botaoCancelar = page.getByRole("button", { name: "Cancelar encomenda" });
  const dialogo = page.getByRole("alertdialog");

  await botaoCancelar.click();
  const dialogoAbriu = await dialogo
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!dialogoAbriu) {
    await botaoCancelar.click();
  }

  await dialogo.getByRole("button", { name: "Cancelar encomenda" }).click();
  await expect(page.getByText("Encomenda cancelada.")).toBeVisible();
  await expect(page.locator("body")).toContainText("Cancelada", { timeout: 10000 });
  return id;
}

// No celular, status/ordenação vivem DENTRO do `Sheet` (03-UI-SPEC.md "Filtro, Busca e
// Ordenação — Celular") — o `Select` só existe no DOM depois que o botão `SlidersHorizontal`
// abre a folha. No desktop, os dois `Select` já estão visíveis na barra fixa.
async function abrirControlesSeCelular(page: Page, rotuloDoControle: string) {
  const botaoFiltrar = page.getByRole("button", { name: ROTULO_FILTRAR_E_ORDENAR });
  const comboboxJaVisivel = page
    .getByRole("combobox", { name: rotuloDoControle })
    .and(page.locator(":visible"));
  // Espera até um dos dois aparecer — logo depois de uma navegação, nenhum dos dois pode estar
  // visível ainda por um instante (hidratação em andamento); `.isVisible()` sem espera prévia
  // tirava um retrato cedo demais nesse instante e concluía (errado) que estava no desktop.
  await botaoFiltrar.or(comboboxJaVisivel).waitFor({ state: "visible" });
  if (await botaoFiltrar.isVisible()) {
    await botaoFiltrar.click();
  }
}

async function selecionarOpcao(page: Page, rotuloDoControle: string, rotuloDaOpcao: string) {
  await abrirControlesSeCelular(page, rotuloDoControle);

  await page
    .getByRole("combobox", { name: rotuloDoControle })
    .and(page.locator(":visible"))
    .click();
  await page.getByRole("option", { name: rotuloDaOpcao, exact: true }).click();

  // No celular, escolher a opção fecha o `Select` mas NÃO o `Sheet` por baixo — sem fechá-lo, o
  // overlay continua interceptando cliques em qualquer elemento por trás dele.
  const folha = page.getByTestId("filtro-sheet");
  if (await folha.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(folha).toBeHidden();
  }
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
  test('com o banco vazio, "A roda ainda não gira." aparece e "Nada por aqui com esse filtro." não @vazio-global', async ({
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
    // poderia coincidentemente já ter um intervalo estreito antes de filtrar. Com A3 (timeline
    // abre em hoje), uma encomenda no PASSADO não alarga mais nada — só o futuro ainda estica o
    // intervalo — por isso ela nasce bem à frente, não bem atrás.
    await criarEncomenda(page, { nome: nomeLonginqua, dataInicio: dataEmDias(200) });
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

test.describe("histórico de encomendas", () => {
  // Login com argon2id + concluir/cancelar pela trilha real (duas idas ao servidor cada) — a
  // mesma prudência de mode serial de tests/e2e/encomendas-detalhe.spec.ts. O primeiro teste
  // depende de NENHUMA encomenda concluída/cancelada existir ainda neste describe — precisa ser
  // o PRIMEIRO a criar dado.
  test.describe.configure({ mode: "serial" });

  // Etiquetado `@vazio-historico`: esta asserção depende do total GLOBAL de `concluida`/
  // `cancelada` estar em zero, então roda no projeto `vazio-historico`, que o playwright.config.ts
  // encadeia DEPOIS dos projetos de `@vazio-global` e ANTES de `desktop`/`celular` — nenhum outro
  // teste está executando quando ela roda. Ela cria uma encomenda ativa (não concluída), por isso
  // vem depois dos `@vazio-global`, que exigem o banco completamente vazio.
  test('sem nenhuma encomenda concluída ou cancelada, o filtro "Concluídas" mostra "Nada concluído ou cancelado ainda." @vazio-historico', async ({
    page,
  }) => {
    await fazerLogin(page);
    // Uma encomenda ATIVA só para `ListaEncomendas`/`FiltroEncomendas` existirem na tela — sem
    // nenhuma encomenda no banco, `page.tsx` mostra "A roda ainda não gira." e não há Select de
    // status para escolher "Concluídas".
    await criarEncomenda(page, { nome: nomeUnico("Só para o filtro existir"), dataInicio: dataEmDias(1) });

    await page.goto("/encomendas");
    await selecionarOpcao(page, ROTULO_STATUS, "Concluídas");

    await expect(textoVisivel(page, FRASE_HISTORICO_VAZIO)).toBeVisible();
    await expect(page.getByText(FRASE_FILTRO_VAZIO_TITULO)).toHaveCount(0);
  });

  test('uma encomenda concluída com data de início de 13 meses atrás NÃO aparece no índice, nem com o filtro em "Concluídas" (janela de 12 meses)', async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Fora da janela de 12 meses");
    // 395 dias — mais de 12 meses mesmo contra o mês mais curto (fevereiro), com folga.
    await criarEncomenda(page, { nome, dataInicio: dataEmDias(-395) });
    await concluirViaDetalhe(page, nome);

    await page.goto("/encomendas");
    // A janela filtra ANTES de chegar ao navegador (lib/encomendas/consultas.ts) — esta
    // encomenda simplesmente não está no HTML, em nenhum filtro, nunca "escondida" por CSS
    // (diferente da alternância Gantt/cartão de D-02, aqui ela nem existe no DOM). Checado por
    // presença (nunca por "Nada concluído ou cancelado ainda." globalmente) porque este describe
    // roda os dois projetos em paralelo sobre o MESMO banco — outro teste do projeto irmão pode
    // já ter concluído uma encomenda DENTRO da janela nesse meio-tempo, o que tornaria a
    // contagem total do status "concluida" positiva sem invalidar o que este teste prova.
    await expect(page.getByText(nome, { exact: true })).toHaveCount(0);

    await selecionarOpcao(page, ROTULO_STATUS, "Concluídas");
    await expect(page.getByText(nome, { exact: true })).toHaveCount(0);
  });

  test('trocar o filtro para "Concluídas" mostra a lista de linhas do histórico (sem nenhum Gantt), com nome, badge, cliente, período e itens', async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Linha do histórico completa");
    const cliente = "Ateliê Convidado [e2e]";
    // 60 dias atrás: a cascata padrão (13 dias) já terminou bem antes de hoje — "Marcar como
    // concluída" conclui direto, sem alert-dialog de confirmação antecipada.
    await criarEncomenda(page, {
      nome,
      cliente,
      dataInicio: dataEmDias(-60),
      itemDescricao: "Vaso trançado",
      itensExtras: ["Prato raso"],
    });
    const id = await concluirViaDetalhe(page, nome);

    await page.goto("/encomendas");
    await selecionarOpcao(page, ROTULO_STATUS, "Concluídas");

    await expect(page.getByTestId("lista-historico")).toBeVisible();
    // "Nenhuma barra e nenhum Gantt" (D-07) — o elemento nem existe no DOM, nos dois projetos.
    await expect(page.getByTestId("gantt-desktop")).toHaveCount(0);

    const linha = page.getByTestId(`linha-historico-${id}`);
    await expect(linha).toBeVisible();
    await expect(linha.getByText(nome, { exact: true })).toBeVisible();
    await expect(linha.getByText("Concluída", { exact: true })).toBeVisible();
    await expect(linha.getByText(cliente, { exact: true })).toBeVisible();
    // Dois itens: "primeira descrição · +1" (03-UI-SPEC.md "Histórico — Linhas da Lista").
    await expect(linha.getByText("Vaso trançado · +1", { exact: true })).toBeVisible();

    const caixa = await linha.boundingBox();
    expect(caixa?.height).toBeGreaterThanOrEqual(56);

    await linha.click();
    await expect(page).toHaveURL(new RegExp(`/encomendas/${id}$`));
  });

  test('badge "Cancelada" nunca usa a cor de erro, e o período mostra "cancelada em {data}", nunca uma conclusão que nunca aconteceu', async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Cancelada no histórico");
    await criarEncomenda(page, { nome, dataInicio: dataEmDias(-5) });
    const id = await cancelarViaDetalhe(page, nome);

    await page.goto("/encomendas");
    await selecionarOpcao(page, ROTULO_STATUS, "Canceladas");

    const linha = page.getByTestId(`linha-historico-${id}`);
    await expect(linha).toBeVisible();

    const badge = linha.getByText("Cancelada", { exact: true });
    await expect(badge).toBeVisible();
    const corDeFundo = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    // `--color-erro-fundo` é rgb(254, 226, 226) — a badge de cancelada NUNCA usa essa cor
    // (D-08: cancelar não é erro).
    expect(corDeFundo).not.toBe("rgb(254, 226, 226)");

    await expect(linha.getByText(/cancelada em/)).toBeVisible();
  });

  test('com o filtro em "Todas", as ativas continuam no Gantt/lista e as históricas aparecem ABAIXO, sempre como lista — o Gantt nunca desenha uma encomenda concluída ou cancelada', async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeAtiva = nomeUnico("Ativa ao lado do histórico");
    const nomeConcluida = nomeUnico("Concluída abaixo das ativas");

    await criarEncomenda(page, { nome: nomeAtiva, dataInicio: dataEmDias(3) });
    await criarEncomenda(page, { nome: nomeConcluida, dataInicio: dataEmDias(-60) });
    const idConcluida = await concluirViaDetalhe(page, nomeConcluida);

    // Status padrão ao (re)carregar é "Todas" (D-12/FILTRO_PADRAO).
    await page.goto("/encomendas");

    await expect(textoVisivel(page, nomeAtiva)).toBeVisible();
    await expect(page.getByTestId("gantt-desktop")).toHaveCount(1);
    // D-06, provado de novo aqui especificamente sob o filtro "Todas": a concluída nunca vira
    // uma linha do Gantt, mesmo aparecendo na tela como histórico abaixo.
    await expect(page.getByTestId(`gantt-linha-${idConcluida}`)).toHaveCount(0);

    const secaoHistorico = page.getByTestId("historico-abaixo-das-ativas");
    await expect(secaoHistorico).toBeVisible();
    await expect(secaoHistorico.getByTestId(`linha-historico-${idConcluida}`)).toBeVisible();
  });
});

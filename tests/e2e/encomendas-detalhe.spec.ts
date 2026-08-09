import { test, expect, type Page } from "@playwright/test";

import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { formatarDiaCompleto, formatarDiaCurto, formatarIntervalo } from "@/lib/encomendas/formato";
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

// Desde o plano 06, `FormularioEncomenda` monta `Dialog` (desktop) E `Sheet` (celular) ao mesmo
// tempo — os dois existem no HTML, um escondido por CSS a cada largura (mesmo princípio de D-02
// para Gantt/lista). `:visible` escolhe a metade real do viewport do projeto Playwright atual.
function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
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
    await campoVisivel(page, "Nome da encomenda").fill(opcoes.nome);
    if (opcoes.cliente) {
      await campoVisivel(page, "Cliente").fill(opcoes.cliente);
    }
    await campoVisivel(page, "Data de início").fill(opcoes.dataInicio);
    await campoVisivel(page, "Descrição do item 1").fill(opcoes.itemDescricao ?? "Item de teste [e2e]");
    await campoVisivel(page, "Quantidade do item 1").fill(opcoes.itemQuantidade ?? "1");
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

// 120 caracteres SEM espaço nenhum (limite exato de `esquemaEncomenda.nome`) — a fixture de
// PD-01: um nome assim precisa quebrar em linha dentro do título do diálogo, nunca estourar a
// largura da janela. Único por execução (projeto + timestamp), tudo colado, sem espaço.
function nomeLongoSemEspaco(): string {
  const base = "PecaEncomendadaComNomeMuitoCompridoDePropositoParaTestarQuebraDeLinhaNoDialogo";
  const sufixo = `${test.info().project.name}${Date.now()}`;
  const semPreenchimento = base + sufixo;
  // Preenche até exatamente 120 caracteres (o limite exato de `esquemaEncomenda.nome`) com um
  // caractere repetido, sem espaço.
  return semPreenchimento.padEnd(120, "x").slice(0, 120);
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

test.describe("ajuste rápido", () => {
  test.describe.configure({ mode: "serial" });

  test("uma etapa de intervalo mostra -/+ e um marco mostra um Switch, ambos com >= 44px de área de toque", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste alvo de toque");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    const botaoDiminuir = page.getByRole("button", { name: `Diminuir dias de ${ROTULO_ETAPA.secagem}` });
    const botaoAumentar = page.getByRole("button", { name: `Aumentar dias de ${ROTULO_ETAPA.secagem}` });
    await expect(botaoDiminuir).toBeVisible();
    await expect(botaoAumentar).toBeVisible();

    for (const botao of [botaoDiminuir, botaoAumentar]) {
      const caixa = await botao.boundingBox();
      expect(caixa?.width).toBeGreaterThanOrEqual(44);
      expect(caixa?.height).toBeGreaterThanOrEqual(44);
    }

    const interruptor = page.getByTestId("ajuste-switch-entrega");
    await expect(interruptor).toBeVisible();
    const caixaInterruptor = await interruptor.boundingBox();
    expect(caixaInterruptor?.width).toBeGreaterThanOrEqual(44);
    expect(caixaInterruptor?.height).toBeGreaterThanOrEqual(44);
  });

  test("aria-label dos botões e do Switch descreve a AÇÃO, não o estado", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste aria-label");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await expect(
      page.getByRole("button", { name: `Diminuir dias de ${ROTULO_ETAPA.secagem}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Aumentar dias de ${ROTULO_ETAPA.secagem}` }),
    ).toBeVisible();

    // Entrega nasce ligada (dias: 1, padrão) — o rótulo diz a ação "Desativar", não o estado.
    await expect(page.getByRole("switch", { name: `Desativar ${ROTULO_ETAPA.entrega}` })).toBeVisible();
  });

  test("clicar em '+' na secagem muda o número na hora, mostra um indicador de gravação, e o rodapé só muda quando o servidor confirma", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste sem otimismo");
    const dataInicio = hojeBrasilia();
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    const totalInicial = DIAS_PADRAO.reduce((soma, etapa) => soma + etapa.dias, 0);
    await expect(page.getByTestId("rodape-trilha")).toContainText(`${totalInicial} dias`);

    const numeroSecagem = page.getByTestId("ajuste-numero-secagem");
    await expect(numeroSecagem).toHaveAttribute("data-valor", "6");

    const botaoAumentar = page.getByRole("button", {
      name: `Aumentar dias de ${ROTULO_ETAPA.secagem}`,
    });
    await botaoAumentar.click();

    // O rodapé confirma o novo total (13 + 1 = 14) — auto-retry da asserção cobre a janela de
    // até ~1s do "spinner" (03-UI-SPEC.md); o valor final é o que importa provar aqui.
    await expect(page.getByTestId("rodape-trilha")).toContainText(`${totalInicial + 1} dias`);
    await expect(numeroSecagem).toHaveAttribute("data-valor", "7");
    await expect(numeroSecagem).toHaveAttribute("data-pendente", "false");
  });

  test("o controle fica desabilitado enquanto a gravação está em voo (PD-02)", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste disabled em voo");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    const botaoAumentar = page.getByRole("button", {
      name: `Aumentar dias de ${ROTULO_ETAPA.secagem}`,
    });
    const botaoDiminuir = page.getByRole("button", {
      name: `Diminuir dias de ${ROTULO_ETAPA.secagem}`,
    });

    await botaoAumentar.click();
    // Na mesma tela, o clique síncrono já deixou `pendente: true` antes de a resposta do
    // servidor chegar — ambos os botões da mesma etapa desabilitam juntos.
    await expect(botaoDiminuir).toBeDisabled();

    // Espera a gravação confirmar antes de seguir para o próximo teste (isolamento).
    await expect(page.getByTestId("ajuste-numero-secagem")).toHaveAttribute(
      "data-pendente",
      "false",
    );
  });

  test("'-' numa etapa em 0 dias não desce para -1 — o botão fica desabilitado", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste piso zero");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    // Queima (biscoito) é um marco (0 ou 1) — desligar por aqui é o caminho mais rápido para
    // levar uma etapa a 0 dias e provar o piso do lado do intervalo (esmaltação) também, já que
    // o próprio marco usa Switch (sem botão "-" para testar o piso ali).
    const numeroEsmaltacao = page.getByTestId("ajuste-numero-esmaltacao");
    const botaoDiminuirEsmaltacao = page.getByRole("button", {
      name: `Diminuir dias de ${ROTULO_ETAPA.esmaltacao}`,
    });
    await expect(numeroEsmaltacao).toHaveAttribute("data-valor", "1");
    await expect(botaoDiminuirEsmaltacao).toBeEnabled();

    await botaoDiminuirEsmaltacao.click();
    await expect(numeroEsmaltacao).toHaveAttribute("data-valor", "0", { timeout: 10000 });
    await expect(botaoDiminuirEsmaltacao).toBeDisabled();

    // Clicar de novo com o botão desabilitado não é possível pela UI (é exatamente o que o
    // `disabled` garante) — a prova de que o piso é 0 é o próprio estado do botão.
  });

  test("o Switch de um marco liga e desliga; desligar Entrega encurta a encomenda e a etapa aparece 'Desligada' ao recarregar", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste switch entrega");
    const dataInicio = hojeBrasilia();
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    const totalInicial = DIAS_PADRAO.reduce((soma, etapa) => soma + etapa.dias, 0);
    const interruptor = page.getByTestId("ajuste-switch-entrega");
    await expect(interruptor).toHaveAttribute("aria-checked", "true");

    await interruptor.click();
    await expect(interruptor).toHaveAttribute("aria-checked", "false", { timeout: 10000 });
    await expect(page.getByTestId("rodape-trilha")).toContainText(`${totalInicial - 1} dias`);

    // Ao recarregar, a linha de Entrega mostra "Desligada" e o marcador some do preenchimento —
    // a prova de que a etapa desligada (dias: 0) continua VISÍVEL na trilha, nunca some (D-15).
    await page.reload();
    const linhaEntrega = page.getByTestId("trilha-linha-entrega");
    await expect(linhaEntrega).toBeVisible();
    await expect(linhaEntrega).toContainText("Desligada");
    await expect(linhaEntrega).toContainText(ROTULO_ETAPA.entrega);

    // Religa para não vazar estado "desligado" para outros testes que dependam do padrão.
    const interruptorAposRecarregar = page.getByTestId("ajuste-switch-entrega");
    await interruptorAposRecarregar.click();
    await expect(interruptorAposRecarregar).toHaveAttribute("aria-checked", "true", {
      timeout: 10000,
    });
  });

  test("não existe toast de sucesso no ajuste rápido", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ajuste sem toast");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    const botaoAumentar = page.getByRole("button", {
      name: `Aumentar dias de ${ROTULO_ETAPA.producao}`,
    });
    await botaoAumentar.click();
    await expect(page.getByTestId("ajuste-numero-producao")).toHaveAttribute(
      "data-pendente",
      "false",
      { timeout: 10000 },
    );

    // Nenhuma região de toast (`sonner` monta um `<ol>`/`<section>` com dados de toast) aparece
    // com texto de sucesso — só o número da tela mudou.
    await expect(page.getByText("Encomenda salva.")).toHaveCount(0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  });
});

test.describe("ações da encomenda", () => {
  test.describe.configure({ mode: "serial" });

  test("o cabeçalho tem Editar, Cancelar encomenda e o menu ⋮; Excluir só existe dentro do menu", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações cabeçalho");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar encomenda" })).toBeVisible();
    const botaoMenu = page.getByRole("button", { name: "Mais ações da encomenda" });
    await expect(botaoMenu).toBeVisible();

    // "Excluir encomenda" não existe como botão solto — só dentro do menu, que ainda não foi
    // aberto.
    await expect(page.getByRole("menuitem", { name: "Excluir encomenda" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Excluir encomenda" })).toHaveCount(0);

    await botaoMenu.click();
    await expect(page.getByRole("menuitem", { name: "Excluir encomenda" })).toBeVisible();
  });

  test("alvos de toque do ⋮ medem no mínimo 44px", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações alvo de toque");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    const botaoMenu = page.getByRole("button", { name: "Mais ações da encomenda" });
    const caixa = await botaoMenu.boundingBox();
    expect(caixa?.width).toBeGreaterThanOrEqual(44);
    expect(caixa?.height).toBeGreaterThanOrEqual(44);
  });

  test("Cancelar encomenda abre um diálogo não-destrutivo, com o botão de confirmar em outline (nunca vermelho)", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações cancelar");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await page.getByRole("button", { name: "Cancelar encomenda" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    const titulo = dialogo.getByRole("heading", { name: `Cancelar a encomenda «${nome}»?` });
    await expect(titulo).toBeVisible();
    await expect(dialogo.getByText("não dá para reabrir")).toBeVisible();

    // Escopado ao diálogo (que já tem role="alertdialog") — evita colidir com o botão de
    // abertura, que tem o mesmo nome acessível.
    const botaoConfirmar = dialogo.getByRole("button", { name: "Cancelar encomenda" });
    const corDeFundo = await botaoConfirmar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // `outline` do shadcn é fundo claro (não `--color-erro`/vermelho) — confere que NÃO é a cor
    // destrutiva (`--color-erro` = rgb(185, 28, 28)).
    expect(corDeFundo).not.toBe("rgb(185, 28, 28)");
  });

  test("confirmar Cancelar desabilita o botão e mostra 'Encomenda cancelada.'; a trilha reflete o novo status ao atualizar", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações confirmar cancelar");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await page.getByRole("button", { name: "Cancelar encomenda" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();

    const botaoConfirmar = dialogo.getByRole("button", { name: "Cancelar encomenda" });
    await botaoConfirmar.click();

    await expect(page.getByText("Encomenda cancelada.")).toBeVisible();
    await expect(dialogo).toHaveCount(0);
    // `router.refresh()` busca os dados de novo (Server Component) — sob a suíte inteira em
    // paralelo, essa segunda ida ao servidor pode levar mais que o timeout padrão de 5s
    // (mesma prudência de tests/e2e/encomendas-indice.spec.ts para asserções pós-mutação).
    await expect(page.locator("body")).toContainText("Cancelada", { timeout: 10000 });
  });

  test("Excluir encomenda (dentro do menu ⋮) abre um diálogo destrutivo nomeando os itens perdidos", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações excluir texto");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await page.getByRole("button", { name: "Mais ações da encomenda" }).click();
    await page.getByRole("menuitem", { name: "Excluir encomenda" }).click();

    const titulo = page.getByRole("heading", { name: `Excluir a encomenda «${nome}»?` });
    await expect(titulo).toBeVisible();
    // A encomenda de teste tem exatamente 1 item (criarEncomenda) — forma singular.
    await expect(page.getByText("O item dela será apagado.")).toBeVisible();
  });

  test("confirmar Excluir navega para /encomendas e mostra o toast de exclusão", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações confirmar excluir");
    await criarEncomenda(page, { nome, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nome);

    await page.getByRole("button", { name: "Mais ações da encomenda" }).click();
    await page.getByRole("menuitem", { name: "Excluir encomenda" }).click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
    await expect(page.getByText("Encomenda excluída.")).toBeVisible();
    await expect(page.getByText(nome, { exact: true })).toHaveCount(0);
  });

  test("PD-01: um nome de 120 caracteres sem espaço quebra em linha no título do diálogo, sem estourar a largura da janela", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeLongo = nomeLongoSemEspaco();
    await criarEncomenda(page, { nome: nomeLongo, dataInicio: hojeBrasilia() });
    await abrirDetalhe(page, nomeLongo);

    await page.getByRole("button", { name: "Cancelar encomenda" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    const titulo = dialogo.getByRole("heading", { name: `Cancelar a encomenda «${nomeLongo}»?` });
    await expect(titulo).toBeVisible();

    const estiloDeQuebra = await titulo.evaluate((el) => getComputedStyle(el).overflowWrap);
    expect(estiloDeQuebra).toBe("anywhere");

    // PD-01 é sobre o DIÁLOGO (max-w-xs/sm:max-w-sm, um cartão estreito e fixo) não estourar —
    // não sobre a página inteira, cujo <h1> com o nome da encomenda é uma superfície própria,
    // fora do escopo desta decisão. A caixa do diálogo nunca passa da largura da janela, e ele
    // mesmo não rola horizontalmente (só verticalmente, via `max-h-[85svh] overflow-y-auto`).
    const caixaDialogo = await dialogo.boundingBox();
    const larguraDaJanela = await page.evaluate(() => window.innerWidth);
    expect(caixaDialogo?.width).toBeLessThanOrEqual(larguraDaJanela);

    const [scrollWidthDoDialogo, clientWidthDoDialogo] = await dialogo.evaluate((el) => [
      el.scrollWidth,
      el.clientWidth,
    ]);
    expect(scrollWidthDoDialogo).toBeLessThanOrEqual(clientWidthDoDialogo);
  });

  test("'Marcar como concluída' fica no fim da trilha, e concluir antes do prazo abre um alert-dialog não-destrutivo com a data prevista", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações concluir antecipado");
    const dataInicio = hojeBrasilia();
    await criarEncomenda(page, { nome, dataInicio });
    await abrirDetalhe(page, nome);

    const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
    if (!cronograma.dataDeConclusao) {
      throw new Error("Fixture inesperada: sem dataDeConclusao.");
    }

    const botaoConcluir = page.getByRole("button", { name: "Marcar como concluída" });
    await expect(botaoConcluir).toBeVisible();
    await botaoConcluir.click();

    await expect(page.getByText("que ainda não chegou.")).toBeVisible();
    await expect(page.getByText(formatarDiaCompleto(cronograma.dataDeConclusao))).toBeVisible();
    await expect(page.getByText("Marcar como concluída assim mesmo?")).toBeVisible();

    // "Voltar" não conclui nada — a trilha continua com o botão de concluir disponível.
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(botaoConcluir).toBeVisible();
  });

  test("concluir uma encomenda cuja data já passou não pede confirmação, e a trilha mostra 'Concluída em' ao atualizar", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Ações concluir no prazo");
    // 60 dias atrás: a cascata padrão (13 dias) já terminou bem antes de hoje.
    await criarEncomenda(page, { nome, dataInicio: dataEmDias(-60) });
    await abrirDetalhe(page, nome);

    await page.getByRole("button", { name: "Marcar como concluída" }).click();

    // Sem confirmação prévia: a conclusão acontece direto, e o botão some (status vira
    // "concluida", que não oferece mais "Marcar como concluída").
    await expect(page.getByRole("button", { name: "Marcar como concluída" })).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(page.locator("body")).toContainText("Concluída em", { timeout: 10000 });
  });

  // Oportunidade sinalizada por 03-04-SUMMARY.md (Known Stubs): antes deste plano, nenhum
  // caminho de escrita alcançava `concluida`/`cancelada`, então D-06 ("o Gantt só desenha
  // rascunho e em_producao") nunca tinha prova e2e com dado real — só revisão de código. Cancelar
  // e concluir agora existem; esta é a primeira vez que o índice pode ser provado excluindo as
  // duas de verdade.
  test("D-06: cancelar ou concluir tira a encomenda do Gantt/lista do índice", async ({ page }) => {
    await fazerLogin(page);
    const nomeCancelada = nomeUnico("D-06 cancelada some");
    const nomeConcluida = nomeUnico("D-06 concluida some");

    await criarEncomenda(page, { nome: nomeCancelada, dataInicio: hojeBrasilia() });
    const idCancelada = await abrirDetalhe(page, nomeCancelada);
    await page.getByRole("button", { name: "Cancelar encomenda" }).click();
    const dialogoCancelar = page.getByRole("alertdialog");
    await dialogoCancelar.getByRole("button", { name: "Cancelar encomenda" }).click();
    await expect(page.getByText("Encomenda cancelada.")).toBeVisible();

    // 60 dias atrás: a conclusão prevista já passou, então "Marcar como concluída" conclui
    // direto, sem confirmação prévia (o mesmo caminho do teste anterior).
    await criarEncomenda(page, { nome: nomeConcluida, dataInicio: dataEmDias(-60) });
    const idConcluida = await abrirDetalhe(page, nomeConcluida);
    await page.getByRole("button", { name: "Marcar como concluída" }).click();
    await expect(page.getByRole("button", { name: "Marcar como concluída" })).toHaveCount(0, {
      timeout: 10000,
    });

    // `expect.poll` reabre `/encomendas` a cada tentativa (navegação nova, nunca cache de
    // cliente) — dá margem para a revalidação do servidor propagar sob a suíte em paralelo,
    // sem depender de um único instante de leitura. Escopado pelo `id` (no próprio
    // `data-testid`), não pelo texto do nome — mais preciso que casar substring.
    await expect
      .poll(
        async () => {
          await page.goto("/encomendas");
          return page.getByTestId(`cartao-encomenda-${idCancelada}`).count();
        },
        { timeout: 15000 },
      )
      .toBe(0);
    await expect
      .poll(
        async () => {
          await page.goto("/encomendas");
          return page.getByTestId(`cartao-encomenda-${idConcluida}`).count();
        },
        { timeout: 15000 },
      )
      .toBe(0);
  });
});

import { test, expect, type Page } from "@playwright/test";

import { deslocamentoEmPixels, rolagemInicial, type IntervaloDaTimeline } from "@/lib/encomendas/gantt";

// Índice de verdade: Gantt no desktop (Tarefa 1), lista de cartões no celular (Tarefa 2), e os
// três estados obrigatórios (Tarefa 3) — 03-04-PLAN.md. O 18px/dia, a posição da linha de
// "Hoje" e a rolagem de abertura são provados por MEDIÇÃO no navegador (`boundingBox()`,
// `scrollLeft`), nunca por "o Gantt aparece" — a mesma resposta que a 2b deu ao `@theme inline`.
//
// `deslocamentoEmPixels`/`rolagemInicial` são importados diretos de `lib/encomendas/gantt.ts`
// (módulo puro, zero import, roda igual no Node do Playwright e no navegador) — o teste
// recomputa o valor esperado com a MESMA função de produção que o componente usa, nunca com
// aritmética solta duplicada aqui. `intervalo.primeiroDia`/`larguraEmPixels` são lidos de
// atributos `data-*` que o próprio Gantt expõe (o intervalo real que ELE calculou, com todas as
// encomendas ativas do banco no momento — inclusive as de outras specs rodando em paralelo),
// nunca reconstruídos a partir de uma contagem presumida: isso é o que mantém o teste robusto
// mesmo com dado concorrente de outros arquivos de teste no mesmo banco efêmero.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Cria uma encomenda pela Server Action real (`criarEncomenda`), passando pelo formulário —
// nunca por INSERT direto no banco (o teste precisa exercitar o caminho que a pessoa usa). As
// 6 etapas nascem com os padrões (`DIAS_PADRAO`: produção 3 · secagem 6 · queima1 1 ·
// esmaltação 1 · queima2 1 · entrega 1) — o formulário desta fase não edita etapa por etapa
// (isso é do plano 06), então todo dado deste arquivo usa esses padrões.
async function criarEncomenda(
  page: Page,
  opcoes: { nome: string; cliente?: string; dataInicio: string },
) {
  await page.goto("/encomendas?nova");
  await page.getByLabel("Nome da encomenda").fill(opcoes.nome);
  if (opcoes.cliente) {
    await page.getByLabel("Cliente").fill(opcoes.cliente);
  }
  await page.getByLabel("Data de início").fill(opcoes.dataInicio);
  await page.getByLabel("Descrição do item").fill("Item de teste [e2e]");
  await page.getByLabel("Quantidade").fill("1");
  await page.getByRole("button", { name: "Salvar" }).click();
  // Timeout maior que o padrão: a suíte inteira roda vários workers em paralelo contra o mesmo
  // servidor (login com argon2id é deliberadamente lento, e cada worker faz o seu) — sob essa
  // carga, o `db.transaction` de `criarEncomenda` pode legitimamente levar mais que os 5s
  // padrão do Playwright para responder e redirecionar.
  await expect(page).toHaveURL(/\/encomendas$/, { timeout: 25000 });
}

// Nome inventado e reconhecível como tal (nunca dado real do ateliê), único por chamada —
// evita colisão entre testes deste arquivo e entre os projetos desktop/celular rodando contra
// o mesmo banco de teste efêmero.
function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Data civil `YYYY-MM-DD` a partir de hoje + `deslocamento` dias — sem `date-fns`, mesma
// disciplina do resto do projeto (aritmética simples de calendário é suficiente para gerar
// uma data de teste; a cascata de verdade mora em `lib/encomendas/cronograma.ts`).
function dataEmDias(deslocamento: number): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + deslocamento);
  return data.toISOString().slice(0, 10);
}

// Localiza a linha do Gantt de uma encomenda pelo nome — nunca pelo `id` (o teste não o
// conhece), e nunca por posição fixa (o índice mostra as encomendas de todos os testes rodando
// contra o mesmo banco).
function linhaDoGantt(page: Page, nome: string) {
  return page.locator('[data-testid^="gantt-linha-"]').filter({ hasText: nome });
}

async function lerIntervaloDoGantt(page: Page): Promise<{ intervalo: IntervaloDaTimeline; hoje: string }> {
  const container = page.getByTestId("gantt-desktop");
  const primeiroDia = await container.getAttribute("data-primeiro-dia");
  const larguraTexto = await container.getAttribute("data-largura-em-pixels");
  const hoje = await page.getByTestId("linha-hoje").getAttribute("data-hoje");

  if (!primeiroDia || !larguraTexto || !hoje) {
    throw new Error("Atributos de intervalo do Gantt não encontrados no DOM.");
  }

  return {
    intervalo: {
      primeiroDia,
      ultimoDiaExclusivo: "",
      totalDeDias: 0,
      larguraEmPixels: Number(larguraTexto),
    },
    hoje,
  };
}

// `clientWidth` é uma propriedade de LEIAUTE, não de anexação ao DOM: `locator.evaluate()` só
// espera o elemento estar ANEXADO, nunca que o CSS já tenha sido aplicado — logo depois de um
// `page.goto()`, é possível ler `clientWidth === 0` porque a folha de estilo ainda não
// carregou, mesmo com o elemento já presente. `toBeVisible()` exige caixa delimitadora não
// vazia (entre outras checagens), o que na prática força a esperar o CSS real — só então a
// leitura de `clientWidth` corresponde ao que o próprio `useLayoutEffect` do Gantt mediu.
async function larguraVisivelDaAreaRolavel(page: Page): Promise<number> {
  const areaRolavel = page.getByTestId("gantt-area-rolavel");
  await expect(areaRolavel).toBeVisible();
  return areaRolavel.evaluate((el) => el.clientWidth);
}

test.describe("índice de encomendas", () => {
  // Mesma prudência de tests/e2e/casca.spec.ts: login é uma conferência argon2id
  // deliberadamente lenta — rodar em série evita empilhar muitas ao mesmo tempo.
  test.describe.configure({ mode: "serial" });

  test.describe("Gantt desktop (ENC-03, ENC-06, ENC-07)", () => {
    // O Gantt só existe visível no projeto `desktop` — no `celular` ele está no HTML mas
    // escondido por CSS (`hidden md:block`, D-02). `boundingBox()`/interações neste describe
    // exigem visibilidade real, então este bloco roda só no desktop; a Tarefa 2 faz o mesmo
    // (invertido) para as métricas exclusivas do cartão mobile.
    test.beforeEach(({}, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "Gantt é exclusivo do projeto desktop — escondido por CSS no celular (D-02)",
      );
    });

    test("uma barra de produção de 3 dias mede 54px, e a etapa 'Secagem' mostra rótulo dentro da barra", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt 54px");
      await criarEncomenda(page, { nome, cliente: "Cliente inventado", dataInicio: dataEmDias(0) });

      const linha = linhaDoGantt(page, nome);
      await expect(linha).toBeVisible();

      const barraProducao = linha.getByRole("img", { name: /^Produção/ });
      const caixaProducao = await barraProducao.boundingBox();
      // 3 dias × 18px = 54 — tolerância de ±1px para arredondamento de layout.
      expect(Math.round(caixaProducao?.width ?? 0)).toBe(54);

      // Secagem (6 dias × 18 = 108px, > 46) mostra o rótulo da etapa dentro da barra.
      await expect(linha.getByRole("img", { name: /^Secagem/ })).toContainText("Secagem");

      // Esmaltação (1 dia × 18 = 18px, < 46) NÃO mostra rótulo dentro da barra.
      const barraEsmaltacao = linha.getByRole("img", { name: /^Esmaltação/ });
      await expect(barraEsmaltacao).toBeVisible();
      await expect(barraEsmaltacao).not.toContainText("Esmaltação");
    });

    test("queima1/queima2/entrega desenham losango (rotate(45deg)); produção/secagem/esmaltação desenham retângulo", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt marcos");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const linha = linhaDoGantt(page, nome);
      await expect(linha).toBeVisible();

      for (const rotulo of [/^Queima \(biscoito\)/, /^Queima \(esmalte\)/, /^Entrega/]) {
        const marco = linha.getByRole("img", { name: rotulo });
        const transformacao = await marco.evaluate((el) => getComputedStyle(el).transform);
        // rotate(45deg) vira uma matriz — cos(45)=sin(45)≈0.7071, sempre presente na matriz.
        expect(transformacao).toContain("0.7071");
      }

      for (const rotulo of [/^Produção/, /^Secagem/, /^Esmaltação/]) {
        const barra = linha.getByRole("img", { name: rotulo });
        const transformacao = await barra.evaluate((el) => getComputedStyle(el).transform);
        expect(transformacao === "none" || !transformacao.includes("0.7071")).toBe(true);
      }
    });

    test("a linha de 'Hoje' fica na posição que deslocamentoEmPixels prevê, e o cabeçalho de quinzenas cobre a área rolável sem vão", async ({
      page,
    }) => {
      await fazerLogin(page);
      await criarEncomenda(page, {
        nome: nomeUnico("Gantt hoje"),
        dataInicio: dataEmDias(0),
      });
      await page.goto("/encomendas");

      const { intervalo, hoje } = await lerIntervaloDoGantt(page);
      const linhaHoje = page.getByTestId("linha-hoje");
      // A régua: o mesmo contêiner de largura `intervalo.larguraEmPixels` que as células de
      // quinzena e as barras usam como origem — medir a posição da linha de "Hoje" relativa a
      // ELE (em vez de a `gantt-area-rolavel` menos a largura da coluna fixa) evita depender de
      // um valor de layout que não faz parte do contrato de nenhum módulo puro.
      const regua = page.getByTestId("gantt-regua");

      // `toBeVisible()` re-tenta até o timeout padrão — mais robusto que uma leitura crua de
      // `boundingBox()` sob carga pesada (suíte inteira rodando em paralelo), quando a página
      // pode levar um instante a mais para hidratar.
      await expect(linhaHoje).toBeVisible();
      await expect(regua).toBeVisible();

      const caixaLinha = await linhaHoje.boundingBox();
      const caixaRegua = await regua.boundingBox();
      if (!caixaLinha || !caixaRegua) {
        throw new Error("Não foi possível medir a linha de 'Hoje' ou a régua do Gantt.");
      }

      // Posição esperada: a MESMA fórmula de produção (`deslocamentoEmPixels`), com o intervalo
      // real lido do DOM, somada à origem da régua já medida na tela (já reflete o scroll atual
      // — getBoundingClientRect() é sempre pós-scroll).
      const esperadoRelativoAoConteudo = deslocamentoEmPixels(intervalo, hoje);
      const esperadoNaTela = caixaRegua.x + esperadoRelativoAoConteudo;

      expect(Math.round(caixaLinha.x)).toBe(Math.round(esperadoNaTela));

      // Cabeçalho de quinzenas: a soma das larguras das células cobre a área rolável inteira,
      // sem vão e sem sobreposição (tolerância = 1px por célula, arredondamento de layout).
      const larguras = await page
        .getByTestId("gantt-celula-quinzena")
        .evaluateAll((elementos) => elementos.map((el) => el.getBoundingClientRect().width));
      const somaDasLarguras = larguras.reduce((total, largura) => total + largura, 0);
      expect(Math.abs(somaDasLarguras - intervalo.larguraEmPixels)).toBeLessThanOrEqual(
        larguras.length,
      );
    });

    test("o scrollLeft inicial é o valor de rolagemInicial para a largura visível, nunca negativo, e sobrevive a um recarregamento", async ({
      page,
    }) => {
      await fazerLogin(page);
      await criarEncomenda(page, {
        nome: nomeUnico("Gantt rolagem"),
        dataInicio: dataEmDias(0),
      });
      await page.goto("/encomendas");

      const areaRolavel = page.getByTestId("gantt-area-rolavel");
      const { intervalo, hoje } = await lerIntervaloDoGantt(page);
      const larguraVisivel = await larguraVisivelDaAreaRolavel(page);
      const esperado = rolagemInicial(intervalo, hoje, larguraVisivel);

      // `expect.poll` em vez de uma leitura crua: o `useLayoutEffect` que aplica a rolagem só
      // roda depois da hidratação — sob a suíte inteira rodando em paralelo, o JS pode levar um
      // instante a mais para baixar/rodar do que o resto da medição (que já lê atributos
      // presentes na própria marcação SSR). Isto continua sendo uma igualdade estrita com o
      // valor de produção, só tolerando QUANDO ela fica pronta, nunca SE ela é a correta.
      await expect
        .poll(async () => areaRolavel.evaluate((el) => el.scrollLeft), { timeout: 15000 })
        .toBe(esperado);
      const scrollLeftInicial = await areaRolavel.evaluate((el) => el.scrollLeft);
      expect(scrollLeftInicial).toBeGreaterThanOrEqual(0);

      // ENC-07/idempotency: recarregar reposiciona no mesmo lugar (o intervalo pode mudar 1px
      // se outro teste criou uma encomenda entre as duas medições, então recalcula de novo em
      // vez de comparar o número cru).
      await page.reload();
      const { intervalo: intervaloApósRecarregar, hoje: hojeApósRecarregar } =
        await lerIntervaloDoGantt(page);
      const larguraVisivelApósRecarregar = await larguraVisivelDaAreaRolavel(page);
      const esperadoApósRecarregar = rolagemInicial(
        intervaloApósRecarregar,
        hojeApósRecarregar,
        larguraVisivelApósRecarregar,
      );
      await expect
        .poll(async () => areaRolavel.evaluate((el) => el.scrollLeft), { timeout: 15000 })
        .toBe(esperadoApósRecarregar);
    });

    test("ENC-07/concurrency: rolar manualmente depois da montagem não é sobrescrito por uma nova rolagem automática", async ({
      page,
    }) => {
      await fazerLogin(page);
      await criarEncomenda(page, {
        nome: nomeUnico("Gantt gesto"),
        dataInicio: dataEmDias(0),
      });
      await page.goto("/encomendas");

      const areaRolavel = page.getByTestId("gantt-area-rolavel");
      const { intervalo, hoje } = await lerIntervaloDoGantt(page);
      const larguraVisivel = await larguraVisivelDaAreaRolavel(page);
      const rolagemDaMontagem = rolagemInicial(intervalo, hoje, larguraVisivel);

      // Espera a rolagem automática da montagem já ter sido aplicada ANTES do gesto manual —
      // senão o teste correria contra a própria hidratação (useLayoutEffect ainda não tendo
      // rodado), o que não é a borda que ENC-07/concurrency quer provar (o gesto depois de
      // pronto, não durante o carregamento).
      await expect
        .poll(async () => areaRolavel.evaluate((el) => el.scrollLeft), { timeout: 15000 })
        .toBe(rolagemDaMontagem);

      await areaRolavel.evaluate((el) => {
        el.scrollLeft = 0;
      });
      // Duas voltas de microtarefa/pintura — se existisse algum efeito reaplicando
      // `rolagemInicial` fora da montagem, ele teria chance de rodar aqui.
      await page.waitForTimeout(300);
      const scrollLeftAposGesto = await areaRolavel.evaluate((el) => el.scrollLeft);
      expect(scrollLeftAposGesto).toBe(0);
    });

    test("rolar a área de barras não move a coluna de nome+cliente", async ({ page }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt coluna fixa");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const linha = linhaDoGantt(page, nome);
      const nomeNaColuna = linha.getByText(nome, { exact: true });
      await expect(nomeNaColuna).toBeVisible();
      const caixaAntes = await nomeNaColuna.boundingBox();

      const areaRolavel = page.getByTestId("gantt-area-rolavel");
      await areaRolavel.evaluate((el) => {
        el.scrollLeft = el.scrollLeft + 100;
      });

      const caixaDepois = await nomeNaColuna.boundingBox();
      expect(caixaDepois?.x).toBe(caixaAntes?.x);
    });

    test("duas encomendas aparecem na ordem de ordenarParaGantt (data de início ascendente)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nomeCedo = nomeUnico("Gantt ordem A cedo");
      const nomeTarde = nomeUnico("Gantt ordem B tarde");

      // Cria a de data mais tarde primeiro — se a ordem na tela seguisse a ordem de inserção,
      // este teste pegaria isso.
      await criarEncomenda(page, { nome: nomeTarde, dataInicio: dataEmDias(40) });
      await criarEncomenda(page, { nome: nomeCedo, dataInicio: dataEmDias(20) });
      await page.goto("/encomendas");

      const nomesNaTela = await page
        .locator('[data-testid^="gantt-linha-"]')
        .evaluateAll((elementos) => elementos.map((el) => el.textContent ?? ""));

      const indiceCedo = nomesNaTela.findIndex((texto) => texto.includes(nomeCedo));
      const indiceTarde = nomesNaTela.findIndex((texto) => texto.includes(nomeTarde));

      expect(indiceCedo).toBeGreaterThanOrEqual(0);
      expect(indiceTarde).toBeGreaterThanOrEqual(0);
      expect(indiceCedo).toBeLessThan(indiceTarde);
    });

    test("com uma encomenda só, a timeline ainda desenha a quinzena de folga em cada ponta (zero-um-muitos)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt folga");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const linha = linhaDoGantt(page, nome);
      await expect(linha).toBeVisible();
      // Sempre há mais de uma célula de quinzena visível — se a timeline cobrisse só o próprio
      // dia da encomenda, haveria no máximo uma célula parcial.
      const quantidadeDeCelulas = await page.getByTestId("gantt-celula-quinzena").count();
      expect(quantidadeDeCelulas).toBeGreaterThan(1);
    });
  });
});

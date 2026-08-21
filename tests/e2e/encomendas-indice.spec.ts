import { test, expect, type Page } from "@playwright/test";

import { calcularCronograma, DIAS_PADRAO } from "@/lib/encomendas/cronograma";
import { formatarDiaCurto } from "@/lib/encomendas/formato";
import { deslocamentoEmPixels, rolagemInicial, type IntervaloDaTimeline } from "@/lib/encomendas/gantt";
import {
  FRASE_VAZIO_TITULO,
  ROTULO_ETAPA,
  ROTULO_NOVA_ENCOMENDA,
  SELO_RASCUNHO,
  textoDaContagemDeItens,
} from "@/lib/encomendas/textos";

import { marcarComoRascunho } from "./apoio/marcar-rascunho";

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

// Desde o plano 06, `FormularioEncomenda` monta `Dialog` (desktop) E `Sheet` (celular) ao mesmo
// tempo — os dois existem no HTML, um escondido por CSS a cada largura (mesmo princípio de D-02
// para Gantt/lista). `:visible` escolhe a metade real do viewport do projeto Playwright atual.
function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
}

// Cria uma encomenda pela Server Action real (`criarEncomenda`), passando pelo formulário —
// nunca por INSERT direto no banco (o teste precisa exercitar o caminho que a pessoa usa). As
// 6 etapas nascem com os padrões (`DIAS_PADRAO`: produção 3 · secagem 6 · queima1 1 ·
// esmaltação 1 · queima2 1 · entrega 1) — o formulário desta fase não edita etapa por etapa
// (isso é do plano 06), então todo dado deste arquivo usa esses padrões.
//
// Tenta até 3 vezes: no ambiente local (webServer único, `npm run build && npm run start`,
// sem retry do Playwright fora do CI), uma submissão isolada ocasionalmente fica presa em
// `?nova` sem redirecionar — sintoma idêntico ao de uma falha de validação Zod silenciosa
// (stub conhecido, 03-01-SUMMARY.md), mas aqui os dados são sempre válidos, então é uma
// instabilidade do ambiente local, não do dado.
//
// Antes de reenviar, confirma que a tentativa anterior REALMENTE não gravou — a transação pode
// muito bem ter sido concluída no servidor mesmo quando o cliente não observou o redirect a
// tempo (a rede/hidratação atrasou só a RESPOSTA, não a escrita). Reenviar sem checar isso
// criaria uma segunda encomenda com o mesmo nome — o oposto do que o teste quer provar.
async function criarEncomenda(
  page: Page,
  opcoes: { nome: string; cliente?: string; dataInicio: string; itensExtras?: string[] },
) {
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

    // Parâmetro opcional (default ausente): itens extras além do item 1, para provar o plural
    // da contagem no índice (G-03-3-índice, quick 260820-uot). Cada extra clica "Adicionar
    // item" e preenche a linha nova pelo rótulo indexado (`lista-itens.tsx`).
    for (const [indice, descricao] of (opcoes.itensExtras ?? []).entries()) {
      const numeroDoItem = indice + 2;
      await botaoVisivel(page, "Adicionar item").click();
      await campoVisivel(page, `Descrição do item ${numeroDoItem}`).fill(descricao);
      await campoVisivel(page, `Quantidade do item ${numeroDoItem}`).fill("1");
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

// Nome inventado e reconhecível como tal (nunca dado real do ateliê), único por chamada —
// evita colisão entre testes deste arquivo e entre os projetos desktop/celular rodando contra
// o mesmo banco de teste efêmero.
function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Data civil `YYYY-MM-DD` a partir de hoje + `deslocamento` dias — calculada em Brasília, com o
// MESMO método de `hojeEmBrasilia` (lib/encomendas/formato.ts), não em UTC puro nem no fuso
// local do processo de teste. Sem isto, entre 21h e 23h59 de Brasília (00h-02h59 UTC) o "hoje"
// em UTC já seria amanhã, e casos como "Começa em 30 dias" contariam um dia a mais/a menos do
// que `situacaoEm` calcula no servidor a partir de `hojeEmBrasilia`.
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

// Localiza a linha do Gantt de uma encomenda pelo nome — nunca pelo `id` (o teste não o
// conhece), e nunca por posição fixa (o índice mostra as encomendas de todos os testes rodando
// contra o mesmo banco).
function linhaDoGantt(page: Page, nome: string) {
  return page.locator('[data-testid^="gantt-linha-"]').filter({ hasText: nome });
}

// Mesmo princípio, para o cartão da lista mobile.
function cartaoDoCelular(page: Page, nome: string) {
  return page.locator('[data-testid^="cartao-encomenda-"]').filter({ hasText: nome });
}

// Descobre o `id` de uma encomenda pelo nome, lendo o `data-testid` do cartão. O cartão está
// SEMPRE no HTML nos dois viewports (escondido por CSS no desktop, D-02) — por isso esta
// leitura funciona igual nos projetos `desktop` e `celular`, o mesmo jeito que
// `encomendas-impressao.spec.ts` já descobre o `id`.
//
// `criarEncomenda` DESTE arquivo devolve `void`, ao contrário do irmão em
// `encomendas-impressao.spec.ts` — não mexa nele: é chamado por perto de vinte testes deste
// arquivo, e este plano tem orçamento de UMA rodada de e2e.
async function idDaEncomenda(page: Page, nome: string): Promise<string> {
  const cartao = page.locator('[data-testid^="cartao-encomenda-"]').filter({ hasText: nome });
  await expect(cartao).toHaveCount(1);
  const testId = await cartao.getAttribute("data-testid");
  if (!testId) {
    throw new Error(`Não encontrou o cartão da encomenda "${nome}" para descobrir o id.`);
  }
  return testId.replace("cartao-encomenda-", "");
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

  test.describe("Estados obrigatórios (ENC-13)", () => {
    // Declarado ANTES dos demais describes de propósito: em modo serial, a ordem de execução
    // segue a ordem de declaração — o teste de "banco vazio" precisa ser o PRIMEIRO a tocar
    // `/encomendas` neste arquivo, antes de qualquer outro teste criar uma encomenda. Rodando
    // com o grep deste arquivo (`--grep "índice de encomendas"`, o comando de verificação desta
    // tarefa), nenhum outro arquivo de spec entra na mesma execução, então o banco de teste
    // efêmero (recriado do zero a cada `npm run test:e2e`) está genuinamente vazio aqui.
    test("com o banco vazio, a frase 'A roda ainda não gira.' aparece uma única vez e o botão leva a /encomendas?nova @vazio-global", async ({
      page,
    }) => {
      await fazerLogin(page);
      await page.goto("/encomendas");

      // ENC-13/empty + ENC-13/adjacency: o título do estado vazio (papel `título`, `<h2>`)
      // aparece exatamente uma vez — nunca uma cópia por metade (Gantt/lista, D-02).
      const frase = page.getByRole("heading", { name: FRASE_VAZIO_TITULO, level: 2 });
      await expect(frase).toHaveCount(1);
      await expect(frase).toBeVisible();

      // O botão do estado vazio está HABILITADO (D-13 do UI-SPEC — a primeira vez que o botão
      // do estado vazio faz alguma coisa) e leva a `/encomendas?nova`. Dois links "Nova
      // encomenda" existem na tela (cabeçalho + estado vazio) — escopado ao `data-testid` do
      // próprio `EstadoVazio` para não depender de `.last()`/`.first()` entre os dois.
      //
      // `toHaveAttribute("href", ...)` em vez de clicar e conferir `toHaveURL`: o destino já é
      // o contrato que importa (é o mesmo href que o cabeçalho usa, e ENC-06/D-03 já provam a
      // navegação de verdade em outros pontos da suíte) — ler o atributo é determinístico,
      // nunca depende do tempo de uma navegação de cliente real completar.
      const botaoDoEstadoVazio = page
        .getByTestId("estado-vazio")
        .getByRole("link", { name: ROTULO_NOVA_ENCOMENDA });
      await expect(botaoDoEstadoVazio).toBeVisible();
      await expect(botaoDoEstadoVazio).not.toHaveAttribute("aria-disabled", "true");
      await expect(botaoDoEstadoVazio).toHaveAttribute("href", "/encomendas?nova");
    });

    test("com uma encomenda no banco, a frase 'A roda ainda não gira.' não está no documento", async ({
      page,
    }) => {
      await fazerLogin(page);
      await criarEncomenda(page, {
        nome: nomeUnico("Estado vazio ausente"),
        dataInicio: dataEmDias(0),
      });

      await expect(page.getByText(FRASE_VAZIO_TITULO)).toHaveCount(0);
    });
  });

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

    test("a linha de 'Hoje' fica na posição que deslocamentoEmPixels prevê, e o cabeçalho de semanas cobre a área rolável sem vão", async ({
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
      // semana e as barras usam como origem — medir a posição da linha de "Hoje" relativa a
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

      // Cabeçalho de semanas: a soma das larguras das células cobre a área rolável inteira,
      // sem vão e sem sobreposição (tolerância = 1px por célula, arredondamento de layout).
      const larguras = await page
        .getByTestId("gantt-celula-semana")
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
      // A3: a timeline agora ABRE EM HOJE — "hoje" fica na borda esquerda do intervalo
      // desenhado, então `rolagemInicial` sempre resolve para 0. Prova observável de que a
      // Tarefa 3 mudou o comportamento, não só o número por trás dele.
      expect(esperado).toBe(0);

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

    test("com uma encomenda só, a timeline ainda desenha uma semana de folga no fim (zero-um-muitos)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt folga");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const linha = linhaDoGantt(page, nome);
      await expect(linha).toBeVisible();
      // Sempre há mais de uma célula de semana visível — se a timeline cobrisse só o próprio dia
      // da encomenda, haveria no máximo uma célula parcial. Não há mais folga no COMEÇO (A3): a
      // timeline abre em hoje.
      const quantidadeDeCelulas = await page.getByTestId("gantt-celula-semana").count();
      expect(quantidadeDeCelulas).toBeGreaterThan(1);
    });

    test("encomenda iniciada antes de hoje: nenhuma barra/marco desenha à esquerda da régua, e a etapa cortada encosta exatamente na origem (A3)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt corte a esquerda");
      // Começa 10 dias antes de hoje — a etapa de produção (3 dias) fica inteiramente no
      // passado, e a de secagem (6 dias) começa antes de hoje e é cortada na borda esquerda.
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(-10) });

      const linha = linhaDoGantt(page, nome);
      await expect(linha).toBeVisible();

      const regua = page.getByTestId("gantt-regua");
      await expect(regua).toBeVisible();
      const caixaRegua = await regua.boundingBox();
      if (!caixaRegua) {
        throw new Error("Não foi possível medir a régua do Gantt.");
      }

      // Escrito em termos de "nada à esquerda da origem da régua" — independe do dia da semana
      // em que o teste roda, ao contrário de uma asserção sobre qual etapa está cortada.
      const elementosDaLinha = linha.locator(
        '[data-testid^="gantt-barra-"], [data-testid^="gantt-marco-"]',
      );
      const caixas = await elementosDaLinha.evaluateAll((elementos) =>
        elementos.map((el) => el.getBoundingClientRect().x),
      );
      expect(caixas.length).toBeGreaterThan(0);
      for (const x of caixas) {
        expect(x).toBeGreaterThanOrEqual(caixaRegua.x - 1);
      }

      // Não afirma QUANTAS etapas ficam cortadas — isso depende do dia da semana em que o teste
      // roda (o corte de uma etapa de 6 dias iniciada 10 dias atrás varia conforme quantos dias
      // a segunda-feira da semana de hoje "come" da folga). A afirmação que independe do dia:
      // toda etapa que FOR cortada encosta exatamente na origem da régua.
      const elementosCortados = linha.locator('[data-cortada="true"]');
      const caixasCortadas = await elementosCortados.evaluateAll((elementos) =>
        elementos.map((el) => el.getBoundingClientRect().x),
      );
      for (const x of caixasCortadas) {
        expect(Math.round(x)).toBe(Math.round(caixaRegua.x));
      }
    });

    test("clicar no nome da encomenda no Gantt abre a página de detalhe (/encomendas/{id}) (A1)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Gantt link para detalhe");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const linha = linhaDoGantt(page, nome);
      await expect(linha).toBeVisible();

      const testId = await linha.getAttribute("data-testid");
      if (!testId) {
        throw new Error("Linha do Gantt sem data-testid.");
      }
      const id = testId.replace("gantt-linha-", "");

      // Leitura determinística do `href`, sem depender de navegação — prova o destino exato.
      const link = linha.getByRole("link");
      await expect(link).toHaveAttribute("href", `/encomendas/${id}`);

      await link.click();
      await expect(page).toHaveURL(new RegExp(`/encomendas/${id}$`));
      // Prova que abriu a encomenda CERTA, não uma qualquer.
      await expect(page.getByText(nome, { exact: true })).toBeVisible();
    });

    // Índice mostra a contagem de itens (achado do dono na caminhada de 2026-08-20,
    // 03-VERIFICATION.md): o índice não dava nenhuma pista de que a encomenda tinha itens.
    // Ancorado dentro da linha do Gantt da própria encomenda — nunca texto solto na página —
    // porque o banco de teste tem dado de outros specs rodando em paralelo.
    test("a contagem de itens aparece na linha do Gantt, singular e plural", async ({ page }) => {
      await fazerLogin(page);

      const nomeSingular = nomeUnico("Gantt contagem singular");
      await criarEncomenda(page, { nome: nomeSingular, dataInicio: dataEmDias(0) });
      const linhaSingular = linhaDoGantt(page, nomeSingular);
      await expect(linhaSingular).toBeVisible();
      await expect(linhaSingular.getByTestId("contagem-de-itens")).toHaveText(
        `· ${textoDaContagemDeItens(1)}`,
      );

      const nomePlural = nomeUnico("Gantt contagem plural");
      await criarEncomenda(page, {
        nome: nomePlural,
        dataInicio: dataEmDias(0),
        itensExtras: ["Segundo item [e2e]"],
      });
      const linhaPlural = linhaDoGantt(page, nomePlural);
      await expect(linhaPlural).toBeVisible();
      await expect(linhaPlural.getByTestId("contagem-de-itens")).toHaveText(
        `· ${textoDaContagemDeItens(2)}`,
      );
    });

    // D-10 (03-UI-SPEC.md "Rascunho no Gantt — Tratamento Atenuado"): hachura diagonal
    // preservando a cor cheia da etapa, nunca opacidade reduzida (linguagem de "desabilitado"
    // do sistema). Cria uma encomenda que vira rascunho e uma de CONTROLE (em_producao) — o
    // controle é o que faz o teste discriminar, e substitui o passo RED que não existe aqui
    // porque o código de produção (gantt.tsx `estiloDeEtapa`) já está escrito.
    test("uma encomenda em rascunho desenha barra e losango com hachura diagonal, preservando a cor cheia da etapa (D-10)", async ({
      page,
    }) => {
      await fazerLogin(page);

      const nomeRascunho = nomeUnico("Gantt hachura");
      await criarEncomenda(page, { nome: nomeRascunho, dataInicio: dataEmDias(0) });
      const idRascunho = await idDaEncomenda(page, nomeRascunho);

      const nomeControle = nomeUnico("Gantt sem hachura");
      await criarEncomenda(page, { nome: nomeControle, dataInicio: dataEmDias(0) });
      const idControle = await idDaEncomenda(page, nomeControle);

      // Só a primeira encomenda vira rascunho — a de controle fica em `em_producao`.
      await marcarComoRascunho(idRascunho);
      // Recarrega para o servidor renderizar de novo lendo o status já gravado no banco.
      await page.goto("/encomendas");

      const linhaRascunho = page.getByTestId(`gantt-linha-${idRascunho}`);
      await expect(linhaRascunho).toBeVisible();
      const linhaControle = page.getByTestId(`gantt-linha-${idControle}`);
      await expect(linhaControle).toBeVisible();

      // Controle primeiro: guarda o `background-color` cheio da etapa para comparar com o
      // gradiente do rascunho mais abaixo.
      const barraControle = linhaControle.getByTestId(`gantt-barra-${idControle}-producao`);
      await expect(barraControle).toBeVisible();
      // Trava a premissa de que esta barra não é cortada (ramo `cortadaNaEsquerda` de
      // gantt.tsx sobrescreve `borderLeft`, não é o assunto deste teste) — por isso a leitura
      // de borda é sempre pelo TOPO, nunca pela esquerda.
      await expect(barraControle).toHaveAttribute("data-cortada", "false");
      const estiloControle = await barraControle.evaluate((el) => {
        const estilo = getComputedStyle(el);
        return {
          backgroundImage: estilo.backgroundImage,
          backgroundColor: estilo.backgroundColor,
          borderTopStyle: estilo.borderTopStyle,
        };
      });
      expect(estiloControle.backgroundImage).toBe("none");
      // Não afirma `borderTopStyle === "none"`: o preflight do Tailwind v4 declara
      // `border: 0 solid` em todo elemento, então o valor real é "solid" com largura 0px —
      // afirmar "none" falharia por um motivo que não tem nada a ver com rascunho.
      expect(estiloControle.borderTopStyle).not.toBe("dashed");
      expect(estiloControle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      await expect(linhaControle.getByText(SELO_RASCUNHO, { exact: true })).toHaveCount(0);

      const barraRascunho = linhaRascunho.getByTestId(`gantt-barra-${idRascunho}-producao`);
      await expect(barraRascunho).toBeVisible();
      await expect(barraRascunho).toHaveAttribute("data-cortada", "false");
      const estiloBarraRascunho = await barraRascunho.evaluate((el) => {
        const estilo = getComputedStyle(el);
        return {
          backgroundImage: estilo.backgroundImage,
          borderTopStyle: estilo.borderTopStyle,
          borderTopWidth: estilo.borderTopWidth,
          opacity: estilo.opacity,
        };
      });
      expect(estiloBarraRascunho.backgroundImage).toContain("repeating-linear-gradient");
      expect(estiloBarraRascunho.borderTopStyle).toBe("dashed");
      expect(estiloBarraRascunho.borderTopWidth).toBe("1px");
      // A regra literal de D-10: hachura preservando a cor cheia, NUNCA opacidade reduzida.
      expect(estiloBarraRascunho.opacity).toBe("1");
      // A asserção que amarra as duas — "preservando a cor cheia da etapa" vira medição, não
      // promessa: o gradiente do rascunho contém a mesma cor que o controle usa como
      // `background-color`. As duas leituras saem do mesmo `getComputedStyle`, no mesmo
      // documento, logo passam pela mesma serialização de cor.
      expect(estiloBarraRascunho.backgroundImage).toContain(estiloControle.backgroundColor);

      // A hachura vale para as duas formas, não só para as barras — o losango do marco
      // `queima1` repete as mesmas três asserções de estilo.
      const marcoRascunho = linhaRascunho.getByTestId(`gantt-marco-${idRascunho}-queima1`);
      await expect(marcoRascunho).toBeVisible();
      const estiloMarcoRascunho = await marcoRascunho.evaluate((el) => {
        const estilo = getComputedStyle(el);
        return {
          backgroundImage: estilo.backgroundImage,
          borderTopStyle: estilo.borderTopStyle,
          borderTopWidth: estilo.borderTopWidth,
          opacity: estilo.opacity,
        };
      });
      expect(estiloMarcoRascunho.backgroundImage).toContain("repeating-linear-gradient");
      expect(estiloMarcoRascunho.borderTopStyle).toBe("dashed");
      expect(estiloMarcoRascunho.borderTopWidth).toBe("1px");
      expect(estiloMarcoRascunho.opacity).toBe("1");

      await expect(linhaRascunho.getByText(SELO_RASCUNHO, { exact: true })).toHaveCount(1);
    });
  });

  test.describe("Lista mobile (ENC-08, ENC-09)", () => {
    // Espelho do describe do Gantt: o cartão só existe VISÍVEL no projeto `celular` (no
    // desktop ele está no HTML, escondido por `md:hidden`, D-02).
    test.beforeEach(({}, testInfo) => {
      test.skip(
        testInfo.project.name !== "celular",
        "A lista de cartões é exclusiva do projeto celular — escondida por CSS no desktop (D-02)",
      );
    });

    test("com várias encomendas carregadas, /encomendas não rola horizontalmente (regra dura de 04-DESIGN-SYSTEM.md §6)", async ({
      page,
    }) => {
      await fazerLogin(page);
      for (let indice = 0; indice < 5; indice++) {
        await criarEncomenda(page, {
          nome: nomeUnico(`Lista sem rolagem ${indice}`),
          dataInicio: dataEmDias(indice),
        });
      }
      await page.goto("/encomendas");

      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test("o cartão mostra nome, cliente, a trilha de 6 segmentos e o texto de situação", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Cartao completo");
      await criarEncomenda(page, { nome, cliente: "Cliente do cartão", dataInicio: dataEmDias(0) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();
      await expect(cartao).toContainText("Cliente do cartão");
      await expect(cartao.getByTestId("trilha-segmentos")).toBeVisible();
      // Encomenda criada hoje: a etapa atual é "Produção" (primeira etapa, cascata a partir de
      // hoje) — texto exato vem de `textoDaSituacao`, nunca redigitado aqui.
      await expect(cartao).toContainText(`Etapa atual: ${ROTULO_ETAPA.producao}`);
    });

    test("o segmento da etapa atual tem borda de 2px; os demais não têm borda destacada", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Cartao etapa atual");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();

      // Encomenda criada hoje começa em "Produção" — o segmento de produção é o atual.
      const segmentoAtual = cartao.getByTestId("trilha-segmento-producao");
      await expect(segmentoAtual).toHaveAttribute("data-atual", "true");
      const larguraDaBordaAtual = await segmentoAtual.evaluate(
        (el) => getComputedStyle(el).borderTopWidth,
      );
      expect(larguraDaBordaAtual).toBe("2px");

      const segmentoOutro = cartao.getByTestId("trilha-segmento-secagem");
      await expect(segmentoOutro).toHaveAttribute("data-atual", "false");
      const larguraDaBordaOutro = await segmentoOutro.evaluate(
        (el) => getComputedStyle(el).borderTopWidth,
      );
      expect(larguraDaBordaOutro).toBe("0px");
    });

    test("a soma das larguras dos segmentos preenche a largura da trilha, sem lacuna", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Cartao soma segmentos");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const cartao = cartaoDoCelular(page, nome);
      const trilha = cartao.getByTestId("trilha-segmentos");
      await expect(trilha).toBeVisible();

      const caixaTrilha = await trilha.boundingBox();
      const larguras = await cartao
        .locator('[data-testid^="trilha-segmento-"]')
        .evaluateAll((elementos) => elementos.map((el) => el.getBoundingClientRect().width));
      const somaDasLarguras = larguras.reduce((total, largura) => total + largura, 0);

      if (!caixaTrilha) {
        throw new Error("Não foi possível medir a trilha de segmentos.");
      }
      // Tolerância de 1px por segmento (6 etapas) para arredondamento de layout por percentual.
      expect(Math.abs(somaDasLarguras - caixaTrilha.width)).toBeLessThanOrEqual(6);
    });

    test("um nome de 60+ caracteres quebra em linha dentro do cartão, sem rolagem horizontal", async ({
      page,
    }) => {
      await fazerLogin(page);
      // Mais de 60 caracteres, mas dentro do limite de 120 do esquema (`esquemaEncomenda.nome`)
      // — passar de 120 faria a validação Zod recusar em silêncio (stub conhecido de
      // 03-01-SUMMARY.md: o formulário desta fatia não mostra erro de validação na tela), o
      // que prenderia o teste em `?nova` para sempre em vez de testar a quebra de linha.
      const nomeLongo = `[e2e] Peça encomendada com nome bem comprido de propósito para testar quebra ${Date.now()}`;
      await criarEncomenda(page, { nome: nomeLongo, dataInicio: dataEmDias(0) });

      const cartao = cartaoDoCelular(page, nomeLongo);
      await expect(cartao).toBeVisible();

      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

      const nomeNoCartao = cartao.getByText(nomeLongo, { exact: true });
      const estiloDeQuebra = await nomeNoCartao.evaluate((el) => getComputedStyle(el).overflowWrap);
      expect(estiloDeQuebra).toBe("break-word");
    });

    test("uma encomenda atrasada mostra o badge 'ATRASADA' e o texto do caso atrasada, com --color-atencao", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Cartao atrasada");
      // 60 dias atrás: a cascata padrão (13 dias) termina bem antes de hoje.
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(-60) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();
      await expect(cartao).toContainText("ATRASADA");
      await expect(cartao).toContainText("Atrasada");

      const corDoBadge = await cartao
        .getByText("ATRASADA", { exact: true })
        .evaluate((el) => getComputedStyle(el).color);
      // --color-atencao = #B45309 = rgb(180, 83, 9); nunca --color-erro (#B91C1C).
      expect(corDoBadge).toBe("rgb(180, 83, 9)");
    });

    test("uma encomenda que ainda não começou mostra 'Começa em N dias' e nenhum segmento destacado", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Cartao nao comecou");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(30) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();
      await expect(cartao).toContainText("Começa em 30 dias");

      const segmentos = cartao.locator('[data-testid^="trilha-segmento-"]');
      const quantidadeComDestaque = await segmentos.evaluateAll(
        (elementos) => elementos.filter((el) => el.getAttribute("data-atual") === "true").length,
      );
      expect(quantidadeComDestaque).toBe(0);
    });

    test("a ordem dos cartões segue ordenarParaGantt (data de início ascendente)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nomeCedo = nomeUnico("Cartao ordem A cedo");
      const nomeTarde = nomeUnico("Cartao ordem B tarde");

      await criarEncomenda(page, { nome: nomeTarde, dataInicio: dataEmDias(45) });
      await criarEncomenda(page, { nome: nomeCedo, dataInicio: dataEmDias(25) });
      await page.goto("/encomendas");

      const nomesNaTela = await page
        .locator('[data-testid^="cartao-encomenda-"]')
        .evaluateAll((elementos) => elementos.map((el) => el.textContent ?? ""));

      const indiceCedo = nomesNaTela.findIndex((texto) => texto.includes(nomeCedo));
      const indiceTarde = nomesNaTela.findIndex((texto) => texto.includes(nomeTarde));

      expect(indiceCedo).toBeGreaterThanOrEqual(0);
      expect(indiceTarde).toBeGreaterThanOrEqual(0);
      expect(indiceCedo).toBeLessThan(indiceTarde);
    });

    test("um cartão só e muitos cartões usam o mesmo leiaute (zero-um-muitos)", async ({ page }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Cartao zero-um-muitos");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();
      await expect(cartao.getByTestId("trilha-segmentos")).toBeVisible();
    });

    test("encomenda que começa hoje: a marca de 'hoje' existe na barra, na posição 0 (A2)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Trilha hoje posicao 0");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(0) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();

      const marca = cartao.getByTestId("trilha-hoje");
      await expect(marca).toHaveCount(1);
      await expect(marca).toHaveAttribute("data-posicao", "0");
    });

    test("a linha de datas da barra mostra o início e a entrega formatados (A2)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Trilha datas nas pontas");
      const dataInicio = dataEmDias(0);
      await criarEncomenda(page, { nome, dataInicio });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();

      // Recompute com a MESMA função de produção que a Server Action usa para montar o
      // cronograma — nunca redigita a string formatada aqui.
      const cronograma = calcularCronograma(dataInicio, DIAS_PADRAO);
      const datas = cartao.getByTestId("trilha-datas");
      await expect(datas).toContainText(formatarDiaCurto(cronograma.inicio));
      await expect(datas).toContainText(formatarDiaCurto(cronograma.dataDeConclusao ?? cronograma.inicio));
    });

    test("encomenda que ainda não começou: a marca de 'hoje' não aparece na barra (A2)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Trilha hoje ausente futuro");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(30) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();
      await expect(cartao.getByTestId("trilha-hoje")).toHaveCount(0);
    });

    test("encomenda já concluída/atrasada: a marca de 'hoje' não aparece na barra (A2)", async ({
      page,
    }) => {
      await fazerLogin(page);
      const nome = nomeUnico("Trilha hoje ausente passado");
      await criarEncomenda(page, { nome, dataInicio: dataEmDias(-60) });

      const cartao = cartaoDoCelular(page, nome);
      await expect(cartao).toBeVisible();
      await expect(cartao.getByTestId("trilha-hoje")).toHaveCount(0);
    });

    // Espelho do teste do Gantt: mesma contagem, mesmo par singular/plural, agora no cartão.
    test("a contagem de itens aparece no cartão do celular, singular e plural", async ({ page }) => {
      await fazerLogin(page);

      const nomeSingular = nomeUnico("Cartão contagem singular");
      await criarEncomenda(page, { nome: nomeSingular, dataInicio: dataEmDias(0) });
      const cartaoSingular = cartaoDoCelular(page, nomeSingular);
      await expect(cartaoSingular).toBeVisible();
      await expect(cartaoSingular.getByTestId("contagem-de-itens")).toHaveText(
        textoDaContagemDeItens(1),
      );

      const nomePlural = nomeUnico("Cartão contagem plural");
      await criarEncomenda(page, {
        nome: nomePlural,
        dataInicio: dataEmDias(0),
        itensExtras: ["Segundo item [e2e]"],
      });
      const cartaoPlural = cartaoDoCelular(page, nomePlural);
      await expect(cartaoPlural).toBeVisible();
      await expect(cartaoPlural.getByTestId("contagem-de-itens")).toHaveText(
        textoDaContagemDeItens(2),
      );
    });

    // Espelho do teste de hachura do Gantt, agora no cartão do celular (D-10). Mesma dupla
    // rascunho + controle, mesma medição por CSS computado.
    test("uma encomenda em rascunho desenha os segmentos da trilha com hachura diagonal, preservando a cor cheia da etapa (D-10)", async ({
      page,
    }) => {
      await fazerLogin(page);

      const nomeRascunho = nomeUnico("Cartao hachura");
      await criarEncomenda(page, { nome: nomeRascunho, dataInicio: dataEmDias(0) });
      const idRascunho = await idDaEncomenda(page, nomeRascunho);

      const nomeControle = nomeUnico("Cartao sem hachura");
      await criarEncomenda(page, { nome: nomeControle, dataInicio: dataEmDias(0) });
      const idControle = await idDaEncomenda(page, nomeControle);

      await marcarComoRascunho(idRascunho);
      await page.goto("/encomendas");

      const cartaoRascunho = page.getByTestId(`cartao-encomenda-${idRascunho}`);
      await expect(cartaoRascunho).toBeVisible();
      const cartaoControle = page.getByTestId(`cartao-encomenda-${idControle}`);
      await expect(cartaoControle).toBeVisible();

      // Controle primeiro: guarda o `background-color` cheio de cada segmento para comparar
      // com o gradiente do rascunho mais abaixo.
      const segmentosControle = {
        producao: cartaoControle.getByTestId("trilha-segmento-producao"),
        secagem: cartaoControle.getByTestId("trilha-segmento-secagem"),
      };
      const estiloControle = {
        producao: await segmentosControle.producao.evaluate((el) => {
          const estilo = getComputedStyle(el);
          return { backgroundImage: estilo.backgroundImage, backgroundColor: estilo.backgroundColor };
        }),
        secagem: await segmentosControle.secagem.evaluate((el) => {
          const estilo = getComputedStyle(el);
          return { backgroundImage: estilo.backgroundImage, backgroundColor: estilo.backgroundColor };
        }),
      };
      expect(estiloControle.producao.backgroundImage).toBe("none");
      expect(estiloControle.producao.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(estiloControle.secagem.backgroundImage).toBe("none");
      expect(estiloControle.secagem.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      await expect(cartaoControle.getByText(SELO_RASCUNHO, { exact: true })).toHaveCount(0);

      const segmentosRascunho = {
        producao: cartaoRascunho.getByTestId("trilha-segmento-producao"),
        secagem: cartaoRascunho.getByTestId("trilha-segmento-secagem"),
      };
      const estiloRascunho = {
        producao: await segmentosRascunho.producao.evaluate((el) => {
          const estilo = getComputedStyle(el);
          return { backgroundImage: estilo.backgroundImage, opacity: estilo.opacity };
        }),
        secagem: await segmentosRascunho.secagem.evaluate((el) => {
          const estilo = getComputedStyle(el);
          return { backgroundImage: estilo.backgroundImage, opacity: estilo.opacity };
        }),
      };
      expect(estiloRascunho.producao.backgroundImage).toContain("repeating-linear-gradient");
      // D-10: hachura preservando a cor cheia, NUNCA opacidade reduzida.
      expect(estiloRascunho.producao.opacity).toBe("1");
      expect(estiloRascunho.producao.backgroundImage).toContain(estiloControle.producao.backgroundColor);
      expect(estiloRascunho.secagem.backgroundImage).toContain("repeating-linear-gradient");
      expect(estiloRascunho.secagem.opacity).toBe("1");
      expect(estiloRascunho.secagem.backgroundImage).toContain(estiloControle.secagem.backgroundColor);

      // Diferença deliberada em relação ao Gantt: `trilha-segmentos.tsx` só define borda para
      // a etapa ATUAL (2px sólidos, destaque de posição), nunca tracejada em nenhum status —
      // ao contrário de `gantt.tsx`, que dá 1px tracejado a todo elemento em rascunho. Não é
      // esquecimento deste plano, é o componente: por isso este teste não afirma
      // `borderTopStyle` nenhum aqui. Ver observação de coerência visual no SUMMARY deste
      // quick para o dono decidir depois.

      await expect(cartaoRascunho.getByText(SELO_RASCUNHO, { exact: true })).toHaveCount(1);
    });
  });
});

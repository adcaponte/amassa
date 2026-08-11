import { test, expect, type Locator, type Page } from "@playwright/test";

// O banner agregado de `/queimas` (FOR-06), o cartão "Fornos em atenção" do painel inicial
// (FOR-13) e o filtro Ativos/Desativados/Todos (a metade final de FOR-11) — 04-05-PLAN.md,
// Tarefa 3. Uma única invocação de `npm run test:e2e --grep "banner de fornos"` para todo o
// arquivo — o describe de topo entra no título de todos os casos abaixo, então o `--grep` do
// comando de verificação da Tarefa 3 casa com os quatro.
//
// O primeiro caso não afirma nenhuma condição global do banco: só checa que o forno criado pelo
// PRÓPRIO teste não aparece no banner/painel, com checagem condicional para o caso de o banner
// já existir por causa de outro forno concorrente.
//
// Os casos 2, 3 e 4 carregam `@vazio-historico` — a mesma etiqueta que
// `tests/e2e/encomendas-filtros.spec.ts` já usa, encadeada por `playwright.config.ts` para rodar
// sozinha, depois de `vazio-desktop` e antes de `desktop`/`celular`. O caso 4 precisa dela porque
// exige "nenhum forno desativado existe" para provar o vazio filtrado — condição global de
// verdade. Os casos 2 e 3 ganharam a MESMA etiqueta na varredura completa de fim de fase
// (04-07): eles afirmam que o forno recém-criado aparece pelo NOME no texto do banner, mas o
// banner mostra só os 3 primeiros (`ordenarParaBanner`, truncagem "e mais N") — sob
// `fullyParallel`, quando outros arquivos da suíte (`queimas-cartao.spec.ts`,
// `queimas-manutencao.spec.ts`, etc.) levam vários fornos a crítico/atenção ao mesmo tempo, o
// forno destes dois casos é empurrado para fora dos 3 primeiros e a asserção por nome falha —
// não por instabilidade de ambiente, é a mesma classe de "condição global disputada por escritas
// concorrentes" que a etiqueta já existe para resolver. Rodar na cadeia `vazio-*` garante que
// nenhum outro arquivo já criou forno quando estes dois casos executam. Nunca `--grep` como
// muleta (CLAUDE.md §Conventions).

test.describe("banner de fornos e alerta do painel inicial", () => {
  test.describe.configure({ mode: "serial", retries: 2 });

  async function fazerLogin(page: Page) {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  }

  function nomeUnico(rotulo: string): string {
    return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function cadastrarForno(page: Page, nome: string, limite: number): Promise<void> {
    await page.goto("/queimas?novo");
    await page.getByLabel("Nome").fill(nome);
    await page.getByLabel("Limite").fill(String(limite));
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/queimas$/, { timeout: 10000 });
  }

  function cartaoDoForno(page: Page, nome: string) {
    return page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
  }

  // Mesmo mecanismo de `tests/e2e/queimas-cartao.spec.ts`: `force: true` porque toasts
  // empilhados podem cobrir o botão dependendo de onde o cartão cai na grade; o portão para o
  // próximo toque é o próprio botão "Queimar" reaparecer, não o contador (que depende de
  // `revalidatePath`/`router.refresh()` contra o servidor Next único compartilhado da suíte).
  async function registrarQueima(cartao: Locator): Promise<void> {
    await cartao.scrollIntoViewIfNeeded();
    await cartao.getByRole("button", { name: "Queimar" }).click({ force: true });
    await cartao.getByTestId("tipo-queima-biscoito").click({ force: true });
    await expect(cartao.getByRole("button", { name: "Queimar" })).toBeVisible({ timeout: 10000 });
  }

  // Verifica a gramática singular/plural CONTRA o próprio número que o banner mostra, em vez de
  // supor um total fixo — o total real depende de quantos fornos em atenção existem no sistema
  // no momento, que este arquivo não controla sozinho (dois projetos, Playwright, mesmo banco).
  function verificarGramaticaDoPrefixo(texto: string): void {
    const combinacao = texto.match(/^(\d+) (?:forno precisa|fornos precisam) de atenção:/);
    expect(combinacao, `prefixo do banner não bateu o formato esperado: "${texto}"`).not.toBeNull();
    const quantidade = Number(combinacao![1]);
    if (quantidade === 1) {
      expect(texto.startsWith("1 forno precisa de atenção:")).toBe(true);
    } else {
      expect(texto.startsWith(`${quantidade} fornos precisam de atenção:`)).toBe(true);
    }
  }

  test("sem nenhum forno em atenção, o forno recém-criado não aparece no banner nem no cartão do painel inicial", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Forno tranquilo");
    await cadastrarForno(page, nome, 100);

    const cartao = cartaoDoForno(page, nome);
    await expect(cartao).toBeVisible();
    await expect(cartao.locator('[data-testid^="selo-forno-"]')).toHaveCount(0);

    // O banner pode existir por causa de OUTRO forno em atenção (do projeto irmão rodando em
    // paralelo, ou de execuções anteriores desta mesma suíte) — o que este teste prova é que o
    // NOSSO forno, recém-criado e sem nenhuma queima, nunca aparece nele.
    const bannerTexto = page.getByTestId("banner-atencao-texto");
    if ((await bannerTexto.count()) > 0) {
      await expect(bannerTexto).not.toContainText(nome);
    }

    await page.goto("/");
    const cartaoPainel = page.getByTestId("cartao-painel-fornos-em-atencao");
    if ((await cartaoPainel.count()) > 0) {
      await expect(cartaoPainel).not.toContainText(nome);
    }
  });

  // Reaproveitado do 2º para o 3º teste (mode: "serial" garante a ordem, mesmo worker) — evita
  // registrar um SEGUNDO forno em atenção do zero no teste seguinte. O servidor Next da suíte é
  // ÚNICO e compartilhado por todos os workers/projetos (mesma contenção documentada em
  // 04-02-SUMMARY.md); cada registro real a menos importa quando dois projetos (desktop/celular)
  // rodam o mesmo arquivo em paralelo contra o mesmo servidor.
  let nomeFornoEmAtencao = "";

  test("um forno no limiar de atenção aparece no banner com o contador, e o prefixo bate a própria quantidade mostrada @vazio-historico", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Forno limiar");
    await cadastrarForno(page, nome, 10);

    const cartao = cartaoDoForno(page, nome);
    // limiarDeAtencao(10) = Math.max(1, 10 - 10) = 1 — um único registro já cruza a fronteira.
    await registrarQueima(cartao);
    await expect(cartao.locator('[data-testid^="selo-forno-"]')).toContainText("Manutenção próxima");

    const bannerTexto = page.getByTestId("banner-atencao-texto");
    await expect(bannerTexto).toContainText(`${nome} (1/10)`, { timeout: 10000 });

    const texto = await bannerTexto.innerText();
    verificarGramaticaDoPrefixo(texto);

    nomeFornoEmAtencao = nome;
  });

  test("um segundo forno em crítico aparece ANTES do primeiro (em atenção) no banner e o mesmo aviso chega ao painel inicial @vazio-historico", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await fazerLogin(page);
    const nomeAtencao = nomeFornoEmAtencao;
    const nomeCritico = nomeUnico("Forno crítico");
    expect(nomeAtencao, "depende do forno em atenção criado pelo teste anterior").not.toBe("");

    await cadastrarForno(page, nomeCritico, 10);
    const cartaoCritico = cartaoDoForno(page, nomeCritico);
    for (let contador = 1; contador <= 10; contador++) {
      await registrarQueima(cartaoCritico);
    }
    await expect(cartaoCritico.locator('[data-testid^="selo-forno-"]')).toContainText(
      "Manutenção vencida",
    );

    const bannerTexto = page.getByTestId("banner-atencao-texto");
    await expect(bannerTexto).toContainText(`${nomeCritico} (10/10)`, { timeout: 10000 });
    const texto = await bannerTexto.innerText();
    expect(texto).toContain(`${nomeAtencao} (1/10)`);
    // Ordem: crítico primeiro — `ordenarParaBanner` (lib/queimas/filtros.ts).
    expect(texto.indexOf(nomeCritico)).toBeLessThan(texto.indexOf(nomeAtencao));
    // Plural: os NOSSOS dois fornos em atenção já garantem quantidade >= 2, então o prefixo NUNCA
    // pode ler no singular aqui — assert forte, não dependente da gramática genérica.
    expect(texto).toMatch(/^\d+ fornos precisam de atenção:/);

    // E11: o mesmo aviso chega ao painel inicial, com o forno crítico visível.
    await page.goto("/");
    const cartaoPainelTexto = await page
      .getByTestId("cartao-painel-fornos-em-atencao")
      .innerText();
    expect(cartaoPainelTexto).toContain(nomeCritico);
    await expect(page.getByRole("link", { name: "Ver fornos" })).toBeVisible();
  });

  // Este caso PRECISA que nenhum forno desativado exista no banco para provar o vazio filtrado —
  // uma condição global de verdade, por isso a etiqueta `@vazio-historico` (mesma solução de
  // `tests/e2e/encomendas-filtros.spec.ts`): roda sozinho, na cadeia `vazio-*` de
  // `playwright.config.ts`, antes de qualquer outro teste tocar o banco.
  test('filtro "Desativados" sem nenhum forno desativado mostra "Nada por aqui com esse filtro.", e um forno desativado aparece nele depois @vazio-historico', async ({
    page,
  }) => {
    await fazerLogin(page);

    // O seletor de filtro só existe quando há pelo menos um forno no índice — sem nenhum, a
    // página mostra o vazio "Nenhum forno cadastrado ainda.", não a lista com o filtro. Um forno
    // ATIVO qualquer garante que o filtro exista antes de checar o vazio FILTRADO.
    const nomeDecoy = nomeUnico("Forno só para o filtro existir");
    await cadastrarForno(page, nomeDecoy, 100);

    await page.goto("/queimas");
    await page.getByTestId("filtro-fornos-desativados").click();
    await expect(page.getByText("Nada por aqui com esse filtro.")).toBeVisible();
    // Distinto do vazio "nenhum forno existe" — os dois nunca se confundem.
    await expect(page.getByText("Nenhum forno cadastrado ainda.")).toHaveCount(0);

    const nome = nomeUnico("Forno a desativar");
    await cadastrarForno(page, nome, 100);
    const cartao = cartaoDoForno(page, nome);
    await expect(cartao).toHaveCount(1);
    const testId = await cartao.getAttribute("data-testid");
    if (!testId) {
      throw new Error(`Não encontrou o cartão do forno "${nome}" para descobrir o id.`);
    }
    const id = testId.replace("cartao-forno-", "");

    await page.goto(`/queimas/${id}`);
    await page.getByTestId(`acoes-forno-${id}`).click();
    await page.getByTestId("desativar-forno").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desativar forno" }).click();
    await expect(page.getByText("Forno desativado.")).toBeVisible({ timeout: 5000 });

    await page.goto("/queimas");
    await page.getByTestId("filtro-fornos-desativados").click();
    await expect(cartaoDoForno(page, nome)).toBeVisible();
    await expect(page.getByText("Nada por aqui com esse filtro.")).toHaveCount(0);

    // A ordem não muda ao alternar o filtro — "Todos" mostra o mesmo forno, só sem removê-lo.
    await page.getByTestId("filtro-fornos-todos").click();
    await expect(cartaoDoForno(page, nome)).toBeVisible();
  });
});

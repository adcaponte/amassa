import { test, expect, type Page } from "@playwright/test";

// Relatórios `/queimas/relatorios` (D-01, D-07, D-08, FOR-12) — 04-06-PLAN.md, Tarefa 3. Sem
// etiqueta de vazio: cria dado, roda em `desktop`/`celular` depois da cadeia `vazio-*`
// (playwright.config.ts). As estatísticas do topo são um total GLOBAL do ateliê — sob execução
// paralela, outros arquivos de spec também registram queimas ao mesmo tempo (CLAUDE.md
// §Conventions: teste não pode afirmar condição global sem isolamento), então cada teste aqui lê
// o total ANTES de registrar suas próprias queimas e afirma a DIFERENÇA (delta), nunca um valor
// absoluto — a prova de FOR-12 sem disputar estado com o resto da suíte.

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

async function cadastrarForno(page: Page, nome: string): Promise<void> {
  await page.goto("/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill("50");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/queimas$/, { timeout: 10000 });
}

function cartaoDoForno(page: Page, nome: string) {
  return page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
}

async function registrarUmaQueima(
  page: Page,
  nomeDoForno: string,
  tipo: "biscoito" | "esmalte" | "ouro",
  totalEsperadoDepois: number,
): Promise<void> {
  // Idempotente: o teste intercala navegações para `/queimas/relatorios` (ler estatísticas)
  // entre registros — sempre volta para `/queimas` antes de procurar o cartão, em vez de assumir
  // qual página está aberta.
  if (!/\/queimas$/.test(new URL(page.url()).pathname)) {
    await page.goto("/queimas");
  }
  const cartao = cartaoDoForno(page, nomeDoForno);
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId(`tipo-queima-${tipo}`).click();
  await expect(cartao.getByTestId("medidor-contador")).toContainText(`${totalEsperadoDepois} / 50`, {
    timeout: 10000,
  });
}

async function lerEstatistica(page: Page, testId: string): Promise<number> {
  const texto = await page.getByTestId(`estatistica-${testId}-valor`).innerText();
  return Number(texto.trim());
}

test.describe("relatórios de queimas", () => {
  // `mode: "serial"` + `retries: 2`: o servidor Next é ÚNICO e compartilhado por toda a suíte
  // (mesmo achado de 04-02-SUMMARY.md/04-05-SUMMARY.md) — registrar 4 queimas seguidas mais uma
  // navegação para `/queimas/relatorios` é sensível a lentidão transitória sob carga alta local.
  test.describe.configure({ mode: "serial", retries: 2 });

  test("o seletor de topo navega entre /queimas e /queimas/relatorios, com aria-current e o botão voltar funcionando", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/queimas");

    await expect(page.getByTestId("seletor-queimas-fornos")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("seletor-queimas-relatorios")).not.toHaveAttribute("aria-current", "page");

    await page.getByTestId("seletor-queimas-relatorios").click();
    await expect(page).toHaveURL(/\/queimas\/relatorios$/);
    await expect(page.getByTestId("seletor-queimas-relatorios")).toHaveAttribute("aria-current", "page");

    await page.goBack();
    await expect(page).toHaveURL(/\/queimas$/);
    await expect(page.getByTestId("seletor-queimas-fornos")).toHaveAttribute("aria-current", "page");
  });

  test("as quatro estatísticas aparecem, a soma bate com as queimas que o próprio teste registrou (FOR-12), e o alternador Semana/Mês não muda os números", async ({
    page,
  }, testInfo) => {
    // As estatísticas são um total GLOBAL do ateliê (por desenho — não são por forno). Rodar em
    // dois projetos (desktop/celular) ao mesmo tempo faria os dois medirem o MESMO contador
    // global concorrentemente, cada um contaminando a diferença do outro (achado real desta
    // tarefa: a primeira versão deste teste, sem este skip, media delta 4 em vez de 3 — a
    // diferença exata de UMA queima que o outro projeto tinha acabado de registrar). Roda só no
    // desktop; o teste de rolagem abaixo é o único outro escritor concorrente deste arquivo, e
    // sempre em "biscoito" — a tolerância abaixo é exatamente esse acoplamento conhecido, não uma
    // folga arbitrária.
    test.skip(testInfo.project.name !== "desktop", "Estatísticas são globais — evita competir com o próprio celular");

    await fazerLogin(page);

    const nome = nomeUnico("Forno relatório");
    await cadastrarForno(page, nome);
    // Uma primeira queima ANTES de ler a linha de base: garante que a tela de relatórios já tem
    // pelo menos uma queima (nunca o `EstadoVazio` de D-08) no instante em que a linha de base é
    // lida — sem isso, se nenhum outro teste tivesse criado uma queima na janela ainda, a leitura
    // de base cairia no vazio em vez das estatísticas.
    await registrarUmaQueima(page, nome, "biscoito", 1);

    // Linha de base — lida DEPOIS da primeira queima (garante o painel populado) e ANTES do
    // restante, para o teste afirmar só a DIFERENÇA que ele mesmo provocou dali em diante (nunca
    // um total absoluto do ateliê inteiro).
    await page.goto("/queimas/relatorios");
    await expect(page.getByTestId("estatisticas-queimas")).toBeVisible();
    const totalAntes = await lerEstatistica(page, "total");
    const biscoitoAntes = await lerEstatistica(page, "biscoito");
    const esmalteAntes = await lerEstatistica(page, "esmalte");

    // Um esmalte e um ouro — SEM biscoito depois da linha de base, de propósito: o único outro
    // escritor concorrente possível (o teste de rolagem, no projeto celular) só registra
    // "biscoito", então manter o pós-base livre de biscoito torna o delta de ESMALTE uma prova
    // EXATA e imune a essa concorrência, mesmo com os dois projetos rodando ao mesmo tempo.
    await registrarUmaQueima(page, nome, "esmalte", 2);
    await registrarUmaQueima(page, nome, "ouro", 3);

    await page.goto("/queimas/relatorios");
    await expect(page.getByTestId("estatisticas-queimas")).toBeVisible();

    const totalDepois = await lerEstatistica(page, "total");
    const biscoitoDepois = await lerEstatistica(page, "biscoito");
    const esmalteDepois = await lerEstatistica(page, "esmalte");

    // A prova de FOR-12 no nível de integração: o delta de ESMALTE bate EXATAMENTE com o que este
    // teste registrou (1) — imune ao único escritor concorrente conhecido deste arquivo, que
    // nunca escreve esmalte. Total e biscoito toleram no máximo +1 vindo dessa mesma
    // concorrência conhecida (nunca menos que o que este teste registrou) — a aritmética de
    // baldes em si já está provada, exaustivamente e sem concorrência, em
    // tests/unit/relatorios-queimas.test.ts.
    expect(esmalteDepois - esmalteAntes).toBe(1);
    expect(totalDepois - totalAntes).toBeGreaterThanOrEqual(2);
    expect(totalDepois - totalAntes).toBeLessThanOrEqual(3);
    expect(biscoitoDepois - biscoitoAntes).toBeGreaterThanOrEqual(0);
    expect(biscoitoDepois - biscoitoAntes).toBeLessThanOrEqual(1);

    // Alternador Semana/Mês: troca a granularidade do gráfico sem refazer a consulta (a URL não
    // muda — nenhuma navegação, então os nós de `estatisticas-queimas` nem re-renderizam) e sem
    // mudar as quatro estatísticas, que não dependem de granularidade.
    await expect(page.getByTestId("alternador-granularidade-semana")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByTestId("alternador-granularidade-mes").click();
    await expect(page.getByTestId("alternador-granularidade-mes")).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(/\/queimas\/relatorios$/);

    expect(await lerEstatistica(page, "total")).toBe(totalDepois);
    expect(await lerEstatistica(page, "biscoito")).toBe(biscoitoDepois);
    expect(await lerEstatistica(page, "esmalte")).toBe(esmalteDepois);

    await page.getByTestId("alternador-granularidade-semana").click();
    await expect(page.getByTestId("alternador-granularidade-semana")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await lerEstatistica(page, "total")).toBe(totalDepois);
  });

  test("no celular, o documento não rola horizontalmente enquanto o gráfico por tipo rola dentro do próprio contêiner", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "celular", "D-07/D-07 é regra específica do celular");

    await fazerLogin(page);
    const nome = nomeUnico("Forno rolagem");
    await cadastrarForno(page, nome);
    await registrarUmaQueima(page, nome, "biscoito", 1);

    await page.goto("/queimas/relatorios");
    const containerDoGrafico = page.getByTestId("grafico-tipo-rolagem");
    await expect(containerDoGrafico).toBeVisible();

    const [scrollWidthDoDocumento, clientWidthDoDocumento] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidthDoDocumento).toBeLessThanOrEqual(clientWidthDoDocumento);

    const [scrollWidthDoGrafico, clientWidthDoGrafico] = await containerDoGrafico.evaluate((el) => [
      el.scrollWidth,
      el.clientWidth,
    ]);
    expect(scrollWidthDoGrafico).toBeGreaterThan(clientWidthDoGrafico);
  });
});

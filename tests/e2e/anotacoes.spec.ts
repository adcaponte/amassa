import { test, expect, type Browser, type Page } from "@playwright/test";

import { CONVITE_DA_CAIXA_VAZIA } from "@/lib/anotacoes/textos";

import { destravarAnotacoesDeTeste, travarAnotacoesParaTeste } from "./apoio/travar-anotacoes";

// As Anotações da casa (04.6-07-PLAN.md, D-08/GES-10): uma folha só, que salva sozinha, guarda
// quem salvou e quando, e avisa — na MESMA linha, nunca um diálogo — antes de sobrescrever texto
// que mudou no servidor. Uma ÚNICA invocação de `npm run test:e2e -- --grep "anotacoes|inicio"`
// para todo o arquivo (CLAUDE.md).
//
// `anotacoes_da_casa` é uma linha ÚNICA e GLOBAL — não existe "linha própria de cada teste" para
// isolar (mesmo problema que `tests/e2e/apoio/registrar-backup.ts` já resolveu para
// `execucoes_backup`). Ver `tests/e2e/apoio/travar-anotacoes.ts`.

const NOME_GESTOR_DE_TESTE = "Gestora de Teste";

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Abre duas ABAS (duas sessões, dois `BrowserContext`) sobre a MESMA folha — a primeira salva um
// texto e fecha; a segunda, que ainda tinha a marca VELHA na tela (nunca recarregou), tenta
// salvar por cima e recebe o aviso de conflito. Devolve a segunda aba já com o aviso visível,
// mais o texto que a primeira salvou (para os casos que conferem "ver o dela").
async function provocarConflito(
  browser: Browser,
  textoDaSegunda: string,
): Promise<{ contextoB: Awaited<ReturnType<Browser["newContext"]>>; paginaB: Page; textoDaPrimeira: string }> {
  const contextoA = await browser.newContext();
  const paginaA = await contextoA.newPage();
  const contextoB = await browser.newContext();
  const paginaB = await contextoB.newPage();

  await fazerLogin(paginaA);
  await fazerLogin(paginaB);
  await paginaA.goto("/gestao");
  await paginaB.goto("/gestao");

  const textoDaPrimeira = nomeUnico("Recado da primeira aba");
  await paginaA.getByTestId("anotacoes-caixa").fill(textoDaPrimeira);
  await expect(paginaA.getByTestId("anotacoes-indicador")).toHaveText("salvo", { timeout: 5000 });
  // A primeira aba não participa do resto do teste — fecha para liberar a sessão.
  await contextoA.close();

  await paginaB.getByTestId("anotacoes-caixa").fill(textoDaSegunda);
  await expect(paginaB.getByTestId("anotacoes-aviso-conflito")).toBeVisible({ timeout: 5000 });

  return { contextoB, paginaB, textoDaPrimeira };
}

// Caso (i) do plano: com a folha recém-semeada (migração 0022), a caixa mostra o convite como
// placeholder e a linha de autoria NÃO existe no DOM — nunca uma autoria vazia (GES-10, aresta
// `empty`). Tag `@vazio-global`: entra na cadeia `vazio-*` de `playwright.config.ts` (nunca
// `--grep`), a ÚNICA forma de garantir que a folha ainda está no estado da semente quando este
// teste roda — antes de qualquer outro caso deste arquivo escrever nela.
test.describe("anotacoes — estado da semente", () => {
  test("com a folha recém-semeada, a caixa mostra o convite e a linha de autoria não existe @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);

    const caixa = page.getByTestId("anotacoes-caixa");
    await expect(caixa).toHaveValue("");
    await expect(caixa).toHaveAttribute("placeholder", CONVITE_DA_CAIXA_VAZIA);
    await expect(page.getByTestId("anotacoes-autoria")).toHaveCount(0);
  });
});

test.describe("anotacoes", () => {
  // `mode: "serial"` mantém os casos DESTE arquivo em ordem, sem paralelizar entre si; o advisory
  // lock em beforeAll/afterAll serializa também os dois PROJETOS (desktop/celular) entre si —
  // mesma disciplina de `tests/e2e/backup.spec.ts`.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await travarAnotacoesParaTeste();
  });

  test.afterAll(async () => {
    await destravarAnotacoesDeTeste();
  });

  // Caso (a): digitar, esperar a pausa, ver "salvo", recarregar e o texto continua.
  test("digitar e parar mostra salvando… e depois salvo; recarregar mantém o texto salvo", async ({
    page,
  }) => {
    await fazerLogin(page);

    const texto = nomeUnico("Recado salvo sozinho");
    const caixa = page.getByTestId("anotacoes-caixa");
    const indicador = page.getByTestId("anotacoes-indicador");

    // O servidor local (Postgres na mesma rede Docker) responde rápido demais para o estado
    // "salvando…" ser observável de forma confiável com um atraso fixo — a forma DETERMINÍSTICA
    // é segurar a requisição de propósito, sem soltar, até o teste já ter visto o indicador
    // (mesma técnica de `tests/e2e/orcamentos-fotos.spec.ts`, "Enviando foto…"). Zero corrida
    // contra o relógio: o estado "salvando" é gravado no cliente ANTES do `await` da rede — o
    // que faltava era dar tempo à rede de ficar presa o bastante para o teste ler o DOM.
    let liberarSalvamento: (() => void) | null = null;
    const salvamentoLiberado = new Promise<void>((resolve) => {
      liberarSalvamento = resolve;
    });
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") {
        await salvamentoLiberado;
      }
      await route.continue();
    });

    await caixa.fill(texto);
    await expect(indicador).toHaveText("salvando…", { timeout: 3000 });
    liberarSalvamento!();

    await expect(indicador).toHaveText("salvo", { timeout: 5000 });
    await page.unroute("**/*");

    await page.reload();
    await expect(page.getByTestId("anotacoes-caixa")).toHaveValue(texto);
  });

  // Caso (b): depois de salvar, a linha de autoria mostra o nome de quem salvou e uma hora no
  // formato HH:MM ("14h20").
  test("depois de salvar, a linha de autoria mostra quem salvou e a hora", async ({ page }) => {
    await fazerLogin(page);

    const texto = nomeUnico("Recado com autoria");
    await page.getByTestId("anotacoes-caixa").fill(texto);
    await expect(page.getByTestId("anotacoes-indicador")).toHaveText("salvo", { timeout: 5000 });

    const autoria = page.getByTestId("anotacoes-autoria");
    await expect(autoria).toBeVisible();
    await expect(autoria).toContainText(NOME_GESTOR_DE_TESTE);
    await expect(autoria).toContainText(/\d{1,2}h\d{2}/);
  });

  // Caso (c): o conflito aparece na MESMA linha, com os dois botões, e NENHUM diálogo é aberto.
  test("duas abas ao mesmo tempo: quem chega depois recebe o aviso, na mesma linha, sem diálogo", async ({
    browser,
  }) => {
    const { contextoB, paginaB } = await provocarConflito(
      browser,
      nomeUnico("Recado da segunda aba — nunca deveria vencer em silêncio"),
    );

    try {
      const aviso = paginaB.getByTestId("anotacoes-aviso-conflito");
      await expect(aviso).toBeVisible();
      await expect(paginaB.locator('[role="dialog"]')).toHaveCount(0);
      await expect(aviso.getByTestId("anotacoes-manter-o-meu")).toBeVisible();
      await expect(aviso.getByTestId("anotacoes-ver-o-dela")).toBeVisible();
    } finally {
      await contextoB.close();
    }
  });

  // Caso (d): "manter o meu" regrava e o texto local vence — recarregar confirma.
  test('"manter o meu" faz o texto local vencer, e recarregar confirma', async ({ browser }) => {
    const textoDaSegunda = nomeUnico("Recado que deve vencer com manter o meu");
    const { contextoB, paginaB } = await provocarConflito(browser, textoDaSegunda);

    try {
      await paginaB.getByTestId("anotacoes-manter-o-meu").click();
      await expect(paginaB.getByTestId("anotacoes-indicador")).toHaveText("salvo", { timeout: 5000 });
      await expect(paginaB.getByTestId("anotacoes-aviso-conflito")).toHaveCount(0);

      await paginaB.reload();
      await expect(paginaB.getByTestId("anotacoes-caixa")).toHaveValue(textoDaSegunda);
    } finally {
      await contextoB.close();
    }
  });

  // Caso (e): "ver o dela" troca o texto da caixa pelo do servidor, e diz ANTES o que será
  // trocado (CLAUDE.md §Exclusão: nenhuma remoção silenciosa).
  test('"ver o dela" troca o conteúdo pelo do servidor, avisando antes o que será trocado', async ({
    browser,
  }) => {
    const { contextoB, paginaB, textoDaPrimeira } = await provocarConflito(
      browser,
      nomeUnico("Recado que não deveria vencer"),
    );

    try {
      const aviso = paginaB.getByTestId("anotacoes-aviso-conflito");
      await expect(aviso).toContainText(/substitu/i);

      await paginaB.getByTestId("anotacoes-ver-o-dela").click();
      await expect(paginaB.getByTestId("anotacoes-caixa")).toHaveValue(textoDaPrimeira);
      await expect(paginaB.getByTestId("anotacoes-aviso-conflito")).toHaveCount(0);
    } finally {
      await contextoB.close();
    }
  });

  // Caso (f): salvar o MESMO texto duas vezes não dispara aviso de conflito — a segunda
  // gravação usa a marca devolvida pela primeira (GES-10, aresta `idempotency`).
  test("salvar o mesmo texto duas vezes não dispara aviso de conflito", async ({ page }) => {
    await fazerLogin(page);

    const texto = nomeUnico("Recado repetido");
    const caixa = page.getByTestId("anotacoes-caixa");
    const indicador = page.getByTestId("anotacoes-indicador");

    await caixa.fill(texto);
    await expect(indicador).toHaveText("salvo", { timeout: 5000 });

    await caixa.fill(texto);
    await expect(indicador).toHaveText("salvo", { timeout: 5000 });
    await expect(page.getByTestId("anotacoes-aviso-conflito")).toHaveCount(0);
  });

  // Caso (g): texto acima do limite é recusado com mensagem em português, e o que foi digitado
  // continua na caixa (nunca perdido).
  test("texto acima do limite é recusado, com mensagem em português, sem perder o que foi digitado", async ({
    page,
  }) => {
    await fazerLogin(page);

    const textoGigante = "a".repeat(10_001);
    const caixa = page.getByTestId("anotacoes-caixa");
    await caixa.fill(textoGigante);

    await expect(page.getByTestId("anotacoes-indicador")).toContainText(/caracteres/i, {
      timeout: 5000,
    });
    await expect(caixa).toHaveValue(textoGigante);
  });

  // Caso (h): a caixa tem fonte de ao menos 16px (senão o iOS dá zoom ao focar).
  test("a caixa de anotações tem fonte de ao menos 16px", async ({ page }) => {
    await fazerLogin(page);

    const tamanhoDaFonte = await page
      .getByTestId("anotacoes-caixa")
      .evaluate((elemento) => parseFloat(getComputedStyle(elemento).fontSize));
    expect(tamanhoDaFonte).toBeGreaterThanOrEqual(16);
  });

  // Caso (h), continuação: os dois botões do aviso de conflito medem ao menos 44px de altura.
  test("os botões do aviso de conflito medem ao menos 44px de altura", async ({ browser }) => {
    const { contextoB, paginaB } = await provocarConflito(
      browser,
      nomeUnico("Recado para medir os botões do aviso"),
    );

    try {
      const caixaManterOMeu = await paginaB.getByTestId("anotacoes-manter-o-meu").boundingBox();
      const caixaVerODela = await paginaB.getByTestId("anotacoes-ver-o-dela").boundingBox();
      expect(caixaManterOMeu?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(caixaVerODela?.height ?? 0).toBeGreaterThanOrEqual(44);
    } finally {
      await contextoB.close();
    }
  });
});

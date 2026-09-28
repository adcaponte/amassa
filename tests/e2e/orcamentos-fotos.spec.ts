import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

// A grade de fotos do editor do orçamento (04.5-10-PLAN.md): upload, a rota autenticada, tipo
// real, limite de 3, remoção com confirmação. Nomes inventados e únicos por execução ("[e2e]
// ... {sufixo}") — nenhuma foto real entra no teste, nenhum dado real do ateliê; o repositório
// é público. As imagens são geradas pelo próprio `sharp` (já dependência do projeto), sem
// nenhum arquivo binário novo versionado além do fixture sintético da Tarefa 2.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

// Cria um orçamento novo a partir da lista e devolve o id (mesmo molde de
// `tests/e2e/orcamentos-editor.spec.ts::criarOrcamento`, redeclarado aqui — cada spec deste
// projeto tem sua própria cópia dos helpers, nunca um módulo compartilhado).
async function criarOrcamento(page: Page): Promise<string> {
  await page.goto("/gestao/financeiro?aba=orcamentos");
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=orcamentos&orcamento=/, { timeout: 10000 });
  const url = new URL(page.url());
  return url.searchParams.get("orcamento") ?? "";
}

// Abre o editor de um orçamento já existente e espera a hidratação assentar antes de devolver o
// controle ao teste. `page.goto` resolve assim que o HTML do servidor chega — o botão de upload
// já aparece nesse HTML, mas o `onChange` que o torna funcional só existe depois que o React
// hidrata o Client Component (`FotosDeReferencia`). Sob concorrência do servidor único de
// desenvolvimento (a mesma classe de contenção do WINDOWS #12/21/22/29-32/35), essa hidratação
// pode ficar visivelmente atrás da chegada do HTML — interagir cedo demais faz o `setInputFiles`
// "funcionar" (não lança erro) mas o evento nunca chega a um `onChange` que ainda não existe.
// Meio segundo é uma folga generosa e barata perto do custo fixo de ~53s do e2e; nenhuma parte
// do produto depende deste atraso, só o teste.
async function abrirEditorDoOrcamento(page: Page, orcamentoId: string): Promise<void> {
  await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  await page.waitForTimeout(500);
}

async function construirJpegPequeno(cor: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 12, height: 12, channels: 3, background: cor } }).jpeg().toBuffer();
}

test.describe("orcamentos fotos", () => {
  test.describe.configure({ mode: "serial" });

  let orcamentoId = "";

  test("(a)(b) enviar uma imagem: a célula de espera aparece, depois vira a foto de verdade, servida por /gestao/api/orcamentos/fotos/<id> com content-type image/jpeg", async ({
    page,
  }) => {
    await fazerLogin(page);
    orcamentoId = await criarOrcamento(page);
    expect(orcamentoId).not.toBe("");
    await page.waitForTimeout(500); // mesma folga de hidratação de abrirEditorDoOrcamento — aqui a navegação veio de criarOrcamento, não de um goto direto.

    // A grade existe desde o início, mas com zero fotos ela não ocupa espaço nenhum (uma
    // `grid` sem filhos colapsa para 0×0) — por isso a conferência aqui é de presença
    // (`toBeAttached`), não de visibilidade; a visibilidade de verdade é conferida abaixo,
    // depois que a primeira foto existe.
    const grade = page.getByTestId("fotos-grade");
    await expect(grade).toBeAttached();
    await expect(page.getByTestId("fotos-contagem")).toHaveText("0 de 3");

    // O servidor local, com uma imagem de 12×12 e disco local, responde rápido demais para o
    // estado de espera ser observável de forma confiável com um atraso fixo — a forma
    // DETERMINÍSTICA é segurar a requisição de propósito, sem soltar, até o teste já ter visto
    // a célula "Enviando foto…": zero corrida contra o relógio. Em produção, uma foto de até
    // 15 MB pelo celular já demora o bastante para esse estado ser visto sem nenhum artifício.
    let liberarEnvio: (() => void) | null = null;
    const envioLiberado = new Promise<void>((resolve) => {
      liberarEnvio = resolve;
    });
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") {
        await envioLiberado;
      }
      await route.continue();
    });

    const jpeg = await construirJpegPequeno({ r: 200, g: 60, b: 30 });
    const inputDeArquivo = page.getByLabel("adicionar foto de referência");
    await inputDeArquivo.setInputFiles({ name: "referencia.jpg", mimeType: "image/jpeg", buffer: jpeg });

    // A célula de espera aparece na MESMA posição, com o ícone de carregamento — antes de a
    // resposta do servidor chegar (04.5-UI-SPEC.md, ponto 2). A requisição está PRESA (acima)
    // até a linha seguinte soltá-la, então esta afirmação nunca corre contra o relógio.
    await expect(page.getByTestId("foto-enviando")).toBeVisible();
    await expect(page.getByText("Enviando foto…")).toBeVisible();
    liberarEnvio!();

    await expect(page.getByText("Foto de referência anexada.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("fotos-contagem")).toHaveText("1 de 3");
    await expect(page.getByTestId("foto-enviando")).toHaveCount(0);

    const imagem = grade.getByTestId("foto-celula").first().locator("img");
    await expect(imagem).toBeVisible();
    const src = await imagem.getAttribute("src");
    expect(src).toMatch(/^\/gestao\/api\/orcamentos\/fotos\/[0-9a-f-]+$/);

    const resposta = await page.request.get(src!);
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-type"]).toBe("image/jpeg");
  });

  test("(c) a mesma rota, pedida sem sessão, responde 401 e não devolve a imagem", async ({ page, browser }) => {
    await fazerLogin(page);
    await abrirEditorDoOrcamento(page, orcamentoId);

    const imagem = page.getByTestId("fotos-grade").getByTestId("foto-celula").first().locator("img");
    const src = await imagem.getAttribute("src");
    expect(src).toBeTruthy();
    const urlAbsoluta = new URL(src!, page.url()).toString();

    const contextoSemSessao = await browser.newContext();
    try {
      const resposta = await contextoSemSessao.request.get(urlAbsoluta);
      expect(resposta.status()).toBe(401);
      expect(resposta.headers()["content-type"]).not.toContain("image/");
    } finally {
      await contextoSemSessao.close();
    }
  });

  test('(d) um arquivo de texto renomeado para ".jpg" é recusado, e a contagem continua a mesma', async ({ page }) => {
    await fazerLogin(page);
    await abrirEditorDoOrcamento(page, orcamentoId);
    await expect(page.getByTestId("fotos-contagem")).toHaveText("1 de 3");

    const inputDeArquivo = page.getByLabel("adicionar foto de referência");
    await inputDeArquivo.setInputFiles({
      name: "nao-e-imagem.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("isto não é uma imagem, é só um texto qualquer", "utf8"),
    });

    await expect(page.getByText("Esse arquivo não é uma imagem. Escolha uma foto.")).toBeVisible();
    await expect(page.getByTestId("fotos-contagem")).toHaveText("1 de 3");
    await expect(page.getByTestId("fotos-grade").getByTestId("foto-celula")).toHaveCount(1);
  });

  test("(e) enviar até 3: o botão some e a frase do limite aparece", async ({ page }) => {
    await fazerLogin(page);
    await abrirEditorDoOrcamento(page, orcamentoId);

    const inputDeArquivo = page.getByLabel("adicionar foto de referência");
    const cores = [
      { r: 10, g: 200, b: 10 },
      { r: 10, g: 10, b: 200 },
    ];

    // Já existe 1 foto (do teste (a)) — a segunda leva a "2 de 3" (contagem ainda visível, o
    // botão continua); a terceira faz o botão E a contagem desaparecerem juntos, dando lugar à
    // frase do limite — por isso a última iteração espera `fotos-limite`, não `fotos-contagem`
    // (que deixa de existir no DOM, não só de mudar de texto).
    for (const [indice, cor] of cores.entries()) {
      const jpeg = await construirJpegPequeno(cor);
      await inputDeArquivo.setInputFiles({ name: "referencia.jpg", mimeType: "image/jpeg", buffer: jpeg });
      const totalEsperado = indice + 2;
      if (totalEsperado < 3) {
        await expect(page.getByTestId("fotos-contagem")).toHaveText(`${totalEsperado} de 3`, { timeout: 15000 });
      } else {
        await expect(page.getByTestId("fotos-limite")).toBeVisible({ timeout: 15000 });
      }
    }

    await expect(page.getByTestId("fotos-limite")).toHaveText("Limite de 3 fotos atingido. Tire uma para trocar.");
    await expect(page.getByLabel("adicionar foto de referência")).toHaveCount(0);
    await expect(page.getByTestId("fotos-grade").getByTestId("foto-celula")).toHaveCount(3);
  });

  test("(g) a 320px as três células cabem sem rolagem horizontal da página, e todo alvo de toque mede ao menos 44px", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await abrirEditorDoOrcamento(page, orcamentoId);
    await expect(page.getByTestId("fotos-grade").getByTestId("foto-celula")).toHaveCount(3);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `a página rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const alvosDeToque = page.locator("main button, main a, main input[type=file]");
    const contagem = await alvosDeToque.count();
    expect(contagem).toBeGreaterThan(0);
    for (let indice = 0; indice < contagem; indice += 1) {
      const alvo = alvosDeToque.nth(indice);
      if (await alvo.isVisible()) {
        const caixa = await alvo.boundingBox();
        expect(caixa?.height ?? 0, `alvo de toque ${indice} mede menos que 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("(f) 'tirar' pede confirmação nomeando o que se perde e, ao confirmar, a foto sai e a vaga libera", async ({
    page,
  }) => {
    await fazerLogin(page);
    await abrirEditorDoOrcamento(page, orcamentoId);

    const grade = page.getByTestId("fotos-grade");
    await expect(grade.getByTestId("foto-celula")).toHaveCount(3);

    await grade.getByTestId("foto-celula").first().getByTestId("foto-tirar").click();

    const dialogo = page.getByTestId("dialogo-remover-foto");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText("Remover esta foto de referência?");
    await expect(dialogo).toContainText("Ela some do orçamento e do documento do cliente.");

    await dialogo.getByRole("button", { name: "tirar" }).click();
    await expect(page.getByText("Foto removida.")).toBeVisible({ timeout: 10000 });

    await expect(grade.getByTestId("foto-celula")).toHaveCount(2);
    // O limite deixou de estar atingido — o botão de upload volta a existir.
    await expect(page.getByLabel("adicionar foto de referência")).toBeVisible();
    await expect(page.getByTestId("fotos-contagem")).toHaveText("2 de 3");
  });
});

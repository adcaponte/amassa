import { test, expect, type Locator, type Page } from "@playwright/test";

import { hojeNoAtelie } from "./apoio/semear-financeiro";
import {
  idDoForno,
  semearContagem,
  semearForno,
  semearQueimaSemContagem,
  type ContagemParaSemear,
  type TipoQueima,
} from "./apoio/semear-queimas";

// Os Números do forno (QMC-09, QMC-10; 06.4-06-PLAN.md, Tarefa 1). Os números são POR FORNO (D-01):
// cada teste semeia um forno de nome único e as queimas e contagens DELE pelo banco — o registro e a
// contagem pela interface já são provados em `queimas-registro`/`queimas-contagem`. Todas as queimas
// ficam ao meio-dia de HOJE em Brasília (`hojeNoAtelie()`, nunca o dia UTC), para “neste mês” não
// depender da hora em que a suíte roda. Sem etiqueta de vazio: roda em `desktop`/`celular` depois da
// cadeia `vazio-*`.

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

const EMAIL = () => process.env.E2E_EMAIL_TESTE ?? "";

async function semearQueimaContada(
  forno: string,
  tipo: TipoQueima,
  contagem: ContagemParaSemear,
): Promise<void> {
  const id = await semearQueimaSemContagem(forno, EMAIL(), `${hojeNoAtelie()}T12:00:00-03:00`, tipo);
  await semearContagem(id, contagem);
}

// Os `data-testid` de um nível dentro de `escopo`, na ordem do documento — para afirmar a ORDEM.
async function testIdsEmOrdem(escopo: Locator, padrao: RegExp): Promise<string[]> {
  const todos = await escopo
    .locator("[data-testid]")
    .evaluateAll((elementos) => elementos.map((elemento) => elemento.getAttribute("data-testid") ?? ""));
  return todos.filter((testId) => padrao.test(testId));
}

test.describe("números do forno", () => {
  test("quadros por tipo, peças por fornada cheia com o fator medido, o aviso de poucas e o que o forno queimou", async ({
    page,
  }) => {
    const nome = nomeUnico("Forno números");
    await semearForno(nome);
    // Duas biscoito cheias (20 e 30 peças), uma esmalte cheia (15), uma biscoito NÃO cheia (7) e uma de
    // ouro com externas (5) — o ouro e a não cheia ficam fora das médias e entram no resto.
    await semearQueimaContada(nome, "biscoito", { internasP: 10, internasM: 8, internasG: 2 });
    await semearQueimaContada(nome, "biscoito", { internasP: 12, externasP: 4, internasM: 10, internasG: 4 });
    await semearQueimaContada(nome, "esmalte", { internasP: 10, internasM: 5 });
    await semearQueimaContada(nome, "biscoito", { internasP: 7, saiuCheio: false });
    await semearQueimaContada(nome, "ouro", { internasP: 3, externasP: 2 });
    const id = await idDoForno(nome);

    await fazerLogin(page);
    await page.goto(`/gestao/queimas/${id}`);

    const numeros = page.getByTestId("numeros-do-forno");
    await expect(numeros).toBeVisible({ timeout: 15000 });
    await expect(numeros.getByRole("heading", { name: "Números", level: 2 })).toBeVisible();

    // Bloco 1 — desde a última manutenção (sem manutenção: todas), na ordem Biscoito · Esmalte · Ouro ·
    // Todas; “Todas” = o contador do medidor.
    expect(await testIdsEmOrdem(numeros, /^numeros-quadro-[a-z]+$/)).toEqual([
      "numeros-quadro-biscoito",
      "numeros-quadro-esmalte",
      "numeros-quadro-ouro",
      "numeros-quadro-todas",
    ]);
    await expect(page.getByTestId("numeros-quadro-biscoito-numero")).toHaveText("3");
    await expect(page.getByTestId("numeros-quadro-esmalte-numero")).toHaveText("1");
    await expect(page.getByTestId("numeros-quadro-ouro-numero")).toHaveText("1");
    await expect(page.getByTestId("numeros-quadro-todas-numero")).toHaveText("5");
    await expect(page.getByTestId("numeros-quadro-todas-sub")).toHaveText("5 neste mês");
    await expect(page.getByTestId("numeros-quadro-biscoito-sub")).toHaveText("3 neste mês");
    await expect(page.getByTestId("medidor-contador")).toContainText("5 / 50");

    // Bloco 2 — só biscoito e esmalte cheios; fator 25 ÷ 15.
    expect(await testIdsEmOrdem(numeros, /^numeros-(media-[a-z]+|fator)$/)).toEqual([
      "numeros-media-biscoito",
      "numeros-media-esmalte",
      "numeros-fator",
    ]);
    await expect(page.getByTestId("numeros-media-biscoito-valor")).toHaveText("25,0 peças");
    await expect(page.getByTestId("numeros-media-biscoito")).toContainText("em média: 13 P · 9 M · 3 G");
    await expect(page.getByTestId("numeros-media-esmalte-valor")).toHaveText("15,0 peças");
    await expect(page.getByTestId("numeros-fator")).toContainText("No biscoito cabem");
    await expect(page.getByTestId("numeros-fator-valor")).toHaveText("1,7× o esmalte");
    await expect(page.getByTestId("numeros-poucas")).toHaveText("Ainda é pouco: 3 fornadas cheias contadas.");
    await expect(numeros.getByText(/fator do biscoito/)).toBeVisible();
    await expect(numeros.getByRole("link", { name: "abrir Parâmetros" })).toHaveAttribute(
      "href",
      "/gestao/cadastros?sub=parametros",
    );

    // Bloco 3 — todas as contagens, cheias ou não, os três tipos: 71 internas e 6 externas.
    const queimou = page.getByTestId("numeros-o-que-queimou");
    await expect(queimou).toContainText("desde a primeira contagem · 5 fornadas contadas");
    expect(await testIdsEmOrdem(queimou, /^numeros-(internas|externas)$/)).toEqual([
      "numeros-internas",
      "numeros-externas",
    ]);
    await expect(page.getByTestId("numeros-internas-valor")).toHaveText("71 · 92,2%");
    await expect(page.getByTestId("numeros-internas")).toContainText("42 P · 23 M · 6 G");
    await expect(page.getByTestId("numeros-externas-valor")).toHaveText("6 · 7,8%");
    await expect(page.getByTestId("numeros-externas")).toContainText("6 P · 0 M · 0 G");
    await expect(page.getByTestId("numeros-vazio")).toHaveCount(0);
    await expect(page.getByTestId("numeros-erro")).toHaveCount(0);
  });

  test("forno sem nada: quadros em 0, “nenhuma neste mês” e o vazio dos blocos 2 e 3", async ({ page }) => {
    const nome = nomeUnico("Forno números vazio");
    await semearForno(nome);
    const id = await idDoForno(nome);

    await fazerLogin(page);
    await page.goto(`/gestao/queimas/${id}`);

    const numeros = page.getByTestId("numeros-do-forno");
    await expect(numeros).toBeVisible({ timeout: 15000 });
    for (const chave of ["biscoito", "esmalte", "ouro", "todas"]) {
      await expect(page.getByTestId(`numeros-quadro-${chave}-numero`)).toHaveText("0");
      await expect(page.getByTestId(`numeros-quadro-${chave}-sub`)).toHaveText("nenhuma neste mês");
    }
    const vazio = page.getByTestId("numeros-vazio");
    await expect(vazio).toContainText("Nenhuma fornada contada ainda.");
    await expect(vazio).toContainText("Conte pela folha que abre depois de “Queimar”, ou por “Contar agora” no Histórico.");
    await expect(page.getByTestId("numeros-o-que-queimou")).toHaveCount(0);
    await expect(page.getByTestId("numeros-poucas")).toHaveCount(0);
    await expect(page.getByTestId("numeros-fator")).toHaveCount(0);
  });
});

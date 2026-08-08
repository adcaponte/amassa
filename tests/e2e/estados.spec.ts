import { test, expect, type Page } from "@playwright/test";

// Cobre UI-07 (404 em linguagem humana que sabe voltar) e as mitigações de Information
// Disclosure T-02b-09/T-02b-12/T-02b-01 do 02b-04-PLAN.md. Roda nos dois projetos (desktop e
// celular).
//
// Achado em execução real (servidor de produção, login de verdade, navegação real — não
// presumido, como o próprio plano pede): para QUALQUER URL que não case com rota nenhuma do
// sistema — inclusive uma sub-rota de um módulo que existe, como `/encomendas/algo-que-nao-
// existe` — é sempre `app/not-found.tsx` (a raiz, FORA do grupo `(app)`) quem responde, nunca
// `app/(app)/not-found.tsx`. O Next.js só entra na árvore de layout de um segmento depois de
// casar a URL com uma rota definida dentro dele; uma URL sem casamento nenhum não "entra" no
// grupo `(app)` para herdar o layout dele — comportamento documentado do App Router, verificado
// aqui logando com uma conta real e visitando duas formas de URL inexistente antes de escrever
// este arquivo (ver 02b-04-SUMMARY.md, seção Deviations).
//
// Consequência direta, e é o que os dois primeiros casos abaixo provam: o 404 alcançável por
// URL fica FORA da casca — sem barra lateral, sem barra inferior. Isso é correto, não um
// defeito: T-02b-01 exige exatamente isso, para o arquivo de raiz nunca poder vazar dado de
// sessão nem dar pista de que rotas internas existem. O arquivo aninhado
// (`app/(app)/not-found.tsx`) fica pronto para quando uma página futura chamar a função
// `notFound()` de dentro do grupo (ex.: `/encomendas/[id]` na Fase 3) — não há rota dinâmica
// nesta fase que dispare isso, então ele não é alcançável por nenhuma URL hoje, e não há como
// prová-lo por e2e sem instrumentar uma rota que quebra de propósito só para o teste — o que a
// Tarefa 3 do plano proíbe explicitamente para `error.tsx`, e a mesma razão vale aqui.
async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("404 e estado de erro (UI-07)", () => {
  // Mesma prudência de carga de casca.spec.ts/autenticacao.spec.ts/sessao.spec.ts — cada teste
  // faz login, uma conferência real de hash argon2id.
  test.describe.configure({ mode: "serial" });

  test("uma URL inexistente com sessão válida mostra o 404 e o link volta para o painel (UI-07)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/rota-que-nao-existe-2b");

    await expect(
      page.getByRole("heading", { name: "Esta página não existe.", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Verifique o endereço ou volte para o painel.")).toBeVisible();

    const link = page.getByRole("link", { name: "Voltar para o painel" });
    await expect(link).toHaveAttribute("href", "/");
    await link.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("o 404 de uma URL inexistente não expõe a casca de navegação — fica fora do grupo protegido (T-02b-01)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/rota-que-nao-existe-2b");

    // toHaveCount(0), não isVisible()/hidden: a ausência aqui é estrutural (o layout do grupo
    // (app) nunca chega a rodar para uma URL sem casamento nenhum), não uma questão de CSS
    // escondendo o elemento no breakpoint atual — bem diferente de casca.spec.ts, onde as duas
    // navegações SEMPRE coexistem no DOM e só o CSS decide qual fica visível.
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
    await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  });

  test("o 404 não vaza nenhum detalhe técnico no corpo da página", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/rota-que-nao-existe-2b");

    // A copy é fixa e humana; esta asserção existe para pegar o dia em que alguém "melhorar"
    // a tela mostrando o erro real, a pilha de chamadas ou o digest do Next.js.
    const corpo = await page.locator("body").innerText();
    expect(corpo).not.toMatch(/error/i);
    expect(corpo).not.toMatch(/stack/i);
    expect(corpo).not.toMatch(/digest/i);
    expect(corpo).not.toMatch(/at .+:\d+:\d+/);
  });
});

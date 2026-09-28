import { test, expect } from "@playwright/test";

// Cobre UI-07 (404 em linguagem humana que sabe voltar) e as mitigações de Information
// Disclosure T-02b-09/T-02b-12/T-02b-01 do 02b-04-PLAN.md. Roda nos dois projetos (desktop e
// celular).
//
// Fase 04.6 (D-03/D-21, GES-06): a mudança de rotas reabriu o que este arquivo prova. Antes, TODA
// URL sem casamento — mesmo autenticado — caía em `app/not-found.tsx` (a raiz, sem casca),
// porque o App Router só entra na árvore de layout de um segmento depois de casar a URL com uma
// rota definida dentro dele; não havia nenhum caminho para o 404 aninhado
// (`app/(app)/not-found.tsx`, hoje `app/gestao/(app)/not-found.tsx`) ser alcançado. Isso mudou:
// `app/gestao/(app)/[...naoEncontrado]/page.tsx` (Tarefa 1) chama `notFound()` de DENTRO do
// grupo protegido para QUALQUER caminho sem casamento sob `/gestao`, então agora existem DOIS
// 404 com públicos diferentes:
//   - uma URL fora de `/gestao` (este arquivo) continua caindo no 404 PÚBLICO, sem casca, sem
//     sessão — T-02b-01 continua valendo, e agora vale duplamente: é o 404 que qualquer
//     visitante da internet pode ver, sem precisar estar logado para provar isso;
//   - uma URL sob `/gestao` sem casamento (`tests/e2e/rotas.spec.ts`, caso i) cai no 404 COM
//     casca — o oposto do que valia antes desta fase, quando o 404 aninhado nunca era alcançável.
test.describe("404 e estado de erro (UI-07)", () => {
  test("uma URL pública inexistente mostra o 404 público, sem sessão, e o link volta para a página inicial (UI-07/GES-06)", async ({
    page,
  }) => {
    // Sem login de propósito: este 404 é público (T-02b-01) — provar que ele funciona SEM
    // sessão é o próprio ponto, não um detalhe de execução que sobrou de antes desta fase.
    await page.goto("/rota-que-nao-existe-2b");

    await expect(
      page.getByRole("heading", { name: "Esta página não existe.", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Verifique o endereço e tente de novo.")).toBeVisible();
    await expect(page.getByTestId("quatro-cento-e-quatro-publico")).toBeVisible();

    const link = page.getByRole("link", { name: "Voltar para a página inicial" });
    await expect(link).toHaveAttribute("href", "/");
  });

  test("o 404 público não menciona painel, plataforma ou /gestao (D-03/T-02b-02)", async ({
    page,
  }) => {
    await page.goto("/rota-que-nao-existe-2b");

    const corpo = await page.locator("body").innerText();
    expect(corpo.toLowerCase()).not.toMatch(/painel|plataforma|gest[aã]o/);
  });

  test("o 404 de uma URL pública inexistente não expõe a casca de navegação — fica fora do grupo protegido (T-02b-01)", async ({
    page,
  }) => {
    await page.goto("/rota-que-nao-existe-2b");

    // toHaveCount(0), não isVisible()/hidden: a ausência aqui é estrutural (o layout do grupo
    // protegido nunca chega a rodar para uma URL fora de `/gestao`), não uma questão de CSS
    // escondendo o elemento no breakpoint atual.
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
    await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  });

  test("o 404 público não vaza nenhum detalhe técnico no corpo da página", async ({ page }) => {
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

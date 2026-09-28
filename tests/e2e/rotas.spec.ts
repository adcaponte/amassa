import { test, expect, type Page } from "@playwright/test";

// Fase 04.6, plano 01 (Tarefa 3) — a prova de ponta a ponta da mudança mais arriscada da fase: a
// plataforma inteira desceu para `/gestao`, o proxy passou a proteger só esse prefixo, os 13
// endereços antigos redirecionam, e os dois 404 têm públicos diferentes. Nenhum caso aqui cria
// dado — só leitura de rota, sessão e cabeçalho — por isso nenhum precisa da cadeia `vazio-*`
// nem da etiqueta `@vazio-global`.
//
// Orçamento de e2e (CLAUDE.md): esta é a ÚNICA invocação de `npm run test:e2e` autorizada neste
// plano, com `--grep "rotas /gestao"`. A varredura completa é do plano 02.
async function fazerLogin(page: Page): Promise<void> {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

test.describe("rotas /gestao", () => {
  test.describe.configure({ mode: "serial" });

  // (a) — GES-01/GES-03: sem sessão, uma página protegida redireciona para o login, sob o
  // prefixo novo.
  test("(a) sem sessão, /gestao/financeiro redireciona para /gestao/login", async ({ page }) => {
    await page.goto("/gestao/financeiro");
    await expect(page).toHaveURL(/\/gestao\/login/);
  });

  // (b) — T-04.6-04: a rota de API autenticada que se mudou para dentro da cerca responde 401
  // em JSON, nunca um redirect de 200 com HTML de login — a regra geral criada em 04.5-10.
  test("(b) sem sessão, GET /gestao/api/orcamentos/fotos/<id> responde 401 em JSON", async ({
    request,
  }) => {
    const resposta = await request.get(
      "/gestao/api/orcamentos/fotos/00000000-0000-4000-8000-000000000000",
      { maxRedirects: 0 },
    );
    expect(resposta.status()).toBe(401);
    expect(resposta.headers()["content-type"]).toContain("application/json");
    const corpo = await resposta.json();
    expect(corpo.erro).toBeTruthy();
  });

  // (c) — D-01/D-21: os endereços antigos redirecionam, sempre com um código TEMPORÁRIO (nunca
  // 301/302 permanente), para o mesmo caminho sob `/gestao`. `/encomendas/<id>` preserva o
  // segmento dinâmico.
  test("(c) os endereços antigos redirecionam com código temporário para /gestao/...", async ({
    request,
  }) => {
    const casos = [
      { antigo: "/encomendas", novo: "/gestao/encomendas" },
      { antigo: "/financeiro", novo: "/gestao/financeiro" },
      { antigo: "/queimas/relatorios", novo: "/gestao/queimas/relatorios" },
      { antigo: "/login", novo: "/gestao/login" },
    ];

    for (const { antigo, novo } of casos) {
      const resposta = await request.get(antigo, { maxRedirects: 0 });
      expect([307, 308], `${antigo} deveria responder 307 ou 308`).toContain(resposta.status());
      // Nunca 301/302 (permanente) — D-01: um 301 sobreviveria em cache além da data de
      // remoção do redirecionamento.
      expect(resposta.status()).not.toBe(301);
      expect(resposta.status()).not.toBe(302);
      const local = resposta.headers()["location"] ?? "";
      expect(local.endsWith(novo) || local.includes(novo)).toBe(true);
    }

    const idQualquer = "11111111-1111-4111-8111-111111111111";
    const respostaComId = await request.get(`/encomendas/${idQualquer}`, { maxRedirects: 0 });
    expect([307, 308]).toContain(respostaComId.status());
    const localComId = respostaComId.headers()["location"] ?? "";
    expect(localComId).toContain(`/gestao/encomendas/${idQualquer}`);
  });

  // (d) — GES-02, aresta empty: a query string sobrevive ao redirecionamento.
  test("(d) /encomendas?nova=1 chega a /gestao/encomendas com a query preservada", async ({
    request,
  }) => {
    const resposta = await request.get("/encomendas?nova=1", { maxRedirects: 0 });
    expect([307, 308]).toContain(resposta.status());
    const local = resposta.headers()["location"] ?? "";
    expect(local).toContain("/gestao/encomendas");
    expect(local).toContain("nova=1");
  });

  // (e) — D-02: `/api/health` fica fora de `/gestao` e nunca é interceptada por redirect —
  // o monitoramento externo aponta para ela.
  test("(e) /api/health responde 200 e não redireciona", async ({ request }) => {
    const resposta = await request.get("/api/health", { maxRedirects: 0 });
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["location"]).toBeUndefined();
  });

  // (f) — GES-01, arestas empty/adjacency: `/gestao` exato e `/gestao/` com barra final levam
  // à MESMA tela, com sessão.
  test("(f) /gestao exato e /gestao/ com barra final levam à mesma tela (com sessão)", async ({
    page,
  }) => {
    await fazerLogin(page);

    await page.goto("/gestao");
    await expect(page.getByRole("heading", { name: /^Olá, / })).toBeVisible();

    await page.goto("/gestao/");
    await expect(page.getByRole("heading", { name: /^Olá, / })).toBeVisible();
  });

  // (g) — GES-01, aresta adjacency: `/gestaoqualquercoisa` NÃO é uma sub-rota da plataforma —
  // um prefixo de texto solto não é `/gestao/...`, então não redireciona para login e cai no
  // 404 público.
  test("(g) /gestaoqualquercoisa não é tratada como rota da plataforma", async ({ request }) => {
    const resposta = await request.get("/gestaoqualquercoisa", { maxRedirects: 0 });
    const eRedirecionamento = resposta.status() >= 300 && resposta.status() < 400;
    expect(eRedirecionamento, "não deveria redirecionar para /gestao/login").toBe(false);
    expect(resposta.headers()["location"]).toBeUndefined();
    expect(resposta.status()).toBe(404);
  });

  // (h) — GES-01, aresta ordering: segmento estático vence o catch-all. `/gestao/login`
  // resolve para a tela de login, nunca para `[...naoEncontrado]`.
  test("(h) /gestao/login resolve para a tela de login, não para o catch-all de 404", async ({
    page,
    request,
  }) => {
    const resposta = await request.get("/gestao/login", { maxRedirects: 0 });
    expect(resposta.status()).toBe(200);

    await page.goto("/gestao/login");
    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();
    await expect(page.getByTestId("quatro-cento-e-quatro-gestao")).toHaveCount(0);
  });

  // (i) — GES-06: os dois 404 têm públicos diferentes. Sob `/gestao`, o catch-all preserva a
  // casca; fora de `/gestao`, o 404 é público e não convida para a plataforma.
  test("(i) /gestao/inexistente mostra o 404 com casca; /inexistente mostra o 404 público, sem link para /gestao", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/inexistente");
    await expect(page.getByTestId("quatro-cento-e-quatro-gestao")).toBeVisible();

    await page.goto("/inexistente");
    await expect(page.getByTestId("quatro-cento-e-quatro-publico")).toBeVisible();
    const linkParaGestao = page.locator('a[href^="/gestao"]');
    await expect(linkParaGestao).toHaveCount(0);
  });

  // (j) — D-04/GES-05: `robots.txt` bloqueia `/gestao` e não bloqueia a raiz.
  test("(j) GET /robots.txt bloqueia /gestao e não bloqueia a raiz", async ({ request }) => {
    const resposta = await request.get("/robots.txt");
    expect(resposta.status()).toBe(200);
    const corpo = await resposta.text();
    expect(corpo).toMatch(/Disallow:\s*\/gestao/);
    expect(corpo).not.toMatch(/Disallow:\s*\/\s*$/m);
  });

  // (k) — D-04/GES-05: toda tela da plataforma traz `noindex` herdado de `app/gestao/layout.tsx`.
  test("(k) a tela de /gestao/financeiro traz noindex na meta de robôs", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/financeiro");

    const metaRobots = page.locator('meta[name="robots"]');
    await expect(metaRobots).toHaveAttribute("content", /noindex/);
  });

  // (l) — T-04.6-03: o ciclo completo entrar/sair sob o prefixo novo — a prova LOCAL do que o
  // plano 08 confere em produção (GES-04, 🔴 fora do escopo deste plano).
  test("(l) o ciclo completo: entrar por /gestao/login, chegar em /gestao, sair, e voltar para /gestao/login", async ({
    page,
  }) => {
    await fazerLogin(page);
    await expect(page).toHaveURL(/\/gestao$/);

    const gatilhoCelular = page.getByRole("button", { name: "Abrir menu do usuário" });
    const gatilhoDesktop = page.locator('[data-slot="sidebar-footer"] button').first();
    if (await gatilhoCelular.isVisible()) {
      await gatilhoCelular.click();
    } else {
      await gatilhoDesktop.click();
    }
    await page.getByRole("button", { name: "Sair" }).click();

    await expect(page).toHaveURL(/\/gestao\/login(\?|$)/);
  });
});

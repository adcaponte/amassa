import { test, expect } from "@playwright/test";

import { FRASE_NO_AR } from "@/app/frase-no-ar";

// Cobre os dois únicos pedaços da fundação que existem nesta fase: a página mínima da marca
// (D-12/D-13) e /api/health. O segundo caso é o que dá sentido ao banco de teste separado —
// sem ele, o E2E nunca tocaria no Postgres e o serviço `postgres_teste` seria decoração.
// Roda nos dois projetos (desktop e celular) declarados em playwright.config.ts.
test.describe("fundação", () => {
  test("a página inicial responde e mostra o nome e a frase no ar", async ({ page }) => {
    const resposta = await page.goto("/");
    expect(resposta?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();
    // Importa a constante em vez de repetir o texto: o critério INFRA-02 é "alterar um texto,
    // dar push, e a mudança aparecer sozinha". Com a frase escrita à mão aqui, toda troca de
    // copy quebraria o teste e barraria o próprio deploy que o critério pede para observar.
    await expect(page.getByText(FRASE_NO_AR)).toBeVisible();
  });

  test("/api/health responde 200 com o banco em ordem", async ({ request }) => {
    const resposta = await request.get("/api/health");
    expect(resposta.status()).toBe(200);

    const corpo = await resposta.json();
    expect(corpo.status).toBe("ok");
    expect(corpo.banco).toBe("ok");
  });
});

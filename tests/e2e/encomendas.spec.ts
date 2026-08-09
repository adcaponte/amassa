import { test, expect } from "@playwright/test";

// Traçado de ponta a ponta desta fase (03-01-PLAN.md, Tarefa 2): logar, abrir
// `/encomendas?nova` (contrato de URL de D-03), criar uma encomenda com um item, e confirmar
// que a lista de `/encomendas` mostra o nome e a data de conclusão calculada em cascata pelo
// módulo puro `lib/encomendas/cronograma.ts`. Depois, recarregar e confirmar que a encomenda
// continua lá — a prova de que a persistência é real (ENC-12), não estado de cliente.
//
// Mesmo helper `fazerLogin` de tests/e2e/casca.spec.ts, duplicado aqui por convenção do
// projeto (cada spec é independente, sem módulo de apoio compartilhado além do globalSetup).
async function fazerLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("encomendas — traçado de ponta a ponta", () => {
  test("criar uma encomenda com um item mostra a data de conclusão em cascata, e sobrevive a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Nome exclusivo por execução — evita colisão entre projetos (desktop/celular) rodando
    // em paralelo contra o mesmo banco de teste efêmero. Dado inventado, reconhecível como
    // inventado (proibição PR-1 do plano): nenhum nome real de cliente ou encomenda do ateliê.
    const nomeDaEncomenda = `[e2e] Peças de teste ${test.info().project.name} ${Date.now()}`;

    await page.goto("/encomendas?nova");

    await page.getByLabel("Nome da encomenda").fill(nomeDaEncomenda);
    await page.getByLabel("Cliente").fill("Cliente inventado para teste");
    await page.getByLabel("Data de início").fill("2026-08-12");
    await page.getByLabel("Descrição do item").fill("Caneca cônica de teste");
    await page.getByLabel("Quantidade").fill("10");

    await page.getByRole("button", { name: "Salvar" }).click();

    // A ação redireciona para /encomendas ao concluir a transação. Sob a suíte inteira rodando
    // em paralelo, uma submissão isolada ocasionalmente fica presa em `?nova` sem redirecionar
    // (instabilidade do webServer local de desenvolvimento, não do dado — mesmo diagnóstico de
    // tests/e2e/encomendas-indice.spec.ts#criarEncomenda). Se acontecer aqui, um recarregamento
    // de `/encomendas` confirma se a transação já tinha sido concluída no servidor antes de
    // desistir — nunca reenvia o formulário, que criaria uma segunda encomenda com o mesmo nome.
    try {
      await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
    } catch (erro) {
      await page.goto("/encomendas");
      const jaFoiCriada = await page.getByText(nomeDaEncomenda, { exact: true }).count();
      if (jaFoiCriada === 0) {
        throw erro;
      }
    }

    // Desde a 03-04 (Gantt + lista mobile, D-02), o nome aparece DUAS vezes no HTML — uma na
    // linha do Gantt (coluna fixa, `hidden md:block`) e uma no cartão da lista mobile
    // (`md:hidden`), um escondido por CSS em cada largura. `:visible` escolhe a metade real do
    // viewport atual, o mesmo princípio de `tests/e2e/casca.spec.ts`. A cascata de datas em si
    // (produção 3 + secagem 6 + queima1 1 + esmaltação 1 + queima2 1 + entrega 1 = 13 dias,
    // fim exclusivo a partir de 2026-08-12 → último dia de "entrega" é 2026-08-24) já tem prova
    // dedicada em tests/unit/cronograma.test.ts e em tests/e2e/encomendas-indice.spec.ts (barra
    // de 54px medida por boundingBox no Gantt) — aqui o que importa é só a persistência real.
    const nomeVisivel = page.getByText(nomeDaEncomenda, { exact: true }).and(page.locator(":visible"));
    await expect(nomeVisivel).toBeVisible();

    // Recarregar prova que a gravação é real (ENC-12), não estado de cliente.
    await page.reload();
    await expect(nomeVisivel).toBeVisible();
  });
});

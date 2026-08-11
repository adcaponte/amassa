import { test, expect, type Locator, type Page } from "@playwright/test";

// FOR-04 na tela: as três fronteiras do medidor/selo (ok sem selo, atenção em "Manutenção
// próxima", crítico em "Manutenção vencida" com o ícone) e o rodapé sem manutenção registrada —
// 04-02-PLAN.md, Tarefa 3. Sem etiqueta de vazio: cria dado, roda em `desktop`/`celular` depois
// da cadeia `vazio-*` (playwright.config.ts).
//
// Fronteira preparada com um forno de LIMITE 10 (não 100): o piso `Math.max(1, limite - 10)` de
// `lib/queimas/contador.ts` faz `atencao = 1` neste caso — a mesma regra de fronteira que
// `tests/unit/contador.test.ts` já prova numericamente para 89/90/99/100/101, só que alcançável
// aqui com 10 registros em vez de 100. As 10 queimas são registradas por um LAÇO de toques reais
// na interface (dois toques por vez, a mesma Server Action `registrarQueima` do fluxo de
// produção) — nunca por SQL direto no teste.

// `retries: 2` mesmo fora do CI (que já usa 2 por padrão, `playwright.config.ts`): este teste é
// o mais pesado da suíte (dez registros seguidos, dois toques cada) e o servidor Next é ÚNICO,
// compartilhado por todos os workers/projetos rodando em paralelo — sob carga alta local, uma
// tentativa pode esbarrar em lentidão transitória do servidor compartilhado sem que o
// comportamento em si esteja errado (achado real desta tarefa, documentado no SUMMARY).
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

// Um registro completo (dois toques). `force: true`: dez registros seguidos empilham dez toasts
// de 7s cada (posição padrão do `sonner`, canto inferior direito), que podem cobrir o botão
// "Queimar" do cartão dependendo de onde ele cai na grade — o clique forçado é o mesmo tap real
// do usuário, só sem a checagem de sobreposição do Playwright, que este teste de fronteira não
// precisa exercitar (a ausência de bloqueio pelo toast já está coberta por
// `tests/e2e/queimas-registro.spec.ts`).
//
// O portão para o PRÓXIMO toque é o botão "Queimar" reaparecer (o componente zera `pendente`
// assim que o servidor confirma, antes de `router.refresh()` terminar) — não o contador do
// medidor refletir a mudança, que depende de `revalidatePath`/`router.refresh()` completarem
// contra o mesmo servidor Next único que os outros workers/projetos da suíte também usam ao
// mesmo tempo. As afirmações de VALOR do contador ficam nos pontos de checagem do teste, com
// timeout próprio e mais generoso.
async function registrarQueima(cartao: Locator): Promise<void> {
  // `scrollIntoViewIfNeeded` primeiro: `force: true` pula a checagem de visibilidade/estabilidade
  // do Playwright, mas NÃO rola a página sozinho — sem isto, num índice com muitos fornos
  // acumulados de execuções anteriores da suíte, o cartão deste teste pode estar fora do
  // viewport no desktop, e o clique forçado nunca alcançaria o botão de verdade.
  await cartao.scrollIntoViewIfNeeded();
  await cartao.getByRole("button", { name: "Queimar" }).click({ force: true });
  await cartao.getByTestId("tipo-queima-biscoito").click({ force: true });
  await expect(cartao.getByRole("button", { name: "Queimar" })).toBeVisible({ timeout: 10000 });
}

test("cartão do forno: nível ok sem selo, 'Manutenção próxima' no limiar, 'Manutenção vencida' no limite, e o rodapé sem manutenção", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await fazerLogin(page);
  const nome = nomeUnico("Forno fronteira");
  await cadastrarForno(page, nome, 10);

  const cartao = cartaoDoForno(page, nome);
  await expect(cartao).toBeVisible();

  // 0/10 — nível ok, nenhum selo. O medidor sempre renderiza os três rótulos, mesmo em ok.
  await expect(cartao.getByTestId("medidor-contador")).toContainText("0 / 10");
  await expect(cartao.locator('[data-testid^="selo-forno-"]')).toHaveCount(0);
  await expect(cartao.getByTestId("medidor-rotulo-zero")).toHaveText("0");
  await expect(cartao.getByTestId("medidor-rotulo-atencao")).toContainText("atenção");
  await expect(cartao.getByTestId("medidor-rotulo-limite")).toContainText("limite");

  // 1/10 — contador (1) >= limiar (Math.max(1, 10 - 10) = 1): atenção, "Manutenção próxima".
  await registrarQueima(cartao);
  await expect(cartao.getByTestId("medidor-contador")).toContainText("1 / 10", { timeout: 15000 });
  await expect(cartao.locator('[data-testid^="selo-forno-"]')).toContainText("Manutenção próxima");

  // 2..8 — avança até a véspera do limite, sem reasserção de contador/selo a cada passo (o
  // portão de cada toque já é o próprio botão "Queimar" reaparecer, ver `registrarQueima`).
  for (let contador = 2; contador <= 8; contador++) {
    await registrarQueima(cartao);
  }

  // 9/10 — ainda atenção; a mesma fronteira que tests/unit/contador.test.ts prova para 99/100.
  await registrarQueima(cartao);
  await expect(cartao.getByTestId("medidor-contador")).toContainText("9 / 10", { timeout: 15000 });
  await expect(cartao.locator('[data-testid^="selo-forno-"]')).toContainText("Manutenção próxima");

  // 10/10 — crítico, "Manutenção vencida" com o ícone de alerta ao lado do texto.
  await registrarQueima(cartao);
  await expect(cartao.getByTestId("medidor-contador")).toContainText("10 / 10", { timeout: 15000 });
  await expect(cartao.locator('[data-testid^="selo-forno-"]')).toContainText("Manutenção vencida");
  await expect(cartao.locator('[data-testid^="selo-forno-"] svg')).toBeVisible();

  // Rodapé: forno sem manutenção registrada, contador igual ao total.
  await expect(cartao.getByText("Sem manutenção registrada")).toBeVisible();
  await expect(cartao.getByText("10 no total")).toBeVisible();
});

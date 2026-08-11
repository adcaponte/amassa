import { test, expect, type Locator, type Page } from "@playwright/test";

import { semearQueimas } from "./apoio/semear-queimas";

// FOR-04 na tela: as três fronteiras do medidor/selo (ok sem selo, atenção em "Manutenção
// próxima", crítico em "Manutenção vencida" com o ícone) e o rodapé sem manutenção registrada —
// 04-02-PLAN.md, Tarefa 3. Sem etiqueta de vazio: cria dado, roda em `desktop`/`celular` depois
// da cadeia `vazio-*` (playwright.config.ts).
//
// Fronteira preparada com um forno de LIMITE 10, o menor que o sistema aceita: `medirForno`
// recusa `limite < 10` e `limiarDeAtencao(10)` é `Math.max(1, 10 - 10) = 1`
// (`lib/queimas/contador.ts`). Com isso o forno atravessa `ok → atenção` na PRIMEIRA queima e
// `atenção → crítico` na DÉCIMA. Não existe "um limite menor" para encurtar isso.
//
// O que este teste prova, e o que ele deliberadamente não prova. A aritmética da fronteira
// (89/90/91, 99/100/101 contra um limite configurável) já é provada de forma determinística, sem
// servidor e sem navegador, por `tests/unit/contador.test.ts`. O trabalho DAQUI é a FIAÇÃO: que
// um forno em nível de atenção renderiza "Manutenção próxima" e que no limite renderiza
// "Manutenção vencida" com o ícone. Por isso as duas TRAVESSIAS de fronteira continuam sendo
// toques reais na interface — a mesma Server Action `registrarQueima` do fluxo de produção — e
// só o ENCHIMENTO entre elas (oito queimas de fundo, sobre as quais nenhuma asserção fala) entra
// por `apoio/semear-queimas.ts`.
//
// Antes eram dez toques reais em laço, VEZES os dois projetos: vinte idas e voltas de Server
// Action com `revalidatePath` + `router.refresh()` a cada uma, contra o servidor Next único que
// a suíte inteira compartilha. Era a spec mais pesada da suíte, e a carga transbordava para
// testes vizinhos, que passavam a falhar por lentidão sem ter defeito nenhum. Agora são dois
// toques por projeto, e nenhuma das três asserções de nível saiu do arquivo.
//
// Sem `test.describe.configure` de espécie alguma: o arquivo tem um único teste, então
// `mode: "serial"` seria decorativo, e `retries` fica com `playwright.config.ts:30`, que usa 0
// fora do CI de propósito — retentativa que só existe na máquina de quem desenvolve envelhece
// calada e esconde o primeiro defeito de lógica de verdade que aparecer.

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

// Um registro completo (dois toques). Sem `force: true`: o clique forçado existia porque dez
// registros seguidos empilhavam dez toasts de 7s (canto inferior direito, padrão do `sonner`)
// que podiam cobrir o botão "Queimar". Com dois toques separados por um recarregamento — que
// limpa os toasts — não há pilha nenhuma, e o clique volta a ser o clique de verdade, com a
// checagem de sobreposição do Playwright valendo. `scrollIntoViewIfNeeded` continua: o índice
// acumula fornos das outras specs, e o cartão deste teste pode cair fora do viewport.
async function registrarQueima(cartao: Locator): Promise<void> {
  await cartao.scrollIntoViewIfNeeded();
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId("tipo-queima-biscoito").click();
}

test("cartão do forno: nível ok sem selo, 'Manutenção próxima' no limiar, 'Manutenção vencida' no limite, e o rodapé sem manutenção", async ({
  page,
}) => {
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

  // TRAVESSIA 1, por toque real — 1/10: contador (1) >= limiar (1). O forno entra em atenção e o
  // selo "Manutenção próxima" passa a existir.
  await registrarQueima(cartao);
  await expect(cartao.getByTestId("medidor-contador")).toContainText("1 / 10", { timeout: 15000 });
  await expect(cartao.locator('[data-testid^="selo-forno-"]')).toContainText("Manutenção próxima");

  // Enchimento: 2..9 pelo banco. O que importa é o forno chegar à véspera do limite AINDA em
  // atenção — a mesma fronteira que `tests/unit/contador.test.ts` prova para 99/100.
  await semearQueimas(nome, 8, process.env.E2E_EMAIL_TESTE ?? "");
  await page.reload();
  const cartaoCheio = cartaoDoForno(page, nome);
  await expect(cartaoCheio.getByTestId("medidor-contador")).toContainText("9 / 10", {
    timeout: 15000,
  });
  await expect(cartaoCheio.locator('[data-testid^="selo-forno-"]')).toContainText(
    "Manutenção próxima",
  );

  // TRAVESSIA 2, por toque real — 10/10: crítico, "Manutenção vencida" com o ícone de alerta ao
  // lado do texto.
  await registrarQueima(cartaoCheio);
  await expect(cartaoCheio.getByTestId("medidor-contador")).toContainText("10 / 10", {
    timeout: 15000,
  });
  await expect(cartaoCheio.locator('[data-testid^="selo-forno-"]')).toContainText(
    "Manutenção vencida",
  );
  await expect(cartaoCheio.locator('[data-testid^="selo-forno-"] svg')).toBeVisible();

  // Rodapé: forno sem manutenção registrada, contador igual ao total.
  await expect(cartaoCheio.getByText("Sem manutenção registrada")).toBeVisible();
  await expect(cartaoCheio.getByText("10 no total")).toBeVisible();
});

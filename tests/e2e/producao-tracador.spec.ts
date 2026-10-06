import { test, expect, type Page } from "@playwright/test";

import {
  diaEmBrasilia,
  diaMes,
  etapasDaOrdemNoBanco,
  semearOrdem,
} from "./apoio/semear-producao";

// O traçador da Fase 06.1 (plano 01, critério 2 do ROADMAP, PRD-03): uma ordem na Produção,
// "Terminei: Produção", e ela está na Secagem com a data de hoje — pelo caminho inteiro, tela →
// Server Action → `lib/producao/gravacao.ts` (trava da ordem) → módulo puro → banco → consulta →
// tela, sem atalho. Cada teste semeia a PRÓPRIA ordem com sufixo único e a acha pelo
// `data-ordem-id` — nenhuma afirmação global do banco (CLAUDE.md: nunca `--grep` como muleta).
// Nomes inventados com prefixo `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const FRASE_JA_MARCADA =
  "Essa etapa já tinha sido marcada — talvez em outro celular. A tela foi atualizada.";

// Uma ordem da casa, ativa, começada há 3 dias, ainda na Produção, com 12 peças. Desde a Fase 06.5
// (D-02, dono 05/10/2026) o "Terminei" de uma ordem de várias peças só libera com todas passadas:
// `passaramNaAtual` semeia o parcial já cheio quando o teste não é sobre o atalho.
async function semearOrdemNaProducao(
  nome: string,
  passaramNaAtual: number | null = null,
): Promise<string> {
  return semearOrdem({
    nome,
    tipo: "casa",
    caminho: "completo",
    status: "ativa",
    inicio: diaEmBrasilia(-3),
    etapasFeitas: [],
    pecas: [{ descricao: "[e2e] Caneca de prova", quantidade: 12 }],
    passaramNaAtual,
  });
}

function cartaoNaColuna(page: Page, etapa: string, ordemId: string) {
  return page
    .getByTestId(`producao-coluna-${etapa}`)
    .locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`);
}

test.describe("producao tracador", () => {
  test("Terminei: Produção leva a ordem para a Secagem com a data de hoje, e o quadro acompanha", async ({
    page,
  }) => {
    const nome = `[e2e] Canecas ${sufixoUnico()}`;
    const ordemId = await semearOrdemNaProducao(nome);
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    await page.goto("/gestao/producao");

    // Toque 1: o cartão, na seção "Produção".
    const cartao = cartaoNaColuna(page, "producao", ordemId);
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(nome);
    await expect(cartao).toContainText("há 3 dias nesta etapa · previsto 5");
    await cartao.click();
    await expect(page).toHaveURL(new RegExp(`/gestao/producao/${ordemId}$`));
    await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
    await expect(page.getByTestId("ordem-etapa-producao")).toHaveAttribute("data-estado", "atual");

    // Toque 2: "Passaram todas as 12" (D-02/UI-D12, Fase 06.5 — com 12 peças e o parcial vazio, o
    // "Terminei" espera). Toque 3: "Terminei: Produção" — sem confirmação, sem campo.
    const terminei = page.getByTestId("ordem-terminei");
    await expect(terminei).toHaveText("Terminei: Produção");
    await expect(terminei).toBeDisabled();
    await page.getByTestId("passaram-todas").click();
    await expect(terminei).toBeEnabled();
    await terminei.click();

    await expect(page.getByText("Feito: Produção. Agora: Secagem.")).toBeVisible();
    await expect(page.getByTestId("ordem-etapa-producao")).toHaveAttribute("data-estado", "feita");
    await expect(page.getByTestId("ordem-etapa-producao")).toContainText(
      `feita em ${diaMes(hoje)}`,
    );
    await expect(page.getByTestId("ordem-etapa-secagem")).toHaveAttribute("data-estado", "atual");
    await expect(terminei).toHaveText("Terminei: Secagem");

    // O banco: `feita_em` = hoje (Brasília, decidido no servidor) na produção, e só nela.
    const etapas = await etapasDaOrdemNoBanco(ordemId);
    expect(etapas.map((etapa) => [etapa.etapa, etapa.feitaEm])).toEqual([
      ["producao", hoje],
      ["secagem", null],
      ["queima1", null],
      ["esmaltacao", null],
      ["queima2", null],
      ["entrega", null],
    ]);

    // De volta ao quadro: o cartão está na seção "Secagem", e não mais na "Produção".
    await page.getByTestId("voltar-pagina").click();
    await expect(page).toHaveURL(/\/gestao\/producao$/);
    await expect(cartaoNaColuna(page, "secagem", ordemId)).toBeVisible();
    await expect(cartaoNaColuna(page, "producao", ordemId)).toHaveCount(0);
  });

  test("toque duplo em Terminei marca UMA etapa só", async ({ page }) => {
    const ordemId = await semearOrdemNaProducao(`[e2e] Canecas ${sufixoUnico()}`);
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const terminei = page.getByTestId("ordem-terminei");
    await expect(terminei).toHaveText("Terminei: Produção");
    // D-02 (Fase 06.5): todas as 12 passaram antes — o toque duplo é no "Terminei" já habilitado.
    await page.getByTestId("passaram-todas").click();
    await expect(terminei).toBeEnabled();
    await terminei.dblclick();

    await expect(page.getByText("Feito: Produção. Agora: Secagem.")).toBeVisible();
    await expect(terminei).toHaveText("Terminei: Secagem");

    const etapas = await etapasDaOrdemNoBanco(ordemId);
    expect(etapas.filter((etapa) => etapa.feitaEm !== null)).toEqual([
      expect.objectContaining({ etapa: "producao", feitaEm: hoje }),
    ]);
  });

  test("duas abas na mesma ordem: a segunda recebe “já tinha sido marcada” e nada muda no banco", async ({
    page,
    context,
  }) => {
    // D-02 (Fase 06.5): as 12 já passaram (parcial semeado) — as duas abas abrem com o "Terminei"
    // habilitado, e a recusa da segunda é a de etapa já marcada.
    const ordemId = await semearOrdemNaProducao(`[e2e] Canecas ${sufixoUnico()}`, 12);
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    const outraAba = await context.newPage();
    await page.goto(`/gestao/producao/${ordemId}`);
    await outraAba.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-terminei")).toHaveText("Terminei: Produção");
    await expect(outraAba.getByTestId("ordem-terminei")).toHaveText("Terminei: Produção");

    // Primeira aba marca.
    await page.getByTestId("ordem-terminei").click();
    await expect(page.getByText("Feito: Produção. Agora: Secagem.")).toBeVisible();

    // A segunda ainda mostra "Terminei: Produção" (etapa esperada velha) e toca.
    await outraAba.getByTestId("ordem-terminei").click();
    await expect(outraAba.getByTestId("ordem-terminei-erro")).toHaveText(FRASE_JA_MARCADA);
    // A tela da segunda aba foi atualizada.
    await expect(outraAba.getByTestId("ordem-terminei")).toHaveText("Terminei: Secagem");
    await expect(outraAba.getByTestId("ordem-etapa-secagem")).toHaveAttribute(
      "data-estado",
      "atual",
    );

    // Nada gravado duas vezes: só a produção, com a data de hoje.
    const etapas = await etapasDaOrdemNoBanco(ordemId);
    expect(etapas.filter((etapa) => etapa.feitaEm !== null)).toEqual([
      expect.objectContaining({ etapa: "producao", feitaEm: hoje }),
    ]);
    await outraAba.close();
  });
});

import { test, expect, type Page } from "@playwright/test";

import { ROTULO_ABA_RECEBER } from "@/lib/agenda/textos";

import { medirCaixa } from "./apoio/medir-caixa";
import { semearCliente, semearInscricao, semearOficina } from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Fase 06.5, plano 08 (D-12, D-05; achados 16 e 17 do Cowork; POL-05): a Agenda no celular.
// - A aba “Receber” (até 05/10/2026 “A receber”) cabe numa linha a 375 px, com o contador até 99.
// Cada teste cria só o que é dele, com nome único, e nunca afirma estado global do banco — o caso sem
// cobranças (a aba sem contador) é `@vazio-global` e roda na cadeia `vazio-*`, antes de qualquer spec
// criar cobrança.

// Uma aba de uma linha: o `min-h-[44px]` da aba, nunca mais. Duas linhas de `text-corpo` dão 56 px
// (medido antes do conserto do recuo, com “Receber · 20”).
const ALTURA_DE_UMA_LINHA = 44;

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

// A aba visível (o `loading.tsx` também desenha abas; a da página é a que está à vista).
function abaReceber(page: Page) {
  return page.locator(`[data-testid="abas-da-agenda"] >> visible=true`).first().getByTestId("aba-receber");
}

async function alturaDaAba(page: Page): Promise<number> {
  return (await medirCaixa(abaReceber(page), "aba “Receber”")).height;
}

test.describe("polimento agenda — aba", () => {
  test("sem cobranças: “Receber”, sem contador, numa linha a 375 px @vazio-global", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await expect(page.getByTestId("agenda-carregando")).toBeHidden();

    await expect(abaReceber(page)).toHaveText(ROTULO_ABA_RECEBER);
    await expect(abaReceber(page)).toHaveText("Receber");
    expect(await alturaDaAba(page)).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);
  });

  test("com cobranças: “Receber · {N}” numa linha a 375 px, marcada ou não, e ainda numa linha com N = 99", async ({
    page,
  }) => {
    // Uma inscrição cobrada numa oficina longe de qualquer data que outro spec conte.
    const suf = sufixoUnico();
    const projeto = test.info().project.name === "celular" ? 1 : 0;
    const clienteId = await semearCliente({ nome: `[e2e] Pessoa ${suf}` });
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina ${suf}`,
      data: somarDiasAoHoje(1800 + projeto),
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 15000,
    });
    await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 15000 });

    await page.setViewportSize({ width: 375, height: 800 });
    await fazerLogin(page);

    // Desmarcada (peso 500), na semana.
    await page.goto("/gestao/agenda");
    await expect(page.getByTestId("agenda-carregando")).toBeHidden();
    await expect(abaReceber(page)).toHaveText(/^Receber · \d+$/);
    expect(await alturaDaAba(page)).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);

    // Marcada (peso 600, o rótulo mais largo).
    await page.goto("/gestao/agenda?aba=receber");
    await expect(page.getByTestId("a-receber")).toBeVisible();
    await expect(abaReceber(page)).toHaveAttribute("aria-selected", "true");
    await expect(abaReceber(page)).toHaveText(/^Receber · \d+$/);
    expect(await alturaDaAba(page)).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);

    // O pior caso do contador (E10): dois dígitos. O número real é global e não se controla daqui; o
    // texto da aba marcada é trocado no navegador e a caixa é medida de novo — a mesma aba, a mesma
    // classe, o mesmo peso. “44” é o par de dígitos mais largo da Inter (98,0 px, medido); “99” é o teto.
    for (const pior of ["Receber · 44", "Receber · 99"]) {
      await abaReceber(page).evaluate((elemento, texto) => {
        elemento.textContent = texto;
      }, pior);
      await expect(abaReceber(page)).toHaveText(pior);
      expect(await alturaDaAba(page), pior).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);
    }

    // E nenhuma rolagem lateral da página por isso.
    const larguras = await page.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth,
      tela: document.documentElement.clientWidth,
    }));
    expect(larguras.rolagem).toBeLessThanOrEqual(larguras.tela);
  });
});

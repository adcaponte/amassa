import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import {
  destravarLembretesDeTeste,
  lerLembrete,
  limparLembretes,
  semearLembrete,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// Fase 06.5 (Polimento), plano 05 — D-10, POL-03. Os três achados do Cowork nos Lembretes, no
// celular: o aviso com "Desfazer" no topo e por 10 s (um toque atrasado não troca de módulo).
//
// Toda caixa é medida por `medirCaixa` (D-23) — nunca `boundingBox()` direto. Os lembretes semeados
// têm texto inventado, prefixo "[e2e]" e o nome do projeto. Como todo spec `lembretes-*`, cada
// `describe` roda sob a MESMA trava consultiva (`travarLembretesParaTeste`): outro spec faz
// `limparLembretes()` dentro dela, e o Início só mostra os 6 primeiros abertos.

// O `cabecalho-movel` é `sticky h-14` (56 px) abaixo de 768 px: o aviso começa abaixo dele.
const ALTURA_DO_CABECALHO_MOVEL = 56;

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function coluna(page: Page): Locator {
  return page.getByTestId("lembretes-coluna");
}

function linhaAberta(page: Page, id: string): Locator {
  return coluna(page)
    .getByTestId("lembretes-lista")
    .locator(`[data-testid="lembrete-linha"][data-id="${id}"]`);
}

// O aviso que está na tela — não o que sai animando depois de ser trocado (`data-removed="true"`).
function avisoNaTela(page: Page, texto: string): Locator {
  return page
    .locator('[data-sonner-toast][data-removed="false"]')
    .filter({ hasText: texto });
}

test.describe("polimento lembretes — aviso", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    await travarLembretesParaTeste();
  });

  test.afterAll(async () => {
    await destravarLembretesDeTeste();
  });

  test("a 375px o aviso com Desfazer sai no topo, abaixo do cabeçalho e acima de “Tudo da plataforma”, fica 8 s de pé e devolve o lembrete", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await limparLembretes();
    const texto = `[e2e] aviso no topo ${test.info().project.name}`;
    const id = await semearLembrete({ texto });

    await page.setViewportSize({ width: 375, height: 812 });
    await fazerLogin(page);
    await page.goto("/gestao");
    await linhaAberta(page, id).getByTestId("lembrete-excluir").click();
    await expect(linhaAberta(page, id)).toHaveCount(0);
    // Sem o mouse sobre o aviso: com ele, o sonner pausa o relógio e os 8 s não provariam nada.
    await page.mouse.move(0, 0);

    const aviso = avisoNaTela(page, `Lembrete excluído: ${texto}`);
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAttribute("data-y-position", "top");
    // A entrada do sonner desliza de cima (`translateY(-100%)` → 0): mede depois de assentar.
    await expect
      .poll(async () => (await medirCaixa(aviso, "aviso de exclusão")).y)
      .toBeGreaterThanOrEqual(ALTURA_DO_CABECALHO_MOVEL);
    const caixaDoAviso = await medirCaixa(aviso, "aviso de exclusão");
    // A caixa é relativa à janela, como a do aviso (fixo): o índice pode estar fora da tela, abaixo.
    const topoDoIndice = (
      await medirCaixa(page.getByTestId("inicio-indice"), "Tudo da plataforma")
    ).y;
    expect(
      caixaDoAviso.y + caixaDoAviso.height,
      "o aviso desce até os cartões de “Tudo da plataforma”",
    ).toBeLessThan(topoDoIndice);

    // ESPERA FIXA DE PROPÓSITO (a única do spec): o que se prova é a duração — 8 s depois de
    // aparecer, o aviso de 10 s continua de pé (o de 6 s, até 05/10/2026, já teria sumido).
    await page.waitForTimeout(8_000);
    await expect(aviso).toBeVisible();
    expect(await lerLembrete(id)).not.toBeNull();

    await aviso.getByRole("button", { name: "Desfazer" }).click();
    await expect(linhaAberta(page, id)).toHaveCount(1);
    expect(await lerLembrete(id)).not.toBeNull();
  });
});

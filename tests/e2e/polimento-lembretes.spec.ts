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
// celular: o aviso com "Desfazer" no topo e por 10 s (um toque atrasado não troca de módulo); a linha de
// criar na ordem campo → opções → "Guardar"; os filtros de "Ver todos" em dois grupos com título.
//
// D-07 (Enter): este spec NÃO afirma nada sobre o Enter no campo de criar. O plano pedia "Enter não cria
// lembrete", mas hoje o Enter CRIA (implícito do `<form>`; `lembretes-inicio` prova isso desde a 06.3) —
// e a D-07 diz "nada muda aqui". A divergência foi levada ao dono (06.5-05-SUMMARY.md).
//
// Toda caixa é medida por `medirCaixa` (D-23) — nunca `boundingBox()` direto. Os lembretes semeados
// têm texto inventado, prefixo "[e2e]" e o nome do projeto. Como todo spec `lembretes-*`, cada
// `describe` roda sob a MESMA trava consultiva (`travarLembretesParaTeste`): outro spec faz
// `limparLembretes()` dentro dela, e o Início só mostra os 6 primeiros abertos.

// A frase verbatim de `lib/lembretes/textos.ts` (06.3-UI-SPEC.md), escrita aqui para o teste reprovar
// se a copy mudar sem querer.
const FRASE_ESCREVA_ANTES_DE_GUARDAR = "Escreva o lembrete antes de guardar.";

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

test.describe("polimento lembretes — criar", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    await travarLembretesParaTeste();
  });

  test.afterAll(async () => {
    await destravarLembretesDeTeste();
  });

  test("a 375px a linha de criar fica campo → erro → opções → Guardar; a 1280px Guardar volta ao lado do campo", async ({
    page,
  }) => {
    await limparLembretes();
    await page.setViewportSize({ width: 375, height: 812 });
    await fazerLogin(page);
    await page.goto("/gestao");

    const campo = coluna(page).getByTestId("lembretes-novo-texto");
    const opcoes = coluna(page).getByTestId("lembretes-novo-opcoes");
    const guardar = coluna(page).getByTestId("lembretes-novo-guardar");
    const erro = coluna(page).getByTestId("lembretes-novo-erro");

    // Os outros blocos do Início chegam por streaming e empurram a coluna: medir só com a página
    // inteira na tela (molde de `lembretes-acoes` (p)).
    await expect(page.getByTestId("inicio-bloco-esqueleto")).toHaveCount(0);
    await campo.focus();
    await expect(coluna(page).getByTestId("lembretes-novo-data")).toBeVisible();
    // Folga entre o fim do campo e o começo das opções, medida de novo a cada tentativa (a página
    // pode ainda estar assentando depois do foco).
    await expect
      .poll(
        async () => {
          const campoAgora = await medirCaixa(campo, "campo");
          return (
            (await medirCaixa(opcoes, "opções")).y - (campoAgora.y + campoAgora.height)
          );
        },
        { message: "as opções não começam abaixo do campo" },
      )
      .toBeGreaterThanOrEqual(0);
    const caixaDoCampo = await medirCaixa(campo, "campo");
    const caixaDasOpcoes = await medirCaixa(opcoes, "opções");
    const caixaDoGuardar = await medirCaixa(guardar, "Guardar");
    expect(
      caixaDasOpcoes.y + caixaDasOpcoes.height,
      "as opções não terminam antes do Guardar",
    ).toBeLessThanOrEqual(caixaDoGuardar.y);
    // "Guardar" à direita, embaixo das opções (`justify-self-end`).
    expect(caixaDoGuardar.x + caixaDoGuardar.width).toBeCloseTo(
      caixaDoCampo.x + caixaDoCampo.width,
      0,
    );

    // Campo vazio: o erro aparece logo abaixo do campo, ANTES das opções.
    await guardar.click();
    await expect(erro).toHaveText(FRASE_ESCREVA_ANTES_DE_GUARDAR);
    const caixaDoErro = await medirCaixa(erro, "erro");
    const opcoesComErro = await medirCaixa(opcoes, "opções com o erro");
    expect(caixaDoErro.y).toBeGreaterThanOrEqual(caixaDoCampo.y + caixaDoCampo.height);
    expect(caixaDoErro.y, "o erro não está acima das opções").toBeLessThan(
      opcoesComErro.y,
    );

    // A partir de 384 px de contêiner (`@sm`): "Guardar" na fileira do campo, opções embaixo.
    await page.setViewportSize({ width: 1280, height: 900 });
    await campo.focus();
    const campoLargo = await medirCaixa(campo, "campo a 1280");
    const guardarLargo = await medirCaixa(guardar, "Guardar a 1280");
    const opcoesLargas = await medirCaixa(opcoes, "opções a 1280");
    expect(guardarLargo.x, "Guardar não está à direita do campo").toBeGreaterThanOrEqual(
      campoLargo.x + campoLargo.width,
    );
    expect(guardarLargo.y).toBeLessThan(campoLargo.y + campoLargo.height);
    expect(opcoesLargas.y).toBeGreaterThanOrEqual(campoLargo.y + campoLargo.height);
  });
});

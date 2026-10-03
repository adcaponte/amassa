import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  apagarLembreteDireto,
  destravarLembretesDeTeste,
  idDoUsuarioDoTeste,
  lerLembrete,
  limparLembretes,
  semearLembrete,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// As frases da tela, verbatim da 06.3-UI-SPEC.md (§Toasts, §Erros, §Ações) — escritas aqui, não
// importadas de `lib/`, para o teste reprovar se a copy mudar sem querer.
const FRASE_LEMBRETE_NAO_EXISTE =
  "Esse lembrete não existe mais — alguém excluiu. A lista foi atualizada.";
const TOAST_REABERTO = "Lembrete reaberto.";
// O primeiro nome da conta do e2e ("Gestora de Teste", `preparar-usuario.ts`).
const PRIMEIRO_NOME_DO_GESTOR_DE_TESTE = "Gestora";

// As ações da linha de lembrete — Fase 06.3, plano 04 (LMB-06, LMB-07, LMB-08): marcar feito com
// "Desfazer" e a sanfona "Feitos (N)" (D-02); editar na própria linha; excluir DE VERDADE só quando
// o toast de 6 s expira (D-03). Cada caso prova no BANCO, não só na tela.
//
// Todos escrevem em `lembretes` e a sanfona conta feitos da tabela inteira: o `describe` roda sob a
// MESMA trava consultiva de todo spec `lembretes-*` (`travarLembretesParaTeste`), em
// `mode: "serial"`, e cada caso começa por `limparLembretes()` — só dentro da trava. Textos
// inventados, prefixo `[e2e]` (CLAUDE.md); "hoje" de `hojeNoAtelie()`, nunca do dia UTC do relógio.

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

function linhaFeita(page: Page, id: string): Locator {
  return coluna(page)
    .getByTestId("lembretes-lista-feitos")
    .locator(`[data-testid="lembrete-linha"][data-id="${id}"]`);
}

// Um toast do `sonner` pelo texto (o `<Toaster>` mora no layout de `/gestao`).
function aviso(page: Page, texto: string): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: texto });
}

// Os ids das linhas de uma lista, na ordem da tela.
async function idsDe(lista: Locator): Promise<(string | null)[]> {
  return lista
    .getByTestId("lembrete-linha")
    .evaluateAll((elementos) => elementos.map((e) => e.getAttribute("data-id")));
}

test.describe("lembretes acoes", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // O outro projeto (desktop/celular) pode estar segurando a trava pelo describe inteiro — e este
    // tem casos que esperam o toast de 6 s. Tempo explícito, não retentativa.
    test.setTimeout(300_000);
    await travarLembretesParaTeste();
  });

  test.afterAll(async () => {
    await destravarLembretesDeTeste();
  });

  // (a) O traçador do plano 04 (LMB-06): a caixa → `feito_em`/`feito_por` → "Desfazer" → de volta.
  test("marcar feito tira a linha de Para fazer na hora, põe Feitos (1) fechado, grava feito_em e feito_por; Desfazer devolve a linha na ordem e limpa o banco", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const textoA = `[e2e] marcar feito A ${projeto}`;
    const textoB = `[e2e] marcar feito B ${projeto}`;
    const idA = await semearLembrete({ texto: textoA, criadoEm: "2026-01-01T12:00:00.000Z" });
    const idB = await semearLembrete({ texto: textoB, criadoEm: "2026-01-01T12:01:00.000Z" });
    const idDoUsuario = await idDoUsuarioDoTeste();

    await fazerLogin(page);
    await page.goto("/gestao");
    const lista = coluna(page).getByTestId("lembretes-lista");
    await expect(lista.getByTestId("lembrete-linha")).toHaveCount(2);
    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);

    const caixa = linhaAberta(page, idA).getByTestId("lembrete-caixa");
    await expect(caixa).toHaveAttribute("aria-pressed", "false");
    await expect(caixa).toHaveAttribute("aria-label", `Marcar feito: ${textoA}`);
    await caixa.click();

    // Na hora: a linha sai, a contagem desce, "Feitos (1)" aparece FECHADA (UI-D18).
    await expect(linhaAberta(page, idA)).toHaveCount(0);
    await expect(coluna(page).getByTestId("lembretes-contagem")).toHaveText("1 aberto");
    const feitos = coluna(page).getByTestId("lembretes-feitos");
    await expect(feitos.locator("summary")).toHaveText("Feitos (1)");
    expect(await feitos.evaluate((elemento) => (elemento as HTMLDetailsElement).open)).toBe(false);
    // O foco vai para a caixa da linha seguinte — nunca o `<body>`.
    await expect(linhaAberta(page, idB).getByTestId("lembrete-caixa")).toBeFocused();

    const toastFeito = aviso(page, `Feito: ${textoA}`);
    await expect(toastFeito).toBeVisible();

    await expect
      .poll(async () => {
        const gravado = await lerLembrete(idA);
        return gravado && { feito: gravado.feito_em !== null, feito_por: gravado.feito_por };
      })
      .toEqual({ feito: true, feito_por: idDoUsuario });

    await toastFeito.getByRole("button", { name: "Desfazer" }).click();

    // A linha volta na posição da ordem (A foi criado antes de B) e a sanfona some.
    await expect(linhaAberta(page, idA)).toHaveCount(1);
    expect(await idsDe(lista)).toEqual([idA, idB]);
    await expect(coluna(page).getByTestId("lembretes-contagem")).toHaveText("2 abertos");
    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);
    await expect
      .poll(async () => {
        const gravado = await lerLembrete(idA);
        return gravado && { feito_em: gravado.feito_em, feito_por: gravado.feito_por };
      })
      .toEqual({ feito_em: null, feito_por: null });
  });

  // (b) UI E5·populated — reabrir em "Feitos".
  test("com 1 feito, a sanfona mostra o texto riscado e feito por … · dd/mm hh:mm; desmarcar volta a linha para Para fazer, avisa Lembrete reaberto. e limpa o banco", async ({
    page,
  }) => {
    await limparLembretes();
    const texto = `[e2e] reabrir ${test.info().project.name}`;
    // 15:20 UTC = 12:20 em Brasília.
    const id = await semearLembrete({ texto, feitoEm: "2026-09-30T15:20:00.000Z" });

    await fazerLogin(page);
    await page.goto("/gestao");
    await expect(coluna(page).getByTestId("lembretes-vazio")).toBeVisible();
    const feitos = coluna(page).getByTestId("lembretes-feitos");
    await expect(feitos.locator("summary")).toHaveText("Feitos (1)");
    await feitos.locator("summary").click();

    const linha = linhaFeita(page, id);
    await expect(linha).toHaveAttribute("data-situacao", "feito");
    await expect(linha.getByTestId("lembrete-texto")).toHaveClass(/line-through/);
    await expect(linha.getByTestId("lembrete-autoria")).toHaveText(
      `feito por ${PRIMEIRO_NOME_DO_GESTOR_DE_TESTE} · 30/09 12:20`,
    );
    const caixa = linha.getByTestId("lembrete-caixa");
    await expect(caixa).toHaveAttribute("aria-pressed", "true");
    await expect(caixa).toHaveAttribute("aria-label", `Desfazer: ${texto}`);

    await caixa.click();

    await expect(linhaAberta(page, id)).toHaveCount(1);
    await expect(linhaAberta(page, id).getByTestId("lembrete-caixa")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(aviso(page, TOAST_REABERTO)).toBeVisible();
    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);
    await expect(coluna(page).getByTestId("lembretes-contagem")).toHaveText("1 aberto");
    await expect
      .poll(async () => {
        const gravado = await lerLembrete(id);
        return gravado && { feito_em: gravado.feito_em, feito_por: gravado.feito_por };
      })
      .toEqual({ feito_em: null, feito_por: null });
  });

  // (c) D-02 / UI E5·overflow — os 5 mais recentes e o "e mais N".
  test("com 7 feitos, Feitos (7) mostra os 5 mais recentes na ordem e e mais 2 em “ver todos” para /gestao/lembretes?situacao=feitos", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const ids: string[] = [];
    for (let dia = 1; dia <= 7; dia += 1) {
      ids.push(
        await semearLembrete({
          texto: `[e2e] feito ${dia} ${projeto}`,
          feitoEm: `2026-09-0${dia}T12:00:00.000Z`,
        }),
      );
    }

    await fazerLogin(page);
    await page.goto("/gestao");
    const feitos = coluna(page).getByTestId("lembretes-feitos");
    await expect(feitos.locator("summary")).toHaveText("Feitos (7)");
    await feitos.locator("summary").click();

    const listaDosFeitos = coluna(page).getByTestId("lembretes-lista-feitos");
    await expect(listaDosFeitos.getByTestId("lembrete-linha")).toHaveCount(5);
    expect(await idsDe(listaDosFeitos)).toEqual([ids[6], ids[5], ids[4], ids[3], ids[2]]);

    const mais = coluna(page).getByTestId("lembretes-feitos-mais");
    await expect(mais).toHaveText("e mais 2 em “ver todos”");
    await expect(mais).toHaveAttribute("href", "/gestao/lembretes?situacao=feitos");
  });

  // (d) UI E5·empty — sem feito nenhum, nem o `<summary>`.
  test("sem nenhum feito, a sanfona Feitos não existe", async ({ page }) => {
    await limparLembretes();
    const id = await semearLembrete({ texto: `[e2e] só aberto ${test.info().project.name}` });

    await fazerLogin(page);
    await page.goto("/gestao");
    await expect(linhaAberta(page, id)).toBeVisible();
    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);
    await expect(coluna(page).locator("summary")).toHaveCount(0);
  });

  // (e) UI E4·error — marcar um lembrete que outra pessoa já excluiu.
  test("marcar feito um lembrete que outra pessoa apagou avisa que ele não existe mais e tira a linha", async ({
    page,
  }) => {
    await limparLembretes();
    const id = await semearLembrete({ texto: `[e2e] apagado por outro ${test.info().project.name}` });

    await fazerLogin(page);
    await page.goto("/gestao");
    await expect(linhaAberta(page, id)).toBeVisible();

    await apagarLembreteDireto(id);
    await linhaAberta(page, id).getByTestId("lembrete-caixa").click();

    await expect(aviso(page, FRASE_LEMBRETE_NAO_EXISTE)).toBeVisible();
    await expect(coluna(page).locator(`[data-testid="lembrete-linha"][data-id="${id}"]`)).toHaveCount(0);
    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);
    expect(await lerLembrete(id)).toBeNull();
  });
});

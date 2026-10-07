import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import {
  apagarLembreteDireto,
  criarPessoaDeTeste,
  criarUsuarioDeTeste,
  desativarPessoaDeTeste,
  destravarLembretesDeTeste,
  idDoUsuarioDoTeste,
  lerLembrete,
  limparLembretes,
  marcarFeitoNoBanco,
  semearLembrete,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// As frases da tela, verbatim da 06.3-UI-SPEC.md (§Toasts, §Erros, §Ações) — escritas aqui, não
// importadas de `lib/`, para o teste reprovar se a copy mudar sem querer.
const FRASE_LEMBRETE_NAO_EXISTE =
  "Esse lembrete não existe mais — alguém excluiu. A lista foi atualizada.";
const TOAST_REABERTO = "Lembrete reaberto.";
const TOAST_ATUALIZADO = "Lembrete atualizado.";
const FRASE_EDICAO_VAZIA =
  "O lembrete não pode ficar vazio. Escreva o texto — ou use “excluir”.";
const FRASE_PESSOA_INVALIDA =
  "Essa pessoa não está mais na lista. Escolha outra ou deixe “geral”.";
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

// O aviso que está na tela — não o que sai animando depois de ser trocado (`data-removed="true"`).
function avisoNaTela(page: Page, texto: string): Locator {
  return page.locator('[data-sonner-toast][data-removed="false"]').filter({ hasText: texto });
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
    const idA = await semearLembrete({
      texto: textoA,
      criadoEm: "2026-01-01T12:00:00.000Z",
    });
    const idB = await semearLembrete({
      texto: textoB,
      criadoEm: "2026-01-01T12:01:00.000Z",
    });
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
    expect(
      await feitos.evaluate((elemento) => (elemento as HTMLDetailsElement).open),
    ).toBe(false);
    // O foco vai para a caixa da linha seguinte — nunca o `<body>`.
    await expect(linhaAberta(page, idB).getByTestId("lembrete-caixa")).toBeFocused();

    const toastFeito = aviso(page, `Feito: ${textoA}`);
    await expect(toastFeito).toBeVisible();

    await expect
      .poll(async () => {
        const gravado = await lerLembrete(idA);
        return (
          gravado && { feito: gravado.feito_em !== null, feito_por: gravado.feito_por }
        );
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
    const id = await semearLembrete({
      texto: `[e2e] só aberto ${test.info().project.name}`,
    });

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
    const id = await semearLembrete({
      texto: `[e2e] apagado por outro ${test.info().project.name}`,
    });

    await fazerLogin(page);
    await page.goto("/gestao");
    await expect(linhaAberta(page, id)).toBeVisible();

    await apagarLembreteDireto(id);
    await linhaAberta(page, id).getByTestId("lembrete-caixa").click();

    await expect(aviso(page, FRASE_LEMBRETE_NAO_EXISTE)).toBeVisible();
    await expect(
      coluna(page).locator(`[data-testid="lembrete-linha"][data-id="${id}"]`),
    ).toHaveCount(0);
    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);
    expect(await lerLembrete(id)).toBeNull();
  });

  // (f) LMB-07 — editar texto, data e pessoa na própria linha; Enter salva.
  test("editar texto, data de hoje e pessoa e apertar Enter atualiza a linha, avisa Lembrete atualizado., devolve o foco ao editar e grava os três no banco", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const texto = `[e2e] editar ${projeto}`;
    const novo = `[e2e] editado ${projeto}`;
    const hoje = hojeNoAtelie();
    const idDoUsuario = await idDoUsuarioDoTeste();
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);
    const editar = linha.getByTestId("lembrete-editar");
    await expect(editar).toHaveAttribute("aria-label", `Editar: ${texto}`);
    await editar.click();

    const campo = linha.getByTestId("lembrete-edicao-texto");
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue(texto);
    await expect(linha.getByTestId("lembrete-caixa")).toBeDisabled();

    await campo.fill(novo);
    await linha.locator('input[type="date"]').fill(hoje);
    await linha
      .locator(`[data-testid="lembretes-pessoa"][data-pessoa="${idDoUsuario}"]`)
      .click();
    await campo.press("Enter");

    await expect(linha.getByTestId("lembrete-edicao-texto")).toHaveCount(0);
    await expect(linha.getByTestId("lembrete-texto")).toHaveText(novo);
    await expect(linha.getByTestId("lembrete-prazo")).toHaveText("hoje");
    await expect(linha.getByTestId("lembrete-chip")).toHaveText(
      PRIMEIRO_NOME_DO_GESTOR_DE_TESTE,
    );
    await expect(aviso(page, TOAST_ATUALIZADO)).toBeVisible();
    await expect(linha.getByTestId("lembrete-editar")).toBeFocused();

    await expect
      .poll(async () => {
        const gravado = await lerLembrete(id);
        return (
          gravado && {
            texto: gravado.texto,
            para_quando: gravado.para_quando,
            quem: gravado.quem,
          }
        );
      })
      .toEqual({ texto: novo, para_quando: hoje, quem: idDoUsuario });
  });

  // (g) UI-D12 — "cancelar" e Esc não gravam.
  test("editar e tocar cancelar, ou apertar Esc, não muda nada na tela nem no banco", async ({
    page,
  }) => {
    await limparLembretes();
    const texto = `[e2e] não editar ${test.info().project.name}`;
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);

    await linha.getByTestId("lembrete-editar").click();
    await linha.getByTestId("lembrete-edicao-texto").fill("[e2e] mudança que não vale");
    await linha.getByTestId("lembrete-edicao-cancelar").click();
    await expect(linha.getByTestId("lembrete-edicao-texto")).toHaveCount(0);
    await expect(linha.getByTestId("lembrete-texto")).toHaveText(texto);
    await expect(linha.getByTestId("lembrete-editar")).toBeFocused();

    await linha.getByTestId("lembrete-editar").click();
    const campo = linha.getByTestId("lembrete-edicao-texto");
    await campo.fill("[e2e] outra mudança que não vale");
    await campo.press("Escape");
    await expect(linha.getByTestId("lembrete-edicao-texto")).toHaveCount(0);
    await expect(linha.getByTestId("lembrete-texto")).toHaveText(texto);
    await expect(linha.getByTestId("lembrete-editar")).toBeFocused();

    expect((await lerLembrete(id))?.texto).toBe(texto);
  });

  // (h) UI E4·error — salvar a edição vazia.
  test("apagar todo o texto e salvar mostra a frase da edição vazia, mantém a edição aberta e não grava", async ({
    page,
  }) => {
    await limparLembretes();
    const texto = `[e2e] não esvaziar ${test.info().project.name}`;
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);
    await linha.getByTestId("lembrete-editar").click();
    const campo = linha.getByTestId("lembrete-edicao-texto");
    await campo.fill("");
    await linha.getByTestId("lembrete-edicao-salvar").click();

    const erro = linha.getByTestId("lembrete-edicao-erro");
    await expect(erro).toHaveText(FRASE_EDICAO_VAZIA);
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(campo).toBeVisible();
    await expect(campo).toHaveValue("");
    expect((await lerLembrete(id))?.texto).toBe(texto);
  });

  // (i) UI E4·error — a pessoa NOVA foi desativada antes de salvar: a recusa é do servidor.
  test("escolher uma pessoa nova, desativá-la e salvar mostra a frase da pessoa, mantém a edição preenchida e não grava", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const pessoaId = await criarPessoaDeTeste(`[e2e] Pessoa nova ${projeto}`);
    const texto = `[e2e] pessoa nova ${projeto}`;
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);
    await linha.getByTestId("lembrete-editar").click();
    const pilula = linha.locator(
      `[data-testid="lembretes-pessoa"][data-pessoa="${pessoaId}"]`,
    );
    await pilula.click();
    await expect(pilula).toHaveAttribute("aria-pressed", "true");

    await desativarPessoaDeTeste(pessoaId);
    await linha.getByTestId("lembrete-edicao-salvar").click();

    await expect(linha.getByTestId("lembrete-edicao-erro")).toHaveText(
      FRASE_PESSOA_INVALIDA,
    );
    await expect(linha.getByTestId("lembrete-edicao-texto")).toHaveValue(texto);
    await expect(pilula).toHaveAttribute("aria-pressed", "true");
    const gravado = await lerLembrete(id);
    expect(gravado && { texto: gravado.texto, quem: gravado.quem }).toEqual({
      texto,
      quem: null,
    });
  });

  // (j) UI E4·partial — pessoa desativada: chip neutro com o nome; na edição, a pílula a mais
  // marcada; salvar só o texto mantém o `quem` (a pessoa que JÁ estava gravada é aceita).
  test("um lembrete de pessoa desativada mostra o chip neutro com o nome dela; ao editar, a pílula dela vem marcada e salvar só o texto mantém o quem", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const pessoaId = await criarPessoaDeTeste(`[e2e]Desativada ${projeto}`);
    const texto = `[e2e] de quem saiu ${projeto}`;
    const novo = `[e2e] de quem saiu, editado ${projeto}`;
    const id = await semearLembrete({ texto, quem: pessoaId });
    await desativarPessoaDeTeste(pessoaId);

    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);
    const chip = linha.getByTestId("lembrete-chip");
    await expect(chip).toHaveText("[e2e]Desativada");
    await expect(chip).toHaveClass(/bg-tinta-fraca/);

    await linha.getByTestId("lembrete-editar").click();
    const pilula = linha.locator(
      `[data-testid="lembretes-pessoa"][data-pessoa="${pessoaId}"]`,
    );
    await expect(pilula).toHaveAttribute("aria-pressed", "true");
    await linha.getByTestId("lembrete-edicao-texto").fill(novo);
    await linha.getByTestId("lembrete-edicao-salvar").click();

    await expect(linha.getByTestId("lembrete-texto")).toHaveText(novo);
    await expect(aviso(page, TOAST_ATUALIZADO)).toBeVisible();
    await expect
      .poll(async () => {
        const gravado = await lerLembrete(id);
        return gravado && { texto: gravado.texto, quem: gravado.quem };
      })
      .toEqual({ texto: novo, quem: pessoaId });
  });

  // (k) UI E4·error — salvar a edição de um lembrete que outra pessoa já excluiu.
  test("salvar a edição de um lembrete que outra pessoa apagou avisa que ele não existe mais e tira a linha", async ({
    page,
  }) => {
    await limparLembretes();
    const id = await semearLembrete({
      texto: `[e2e] editar o apagado ${test.info().project.name}`,
    });

    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);
    await linha.getByTestId("lembrete-editar").click();
    await linha.getByTestId("lembrete-edicao-texto").fill("[e2e] tarde demais");

    await apagarLembreteDireto(id);
    await linha.getByTestId("lembrete-edicao-salvar").click();

    await expect(aviso(page, FRASE_LEMBRETE_NAO_EXISTE)).toBeVisible();
    await expect(linhaAberta(page, id)).toHaveCount(0);
    expect(await lerLembrete(id)).toBeNull();
  });

  // (l) 🔴 LMB-08 / D-03 — excluir apaga DE VERDADE, mas só quando o toast de 10 s expira (6 s até a 06.5).
  test("excluir um aberto tira a linha na hora, mantém o lembrete no banco logo depois e o apaga quando o toast expira", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await limparLembretes();
    const texto = `[e2e] excluir ${test.info().project.name}`;
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    const excluir = linhaAberta(page, id).getByTestId("lembrete-excluir");
    await expect(excluir).toHaveAttribute("aria-label", `Excluir: ${texto}`);
    await excluir.click();

    // Na hora: some da tela — e ainda está no banco (nada foi ao servidor).
    await expect(linhaAberta(page, id)).toHaveCount(0);
    expect(await lerLembrete(id)).not.toBeNull();
    await expect(coluna(page).getByTestId("lembretes-contagem")).toHaveText(
      "nada pendente",
    );
    await expect(aviso(page, `Lembrete excluído: ${texto}`)).toBeVisible();
    // O foco não cai no `<body>`: a lista esvaziou, ele vai para o campo de criar.
    await expect(coluna(page).getByTestId("lembretes-novo-texto")).toBeFocused();

    // O sonner pausa o relógio com o mouse sobre o aviso (Pitfall 1): tira o mouse de cima e prova
    // pelo banco, sem espera fixa.
    await page.mouse.move(0, 0);
    await expect.poll(() => lerLembrete(id), { timeout: 15_000 }).toBeNull();
    await expect(linhaAberta(page, id)).toHaveCount(0);
  });

  // (m) D-03 — "Desfazer" devolve a linha e nada vai ao servidor.
  test("excluir e tocar Desfazer devolve a linha, e passados os 10 s o lembrete continua no banco", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await limparLembretes();
    const texto = `[e2e] excluir e desfazer ${test.info().project.name}`;
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    await linhaAberta(page, id).getByTestId("lembrete-excluir").click();
    await expect(linhaAberta(page, id)).toHaveCount(0);

    await aviso(page, `Lembrete excluído: ${texto}`)
      .getByRole("button", { name: "Desfazer" })
      .click();
    await expect(linhaAberta(page, id)).toHaveCount(1);
    await page.mouse.move(0, 0);

    // ESPERA FIXA DE PROPÓSITO: provar que NADA dispara depois dos 10 s do toast exige deixar o tempo
    // passar — não há evento para esperar. 11 s = os 10 s do "Desfazer" (06.5, UI-D6) com folga.
    await page.waitForTimeout(11_000);
    expect(await lerLembrete(id)).not.toBeNull();
    await expect(linhaAberta(page, id)).toBeVisible();
  });

  // (n) D-03, falha segura — recarregar a página antes de o toast expirar não apaga.
  test("excluir e recarregar a página na hora mantém o lembrete no banco e na tela", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await limparLembretes();
    const texto = `[e2e] excluir e recarregar ${test.info().project.name}`;
    const id = await semearLembrete({ texto });

    await fazerLogin(page);
    await page.goto("/gestao");
    await linhaAberta(page, id).getByTestId("lembrete-excluir").click();
    await expect(linhaAberta(page, id)).toHaveCount(0);
    await page.reload();

    // ESPERA FIXA DE PROPÓSITO: provar que a exclusão interrompida NÃO acontece depois dos 10 s exige
    // deixar o tempo passar. 11 s = os 10 s do toast (06.5, UI-D6) com folga.
    await page.waitForTimeout(11_000);
    expect(await lerLembrete(id)).not.toBeNull();
    await expect(linhaAberta(page, id)).toBeVisible();
  });

  // (o) "excluir" também nos feitos, pela sanfona.
  test("excluir um feito pela sanfona Feitos o apaga do banco quando o toast expira", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await limparLembretes();
    const texto = `[e2e] excluir feito ${test.info().project.name}`;
    const id = await semearLembrete({ texto, feitoEm: "2026-09-30T15:20:00.000Z" });

    await fazerLogin(page);
    await page.goto("/gestao");
    await coluna(page).getByTestId("lembretes-feitos").locator("summary").click();
    const linha = linhaFeita(page, id);
    // No feito, só "excluir" (o protótipo esconde "editar").
    await expect(linha.getByTestId("lembrete-editar")).toHaveCount(0);
    await linha.getByTestId("lembrete-excluir").click();

    await expect(coluna(page).getByTestId("lembretes-feitos")).toHaveCount(0);
    expect(await lerLembrete(id)).not.toBeNull();
    await expect(aviso(page, `Lembrete excluído: ${texto}`)).toBeVisible();
    await page.mouse.move(0, 0);
    await expect.poll(() => lerLembrete(id), { timeout: 15_000 }).toBeNull();
  });

  // (p) UI E4·overflow — a 320 px as ações descem para baixo da meta (UI-D5), com 44 px cada.
  test("a 320px, editar e excluir ficam embaixo da meta com 44px de altura e nada rola na horizontal", async ({
    page,
  }) => {
    await limparLembretes();
    const id = await semearLembrete({
      texto: `[e2e] ações a 320 ${test.info().project.name}`,
      paraQuando: hojeNoAtelie(),
    });

    await page.setViewportSize({ width: 320, height: 900 });
    await fazerLogin(page);
    await page.goto("/gestao");
    const linha = linhaAberta(page, id);
    await expect(linha).toBeVisible();
    // Os outros blocos chegam por streaming: medir só com a página inteira na tela.
    await expect(page.getByTestId("inicio-bloco-esqueleto")).toHaveCount(0);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/gestao rola horizontalmente a 320px (${scrollWidth} > ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const meta = await medirCaixa(linha.getByTestId("lembrete-meta"), "meta do lembrete");
    for (const testId of ["lembrete-editar", "lembrete-excluir"]) {
      const caixa = await medirCaixa(linha.getByTestId(testId), testId);
      expect(caixa.height, `${testId} mede menos de 44px`).toBeGreaterThanOrEqual(44);
      expect(
        caixa.y,
        `${testId} não desceu para baixo da meta`,
      ).toBeGreaterThanOrEqual(meta.y + meta.height - 1);
    }
  });

  // Quick 261005-2yu (05/10/2026): os avisos da revisão da 06.3.

  // (q) 06.3-WR-03 — outra pessoa marcou antes: o aviso diz quem e NÃO oferece "Desfazer" (desfazer
  // apagaria o feito dela). No código anterior, o aviso era "Feito: …" com "Desfazer".
  test("(q) WR-03: marcar um lembrete que outra pessoa acabou de marcar diz “Já estava feito por …”, sem Desfazer, e o feito continua dela", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const texto = `[e2e] já feito ${projeto}`;
    const id = await semearLembrete({ texto });
    const nomeDoOutro = `[e2e] Outra ${projeto}`;
    const outro = await criarUsuarioDeTeste(nomeDoOutro);

    await fazerLogin(page);
    await page.goto("/gestao");
    await expect(linhaAberta(page, id)).toHaveCount(1);

    await marcarFeitoNoBanco(id, outro);
    await linhaAberta(page, id).getByTestId("lembrete-caixa").click();

    const avisoJaFeito = avisoNaTela(page, `Já estava feito por ${nomeDoOutro}: ${texto}`);
    await expect(avisoJaFeito).toBeVisible();
    await expect(avisoJaFeito.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
    await expect(aviso(page, `Feito: ${texto}`)).toHaveCount(0);
    expect((await lerLembrete(id))?.feito_por).toBe(outro);
  });

  // (r) 06.3-WR-01 — um aviso dos Lembretes por cima não esconde o "Desfazer" da exclusão: ela volta
  // para a FRENTE. No código anterior, o "Feito" ficava na frente e o "Lembrete excluído" atrás, com o
  // conteúdo em opacidade 0 (sonner recolhido) — o "Desfazer" invisível, e a exclusão seguia.
  test("(r) WR-01: excluir A e marcar B como feito deixa o Desfazer de A na frente; ele devolve A, e B continua feito", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await limparLembretes();
    const projeto = test.info().project.name;
    const textoA = `[e2e] excluir A ${projeto}`;
    const textoB = `[e2e] feito B ${projeto}`;
    const idA = await semearLembrete({ texto: textoA, criadoEm: "2026-01-01T12:00:00.000Z" });
    const idB = await semearLembrete({ texto: textoB, criadoEm: "2026-01-01T12:01:00.000Z" });

    await fazerLogin(page);
    await page.goto("/gestao");
    await linhaAberta(page, idA).getByTestId("lembrete-excluir").click();
    await expect(linhaAberta(page, idA)).toHaveCount(0);
    await linhaAberta(page, idB).getByTestId("lembrete-caixa").click();
    // Sem o mouse sobre os avisos: com ele, o sonner abre a pilha e tudo fica visível.
    await page.mouse.move(0, 0);

    await expect(avisoNaTela(page, `Feito: ${textoB}`)).toHaveCount(1);
    const avisoDeA = avisoNaTela(page, `Lembrete excluído: ${textoA}`);
    await expect(avisoDeA).toHaveAttribute("data-front", "true");
    const desfazer = avisoDeA.getByRole("button", { name: "Desfazer" });
    await expect(desfazer).toHaveCSS("opacity", "1");
    await desfazer.click();
    await expect(linhaAberta(page, idA)).toHaveCount(1);
    await page.mouse.move(0, 0);

    // ESPERA FIXA DE PROPÓSITO (molde do (m)): provar que nada dispara depois dos 10 s.
    await page.waitForTimeout(11_000);
    expect(await lerLembrete(idA)).not.toBeNull();
    expect((await lerLembrete(idB))?.feito_em).not.toBeNull();
  });

  // (s) 06.3-WR-01 — várias exclusões seguidas viram UM aviso cujo "Desfazer" devolve todas; deixado
  // expirar, apaga todas.
  test("(s) WR-01: excluir dois em seguida mostra um aviso só, “2 lembretes excluídos.”; Desfazer devolve os dois, e expirar apaga os dois", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await limparLembretes();
    const projeto = test.info().project.name;
    const textoA = `[e2e] lote A ${projeto}`;
    const textoB = `[e2e] lote B ${projeto}`;
    const idA = await semearLembrete({ texto: textoA, criadoEm: "2026-01-01T12:00:00.000Z" });
    const idB = await semearLembrete({ texto: textoB, criadoEm: "2026-01-01T12:01:00.000Z" });

    await fazerLogin(page);
    await page.goto("/gestao");

    // 1ª rodada: os dois de uma vez, e "Desfazer".
    await linhaAberta(page, idA).getByTestId("lembrete-excluir").click();
    await linhaAberta(page, idB).getByTestId("lembrete-excluir").click();
    await page.mouse.move(0, 0);
    const avisoDoLote = avisoNaTela(page, "2 lembretes excluídos.");
    await expect(avisoDoLote).toHaveCount(1);
    await expect(avisoNaTela(page, "Lembrete excluído:")).toHaveCount(0);
    await avisoDoLote.getByRole("button", { name: "Desfazer" }).click();
    await expect(linhaAberta(page, idA)).toHaveCount(1);
    await expect(linhaAberta(page, idB)).toHaveCount(1);
    expect(await lerLembrete(idA)).not.toBeNull();
    expect(await lerLembrete(idB)).not.toBeNull();

    // 2ª rodada: os dois de novo, e deixa expirar — os dois saem do banco.
    await linhaAberta(page, idA).getByTestId("lembrete-excluir").click();
    await linhaAberta(page, idB).getByTestId("lembrete-excluir").click();
    await page.mouse.move(0, 0);
    await expect(avisoNaTela(page, "2 lembretes excluídos.")).toHaveCount(1);
    await expect.poll(() => lerLembrete(idA), { timeout: 15_000 }).toBeNull();
    await expect.poll(() => lerLembrete(idB), { timeout: 15_000 }).toBeNull();
    await expect(linhaAberta(page, idA)).toHaveCount(0);
    await expect(linhaAberta(page, idB)).toHaveCount(0);
  });
});

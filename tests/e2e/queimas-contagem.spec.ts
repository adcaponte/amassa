import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";
import { idDoUsuarioDoTeste } from "./apoio/semear-fornecedores";
import {
  apagarQueimaNoBanco,
  contarContagens,
  lerContagem,
  pularContagem,
  semearContagem,
  semearForno,
  semearQueimaSemContagem,
  ultimaQueimaDoForno,
} from "./apoio/semear-queimas";

// O traçador da Fase 06.4 (06.4-01-PLAN.md, Tarefa 2): "Queimar" → "Biscoito" grava a queima como na
// Fase 4 e, DEPOIS da resposta, abre a folha "O que queimou?"; "Salvar" grava UMA linha em
// `queima_contagens` com quem contou, e "Pular" não grava nada. Sem etiqueta de vazio: cada teste
// cadastra o próprio forno, de nome único, e roda em `desktop`/`celular` depois da cadeia `vazio-*`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(): string {
  return `[e2e] contagem ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarForno(page: Page, nome: string): Promise<void> {
  await page.goto("/gestao/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill("50");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/gestao\/queimas$/, { timeout: 10000 });
}

function cartaoDoForno(page: Page, nome: string) {
  return page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
}

test.describe("contagem — folha", () => {
  test("registrar abre a folha depois do toast, ela sobrevive ao refresh, e Salvar grava a contagem com quem contou", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);

    const cartao = cartaoDoForno(page, nome);
    await cartao.scrollIntoViewIfNeeded();
    await expect(cartao.getByTestId("medidor-contador")).toContainText("0 / 50");

    await cartao.getByRole("button", { name: "Queimar" }).click();
    await cartao.getByTestId("tipo-queima-biscoito").click();

    await expect(page.getByText("Queima registrada.")).toBeVisible({ timeout: 5000 });
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha.getByTestId("contagem-titulo")).toHaveText("O que queimou?");

    // O id da folha é o da queima que este toque registrou.
    const id = await folha.getAttribute("data-queima-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const ultima = await ultimaQueimaDoForno(nome);
    expect(ultima?.id).toBe(id);
    expect(ultima?.tipo).toBe("biscoito");

    // O refresh chegou (o contador do cartão mudou) com a folha ainda aberta (Pitfall 2).
    await expect(cartao.getByTestId("medidor-contador")).toContainText("1 / 50", { timeout: 10000 });
    await expect(folha).toBeVisible();

    // Nada contado ainda; "saiu cheio" marcado por padrão.
    await expect(folha.getByTestId("contagem-resumo")).toHaveText("nenhuma peça");
    await expect(folha.getByTestId("contagem-saiu-cheio")).toHaveAttribute("data-state", "checked");

    const maisInternasP = folha.getByTestId("contador-internas-p-mais");
    await maisInternasP.click();
    await maisInternasP.click();
    await maisInternasP.click();
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("3");
    await folha.getByTestId("contador-externas-m").fill("2");
    await folha.getByTestId("contagem-saiu-cheio").click();
    await expect(folha.getByTestId("contagem-saiu-cheio")).toHaveAttribute("data-state", "unchecked");
    await expect(folha.getByTestId("contagem-resumo")).toHaveText("5 peças");

    await folha.getByTestId("contagem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });
    await expect(page.getByText("Contagem salva: 5 peças.")).toBeVisible({ timeout: 5000 });

    const contadoPor = await idDoUsuarioDoTeste();
    await expect
      .poll(() => lerContagem(id ?? ""), { timeout: 10000 })
      .toEqual({
        internas_p: 3,
        internas_m: 0,
        internas_g: 0,
        externas_p: 0,
        externas_m: 2,
        externas_g: 0,
        saiu_cheio: false,
        contado_por: contadoPor,
      });
    expect(await contarContagens(id ?? "")).toBe(1);
  });

  test("Pular não grava nada e a queima continua registrada", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);

    const cartao = cartaoDoForno(page, nome);
    await cartao.scrollIntoViewIfNeeded();
    await cartao.getByRole("button", { name: "Queimar" }).click();
    await cartao.getByTestId("tipo-queima-biscoito").click();

    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    const id = await folha.getAttribute("data-queima-id");

    await pularContagem(page);

    expect(await lerContagem(id ?? "")).toBeNull();
    const ultima = await ultimaQueimaDoForno(nome);
    expect(ultima?.id).toBe(id);
    await expect(cartao.getByTestId("medidor-contador")).toContainText("1 / 50", { timeout: 10000 });
  });
});

// "dd/mm" de hoje em Brasília — o dia civil das queimas registradas agora (`hojeNoAtelie`, nunca
// `toISOString()`, que erra o dia das 21h à meia-noite de Brasília).
function diaMesDeHoje(): string {
  const [, mes, dia] = hojeNoAtelie().split("-");
  return `${dia}/${mes}`;
}

// A lista "Sem contagem" é GLOBAL (todos os fornos): cada teste acha a SUA linha por `data-queima-id`
// e nunca afirma a contagem da lista inteira (a janela e o "e mais N" são do Vitest).
function linhaSemContagem(page: Page, id: string) {
  return page.getByTestId("queimas-sem-contagem").locator(`[data-queima-id="${id}"]`);
}

test.describe("sem contagem", () => {
  test("pular manda a queima para Sem contagem, e Contar agora conta e tira ela da lista", async ({
    page,
  }) => {
    await fazerLogin(page);
    // Um segundo forno garante "mais de um forno na casa" (UI-D15) sem depender da ordem dos testes:
    // o nome do forno aparece no título da linha.
    await semearForno(nomeUnico());
    const nome = nomeUnico();
    await cadastrarForno(page, nome);

    const cartao = cartaoDoForno(page, nome);
    await cartao.scrollIntoViewIfNeeded();
    await cartao.getByRole("button", { name: "Queimar" }).click();
    await cartao.getByTestId("tipo-queima-biscoito").click();
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    const id = (await folha.getAttribute("data-queima-id")) ?? "";
    await pularContagem(page);

    const linha = linhaSemContagem(page, id);
    await expect(linha).toBeVisible({ timeout: 10000 });
    await expect(linha).toContainText(`Biscoito de ${diaMesDeHoje()} · ${nome}`);
    await expect(linha).toContainText("ficou só o registro da queima");

    await linha.getByTestId("contar-agora").click();
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha).toHaveAttribute("data-queima-id", id);
    await folha.getByTestId("contador-internas-p-mais").click();
    await folha.getByTestId("contagem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });

    await expect(linha).toHaveCount(0, { timeout: 10000 });
    await expect.poll(async () => (await lerContagem(id))?.internas_p, { timeout: 10000 }).toBe(1);
    expect(await contarContagens(id)).toBe(1);
  });

  test("contar agora e pular de novo não grava nada", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await semearQueimaSemContagem(nome, process.env.E2E_EMAIL_TESTE ?? "");
    await page.reload();

    const linha = linhaSemContagem(page, id);
    await expect(linha).toBeVisible({ timeout: 10000 });
    await linha.getByTestId("contar-agora").click();
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha).toHaveAttribute("data-queima-id", id);
    await pularContagem(page);

    expect(await contarContagens(id)).toBe(0);
    await expect(linha).toBeVisible();
  });
});

// Plano 03 — o "Ver todas" (QMC-02, o item travado "Pular não perde nada"): uma queima pulada há 40
// dias, fora da janela de 30, só é alcançável por ele. A lista é GLOBAL nas duas visões: o teste acha
// a SUA linha por `data-queima-id` e nunca afirma a contagem total.
test.describe("sem contagem — todas", () => {
  test("Ver todas alcança a queima de 40 dias atrás, Contar agora tira ela da lista e a visão continua", async ({
    page,
  }) => {
    const email = process.env.E2E_EMAIL_TESTE ?? "";
    const nome = nomeUnico();
    await semearForno(nome);
    // O instante a partir do dia civil de Brasília (`hojeNoAtelie`), nunca do dia UTC: meio-dia em
    // Brasília de hoje − 40.
    const id = await semearQueimaSemContagem(
      nome,
      email,
      `${somarDiasAoHoje(-40)}T15:00:00.000Z`,
      "biscoito",
    );
    // Uma segunda sem contagem do mesmo forno, de hoje: a seção continua na tela depois de a de 40
    // dias ser contada, qualquer que seja o estado global da lista.
    await semearQueimaSemContagem(nome, email, undefined, "esmalte");

    await fazerLogin(page);
    await page.goto("/gestao/queimas");
    const secao = page.getByTestId("queimas-sem-contagem");
    await expect(secao).toBeVisible({ timeout: 10000 });
    await expect(linhaSemContagem(page, id)).toHaveCount(0);
    await expect(secao.getByTestId("sem-contagem-mais")).toBeVisible();

    await secao.getByTestId("sem-contagem-ver-todas").click();
    await expect(page).toHaveURL(/[?&]sem-contagem=todas/, { timeout: 10000 });
    const linha = linhaSemContagem(page, id);
    await expect(linha).toBeVisible({ timeout: 10000 });
    await expect(secao.getByTestId("sem-contagem-ver-recentes")).toBeVisible();
    await expect(secao.getByTestId("sem-contagem-mais")).toHaveCount(0);

    await linha.getByTestId("contar-agora").click();
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha).toHaveAttribute("data-queima-id", id);
    await folha.getByTestId("contador-internas-p-mais").click();
    await folha.getByTestId("contagem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });

    await expect(linha).toHaveCount(0, { timeout: 10000 });
    await expect(page).toHaveURL(/[?&]sem-contagem=todas/);
    await expect.poll(async () => (await lerContagem(id))?.internas_p, { timeout: 10000 }).toBe(1);

    await secao.getByTestId("sem-contagem-ver-recentes").click();
    await expect(page).toHaveURL(/\/gestao\/queimas$/, { timeout: 10000 });
    await expect(secao.getByTestId("sem-contagem-ver-recentes")).toHaveCount(0);
  });
});

// Registra uma queima pelo cartão (dois toques) e devolve o id da folha que abriu.
async function registrarEAbrirFolha(
  page: Page,
  cartao: Locator,
  tipo: "biscoito" | "esmalte" | "ouro" = "biscoito",
): Promise<string> {
  await cartao.scrollIntoViewIfNeeded();
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId(`tipo-queima-${tipo}`).click();
  const folha = page.getByTestId("folha-contagem");
  await expect(folha).toBeVisible({ timeout: 5000 });
  return (await folha.getAttribute("data-queima-id")) ?? "";
}

test.describe("contagem — aviso e folha", () => {
  test("salvar dentro dos 7 s atualiza o mesmo aviso, e Desfazer leva a contagem junto", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");

    await folha.getByTestId("contador-internas-p-mais").click();
    await folha.getByTestId("contagem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });

    // UM aviso só — o do registro, atualizado no lugar —, nunca um segundo empilhado.
    const avisosDaQueima = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /Queima registrada\.|Contagem salva/ });
    await expect(avisosDaQueima).toHaveCount(1);
    await expect(avisosDaQueima).toContainText("Contagem salva: 1 peça.");
    const desfazer = avisosDaQueima.locator("button", { hasText: "Desfazer" });
    await expect(desfazer).toBeVisible();

    await desfazer.click();
    await expect(page.getByText("Queima desfeita — a contagem foi junto.")).toBeVisible({
      timeout: 5000,
    });
    await expect.poll(() => ultimaQueimaDoForno(nome), { timeout: 10000 }).toBeNull();
    expect(await lerContagem(id)).toBeNull();
  });

  test("Esc não fecha com mudança e fecha sem", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");

    // Nada mexido: Esc fecha.
    await page.keyboard.press("Escape");
    await expect(folha).toBeHidden({ timeout: 5000 });

    // Pela lista "Sem contagem": um "+" e Esc não fecha — o segundo "+" ainda acha a folha.
    const linha = linhaSemContagem(page, id);
    await expect(linha).toBeVisible({ timeout: 10000 });
    await linha.getByTestId("contar-agora").click();
    await expect(folha).toBeVisible({ timeout: 5000 });
    await folha.getByTestId("contador-internas-p-mais").click();
    await page.keyboard.press("Escape");
    await folha.getByTestId("contador-internas-p-mais").click();
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("2");
    await expect(folha).toBeVisible();

    // "Pular" fecha sempre, sem gravar.
    await pularContagem(page);
    expect(await contarContagens(id)).toBe(0);
  });

  test("ouro não tem saiu cheio e grava cheio", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEAbrirFolha(page, cartaoDoForno(page, nome), "ouro");
    const folha = page.getByTestId("folha-contagem");

    await expect(folha.getByTestId("contador-externas-g")).toBeVisible();
    await expect(folha.getByTestId("contagem-saiu-cheio")).toHaveCount(0);
    await folha.getByTestId("contador-internas-m-mais").click();
    await folha.getByTestId("contagem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });

    await expect.poll(async () => (await lerContagem(id))?.saiu_cheio, { timeout: 10000 }).toBe(true);
    expect((await lerContagem(id))?.internas_m).toBe(1);
  });

  test("a régua vigente aparece na folha", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");

    // A régua da semente da 0030 (este teste não muda a régua).
    await expect(folha.getByTestId("contagem-regua")).toContainText(
      "P até 10 cm · M de 10 a 25 cm · G maior que 25 cm",
    );
    await expect(folha.getByText("maior que 25 cm", { exact: true })).toHaveCount(2);
    await expect(folha.getByText("até 10 cm", { exact: true })).toHaveCount(2);
    await pularContagem(page);
  });

  test("320 px: sem rolagem de lado, e Pular e Salvar juntos com 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");

    const larguras = await page.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth,
      tela: document.documentElement.clientWidth,
    }));
    expect(larguras.rolagem).toBeLessThanOrEqual(larguras.tela);

    const pular = await medirCaixa(folha.getByTestId("contagem-pular"), "Pular");
    const salvar = await medirCaixa(folha.getByTestId("contagem-salvar"), "Salvar");
    expect(pular.height).toBeGreaterThanOrEqual(44);
    expect(salvar.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(pular.y - salvar.y)).toBeLessThan(1);
    await pularContagem(page);
  });

  test("queima apagada com a folha aberta: Salvar diz que foi desfeita e fecha", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");

    await apagarQueimaNoBanco(id);
    await folha.getByTestId("contador-internas-p-mais").click();
    await folha.getByTestId("contagem-salvar").click();

    await expect(page.getByText("Essa queima foi desfeita — nada foi contado.")).toBeVisible({
      timeout: 10000,
    });
    await expect(folha).toBeHidden();
    expect(await contarContagens(id)).toBe(0);
  });

  test("sem rede os números ficam na folha", async ({ page, context }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");
    // O refresh do registro já chegou antes de cortar a rede.
    await expect(cartaoDoForno(page, nome).getByTestId("medidor-contador")).toContainText("1 / 50", {
      timeout: 10000,
    });

    await folha.getByTestId("contador-internas-p-mais").click();
    await context.setOffline(true);
    try {
      await folha.getByTestId("contagem-salvar").click();
      await expect(folha.getByTestId("contagem-erro")).toHaveText(
        "Não deu para salvar a contagem. Verifique a internet e tente de novo.",
        { timeout: 10000 },
      );
      await expect(folha.getByTestId("contagem-erro")).toHaveAttribute("role", "alert");
      await expect(folha.getByTestId("contador-internas-p")).toHaveValue("1");
    } finally {
      await context.setOffline(false);
    }
    await pularContagem(page);
    expect(await contarContagens(id)).toBe(0);
  });

  test("o teto corta em 10.000", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
    const folha = page.getByTestId("folha-contagem");
    const campo = folha.getByTestId("contador-internas-p");

    // Digitado, não passa de 5 dígitos.
    await campo.click();
    await campo.pressSequentially("999999");
    await expect(campo).toHaveValue("99999");

    // 10001 vira 10000 ao sair; o "+" fica desabilitado no teto, o "−" em 0.
    await campo.fill("10001");
    await campo.blur();
    await expect(campo).toHaveValue("10000");
    await expect(folha.getByTestId("contador-internas-p-mais")).toBeDisabled();
    await expect(folha.getByTestId("contador-internas-m-menos")).toBeDisabled();

    // Vazio vira 0 ao sair.
    await campo.fill("");
    await campo.blur();
    await expect(campo).toHaveValue("0");
    await pularContagem(page);
  });
});

// Registra uma queima de biscoito pelo cartão, preenche internas P e externas G na folha e salva.
// Devolve o id da queima.
async function registrarEContar(
  page: Page,
  nome: string,
  internasP: number,
  externasG: number,
): Promise<string> {
  const id = await registrarEAbrirFolha(page, cartaoDoForno(page, nome));
  const folha = page.getByTestId("folha-contagem");
  await folha.getByTestId("contador-internas-p").fill(String(internasP));
  await folha.getByTestId("contador-externas-g").fill(String(externasG));
  await folha.getByTestId("contagem-salvar").click();
  await expect(folha).toBeHidden({ timeout: 10000 });
  await expect
    .poll(async () => (await lerContagem(id))?.internas_p, { timeout: 10000 })
    .toBe(internasP);
  return id;
}

async function abrirDetalhe(page: Page, nome: string): Promise<void> {
  const cartao = cartaoDoForno(page, nome);
  await cartao.getByRole("link", { name: nome }).click();
  await expect(page).toHaveURL(/\/gestao\/queimas\/[0-9a-f-]{36}$/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();
}

// 06.4-WR-01 (quick 261005-2yu, 05/10/2026): salvar quando a contagem gravada mudou desde que a folha
// abriu é recusado sob a trava da queima — a frase diz o que está gravado agora, os números digitados
// FICAM, o banco fica como estava; salvar de novo grava de propósito. Pela folha do Histórico (no
// detalhe do forno), que continua montada depois do refresh da recusa.
test.describe("contagem — tela velha", () => {
  test("WR-01: outra pessoa salvou a contagem com a folha aberta — Salvar recusa com a frase, o 12 fica, e Salvar de novo grava", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await semearQueimaSemContagem(nome, process.env.E2E_EMAIL_TESTE ?? "");
    await abrirDetalhe(page, nome);

    await page.getByTestId(`contar-agora-${id}`).click();
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha).toHaveAttribute("data-queima-id", id);

    // "Outra pessoa" conta 31 internas P enquanto esta folha está aberta.
    await semearContagem(id, { internasP: 31 });
    await folha.getByTestId("contador-internas-p").fill("12");
    await folha.getByTestId("contagem-salvar").click();

    await expect(folha.getByTestId("contagem-erro")).toHaveText(
      "Alguém salvou esta contagem enquanto a folha estava aberta — agora estão gravadas 31 peças. Os seus números continuam aqui: confira e toque em Salvar de novo para ficar com eles.",
      { timeout: 10000 },
    );
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("12");
    expect((await lerContagem(id))?.internas_p).toBe(31);

    await folha.getByTestId("contagem-salvar").click();
    await expect(page.getByText("Contagem corrigida: 12 peças.")).toBeVisible({ timeout: 10000 });
    await expect(folha).toBeHidden();
    await expect.poll(async () => (await lerContagem(id))?.internas_p, { timeout: 10000 }).toBe(12);
    expect(await contarContagens(id)).toBe(1);
  });
});

test.describe("histórico com contagem", () => {
  test("a contagem aparece no Histórico e se corrige", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEContar(page, nome, 2, 1);
    await abrirDetalhe(page, nome);

    await expect(page.getByTestId(`historico-total-${id}`)).toHaveText("3 peças");
    const chips = page.getByTestId(`historico-contagem-${id}`);
    await expect(chips).toContainText("internas: 2 P");
    await expect(chips).toContainText("externas: 1 G");

    await page.getByTestId(`corrigir-contagem-${id}`).click();
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("2");
    await expect(folha.getByTestId("contador-externas-g")).toHaveValue("1");
    await expect(folha.getByTestId("contagem-fechar-sem-salvar")).toHaveText("Fechar sem salvar");
    await expect(folha.getByTestId("contagem-pular")).toHaveCount(0);

    await folha.getByTestId("contador-internas-p").fill("4");
    await folha.getByTestId("contagem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });
    await expect(page.getByText("Contagem corrigida: 5 peças.")).toBeVisible({ timeout: 5000 });

    await expect.poll(async () => (await lerContagem(id))?.internas_p, { timeout: 10000 }).toBe(4);
    expect((await lerContagem(id))?.externas_g).toBe(1);
    expect(await contarContagens(id)).toBe(1);
    await expect(page.getByTestId(`historico-total-${id}`)).toHaveText("5 peças", {
      timeout: 10000,
    });
  });

  test("zerar uma contagem existente pede confirmação e apaga", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEContar(page, nome, 4, 1);
    await abrirDetalhe(page, nome);

    await page.getByTestId(`corrigir-contagem-${id}`).click();
    const folha = page.getByTestId("folha-contagem");
    await expect(folha).toBeVisible({ timeout: 5000 });
    await folha.getByTestId("contador-internas-p").fill("0");
    await folha.getByTestId("contador-externas-g").fill("0");
    await folha.getByTestId("contagem-salvar").click();

    const confirmacao = page.getByTestId("confirmar-apagar-contagem");
    await expect(confirmacao).toBeVisible({ timeout: 5000 });
    await expect(
      confirmacao.getByRole("heading", { name: "Apagar a contagem desta queima?" }),
    ).toBeVisible();
    await expect(confirmacao).toContainText("As 5 peças contadas de Biscoito de");
    await expect(confirmacao).toContainText("A queima continua registrada no forno.");
    await confirmacao.getByRole("button", { name: "Apagar a contagem" }).click();

    await expect(
      page.getByText("Contagem apagada. A queima voltou para “Sem contagem”."),
    ).toBeVisible({ timeout: 10000 });
    await expect(confirmacao).toBeHidden();
    await expect(folha).toBeHidden();
    await expect.poll(() => lerContagem(id), { timeout: 10000 }).toBeNull();

    await expect(page.getByTestId(`historico-contagem-${id}`)).toHaveText("sem contagem", {
      timeout: 10000,
    });
    await expect(page.getByTestId(`historico-total-${id}`)).toHaveText("—");
    await expect(page.getByTestId(`contar-agora-${id}`)).toBeVisible();
    expect(await ultimaQueimaDoForno(nome)).toEqual({ id, tipo: "biscoito" });
  });

  test("excluir uma queima com contagem diz que ela vai junto", async ({ page }) => {
    await fazerLogin(page);
    const nome = nomeUnico();
    await cadastrarForno(page, nome);
    const id = await registrarEContar(page, nome, 2, 0);
    await abrirDetalhe(page, nome);

    await page.getByTestId(`excluir-queima-${id}`).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Excluir esta queima?" })).toBeVisible();
    await expect(dialogo).toContainText(
      `Ela some do histórico do Forno «${nome}» e o contador é recalculado. A contagem desta fornada (2 peças) vai junto.`,
    );
    await dialogo.getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page.getByTestId(`linha-queima-${id}`)).toHaveCount(0, { timeout: 10000 });
    expect(await lerContagem(id)).toBeNull();
    expect(await ultimaQueimaDoForno(nome)).toBeNull();
  });
});

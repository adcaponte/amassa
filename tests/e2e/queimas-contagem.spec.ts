import { test, expect, type Page } from "@playwright/test";

import { idDoUsuarioDoTeste } from "./apoio/semear-fornecedores";
import {
  contarContagens,
  lerContagem,
  pularContagem,
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

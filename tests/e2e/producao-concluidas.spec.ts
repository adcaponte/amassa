import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { diaEmBrasilia, semearOrdemEncerrada } from "./apoio/semear-producao";

// Concluídas e canceladas (plano 08, UI-D8; UI-SPEC E5): a rota própria, 50 por vez, com o que
// aconteceu com cada ordem. Desktop e celular em paralelo com o resto da suíte: cada caso semeia as
// SUAS ordens (sufixo único) e as acha pelo `data-ordem-id` — a contagem global exata nunca é
// afirmada aqui (só "≥ 2" no link da Produção); se outras encerradas mais recentes empurrarem as
// deste teste para depois da 50ª, o "Mostrar mais 50" as traz. Nomes inventados, prefixo `[e2e]`.

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

function dataCompleta(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Carrega páginas até as linhas pedidas aparecerem (ou a lista acabar).
async function mostrarAte(page: Page, ids: readonly string[]) {
  for (let pagina = 0; pagina < 20; pagina++) {
    const faltando = [];
    for (const id of ids) {
      if ((await page.locator(`[data-testid="concluidas-linha"][data-ordem-id="${id}"]`).count()) === 0) {
        faltando.push(id);
      }
    }
    if (faltando.length === 0) {
      return;
    }
    const mais = page.getByTestId("concluidas-mais");
    if ((await mais.count()) === 0) {
      return;
    }
    const antes = await page.getByTestId("concluidas-linha").count();
    await mais.click();
    await expect(page.getByTestId("concluidas-linha")).not.toHaveCount(antes);
  }
}

test.describe("producao concluidas", () => {
  test("a concluída com entrega parcial e a cancelada junto com a venda, mais recentes primeiro; Abrir leva à ordem", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nomeConcluida = `[e2e] Canecas entregues ${sufixo}`;
    const nomeCancelada = `[e2e] Pratos cancelados ${sufixo}`;
    const cliente = `[e2e] Cliente de ${sufixo}`;
    const concluidaEm = diaEmBrasilia(-1);
    const canceladaEm = diaEmBrasilia(0);
    // Concluída ontem, 12 dias depois do início; 20 feitas, 2 perdidas → 18 de 20 boas.
    const concluida = await semearOrdemEncerrada({
      nome: nomeConcluida,
      tipo: "casa",
      quantidade: 20,
      inicio: diaEmBrasilia(-13),
      status: "concluida",
      concluidaEm,
      perdidas: 2,
      entregaParcial: true,
    });
    // Cancelada hoje, junto com a venda, ainda aguardando (sem início).
    const cancelada = await semearOrdemEncerrada({
      nome: nomeCancelada,
      tipo: "encomenda",
      clienteNome: cliente,
      quantidade: 6,
      inicio: null,
      status: "cancelada",
      canceladaEm,
      canceladaPelaVenda: true,
    });

    await fazerLogin(page);
    await page.goto("/gestao/producao");

    // O link embaixo do quadro, com o número: pelo menos estas duas.
    const link = page.getByTestId("producao-ver-concluidas");
    await expect(link).toBeVisible();
    const texto = (await link.textContent()) ?? "";
    const quantas = Number(/^Ver concluídas e canceladas \((\d+)\)$/.exec(texto.trim())?.[1] ?? "0");
    expect(quantas).toBeGreaterThanOrEqual(2);
    const caixa = await medirCaixa(link, "Ver concluídas e canceladas");
    expect(caixa.height).toBeGreaterThanOrEqual(44);

    await link.click();
    await expect(page).toHaveURL(/\/gestao\/producao\/concluidas$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Concluídas e canceladas");
    await expect(page.getByRole("link", { name: "Voltar à Produção" })).toHaveAttribute(
      "href",
      "/gestao/producao",
    );
    await expect(page.getByTestId("concluidas-lista")).toBeVisible();
    // Sem filtro nesta tela.
    await expect(page.getByRole("group", { name: "Filtrar ordens" })).toHaveCount(0);

    await mostrarAte(page, [concluida, cancelada]);
    const linhaConcluida = page.locator(
      `[data-testid="concluidas-linha"][data-ordem-id="${concluida}"]`,
    );
    const linhaCancelada = page.locator(
      `[data-testid="concluidas-linha"][data-ordem-id="${cancelada}"]`,
    );
    await expect(linhaConcluida).toBeVisible();
    await expect(linhaCancelada).toBeVisible();

    // Mais recentes primeiro: a cancelada (hoje) vem antes da concluída (ontem).
    const ordemNaTela = await page
      .getByTestId("concluidas-linha")
      .evaluateAll((linhas) => linhas.map((linha) => linha.getAttribute("data-ordem-id")));
    expect(ordemNaTela.indexOf(cancelada)).toBeLessThan(ordemNaTela.indexOf(concluida));

    await expect(linhaConcluida).toContainText(nomeConcluida);
    await expect(linhaConcluida.getByTestId("concluidas-dias")).toHaveText("levou 12 dias");
    await expect(linhaConcluida.getByTestId("concluidas-sub-linha")).toHaveText(
      `da casa · 18 de 20 peças boas · concluída em ${dataCompleta(concluidaEm)}`,
    );
    await expect(linhaConcluida.getByTestId("concluidas-entrega-parcial")).toHaveText(
      "Entrega parcial",
    );

    await expect(linhaCancelada).toContainText(nomeCancelada);
    await expect(linhaCancelada).toContainText("cancelada");
    await expect(linhaCancelada.getByTestId("concluidas-dias")).toHaveCount(0);
    await expect(linhaCancelada.getByTestId("concluidas-sub-linha")).toHaveText(
      `${cliente} · cancelada em ${dataCompleta(canceladaEm)} junto com a venda`,
    );
    await expect(linhaCancelada.getByTestId("concluidas-entrega-parcial")).toHaveCount(0);

    // "Abrir" (44px, nome acessível com o nome da ordem) leva à ordem.
    const abrir = linhaConcluida.getByRole("link", { name: `Abrir ${nomeConcluida}` });
    const caixaAbrir = await medirCaixa(abrir, `Abrir ${nomeConcluida}`);
    expect(caixaAbrir.height).toBeGreaterThanOrEqual(44);
    await abrir.click();
    await expect(page).toHaveURL(new RegExp(`/gestao/producao/${concluida}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(nomeConcluida);
  });
});

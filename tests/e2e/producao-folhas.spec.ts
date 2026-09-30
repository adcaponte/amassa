import { test, expect, type Page } from "@playwright/test";

import {
  definirAMaisNoBanco,
  diaEmBrasilia,
  nomeDaPecaSemeada,
  numeroDoOrcamentoNoBanco,
  semearFotoDeOrcamento,
  semearOrdem,
  semearOrdemDeOrcamento,
} from "./apoio/semear-producao";

// As folhas A4 da Produção (Fase 06.1, plano 13 — PRD-19, PRD-20), por CSS de impressão:
//
// - "producao folha da ordem": a folha de bancada — olho com o número, nome, "para {cliente} ·
//   orçamento nº", peças com "Fazer = pedido + a mais", a foto, e NENHUM "R$" na página (a consulta
//   não lê dinheiro). Em `emulateMedia("print")` o nome continua visível (UI-D20: a regra global de
//   impressão esconde todo `header`, e a folha não usa um) e a barra de botões some. A da casa:
//   "Pedido —", "A mais 0", "Boas". Ordem inexistente: 404.
//
// Cada teste semeia os PRÓPRIOS dados com sufixo único (nenhuma afirmação global do banco). Nomes
// inventados, com `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(rotulo: string): string {
  const sufixo = `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return `[e2e] ${rotulo} ${sufixo}`;
}

// As células de uma linha da tabela de peças, como texto.
async function celulas(page: Page, indice: number): Promise<string[]> {
  const linha = page.getByTestId("folha-ordem-peca").nth(indice);
  return (await linha.locator("td").allTextContents()).map((texto) => texto.trim());
}

test.describe("producao folha da ordem", () => {
  test("(a) encomenda de orçamento: olho, nome, para o cliente, Fazer = pedido + a mais, a foto — e nenhum R$; no papel o nome fica e a barra some", async ({
    page,
  }) => {
    const nome = nomeUnico("Folha com fotos");
    const { ordemId, orcamentoId } = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: true,
      pecas: [
        { quantidade: 3, cor: "azul-cobalto", personalizacao: "com o nome gravado" },
        { quantidade: 2 },
      ],
    });
    await definirAMaisNoBanco(ordemId, 0, 1);
    const fotoId = await semearFotoDeOrcamento(orcamentoId);
    const numeroDoOrcamento = await numeroDoOrcamentoNoBanco(orcamentoId);

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}/imprimir`);

    const folha = page.getByTestId("folha-ordem");
    await expect(folha).toBeVisible();
    await expect(page.getByTestId("folha-ordem-olho")).toHaveText(/^Encomenda · ordem nº \d+$/);
    await expect(page.getByTestId("folha-ordem-nome")).toHaveText(nome);
    // O cliente como o semeador grava (`[e2e] Cliente de {nome}`, até 160 letras).
    const cliente = `[e2e] Cliente de ${nome}`.slice(0, 160);
    await expect(page.getByTestId("folha-ordem-para")).toHaveText(
      `para ${cliente} · orçamento nº ${numeroDoOrcamento}`,
    );
    // Aguardando o sinal: ainda não começou; a entrega prometida do orçamento aparece no selo.
    await expect(page.getByTestId("folha-ordem-inicio")).toHaveText("ainda não começou");
    await expect(page.getByTestId("folha-ordem-entrega")).toBeVisible();

    // Peças pela posição: Peça · Pedido · A mais · Fazer · Argila · Medidas (cm).
    await expect(page.getByTestId("folha-ordem-peca")).toHaveCount(2);
    const primeira = await celulas(page, 0);
    expect(primeira[0]).toContain(nomeDaPecaSemeada(nome, 0));
    expect(primeira[0]).toContain("Cor: azul-cobalto · com o nome gravado");
    expect(primeira.slice(1)).toEqual(["3", "1", "4", "450 g", "12 × 9 × 10"]);
    expect((await celulas(page, 1)).slice(1)).toEqual(["2", "0", "2", "450 g", "12 × 9 × 10"]);

    // A foto do orçamento, pela rota autenticada.
    const fotos = page.getByTestId("folha-ordem-referencias").locator("img");
    await expect(fotos).toHaveCount(1);
    await expect(fotos.first()).toHaveAttribute("src", `/gestao/api/orcamentos/fotos/${fotoId}`);

    // Seis etapas no caminho completo; material previsto em kg (6 feitas × 450 g = 2,7 kg).
    await expect(page.getByTestId("folha-ordem-etapa")).toHaveCount(6);
    await expect(page.getByTestId("folha-ordem-material")).toContainText("Argila: 2,7 kg");
    await expect(page.getByTestId("folha-ordem-no-fim")).toContainText("Extras boas:");
    await expect(page.getByTestId("folha-rodape")).toHaveText(
      /^AMASSA CERRADO · folha impressa em \d{2}\/\d{2}\/\d{4} · o que vale é o que está na plataforma$/,
    );

    // Folha de bancada: nenhum dinheiro — nem na folha, nem na página inteira.
    expect(await folha.innerText()).not.toContain("R$");
    expect(await page.locator("body").innerText()).not.toContain("R$");

    // No papel (UI-D20): o nome da ordem continua visível; a barra de botões, não.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("folha-ordem-nome")).toBeVisible();
    await expect(page.getByTestId("folha-barra")).toBeHidden();
  });

  test("(b) ordem da casa: Pedido —, A mais 0, Boas; sem entrega o selo some; sem foto as referências somem; a ordem leva à folha", async ({
    page,
  }) => {
    const nome = nomeUnico("Folha da casa");
    const ordemId = await semearOrdem({
      nome,
      tipo: "casa",
      caminho: "biscoito",
      status: "ativa",
      inicio: diaEmBrasilia(-3),
      etapasFeitas: [{ etapa: "producao", feitaEm: diaEmBrasilia(-1) }],
      pecas: [{ descricao: `${nome} · caneca`, quantidade: 4 }],
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);
    await page.getByTestId("ordem-imprimir-folha").click();
    await expect(page).toHaveURL(new RegExp(`/gestao/producao/${ordemId}/imprimir$`));

    await expect(page.getByTestId("folha-ordem-olho")).toHaveText(/^Produção da casa · ordem nº \d+$/);
    await expect(page.getByTestId("folha-ordem-para")).toHaveText("para a loja e o espaço");
    await expect(page.getByTestId("folha-ordem-entrega")).toHaveCount(0);
    await expect(page.getByTestId("folha-ordem-referencias")).toHaveCount(0);

    expect((await celulas(page, 0)).slice(1)).toEqual(["—", "0", "4", "—", "—"]);

    // Quatro etapas no caminho que termina no biscoito; a primeira marcada, com a data.
    await expect(page.getByTestId("folha-ordem-etapa")).toHaveCount(4);
    await expect(page.getByTestId("folha-ordem-etapa").first()).toHaveAttribute("data-feita", "true");
    await expect(page.getByTestId("folha-ordem-etapa").last()).toContainText("Guardar no estoque");

    await expect(page.getByTestId("folha-ordem-material")).toContainText(
      "Sem material previsto — nenhuma peça tem ficha.",
    );
    const noFim = page.getByTestId("folha-ordem-no-fim");
    await expect(noFim).toContainText("Boas:");
    await expect(noFim).not.toContainText("Extras boas");

    // "Voltar à ordem" leva de volta.
    await page.getByTestId("folha-voltar").click();
    await expect(page).toHaveURL(new RegExp(`/gestao/producao/${ordemId}$`));
  });

  test("(c) ordem inexistente: 404 do grupo protegido", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/producao/00000000-0000-0000-0000-000000000000/imprimir");
    await expect(page.getByRole("heading", { name: "Esta página não existe." })).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

import { semearMaterial, semearMovimentacoesEmMassa } from "./apoio/semear-estoque";
import {
  baixasDaOrdemNoBanco,
  diaEmBrasilia,
  semearBaixaDaOrdem,
  semearFicha,
  semearOrdem,
} from "./apoio/semear-producao";

// O bloco "Material usado" da ordem e a folha de baixa (Fase 06.1, plano 10, PRD-14, critério 5 do
// ROADMAP): o previsto sai da ficha (gramas × peças feitas, com as a mais), a baixa escolhe o
// material do Estoque pelo seletor "Qual material?" da Fase 06 e grava UMA movimentação no livro,
// ligada à ordem de verdade. Cada teste semeia os PRÓPRIOS dados com sufixo único (nenhuma
// afirmação global do banco). Nomes inventados com `[e2e]`.

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

type Cenario = { nome: string; ordemId: string; itemId: string; materialNome: string };

// Uma ficha com 350 g de argila e 40 g de esmalte, uma ordem ATIVA de 10 peças + 2 a mais dessa
// ficha (previsto: 4,2 kg de argila e 480 g de esmalte no caminho completo — o peso na regra do dono
// de 30/09/2026: gramas inteiras abaixo de 1 000 g, kg com até duas casas a partir dele) e um material em kg
// com 20 kg de saldo (20 entradas de 1 kg a R$ 1,00).
async function semearCenario(
  rotulo: string,
  caminho: "completo" | "biscoito" = "completo",
): Promise<Cenario> {
  const nome = nomeUnico(rotulo);
  const { fichaId } = await semearFicha({
    nome: `${nome} · ficha`,
    exclusiva: true,
    comItem: false,
    argilaMiligramas: 350_000,
    esmalteMiligramas: 40_000,
    larguraMm: 100,
    profundidadeMm: 100,
    alturaMm: 100,
    horasMilesimos: 500,
  });
  const ordemId = await semearOrdem({
    nome,
    tipo: "encomenda",
    caminho,
    status: "ativa",
    inicio: diaEmBrasilia(),
    etapasFeitas: [],
    pecas: [{ descricao: `${nome} · caneca`, quantidade: 10, aMais: 2, fichaId }],
    clienteNome: "[e2e] Cliente do material",
  });
  const materialNome = `${nome} · argila do estoque`;
  const itemId = await semearMaterial({
    nome: materialNome,
    unidade: "kg",
    categoriaCompra: "Argila, esmalte e insumos",
  });
  await semearMovimentacoesEmMassa(itemId, 20, process.env.E2E_EMAIL_TESTE ?? "");
  return { nome, ordemId, itemId, materialNome };
}

async function escolherMaterial(page: Page, cenario: Cenario) {
  const seletor = page.getByTestId("seletor-material");
  await expect(seletor).toBeVisible();
  await seletor.getByTestId("seletor-busca").fill(cenario.materialNome);
  await seletor.locator(`[data-testid="seletor-linha"][data-item-id="${cenario.itemId}"]`).click();
  await expect(seletor).toHaveCount(0);
}

test.describe("producao material", () => {
  test("(a) o bloco mostra o previsto certo em kg — argila e esmalte, com a dica", async ({
    page,
  }) => {
    const cenario = await semearCenario("Previsto");
    await fazerLogin(page);
    await page.goto(`/gestao/producao/${cenario.ordemId}`);

    const bloco = page.getByTestId("ordem-material");
    await expect(bloco.getByRole("heading", { name: "Material usado" })).toBeVisible();
    await expect(bloco).toContainText(
      'O previsto vem da ficha de cada peça (gramas × peças feitas, com as a mais). Dar baixa tira do Estoque como "consumo em encomenda", ligado a esta ordem.',
    );

    const argila = bloco.getByTestId("ordem-material-argila");
    await expect(argila).toContainText("Argila");
    await expect(argila.getByTestId("ordem-material-conta")).toHaveText("0 g de 4,2 kg");
    await expect(argila.getByTestId("ordem-material-situacao")).toHaveText(
      "faltam 4,2 kg do previsto",
    );
    const esmalte = bloco.getByTestId("ordem-material-esmalte");
    await expect(esmalte.getByTestId("ordem-material-conta")).toHaveText("0 g de 480 g");

    // Sem baixa: "Baixas feitas" não aparece; os botões são `outline` e existem os três.
    await expect(bloco.getByTestId("ordem-baixas-feitas")).toHaveCount(0);
    await expect(bloco.getByTestId("ordem-baixa-total-argila")).toBeEnabled();
    await expect(bloco.getByTestId("ordem-baixa-parcial-esmalte")).toBeVisible();
    await expect(bloco.getByTestId("ordem-baixa-outro")).toHaveText("+ Dar baixa de outro material");
  });

  test("(b) “Baixa total · argila” vem com o que falta; “Dar baixa” grava UMA movimentação ligada à ordem", async ({
    page,
  }) => {
    const cenario = await semearCenario("Baixa total");
    await fazerLogin(page);
    await page.goto(`/gestao/producao/${cenario.ordemId}`);

    const bloco = page.getByTestId("ordem-material");
    await bloco.getByTestId("ordem-baixa-total-argila").click();

    const folha = page.getByTestId("folha-baixa");
    await expect(folha.getByRole("heading", { name: "Baixa total · argila" })).toBeVisible();
    await expect(folha.getByTestId("folha-baixa-resumo")).toHaveText(
      "Previsto 4,2 kg · já baixado 0 g · faltam 4,2 kg.",
    );
    // Sem baixa anterior, sem pré-escolha: o botão largo abre o seletor da Fase 06.
    await folha.getByTestId("folha-baixa-escolher").click();
    await escolherMaterial(page, cenario);

    await expect(folha.getByTestId("folha-baixa-escolhido")).toContainText(cenario.materialNome);
    await expect(folha.getByTestId("folha-baixa-escolhido")).toContainText("saldo de agora: 20 kg");
    // Preenchido com o que falta, na unidade do item.
    await expect(folha.getByTestId("folha-baixa-quanto")).toHaveValue("4,2");
    await expect(folha.getByTestId("folha-previa")).toHaveText(
      `O saldo de ${cenario.materialNome} passa de 20 para 15,8 kg.`,
    );

    await folha.getByTestId("folha-baixa-dar").click();
    await expect(page.getByText(`Baixa registrada: 4,2 kg de ${cenario.materialNome}.`)).toBeVisible();
    await expect(page.getByTestId("folha-baixa")).toHaveCount(0);

    const argila = bloco.getByTestId("ordem-material-argila");
    await expect(argila.getByTestId("ordem-material-conta")).toHaveText("4,2 kg de 4,2 kg");
    await expect(argila.getByTestId("ordem-material-situacao")).toHaveText("previsto todo baixado");
    await expect(bloco.getByTestId("ordem-baixa-total-argila")).toBeDisabled();
    const feitas = bloco.getByTestId("ordem-baixas-feitas");
    await expect(feitas.getByTestId("ordem-baixa-feita")).toHaveCount(1);
    await expect(feitas).toContainText(cenario.materialNome);
    await expect(feitas).toContainText("4,2 kg");

    // No livro: UMA saída manual "consumo em encomenda", ligada à ordem, com o material e o nome.
    const noBanco = await baixasDaOrdemNoBanco(cenario.ordemId);
    expect(noBanco).toEqual([
      {
        itemId: cenario.itemId,
        origem: "manual",
        tipo: "saida",
        destino: "encomenda",
        area: "pecas",
        quantidadeMilesimos: -4200,
        encomendaId: cenario.ordemId,
        materialDaOrdem: "argila",
        nota: cenario.nome,
      },
    ]);
  });

  test("(c) a segunda baixa de argila já vem com o material escolhido; passar do previsto avisa", async ({
    page,
  }) => {
    const cenario = await semearCenario("Segunda baixa");
    // A primeira baixa (1 kg de argila) já está no livro.
    await semearBaixaDaOrdem(cenario.ordemId, cenario.itemId);
    await fazerLogin(page);
    await page.goto(`/gestao/producao/${cenario.ordemId}`);

    const bloco = page.getByTestId("ordem-material");
    const argila = bloco.getByTestId("ordem-material-argila");
    await expect(argila.getByTestId("ordem-material-conta")).toHaveText("1 kg de 4,2 kg");
    await expect(argila.getByTestId("ordem-material-situacao")).toHaveText(
      "faltam 3,2 kg do previsto",
    );

    // "Baixa total": pré-escolhido e preenchido com o que falta.
    await bloco.getByTestId("ordem-baixa-total-argila").click();
    const folha = page.getByTestId("folha-baixa");
    await expect(folha.getByTestId("folha-baixa-escolhido")).toHaveAttribute(
      "data-item-id",
      cenario.itemId,
    );
    await expect(folha.getByTestId("folha-baixa-quanto")).toHaveValue("3,2");
    await folha.getByTestId("folha-baixa-voltar").click();
    await expect(page.getByTestId("folha-baixa")).toHaveCount(0);

    // "Baixa parcial": o mesmo material, o campo vazio.
    await bloco.getByTestId("ordem-baixa-parcial-argila").click();
    await expect(folha.getByRole("heading", { name: "Baixa parcial · argila" })).toBeVisible();
    await expect(folha.getByTestId("folha-baixa-escolhido")).toHaveAttribute(
      "data-item-id",
      cenario.itemId,
    );
    await expect(folha.getByTestId("folha-baixa-quanto")).toHaveValue("");
    await folha.getByTestId("folha-baixa-quanto").fill("3,5");
    await folha.getByTestId("folha-baixa-dar").click();
    await expect(page.getByText(`Baixa registrada: 3,5 kg de ${cenario.materialNome}.`)).toBeVisible();

    await expect(argila.getByTestId("ordem-material-conta")).toHaveText("4,5 kg de 4,2 kg");
    await expect(argila.getByTestId("ordem-material-situacao")).toHaveText(
      "gastou 300 g a mais que o previsto",
    );
    await expect(bloco.getByTestId("ordem-baixa-total-argila")).toBeDisabled();
    await expect(bloco.getByTestId("ordem-baixas-feitas").getByTestId("ordem-baixa-feita")).toHaveCount(2);
  });

  test("(d) ordem do caminho “termina no biscoito” não mostra a linha de esmalte", async ({
    page,
  }) => {
    const cenario = await semearCenario("Biscoito", "biscoito");
    await fazerLogin(page);
    await page.goto(`/gestao/producao/${cenario.ordemId}`);

    const bloco = page.getByTestId("ordem-material");
    await expect(bloco.getByTestId("ordem-material-argila").getByTestId("ordem-material-conta")).toHaveText(
      "0 g de 4,2 kg",
    );
    await expect(bloco.getByTestId("ordem-material-esmalte")).toHaveCount(0);
    await expect(bloco.getByTestId("ordem-baixa-parcial-esmalte")).toHaveCount(0);
  });

  test("(e) “+ Dar baixa de outro material” grava ligada à ordem, sem material_da_ordem", async ({
    page,
  }) => {
    const cenario = await semearCenario("Outro material");
    await fazerLogin(page);
    await page.goto(`/gestao/producao/${cenario.ordemId}`);

    const bloco = page.getByTestId("ordem-material");
    await bloco.getByTestId("ordem-baixa-outro").click();
    const folha = page.getByTestId("folha-baixa");
    await expect(folha.getByRole("heading", { name: "Dar baixa de outro material" })).toBeVisible();
    await expect(folha.getByTestId("folha-baixa-resumo")).toHaveCount(0);

    // Sem material: a folha avisa embaixo do campo e continua aberta.
    await folha.getByTestId("folha-baixa-dar").click();
    await expect(folha.getByTestId("folha-baixa-erro")).toHaveText("Escolha o material do estoque.");

    await folha.getByTestId("folha-baixa-escolher").click();
    await escolherMaterial(page, cenario);
    await expect(folha.getByTestId("folha-baixa-quanto")).toHaveValue("");
    await folha.getByTestId("folha-baixa-quanto").fill("1");
    await folha.getByTestId("folha-baixa-dar").click();
    await expect(page.getByText(`Baixa registrada: 1 kg de ${cenario.materialNome}.`)).toBeVisible();

    // A baixa de outro material não entra na conta da argila, mas aparece em "Baixas feitas".
    await expect(
      bloco.getByTestId("ordem-material-argila").getByTestId("ordem-material-conta"),
    ).toHaveText("0 g de 4,2 kg");
    await expect(bloco.getByTestId("ordem-baixas-feitas").getByTestId("ordem-baixa-feita")).toHaveCount(1);

    const noBanco = await baixasDaOrdemNoBanco(cenario.ordemId);
    expect(noBanco).toHaveLength(1);
    expect(noBanco[0]).toMatchObject({
      itemId: cenario.itemId,
      origem: "manual",
      destino: "encomenda",
      quantidadeMilesimos: -1000,
      encomendaId: cenario.ordemId,
      materialDaOrdem: null,
      nota: cenario.nome,
    });
  });

  test("(f) toque duplo em “Dar baixa” grava uma só", async ({ page }) => {
    const cenario = await semearCenario("Toque duplo");
    await fazerLogin(page);
    await page.goto(`/gestao/producao/${cenario.ordemId}`);

    const bloco = page.getByTestId("ordem-material");
    await bloco.getByTestId("ordem-baixa-parcial-argila").click();
    const folha = page.getByTestId("folha-baixa");
    await folha.getByTestId("folha-baixa-escolher").click();
    await escolherMaterial(page, cenario);
    await folha.getByTestId("folha-baixa-quanto").fill("1");
    await folha.getByTestId("folha-baixa-dar").dblclick();
    await expect(page.getByText(`Baixa registrada: 1 kg de ${cenario.materialNome}.`)).toBeVisible();

    await page.reload();
    await expect(
      page.getByTestId("ordem-material-argila").getByTestId("ordem-material-conta"),
    ).toHaveText("1 kg de 4,2 kg");
    expect(await baixasDaOrdemNoBanco(cenario.ordemId)).toHaveLength(1);
  });
});

import { test, expect, type Page } from "@playwright/test";

import {
  diaEmBrasilia,
  ordemNoBanco,
  ordensComONomeNoBanco,
  origemDasPecasNoBanco,
  semearFicha,
  semearItemDoEstoque,
} from "./apoio/semear-producao";

// A "Nova ordem" (Fase 06.1, plano 07, PRD-09 com D-04/D-05/D-11/D-13/D-14): a produção da casa só
// com peça do catálogo e a encomenda de boca com ficha ou texto livre, várias peças, e a ordem
// nascendo ATIVA com início hoje — pelo caminho inteiro: tela → `criarOrdem` (conferência no banco)
// → a página da ordem nova. Cada teste semeia as PRÓPRIAS fichas e itens com sufixo único e conta
// as ordens pelo NOME único que ele mesmo escreveu — nenhuma afirmação global do banco. Nomes
// inventados com `[e2e]`.

const TOAST_ORDEM_CRIADA = "Ordem criada.";
const NOTA_PECA_SEM_FICHA =
  "Sem ficha de precificação: esta peça fica sem material previsto e fora da estimativa do forno.";
const FRASE_PECAS_TIRADAS = "As peças que só servem a encomenda foram tiradas.";
const FRASE_NOME_VAZIO = "Dê um nome à ordem.";
const FRASE_CLIENTE_VAZIO = "Diga para quem é a encomenda.";
const FRASE_ENTREGA_NO_PASSADO = "A entrega prometida precisa ser hoje ou depois.";

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

function semearFichaDeLinha(nome: string) {
  return semearFicha({
    nome,
    exclusiva: false,
    comItem: true,
    argilaMiligramas: 350000,
    esmalteMiligramas: 40000,
    larguraMm: 90,
    profundidadeMm: 90,
    alturaMm: 100,
    horasMilesimos: 500,
  });
}

function semearFichaExclusiva(nome: string) {
  return semearFicha({
    nome,
    exclusiva: true,
    comItem: false,
    argilaMiligramas: 450000,
    esmalteMiligramas: 60000,
    larguraMm: 120,
    profundidadeMm: 90,
    alturaMm: 100,
    horasMilesimos: 600,
  });
}

// Abre a folha pelo botão da Produção (no cabeçalho, ou no estado vazio — nunca os dois) e espera
// o catálogo chegar (o seletor da 1ª peça aparece no lugar dos esqueletos).
async function abrirFolha(page: Page) {
  await page.goto("/gestao/producao");
  await page.getByTestId("nova-ordem-abrir").click();
  const folha = page.getByTestId("folha-nova-ordem");
  await expect(folha).toBeVisible();
  await expect(page).toHaveURL(/[?&]nova=1/);
  await expect(folha.getByTestId("nova-ordem-peca-1")).toBeVisible();
  return folha;
}

async function escolherPeca(page: Page, numero: number, nomeDaOpcao: string) {
  await page.getByTestId(`nova-ordem-peca-${numero}`).click();
  await page.getByRole("option", { name: nomeDaOpcao, exact: true }).click();
  await expect(page.getByTestId(`nova-ordem-peca-${numero}`)).toContainText(nomeDaOpcao);
}

async function esperarOrdemCriada(page: Page, nome: string): Promise<string> {
  await expect(page.getByText(TOAST_ORDEM_CRIADA)).toBeVisible();
  await expect(page).toHaveURL(/\/gestao\/producao\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
  const ids = await ordensComONomeNoBanco(nome);
  expect(ids).toHaveLength(1);
  expect(page.url()).toContain(ids[0]);
  return ids[0];
}

test.describe("producao nova ordem", () => {
  test("(a) produção da casa com uma peça de linha: nasce ativa, com início hoje, e aparece na coluna Produção", async ({
    page,
  }) => {
    const nomeDaFicha = nomeUnico("Caneca de linha");
    const { fichaId } = await semearFichaDeLinha(nomeDaFicha);
    const nome = nomeUnico("Reposição de canecas");
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("nova-ordem-tipo-casa")).toHaveAttribute("aria-checked", "true");
    await expect(folha.getByTestId("nova-ordem-caminho-completo")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // Cliente só existe na encomenda.
    await expect(folha.getByTestId("nova-ordem-cliente")).toHaveCount(0);

    await folha.getByTestId("nova-ordem-nome").fill(nome);
    await escolherPeca(page, 1, nomeDaFicha);
    await expect(folha.getByTestId("nova-ordem-nota-sem-ficha-1")).toHaveCount(0);
    await folha.getByTestId("nova-ordem-quantidade-1").fill("12");
    await folha.getByTestId("nova-ordem-criar").click();

    const ordemId = await esperarOrdemCriada(page, nome);
    expect(await ordemNoBanco(ordemId)).toEqual({
      tipo: "casa",
      caminho: "completo",
      status: "ativa",
      nome,
      clienteNome: null,
      entregaPrometida: null,
      inicio: hoje,
    });
    expect(await origemDasPecasNoBanco(ordemId)).toEqual([
      { descricao: nomeDaFicha, quantidade: 12, fichaId, itemId: null },
    ]);
    await expect(page.getByTestId("ordem-etapa-producao")).toHaveAttribute("data-estado", "atual");

    await page.goto("/gestao/producao");
    const cartao = page
      .getByTestId("producao-coluna-producao")
      .locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`);
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(nome);
  });

  test("(b) encomenda de boca com uma peça escrita e outra exclusiva: duas peças, na ordem escrita", async ({
    page,
  }) => {
    const nomeDaExclusiva = nomeUnico("Travessa exclusiva");
    const { fichaId } = await semearFichaExclusiva(nomeDaExclusiva);
    const nome = nomeUnico("Pratos da Fulana");
    const cliente = nomeUnico("Fulana");
    const pecaEscrita = nomeUnico("Prato fundo");
    const entrega = diaEmBrasilia(20);

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await folha.getByTestId("nova-ordem-nome").fill(nome);
    await folha.getByTestId("nova-ordem-tipo-encomenda").click();
    await folha.getByTestId("nova-ordem-caminho-biscoito").click();
    await folha.getByTestId("nova-ordem-cliente").fill(cliente);
    await folha.getByTestId("nova-ordem-entrega").fill(entrega);

    await escolherPeca(page, 1, "Outra peça — escrever o nome");
    await folha.getByTestId("nova-ordem-peca-nome-1").fill(pecaEscrita);
    await folha.getByTestId("nova-ordem-quantidade-1").fill("6");
    await expect(folha.getByTestId("nova-ordem-nota-sem-ficha-1")).toHaveText(NOTA_PECA_SEM_FICHA);

    // Uma peça só: sem "X". Da segunda em diante, com.
    await expect(folha.getByTestId("nova-ordem-tirar-1")).toHaveCount(0);
    await folha.getByTestId("nova-ordem-outra-peca").click();
    await expect(folha.getByTestId("nova-ordem-tirar-2")).toHaveAttribute(
      "aria-label",
      "Tirar a peça 2",
    );
    await escolherPeca(page, 2, nomeDaExclusiva);
    await expect(folha.getByTestId("nova-ordem-tirar-2")).toHaveAttribute(
      "aria-label",
      `Tirar ${nomeDaExclusiva}`,
    );
    await folha.getByTestId("nova-ordem-quantidade-2").fill("2");
    await expect(folha.getByTestId("nova-ordem-nota-sem-ficha-2")).toHaveCount(0);
    await expect(folha.getByTestId("nova-ordem-nota-sem-ficha-1")).toBeVisible();

    await folha.getByTestId("nova-ordem-criar").click();
    const ordemId = await esperarOrdemCriada(page, nome);
    expect(await ordemNoBanco(ordemId)).toEqual({
      tipo: "encomenda",
      caminho: "biscoito",
      status: "ativa",
      nome,
      clienteNome: cliente,
      entregaPrometida: entrega,
      inicio: diaEmBrasilia(),
    });
    expect(await origemDasPecasNoBanco(ordemId)).toEqual([
      { descricao: pecaEscrita, quantidade: 6, fichaId: null, itemId: null },
      { descricao: nomeDaExclusiva, quantidade: 2, fichaId, itemId: null },
    ]);
  });

  test("(c) nome vazio, encomenda sem cliente e entrega de ontem: as três frases embaixo dos campos, nada gravado", async ({
    page,
  }) => {
    const nome = nomeUnico("Não deve existir");

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await folha.getByTestId("nova-ordem-tipo-encomenda").click();
    await folha.getByTestId("nova-ordem-entrega").fill(diaEmBrasilia(-1));
    await escolherPeca(page, 1, "Outra peça — escrever o nome");
    await folha.getByTestId("nova-ordem-peca-nome-1").fill("Caneca");
    await folha.getByTestId("nova-ordem-criar").click();

    const erro = (campo: string) =>
      folha.locator(`[data-testid="nova-ordem-erro"][data-campo="${campo}"]`);
    await expect(erro("nome")).toHaveText(FRASE_NOME_VAZIO);
    await expect(erro("clienteNome")).toHaveText(FRASE_CLIENTE_VAZIO);
    await expect(erro("entregaPrometida")).toHaveText(FRASE_ENTREGA_NO_PASSADO);
    await expect(erro("nome")).toHaveAttribute("role", "alert");
    await expect(folha.getByTestId("nova-ordem-nome")).toHaveAttribute("aria-invalid", "true");

    // Com o nome preenchido, o cliente e a entrega continuam barrando — e nada chega ao banco.
    await folha.getByTestId("nova-ordem-nome").fill(nome);
    await folha.getByTestId("nova-ordem-criar").click();
    await expect(erro("clienteNome")).toHaveText(FRASE_CLIENTE_VAZIO);
    await expect(erro("entregaPrometida")).toHaveText(FRASE_ENTREGA_NO_PASSADO);
    await expect(erro("nome")).toHaveCount(0);
    await expect(folha).toBeVisible();
    await expect(page).toHaveURL(/[?&]nova=1/);
    expect(await ordensComONomeNoBanco(nome)).toEqual([]);
  });

  test("(d) trocar para Produção da casa tira a peça escrita e anuncia", async ({ page }) => {
    const nomeDaFicha = nomeUnico("Tigela de linha");
    await semearFichaDeLinha(nomeDaFicha);

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await folha.getByTestId("nova-ordem-tipo-encomenda").click();
    await escolherPeca(page, 1, "Outra peça — escrever o nome");
    await folha.getByTestId("nova-ordem-peca-nome-1").fill("Peça escrita à mão");
    await folha.getByTestId("nova-ordem-outra-peca").click();
    await escolherPeca(page, 2, nomeDaFicha);

    const aviso = folha.getByTestId("nova-ordem-aviso");
    await expect(aviso).toHaveAttribute("role", "status");
    await folha.getByTestId("nova-ordem-tipo-casa").click();

    await expect(aviso).toHaveText(FRASE_PECAS_TIRADAS);
    await expect(folha.getByTestId("nova-ordem-linha-2")).toHaveCount(0);
    await expect(folha.getByTestId("nova-ordem-peca-1")).toContainText(nomeDaFicha);
    await expect(folha.getByTestId("nova-ordem-peca-nome-1")).toHaveCount(0);
    await expect(folha.getByTestId("nova-ordem-cliente")).toHaveCount(0);
  });

  test("(e) dois cliques em “Criar ordem” criam UMA ordem", async ({ page }) => {
    const nomeDaFicha = nomeUnico("Prato de linha");
    await semearFichaDeLinha(nomeDaFicha);
    const nome = nomeUnico("Toque duplo");

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await folha.getByTestId("nova-ordem-nome").fill(nome);
    await escolherPeca(page, 1, nomeDaFicha);
    await folha.getByTestId("nova-ordem-criar").dblclick();

    await esperarOrdemCriada(page, nome);
    // Um instante a mais para um eventual segundo pedido chegar ao banco — não deve haver nenhum.
    await page.waitForTimeout(1000);
    expect(await ordensComONomeNoBanco(nome)).toHaveLength(1);
  });

  test("(f) /gestao/producao?nova=1 abre a folha, e “Voltar” fecha", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/producao?nova=1");
    const folha = page.getByTestId("folha-nova-ordem");
    await expect(folha).toBeVisible();
    await expect(folha.getByRole("heading", { name: "Nova ordem" })).toBeVisible();
    await expect(folha.getByTestId("nova-ordem-peca-1")).toBeVisible();

    await folha.getByTestId("nova-ordem-voltar").click();
    await expect(folha).toHaveCount(0);
    await expect(page).not.toHaveURL(/nova=1/);
  });

  test("(g) item do estoque sem ficha na produção da casa mostra a nota do D-14", async ({
    page,
  }) => {
    const nomeDoItem = nomeUnico("Pote de cerâmica");
    const itemId = await semearItemDoEstoque({ nome: nomeDoItem });
    const nome = nomeUnico("Potes para a loja");

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await folha.getByTestId("nova-ordem-nome").fill(nome);
    await escolherPeca(page, 1, nomeDoItem);
    await expect(folha.getByTestId("nova-ordem-nota-sem-ficha-1")).toHaveText(NOTA_PECA_SEM_FICHA);
    await folha.getByTestId("nova-ordem-quantidade-1").fill("4");
    await folha.getByTestId("nova-ordem-criar").click();

    const ordemId = await esperarOrdemCriada(page, nome);
    expect(await origemDasPecasNoBanco(ordemId)).toEqual([
      { descricao: nomeDoItem, quantidade: 4, fichaId: null, itemId },
    ]);
  });
});

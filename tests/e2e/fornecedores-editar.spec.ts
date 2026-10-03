import { test, expect, type Page } from "@playwright/test";

import {
  ativoNoBanco,
  fornecedorNoBanco,
  idDoUsuarioDoTeste,
  semearFornecedor,
} from "./apoio/semear-fornecedores";

// Cadastros → Fornecedores, manter o cadastro (06.2-04-PLAN.md, Tarefa 1; FRN-02, FRN-03; UI-D20,
// UI-D21, UI-D27): editar pela folha do plano 02, desativar com a confirmação que diz o que fica, e
// reativar sem confirmação — e o fornecedor nunca sai do banco. As bordas: reativar um nome que hoje é
// de outro ativo (Pitfall 11), editar o nome para o de outro ativo, editar um desativado, a
// confirmação que falha (sem rede) e desativar duas vezes de duas abas (idempotência).
//
// Nenhum teste aqui afirma condição global do banco: todos usam nomes com prefixo `[e2e]` e sufixo
// único, e só olham as linhas que semearam (CLAUDE.md).

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

function enderecoDaFicha(id: string): string {
  return `/gestao/cadastros?sub=fornecedores&fornecedor=${id}`;
}

function linhaDe(page: Page, id: string) {
  return page.locator(`[data-testid="fornecedor-linha"][data-fornecedor-id="${id}"]`);
}

// Abre a ficha de um fornecedor e espera ela desenhar (o h2 com o nome).
async function abrirFicha(page: Page, id: string, nome: string) {
  await page.goto(enderecoDaFicha(id));
  const ficha = page.getByTestId("fornecedor-ficha");
  await expect(ficha).toHaveAttribute("data-fornecedor-id", id);
  await expect(ficha.getByRole("heading", { level: 2, name: nome })).toBeVisible();
  return ficha;
}

const CORPO_DA_CONFIRMACAO =
  "Ele some da lista e do campo “Fornecedor” da Despesa. Os anexos, as observações e as despesas ligadas a ele ficam guardados; dá para reativar depois.";
const FRASE_NOME_REPETIDO =
  "Já existe um fornecedor ativo com esse nome. Use outro nome — ou abra o que já existe na lista.";
const FRASE_REATIVAR_NOME_REPETIDO =
  "Já existe um fornecedor ativo com esse nome. Renomeie um dos dois antes de reativar.";

test.describe("fornecedores editar e desativar", () => {
  test("(a) Editar abre a folha com os valores atuais; trocar “O que vende” grava e as etiquetas mudam", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Editável ${suf}`;
    const id = await semearFornecedor({
      nome,
      vende: "argila",
      area: "loja",
      cidadeEntrega: "Cidade de teste",
      pessoaContato: "Pessoa de teste",
    });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nome);
    await ficha.getByRole("button", { name: `Editar ${nome}` }).click();

    const folha = page.getByTestId("folha-fornecedor");
    await expect(folha.getByRole("heading", { name: "Editar fornecedor" })).toBeVisible();
    await expect(folha.getByLabel("Nome", { exact: true })).toHaveValue(nome);
    await expect(folha.getByLabel("O que vende")).toHaveValue("argila");
    await expect(folha.getByRole("combobox", { name: "Área que mais usa" })).toContainText("Loja");
    await expect(folha.getByLabel("Cidade / entrega")).toHaveValue("Cidade de teste");
    await expect(folha.getByLabel("Pessoa de contato")).toHaveValue("Pessoa de teste");

    await folha.getByLabel("O que vende").fill("esmalte, caulim");
    await folha.getByRole("button", { name: "Salvar fornecedor" }).click();

    await expect(page.getByText("Fornecedor atualizado.").first()).toBeVisible();
    await expect(folha).toBeHidden();
    const etiquetas = ficha.getByTestId("fornecedor-etiquetas");
    await expect(etiquetas).toContainText("esmalte");
    await expect(etiquetas).toContainText("caulim");
    await expect(etiquetas).not.toContainText("argila");

    const noBanco = await fornecedorNoBanco(id);
    expect(noBanco?.vende).toBe("esmalte, caulim");
    expect(noBanco?.area).toBe("loja");
    expect(noBanco?.ativo).toBe(true);
  });

  test("(b) Desativar confirma dizendo o que fica; a ficha mostra o desativado, a lista o esconde, e o banco o guarda", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Desativável ${suf}`;
    const id = await semearFornecedor({ nome, vende: "argila" });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nome);
    await page.getByTestId("fornecedores-busca").fill(suf);
    await expect(linhaDe(page, id)).toHaveCount(1);

    await ficha.getByRole("button", { name: `Desativar ${nome}` }).click();
    const confirmacao = page.getByTestId("confirmar-desativar-fornecedor");
    await expect(confirmacao.getByRole("heading", { name: `Desativar ${nome}?` })).toBeVisible();
    await expect(confirmacao).toContainText(CORPO_DA_CONFIRMACAO);
    // "Voltar" é o primeiro na ordem de foco e recebe o foco inicial — nunca a ação.
    await expect(confirmacao.getByRole("button", { name: "Voltar" })).toBeFocused();

    await confirmacao.getByRole("button", { name: "Desativar fornecedor" }).click();

    await expect(page.getByText("Fornecedor desativado.").first()).toBeVisible();
    await expect(confirmacao).toBeHidden();
    // A ficha continua aberta, agora com o selo e o "Reativar".
    await expect(ficha).toHaveAttribute("data-fornecedor-id", id);
    await expect(ficha.getByTestId("fornecedor-selo-desativado")).toBeVisible();
    await expect(ficha.getByRole("button", { name: `Reativar ${nome}` })).toBeVisible();
    await expect(ficha.getByRole("button", { name: `Desativar ${nome}` })).toHaveCount(0);
    // A lista (sem "mostrar desativados") não tem mais a linha — a busca continua com o sufixo.
    await expect(page.getByTestId("fornecedores-busca")).toHaveValue(suf);
    await expect(linhaDe(page, id)).toHaveCount(0);

    // No banco a linha CONTINUA, com `ativo = false` e o autor da mudança.
    expect(await ativoNoBanco(id)).toBe(false);
    const noBanco = await fornecedorNoBanco(id);
    expect(noBanco).not.toBeNull();
    expect(noBanco?.atualizadoPor).toBe(await idDoUsuarioDoTeste());
  });

  test("(c) Reativar, sem confirmação, volta o fornecedor para a lista", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Reativável ${suf}`;
    const id = await semearFornecedor({ nome, ativo: false });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nome);
    await expect(ficha.getByTestId("fornecedor-selo-desativado")).toBeVisible();
    await page.getByTestId("fornecedores-busca").fill(suf);
    await expect(linhaDe(page, id)).toHaveCount(0);

    await ficha.getByRole("button", { name: `Reativar ${nome}` }).click();

    await expect(page.getByText("Fornecedor reativado.").first()).toBeVisible();
    await expect(page.getByTestId("confirmar-desativar-fornecedor")).toHaveCount(0);
    await expect(ficha.getByTestId("fornecedor-selo-desativado")).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: `Desativar ${nome}` })).toBeVisible();
    await expect(linhaDe(page, id)).toHaveCount(1);
    expect(await ativoNoBanco(id)).toBe(true);
  });

  test("(d) Reativar um nome que hoje é de outro ativo não reativa e diz o que fazer (Pitfall 11)", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoDesativado = `[e2e] Nome ${suf}`;
    const idDoDesativado = await semearFornecedor({ nome: nomeDoDesativado, ativo: false });
    // O mesmo nome em outra caixa, com acento e com espaço no fim — `nome_normalizado(nome)` os
    // iguala (D-06, troca do dono no chat, 03/10/2026: acento não conta).
    await semearFornecedor({ nome: `[E2E] nóme ${suf.toUpperCase()} ` });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, idDoDesativado, nomeDoDesativado);
    await ficha.getByRole("button", { name: `Reativar ${nomeDoDesativado}` }).click();

    const alerta = ficha.getByTestId("fornecedor-erro-reativar");
    await expect(alerta).toHaveText(FRASE_REATIVAR_NOME_REPETIDO);
    await expect(alerta).toHaveAttribute("role", "alert");
    await expect(ficha.getByTestId("fornecedor-selo-desativado")).toBeVisible();
    await expect(ficha.getByRole("button", { name: `Reativar ${nomeDoDesativado}` })).toBeEnabled();
    expect(await ativoNoBanco(idDoDesativado)).toBe(false);
  });

  test("(e) Editar o Nome para o de outro ativo em outra caixa volta com a frase embaixo do Nome, folha aberta", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoAlfa = `[e2e] Alfa ${suf}`;
    const nomeDoBeta = `[e2e] Beta ${suf}`;
    await semearFornecedor({ nome: nomeDoAlfa });
    const idDoBeta = await semearFornecedor({ nome: nomeDoBeta, vende: "feldspato" });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, idDoBeta, nomeDoBeta);
    await ficha.getByRole("button", { name: `Editar ${nomeDoBeta}` }).click();

    const folha = page.getByTestId("folha-fornecedor");
    const campoNome = folha.getByLabel("Nome", { exact: true });
    const repetido = `  ${nomeDoAlfa.toUpperCase()}  `;
    await campoNome.fill(repetido);
    await folha.getByRole("button", { name: "Salvar fornecedor" }).click();

    await expect(folha.getByTestId("fornecedor-erro-nome")).toHaveText(FRASE_NOME_REPETIDO);
    await expect(folha).toBeVisible();
    await expect(campoNome).toHaveValue(repetido);
    await expect(folha.getByLabel("O que vende")).toHaveValue("feldspato");
    expect((await fornecedorNoBanco(idDoBeta))?.nome).toBe(nomeDoBeta);
  });

  test("(f) Editar um desativado grava e ele continua desativado", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Parado ${suf}`;
    const id = await semearFornecedor({ nome, vende: "argila", ativo: false });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nome);
    await ficha.getByRole("button", { name: `Editar ${nome}` }).click();

    const folha = page.getByTestId("folha-fornecedor");
    await expect(folha.getByRole("heading", { name: "Editar fornecedor" })).toBeVisible();
    await folha.getByLabel("O que vende").fill("engobe");
    await folha.getByRole("button", { name: "Salvar fornecedor" }).click();

    await expect(page.getByText("Fornecedor atualizado.").first()).toBeVisible();
    await expect(folha).toBeHidden();
    await expect(ficha.getByTestId("fornecedor-etiquetas")).toContainText("engobe");
    await expect(ficha.getByTestId("fornecedor-selo-desativado")).toBeVisible();
    await expect(ficha.getByRole("button", { name: `Reativar ${nome}` })).toBeVisible();
    expect(await ativoNoBanco(id)).toBe(false);
    expect((await fornecedorNoBanco(id))?.vende).toBe("engobe");
  });

  test("(g) a confirmação que falha mostra o erro dentro do diálogo, que continua aberto", async ({
    page,
    context,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Sem rede ${suf}`;
    const id = await semearFornecedor({ nome });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nome);
    await ficha.getByRole("button", { name: `Desativar ${nome}` }).click();
    const confirmacao = page.getByTestId("confirmar-desativar-fornecedor");
    await expect(confirmacao.getByRole("heading", { name: `Desativar ${nome}?` })).toBeVisible();

    await context.setOffline(true);
    try {
      await confirmacao.getByRole("button", { name: "Desativar fornecedor" }).click();
      await expect(confirmacao.getByTestId("confirmar-desativar-fornecedor-erro")).toHaveText(
        "Não deu para desativar. Verifique a internet e tente de novo.",
      );
      await expect(confirmacao).toBeVisible();
      await expect(confirmacao.getByRole("button", { name: "Voltar" })).toBeEnabled();
      await expect(confirmacao.getByRole("button", { name: "Desativar fornecedor" })).toBeEnabled();
    } finally {
      await context.setOffline(false);
    }

    await confirmacao.getByRole("button", { name: "Voltar" }).click();
    await expect(confirmacao).toBeHidden();
    await expect(ficha.getByRole("button", { name: `Desativar ${nome}` })).toBeVisible();
    expect(await ativoNoBanco(id)).toBe(true);
  });

  test("(h) desativar de novo numa aba desatualizada não dá erro e o banco continua desativado", async ({
    page,
    context,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Duas abas ${suf}`;
    const id = await semearFornecedor({ nome });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nome);
    const outraAba = await context.newPage();
    const fichaDaOutra = await abrirFicha(outraAba, id, nome);

    await ficha.getByRole("button", { name: `Desativar ${nome}` }).click();
    await page
      .getByTestId("confirmar-desativar-fornecedor")
      .getByRole("button", { name: "Desativar fornecedor" })
      .click();
    await expect(page.getByText("Fornecedor desativado.").first()).toBeVisible();
    expect(await ativoNoBanco(id)).toBe(false);

    // A segunda aba ainda mostra "Desativar": desativa de novo — o estado desejado, não "inverter".
    await fichaDaOutra.getByRole("button", { name: `Desativar ${nome}` }).click();
    const confirmacaoDaOutra = outraAba.getByTestId("confirmar-desativar-fornecedor");
    await confirmacaoDaOutra.getByRole("button", { name: "Desativar fornecedor" }).click();
    await expect(outraAba.getByText("Fornecedor desativado.").first()).toBeVisible();
    await expect(confirmacaoDaOutra).toBeHidden();
    await expect(outraAba.getByTestId("confirmar-desativar-fornecedor-erro")).toHaveCount(0);
    await expect(fichaDaOutra.getByTestId("fornecedor-selo-desativado")).toBeVisible();
    expect(await ativoNoBanco(id)).toBe(false);
  });
});

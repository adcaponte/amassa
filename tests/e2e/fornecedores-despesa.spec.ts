import { test, expect, type Page } from "@playwright/test";

import { semearItem } from "./apoio/semear-financeiro";
import {
  documentoNoBanco,
  idDoDocumentoComLinha,
  renomearFornecedorNoBanco,
  semearFornecedor,
} from "./apoio/semear-fornecedores";

// A despesa ligada ao fornecedor (06.2-10-PLAN.md; FRN-12, D-04): no Financeiro → Despesa → Compra de
// material, o campo "Fornecedor (opcional)" sugere os fornecedores ATIVOS; escolher um liga a despesa a
// ele (`documentos.fornecedor_id`) e grava o nome do CADASTRO em `pessoa_nome`; digitar depois desliga;
// texto livre — mesmo igual ao nome de um ativo — grava só o nome (UI-D4). Os auxiliares de Despesa são
// cópias dos de `financeiro-despesa.spec.ts` (que roda na mesma invocação e NÃO muda). Cada caso semeia
// os próprios itens e fornecedores com sufixo único; nada aqui depende do estado global do banco.

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

async function irParaDespesa(page: Page) {
  await page.goto("/gestao/financeiro?aba=despesa");
}

function atalhoDeCompra(page: Page, nome: string) {
  return page.getByTestId("compra-atalho").filter({ hasText: nome });
}

const botaoLancar = (page: Page) => page.getByRole("button", { name: "Lançar despesa" });

const campoFornecedor = (page: Page) => page.getByLabel("Fornecedor (opcional)");
const opcoesDoCampo = (page: Page) => page.getByTestId("despesa-fornecedor-opcao");
const linhaDeVinculo = (page: Page) => page.getByTestId("despesa-fornecedor-vinculo");

const FRASE_LIGADO = "Fornecedor do cadastro — esta despesa vai aparecer em “Compras dele”.";
const FRASE_SO_O_NOME = "Só o nome escrito — não liga a nenhum fornecedor do cadastro.";

// Um material de compra com atalho, nome único — a linha da compra que acha o documento no banco.
async function semearMaterial(nome: string): Promise<void> {
  await semearItem({
    nome,
    apareceNaVenda: false,
    atalhoVenda: false,
    controlaEstoque: true,
    unidade: "kg",
    categoriaCompra: "Argila, esmalte e insumos",
    atalhoCompra: true,
  });
}

// Abre a compra com o material já na lista (busca pelo sufixo, toque no atalho).
async function abrirCompraCom(page: Page, suf: string, nomeDoMaterial: string) {
  await irParaDespesa(page);
  await page.getByTestId("despesa-modo-compra").click();
  await page.getByTestId("compra-busca").fill(suf);
  await atalhoDeCompra(page, nomeDoMaterial).click();
  await expect(page.getByTestId("compra-linha")).toHaveCount(1);
}

// Completa a quantidade e o valor, lança, e espera o toast da despesa lançada.
async function completarELancar(page: Page) {
  await page.getByTestId("compra-quantos").fill("10");
  await page.getByTestId("compra-custou").fill("85");
  await expect(botaoLancar(page)).toBeEnabled();
  await botaoLancar(page).click();
  await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s85,00$/)).toBeVisible({ timeout: 10000 });
}

test.describe("fornecedores despesa", () => {
  test("(a) escolher o fornecedor na lista liga a despesa e grava o nome do cadastro", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Olaria Inventada ${suf}`;
    const nomeDoMaterial = `[e2e] Argila de teste ${suf}`;
    const fornecedorId = await semearFornecedor({
      nome: nomeDoFornecedor,
      vende: "argila, barbotina",
      cidadeEntrega: "Cidade Fictícia",
    });
    await semearMaterial(nomeDoMaterial);

    await fazerLogin(page);
    await abrirCompraCom(page, suf, nomeDoMaterial);

    // O campo mostra OUTRO texto antes da escolha (caixa diferente, parte do nome).
    const campo = campoFornecedor(page);
    await campo.fill(`olaria inventada ${suf}`.toUpperCase());
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_SO_O_NOME);
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    await expect(opcoesDoCampo(page)).toContainText(nomeDoFornecedor);
    await expect(opcoesDoCampo(page)).toContainText("argila, barbotina · Cidade Fictícia");

    await opcoesDoCampo(page).click();
    await expect(campo).toHaveValue(nomeDoFornecedor);
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);

    await completarELancar(page);

    const documento = await documentoNoBanco(await idDoDocumentoComLinha(nomeDoMaterial));
    expect(documento).toEqual({ tipo: "despesa", fornecedorId, pessoaNome: nomeDoFornecedor });
  });

  test("(b) digitar depois de escolher desliga; escolher, desligar e escolher de novo liga uma vez só", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Barro Bom ${suf}`;
    const primeiroMaterial = `[e2e] Esmalte azul ${suf}`;
    const segundoMaterial = `[e2e] Esmalte verde ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor, vende: "esmalte" });
    await semearMaterial(primeiroMaterial);
    await semearMaterial(segundoMaterial);

    await fazerLogin(page);

    // 1º lançamento: escolher e depois digitar " x" — desliga; grava só o texto.
    await abrirCompraCom(page, suf, primeiroMaterial);
    const campo = campoFornecedor(page);
    await campo.fill(`barro bom ${suf}`);
    await opcoesDoCampo(page).click();
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);
    await campo.fill(`${nomeDoFornecedor} x`);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_SO_O_NOME);
    await completarELancar(page);

    const primeiro = await documentoNoBanco(await idDoDocumentoComLinha(primeiroMaterial));
    expect(primeiro).toEqual({ tipo: "despesa", fornecedorId: null, pessoaNome: `${nomeDoFornecedor} x` });

    // 2º lançamento: escolher, desligar e escolher de novo (pelo teclado) — um fornecedor_id só, com o
    // nome do cadastro.
    await abrirCompraCom(page, suf, segundoMaterial);
    await campo.fill(`barro bom ${suf}`);
    await opcoesDoCampo(page).click();
    await campo.fill(`${nomeDoFornecedor} x`);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_SO_O_NOME);
    await campo.fill(`barro bom ${suf}`);
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    await campo.press("ArrowDown");
    await campo.press("Enter");
    await expect(campo).toHaveValue(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);
    await completarELancar(page);

    const segundo = await documentoNoBanco(await idDoDocumentoComLinha(segundoMaterial));
    expect(segundo).toEqual({ tipo: "despesa", fornecedorId, pessoaNome: nomeDoFornecedor });
  });

  test("(c) renomear o fornecedor depois não muda a despesa já lançada — nome de 120 na opção e no campo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // 120 caracteres (o teto do nome): a opção quebra a linha, nunca corta nem estoura a largura.
    const inicio = `[e2e] Cerâmica de nome comprido ${suf} `;
    const nomeDoFornecedor = inicio + "Longuíssimo".repeat(20).slice(0, 120 - inicio.length);
    expect(nomeDoFornecedor).toHaveLength(120);
    const nomeDoMaterial = `[e2e] Barbotina de teste ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor, vende: "barbotina" });
    await semearMaterial(nomeDoMaterial);

    await fazerLogin(page);
    await abrirCompraCom(page, suf, nomeDoMaterial);

    const campo = campoFornecedor(page);
    await campo.fill(suf);
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    const estoura = await opcoesDoCampo(page).evaluate((opcao) => opcao.scrollWidth > opcao.clientWidth);
    expect(estoura).toBe(false);
    await opcoesDoCampo(page).click();
    await expect(campo).toHaveValue(nomeDoFornecedor);
    await completarELancar(page);

    const documentoId = await idDoDocumentoComLinha(nomeDoMaterial);
    expect(await documentoNoBanco(documentoId)).toEqual({
      tipo: "despesa",
      fornecedorId,
      pessoaNome: nomeDoFornecedor,
    });

    await renomearFornecedorNoBanco(fornecedorId, `[e2e] Nome novo ${suf}`);
    expect(await documentoNoBanco(documentoId)).toEqual({
      tipo: "despesa",
      fornecedorId,
      pessoaNome: nomeDoFornecedor,
    });
  });

  test("(d) texto igual ao nome de um fornecedor ativo, sem escolher, não liga (UI-D4)", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Embalagens Exatas ${suf}`;
    const nomeDoMaterial = `[e2e] Caixa de teste ${suf}`;
    await semearFornecedor({ nome: nomeDoFornecedor, vende: "caixa" });
    await semearMaterial(nomeDoMaterial);

    await fazerLogin(page);
    await abrirCompraCom(page, suf, nomeDoMaterial);

    await campoFornecedor(page).fill(nomeDoFornecedor);
    // A lista sugere, mas nada se liga sozinho.
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    await completarELancar(page);

    const documento = await documentoNoBanco(await idDoDocumentoComLinha(nomeDoMaterial));
    expect(documento).toEqual({ tipo: "despesa", fornecedorId: null, pessoaNome: nomeDoFornecedor });
  });
});

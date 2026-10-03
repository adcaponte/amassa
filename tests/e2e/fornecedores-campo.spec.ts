import { test, expect, type Page } from "@playwright/test";

import { formatarDataCurta } from "@/lib/financeiro/formato";

import { hojeNoAtelie } from "./apoio/semear-financeiro";
import {
  contarDocumentosComLinha,
  desativarFornecedorNoBanco,
  documentoNoBanco,
  idDoDocumentoComLinha,
  semearFornecedor,
} from "./apoio/semear-fornecedores";

// O campo "Fornecedor" por inteiro (06.2-12-PLAN.md; FRN-12 "em todos os modos", D-04, UI-D2, UI-D4,
// Pitfall 15): a "Outra despesa" também liga ao fornecedor, o aviso quando o nome escrito está no
// cadastro (sem ligar sozinho), o teclado, as mensagens do painel (há mais, sem resultado, cadastro
// vazio), o fornecedor desativado no meio do caminho e o rascunho que lembra a escolha sem prender um
// desativado.
//
// Só o (f) afirma condição global do banco ("nenhum fornecedor ativo") — com a tag de vazio global, roda na
// cadeia `vazio-*` do `playwright.config.ts`, antes de qualquer spec criar fornecedor, e só LÊ. Os outros
// semeiam os próprios fornecedores `[e2e]` com sufixo único; quando a frase depende de haver ao menos um
// ativo, o próprio teste semeia esse ativo. "Hoje" sempre de Brasília (`hojeNoAtelie`). O
// `financeiro-despesa.spec.ts` roda na mesma invocação e NÃO muda.

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

const ROTULO_OUTRA = "Fornecedor ou para quem (opcional)";
const ROTULO_COMPRA = "Fornecedor (opcional)";

const FRASE_LIGADO = "Fornecedor do cadastro — esta despesa vai aparecer em “Compras dele”.";
const FRASE_SO_O_NOME = "Só o nome escrito — não liga a nenhum fornecedor do cadastro.";
const FRASE_HA_MAIS = "Há mais fornecedores — continue digitando.";
const FRASE_CADASTRO_VAZIO = "Nenhum fornecedor cadastrado. Escreva o nome — ou cadastre em Cadastros → Fornecedores.";
const FRASE_DESATIVADO = "Esse fornecedor foi desativado — escolha outro ou deixe em branco.";

function fraseTextoIgual(texto: string): string {
  return `“${texto}” está no cadastro. Escolha na lista para ligar esta despesa a ele.`;
}

function fraseSemResultado(texto: string): string {
  return `Nenhum fornecedor do cadastro com “${texto}”. Fica só o nome escrito.`;
}

const campoOutra = (page: Page) => page.getByLabel(ROTULO_OUTRA);
const campoCompra = (page: Page) => page.getByLabel(ROTULO_COMPRA);
const opcoesDoCampo = (page: Page) => page.getByTestId("despesa-fornecedor-opcao");
const mensagemDoPainel = (page: Page) => page.getByTestId("despesa-fornecedor-mensagem");
const linhaDeVinculo = (page: Page) => page.getByTestId("despesa-fornecedor-vinculo");
const botaoLancar = (page: Page) => page.getByRole("button", { name: "Lançar despesa" });

async function irParaDespesa(page: Page) {
  await page.goto("/gestao/financeiro?aba=despesa");
}

async function abrirOutra(page: Page) {
  await irParaDespesa(page);
  await page.getByTestId("despesa-modo-outra").click();
  await expect(campoOutra(page)).toBeVisible();
}

// Descrição e valor da "Outra despesa" (a categoria já vem escolhida — a primeira da lista).
async function preencherOutra(page: Page, descricao: string, valor: string) {
  await page.getByLabel("Descrição").fill(descricao);
  await page.getByLabel("Valor", { exact: true }).fill(valor);
}

async function lancarEEsperar(page: Page, valorFormatado: string) {
  await expect(botaoLancar(page)).toBeEnabled();
  await botaoLancar(page).click();
  await expect(page.getByText(new RegExp(`^Despesa nº \\d+ lançada · R\\$\\s${valorFormatado}$`))).toBeVisible({
    timeout: 10000,
  });
}

test.describe("fornecedores campo", () => {
  test("(a) traçador: “Outra despesa” ligada ao fornecedor — no banco e em “Compras dele” como Outra despesa", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Conserto Inventado ${suf}`;
    const descricao = `[e2e] Conserto do forno ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor, vende: "conserto" });

    await fazerLogin(page);
    await abrirOutra(page);

    // UI-D2: o rótulo do modo "Outra despesa"; é o MESMO combobox.
    const campo = campoOutra(page);
    await expect(campo).toHaveAttribute("role", "combobox");
    await campo.fill(`conserto inventado ${suf}`);
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    await opcoesDoCampo(page).click();
    await expect(campo).toHaveValue(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);

    await preencherOutra(page, descricao, "120");
    await lancarEEsperar(page, "120,00");

    const documentoId = await idDoDocumentoComLinha(descricao);
    expect(await documentoNoBanco(documentoId)).toEqual({
      tipo: "despesa",
      fornecedorId,
      pessoaNome: nomeDoFornecedor,
    });

    // A ficha lê de volta: a despesa aparece em "Compras dele" como "Outra despesa".
    await page.goto(`/gestao/cadastros?sub=fornecedores&fornecedor=${fornecedorId}`);
    const ficha = page.getByTestId("fornecedor-ficha");
    await expect(ficha).toHaveAttribute("data-fornecedor-id", fornecedorId);
    const linha = page.locator(`[data-testid="compra-linha"][data-documento-id="${documentoId}"]`);
    await expect(linha.getByTestId("compra-meta")).toHaveText(`${formatarDataCurta(hojeNoAtelie())} · Outra despesa`);
  });

  test("(b) texto igual ao nome de um ativo, sem escolher: o aviso em atenção, lançar não liga; ↓ destaca e Enter liga", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Argíla Súl ${suf}`;
    // Outra caixa, sem acento: igual por `normalizar`, mas não escolhido.
    const escrito = `[E2E] ARGILA SUL ${suf}`;
    const primeira = `[e2e] Frete da argila ${suf}`;
    await semearFornecedor({ nome: nomeDoFornecedor, vende: "argila" });

    await fazerLogin(page);
    await abrirOutra(page);

    const campo = campoOutra(page);
    await campo.fill(escrito);
    await expect(linhaDeVinculo(page)).toHaveText(fraseTextoIgual(escrito));
    await expect(linhaDeVinculo(page)).toHaveAttribute("data-estado", "texto-igual-ao-cadastro");
    await expect(linhaDeVinculo(page)).toHaveClass(/text-atencao/);
    // Com a lista aberta, a opção igual já vem destacada — mas nada se liga sozinho (UI-D4).
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    await expect(opcoesDoCampo(page)).toHaveAttribute("aria-selected", "true");

    await preencherOutra(page, primeira, "45");
    await lancarEEsperar(page, "45,00");
    expect(await documentoNoBanco(await idDoDocumentoComLinha(primeira))).toEqual({
      tipo: "despesa",
      fornecedorId: null,
      pessoaNome: escrito,
    });

    // De novo: Esc fecha a lista; ↓ a abre com a opção igual destacada; Enter liga.
    await abrirOutra(page);
    await campo.fill(escrito);
    await campo.press("Escape");
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    await campo.press("ArrowDown");
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    const opcao = opcoesDoCampo(page);
    await expect(opcao).toHaveAttribute("aria-selected", "true");
    const idDaOpcao = await opcao.getAttribute("id");
    expect(idDaOpcao).not.toBeNull();
    await expect(campo).toHaveAttribute("aria-activedescendant", idDaOpcao ?? "");
    await campo.press("Enter");
    await expect(campo).toHaveValue(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);
  });

  test("(c) teclado: ↓ percorre em círculo, ↑ volta, Esc fecha e mantém o texto, Tab fecha; Enter com a lista fechada não lança", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const descricao = `[e2e] Teclado ${suf}`;
    for (const letra of ["A", "B", "C"]) {
      await semearFornecedor({ nome: `[e2e] Teclado ${suf} ${letra}` });
    }

    await fazerLogin(page);
    await abrirOutra(page);
    await preencherOutra(page, descricao, "30");

    const campo = campoOutra(page);
    const escrito = `teclado ${suf}`;
    await campo.fill(escrito);
    await expect(opcoesDoCampo(page)).toHaveCount(3);
    await expect(campo).toHaveAttribute("aria-expanded", "true");

    const destacada = page.locator('[data-testid="despesa-fornecedor-opcao"][aria-selected="true"]');
    await campo.press("ArrowDown");
    await expect(destacada).toHaveText(`[e2e] Teclado ${suf} A`);
    await campo.press("ArrowDown");
    await campo.press("ArrowDown");
    await expect(destacada).toHaveText(`[e2e] Teclado ${suf} C`);
    // Em círculo: depois da última, a primeira.
    await campo.press("ArrowDown");
    await expect(destacada).toHaveText(`[e2e] Teclado ${suf} A`);
    await campo.press("ArrowUp");
    await expect(destacada).toHaveText(`[e2e] Teclado ${suf} C`);

    // Esc fecha só a lista; o texto fica.
    await campo.press("Escape");
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    await expect(campo).toHaveAttribute("aria-expanded", "false");
    await expect(campo).toHaveValue(escrito);

    // ↓ reabre; Tab fecha e segue.
    await campo.press("ArrowDown");
    await expect(opcoesDoCampo(page)).toHaveCount(3);
    await campo.press("Tab");
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    await expect(campo).not.toBeFocused();
    await expect(campo).toHaveValue(escrito);

    // Enter com a lista fechada não lança: o lançamento de verdade, depois, é o ÚNICO.
    await campo.focus();
    await campo.press("Escape");
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    await campo.press("Enter");
    await expect(campo).toHaveValue(escrito);
    await lancarEEsperar(page, "30,00");
    expect(await contarDocumentosComLinha(descricao)).toBe(1);
    expect(await documentoNoBanco(await idDoDocumentoComLinha(descricao))).toEqual({
      tipo: "despesa",
      fornecedorId: null,
      pessoaNome: escrito,
    });
  });

  test("(d) mais de 8: as 8 primeiras e “Há mais fornecedores — continue digitando.” fora da lista", async ({ page }) => {
    const suf = sufixoUnico();
    for (let numero = 1; numero <= 9; numero++) {
      await semearFornecedor({ nome: `[e2e] Lote ${suf} ${numero}` });
    }

    await fazerLogin(page);
    await abrirOutra(page);

    await campoOutra(page).fill(`Lote ${suf}`);
    await expect(opcoesDoCampo(page)).toHaveCount(8);
    await expect(mensagemDoPainel(page)).toHaveText(FRASE_HA_MAIS);
    // A linha não é uma opção: fica fora do `listbox`.
    const lista = page.getByRole("listbox", { name: "Fornecedores do cadastro" });
    await expect(lista.getByTestId("despesa-fornecedor-mensagem")).toHaveCount(0);
    await expect(lista.getByRole("option")).toHaveCount(8);
  });

  test("(e) sem resultado: a frase do painel e o nome fica só escrito", async ({ page }) => {
    const suf = sufixoUnico();
    // Ao menos um ativo no cadastro, para a frase ser a do “sem resultado” (e não a do cadastro vazio).
    await semearFornecedor({ nome: `[e2e] Algum Ativo ${suf}` });

    await fazerLogin(page);
    await abrirOutra(page);

    const escrito = `zzz${suf}`;
    await campoOutra(page).fill(escrito);
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    await expect(mensagemDoPainel(page)).toHaveText(fraseSemResultado(escrito));
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_SO_O_NOME);
  });

  test("(f) sem nenhum fornecedor ativo, o foco no campo mostra a frase do cadastro vazio @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await irParaDespesa(page);

    const campo = campoCompra(page);
    await campo.focus();
    await expect(mensagemDoPainel(page)).toHaveText(FRASE_CADASTRO_VAZIO);
    await expect(opcoesDoCampo(page)).toHaveCount(0);
    // Escrever não muda a frase; a linha de vínculo fica vazia (não há cadastro com que comparar).
    await campo.fill("[e2e] Alguém sem cadastro");
    await expect(mensagemDoPainel(page)).toHaveText(FRASE_CADASTRO_VAZIO);
    await expect(linhaDeVinculo(page)).toHaveText("");
  });

  test("(g) fornecedor desativado entre escolher e lançar: a frase no alerta, nada lançado; escrito à mão, lança", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Vai Sair ${suf}`;
    const descricao = `[e2e] Despesa do desativado ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    await abrirOutra(page);

    const campo = campoOutra(page);
    await campo.fill(`vai sair ${suf}`);
    await opcoesDoCampo(page).click();
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);
    await preencherOutra(page, descricao, "60");

    await desativarFornecedorNoBanco(fornecedorId);
    await botaoLancar(page).click();
    await expect(page.getByRole("alert").filter({ hasText: FRASE_DESATIVADO })).toBeVisible({ timeout: 10000 });
    expect(await contarDocumentosComLinha(descricao)).toBe(0);

    // O campo nunca impede de lançar: escrito à mão (desliga), a despesa sai com o nome e sem vínculo.
    // Primeiro vazio: repetir o MESMO valor não dispara a mudança do React.
    await campo.fill("");
    await campo.fill(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).not.toHaveText(FRASE_LIGADO);
    await lancarEEsperar(page, "60,00");
    expect(await documentoNoBanco(await idDoDocumentoComLinha(descricao))).toEqual({
      tipo: "despesa",
      fornecedorId: null,
      pessoaNome: nomeDoFornecedor,
    });
  });

  test("(h) rascunho: a escolha sobrevive a recarregar; desativado no banco, volta como texto livre e lança sem vínculo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Lembrado ${suf}`;
    const descricao = `[e2e] Despesa do rascunho ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor });
    // Outro ativo, para a linha depois de desativar ser a do “só o nome” (e não a do cadastro vazio).
    await semearFornecedor({ nome: `[e2e] Outro Ativo ${suf}` });

    await fazerLogin(page);
    await abrirOutra(page);

    const campo = campoOutra(page);
    await campo.fill(`lembrado ${suf}`);
    await opcoesDoCampo(page).click();
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);
    await preencherOutra(page, descricao, "75");

    // Recarregar: o modo, o texto e o vínculo voltam do rascunho.
    await page.reload();
    await expect(campoOutra(page)).toHaveValue(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);

    // Desativado no banco: ao ler o rascunho, o vínculo é descartado e o nome fica como texto livre.
    await desativarFornecedorNoBanco(fornecedorId);
    await page.reload();
    await expect(campoOutra(page)).toHaveValue(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_SO_O_NOME);
    await expect(page.getByLabel("Descrição")).toHaveValue(descricao);

    await lancarEEsperar(page, "75,00");
    expect(await documentoNoBanco(await idDoDocumentoComLinha(descricao))).toEqual({
      tipo: "despesa",
      fornecedorId: null,
      pessoaNome: nomeDoFornecedor,
    });
  });

  test("(i) “Limpar” zera texto e vínculo; trocar Compra ↔ Outra mantém o valor de cada modo", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Troca de Modo ${suf}`;
    const textoDaCompra = `[e2e] Só escrito na compra ${suf}`;
    await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    await abrirOutra(page);

    await campoOutra(page).fill(`troca de modo ${suf}`);
    await opcoesDoCampo(page).click();
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);

    await page.getByTestId("despesa-modo-compra").click();
    await expect(campoCompra(page)).toHaveValue("");
    await campoCompra(page).fill(textoDaCompra);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_SO_O_NOME);

    await page.getByTestId("despesa-modo-outra").click();
    await expect(campoOutra(page)).toHaveValue(nomeDoFornecedor);
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);

    await page.getByTestId("despesa-modo-compra").click();
    await expect(campoCompra(page)).toHaveValue(textoDaCompra);

    await page.getByRole("button", { name: "Limpar", exact: true }).click();
    await expect(campoCompra(page)).toHaveValue("");
    await expect(linhaDeVinculo(page)).toHaveText("");
    await page.getByTestId("despesa-modo-outra").click();
    await expect(campoOutra(page)).toHaveValue("");
    await expect(linhaDeVinculo(page)).toHaveText("");

    // E o rascunho não traz nada de volta.
    await page.reload();
    await page.getByTestId("despesa-modo-outra").click();
    await expect(campoOutra(page)).toHaveValue("");
    await expect(linhaDeVinculo(page)).toHaveText("");
  });
});

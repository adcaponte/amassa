import { test, expect, type Page } from "@playwright/test";

import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";

import { pdfSintetico } from "./apoio/arquivos-sinteticos";
import { hojeNoAtelie, semearItem, somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  cancelarNoBanco,
  documentoNoBanco,
  idDoDocumentoComLinha,
  renomearFornecedorNoBanco,
  semearDespesaDoFornecedor,
  semearFornecedor,
} from "./apoio/semear-fornecedores";

// "Compras dele" na ficha do fornecedor (06.2-11-PLAN.md; FRN-13, D-03, UI-D12, UI-D13): o caminho do
// traçador inteiro — campo "Fornecedor" da Despesa → `lancarDespesa` → `documentos` →
// `comprasDoFornecedor` → `montarComprasDele` → ficha — e as bordas da seção: cancelada some, a virada
// de ano, "Nenhuma despesa em {ano} ainda.", 10 + "Mostrar as outras N", o desativado e o vazio.
//
// "Hoje" e o ano sempre de Brasília (`hojeNoAtelie`/`somarDiasAoHoje`), nunca o dia UTC. Os auxiliares de
// Despesa são cópias dos de `fornecedores-despesa.spec.ts`. Cada caso semeia o próprio fornecedor `[e2e]`
// com sufixo único e só olha a ficha dele: nada aqui afirma condição global do banco. As despesas
// datadas no passado (ou muitas de uma vez) são semeadas direto no banco (`semearDespesaDoFornecedor`),
// e o cancelamento usa `cancelarNoBanco` — o mesmo par de colunas que o Caixa grava.

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

// Abre a ficha de um fornecedor e espera ela desenhar (o h2 com o nome).
async function abrirFicha(page: Page, id: string, nome: string) {
  await page.goto(enderecoDaFicha(id));
  const ficha = page.getByTestId("fornecedor-ficha");
  await expect(ficha).toHaveAttribute("data-fornecedor-id", id);
  await expect(ficha.getByRole("heading", { level: 2, name: nome })).toBeVisible();
  return ficha;
}

// ——— Auxiliares de Despesa (cópias de `fornecedores-despesa.spec.ts`). ———

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
const FRASE_SEM_COMPRAS =
  "Nenhuma despesa ligada a este fornecedor ainda. Ao lançar uma despesa no Financeiro, escolha o nome dele na lista do campo “Fornecedor” — aí ela aparece aqui. Despesas lançadas antes não entram.";

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

async function abrirCompraCom(page: Page, suf: string, nomeDoMaterial: string) {
  await irParaDespesa(page);
  await page.getByTestId("despesa-modo-compra").click();
  await page.getByTestId("compra-busca").fill(suf);
  await atalhoDeCompra(page, nomeDoMaterial).click();
  await expect(page.getByTestId("compra-linha")).toHaveCount(1);
}

async function completarELancar(page: Page) {
  await page.getByTestId("compra-quantos").fill("10");
  await page.getByTestId("compra-custou").fill("85");
  await expect(botaoLancar(page)).toBeEnabled();
  await botaoLancar(page).click();
  await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s85,00$/)).toBeVisible({ timeout: 10000 });
}

// ——— "Compras dele". ———

function totalEsperado(ano: string, centavos: number, quantidade: number): string {
  return `Total em ${ano}: ${formatarReais(centavos)} · ${quantidade === 1 ? "1 despesa" : `${quantidade} despesas`}`;
}

function linhaDaCompra(page: Page, documentoId: string) {
  return page.locator(`[data-testid="compra-linha"][data-documento-id="${documentoId}"]`);
}

test.describe("fornecedores compras", () => {
  test("(a) traçador: lançar escolhendo o fornecedor e ver a compra em “Compras dele”, com o total do ano; renomear não a tira", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const hoje = hojeNoAtelie();
    const ano = hoje.slice(0, 4);
    const nomeDoFornecedor = `[e2e] Olaria das Compras ${suf}`;
    const nomeDoMaterial = `[e2e] Argila comprada ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor, vende: "argila" });
    await semearMaterial(nomeDoMaterial);

    await fazerLogin(page);
    await abrirCompraCom(page, suf, nomeDoMaterial);
    await campoFornecedor(page).fill(`olaria das compras ${suf}`);
    await expect(opcoesDoCampo(page)).toHaveCount(1);
    await opcoesDoCampo(page).click();
    await expect(linhaDeVinculo(page)).toHaveText(FRASE_LIGADO);
    await completarELancar(page);

    const documentoId = await idDoDocumentoComLinha(nomeDoMaterial);
    expect(await documentoNoBanco(documentoId)).toEqual({
      tipo: "despesa",
      fornecedorId,
      pessoaNome: nomeDoFornecedor,
    });

    const ficha = await abrirFicha(page, fornecedorId, nomeDoFornecedor);
    const compras = ficha.getByTestId("fornecedor-compras");
    await expect(compras.getByRole("heading", { level: 3, name: "Compras dele" })).toBeVisible();
    await expect(compras).toContainText("vem do Financeiro · despesas lançadas com este fornecedor");
    await expect(compras.getByTestId("compra-linha")).toHaveCount(1);
    const linha = linhaDaCompra(page, documentoId);
    await expect(linha.getByTestId("compra-titulo")).toHaveText(`${nomeDoMaterial} × 10 kg`);
    await expect(linha.getByTestId("compra-meta")).toHaveText(
      `${formatarDataCurta(hoje)} · Compra de material · ${nomeDoMaterial} × 10 kg`,
    );
    await expect(linha.getByTestId("compra-valor")).toHaveText(formatarReais(8500));
    await expect(compras.getByTestId("compras-total")).toHaveText(totalEsperado(ano, 8500, 1));
    await expect(compras.getByTestId("compras-mostrar-mais")).toHaveCount(0);

    // Renomear depois não desliga: a despesa continua na ficha (pelo id), com o mesmo título.
    const nomeNovo = `[e2e] Olaria renomeada ${suf}`;
    await renomearFornecedorNoBanco(fornecedorId, nomeNovo);
    const fichaRenomeada = await abrirFicha(page, fornecedorId, nomeNovo);
    await expect(fichaRenomeada.getByTestId("compra-linha")).toHaveCount(1);
    await expect(linhaDaCompra(page, documentoId).getByTestId("compra-titulo")).toHaveText(
      `${nomeDoMaterial} × 10 kg`,
    );
    await expect(fichaRenomeada.getByTestId("compras-total")).toHaveText(totalEsperado(ano, 8500, 1));
  });

  test("(b) a despesa cancelada some da lista e do total", async ({ page }) => {
    const suf = sufixoUnico();
    const hoje = hojeNoAtelie();
    const ano = hoje.slice(0, 4);
    const nome = `[e2e] Fornecedor do cancelamento ${suf}`;
    const fornecedorId = await semearFornecedor({ nome });
    const cem = await semearDespesaDoFornecedor({
      fornecedorId,
      nome,
      data: hoje,
      valorCentavos: 10000,
      descricao: `[e2e] Frete grande ${suf}`,
    });
    const cinquenta = await semearDespesaDoFornecedor({
      fornecedorId,
      nome,
      data: hoje,
      valorCentavos: 5000,
      descricao: `[e2e] Frete pequeno ${suf}`,
    });

    await fazerLogin(page);
    let ficha = await abrirFicha(page, fornecedorId, nome);
    await expect(ficha.getByTestId("compra-linha")).toHaveCount(2);
    await expect(linhaDaCompra(page, cem).getByTestId("compra-meta")).toHaveText(
      `${formatarDataCurta(hoje)} · Outra despesa`,
    );
    await expect(ficha.getByTestId("compras-total")).toHaveText(totalEsperado(ano, 15000, 2));

    await cancelarNoBanco(cem);
    ficha = await abrirFicha(page, fornecedorId, nome);
    await expect(ficha.getByTestId("compra-linha")).toHaveCount(1);
    await expect(linhaDaCompra(page, cem)).toHaveCount(0);
    await expect(linhaDaCompra(page, cinquenta).getByTestId("compra-valor")).toHaveText(formatarReais(5000));
    await expect(ficha.getByTestId("compras-total")).toHaveText(totalEsperado(ano, 5000, 1));
  });

  test("(c) a virada do ano: 31/12 do ano anterior na lista e fora do total; só anos anteriores → “Nenhuma despesa em {ano} ainda.”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const ano = hojeNoAtelie().slice(0, 4);
    const anoAnterior = String(Number(ano) - 1);
    const nome = `[e2e] Fornecedor da virada ${suf}`;
    const fornecedorId = await semearFornecedor({ nome });
    const dezembro = await semearDespesaDoFornecedor({
      fornecedorId,
      nome,
      data: `${anoAnterior}-12-31`,
      valorCentavos: 3000,
      descricao: `[e2e] Compra de dezembro ${suf}`,
    });
    const janeiro = await semearDespesaDoFornecedor({
      fornecedorId,
      nome,
      data: `${ano}-01-01`,
      valorCentavos: 2000,
      descricao: `[e2e] Compra de janeiro ${suf}`,
    });

    const nomeAntigo = `[e2e] Fornecedor só do ano passado ${suf}`;
    const antigoId = await semearFornecedor({ nome: nomeAntigo });
    await semearDespesaDoFornecedor({
      fornecedorId: antigoId,
      nome: nomeAntigo,
      data: `${anoAnterior}-06-15`,
      valorCentavos: 1000,
      descricao: `[e2e] Compra de junho passado ${suf}`,
    });
    await semearDespesaDoFornecedor({
      fornecedorId: antigoId,
      nome: nomeAntigo,
      data: `${anoAnterior}-12-31`,
      valorCentavos: 1000,
      descricao: `[e2e] Compra de dezembro passado ${suf}`,
    });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, fornecedorId, nome);
    const linhas = ficha.getByTestId("compra-linha");
    await expect(linhas).toHaveCount(2);
    // Mais recentes primeiro: janeiro, depois dezembro do ano anterior.
    await expect(linhas.nth(0)).toHaveAttribute("data-documento-id", janeiro);
    await expect(linhas.nth(1)).toHaveAttribute("data-documento-id", dezembro);
    await expect(linhas.nth(1).getByTestId("compra-meta")).toHaveText(
      `${formatarDataCurta(`${anoAnterior}-12-31`)} · Outra despesa`,
    );
    await expect(ficha.getByTestId("compras-total")).toHaveText(totalEsperado(ano, 2000, 1));

    const fichaAntiga = await abrirFicha(page, antigoId, nomeAntigo);
    await expect(fichaAntiga.getByTestId("compra-linha")).toHaveCount(2);
    await expect(fichaAntiga.getByTestId("compras-total")).toHaveText(`Nenhuma despesa em ${ano} ainda.`);
    await expect(fichaAntiga.getByTestId("compras-vazio")).toHaveCount(0);
  });

  test("(d) mais de 10: as 10 mais recentes e “Mostrar as outras 2” → 12; o valor nunca estoura a linha", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Fornecedor semanal ${suf}`;
    const fornecedorId = await semearFornecedor({ nome });
    const ids: string[] = [];
    for (let dias = 0; dias < 12; dias += 1) {
      ids.push(
        await semearDespesaDoFornecedor({
          fornecedorId,
          nome,
          data: somarDiasAoHoje(-dias),
          valorCentavos: 123456 + dias,
          descricao: `[e2e] Compra semanal número ${dias + 1} com uma descrição comprida para quebrar ${suf}`,
        }),
      );
    }

    await fazerLogin(page);
    const ficha = await abrirFicha(page, fornecedorId, nome);
    const linhas = ficha.getByTestId("compra-linha");
    await expect(linhas).toHaveCount(10);
    await expect(linhas.nth(0)).toHaveAttribute("data-documento-id", ids[0]);
    await expect(linhas.nth(9)).toHaveAttribute("data-documento-id", ids[9]);
    const mostrar = ficha.getByTestId("compras-mostrar-mais");
    await expect(mostrar).toHaveText("Mostrar as outras 2");

    // A 320 px (celular) e no desktop: o valor fica inteiro, numa linha, e a linha não estoura.
    for (const indice of [0, 9]) {
      const linha = linhas.nth(indice);
      expect(await linha.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth)).toBe(true);
      const valor = linha.getByTestId("compra-valor");
      await expect(valor).toHaveText(formatarReais(123456 + indice));
      // Uma caixa de linha só para o texto do valor (`whitespace-nowrap`): nunca quebra.
      const caixasDoValor = await valor.evaluate((elemento) => {
        const faixa = document.createRange();
        faixa.selectNodeContents(elemento);
        return faixa.getClientRects().length;
      });
      expect(caixasDoValor).toBe(1);
    }

    await mostrar.click();
    await expect(linhas).toHaveCount(12);
    await expect(mostrar).toHaveCount(0);
    await expect(linhas.nth(10)).toBeFocused();
    await expect(linhas.nth(11)).toHaveAttribute("data-documento-id", ids[11]);
  });

  test("(e) desativado: selo, “Reativar”, a frase no lugar de “Novo anexo”; os anexos e as compras continuam", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const hoje = hojeNoAtelie();
    const ano = hoje.slice(0, 4);
    const nome = `[e2e] Fornecedor que vai desativar ${suf}`;
    const fornecedorId = await semearFornecedor({ nome });
    const despesaId = await semearDespesaDoFornecedor({
      fornecedorId,
      nome,
      data: hoje,
      valorCentavos: 4200,
      descricao: `[e2e] Frete antes de desativar ${suf}`,
    });

    await fazerLogin(page);
    const query = new URLSearchParams({ fornecedorId, nome: "catalogo-de-teste", tipo: "catalogo", extensao: "pdf" });
    const envio = await page.request.put(`/gestao/api/fornecedores/anexos?${query.toString()}`, {
      data: pdfSintetico(4 * 1024),
      headers: { "content-type": "application/octet-stream" },
    });
    expect(envio.status()).toBe(200);

    const ficha = await abrirFicha(page, fornecedorId, nome);
    await expect(ficha.getByTestId("anexo-linha")).toHaveCount(1);
    await ficha.getByRole("button", { name: `Desativar ${nome}` }).click();
    const confirmacao = page.getByTestId("confirmar-desativar-fornecedor");
    await confirmacao.getByRole("button", { name: "Desativar fornecedor" }).click();
    await expect(page.getByText("Fornecedor desativado.").first()).toBeVisible();

    await expect(ficha.getByTestId("fornecedor-selo-desativado")).toBeVisible();
    await expect(ficha.getByRole("button", { name: `Reativar ${nome}` })).toBeVisible();
    await expect(ficha.getByTestId("fornecedor-novo-anexo")).toHaveCount(0);
    await expect(ficha.getByTestId("fornecedor-anexo-desativado")).toHaveText(
      "Fornecedor desativado. Reative para subir anexos.",
    );
    await expect(ficha.getByTestId("anexo-linha")).toHaveCount(1);
    await expect(ficha.getByTestId("compra-linha")).toHaveCount(1);
    await expect(linhaDaCompra(page, despesaId).getByTestId("compra-valor")).toHaveText(formatarReais(4200));
    await expect(ficha.getByTestId("compras-total")).toHaveText(totalEsperado(ano, 4200, 1));
  });

  test("(f) fornecedor sem despesa ligada: a frase vazia, sem lista nem total", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Fornecedor sem compras ${suf}`;
    const fornecedorId = await semearFornecedor({ nome });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, fornecedorId, nome);
    const compras = ficha.getByTestId("fornecedor-compras");
    await expect(compras.getByRole("heading", { level: 3, name: "Compras dele" })).toBeVisible();
    await expect(compras.getByTestId("compras-vazio")).toHaveText(FRASE_SEM_COMPRAS);
    await expect(compras.getByTestId("compra-linha")).toHaveCount(0);
    await expect(compras.getByTestId("compras-total")).toHaveCount(0);
  });
});

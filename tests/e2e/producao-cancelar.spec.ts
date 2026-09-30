import { test, expect, type Page } from "@playwright/test";

import { nomeDoUsuario, semearMaterial } from "./apoio/semear-estoque";
import {
  cancelamentoDaOrdemNoBanco,
  diaEmBrasilia,
  diaMes,
  liberarOrdemNoBanco,
  movimentacoesDoItemNoBanco,
  numeroDoDocumentoNoBanco,
  semearBaixaDaOrdem,
  semearOrdem,
  semearOrdemDeOrcamento,
  vendaNoBanco,
} from "./apoio/semear-producao";

// Cancelar a ordem (Fase 06.1, plano 06, PRD-18): a confirmação diz, ANTES, o que não acontece — o
// material baixado não volta para o estoque, e a venda no Financeiro não é cancelada junto. Depois
// de cancelar, a ordem mostra "Cancelada em {dd/mm} por {nome}." numa caixa neutra, nada fica
// editável, e ela sai do quadro. No banco: só a ordem muda — venda, parcelas e livro do Estoque
// intactos. Cada teste semeia a PRÓPRIA ordem com sufixo único (nenhuma afirmação global do banco).
// Nomes inventados com `[e2e]`.

const CATEGORIA_DE_COMPRA = "Argila, esmalte e insumos";
const TOAST_CANCELADA = "Ordem cancelada. Ela continua em Concluídas e canceladas.";
const FRASE_JA_ENCERRADA = "Esta ordem já foi concluída ou cancelada. A tela foi atualizada.";
const FRASE_ORDEM_CANCELADA = "Esta ordem foi cancelada. A tela foi atualizada.";

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

// Cancela a venda pelo caminho real do Caixa (o mesmo de `orcamentos-aprovacao.spec.ts` (f)): o
// detalhe do documento → "Cancelar esta venda" → "Cancelar venda". Espera o TOAST, nunca a URL (o
// aviso some da URL no mesmo instante — WINDOWS #49/#52).
async function cancelarVendaPelaTela(page: Page, documentoId: string) {
  await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${documentoId}`);
  const detalhe = page.getByTestId("documento-detalhe");
  await expect(detalhe).toBeVisible();
  await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar venda", exact: true }).click();
  await expect(page.getByText(/Lançamento nº \d+ cancelado\. Continua visível, riscado\./)).toBeVisible({
    timeout: 10000,
  });
}

function semearOrdemAtivaDaCasa(nome: string) {
  return semearOrdem({
    nome,
    tipo: "casa",
    caminho: "completo",
    status: "ativa",
    inicio: diaEmBrasilia(),
    etapasFeitas: [],
    pecas: [{ descricao: `${nome} · caneca`, quantidade: 12 }],
  });
}

test.describe("producao cancelar ordem", () => {
  test("(a) ordem ativa com uma baixa: o diálogo avisa que a baixa não volta; “Manter ordem” não grava; “Cancelar ordem” cancela, a ordem sai do quadro e o livro fica igual", async ({
    page,
  }) => {
    const nome = nomeUnico("Canecas a cancelar");
    const ordemId = await semearOrdemAtivaDaCasa(nome);
    const itemId = await semearMaterial({
      nome: nomeUnico("Argila da baixa"),
      unidade: "kg",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await semearBaixaDaOrdem(ordemId, itemId);
    const livroAntes = await movimentacoesDoItemNoBanco(itemId);
    expect(livroAntes).toBe(1);
    const hoje = diaEmBrasilia();
    const email = process.env.E2E_EMAIL_TESTE ?? "";
    const quemCancelou = await nomeDoUsuario(email);

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    // "Manter ordem" fecha sem gravar.
    await page.getByTestId("ordem-cancelar").click();
    const dialogo = page.getByTestId("ordem-confirmar-cancelar");
    await expect(dialogo.getByRole("heading")).toHaveText(`Cancelar "${nome}"?`);
    await expect(dialogo).toContainText(
      "A ordem sai do quadro e fica em Concluídas e canceladas. As baixas de material já feitas (1) não voltam para o estoque sozinhas.",
    );
    // Ordem da casa não tem venda: nenhuma frase sobre o Financeiro.
    await expect(dialogo).not.toContainText("venda");
    await dialogo.getByRole("button", { name: "Manter ordem" }).click();
    await expect(dialogo).toHaveCount(0);
    expect((await cancelamentoDaOrdemNoBanco(ordemId)).status).toBe("ativa");

    // "Cancelar ordem" cancela.
    await page.getByTestId("ordem-cancelar").click();
    await page.getByTestId("ordem-confirmar-cancelar-sim").click();
    await expect(page.getByText(TOAST_CANCELADA)).toBeVisible();
    await expect(page.getByTestId("ordem-resultado")).toHaveText(
      `Cancelada em ${diaMes(hoje)} por ${quemCancelou}.`,
    );
    await expect(page.getByTestId("producao-selo")).toHaveText("cancelada");
    // Nada fica editável: sem a fileira de ações, sem "Cancelar ordem", sem −/+.
    await expect(page.getByTestId("ordem-cancelar")).toHaveCount(0);
    await expect(page.getByTestId("ordem-acoes")).toHaveCount(0);
    await expect(page.getByTestId("ordem-terminei")).toHaveCount(0);
    await expect(page.getByTestId("ordem-previsao")).toHaveCount(0);
    await expect(page.getByTestId(/^ordem-ajuste-/)).toHaveCount(0);

    const gravado = await cancelamentoDaOrdemNoBanco(ordemId);
    expect(gravado).toMatchObject({
      status: "cancelada",
      inicio: hoje,
      canceladaPelaVenda: false,
    });
    expect(gravado.canceladaEm).not.toBeNull();
    expect(gravado.canceladaPorEmail?.toLowerCase()).toBe(email.toLowerCase());
    // Briefing §6: cancelar não devolve material — o livro tem exatamente as mesmas linhas.
    expect(await movimentacoesDoItemNoBanco(itemId)).toBe(livroAntes);

    // A ordem sai do quadro.
    await page.goto("/gestao/producao");
    await expect(page.locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`)).toHaveCount(0);
  });

  test("(b) ordem de orçamento aguardando o sinal: o diálogo diz que a venda NÃO é cancelada junto; depois, venda e parcelas intactas", async ({
    page,
  }) => {
    const nome = nomeUnico("Jogo a cancelar");
    const { ordemId, documentoId } = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: true,
    });
    const numeroDaVenda = await numeroDoDocumentoNoBanco(documentoId);
    const vendaAntes = await vendaNoBanco(documentoId);
    expect(vendaAntes.cancelada).toBe(false);
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    await page.getByTestId("ordem-cancelar").click();
    const dialogo = page.getByTestId("ordem-confirmar-cancelar");
    await expect(dialogo).toContainText(
      `A ordem sai do quadro e fica em Concluídas e canceladas. Nenhuma baixa de material foi feita. A venda nº ${numeroDaVenda} no Financeiro não é cancelada junto — decida lá o que fazer com o sinal.`,
    );
    await page.getByTestId("ordem-confirmar-cancelar-sim").click();
    await expect(page.getByText(TOAST_CANCELADA)).toBeVisible();
    await expect(page.getByTestId("ordem-resultado")).toContainText(`Cancelada em ${diaMes(hoje)} por `);
    // Sem a caixa "Aguardando o sinal" e sem liberar.
    await expect(page.getByTestId("ordem-caixa-aguardando")).toHaveCount(0);
    await expect(page.getByTestId("ordem-liberar")).toHaveCount(0);

    // A ordem cancelada ainda aguardando fica SEM início (o check corrigido no plano 06).
    expect(await cancelamentoDaOrdemNoBanco(ordemId)).toMatchObject({
      status: "cancelada",
      inicio: null,
      canceladaPelaVenda: false,
    });
    // PRD-18: a venda não foi cancelada e nenhuma parcela mudou (valor, vencimento, recebimento).
    expect(await vendaNoBanco(documentoId)).toEqual(vendaAntes);

    await page.goto("/gestao/producao");
    await expect(page.locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`)).toHaveCount(0);
  });

  test("(c) duas abas: cancelar numa e tocar na outra → “já foi concluída ou cancelada” e nada é regravado", async ({
    page,
    context,
  }) => {
    const ordemId = await semearOrdemAtivaDaCasa(nomeUnico("Pratos duas abas"));

    await fazerLogin(page);
    const outraAba = await context.newPage();
    await page.goto(`/gestao/producao/${ordemId}`);
    await outraAba.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-cancelar")).toBeVisible();
    await expect(outraAba.getByTestId("ordem-cancelar")).toBeVisible();

    await page.getByTestId("ordem-cancelar").click();
    await page.getByTestId("ordem-confirmar-cancelar-sim").click();
    await expect(page.getByText(TOAST_CANCELADA)).toBeVisible();
    const primeiro = await cancelamentoDaOrdemNoBanco(ordemId);
    expect(primeiro.status).toBe("cancelada");

    // A outra aba ainda mostra o botão (estado velho) e confirma.
    await outraAba.getByTestId("ordem-cancelar").click();
    await outraAba.getByTestId("ordem-confirmar-cancelar-sim").click();
    await expect(outraAba.getByTestId("ordem-cancelar-erro")).toHaveText(FRASE_JA_ENCERRADA);
    // A tela da segunda aba foi atualizada: o resultado da cancelada aparece atrás do diálogo, a
    // frase fica, e o botão de confirmar não grava de novo.
    await expect(outraAba.getByTestId("ordem-resultado")).toBeAttached();
    await expect(outraAba.getByTestId("ordem-cancelar-erro")).toHaveText(FRASE_JA_ENCERRADA);
    await expect(outraAba.getByTestId("ordem-confirmar-cancelar-sim")).toBeDisabled();

    // Nada foi regravado: o mesmo instante, a mesma pessoa.
    expect(await cancelamentoDaOrdemNoBanco(ordemId)).toEqual(primeiro);
    await outraAba.close();
  });
});

// A venda cancelada no Caixa chega à Produção (D-07, PRD-18): na MESMA transação de
// `cancelarDocumento`, a ordem que ainda aguardava o sinal cai junto (`cancelada_pela_venda`); a já
// liberada NÃO muda no banco — ganha o aviso (derivado na leitura) e o chip no quadro, e o dono
// decide. Todas cancelam a venda pela tela do Financeiro, o caminho real.
test.describe("producao venda cancelada", () => {
  test("(a) ordem aguardando o sinal: cancelar a venda cancela a ordem junto — sai de “Aguardando o sinal” e diz “junto com a venda”", async ({
    page,
  }) => {
    const { ordemId, documentoId } = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo cai com a venda"),
      plano: "sinal",
      sinalPago: false,
    });
    const numeroDaVenda = await numeroDoDocumentoNoBanco(documentoId);
    const hoje = diaEmBrasilia();
    const email = process.env.E2E_EMAIL_TESTE ?? "";

    await fazerLogin(page);
    await page.goto("/gestao/producao");
    await expect(page.locator(`#aguardando-o-sinal [data-ordem-id="${ordemId}"]`)).toBeVisible();

    await cancelarVendaPelaTela(page, documentoId);

    const gravado = await cancelamentoDaOrdemNoBanco(ordemId);
    expect(gravado).toMatchObject({ status: "cancelada", inicio: null, canceladaPelaVenda: true });
    expect(gravado.canceladaEm).not.toBeNull();
    expect(gravado.canceladaPorEmail?.toLowerCase()).toBe(email.toLowerCase());
    expect((await vendaNoBanco(documentoId)).cancelada).toBe(true);

    await page.goto("/gestao/producao");
    await expect(page.locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`)).toHaveCount(0);

    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-resultado")).toHaveText(
      `Cancelada em ${diaMes(hoje)}, junto com a venda nº ${numeroDaVenda}.`,
    );
    await expect(page.getByTestId("producao-selo")).toHaveText("cancelada");
    await expect(page.getByTestId("ordem-caixa-aguardando")).toHaveCount(0);
    await expect(page.getByTestId("ordem-cancelar")).toHaveCount(0);
    await expect(page.getByTestId("ordem-aviso-venda-cancelada")).toHaveCount(0);
  });

  test("(b) ordem já liberada: cancelar a venda NÃO muda a ordem — chip no quadro, aviso com “Cancelar ordem” dentro, que cancela", async ({
    page,
  }) => {
    const { ordemId, documentoId } = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo liberado sem venda"),
      plano: "sinal",
      sinalPago: true,
    });
    const hoje = diaEmBrasilia();
    await liberarOrdemNoBanco(ordemId, hoje);
    const numeroDaVenda = await numeroDoDocumentoNoBanco(documentoId);
    const quemCancelou = await nomeDoUsuario(process.env.E2E_EMAIL_TESTE ?? "");

    await fazerLogin(page);
    await cancelarVendaPelaTela(page, documentoId);

    // D-07: a liberada segue — nada gravado nela.
    expect(await cancelamentoDaOrdemNoBanco(ordemId)).toMatchObject({
      status: "ativa",
      inicio: hoje,
      canceladaEm: null,
      canceladaPelaVenda: false,
    });

    // UI-D19: o chip "venda cancelada" no cartão do quadro.
    await page.goto("/gestao/producao");
    const cartao = page.getByTestId("producao-quadro").locator(`[data-ordem-id="${ordemId}"]`);
    await expect(cartao).toBeVisible();
    await expect(cartao.getByTestId("cartao-venda-cancelada")).toHaveText("venda cancelada");

    // A ordem: o aviso com o "Cancelar ordem" DENTRO, e só esse (o bloco de baixo some).
    await page.goto(`/gestao/producao/${ordemId}`);
    const aviso = page.getByTestId("ordem-aviso-venda-cancelada");
    await expect(aviso).toHaveAttribute("role", "status");
    await expect(aviso).toContainText(
      `A venda nº ${numeroDaVenda} foi cancelada no Financeiro. A ordem continua — decida se ela segue ou se cancela.`,
    );
    await expect(page.getByTestId("ordem-cancelar")).toHaveCount(1);
    await expect(page.getByTestId("ordem-bloco-cancelar")).toBeHidden();

    await aviso.getByTestId("ordem-cancelar").click();
    const dialogo = page.getByTestId("ordem-confirmar-cancelar");
    await expect(dialogo).toContainText(`A venda nº ${numeroDaVenda} já foi cancelada no Financeiro.`);
    await expect(dialogo).not.toContainText("não é cancelada junto");
    await page.getByTestId("ordem-confirmar-cancelar-sim").click();
    await expect(page.getByText(TOAST_CANCELADA)).toBeVisible();
    await expect(page.getByTestId("ordem-resultado")).toHaveText(
      `Cancelada em ${diaMes(hoje)} por ${quemCancelou}.`,
    );
    await expect(page.getByTestId("ordem-aviso-venda-cancelada")).toHaveCount(0);
    expect(await cancelamentoDaOrdemNoBanco(ordemId)).toMatchObject({
      status: "cancelada",
      inicio: hoje,
      canceladaPelaVenda: false,
    });
  });

  test("(c) aba velha da ordem aguardando cuja venda foi cancelada: “Sinal recebido — começar” → “Esta ordem foi cancelada.” e nada muda", async ({
    page,
    context,
  }) => {
    const { ordemId, documentoId } = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo aba velha"),
      plano: "sinal",
      sinalPago: true,
    });
    const numeroDaVenda = await numeroDoDocumentoNoBanco(documentoId);

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-liberar")).toBeVisible();

    // Noutra aba, a venda é cancelada no Caixa — a ordem cai junto.
    const caixa = await context.newPage();
    await cancelarVendaPelaTela(caixa, documentoId);
    await caixa.close();
    const cancelada = await cancelamentoDaOrdemNoBanco(ordemId);
    expect(cancelada).toMatchObject({ status: "cancelada", inicio: null, canceladaPelaVenda: true });

    // A aba velha ainda mostra a caixa e libera: recusado sob a trava da ordem.
    await page.getByTestId("ordem-liberar").click();
    await expect(page.getByTestId("ordem-liberar-erro")).toHaveText(FRASE_ORDEM_CANCELADA);
    // A tela foi atualizada: a caixa sumiu, a frase ficou, e o resultado diz o que aconteceu.
    await expect(page.getByTestId("ordem-caixa-aguardando")).toHaveCount(0);
    await expect(page.getByTestId("ordem-liberar-erro")).toHaveText(FRASE_ORDEM_CANCELADA);
    await expect(page.getByTestId("ordem-resultado")).toContainText(`junto com a venda nº ${numeroDaVenda}.`);

    expect(await cancelamentoDaOrdemNoBanco(ordemId)).toEqual(cancelada);
  });
});

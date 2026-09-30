import { test, expect, type Page } from "@playwright/test";

import { nomeDoUsuario, semearMaterial } from "./apoio/semear-estoque";
import {
  cancelamentoDaOrdemNoBanco,
  diaEmBrasilia,
  diaMes,
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
    // Nada fica editável: sem ações, sem barra fixa, sem "Cancelar ordem", sem −/+.
    await expect(page.getByTestId("ordem-cancelar")).toHaveCount(0);
    await expect(page.getByTestId("ordem-barra-fixa")).toHaveCount(0);
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

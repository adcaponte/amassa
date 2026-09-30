import { test, expect, type Page } from "@playwright/test";

import {
  diaEmBrasilia,
  nomeDaPecaSemeada,
  numeroDoDocumentoNoBanco,
  numeroDoOrcamentoNoBanco,
  semearFotoDeOrcamento,
  semearOrcamentoAprovadoSemOrdem,
  semearOrdem,
  semearOrdemDeOrcamento,
} from "./apoio/semear-producao";

// O bloco "Peças" da ordem (Fase 06.1, plano 04, PRD-10): cada peça com as horas da ficha (o único
// lugar da fase com horas), a sub-linha (cor, personalização, exclusiva, sem ficha), as fotos do
// orçamento servidas pela rota autenticada que já existe (nenhum arquivo copiado) e a linha de
// origem com os links para o orçamento e a venda — e, no Financeiro, a volta à ordem. Cada teste
// semeia os PRÓPRIOS dados com sufixo único (nenhuma afirmação global do banco). Nomes inventados
// com `[e2e]`.

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

test.describe("producao pecas", () => {
  test("(a) ordem de orçamento: as peças com horas e sub-linha, a foto pela rota autenticada e a origem com os dois links", async ({
    page,
  }) => {
    const nome = nomeUnico("Jogo com fotos");
    const { ordemId, orcamentoId, documentoId, parcelaSinalId } = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: false,
      pecas: [
        { quantidade: 3, cor: "azul-cobalto", personalizacao: "com o nome Ana gravado", horasMilesimos: 600 },
        { quantidade: 2, horasMilesimos: 1250 },
      ],
    });
    const fotoId = await semearFotoDeOrcamento(orcamentoId);
    const numeroDoOrcamento = await numeroDoOrcamentoNoBanco(orcamentoId);
    const numeroDaVenda = await numeroDoDocumentoNoBanco(documentoId);

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const bloco = page.getByTestId("ordem-pecas");
    await expect(bloco.getByRole("heading", { name: "Peças" })).toBeVisible();

    const pecas = bloco.getByTestId("ordem-peca");
    await expect(pecas).toHaveCount(2);
    await expect(pecas.nth(0)).toContainText(`3× ${nomeDaPecaSemeada(nome, 0)}`);
    await expect(pecas.nth(0).getByTestId("ordem-peca-horas")).toHaveText("1,8 h");
    await expect(pecas.nth(0).getByTestId("ordem-peca-sub-linha")).toHaveText(
      "Cor: azul-cobalto · com o nome Ana gravado · peça exclusiva",
    );
    await expect(pecas.nth(1)).toContainText(`2× ${nomeDaPecaSemeada(nome, 1)}`);
    await expect(pecas.nth(1).getByTestId("ordem-peca-horas")).toHaveText("2,5 h");
    await expect(pecas.nth(1).getByTestId("ordem-peca-sub-linha")).toHaveText(
      "sem personalização · peça exclusiva",
    );
    // Sem "a mais", sem chip.
    await expect(bloco.getByTestId("ordem-a-mais-chip")).toHaveCount(0);

    // A foto é a do orçamento, pela rota autenticada — só o id na URL, em nova aba.
    const fotos = bloco.getByTestId("ordem-foto");
    await expect(fotos).toHaveCount(1);
    await expect(fotos.first()).toHaveAttribute("href", `/gestao/api/orcamentos/fotos/${fotoId}`);
    await expect(fotos.first()).toHaveAttribute("target", "_blank");
    await expect(fotos.first().locator("img")).toHaveAttribute("alt", "Foto de referência 1 de 1");

    // A origem: 1,8 h + 2,5 h; o orçamento e a venda como links.
    const origem = bloco.getByTestId("ordem-origem");
    await expect(origem).toHaveText(
      `Trabalho estimado: 4,3 h · veio do orçamento nº ${numeroDoOrcamento} · venda nº ${numeroDaVenda} no Financeiro`,
    );
    await expect(origem.getByTestId("ordem-origem-orcamento")).toHaveAttribute(
      "href",
      `/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`,
    );
    await expect(origem.getByTestId("ordem-origem-venda")).toHaveAttribute(
      "href",
      `/gestao/financeiro?aba=caixa&parcelaFoco=${parcelaSinalId}`,
    );

    // O link do orçamento leva ao orçamento.
    await origem.getByTestId("ordem-origem-orcamento").click();
    await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${orcamentoId}`));
  });

  test("(b) ordem sem orçamento e sem ficha: sem fotos, a origem só com as horas “sem estimativa”, “sem personalização · sem ficha”", async ({
    page,
  }) => {
    const nome = nomeUnico("Pedido de boca");
    const ordemId = await semearOrdem({
      nome,
      tipo: "encomenda",
      caminho: "completo",
      status: "ativa",
      inicio: diaEmBrasilia(),
      etapasFeitas: [],
      pecas: [{ descricao: `${nome} · caneca`, quantidade: 4 }],
      clienteNome: "[e2e] Cliente de boca",
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const bloco = page.getByTestId("ordem-pecas");
    await expect(bloco.getByTestId("ordem-peca")).toHaveCount(1);
    await expect(bloco.getByTestId("ordem-peca-sub-linha")).toHaveText("sem personalização · sem ficha");
    await expect(bloco.getByTestId("ordem-peca-horas")).toHaveCount(0);
    await expect(bloco.getByTestId("ordem-foto")).toHaveCount(0);
    const origem = bloco.getByTestId("ordem-origem");
    await expect(origem).toHaveText("Trabalho estimado: sem estimativa (peça sem ficha)");
    await expect(origem.getByRole("link")).toHaveCount(0);
  });

  test("(c) no Financeiro, a venda nascida de orçamento com ordem mostra “Ver ordem na Produção” e leva à ordem", async ({
    page,
  }) => {
    const nome = nomeUnico("Venda com ordem");
    const { ordemId, documentoId } = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: false,
    });

    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${documentoId}`);

    const origem = page.getByTestId("documento-origem-orcamento");
    await expect(origem).toBeVisible({ timeout: 10000 });
    await expect(origem.getByRole("link", { name: "Ver orçamento" })).toBeVisible();
    const verOrdem = origem.getByTestId("documento-ver-ordem");
    await expect(verOrdem).toHaveText("Ver ordem na Produção");
    await expect(verOrdem).toHaveAttribute("href", `/gestao/producao/${ordemId}`);

    await verOrdem.click();
    await expect(page).toHaveURL(new RegExp(`/gestao/producao/${ordemId}$`));
    await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  });

  test("(d) a venda de um orçamento aprovado sem ordem não mostra “Ver ordem na Produção”", async ({ page }) => {
    const nome = nomeUnico("Venda sem ordem");
    const { documentoId } = await semearOrcamentoAprovadoSemOrdem({
      nome,
      plano: "avista",
      sinalPago: false,
    });

    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${documentoId}`);

    const origem = page.getByTestId("documento-origem-orcamento");
    await expect(origem).toBeVisible({ timeout: 10000 });
    await expect(origem.getByRole("link", { name: "Ver orçamento" })).toBeVisible();
    await expect(page.getByTestId("documento-ver-ordem")).toHaveCount(0);
  });
});

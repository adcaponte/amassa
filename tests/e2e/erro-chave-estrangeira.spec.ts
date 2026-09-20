import { test, expect, type Page } from "@playwright/test";

import { hojeEmBrasilia } from "@/lib/abertura/formato";

import {
  apagarCategoriaDeCotacaoPeloNome,
  apagarFornoPeloNome,
  apagarItemDeAberturaPeloNome,
  comecarExclusaoDeCategoria,
} from "./apoio/apagar-referencia";
import { criarCategoriaDeDespesa } from "./apoio/semear-financeiro";

// A prova de que Queimas, Abertura, Cotações e Financeiro mostram a mensagem humana de chave
// estrangeira (lib/erro/postgres.ts, quick-260920-dx9/fk9) em vez da frase genérica de falha, nos
// quatro módulos. "chave estrangeira" no título do describe é o recorte usado pelo orçamento de
// e2e deste plano (`npm run test:e2e -- --grep "chave estrangeira"`).
//
// Sem etiqueta `@vazio-*`: os quatro casos criam os próprios dados, e nenhum deles afirma
// condição global do banco (convenção do CLAUDE.md).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cartaoDoForno(page: Page, nome: string) {
  return page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
}

test.describe("chave estrangeira — a linha referenciada sumiu entre montar o formulário e enviar", () => {
  // SEM `mode: "serial"`: os três casos são independentes — cada um cria os próprios dados, com
  // nome único, num módulo diferente. O modo serial aqui só serviria para ESCONDER defeito: com
  // ele, a falha do primeiro caso pula os outros dois, e a prova de Abertura e de Cotações nunca
  // chega a rodar. Medido de propósito, com o detector quebrado recolocado no lugar: o modo
  // serial reportava "2 failed, 4 did not run" em vez das 6 falhas reais.

  test("Queimas: o forno apagado com o cartão na tela mostra 'Esse forno não existe mais. Recarregue a página.'", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Forno FK");

    await page.goto("/queimas?novo");
    await page.getByLabel("Nome").fill(nome);
    await page.getByLabel("Limite").fill("50");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/queimas$/, { timeout: 10000 });

    const cartao = cartaoDoForno(page, nome);
    await expect(cartao).toBeVisible();

    // A corrida real: o forno some do banco DEPOIS de o cartão já estar na tela.
    await apagarFornoPeloNome(nome);

    await cartao.getByRole("button", { name: "Queimar" }).click();
    await cartao.getByTestId("tipo-queima-biscoito").click();

    await expect(page.getByText("Esse forno não existe mais. Recarregue a página.")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Não deu para registrar a queima. Verifique a internet e tente de novo."),
    ).not.toBeVisible();
  });

  test("Abertura: o item apagado com o formulário de tarefa na tela mostra 'O item ligado a esta tarefa não existe mais. Recarregue a página e tente de novo.'", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeDoItem = nomeUnico("Item FK");

    await page.goto("/abertura?item=novo");
    await page.getByLabel("O que é").fill(nomeDoItem);
    await page.getByLabel("Valor total").fill("1000");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });

    await page.goto("/abertura?aba=tarefas&tarefa=nova");
    await expect(page.getByRole("heading", { name: "Nova tarefa" })).toBeVisible();

    const descricao = nomeUnico("Tarefa ligada ao item FK");
    await page.getByLabel("O que fazer").fill(descricao);
    await page.getByLabel("Até quando").fill(hojeEmBrasilia(new Date()));
    await page.getByRole("combobox", { name: "Ligada a algum item?" }).click();
    await page.getByRole("option", { name: nomeDoItem }).click();
    // "Quem" fica no padrão ("ninguém ainda") — um responsável escolhido dispara a conferência
    // de gestor ativo ANTES do insert, e essa não é a corrida que queremos medir.

    // A corrida real: o item some do banco DEPOIS de o formulário já estar preenchido.
    await apagarItemDeAberturaPeloNome(nomeDoItem);

    await page.getByRole("button", { name: "Adicionar tarefa" }).click();

    await expect(
      page.getByText("O item ligado a esta tarefa não existe mais. Recarregue a página e tente de novo."),
    ).toBeVisible({ timeout: 10000 });
    // Nada é perdido em silêncio: o formulário continua aberto com o texto digitado.
    await expect(page.getByLabel("O que fazer")).toHaveValue(descricao);
  });

  test("Cotações: a categoria apagada com o formulário de cotação na tela mostra 'Essa categoria não existe mais. Recarregue a página e tente de novo.'", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nomeDaCategoria = nomeUnico("Categoria FK");

    await page.goto("/abertura?aba=cotacoes");
    await page.getByRole("link", { name: "+ Nova categoria" }).first().click();
    await expect(page.getByRole("heading", { name: "Nova categoria" })).toBeVisible();
    await page.getByLabel("Nome", { exact: true }).fill(nomeDaCategoria);
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, { timeout: 10000 });

    await page.getByRole("link", { name: "+ Nova cotação" }).first().click();
    await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeVisible();
    const empresa = nomeUnico("Empresa FK");
    await page.getByLabel("Empresa").fill(empresa);

    // A corrida real: a categoria some do banco DEPOIS de o formulário já estar preenchido.
    await apagarCategoriaDeCotacaoPeloNome(nomeDaCategoria);

    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(
      page.getByText("Essa categoria não existe mais. Recarregue a página e tente de novo."),
    ).toBeVisible({ timeout: 10000 });
    // Nada é perdido em silêncio: o formulário continua aberto com o texto digitado.
    await expect(page.getByLabel("Empresa")).toHaveValue(empresa);
  });

  test("Financeiro (Despesa): a categoria some ENTRE a pré-conferência e a gravação, mostra 'Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.'", async ({
    page,
  }) => {
    // Diferente dos três casos acima: `lancarDespesa` (lib/financeiro/acoes.ts) faz uma
    // PRÉ-CONFERÊNCIA fresca da categoria antes do `insert` — apagar a categoria antes do envio
    // (o mesmo truque dos outros três casos) nunca alcançaria o backstop de chave estrangeira,
    // só a frase da própria pré-conferência. A prova real precisa de uma corrida de verdade: a
    // categoria some DEPOIS da pré-conferência e ANTES da gravação (ver
    // `comecarExclusaoDeCategoria`, tests/e2e/apoio/apagar-referencia.ts).
    await fazerLogin(page);
    const nomeDaCategoria = nomeUnico("Categoria Despesa FK");
    const categoriaId = await criarCategoriaDeDespesa(nomeDaCategoria);
    const descricao = nomeUnico("Despesa FK");

    await page.goto("/financeiro?aba=despesa");
    await page.getByTestId("despesa-modo-outra").click();
    await page.getByLabel("Descrição").fill(descricao);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: nomeDaCategoria }).click();
    await page.getByLabel("Valor", { exact: true }).fill("100");
    await expect(page.getByRole("button", { name: "Lançar despesa" })).toBeEnabled();

    // Abre (mas não confirma) a exclusão da categoria — a linha fica travada dentro de uma
    // transação aberta. A pré-conferência do servidor, que roda logo no início de `lancarDespesa`,
    // não enxerga uma exclusão não confirmada (MVCC) e passa normalmente.
    const exclusao = await comecarExclusaoDeCategoria(categoriaId);

    await page.getByRole("button", { name: "Lançar despesa" }).click();

    // Tempo de sobra para a pré-conferência (um único `select` indexado) já ter rodado e o
    // `insert` seguinte já estar bloqueado, esperando o lock que só `commitar()` solta — o valor
    // exato não importa: a transação de teste fica presa até aqui, então não há como o servidor
    // "adiantar" a corrida enquanto esperamos.
    await page.waitForTimeout(1000);

    // Só agora a categoria some de fato — o `insert` bloqueado destrava e encontra a chave
    // estrangeira quebrada.
    await exclusao.commitar();

    await expect(
      page.getByText("Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo."),
    ).toBeVisible({ timeout: 10000 });
    // Nada é perdido em silêncio: o formulário continua aberto com o texto digitado.
    await expect(page.getByLabel("Descrição")).toHaveValue(descricao);
  });
});

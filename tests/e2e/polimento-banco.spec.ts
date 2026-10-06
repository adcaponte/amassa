import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { mesesParaGeracao, tituloDaContaFixa } from "@/lib/cadastros/contas-fixas";

import { abrirContasDepoisDaJanela } from "./apoio/caixa-janela";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";
import { semearFicha } from "./apoio/semear-producao";

// O banco da Fase 06.5 (06.5-11-PLAN.md, migração 0031, D-25 e D-26):
// - uma conta fixa cancelada libera o mês e é gerada de novo pela tela — o índice único parcial
//   `documentos_conta_fixa_mes_ativo_uk` e o `onConflictDoNothing` com o predicado
//   `cancelado_em is null` de `gerarContasDoMes`;
// - `/api/health/polimento` prova a 0031 de fora (o e2e roda depois das migrações: 200);
// - um orçamento no pior caso dos checks não derruba a lista (a soma em `bigint`).

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

async function irParaContasFixas(page: Page) {
  await page.goto("/gestao/cadastros?sub=fixas");
}

// O botão "+ Nova conta fixa" mora no rodapé da lista ou no estado vazio, conforme outro worker já
// ter criado alguma conta — o mesmo padrão de `cadastros-contas-fixas.spec.ts`.
async function abrirNovaContaFixa(page: Page) {
  const botaoPopulado = page.getByTestId("nova-conta-fixa");
  const botaoVazio = page
    .getByTestId("cadastros-vazio-fixas")
    .getByRole("button", { name: "+ Nova conta fixa" });
  await Promise.race([
    botaoPopulado.waitFor({ state: "visible" }),
    botaoVazio.waitFor({ state: "visible" }),
  ]);
  if (await botaoPopulado.isVisible()) {
    await botaoPopulado.click();
  } else {
    await botaoVazio.click();
  }
}

function linhaDaContaFixa(page: Page, nome: string) {
  return page
    .getByTestId("conta-fixa-linha")
    .filter({ has: page.getByText(nome, { exact: true }) });
}

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

async function gerarContasDoMes(page: Page, mes: string) {
  await irParaContasFixas(page);
  await page.getByTestId("gerar-contas-mes").selectOption(mes);
  await page.getByTestId("gerar-contas").click();
  // "N conta(s) de {mês} criada(s) no Caixa." — nunca "já existiam": a conta deste teste é nova
  // (primeira geração) ou acabou de ser cancelada (segunda), e nos dois casos o mês é criado.
  await expect(page.getByText(/conta\(s\) de .+ criada\(s\) no Caixa\.$/)).toBeVisible({
    timeout: 10000,
  });
}

test.describe("polimento banco — conta fixa", () => {
  // "Gerar" é GLOBAL (toda conta fixa ativa do banco). Para não disputar mês com
  // `cadastros-contas-fixas` (que gera o 2º, o 3º e o 4º mês da faixa) nem pôr despesas no mês
  // corrente que outros testes leem, cada projeto gera um mês PRÓPRIO, no fim da faixa: o último
  // no desktop, o penúltimo no celular. A afirmação é sempre sobre o título da PRÓPRIA conta.
  test("uma conta fixa cancelada no Caixa é gerada de novo para o mesmo mês", async ({
    page,
  }, testInfo) => {
    const faixa = mesesParaGeracao(hojeNoAtelie());
    const mes =
      testInfo.project.name === "desktop"
        ? faixa[faixa.length - 1]
        : faixa[faixa.length - 2];
    const nome = `[e2e] Conta da 0031 ${sufixoUnico()}`;
    const titulo = tituloDaContaFixa(nome, mes);

    await fazerLogin(page);
    await irParaContasFixas(page);

    await abrirNovaContaFixa(page);
    await expect(page.getByRole("heading", { name: "Nova conta fixa" })).toBeVisible();
    await page.getByLabel("Nome").fill(nome);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Aluguel", exact: true }).click();
    await page.getByLabel("Valor esperado", { exact: true }).fill("321");
    await page.getByLabel("Dia de vencimento").fill("12");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(linhaDaContaFixa(page, nome)).toBeVisible();

    // 1ª geração: a conta aparece em "A pagar".
    await gerarContasDoMes(page, mes);
    await page.goto("/gestao/financeiro?aba=caixa");
    // O mês gerado fica no fim da faixa, depois da janela de 30 dias do Caixa (06.5-12).
    await abrirContasDepoisDaJanela(page);
    await expect(cartaoDaConta(page, titulo)).toHaveCount(1);

    // Cancela a despesa gerada pelo detalhe do Caixa.
    await cartaoDaConta(page, titulo).getByRole("button", { name: "Ver" }).click();
    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await detalhe.getByRole("button", { name: "Cancelar esta despesa" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar despesa", exact: true })
      .click();
    await expect(
      page.getByText(/^Lançamento nº \d+ cancelado\. Continua visível, riscado\.$/),
    ).toBeVisible({
      timeout: 10000,
    });
    await page.goto("/gestao/financeiro?aba=caixa");
    // O mês gerado fica no fim da faixa, depois da janela de 30 dias do Caixa (06.5-12).
    await abrirContasDepoisDaJanela(page);
    await expect(page.getByTestId("caixa-a-pagar")).toBeVisible();
    await expect(cartaoDaConta(page, titulo)).toHaveCount(0);

    // 2ª geração do MESMO mês: a cancelada não segura o mês (D-26) — a conta volta, uma vez só.
    await gerarContasDoMes(page, mes);
    await page.goto("/gestao/financeiro?aba=caixa");
    // O mês gerado fica no fim da faixa, depois da janela de 30 dias do Caixa (06.5-12).
    await abrirContasDepoisDaJanela(page);
    await expect(cartaoDaConta(page, titulo)).toHaveCount(1);

    // Faxina: desativa a conta, para ela não entrar nas gerações de outros testes.
    await irParaContasFixas(page);
    await linhaDaContaFixa(page, nome).getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Conta fixa desativada.")).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("polimento banco — saúde da 0031", () => {
  test("/api/health/polimento responde 200 e só o status", async ({ request }) => {
    const resposta = await request.get("/api/health/polimento");
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual({ status: "ok" });
  });
});

// Um orçamento em rascunho com UMA linha no pior caso dos checks de `orcamento_linhas` para a
// quantidade (100 000 peças) a R$ 10.000,00 cada: 10^11 centavos, muito além do `integer` (o
// produto `integer * integer` estourava antes da soma — D-25). Semeado direto no banco, com o
// sequencial do MESMO contador da aplicação (`contadores_orcamento`, como `semear-producao.ts`),
// e apagado no fim — nenhum outro teste passa a ver um orçamento de R$ 1 bilhão na lista.
async function semearOrcamentoEnorme(titulo: string, fichaId: string): Promise<string> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await cliente.query("begin");
    const { rows: usuario } = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1) limit 1",
      [process.env.E2E_EMAIL_TESTE ?? ""],
    );
    const hoje = hojeNoAtelie();
    const ano = Number(hoje.slice(0, 4));
    const { rows: contador } = await cliente.query<{ ultimo_numero: number }>(
      `insert into contadores_orcamento (ano, ultimo_numero) values ($1, 1)
       on conflict (ano) do update set ultimo_numero = contadores_orcamento.ultimo_numero + 1
       returning ultimo_numero`,
      [ano],
    );
    const { rows: orcamento } = await cliente.query<{ id: string }>(
      `insert into orcamentos (ano, sequencial, titulo, data, entrega_prevista, criado_por)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [ano, contador[0].ultimo_numero, titulo, hoje, somarDiasAoHoje(60), usuario[0].id],
    );
    await cliente.query(
      `insert into orcamento_linhas (orcamento_id, ficha_id, quantidade, preco_unitario_centavos, ordem)
       values ($1, $2, 100000, 1000000, 0)`,
      [orcamento[0].id, fichaId],
    );
    await cliente.query("commit");
    return orcamento[0].id;
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    throw erro;
  } finally {
    await cliente.end();
  }
}

async function apagarOrcamento(orcamentoId: string): Promise<void> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await cliente.query("delete from orcamento_linhas where orcamento_id = $1", [
      orcamentoId,
    ]);
    await cliente.query("delete from orcamentos where id = $1", [orcamentoId]);
  } finally {
    await cliente.end();
  }
}

test.describe("polimento banco — orçamento enorme", () => {
  test("100 000 peças a R$ 10.000,00 aparecem na lista com R$ 1.000.000.000,00", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { fichaId } = await semearFicha({
      nome: `[e2e] Peça do orçamento enorme ${suf}`,
      exclusiva: true,
      comItem: false,
      argilaMiligramas: 450000,
      esmalteMiligramas: 60000,
      larguraMm: 120,
      profundidadeMm: 90,
      alturaMm: 100,
      horasMilesimos: 600,
    });
    const titulo = `[e2e] Orçamento enorme ${suf}`;
    const orcamentoId = await semearOrcamentoEnorme(titulo, fichaId);
    try {
      await fazerLogin(page);
      await page.goto("/gestao/financeiro?aba=orcamentos");
      // A lista de verdade (não o esqueleto do carregamento nem a página de erro).
      await expect(page.getByTestId("orcamentos-lista")).toBeVisible();
      const linha = page.getByTestId("orcamento-linha").filter({ hasText: titulo });
      await expect(linha).toHaveCount(1);
      await expect(linha.getByTestId("orcamento-total")).toHaveText(
        /^R\$\s1\.000\.000\.000,00$/,
      );
    } finally {
      await apagarOrcamento(orcamentoId);
    }
  });
});

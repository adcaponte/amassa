import { test, expect, type Locator, type Page } from "@playwright/test";

import { toastLancadoNaVenda } from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { LINHA2_FAIXA_DAS_QUEIMAS } from "@/lib/queimas/textos";

import { hojeNoAtelie } from "./apoio/semear-financeiro";
import { idDoUsuarioDoTeste } from "./apoio/semear-fornecedores";
import { lerVendasDaQueima, travarPrecosDasQueimas, type TravaDosPrecosDasQueimas } from "./apoio/semear-queimas";

// “Lançar na Venda” das Queimas (Fase 06.4, plano 05 — QMC-08; D-07, decisão do dono de 04/10/2026:
// várias vendas por queima, uma por pessoa; UI-D30: as quantidades da própria Venda são o passo de
// “quantas de cada tamanho”). A Venda do Financeiro abre com o que FALTA, pessoa livre; diminuir deixa o
// resto em “a cobrar”; a volta às Queimas mostra o aviso uma vez. Cada teste cadastra o próprio forno, de
// nome único, e acha a SUA linha de “a cobrar” por `data-queima-id` — nunca afirma a lista inteira.
//
// Os preços dos três itens “Queima externa P/M/G” são estado GLOBAL: todo teste roda sob
// `travarPrecosDasQueimas` (trava consultiva; `desktop` e `celular` se revezam) e os devolve a nulo no
// fim. Preços de teste inventados. O prazo de 180 s é pela espera da trava (molde `queimas-cobranca`).
test.describe.configure({ timeout: 180_000 });

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixo(): string {
  return `${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cadastrarForno(page: Page, nome: string): Promise<void> {
  await page.goto("/gestao/queimas?novo");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Limite").fill("50");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/gestao\/queimas$/, { timeout: 10000 });
}

type Externas = { p?: number; m?: number; g?: number };

// Registra uma queima de biscoito no forno pela interface e conta as externas pedidas na folha que abre
// depois (“+” de cada tamanho). Devolve o id da queima.
async function registrarEContar(page: Page, nomeDoForno: string, externas: Externas): Promise<string> {
  const cartao = page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nomeDoForno });
  await cartao.scrollIntoViewIfNeeded();
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId("tipo-queima-biscoito").click();
  const folha = page.getByTestId("folha-contagem");
  await expect(folha).toBeVisible({ timeout: 10000 });
  const id = (await folha.getAttribute("data-queima-id")) ?? "";
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  for (const [tamanho, quantidade] of Object.entries(externas)) {
    for (let vez = 0; vez < (quantidade ?? 0); vez += 1) {
      await folha.getByTestId(`contador-externas-${tamanho}-mais`).click();
    }
  }
  await folha.getByTestId("contagem-salvar").click();
  await expect(folha).toBeHidden({ timeout: 10000 });
  return id;
}

function linhaACobrar(page: Page, queimaId: string): Locator {
  return page
    .getByTestId("queimas-a-cobrar")
    .locator(`[data-testid="a-cobrar-linha"][data-queima-id="${queimaId}"]`);
}

function linhaDoCarrinho(page: Page, texto: string): Locator {
  return page.getByTestId("venda-linha").filter({ hasText: texto });
}

// “Lançar na Venda” da linha → a Venda do Financeiro com a origem da queima.
async function lancarNaVenda(page: Page, queimaId: string): Promise<void> {
  await linhaACobrar(page, queimaId).getByTestId("lancar-na-venda").click();
  await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=venda&origem=queima%3A/, { timeout: 10000 });
  await expect(page.getByTestId("faixa-das-queimas")).toBeVisible();
}

test.describe("cobrança da queima — lançar na venda", () => {
  test("a Venda abre com o que falta e a pessoa livre; baixar M para 1 deixa o resto em “a cobrar”; a segunda pessoa leva o resto numa venda dela", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const suf = sufixo();
      const nome = `[e2e] venda ${suf}`;
      await cadastrarForno(page, nome);
      const queimaId = await registrarEContar(page, nome, { p: 1, m: 2 });

      const linha = linhaACobrar(page, queimaId);
      await expect(linha.getByTestId("a-cobrar-falta")).toHaveText("falta: 1 P · 2 M", { timeout: 10000 });
      await expect(linha.getByTestId("lancar-na-venda")).toHaveAttribute(
        "href",
        `/gestao/financeiro?aba=venda&origem=queima%3A${queimaId}`,
      );
      await lancarNaVenda(page, queimaId);

      // A faixa “Das Queimas”, com o forno e a 2ª linha da D-07.
      const textoDaFaixa = page.getByTestId("faixa-das-queimas-texto");
      await expect(textoDaFaixa).toContainText("Das Queimas · Biscoito de");
      await expect(textoDaFaixa).toContainText(nome);
      await expect(page.getByTestId("faixa-das-queimas-linha2")).toHaveText(LINHA2_FAIXA_DAS_QUEIMAS);
      await expect(page.getByTestId("voltar-as-queimas")).toHaveAttribute("href", "/gestao/queimas");
      await expect(page.getByTestId("faixa-da-agenda")).toHaveCount(0);
      await expect(page.getByTestId("faixa-em-montagem")).toHaveCount(0);

      // O carrinho com o que falta, uma linha por tamanho, ao preço atual; nenhuma linha de G.
      await expect(page.getByTestId("venda-linha")).toHaveCount(2);
      const linhaP = linhaDoCarrinho(page, trava.nomes.P);
      const linhaM = linhaDoCarrinho(page, trava.nomes.M);
      await expect(linhaP.getByTestId("venda-linha-quantidade")).toHaveText("1");
      await expect(linhaM.getByTestId("venda-linha-quantidade")).toHaveText("2");
      await expect(linhaDoCarrinho(page, trava.nomes.G)).toHaveCount(0);
      await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(1100 + 2 * 2300));

      // A pessoa é LIVRE: o campo normal, vazio e editável — nunca a pessoa travada da Agenda.
      await expect(page.getByTestId("pessoa-travada")).toHaveCount(0);
      const pessoa = page.getByLabel("Pessoa (opcional)");
      await expect(pessoa).toHaveValue("");
      await expect(pessoa).toBeEditable();

      // À vista EM ABERTO vencendo hoje.
      await expect(page.getByTestId("pagamento-ja-pago").locator("input")).not.toBeChecked();
      await expect(page.getByTestId("pagamento-vence-em")).toHaveValue(hojeNoAtelie());

      // A quantidade da própria Venda é o passo de “quantas de cada tamanho” (UI-D30): M de 2 para 1.
      await linhaM.getByRole("button", { name: "menos um" }).click();
      await expect(linhaM.getByTestId("venda-linha-quantidade")).toHaveText("1");
      await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(1100 + 2300));
      const pessoaA = `[e2e] pessoa A ${suf}`;
      await pessoa.fill(pessoaA);
      await page.getByRole("button", { name: "Lançar venda" }).click();

      // A volta às Queimas: o aviso uma vez, a URL limpa, e a linha CONTINUA com o M que falta.
      await expect(page).toHaveURL(/\/gestao\/queimas/, { timeout: 10000 });
      let vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(1);
      await expect(page.getByText(toastLancadoNaVenda(vendas[0].numero))).toBeVisible();
      await expect(page).not.toHaveURL(/aviso=/);
      await expect(linha.getByTestId("a-cobrar-falta")).toHaveText("falta: 1 M", { timeout: 10000 });
      await expect(linha).toHaveAttribute("data-situacao", "parcial");
      await expect(linha.getByTestId("a-cobrar-venda")).toHaveText(
        `já lançado: venda nº ${vendas[0].numero} (1 P · 1 M)`,
      );

      // A segunda pessoa: a Venda abre só com o M que falta.
      await lancarNaVenda(page, queimaId);
      await expect(page.getByTestId("venda-linha")).toHaveCount(1);
      await expect(linhaDoCarrinho(page, trava.nomes.M).getByTestId("venda-linha-quantidade")).toHaveText("1");
      await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(2300));
      const pessoaB = `[e2e] pessoa B ${suf}`;
      await page.getByLabel("Pessoa (opcional)").fill(pessoaB);
      await page.getByRole("button", { name: "Lançar venda" }).click();
      await expect(page).toHaveURL(/\/gestao\/queimas/, { timeout: 10000 });
      await expect(linha).toHaveCount(0, { timeout: 10000 });

      // O banco: dois vínculos, cada venda com a sua pessoa e uma parcela à vista EM ABERTO vencendo hoje.
      const usuario = await idDoUsuarioDoTeste();
      vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(2);
      expect(vendas[0]).toMatchObject({
        quantidadeP: 1,
        quantidadeM: 1,
        quantidadeG: 0,
        lancadoPor: usuario,
        pessoaNome: pessoaA,
        clienteId: null,
        cancelado: false,
      });
      expect(vendas[1]).toMatchObject({
        quantidadeP: 0,
        quantidadeM: 1,
        quantidadeG: 0,
        lancadoPor: usuario,
        pessoaNome: pessoaB,
        clienteId: null,
        cancelado: false,
      });
      expect(vendas[0].linhas.map((item) => [item.descricao, item.quantidade, item.valorCentavos])).toEqual([
        [trava.nomes.P, 1, 1100],
        [trava.nomes.M, 1, 2300],
      ]);
      expect(vendas[0].parcelas).toEqual([
        { vencimento: hojeNoAtelie(), valorCentavos: 3400, forma: "pix", pagoEm: null },
      ]);
      expect(vendas[1].parcelas).toEqual([
        { vencimento: hojeNoAtelie(), valorCentavos: 2300, forma: "pix", pagoEm: null },
      ]);
    } finally {
      await trava?.soltar();
    }
  });
});

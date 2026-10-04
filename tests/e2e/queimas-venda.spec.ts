import { test, expect, type Locator, type Page } from "@playwright/test";

import { FRASE_VENDA_EM_MONTAGEM_GUARDADA, toastLancadoNaVenda } from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { hrefDaVendaComOrigem, hrefDoCaixa } from "@/lib/financeiro/navegacao";
import {
  DICA_FIM_A_COBRAR,
  FRASE_LINHA_DA_QUEIMA_FALTANDO,
  FRASE_ORIGEM_QUEIMA_NAO_ACHADA,
  LINHA2_FAIXA_DAS_QUEIMAS,
  fraseAcimaDoQueFaltaNaVenda,
  fraseOrigemQueimaTudoLancado,
  fraseSemPrecoDaQueima,
  toastLancadoNaVendaPago,
} from "@/lib/queimas/textos";

import { hojeNoAtelie, semearItem } from "./apoio/semear-financeiro";
import { idDoUsuarioDoTeste } from "./apoio/semear-fornecedores";
import {
  lerVendasDaQueima,
  semearContagem,
  semearForno,
  semearQueimaSemContagem,
  travarPrecosDasQueimas,
  type TravaDosPrecosDasQueimas,
} from "./apoio/semear-queimas";

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

// Uma queima com as externas pedidas, semeada direto no banco num forno de nome único (as bordas não
// precisam provar o registro pela interface — o traçador acima já prova).
async function semearQueimaComExternas(nomeDoForno: string, externas: Externas): Promise<string> {
  await semearForno(nomeDoForno);
  const queimaId = await semearQueimaSemContagem(nomeDoForno, process.env.E2E_EMAIL_TESTE ?? "");
  await semearContagem(queimaId, { externasP: externas.p, externasM: externas.m, externasG: externas.g });
  return queimaId;
}

test.describe("cobrança da queima — venda: bordas", () => {
  test("(f) a venda paga na própria Venda volta com “Já está no Caixa de hoje.”; (a) abrir de novo: nada mais a cobrar, com o número e “ver no Caixa”", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const queimaId = await semearQueimaComExternas(`[e2e] venda paga ${sufixo()}`, { p: 1 });
      const href = hrefDaVendaComOrigem({ tipo: "queima", id: queimaId });

      await page.goto(href);
      await expect(page.getByTestId("faixa-das-queimas")).toBeVisible();
      await expect(linhaDoCarrinho(page, trava.nomes.P).getByTestId("venda-linha-quantidade")).toHaveText("1");
      // O dono marca “pago” ali mesmo (UI-D24).
      await page.getByTestId("pagamento-ja-pago").locator("input").check();
      await page.getByRole("button", { name: "Lançar venda" }).click();
      await expect(page).toHaveURL(/\/gestao\/queimas/, { timeout: 10000 });
      const vendas = await lerVendasDaQueima(queimaId);
      expect(vendas).toHaveLength(1);
      await expect(page.getByText(toastLancadoNaVendaPago(vendas[0].numero))).toBeVisible();
      await expect(page.getByText(toastLancadoNaVenda(vendas[0].numero))).toHaveCount(0);
      await expect(page).not.toHaveURL(/aviso=/);
      expect(vendas[0].parcelas).toEqual([
        { vencimento: hojeNoAtelie(), valorCentavos: 1100, forma: "pix", pagoEm: hojeNoAtelie() },
      ]);
      await expect(linhaACobrar(page, queimaId)).toHaveCount(0);

      // A mesma URL de novo: nada mais a cobrar — nunca um carrinho com dado velho.
      await page.goto(href);
      const indisponivel = page.getByTestId("origem-indisponivel");
      await expect(indisponivel).toContainText(fraseOrigemQueimaTudoLancado([vendas[0].numero]));
      await expect(indisponivel.getByTestId("origem-ver-no-caixa")).toHaveAttribute("href", hrefDoCaixa());
      await expect(page.getByTestId("venda-linha")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Lançar venda" })).toHaveCount(0);
    } finally {
      await trava?.soltar();
    }
  });

  test("(g) subir acima do que falta é recusado pelo servidor; (d) tirar todas as linhas de queima é recusado — nada gravado", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const queimaId = await semearQueimaComExternas(`[e2e] venda bordas ${sufixo()}`, { p: 1 });
      await page.goto(hrefDaVendaComOrigem({ tipo: "queima", id: queimaId }));
      await expect(page.getByTestId("faixa-das-queimas")).toBeVisible();

      // (g) P de 1 para 2: o cliente não repete a conta; o servidor recusa sob a trava.
      const linhaP = linhaDoCarrinho(page, trava.nomes.P);
      await linhaP.getByRole("button", { name: "mais um" }).click();
      await expect(linhaP.getByTestId("venda-linha-quantidade")).toHaveText("2");
      await page.getByRole("button", { name: "Lançar venda" }).click();
      // (o anunciador de rotas do Next também tem role="alert": filtrado pela frase)
      await expect(page.getByRole("alert").filter({ hasText: fraseAcimaDoQueFaltaNaVenda("1 P") })).toBeVisible();
      await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=venda&origem=queima%3A/);
      expect(await lerVendasDaQueima(queimaId)).toEqual([]);

      // (d) Tira a linha de queima e põe uma linha livre: a venda não sai sem uma linha de queima externa.
      await linhaP.getByRole("button", { name: "tirar" }).click();
      await expect(linhaDoCarrinho(page, trava.nomes.P)).toHaveCount(0);
      const descricao = `[e2e] linha livre ${sufixo()}`;
      await page.getByRole("button", { name: "+ Valor livre" }).click();
      await page.getByLabel("O que é").fill(descricao);
      await page.getByRole("combobox", { name: "Categoria" }).click();
      await page.getByRole("option", { name: "Aporte dos sócios" }).click();
      await page.getByLabel("Valor", { exact: true }).fill("5");
      await page.getByRole("button", { name: "Pôr na venda" }).click();
      await expect(linhaDoCarrinho(page, descricao)).toBeVisible();
      await page.getByRole("button", { name: "Lançar venda" }).click();
      await expect(page.getByRole("alert").filter({ hasText: FRASE_LINHA_DA_QUEIMA_FALTANDO })).toBeVisible();
      await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=venda&origem=queima%3A/);
      expect(await lerVendasDaQueima(queimaId)).toEqual([]);
    } finally {
      await trava?.soltar();
    }
  });

  test("(e) a venda que estava em montagem continua guardada: a faixa avisa e ela volta intacta depois", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      const suf = sufixo().replace(/\s/g, "-");
      const nomeDoItem = `[e2e] Prato em montagem ${suf}`;
      await semearItem({
        nome: nomeDoItem,
        categoriaVenda: "Peças prontas",
        precoCentavos: 3800,
        apareceNaVenda: true,
        atalhoVenda: false,
        controlaEstoque: false,
        atalhoCompra: false,
      });
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: 3700 });
      const queimaId = await semearQueimaComExternas(`[e2e] venda montagem ${suf}`, { m: 1 });

      // Uma venda em montagem no Financeiro (o rascunho comum, no `sessionStorage` desta aba).
      await page.goto("/gestao/financeiro");
      await page.getByTestId("venda-busca").fill(suf);
      await page.getByTestId("venda-atalho").filter({ hasText: nomeDoItem }).click();
      await expect(linhaDoCarrinho(page, nomeDoItem)).toBeVisible();

      await page.goto("/gestao/queimas");
      await lancarNaVenda(page, queimaId);
      await expect(page.getByTestId("faixa-em-montagem")).toHaveText(FRASE_VENDA_EM_MONTAGEM_GUARDADA);
      await expect(linhaDoCarrinho(page, nomeDoItem)).toHaveCount(0);
      await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(2300));
      await page.getByRole("button", { name: "Lançar venda" }).click();
      await expect(page).toHaveURL(/\/gestao\/queimas/, { timeout: 10000 });
      expect(await lerVendasDaQueima(queimaId)).toHaveLength(1);

      // A Venda sem origem: o carrinho antigo, intacto, e nenhuma faixa.
      await page.goto("/gestao/financeiro");
      await expect(linhaDoCarrinho(page, nomeDoItem)).toBeVisible();
      await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(3800));
      await expect(page.getByTestId("faixa-das-queimas")).toHaveCount(0);
    } finally {
      await trava?.soltar();
    }
  });

  test("(c) sem preço num tamanho que falta: “Lançar na Venda” é um botão desabilitado, e a Venda pela URL mostra a frase de preço e “abrir o Catálogo”", async ({
    page,
  }) => {
    let trava: TravaDosPrecosDasQueimas | null = null;
    try {
      await fazerLogin(page);
      trava = await travarPrecosDasQueimas({ P: 1100, M: 2300, G: null });
      const queimaId = await semearQueimaComExternas(`[e2e] venda sem preço ${sufixo()}`, { p: 1, g: 1 });

      // UI-D5: na linha “a cobrar”, um `<button disabled>` (não link) apontando para o aviso.
      await page.goto("/gestao/queimas");
      const linha = linhaACobrar(page, queimaId);
      const botao = linha.getByTestId("lancar-na-venda");
      await expect(botao).toBeDisabled();
      expect(await botao.evaluate((elemento) => elemento.tagName)).toBe("BUTTON");
      await expect(botao).not.toHaveAttribute("href", /.*/);
      const idDoAviso = await linha.getByTestId("a-cobrar-sem-preco").getAttribute("id");
      expect(idDoAviso).toBeTruthy();
      await expect(botao).toHaveAttribute("aria-describedby", idDoAviso ?? "");

      // A URL aberta à mão: nunca um carrinho com linha sem valor.
      await page.goto(hrefDaVendaComOrigem({ tipo: "queima", id: queimaId }));
      const indisponivel = page.getByTestId("origem-indisponivel");
      await expect(indisponivel).toContainText(fraseSemPrecoDaQueima(["G"], trava.nomes));
      await expect(indisponivel.getByTestId("origem-abrir-catalogo")).toHaveAttribute(
        "href",
        "/gestao/cadastros?sub=catalogo",
      );
      await expect(page.getByTestId("venda-linha")).toHaveCount(0);
    } finally {
      await trava?.soltar();
    }
  });

  test("(b) origem não achada (id desconhecido ou mal formado) → “Não achei esta queima.” e “Voltar às Queimas”; (h) a dica do fim de “a cobrar”", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(hrefDaVendaComOrigem({ tipo: "queima", id: "00000000-0000-4000-8000-000000000000" }));
    let indisponivel = page.getByTestId("origem-indisponivel");
    await expect(indisponivel).toContainText(FRASE_ORIGEM_QUEIMA_NAO_ACHADA);
    await expect(indisponivel.getByTestId("voltar-as-queimas")).toHaveAttribute("href", "/gestao/queimas");
    await expect(page.getByTestId("venda-linha")).toHaveCount(0);

    await page.goto("/gestao/financeiro?aba=venda&origem=queima%3Amal-formado");
    indisponivel = page.getByTestId("origem-indisponivel");
    await expect(indisponivel).toContainText(FRASE_ORIGEM_QUEIMA_NAO_ACHADA);
    await expect(indisponivel.getByTestId("voltar-as-queimas")).toBeVisible();

    // (h) A dica do fim da lista, letra por letra do protótipo (D-07). Uma queima com externa só deste
    // teste garante que a seção aparece — a dica não depende de preço.
    const queimaId = await semearQueimaComExternas(`[e2e] venda dica ${sufixo()}`, { p: 1 });
    await page.goto("/gestao/queimas");
    await expect(linhaACobrar(page, queimaId)).toBeVisible();
    await expect(page.getByTestId("a-cobrar-dica")).toHaveText(DICA_FIM_A_COBRAR);
    await expect(page.getByTestId("a-cobrar-dica")).toContainText(
      "Se as peças são de pessoas diferentes, você divide lá.",
    );
  });
});

import { test, expect, type Page } from "@playwright/test";

import { descricaoDaLinha } from "@/lib/agenda/receber";
import {
  DICA_PESSOA_TRAVADA,
  FRASE_ORIGEM_NAO_ACHADA,
  FRASE_VENDA_EM_MONTAGEM_GUARDADA,
  faixaDaAgenda,
  fraseOrigemJaLancada,
  toastLancadoNaVenda,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { hrefDaVendaComOrigem, hrefDoCaixa } from "@/lib/financeiro/navegacao";

import {
  itemDoSistemaNoBanco,
  ligarVendaAInscricao,
  semearCliente,
  semearInscricao,
  semearMaterialDoUso,
  semearMensalidade,
  semearOficina,
  semearTurmaComDatas,
  semearUsoLivreEncerrado,
  vendaDaCobranca,
  vendasDoCliente,
} from "./apoio/semear-agenda";
import { semearItem, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-12 (AGE-15, mecanismo B da pesquisa, UI-D26, Pitfall 10): “Lançar na Venda” abre a Venda do
// Financeiro JÁ PREENCHIDA pela cobrança — faixa “Da Agenda”, pessoa travada, a linha de origem sem o
// “tirar”, à vista EM ABERTO vencendo no dia da cobrança. O servidor decide pessoa, cliente e descrição;
// a venda que o gestor estava montando fica guardada. Cada caso semeia as PRÓPRIAS cobranças (nomes
// `[e2e]` com sufixo único) e só afirma o que é dele — nenhuma afirmação global do banco.

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

// Um mês longe dos que outras specs contam (1300+ dias à frente), um por caso e por projeto.
function mesDoCaso(caso: number): { mes: string; vencimento: string } {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  const dia = somarDiasAoHoje(1300 + caso * 62 + projeto * 31);
  const mes = `${dia.slice(0, 7)}-01`;
  return { mes, vencimento: `${dia.slice(0, 7)}-10` };
}

function linhaAReceber(page: Page, tipo: "mensalidade" | "inscricao" | "uso_livre", id: string) {
  return page.locator(`[data-testid="a-receber-linha"][data-tipo="${tipo}"][data-id="${id}"]`);
}

function linhaDoCarrinho(page: Page, texto: string) {
  return page.getByTestId("venda-linha").filter({ hasText: texto });
}

// Uma mensalidade a receber, de uma turma e de uma pessoa só deste caso.
async function semearMensalidadeAReceber(suf: string, caso: number, valorCentavos: number) {
  const nome = `[e2e] Aluna ${suf}`;
  const turma = `[e2e] Turma ${suf}`;
  const clienteId = await semearCliente({ nome });
  const { turmaId } = await semearTurmaComDatas({
    nome: turma,
    diaSemana: 2,
    inicio: "19:00",
    fim: "21:00",
    vagas: 8,
    mensalidadeCentavos: valorCentavos,
    diaVencimento: 10,
    datas: [],
  });
  const { mes, vencimento } = mesDoCaso(caso);
  const mensalidadeId = await semearMensalidade({ turmaId, clienteId, mes, valorCentavos, vencimento });
  const descricao = descricaoDaLinha({ tipo: "mensalidade", turma, mes });
  return { nome, turma, clienteId, mes, vencimento, mensalidadeId, descricao };
}

test.describe("agenda venda preenchida", () => {
  test("(a) “Lançar na Venda” abre a Venda preenchida; com desconto, lança e volta à Agenda com a venda ligada à mensalidade", async ({
    page,
  }) => {
    const { nome, clienteId, vencimento, mensalidadeId, descricao } = await semearMensalidadeAReceber(
      sufixoUnico(),
      1,
      25000,
    );
    const item = await itemDoSistemaNoBanco("mensalidade");

    await fazerLogin(page);
    await page.goto("/gestao/agenda?aba=receber");
    const linha = linhaAReceber(page, "mensalidade", mensalidadeId);
    await expect(linha.getByTestId("lancar-na-venda")).toHaveAttribute(
      "href",
      hrefDaVendaComOrigem({ tipo: "mensalidade", id: mensalidadeId }),
    );
    await linha.getByTestId("lancar-na-venda").click();
    await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=venda&origem=mensalidade%3A/);

    // A faixa, a pessoa travada, a linha de origem sem “tirar”, à vista EM ABERTO no vencimento da turma.
    await expect(page.getByTestId("faixa-da-agenda-texto")).toHaveText(faixaDaAgenda(descricao, nome));
    await expect(page.getByTestId("faixa-em-montagem")).toHaveCount(0);
    await expect(page.getByTestId("voltar-a-agenda")).toBeVisible();
    const pessoa = page.getByTestId("pessoa-travada");
    await expect(pessoa).toHaveValue(nome);
    await expect(pessoa).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("pessoa-travada-dica")).toHaveText(DICA_PESSOA_TRAVADA);
    const origem = linhaDoCarrinho(page, descricao);
    await expect(origem).toHaveCount(1);
    await expect(origem.getByRole("button", { name: "tirar" })).toHaveCount(0);
    await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(25000));
    await expect(page.getByTestId("pagamento-ja-pago").locator("input")).not.toBeChecked();
    await expect(page.getByTestId("pagamento-vence-em")).toHaveValue(vencimento);

    // Ajusta como qualquer venda: R$ 5,00 de desconto.
    await page.getByTestId("venda-desconto").fill("5");
    await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(24500));
    await page.getByRole("button", { name: "Lançar venda" }).click();

    // A volta: “A receber”, com o toast uma vez (a URL perde `aviso` e `documento`).
    await expect(page).toHaveURL(/\/gestao\/agenda\?aba=receber/);
    const venda = await vendaDaCobranca("mensalidade", mensalidadeId);
    expect(venda).not.toBeNull();
    await expect(page.getByText(toastLancadoNaVenda(venda!.numero))).toBeVisible();
    await expect(page).not.toHaveURL(/aviso=/);
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toHaveCount(0);

    expect(venda).toMatchObject({ clienteId, pessoaNome: nome, cancelado: false, movimentacoes: 0 });
    expect(venda!.linhas).toEqual([
      { itemId: item.id, descricao, categoriaId: item.categoriaVendaId, quantidade: 1, valorCentavos: 24500 },
    ]);
    expect(venda!.parcelas).toEqual([
      { vencimento, valorCentavos: 24500, forma: "pix", pagoEm: null, taxaPontosBase: null },
    ]);
    expect(await vendasDoCliente(clienteId)).toHaveLength(1);
  });

  test("(b) a venda que estava em montagem continua guardada: a faixa avisa e ela volta intacta depois", async ({
    page,
  }) => {
    const suf = sufixoUnico();
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
    const { mensalidadeId, descricao } = await semearMensalidadeAReceber(suf, 2, 18000);

    await fazerLogin(page);
    // Uma venda em montagem no Financeiro (o rascunho comum, no `sessionStorage` desta aba).
    await page.goto("/gestao/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await page.getByTestId("venda-atalho").filter({ hasText: nomeDoItem }).click();
    await expect(linhaDoCarrinho(page, nomeDoItem)).toBeVisible();

    await page.goto("/gestao/agenda?aba=receber");
    await linhaAReceber(page, "mensalidade", mensalidadeId).getByTestId("lancar-na-venda").click();
    await expect(page.getByTestId("faixa-em-montagem")).toHaveText(FRASE_VENDA_EM_MONTAGEM_GUARDADA);
    // O carrinho da origem, sem misturar o que estava em montagem.
    await expect(linhaDoCarrinho(page, descricao)).toHaveCount(1);
    await expect(linhaDoCarrinho(page, nomeDoItem)).toHaveCount(0);
    await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(18000));
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\/gestao\/agenda\?aba=receber/);
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toHaveCount(0);

    // A Venda sem origem: o carrinho antigo, intacto, e nenhuma faixa.
    await page.goto("/gestao/financeiro");
    await expect(linhaDoCarrinho(page, nomeDoItem)).toBeVisible();
    await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(3800));
    await expect(page.getByTestId("faixa-da-agenda")).toHaveCount(0);
    await expect(page.getByTestId("pessoa-travada")).toHaveCount(0);
  });

  test("(c) origem já lançada → o número e “ver no Caixa”; origem que não existe ou mal formada → “Não achei…”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = somarDiasAoHoje(1310);
    const clienteId = await semearCliente({ nome: `[e2e] Pessoa ${suf}` });
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina ${suf}`,
      data,
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 9000,
    });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 9000 });
    const { numero } = await ligarVendaAInscricao({ inscricaoId, valorCentavos: 9000, descricao: "[e2e] já lançada", data });

    await fazerLogin(page);
    await page.goto(hrefDaVendaComOrigem({ tipo: "inscricao", id: inscricaoId }));
    const indisponivel = page.getByTestId("origem-indisponivel");
    await expect(indisponivel).toContainText(fraseOrigemJaLancada(numero));
    await expect(indisponivel.getByTestId("origem-ver-no-caixa")).toHaveAttribute("href", hrefDoCaixa());
    // Nunca um carrinho preenchido com dado velho.
    await expect(page.getByTestId("venda-linha")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lançar venda" })).toHaveCount(0);

    await page.goto(hrefDaVendaComOrigem({ tipo: "mensalidade", id: "00000000-0000-4000-8000-000000000000" }));
    await expect(page.getByTestId("origem-indisponivel")).toContainText(FRASE_ORIGEM_NAO_ACHADA);
    await expect(page.getByTestId("origem-indisponivel").getByTestId("voltar-a-agenda")).toBeVisible();

    await page.goto("/gestao/financeiro?aba=venda&origem=encomenda%3Aqualquer");
    await expect(page.getByTestId("origem-indisponivel")).toContainText(FRASE_ORIGEM_NAO_ACHADA);
  });

  test("(d) pessoa forjada no pedido: o banco grava o nome do cliente da cobrança", async ({ page }) => {
    const { nome, clienteId, mensalidadeId, descricao } = await semearMensalidadeAReceber(sufixoUnico(), 3, 21000);

    await fazerLogin(page);
    await page.goto(hrefDaVendaComOrigem({ tipo: "mensalidade", id: mensalidadeId }));
    const pessoa = page.getByTestId("pessoa-travada");
    await expect(pessoa).toHaveValue(nome);
    // Destrava o campo pelo DOM e escreve outro nome — o pedido sai com ele.
    await pessoa.evaluate((campo) => campo.removeAttribute("readonly"));
    await pessoa.fill("[e2e] Nome forjado");
    await expect(pessoa).toHaveValue("[e2e] Nome forjado");
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\/gestao\/agenda\?aba=receber/);

    const venda = await vendaDaCobranca("mensalidade", mensalidadeId);
    expect(venda).toMatchObject({ pessoaNome: nome, clienteId });
    expect(venda!.linhas[0]?.descricao).toBe(descricao);
  });

  test("(e) uso livre encerrado: a folha leva à Venda com a hora e o material cobrado, e a venda fecha com o valor congelado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Usuária ${suf}`;
    const clienteId = await semearCliente({ nome });
    const data = somarDiasAoHoje(1320 + (test.info().project.name === "celular" ? 1 : 0));
    const argila = `[e2e] Argila ${suf}`;
    const argilaId = await semearMaterialDoUso({ nome: argila, unidade: "kg", precoVendaCentavos: 1800 });
    const { usoLivreId, valorCentavos } = await semearUsoLivreEncerrado({
      clienteId,
      data,
      horas: 2,
      pessoas: 1,
      precoHoraCentavos: 3000,
      materiais: [{ itemId: argilaId, quantidadeMilesimos: 1000, cobrar: true, precoUnitarioCentavos: 1800 }],
    });
    const descricao = descricaoDaLinha({ tipo: "uso_livre", horas: 2, pessoas: 1, data });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${data}&uso=${usoLivreId}`);
    const lancar = page.getByTestId("lancar-na-venda");
    await expect(lancar).toHaveAttribute("href", hrefDaVendaComOrigem({ tipo: "uso_livre", id: usoLivreId }));
    await lancar.click();
    await expect(page.getByTestId("faixa-da-agenda-texto")).toHaveText(faixaDaAgenda(descricao, nome));
    await expect(linhaDoCarrinho(page, descricao)).toHaveCount(1);
    await expect(linhaDoCarrinho(page, argila)).toHaveCount(1);
    await expect(page.getByTestId("venda-total")).toHaveText(formatarReais(valorCentavos));
    await expect(page.getByTestId("pagamento-vence-em")).toHaveValue(data);
    await page.getByRole("button", { name: "Lançar venda" }).click();
    await expect(page).toHaveURL(/\/gestao\/agenda\?aba=receber/);

    const venda = await vendaDaCobranca("uso_livre", usoLivreId);
    expect(venda).toMatchObject({ pessoaNome: nome, clienteId, movimentacoes: 0 });
    expect(venda!.linhas.map((linha) => [linha.descricao, linha.valorCentavos])).toEqual([
      [descricao, 6000],
      [`${argila} · 1 kg`, 1800],
    ]);
    expect(venda!.parcelas).toEqual([
      { vencimento: data, valorCentavos, forma: "pix", pagoEm: null, taxaPontosBase: null },
    ]);
  });
});

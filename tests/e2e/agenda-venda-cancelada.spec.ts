import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  fraseInscricaoJaVirouVenda,
  fraseJaVirouVenda,
  tagVendaCancelada,
  TOAST_CANCELADA_OFICINA,
  TOAST_DATA_VOLTOU,
  TOAST_DISPENSA_DESFEITA,
  TOAST_DISPENSADA,
} from "@/lib/agenda/textos";

import {
  dispensarMensalidadeNoBanco,
  eventoNoBanco,
  idsDoDinheiro,
  idsQueSumiram,
  inscricoesDoEvento,
  ligarVendaACobranca,
  ligarVendaCanceladaAMensalidade,
  retratoDoDinheiro,
  semearCliente,
  semearInscricao,
  semearMensalidade,
  semearOficina,
  semearTurmaComDatas,
  turmasComNome,
  vendaDaCobranca,
  vendasDoCliente,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-13, Tarefa 3 (D-08, AGE-20): a venda cancelada NO CAIXA DE VERDADE (“Cancelar esta venda”,
// `cancelarDocumento`, que não muda nesta fase) devolve a cobrança a “A receber” sozinha, com a tag “venda
// nº {N} cancelada”, e ela se lança de novo; enquanto a venda está ativa, a Agenda recusa tirar da lista.
// E nenhum gesto da Agenda — cancelar a data, desfazer, cancelar de novo, tirar da lista, desativar a
// turma, dispensar e desfazer — apaga ou muda venda, parcela ou movimentação de estoque. Cada caso acha as
// PRÓPRIAS linhas pelo id; nomes `[e2e]` com sufixo único; dias 1500+ (longe das outras specs).

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

function diaDoCaso(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(1500 + caso * 2 + projeto);
}

// 0 = domingo … 6 = sábado, de uma data civil.
function diaDaSemanaDe(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function linhaAReceber(page: Page, tipo: "mensalidade" | "inscricao", id: string) {
  return page.locator(`[data-testid="a-receber-linha"][data-tipo="${tipo}"][data-id="${id}"]`);
}

function inscrito(folha: Locator, inscricaoId: string) {
  return folha.locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
}

async function abrirAReceber(page: Page) {
  await page.goto("/gestao/agenda?aba=receber");
  await expect(page.getByTestId("a-receber")).toBeVisible();
}

async function abrirFolha(page: Page, data: string, eventoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
  const folha = page.getByTestId("folha-evento");
  await expect(folha).toBeVisible();
  await expect(folha.getByTestId("quem-vem")).toBeVisible();
  return folha;
}

// “Recebi agora” → a forma, na linha de “A receber”; devolve o número da venda do toast.
async function receberAgora(page: Page, inscricaoId: string, forma: "dinheiro" | "pix"): Promise<number> {
  await abrirAReceber(page);
  await linhaAReceber(page, "inscricao", inscricaoId).getByTestId("recebi-agora").click();
  await page.getByTestId("folha-recebi-agora").getByTestId(`forma-${forma}`).click();
  const aviso = page.getByText(/Venda nº \d+ lançada e paga em/);
  await expect(aviso).toBeVisible();
  return Number(/nº (\d+)/.exec(await aviso.innerText())?.[1]);
}

test.describe("agenda venda cancelada", () => {
  test("(a)(b) venda ativa: sem “tirar da lista” e a recusa da D-08 na tela velha; cancelada no Caixa, a inscrição volta a “A receber” com a tag e se recebe de novo numa venda nova", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(1);
    const titulo = `[e2e] Oficina do Caixa ${suf}`;
    const nome = `[e2e] Inscrita ${suf}`;
    const clienteId = await semearCliente({ nome });
    const eventoId = await semearOficina({ titulo, data, inicio: "14:00", fim: "17:00", vagas: 8, precoCentavos: 13000 });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 13000 });

    await fazerLogin(page);
    // A “tela velha”: outra aba com a folha aberta ANTES da venda — ainda com “tirar da lista”.
    const velha = await page.context().newPage();
    const folhaVelha = await abrirFolha(velha, data, eventoId);
    await expect(inscrito(folhaVelha, inscricaoId).getByTestId("tirar-da-lista")).toBeVisible();

    const numero = await receberAgora(page, inscricaoId, "dinheiro");

    // Venda ativa: a folha troca “tirar da lista” pela frase da D-08 + “ver no Caixa”.
    let folha = await abrirFolha(page, data, eventoId);
    const linha = inscrito(folha, inscricaoId);
    await expect(linha.getByTestId("tirar-da-lista")).toHaveCount(0);
    await expect(linha.getByTestId("venda-ativa")).toContainText(fraseJaVirouVenda(numero));
    await expect(linha.getByRole("link", { name: "ver no Caixa" })).toBeVisible();

    // Pela tela velha, a ação recusa com a frase verbatim da D-08 — e nada muda.
    await inscrito(folhaVelha, inscricaoId).getByTestId("tirar-da-lista").click();
    await velha.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect(velha.getByTestId("confirmar-tirar-da-lista-erro")).toHaveText(fraseInscricaoJaVirouVenda(numero));
    await velha.close();
    expect((await inscricoesDoEvento(eventoId)).map((linhaDoBanco) => linhaDoBanco.id)).toContain(inscricaoId);

    // No Caixa, o fluxo que já existe: “Cancelar esta venda” → “Cancelar venda”.
    await page.goto("/gestao/financeiro?aba=caixa");
    await page.getByTestId("extrato-linha").filter({ hasText: titulo }).first().getByTestId("extrato-ver").click();
    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toContainText(`nº ${numero}`);
    await detalhe.getByRole("button", { name: "Cancelar esta venda" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar venda", exact: true }).click();
    await expect(page.getByText(`Lançamento nº ${numero} cancelado. Continua visível, riscado.`)).toBeVisible({
      timeout: 10000,
    });

    // De volta à Agenda: a inscrição está em “A receber” com a tag, e pode ser dispensada ou recebida.
    await abrirAReceber(page);
    const devolvida = linhaAReceber(page, "inscricao", inscricaoId);
    await expect(devolvida).toHaveAttribute("data-situacao", "venda_cancelada");
    await expect(devolvida.getByTestId("tag-venda-cancelada")).toHaveText(tagVendaCancelada(numero));
    await expect(devolvida.getByTestId("dispensar")).toBeVisible();
    folha = await abrirFolha(page, data, eventoId);
    await expect(inscrito(folha, inscricaoId).getByTestId("tag-venda-cancelada")).toHaveText(tagVendaCancelada(numero));
    await expect(inscrito(folha, inscricaoId).getByTestId("tirar-da-lista")).toBeVisible();

    // “Recebi agora” de novo: venda nova, e a inscrição aponta para ela; a cancelada continua no Caixa.
    const novo = await receberAgora(page, inscricaoId, "pix");
    expect(novo).not.toBe(numero);
    expect(await vendaDaCobranca("inscricao", inscricaoId)).toMatchObject({ numero: novo, cancelado: false });
    expect(await vendasDoCliente(clienteId)).toEqual([
      { numero, cancelado: true },
      { numero: novo, cancelado: false },
    ]);
    await expect(linhaAReceber(page, "inscricao", inscricaoId)).toHaveCount(0);
  });

  test("(c) a mensalidade de venda cancelada entra no lote; a dispensada não (backstop E16 partial)", async ({ page }) => {
    const suf = sufixoUnico();
    const { turmaId } = await semearTurmaComDatas({
      nome: `[e2e] Turma do lote ${suf}`,
      diaSemana: 2,
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 25000,
      diaVencimento: 10,
      datas: [],
    });
    const mes = `${diaDoCaso(2).slice(0, 7)}-01`;
    const mensalidade = async (nome: string) =>
      semearMensalidade({
        turmaId,
        clienteId: await semearCliente({ nome: `[e2e] ${nome} ${suf}` }),
        mes,
        valorCentavos: 25000,
        vencimento: `${mes.slice(0, 7)}-10`,
      });
    const daVendaCancelada = await mensalidade("Venda cancelada");
    const dispensada = await mensalidade("Dispensada");
    const numero = await ligarVendaCanceladaAMensalidade({
      mensalidadeId: daVendaCancelada,
      valorCentavos: 25000,
      data: hojeNoAtelie(),
    });
    await dispensarMensalidadeNoBanco(dispensada);

    await fazerLogin(page);
    await abrirAReceber(page);
    await expect(page.locator(`[data-testid="lote-linha"][data-id="${daVendaCancelada}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-testid="lote-linha"][data-id="${dispensada}"]`)).toHaveCount(0);
    await expect(linhaAReceber(page, "mensalidade", daVendaCancelada).getByTestId("tag-venda-cancelada")).toHaveText(
      tagVendaCancelada(numero),
    );
    await expect(linhaAReceber(page, "mensalidade", dispensada)).toHaveCount(0);
  });

  test("(d) AGE-20: cancelar a data com inscrição vendida, desfazer, cancelar de novo (duas vezes), tirar da lista, desativar a turma, dispensar e desfazer — nenhuma venda, parcela ou movimentação some ou muda", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(3);
    const clienteVendida = await semearCliente({ nome: `[e2e] Vendida ${suf}` });
    const clienteCancelada = await semearCliente({ nome: `[e2e] De venda cancelada ${suf}` });
    const oficina = await semearOficina({
      titulo: `[e2e] Oficina AGE-20 ${suf}`,
      data,
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 11000,
    });
    const vendida = await semearInscricao({ eventoId: oficina, clienteId: clienteVendida, tipo: "oficina", valorCentavos: 11000 });
    const deVendaCancelada = await semearInscricao({
      eventoId: oficina,
      clienteId: clienteCancelada,
      tipo: "oficina",
      valorCentavos: 11000,
    });
    const vendaAtiva = await ligarVendaACobranca({ tipo: "inscricao", id: vendida, valorCentavos: 11000, data, paga: true });
    const vendaCancelada = await ligarVendaACobranca({
      tipo: "inscricao",
      id: deVendaCancelada,
      valorCentavos: 11000,
      data: hojeNoAtelie(),
      paga: true,
      cancelada: true,
    });

    // Uma turma com uma data futura onde uma experimental cobrada tem a venda cancelada — desativar a turma
    // apaga a data e a inscrição, nunca a venda.
    const dataDaTurma = diaDoCaso(4);
    const nomeDaTurma = `[e2e] Turma AGE-20 ${suf}`;
    const { turmaId, eventoIds } = await semearTurmaComDatas({
      nome: nomeDaTurma,
      diaSemana: diaDaSemanaDe(dataDaTurma),
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 24000,
      diaVencimento: 10,
      datas: [dataDaTurma],
    });
    const experimental = await semearInscricao({
      eventoId: eventoIds[0],
      clienteId: await semearCliente({ nome: `[e2e] Experimental ${suf}` }),
      tipo: "experimental",
      cobrar: true,
      valorCentavos: 4000,
    });
    const vendaDaExperimental = await ligarVendaACobranca({
      tipo: "inscricao",
      id: experimental,
      valorCentavos: 4000,
      data: hojeNoAtelie(),
      paga: true,
      cancelada: true,
    });
    const mes = `${diaDoCaso(5).slice(0, 7)}-01`;
    const mensalidade = await semearMensalidade({
      turmaId,
      clienteId: clienteVendida,
      mes,
      valorCentavos: 24000,
      vencimento: `${mes.slice(0, 7)}-10`,
    });

    const documentoIds = [vendaAtiva.documentoId, vendaCancelada.documentoId, vendaDaExperimental.documentoId];
    const retratoAntes = await retratoDoDinheiro(documentoIds);
    expect(retratoAntes.documentos).toHaveLength(3);
    expect(retratoAntes.parcelas).toHaveLength(3);
    const idsAntes = await idsDoDinheiro();

    await fazerLogin(page);
    // Uma tela velha da oficina, para cancelar “de novo” depois que a data já está cancelada.
    const velha = await page.context().newPage();
    await abrirFolha(velha, data, oficina);

    // 1. Cancelar a data (a de venda cancelada sai de “A receber” — pede confirmação); o toast diz onde a
    //    devolução se resolve. Desfazer pelo toast.
    let folha = await abrirFolha(page, data, oficina);
    await folha.getByTestId("cancelar-data").click();
    await page.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(page.getByText(TOAST_CANCELADA_OFICINA)).toBeVisible();
    expect(TOAST_CANCELADA_OFICINA).toContain("Quem já pagou continua no Financeiro — devolução se resolve lá.");
    // A folha é modal (o véu cobre o toast): “Pronto” fecha, e o “Desfazer” do toast fica ao alcance.
    await expect(folha.getByTestId("desfazer-cancelamento")).toBeVisible();
    await page.getByTestId("folha-evento-pronto").click();
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    await expect(page.getByText(TOAST_DATA_VOLTOU)).toBeVisible();
    await expect.poll(async () => ((await eventoNoBanco(oficina))?.canceladoEm ?? null) !== null).toBe(false);

    // 2. Cancelar de novo; e mais uma vez pela tela velha — já cancelada, não faz nada.
    folha = await abrirFolha(page, data, oficina);
    await folha.getByTestId("cancelar-data").click();
    await page.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(page.getByText(TOAST_CANCELADA_OFICINA).first()).toBeVisible();
    await expect.poll(async () => ((await eventoNoBanco(oficina))?.canceladoEm ?? null) !== null).toBe(true);
    const folhaVelha = velha.getByTestId("folha-evento");
    await folhaVelha.getByTestId("cancelar-data").click();
    await velha.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(velha.getByText(TOAST_CANCELADA_OFICINA)).toBeVisible();
    await velha.close();
    expect(((await eventoNoBanco(oficina))?.canceladoEm ?? null) !== null).toBe(true);

    // 3. Desfazer o cancelamento e tirar da lista a inscrição de venda cancelada.
    folha = await abrirFolha(page, data, oficina);
    await folha.getByTestId("desfazer-cancelamento").click();
    await expect.poll(async () => ((await eventoNoBanco(oficina))?.canceladoEm ?? null) !== null).toBe(false);
    folha = await abrirFolha(page, data, oficina);
    await inscrito(folha, deVendaCancelada).getByTestId("tirar-da-lista").click();
    await page.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect(inscrito(folha, deVendaCancelada)).toHaveCount(0);
    expect((await inscricoesDoEvento(oficina)).map((linha) => linha.id)).toEqual([vendida]);

    // 4. Desativar a turma: a data futura e a inscrição dela saem; a venda (cancelada) fica.
    await page.goto(`/gestao/agenda?semana=${dataDaTurma}&turma=${turmaId}`);
    const folhaDaTurma = page.getByTestId("folha-turma");
    await folhaDaTurma.getByTestId("desativar-turma").click();
    await page.getByTestId("confirmar-desativar-turma-sim").click();
    await expect.poll(async () => (await turmasComNome(nomeDaTurma))[0]?.ativa).toBe(false);
    expect(await eventoNoBanco(eventoIds[0])).toBeNull();

    // 5. Dispensar a mensalidade e desfazer pela sanfona.
    await abrirAReceber(page);
    await linhaAReceber(page, "mensalidade", mensalidade).getByTestId("dispensar").click();
    await page.getByTestId("confirmar-dispensar-sim").click();
    await expect(page.getByText(TOAST_DISPENSADA)).toBeVisible();
    await page.getByTestId("dispensadas-resumo").click();
    await page.locator(`[data-testid="dispensada-linha"][data-id="${mensalidade}"]`).getByTestId("desfazer-dispensa").click();
    await expect(page.getByText(TOAST_DISPENSA_DESFEITA)).toBeVisible();
    await expect(linhaAReceber(page, "mensalidade", mensalidade)).toBeVisible();

    // As vendas, as parcelas e as movimentações delas: as mesmas linhas, com os mesmos valores — e nenhuma
    // linha que existia antes em `documentos`, `parcelas` ou `movimentacoes_estoque` sumiu.
    expect(await retratoDoDinheiro(documentoIds)).toEqual(retratoAntes);
    expect(await idsQueSumiram(idsAntes)).toEqual({ documentos: 0, parcelas: 0, movimentacoes: 0 });
  });
});

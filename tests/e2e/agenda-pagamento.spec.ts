import { test, expect, type Locator, type Page } from "@playwright/test";

import { mesDaData } from "@/lib/agenda/mensalidade";
import {
  linhaDeVinda,
  TAG_A_RECEBER,
  TAG_DISPENSADA,
  TAG_LANCADO_NA_VENDA,
  TAG_PAGO,
  tagQuantosAReceber,
  tagVendaCancelada,
  tituloDaVindaDeUsoLivre,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  dispensarMensalidadeNoBanco,
  ligarVendaACobranca,
  mensalidadesNoBanco,
  semearAluno,
  semearCliente,
  semearInscricao,
  semearMensalidade,
  semearOficina,
  semearTurmaComDatas,
  semearUsoLivreEncerrado,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-13, Tarefa 2 (D-02, D-08, D-09): o estado do pagamento aparece onde o gestor olha — na lista da
// data, no cartão da semana, na folha do uso livre encerrado, na ficha (o quadro “A RECEBER”) e em Pessoas
// (“{n} a receber”) —, sempre DERIVADO do Financeiro pela mesma regra de “A receber”, nunca gravado na
// Agenda. E a D-02 também em Pessoas: abrir só `?aba=pessoas` faz nascer a mensalidade do mês. Cada caso
// acha as PRÓPRIAS linhas pelo id; nomes `[e2e]` com sufixo único; dias 1400+ (longe das outras specs).

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
  return somarDiasAoHoje(1400 + caso * 2 + projeto);
}

// 0 = domingo … 6 = sábado, de uma data civil.
function diaDaSemanaDe(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function cartao(page: Page, eventoId: string) {
  return page.locator(`[data-testid="agenda-cartao"][data-evento-id="${eventoId}"]`);
}

function cartaoDoUso(page: Page, usoId: string) {
  return page.locator(`[data-testid="agenda-cartao"][data-uso-id="${usoId}"]`);
}

function inscrito(folha: Locator, inscricaoId: string) {
  return folha.locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
}

async function abrirFolha(page: Page, data: string, eventoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
  const folha = page.getByTestId("folha-evento");
  await expect(folha).toBeVisible();
  await expect(folha.getByTestId("quem-vem")).toBeVisible();
  return folha;
}

async function abrirUso(page: Page, data: string, usoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&uso=${usoId}`);
  const folha = page.getByTestId("folha-uso-livre");
  await expect(folha).toBeVisible();
  return folha;
}

// A tag de pagamento de um pedaço da tela: o texto e a situação (`data-situacao`).
async function conferirTag(lugar: Locator, testId: string, situacao: string, texto: string) {
  const tag = lugar.getByTestId(testId);
  await expect(tag).toHaveText(texto);
  await expect(tag).toHaveAttribute("data-situacao", situacao);
}

test.describe("agenda pagamento", () => {
  test("(a) oficina: “pago” (Recebi agora), “lançado na Venda”, “venda nº N cancelada”, “a receber”; o cartão da semana conta as que estão em “A receber”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(1);
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina pagamento ${suf}`,
      data,
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 12000,
    });
    const inscrever = async (nome: string) =>
      semearInscricao({
        eventoId,
        clienteId: await semearCliente({ nome: `[e2e] ${nome} ${suf}` }),
        tipo: "oficina",
        valorCentavos: 12000,
      });
    const paga = await inscrever("Paga");
    const lancada = await inscrever("Lançada");
    const cancelada = await inscrever("Cancelada");
    const devendo = await inscrever("Devendo");
    await ligarVendaACobranca({ tipo: "inscricao", id: lancada, valorCentavos: 12000, data, paga: false });
    const { numero } = await ligarVendaACobranca({
      tipo: "inscricao",
      id: cancelada,
      valorCentavos: 12000,
      data: hojeNoAtelie(),
      paga: true,
      cancelada: true,
    });

    await fazerLogin(page);
    // “Recebi agora” → Dinheiro na linha de “A receber”: a venda já paga.
    await page.goto("/gestao/agenda?aba=receber");
    await page
      .locator(`[data-testid="a-receber-linha"][data-tipo="inscricao"][data-id="${paga}"]`)
      .getByTestId("recebi-agora")
      .click();
    await page.getByTestId("folha-recebi-agora").getByTestId("forma-dinheiro").click();
    await expect(page.getByText(/Venda nº \d+ lançada e paga em dinheiro\./)).toBeVisible();

    const folha = await abrirFolha(page, data, eventoId);
    await conferirTag(inscrito(folha, paga), "tag-pagamento", "pago", TAG_PAGO);
    await conferirTag(inscrito(folha, lancada), "tag-pagamento", "lancado", TAG_LANCADO_NA_VENDA);
    await conferirTag(inscrito(folha, cancelada), "tag-venda-cancelada", "venda_cancelada", tagVendaCancelada(numero));
    await conferirTag(inscrito(folha, devendo), "tag-pagamento", "a_receber", TAG_A_RECEBER);

    // O cartão: a que deve e a de venda cancelada (D-08 — voltou para “A receber”).
    await page.goto(`/gestao/agenda?semana=${data}`);
    await expect(cartao(page, eventoId).getByTestId("tag-a-receber")).toHaveText(tagQuantosAReceber(2));
  });

  test("(b) data de turma: o aluno mostra a mensalidade do mês (a receber, lançado na Venda, dispensada); experimental gratuita só “gratuita”; reposição nenhuma; a experimental cobrada conta no cartão", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(2);
    const { turmaId, eventoIds } = await semearTurmaComDatas({
      nome: `[e2e] Turma pagamento ${suf}`,
      diaSemana: diaDaSemanaDe(data),
      inicio: "19:00",
      fim: "21:00",
      vagas: 10,
      mensalidadeCentavos: 30000,
      diaVencimento: 10,
      datas: [data],
    });
    const eventoId = eventoIds[0];
    const mes = `${mesDaData(data)}-01`;
    const vencimento = `${mesDaData(data)}-10`;

    const aluno = async (nome: string) => {
      const clienteId = await semearCliente({ nome: `[e2e] ${nome} ${suf}` });
      const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "aluno" });
      const mensalidadeId = await semearMensalidade({ turmaId, clienteId, mes, valorCentavos: 30000, vencimento });
      return { inscricaoId, mensalidadeId };
    };
    const devendo = await aluno("Aluna devendo");
    const lancada = await aluno("Aluna lançada");
    const dispensada = await aluno("Aluna dispensada");
    await ligarVendaACobranca({
      tipo: "mensalidade",
      id: lancada.mensalidadeId,
      valorCentavos: 30000,
      data: vencimento,
      paga: false,
    });
    await dispensarMensalidadeNoBanco(dispensada.mensalidadeId);
    const gratuita = await semearInscricao({
      eventoId,
      clienteId: await semearCliente({ nome: `[e2e] Gratuita ${suf}` }),
      tipo: "experimental",
      cobrar: false,
    });
    const cobrada = await semearInscricao({
      eventoId,
      clienteId: await semearCliente({ nome: `[e2e] Cobrada ${suf}` }),
      tipo: "experimental",
      cobrar: true,
      valorCentavos: 4000,
    });
    const reposicao = await semearInscricao({
      eventoId,
      clienteId: await semearCliente({ nome: `[e2e] Reposição ${suf}` }),
      tipo: "reposicao",
    });

    await fazerLogin(page);
    const folha = await abrirFolha(page, data, eventoId);
    await conferirTag(inscrito(folha, devendo.inscricaoId), "tag-pagamento", "a_receber", TAG_A_RECEBER);
    await conferirTag(inscrito(folha, lancada.inscricaoId), "tag-pagamento", "lancado", TAG_LANCADO_NA_VENDA);
    await conferirTag(inscrito(folha, dispensada.inscricaoId), "tag-dispensada", "dispensada", TAG_DISPENSADA);
    await conferirTag(inscrito(folha, cobrada), "tag-pagamento", "a_receber", TAG_A_RECEBER);

    const daGratuita = inscrito(folha, gratuita);
    await expect(daGratuita.getByTestId("tag-gratuita")).toBeVisible();
    await expect(daGratuita.locator("[data-situacao]")).toHaveCount(0);
    const daReposicao = inscrito(folha, reposicao);
    await expect(daReposicao.getByTestId("tag-reposicao")).toBeVisible();
    await expect(daReposicao.locator("[data-situacao]")).toHaveCount(0);

    // O cartão da data de turma conta a inscrição cobrada (a experimental); a mensalidade é do aluno, não
    // da data.
    await page.goto(`/gestao/agenda?semana=${data}`);
    await expect(cartao(page, eventoId).getByTestId("tag-a-receber")).toHaveText(tagQuantosAReceber(1));
  });

  test("(c) uso livre encerrado: “a receber” na folha e no cartão; depois de “Recebi agora”, “pago”", async ({ page }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(3);
    const clienteId = await semearCliente({ nome: `[e2e] Uso pagamento ${suf}` });
    const { usoLivreId } = await semearUsoLivreEncerrado({ clienteId, data, horas: 3, pessoas: 1, precoHoraCentavos: 2500 });

    await fazerLogin(page);
    let folha = await abrirUso(page, data, usoLivreId);
    await conferirTag(folha, "tag-pagamento", "a_receber", TAG_A_RECEBER);
    await conferirTag(cartaoDoUso(page, usoLivreId), "tag-pagamento", "a_receber", TAG_A_RECEBER);

    await folha.getByTestId("recebi-agora").click();
    await page.getByTestId("folha-recebi-agora").getByTestId("forma-pix").click();
    await expect(page.getByText(/Venda nº \d+ lançada e paga em pix\./)).toBeVisible();

    folha = await abrirUso(page, data, usoLivreId);
    await conferirTag(folha, "tag-pagamento", "pago", TAG_PAGO);
    await conferirTag(cartaoDoUso(page, usoLivreId), "tag-pagamento", "pago", TAG_PAGO);
  });

  test("(d) a ficha soma o que a pessoa deve no quadro “A RECEBER”, as últimas vindas trazem o uso livre com a tag, e Pessoas mostra “2 a receber”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Devedora ${suf}`;
    const clienteId = await semearCliente({ nome });
    const anteontem = somarDiasAoHoje(-2);
    const semanaPassada = somarDiasAoHoje(-5);
    const dezDiasAtras = somarDiasAoHoje(-10);

    // Deve: uma inscrição de R$ 150 e um uso livre de 2 h × R$ 30 = R$ 60. Não deve: uma inscrição paga e
    // uma mensalidade dispensada (D-09).
    const oficina = await semearOficina({
      titulo: `[e2e] Oficina devida ${suf}`,
      data: semanaPassada,
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 15000,
    });
    await semearInscricao({ eventoId: oficina, clienteId, tipo: "oficina", valorCentavos: 15000 });
    const oficinaPaga = await semearOficina({
      titulo: `[e2e] Oficina paga ${suf}`,
      data: dezDiasAtras,
      inicio: "09:00",
      fim: "12:00",
      vagas: 8,
      precoCentavos: 9000,
    });
    const inscricaoPaga = await semearInscricao({ eventoId: oficinaPaga, clienteId, tipo: "oficina", valorCentavos: 9000 });
    await ligarVendaACobranca({ tipo: "inscricao", id: inscricaoPaga, valorCentavos: 9000, data: dezDiasAtras, paga: true });
    await semearUsoLivreEncerrado({ clienteId, data: anteontem, horas: 2, pessoas: 1, precoHoraCentavos: 3000 });
    const { turmaId } = await semearTurmaComDatas({
      nome: `[e2e] Turma da devedora ${suf}`,
      diaSemana: 1,
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 20000,
      diaVencimento: 10,
      datas: [],
    });
    const mesLonge = `${diaDoCaso(4).slice(0, 7)}-01`;
    const mensalidade = await semearMensalidade({
      turmaId,
      clienteId,
      mes: mesLonge,
      valorCentavos: 20000,
      vencimento: `${mesLonge.slice(0, 7)}-10`,
    });
    await dispensarMensalidadeNoBanco(mensalidade);

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?aba=pessoas&pessoa=${clienteId}`);
    const ficha = page.getByTestId("ficha-pessoa");
    await expect(ficha.getByTestId("quadro-a-receber")).toContainText("A RECEBER");
    await expect(ficha.getByTestId("quadro-a-receber-valor")).toHaveText(formatarReais(21000));

    // Últimas vindas: o uso livre (o mais recente) com a tag de pagamento, e as duas oficinas.
    const vindas = ficha.getByTestId("ficha-vinda");
    await expect(vindas).toHaveCount(3);
    await expect(vindas.nth(0)).toHaveAttribute("data-tipo", "uso_livre");
    await expect(vindas.nth(0)).toContainText(linhaDeVinda(formatarDiaMes(anteontem), tituloDaVindaDeUsoLivre(2)));
    await conferirTag(vindas.nth(0), "tag-pagamento", "a_receber", TAG_A_RECEBER);
    await expect(vindas.nth(1)).toContainText(linhaDeVinda(formatarDiaMes(semanaPassada), `[e2e] Oficina devida ${suf}`));
    await expect(vindas.nth(2)).toContainText(linhaDeVinda(formatarDiaMes(dezDiasAtras), `[e2e] Oficina paga ${suf}`));

    await page.goto(`/gestao/agenda?aba=pessoas&busca=${encodeURIComponent(nome)}`);
    const linha = page.locator(`[data-testid="pessoa-linha"][data-cliente-id="${clienteId}"]`);
    await expect(linha.getByTestId("tag-a-receber")).toHaveText(tagQuantosAReceber(2));
  });

  test("(e) D-02 em Pessoas: abrir só a lista faz nascer a mensalidade do mês de quem já era aluno, e a tag “1 a receber” aparece", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Aluna antiga ${suf}`;
    const clienteId = await semearCliente({ nome });
    const { turmaId } = await semearTurmaComDatas({
      nome: `[e2e] Turma antiga ${suf}`,
      diaSemana: 4,
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 28000,
      diaVencimento: 15,
      // Uma aula no mês corrente: sem aula no mês, a D-02 não cobra (WR-03 da revisão, decisão do dono de
      // 02/10/2026).
      datas: [hojeNoAtelie()],
    });
    // Entrou no mês passado: a mensalidade deste mês nasce ao abrir a Agenda (D-02), e ainda não nasceu.
    await semearAluno({ turmaId, clienteId, entrouEm: somarDiasAoHoje(-40) });
    expect(await mensalidadesNoBanco(clienteId)).toHaveLength(0);

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?aba=pessoas&busca=${encodeURIComponent(nome)}`);
    const linha = page.locator(`[data-testid="pessoa-linha"][data-cliente-id="${clienteId}"]`);
    await expect(linha.getByTestId("tag-a-receber")).toHaveText(tagQuantosAReceber(1));

    const mesDeHoje = `${hojeNoAtelie().slice(0, 7)}-01`;
    expect(await mensalidadesNoBanco(clienteId)).toEqual([
      expect.objectContaining({ turmaId, mes: mesDeHoje, valorCentavos: 28000 }),
    ]);
  });
});

import { test, expect, type Page } from "@playwright/test";

import { valorProporcional } from "@/lib/agenda/mensalidade";
import { mesVizinho, nomeDoMes } from "@/lib/agenda/semana";
import {
  corpoConfirmarSairDaTurma,
  fraseJaEstaNaTurma,
  TOAST_ENTROU_MENSALIDADE_CHEIA,
  TOAST_SAIU_DA_TURMA,
  TOAST_TURMA_SALVA,
  toastEntrouProporcional,
  toastEntrouSemAulaNoMes,
} from "@/lib/agenda/textos";
import { diaDaSemanaDe, NOMES_CURTOS_DOS_DIAS } from "@/lib/agenda/turma";
import { ultimoDiaDoMes } from "@/lib/financeiro/calendario";
import { formatarReais } from "@/lib/financeiro/formato";

import {
  inscricoesDaPessoaNaTurma,
  marcarPresencaNoBanco,
  mensalidadesNoBanco,
  semearAluno,
  semearCliente,
  semearInscricao,
  semearMensalidade,
  semearTurmaComDatas,
  turmasComNome,
  vinculosNoBanco,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-07 (AGE-07, AGE-16, D-02): a pessoa entra na turma pela ficha — já está nas próximas aulas
// e a mensalidade do mês nasce (proporcional quando entra no meio) — e sai sem perder o passado. Cada
// caso usa a PRÓPRIA pessoa e a PRÓPRIA turma, com sufixo único, e só afirma o que é delas: nada de
// condição global do banco (desktop e celular rodam ao mesmo tempo). As datas são escolhidas a partir
// do dia de Brasília — o teste nunca supõe que hoje é dia 10. Nomes `[e2e]`.

const MENSALIDADE = 32000;
const VENCIMENTO = 10;

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

// O mês de hoje ("AAAA-MM"), o seguinte, e a data civil do dia `dia` de um mês.
function mesDeHoje(): string {
  return hojeNoAtelie().slice(0, 7);
}

function dataDoMes(mes: string, dia: number): string {
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

async function semearTurma(nome: string, datas: string[]) {
  return semearTurmaComDatas({
    nome,
    diaSemana: diaDaSemanaDe(datas[0]),
    inicio: "19:00",
    fim: "21:00",
    vagas: 8,
    mensalidadeCentavos: MENSALIDADE,
    diaVencimento: VENCIMENTO,
    datas,
  });
}

async function abrirFicha(page: Page, clienteId: string) {
  await page.goto(`/gestao/agenda?aba=pessoas&pessoa=${clienteId}`);
  const ficha = page.getByTestId("ficha-pessoa");
  await expect(ficha.getByTestId("turmas-da-pessoa")).toBeVisible();
  return ficha;
}

function linhaDaTurma(page: Page, turmaId: string) {
  return page.getByTestId("ficha-pessoa").locator(`[data-testid="turma-da-pessoa"][data-turma-id="${turmaId}"]`);
}

test.describe("agenda entrar na turma", () => {
  test("(a) entrar no meio do mês: o toast do proporcional, a mensalidade proporcional e as aulas de hoje em diante — também as marcadas depois", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const mes = mesDeHoje();
    const proximo = mesVizinho(mes, 1);
    const ultimo = ultimoDiaDoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)));
    // Quatro datas seguidas dentro do mês, a primeira ONTEM sempre que o mês deixa (hoje dia 1 → as
    // quatro de hoje em diante, e o caso vira "cheia"); mais uma no mês seguinte.
    const primeiroDia = Math.min(Math.max(Number(hoje.slice(8, 10)) - 1, 1), ultimo - 3);
    const doMes = [0, 1, 2, 3].map((n) => dataDoMes(mes, primeiroDia + n));
    const datas = [...doMes, dataDoMes(proximo, 10)];
    const esperado = valorProporcional({ valorCentavos: MENSALIDADE, datasDoMes: doMes, entrouEm: hoje });

    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const turmaNome = `[e2e] Turma ${suf}`;
    const clienteId = await semearCliente({ nome });
    const { turmaId } = await semearTurma(turmaNome, datas);

    await fazerLogin(page);
    await abrirFicha(page, clienteId);
    const linha = linhaDaTurma(page, turmaId);
    await expect(linha).toContainText(`${turmaNome} · `);
    await expect(linha).toContainText(`19:00 · ${formatarReais(MENSALIDADE)}/mês, vence dia ${VENCIMENTO}`);
    const caixa = linha.getByTestId("turma-da-pessoa-caixa");
    await expect(caixa).not.toBeChecked();
    await expect(linha.getByTestId("ver-turma")).toHaveCount(0);

    await caixa.click();
    if (esperado.tipo === "proporcional") {
      await expect(
        page
          .getByText(
            toastEntrouProporcional(
              nomeDoMes(mes),
              esperado.restantes,
              esperado.noMes,
              formatarReais(esperado.valorCentavos),
            ),
          )
          .first(),
      ).toBeVisible();
    } else {
      await expect(page.getByText(TOAST_ENTROU_MENSALIDADE_CHEIA).first()).toBeVisible();
    }
    await expect(caixa).toBeChecked();
    await expect(linha.getByTestId("ver-turma")).toBeVisible();

    // O banco: a mensalidade do mês (proporcional quando entrou no meio), vencendo no dia da turma.
    const mensalidades = await mensalidadesNoBanco(clienteId);
    expect(mensalidades).toHaveLength(1);
    expect(mensalidades[0]).toMatchObject({
      turmaId,
      mes: `${mes}-01`,
      valorCentavos: esperado.tipo === "nenhuma" ? -1 : esperado.valorCentavos,
      aulasRestantes: esperado.tipo === "proporcional" ? esperado.restantes : null,
      aulasNoMes: esperado.tipo === "proporcional" ? esperado.noMes : null,
      vencimento: dataDoMes(mes, VENCIMENTO),
    });
    // Inscrita como aluno de hoje em diante (a aula de hoje conta), inclusive no mês seguinte; a data
    // que já passou fica sem ela.
    const inscricoes = await inscricoesDaPessoaNaTurma(clienteId, turmaId);
    expect(inscricoes.map((i) => i.data)).toEqual(datas.filter((data) => data >= hoje));
    expect(inscricoes.every((i) => i.tipo === "aluno" && i.presenca === null)).toBe(true);

    // "ver turma" abre a folha da turma no lugar da ficha, com a pessoa entre os alunos; "Marcar mais
    // 1 semana" já a inscreve na data nova (Pitfall 5).
    await linha.getByTestId("ver-turma").click();
    const folha = page.getByTestId("folha-turma");
    await expect(folha).toBeVisible();
    await expect(page.getByTestId("ficha-pessoa")).toHaveCount(0);
    await expect(folha.getByTestId("turma-aluno").filter({ hasText: nome })).toHaveCount(1);
    await folha.getByTestId("turma-marcar-mais-semanas").fill("1");
    await folha.getByTestId("marcar-mais-semanas").click();
    await expect
      .poll(async () => (await inscricoesDaPessoaNaTurma(clienteId, turmaId)).length)
      .toBe(inscricoes.length + 1);
    const depois = await inscricoesDaPessoaNaTurma(clienteId, turmaId);
    expect(depois[depois.length - 1].data > datas[datas.length - 1]).toBe(true);
    // Fechar a folha devolve à ficha.
    await folha.getByTestId("folha-turma-voltar").click();
    await expect(page.getByTestId("ficha-pessoa").getByTestId("turmas-da-pessoa")).toBeVisible();
    await expect(page).not.toHaveURL(/turma=/);
  });

  test("(b) não sobra aula da turma no mês: o toast diz quando a mensalidade começa, e nenhuma mensalidade nasce", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const mes = mesDeHoje();
    const proximo = mesVizinho(mes, 1);
    // Datas só no mês seguinte — e uma do mês que já passou, quando o mês deixa.
    const datas = [
      ...(hoje > dataDoMes(mes, 1) ? [dataDoMes(mes, 1)] : []),
      dataDoMes(proximo, 5),
      dataDoMes(proximo, 12),
    ];
    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const clienteId = await semearCliente({ nome });
    const { turmaId } = await semearTurma(`[e2e] Turma ${suf}`, datas);

    await fazerLogin(page);
    await abrirFicha(page, clienteId);
    const caixa = linhaDaTurma(page, turmaId).getByTestId("turma-da-pessoa-caixa");
    await caixa.click();
    await expect(
      page.getByText(toastEntrouSemAulaNoMes(nomeDoMes(mes), nomeDoMes(proximo))).first(),
    ).toBeVisible();
    await expect(caixa).toBeChecked();

    expect(await mensalidadesNoBanco(clienteId)).toEqual([]);
    expect((await inscricoesDaPessoaNaTurma(clienteId, turmaId)).map((i) => i.data)).toEqual([
      dataDoMes(proximo, 5),
      dataDoMes(proximo, 12),
    ]);
  });

  test("(c) entrar pelas duas abas: um vínculo, uma inscrição por data, uma mensalidade", async ({ page }) => {
    const hoje = hojeNoAtelie();
    const datas = [hoje, somarDiasAoHoje(7), somarDiasAoHoje(14)];
    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const clienteId = await semearCliente({ nome });
    const { turmaId } = await semearTurma(`[e2e] Turma ${suf}`, datas);

    await fazerLogin(page);
    const outra = await page.context().newPage();
    await abrirFicha(page, clienteId);
    await abrirFicha(outra, clienteId);

    const caixa = linhaDaTurma(page, turmaId).getByTestId("turma-da-pessoa-caixa");
    await caixa.click();
    await expect(caixa).toBeChecked();
    await expect(linhaDaTurma(page, turmaId).getByTestId("ver-turma")).toBeVisible();

    // A outra aba ainda mostra a caixa vazia: o servidor recusa e a tela se atualiza.
    const caixaDaOutra = linhaDaTurma(outra, turmaId).getByTestId("turma-da-pessoa-caixa");
    await expect(caixaDaOutra).not.toBeChecked();
    await caixaDaOutra.click();
    await expect(outra.getByText(fraseJaEstaNaTurma(nome)).first()).toBeVisible();
    await expect(caixaDaOutra).toBeChecked();
    await outra.close();

    const vinculos = await vinculosNoBanco(clienteId, turmaId);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0]).toMatchObject({ entrouEm: hoje, saiuEm: null });
    const inscricoes = await inscricoesDaPessoaNaTurma(clienteId, turmaId);
    expect(inscricoes.map((i) => i.data)).toEqual(datas);
    const mensalidades = await mensalidadesNoBanco(clienteId);
    expect(mensalidades.length).toBeLessThanOrEqual(1);
    expect(new Set(mensalidades.map((m) => m.mes)).size).toBe(mensalidades.length);
  });

  test("(d) sair: a confirmação diz as aulas que saem; só as de aluno daqui para frente saem — o passado, a reposição e a mensalidade ficam", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const mes = mesDeHoje();
    const passada = somarDiasAoHoje(-3);
    const futuras = [somarDiasAoHoje(2), somarDiasAoHoje(9)];
    const comReposicao = somarDiasAoHoje(16);
    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const turmaNome = `[e2e] Turma ${suf}`;
    const clienteId = await semearCliente({ nome });
    const { turmaId, eventoIds } = await semearTurma(turmaNome, [passada, ...futuras, comReposicao]);
    // A mensalidade do mês ANTES do vínculo: abrir a ficha de qualquer pessoa em outro caso (D-02) faz
    // nascer a do mês de todo aluno — semeada antes, ela já existe quando o vínculo aparece, e a D-02
    // não tem o que criar (plano 08: na ordem inversa, a semente colidia com a chave única).
    await semearMensalidade({
      turmaId,
      clienteId,
      mes: `${mes}-01`,
      valorCentavos: MENSALIDADE,
      vencimento: dataDoMes(mes, VENCIMENTO),
    });
    await semearAluno({ turmaId, clienteId, entrouEm: somarDiasAoHoje(-10) });
    const naPassada = await semearInscricao({ eventoId: eventoIds[0], clienteId, tipo: "aluno" });
    await marcarPresencaNoBanco(naPassada, "veio");
    await semearInscricao({ eventoId: eventoIds[1], clienteId, tipo: "aluno" });
    await semearInscricao({ eventoId: eventoIds[2], clienteId, tipo: "aluno" });
    await semearInscricao({ eventoId: eventoIds[3], clienteId, tipo: "reposicao" });

    await fazerLogin(page);
    await abrirFicha(page, clienteId);
    const linha = linhaDaTurma(page, turmaId);
    const caixa = linha.getByTestId("turma-da-pessoa-caixa");
    await expect(caixa).toBeChecked();

    // "Manter na turma": a caixa volta marcada e nada muda.
    await caixa.click();
    const confirmacao = page.getByTestId("confirmar-sair");
    await expect(confirmacao.getByRole("heading", { name: `Tirar ${nome} de ${turmaNome}?` })).toBeVisible();
    await expect(confirmacao.getByTestId("confirmar-sair-corpo")).toHaveText(
      corpoConfirmarSairDaTurma(2, nomeDoMes(mes), true),
    );
    await confirmacao.getByTestId("confirmar-sair-nao").click();
    await expect(confirmacao).toHaveCount(0);
    await expect(caixa).toBeChecked();
    expect(await inscricoesDaPessoaNaTurma(clienteId, turmaId)).toHaveLength(4);

    // "Tirar da turma".
    await caixa.click();
    await page.getByTestId("confirmar-sair").getByTestId("confirmar-sair-sim").click();
    await expect(page.getByText(TOAST_SAIU_DA_TURMA).first()).toBeVisible();
    await expect(caixa).not.toBeChecked();
    await expect(linha.getByTestId("ver-turma")).toHaveCount(0);

    const vinculos = await vinculosNoBanco(clienteId, turmaId);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].saiuEm).toBe(hoje);
    const ficaram = await inscricoesDaPessoaNaTurma(clienteId, turmaId);
    expect(ficaram.map((i) => [i.data, i.tipo, i.presenca])).toEqual([
      [passada, "aluno", "veio"],
      [comReposicao, "reposicao", null],
    ]);
    const mensalidades = await mensalidadesNoBanco(clienteId);
    expect(mensalidades.filter((m) => m.mes === `${mes}-01`)).toHaveLength(1);
  });

  test("(e) a lista de Pessoas mostra a turma na sub-linha, com o dia abreviado", async ({ page }) => {
    const datas = [somarDiasAoHoje(3)];
    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const turmaNome = `[e2e] Turma ${suf}`;
    const clienteId = await semearCliente({ nome, telefone: "(00) 0000-0007" });
    const { turmaId } = await semearTurma(turmaNome, datas);
    await semearAluno({ turmaId, clienteId, entrouEm: somarDiasAoHoje(-1) });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?aba=pessoas&busca=${encodeURIComponent(nome)}`);
    await expect(
      page.getByTestId("pessoa-linha").filter({ hasText: nome }).getByTestId("pessoa-sub-linha"),
    ).toHaveText(`(00) 0000-0007 · ${turmaNome} (${NOMES_CURTOS_DOS_DIAS[diaDaSemanaDe(datas[0])]})`);
  });

  test("(f) D-02: abrir a ficha faz nascer a mensalidade do mês de quem já era aluno — uma só, mesmo abrindo de novo e em outra aba; a do mês passado continua", async ({
    page,
  }) => {
    const mes = mesDeHoje();
    const anterior = mesVizinho(mes, -1);
    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const clienteId = await semearCliente({ nome });
    // A data de HOJE garante uma aula no mês corrente em qualquer dia do mês: sem aula no mês, a D-02 não
    // cobra (WR-03 da revisão, decisão do dono de 02/10/2026).
    const { turmaId } = await semearTurma(`[e2e] Turma ${suf}`, [somarDiasAoHoje(5), hojeNoAtelie()]);
    await semearAluno({ turmaId, clienteId, entrouEm: dataDoMes(anterior, 15) });
    await semearMensalidade({
      turmaId,
      clienteId,
      mes: `${anterior}-01`,
      valorCentavos: 16000,
      vencimento: dataDoMes(anterior, VENCIMENTO),
    });
    // Só a do mês passado foi semeada. A do mês corrente pode já ter nascido pela ficha de OUTRA pessoa
    // aberta em outro caso (a D-02 vale para todos os alunos) — o que este caso prova é que ela é UMA só.
    expect((await mensalidadesNoBanco(clienteId)).filter((m) => m.mes !== `${mes}-01`)).toHaveLength(1);

    await fazerLogin(page);
    await abrirFicha(page, clienteId);
    await expect(linhaDaTurma(page, turmaId).getByTestId("turma-da-pessoa-caixa")).toBeChecked();

    const doMes = (await mensalidadesNoBanco(clienteId)).filter((m) => m.mes === `${mes}-01`);
    expect(doMes).toHaveLength(1);
    expect(doMes[0]).toMatchObject({
      turmaId,
      valorCentavos: MENSALIDADE,
      aulasRestantes: null,
      aulasNoMes: null,
      vencimento: dataDoMes(mes, VENCIMENTO),
    });

    // De novo, e em outra aba ao mesmo tempo: o banco continua com UMA do mês corrente.
    const outra = await page.context().newPage();
    await Promise.all([abrirFicha(page, clienteId), abrirFicha(outra, clienteId)]);
    await outra.close();
    const todas = await mensalidadesNoBanco(clienteId);
    expect(todas.map((m) => m.mes)).toEqual([`${anterior}-01`, `${mes}-01`]);
    expect(todas[0]).toMatchObject({ valorCentavos: 16000, vencimento: dataDoMes(anterior, VENCIMENTO) });
  });

  test("(g) Pitfall 6: mudar a mensalidade da turma no meio do mês, sem ninguém ter aberto a ficha, não muda a do mês — ela nasce com o valor antigo", async ({
    page,
  }) => {
    const mes = mesDeHoje();
    const anterior = mesVizinho(mes, -1);
    const primeira = somarDiasAoHoje(4);
    const suf = sufixoUnico();
    const turmaNome = `[e2e] Turma ${suf}`;
    const clienteId = await semearCliente({ nome: `[e2e] Pessoa ${suf}` });
    // Hoje também: a mensalidade do mês só nasce com aula no mês (WR-03; a de +4 dias pode cair no mês seguinte).
    const { turmaId } = await semearTurma(turmaNome, [primeira, hojeNoAtelie()]);
    await semearAluno({ turmaId, clienteId, entrouEm: dataDoMes(anterior, 20) });
    // Ninguém abriu a ficha DESTA pessoa — mas abrir a ficha de QUALQUER pessoa (outro caso, outro
    // projeto, outra spec rodando junto) faz nascer a mensalidade do mês de todos os alunos (D-02). A
    // premissa que vale sob paralelismo é: ainda não nasceu, ou nasceu com o valor ANTIGO (plano 08:
    // "ainda não nasceu" era uma condição global do banco e falhou com `agenda reposicao` rodando junto).
    const antes = await mensalidadesNoBanco(clienteId);
    expect(antes.every((mensalidade) => mensalidade.valorCentavos === MENSALIDADE)).toBe(true);

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${primeira}&turma=${turmaId}`);
    const folha = page.getByTestId("folha-turma");
    await expect(folha.getByTestId("turma-mensalidade")).toHaveValue("320,00");
    await folha.getByTestId("turma-mensalidade").fill("450");
    await folha.getByTestId("salvar-turma").click();
    await expect(page.getByText(TOAST_TURMA_SALVA).first()).toBeVisible();

    const [turma] = await turmasComNome(turmaNome);
    expect(turma.mensalidadeCentavos).toBe(45000);
    const mensalidades = await mensalidadesNoBanco(clienteId);
    expect(mensalidades).toHaveLength(1);
    expect(mensalidades[0]).toMatchObject({
      turmaId,
      mes: `${mes}-01`,
      valorCentavos: MENSALIDADE,
      vencimento: dataDoMes(mes, VENCIMENTO),
    });
  });
});

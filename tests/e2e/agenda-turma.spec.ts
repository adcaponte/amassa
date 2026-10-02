import { test, expect, type Page } from "@playwright/test";

import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  avisoTurmaEmDiaFechado,
  caixaDataDeTurmaEmDiaFechado,
  corpoConfirmarDesativarTurma,
  FRASE_NENHUM_ALUNO,
  FRASE_PERDAS_DA_TURMA_MUDARAM,
  FRASE_SEM_RESPOSTA_AO_LANCAR,
  FRASE_SEMANAS,
  FRASE_VENCIMENTO,
  fraseDesativarComVendaAtiva,
  linhaDatasMarcadas,
  TOAST_TURMA_DESATIVADA,
  TOAST_TURMA_SALVA,
  toastDatasNovas,
  toastTurmaLancada,
} from "@/lib/agenda/textos";
import { diaDaSemanaDe, NOMES_DOS_DIAS } from "@/lib/agenda/turma";
import { formatarDiaMes, somarDias } from "@/lib/producao/calendario";

import {
  cancelarDataNoBanco,
  datasDaTurmaNoBanco,
  eventoNoBanco,
  inscricoesDoEvento,
  ligarVendaAInscricao,
  marcarFaltaComDireitoNoBanco,
  marcarPresencaNoBanco,
  semearAluno,
  semearCliente,
  semearFechado,
  semearInscricao,
  semearTurmaComDatas,
  turmasComNome,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-06 (AGE-03, D-03, D-13): lançar uma turma fixa marca N semanas de uma vez; a data de turma
// num dia fechado continua marcada, com a etiqueta, e a folha dela traz o "Cancelar esta data" na
// caixa do topo. Cada caso usa o PRÓPRIO nome com sufixo único e, quando depende do que mais existe
// nos dias (o aviso D-13 lê os fechados), uma janela de dias RESERVADA para ele e para o projeto —
// desktop e celular rodam ao mesmo tempo e nenhum caso afirma condição global do banco (CLAUDE.md).
// Datas sempre pelo dia de Brasília. Nomes `[e2e]`.

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

// Janelas de 20 dias a partir de 500 — longe da `agenda lancamento` (300+), da `agenda cancelamento`
// (330+), da `agenda colocar` (360+) e da `agenda vistas` (10-14).
function inicioDaJanela(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(500 + caso * 40 + projeto * 20);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function folhaLancar(page: Page) {
  return page.getByTestId("folha-lancar");
}

function cartaoComTitulo(page: Page, data: string, titulo: string) {
  return page.getByTestId(`agenda-dia-${data}`).getByTestId("agenda-cartao").filter({ hasText: titulo });
}

async function escolherDiaDaSemana(page: Page, dia: number) {
  await folhaLancar(page).getByTestId("lancar-dia-semana").click();
  await page.getByRole("option", { name: capitalizar(NOMES_DOS_DIAS[dia]), exact: true }).click();
}

// Uma turma ATIVA semeada com as datas dadas (todas no mesmo dia da semana, o da primeira).
async function semearTurma(nome: string, datas: string[]) {
  return semearTurmaComDatas({
    nome,
    diaSemana: diaDaSemanaDe(datas[0]),
    inicio: "19:00",
    fim: "21:00",
    vagas: 8,
    mensalidadeCentavos: 30000,
    diaVencimento: 10,
    datas,
  });
}

type Turma = { nome: string; inicio: string; fim: string; mensalidade: string; semanas: string };

async function preencherTurma(page: Page, turma: Turma) {
  const f = folhaLancar(page);
  await f.getByTestId("lancar-nome").fill(turma.nome);
  await f.getByTestId("lancar-inicio").fill(turma.inicio);
  await f.getByTestId("lancar-fim").fill(turma.fim);
  await f.getByTestId("lancar-mensalidade").fill(turma.mensalidade);
  await f.getByTestId("lancar-semanas").fill(turma.semanas);
}

test.describe("agenda turma", () => {
  test("(a) lançar uma turma no dia da semana de amanhã, 3 semanas a partir de hoje — três datas, uma por semana, e a turma no banco", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const datas = [somarDiasAoHoje(1), somarDiasAoHoje(8), somarDiasAoHoje(15)];
    const nome = `[e2e] Turma ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await page.getByTestId("agenda-lancar").click();
    const f = folhaLancar(page);
    await expect(f).toBeVisible();

    // Trocar de pílula mantém o que foi digitado (UI E5·partial).
    await f.getByTestId("lancar-nome").fill(nome);
    await f.getByTestId("lancar-vagas").fill("6");
    await f.getByTestId("lancar-tipo-turma").click();
    await expect(f.getByTestId("lancar-tipo-turma")).toHaveAttribute("aria-checked", "true");
    await expect(f.getByTestId("lancar-nome")).toHaveValue(nome);
    await expect(f.getByTestId("lancar-vagas")).toHaveValue("6");

    // Padrões da UI-SPEC: sem "+ lançar" de um dia, segunda; a partir de hoje; 8 semanas; vence dia
    // 10; mensalidade vazia (nenhum preço no código).
    await expect(f.getByTestId("lancar-dia-semana")).toHaveText(/Segunda/);
    await expect(f.getByTestId("lancar-data")).toHaveValue(hoje);
    await expect(f.getByTestId("lancar-semanas")).toHaveValue("8");
    await expect(f.getByTestId("lancar-vencimento")).toHaveValue("10");
    await expect(f.getByTestId("lancar-mensalidade")).toHaveValue("");
    // A caixa pública vem DESmarcada (decisão do dono de 02/10/2026); aqui ela é marcada de propósito, e
    // as conferências `publica: true` / `publico: true` abaixo provam que a escolha explícita chega à
    // turma e às datas.
    await expect(f.getByTestId("lancar-publico")).toHaveAttribute("aria-checked", "false");
    await f.getByTestId("lancar-publico").click();
    await expect(f.getByTestId("lancar-publico")).toHaveAttribute("aria-checked", "true");
    await expect(f.getByTestId("lancar-gravar")).toHaveText("Lançar turma");

    await escolherDiaDaSemana(page, diaDaSemanaDe(datas[0]));
    await preencherTurma(page, { nome, inicio: "19:00", fim: "21:00", mensalidade: "320,50", semanas: "3" });
    await f.getByTestId("lancar-gravar").click();

    await expect(page.getByText("Turma lançada, com as próximas 3 aulas.").first()).toBeVisible();
    await expect(folhaLancar(page)).toHaveCount(0);

    // O banco: uma turma, três datas no dia da semana dela, horário/vagas/público copiados.
    const turmas = await turmasComNome(nome);
    expect(turmas).toHaveLength(1);
    expect(turmas[0]).toMatchObject({
      diaSemana: diaDaSemanaDe(datas[0]),
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 32050,
      diaVencimento: 10,
      publica: true,
      ativa: true,
    });
    const noBanco = await datasDaTurmaNoBanco(turmas[0].id);
    expect(noBanco.map((linha) => linha.data)).toEqual(datas);
    for (const linha of noBanco) {
      expect(linha).toMatchObject({ inicio: "19:00", fim: "21:00", vagas: 6, publico: true });
    }

    // Os três cartões, cada um na sua semana: o nome da turma, o tipo escrito e "0 / 6".
    for (const data of datas) {
      await page.goto(`/gestao/agenda?semana=${data}`);
      const cartao = cartaoComTitulo(page, data, nome);
      await expect(cartao).toHaveCount(1);
      await expect(cartao).toContainText("19:00");
      await expect(cartao).toContainText("Turma fixa · até 21:00");
      await expect(cartao).toContainText("0 / 6");
      await expect(cartao.getByTestId("tag-dia-fechado")).toHaveCount(0);
    }
  });

  test("(b) D-13: a segunda data cai num dia fechado — avisa antes, marca mesmo assim com “dia fechado”, e a folha dela traz o “Cancelar esta data” na caixa", async ({
    page,
  }) => {
    const primeira = inicioDaJanela(1);
    const segunda = somarDias(primeira, 7);
    const terceira = somarDias(primeira, 14);
    const motivo = `[e2e] Forno em manutenção ${sufixoUnico()}`;
    await semearFechado({ data: segunda, motivo });
    const nome = `[e2e] Turma fechada ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${primeira}`);
    await page.getByTestId(`agenda-dia-${primeira}`).getByTestId("agenda-lancar-no-dia").click();
    const f = folhaLancar(page);
    await expect(f).toBeVisible();
    await f.getByTestId("lancar-tipo-turma").click();

    // "+ lançar" de um dia: o dia da semana e a primeira aula vêm dele.
    await expect(f.getByTestId("lancar-dia-semana")).toHaveText(
      new RegExp(capitalizar(NOMES_DOS_DIAS[diaDaSemanaDe(primeira)])),
    );
    await expect(f.getByTestId("lancar-data")).toHaveValue(primeira);

    await preencherTurma(page, { nome, inicio: "19:00", fim: "21:00", mensalidade: "300", semanas: "3" });
    // O aviso aparece ANTES de gravar e o botão não muda.
    await expect(f.getByTestId("aviso-dia-fechado")).toHaveText(avisoTurmaEmDiaFechado([formatarDiaMes(segunda)]));
    await expect(f.getByTestId("lancar-gravar")).toBeEnabled();
    await f.getByTestId("lancar-gravar").click();

    await expect(page.getByText(toastTurmaLancada(3, [formatarDiaMes(segunda)])).first()).toBeVisible();
    await expect(page.getByText("Uma delas cai num dia fechado").first()).toBeVisible();

    const turmas = await turmasComNome(nome);
    expect(turmas).toHaveLength(1);
    const datas = await datasDaTurmaNoBanco(turmas[0].id);
    expect(datas.map((linha) => linha.data)).toEqual([primeira, segunda, terceira]);

    // A primeira semana: o cartão sem etiqueta.
    await expect(cartaoComTitulo(page, primeira, nome)).toHaveCount(1);
    await expect(cartaoComTitulo(page, primeira, nome).getByTestId("tag-dia-fechado")).toHaveCount(0);

    // A data do dia fechado: marcada, com a etiqueta, NÃO cancelada.
    await page.goto(`/gestao/agenda?semana=${segunda}`);
    const cartao = cartaoComTitulo(page, segunda, nome);
    await expect(cartao.getByTestId("tag-dia-fechado")).toHaveText("dia fechado");
    await cartao.click();
    const folha = page.getByTestId("folha-evento");
    const caixa = folha.getByTestId("caixa-dia-fechado");
    await expect(caixa).toContainText(caixaDataDeTurmaEmDiaFechado(motivo));
    await expect(caixa.getByTestId("cancelar-data")).toBeVisible();
    // O botão existe uma vez só: o rodapé fica só com "Pronto".
    await expect(folha.getByTestId("cancelar-data")).toHaveCount(1);
    await expect(folha.getByTestId("folha-evento-pronto")).toBeVisible();

    const idDaData = datas[1].id;
    expect((await eventoNoBanco(idDaData))?.canceladoEm).toBeNull();
  });

  test("(c) erros embaixo dos campos: 53 semanas e vencimento dia 29 — nada gravado", async ({ page }) => {
    const nome = `[e2e] Turma errada ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${inicioDaJanela(2)}`);
    await page.getByTestId("agenda-lancar").click();
    const f = folhaLancar(page);
    await f.getByTestId("lancar-tipo-turma").click();
    await preencherTurma(page, { nome, inicio: "19:00", fim: "21:00", mensalidade: "300", semanas: "53" });
    await f.getByTestId("lancar-vencimento").fill("29");
    await f.getByTestId("lancar-gravar").click();

    await expect(f.getByTestId("lancar-erro-semanas")).toHaveText(FRASE_SEMANAS);
    await expect(f.getByTestId("lancar-erro-diaVencimento")).toHaveText(FRASE_VENCIMENTO);
    await expect(f.getByTestId("lancar-semanas")).toBeFocused();
    await expect(f).toBeVisible();
    expect(await turmasComNome(nome)).toHaveLength(0);
  });

  test("(d) “Abrir a turma” abre a folha da turma no lugar da data, “Voltar à data” volta; mudar o horário muda as datas FUTURAS e não a de hoje", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const datas = [hoje, somarDias(hoje, 7), somarDias(hoje, 14)];
    const nome = `[e2e] Turma editada ${sufixoUnico()}`;
    const { turmaId, eventoIds } = await semearTurma(nome, datas);

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${hoje}&evento=${eventoIds[0]}`);
    const folhaDaData = page.getByTestId("folha-evento");
    await expect(folhaDaData).toBeVisible();
    await folhaDaData.getByTestId("abrir-turma").click();

    const folha = page.getByTestId("folha-turma");
    await expect(folha).toBeVisible();
    await expect(page.getByTestId("folha-evento")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`[?&]turma=${turmaId}`));
    await expect(folha.getByTestId("folha-turma-subtitulo")).toContainText("0 alunos de 8 vagas");
    await expect(folha.getByTestId("turma-alunos-titulo")).toHaveText("Alunos (0)");
    await expect(folha.getByTestId("turma-sem-alunos")).toHaveText(FRASE_NENHUM_ALUNO);
    await expect(folha.getByTestId("turma-datas-marcadas")).toHaveText(
      linhaDatasMarcadas(diaDaSemanaPorExtenso(datas[2]), formatarDiaMes(datas[2]), 2),
    );
    await expect(folha.getByTestId("salvar-turma")).toBeDisabled();

    // "Voltar à data" volta à folha da data de onde veio.
    await folha.getByTestId("voltar-a-data").click();
    await expect(page.getByTestId("folha-evento")).toBeVisible();
    await expect(page.getByTestId("folha-turma")).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]turma=/);

    await page.getByTestId("folha-evento").getByTestId("abrir-turma").click();
    await expect(folha.getByTestId("turma-inicio")).toHaveValue("19:00");
    await folha.getByTestId("turma-inicio").fill("18:00");
    await folha.getByTestId("turma-fim").fill("20:30");
    await expect(folha.getByTestId("salvar-turma")).toBeEnabled();
    await folha.getByTestId("salvar-turma").click();
    await expect(page.getByText(TOAST_TURMA_SALVA).first()).toBeVisible();

    // Hoje fica como foi (Assumption A9); as futuras mudam.
    await expect.poll(async () => (await datasDaTurmaNoBanco(turmaId)).map((d) => `${d.data} ${d.inicio}-${d.fim}`)).toEqual([
      `${datas[0]} 19:00-21:00`,
      `${datas[1]} 18:00-20:30`,
      `${datas[2]} 18:00-20:30`,
    ]);
    const [turma] = await turmasComNome(nome);
    expect(turma).toMatchObject({ inicio: "18:00", fim: "20:30", ativa: true });
  });

  test("(e) “Marcar mais 2 semanas” começa depois da última data e põe o aluno nas datas novas; duas abas ao mesmo tempo não repetem data", async ({
    page,
  }) => {
    const primeira = inicioDaJanela(3);
    const nome = `[e2e] Turma estendida ${sufixoUnico()}`;
    const { turmaId, eventoIds } = await semearTurma(nome, [primeira, somarDias(primeira, 7)]);
    const clienteId = await semearCliente({ nome: `[e2e] Aluna ${sufixoUnico()}` });
    await semearAluno({ turmaId, clienteId, entrouEm: hojeNoAtelie() });

    await fazerLogin(page);
    // Aberta direto pela URL (não veio de uma data): sem "Voltar à data" (UI-D25).
    await page.goto(`/gestao/agenda?semana=${primeira}&turma=${turmaId}`);
    const folha = page.getByTestId("folha-turma");
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("voltar-a-data")).toHaveCount(0);
    await expect(folha.getByTestId("folha-turma-subtitulo")).toContainText("1 aluno de 8 vagas");
    await expect(folha.getByTestId("turma-alunos-titulo")).toHaveText("Alunos (1)");
    await expect(folha.getByTestId("turma-marcar-mais-semanas")).toHaveValue("8");

    await folha.getByTestId("turma-marcar-mais-semanas").fill("2");
    await folha.getByTestId("marcar-mais-semanas").click();
    const ultima = somarDias(primeira, 21);
    await expect(page.getByText(toastDatasNovas(2, formatarDiaMes(ultima))).first()).toBeVisible();

    const depois = await datasDaTurmaNoBanco(turmaId);
    expect(depois.map((d) => d.data)).toEqual([0, 7, 14, 21].map((dias) => somarDias(primeira, dias)));
    // O aluno entrou SÓ nas datas novas (as semeadas não tinham ninguém), como aluno, sem cobrar.
    for (const nova of depois.slice(2)) {
      const inscricoes = await inscricoesDoEvento(nova.id);
      expect(inscricoes).toEqual([expect.objectContaining({ clienteId, tipo: "aluno", cobrar: false })]);
    }
    expect(await inscricoesDoEvento(eventoIds[0])).toEqual([]);
    await expect(folha.getByTestId("turma-datas-marcadas")).toHaveText(
      linhaDatasMarcadas(diaDaSemanaPorExtenso(ultima), formatarDiaMes(ultima), 4),
    );

    // Duas abas tocam ao mesmo tempo: cada uma marca 1 semana, e nenhuma data se repete.
    const outra = await page.context().newPage();
    await outra.goto(`/gestao/agenda?semana=${primeira}&turma=${turmaId}`);
    const folhaDaOutra = outra.getByTestId("folha-turma");
    await expect(folhaDaOutra).toBeVisible();
    await folha.getByTestId("turma-marcar-mais-semanas").fill("1");
    await folhaDaOutra.getByTestId("turma-marcar-mais-semanas").fill("1");
    await Promise.all([
      folha.getByTestId("marcar-mais-semanas").click(),
      folhaDaOutra.getByTestId("marcar-mais-semanas").click(),
    ]);
    await expect.poll(async () => (await datasDaTurmaNoBanco(turmaId)).length).toBe(6);
    const finais = (await datasDaTurmaNoBanco(turmaId)).map((d) => d.data);
    expect(new Set(finais).size).toBe(6);
    expect(finais).toEqual([0, 7, 14, 21, 28, 35].map((dias) => somarDias(primeira, dias)));
    await outra.close();
  });

  test("(f) “Desativar turma” diz o que sai, tira as datas futuras e as inscrições delas, e mantém a data passada e a turma", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const datas = [somarDias(hoje, -7), somarDias(hoje, 7), somarDias(hoje, 14)];
    const nome = `[e2e] Turma desativada ${sufixoUnico()}`;
    const { turmaId, eventoIds } = await semearTurma(nome, datas);
    const clienteId = await semearCliente({ nome: `[e2e] Repõe ${sufixoUnico()}` });
    const reposicaoId = await semearInscricao({ eventoId: eventoIds[1], clienteId, tipo: "reposicao" });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${datas[0]}&evento=${eventoIds[0]}`);
    await page.getByTestId("folha-evento").getByTestId("abrir-turma").click();
    const folha = page.getByTestId("folha-turma");
    await expect(folha.getByTestId("turma-nome")).toHaveValue(nome);

    await folha.getByTestId("desativar-turma").click();
    const confirmacao = page.getByTestId("confirmar-desativar-turma");
    await expect(confirmacao).toContainText(`Desativar ${nome}?`);
    await expect(confirmacao).toContainText(corpoConfirmarDesativarTurma({ datas: 2, reposicoes: 1, cobrancas: 0, presencas: 0, creditos: 0 }));
    // "Manter turma" não muda nada.
    await page.getByTestId("confirmar-desativar-turma-nao").click();
    await expect(confirmacao).toHaveCount(0);
    expect((await turmasComNome(nome))[0].ativa).toBe(true);

    await folha.getByTestId("desativar-turma").click();
    await page.getByTestId("confirmar-desativar-turma-sim").click();
    await expect(page.getByText(TOAST_TURMA_DESATIVADA).first()).toBeVisible();

    await expect.poll(async () => (await turmasComNome(nome))[0].ativa).toBe(false);
    expect((await turmasComNome(nome))[0].desativadaEm).not.toBeNull();
    expect(await eventoNoBanco(eventoIds[0])).not.toBeNull();
    expect(await eventoNoBanco(eventoIds[1])).toBeNull();
    expect(await eventoNoBanco(eventoIds[2])).toBeNull();
    expect((await datasDaTurmaNoBanco(turmaId)).map((d) => d.data)).toEqual([datas[0]]);
    expect(await inscricoesDoEvento(eventoIds[1])).toEqual([]);
    expect(reposicaoId).toBeTruthy();

    // A folha continua aberta, só de leitura: "desativada em", sem editar, marcar ou desativar.
    await expect(folha.getByTestId("folha-turma-subtitulo")).toContainText("desativada em");
    await expect(folha.getByTestId("salvar-turma")).toHaveCount(0);
    await expect(folha.getByTestId("desativar-turma")).toHaveCount(0);
    await expect(folha.getByTestId("marcar-mais-semanas")).toHaveCount(0);
    await expect(folha.getByTestId("turma-datas-marcadas")).toHaveText("Nenhuma data marcada daqui para frente.");
  });

  test("(g) desativar recusa quando uma data futura tem inscrição que já virou venda — a frase fica no diálogo e nada muda", async ({
    page,
  }) => {
    const primeira = inicioDaJanela(4);
    const segunda = somarDias(primeira, 7);
    const nome = `[e2e] Turma com venda ${sufixoUnico()}`;
    const { turmaId, eventoIds } = await semearTurma(nome, [primeira, segunda]);
    const clienteId = await semearCliente({ nome: `[e2e] Experimental ${sufixoUnico()}` });
    const inscricaoId = await semearInscricao({
      eventoId: eventoIds[1],
      clienteId,
      tipo: "experimental",
      cobrar: true,
      valorCentavos: 4000,
    });
    const { numero } = await ligarVendaAInscricao({
      inscricaoId,
      valorCentavos: 4000,
      descricao: `[e2e] Aula experimental ${sufixoUnico()}`,
      data: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${primeira}&turma=${turmaId}`);
    const folha = page.getByTestId("folha-turma");
    await folha.getByTestId("desativar-turma").click();
    await page.getByTestId("confirmar-desativar-turma-sim").click();

    await expect(page.getByTestId("confirmar-desativar-turma-erro")).toHaveText(
      fraseDesativarComVendaAtiva(formatarDiaMes(segunda), numero),
    );
    await expect(page.getByTestId("confirmar-desativar-turma")).toBeVisible();
    expect((await turmasComNome(nome))[0].ativa).toBe(true);
    expect((await datasDaTurmaNoBanco(turmaId)).map((d) => d.data)).toEqual([primeira, segunda]);
    expect(await inscricoesDoEvento(eventoIds[1])).toHaveLength(1);
  });

  test("(h) WR-02: editar a turma também muda a data futura CANCELADA — desfazer o cancelamento não traz de volta o horário velho nem o “no site” de antes", async ({
    page,
  }) => {
    const primeira = inicioDaJanela(5);
    const segunda = somarDias(primeira, 7);
    const nome = `[e2e] Turma com data cancelada ${sufixoUnico()}`;
    const { turmaId, eventoIds } = await semearTurmaComDatas({
      nome,
      diaSemana: diaDaSemanaDe(primeira),
      inicio: "19:00",
      fim: "21:00",
      vagas: 8,
      mensalidadeCentavos: 30000,
      diaVencimento: 10,
      datas: [primeira, segunda],
      publica: true,
    });
    await cancelarDataNoBanco(eventoIds[0]);

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${primeira}&turma=${turmaId}`);
    const folha = page.getByTestId("folha-turma");
    await expect(folha.getByTestId("turma-inicio")).toHaveValue("19:00");
    await folha.getByTestId("turma-inicio").fill("18:00");
    await folha.getByTestId("turma-fim").fill("20:30");
    await folha.getByTestId("turma-publica").click();
    await folha.getByTestId("salvar-turma").click();
    await expect(page.getByText(TOAST_TURMA_SALVA).first()).toBeVisible();

    // As DUAS datas futuras seguem a turma — a cancelada também, para o “Desfazer” não ressuscitar o velho.
    await expect
      .poll(async () => (await datasDaTurmaNoBanco(turmaId)).map((d) => `${d.data} ${d.inicio}-${d.fim} ${d.publico}`))
      .toEqual([`${primeira} 18:00-20:30 false`, `${segunda} 18:00-20:30 false`]);
    expect((await eventoNoBanco(eventoIds[0]))?.canceladoEm).not.toBeNull();
  });
  test("(i) WR-04: a confirmação de “Desativar turma” diz a cobrança, a presença e o crédito que somem; se algo cresce com o diálogo aberto, nada é apagado e os números novos aparecem", async ({
    page,
  }) => {
    const primeira = inicioDaJanela(6);
    const nome = `[e2e] Turma com perdas ${sufixoUnico()}`;
    const { turmaId, eventoIds } = await semearTurma(nome, [primeira]);
    const experimental = await semearCliente({ nome: `[e2e] Experimental ${sufixoUnico()}` });
    const aluna = await semearCliente({ nome: `[e2e] Aluna ${sufixoUnico()}` });
    const outra = await semearCliente({ nome: `[e2e] Outra ${sufixoUnico()}` });
    await semearInscricao({ eventoId: eventoIds[0], clienteId: experimental, tipo: "experimental", cobrar: true, valorCentavos: 4000 });
    const faltou = await semearInscricao({ eventoId: eventoIds[0], clienteId: aluna, tipo: "aluno" });
    await marcarFaltaComDireitoNoBanco(faltou);
    const daOutra = await semearInscricao({ eventoId: eventoIds[0], clienteId: outra, tipo: "aluno" });

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${primeira}&turma=${turmaId}`);
    const folha = page.getByTestId("folha-turma");
    await folha.getByTestId("desativar-turma").click();
    const confirmacao = page.getByTestId("confirmar-desativar-turma");
    await expect(confirmacao).toContainText(
      corpoConfirmarDesativarTurma({ datas: 1, reposicoes: 0, cobrancas: 1, presencas: 1, creditos: 1 }),
    );

    // Outro celular marca presença na data com o diálogo aberto: o servidor reconta e NÃO apaga.
    await marcarPresencaNoBanco(daOutra, "veio");
    await page.getByTestId("confirmar-desativar-turma-sim").click();
    await expect(page.getByTestId("confirmar-desativar-turma-mudou")).toHaveText(FRASE_PERDAS_DA_TURMA_MUDARAM);
    await expect(confirmacao).toContainText(
      corpoConfirmarDesativarTurma({ datas: 1, reposicoes: 0, cobrancas: 1, presencas: 2, creditos: 1 }),
    );
    expect((await turmasComNome(nome))[0].ativa).toBe(true);
    expect(await inscricoesDoEvento(eventoIds[0])).toHaveLength(3);

    // Confirmado com os números de agora, desativa.
    await page.getByTestId("confirmar-desativar-turma-sim").click();
    await expect(page.getByText(TOAST_TURMA_DESATIVADA).first()).toBeVisible();
    await expect.poll(async () => (await turmasComNome(nome))[0].ativa).toBe(false);
    expect(await eventoNoBanco(eventoIds[0])).toBeNull();
  });
  test("(j) WR-06 da revisão B: o servidor grava mas a resposta se perde; tocar “Lançar turma” de novo não cria a segunda turma", async ({
    page,
  }) => {
    const primeira = inicioDaJanela(7);
    const nome = `[e2e] Turma da resposta perdida ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?lancar=1&dia=${primeira}`);
    const f = folhaLancar(page);
    await expect(f).toBeVisible();
    await f.getByTestId("lancar-tipo-turma").click();
    await escolherDiaDaSemana(page, diaDaSemanaDe(primeira));
    await preencherTurma(page, { nome, inicio: "19:00", fim: "21:00", mensalidade: "300", semanas: "2" });

    // A primeira tentativa de LANÇAR (a ação cujo corpo leva o nome da turma — a folha também chama
    // `conferirDiaParaLancar`) CHEGA ao servidor, que grava, mas a resposta não volta ao celular.
    let perdidas = 0;
    await page.route("**/*", async (route) => {
      const pedido = route.request();
      if (
        perdidas === 0 &&
        pedido.method() === "POST" &&
        pedido.headers()["next-action"] !== undefined &&
        (pedido.postData() ?? "").includes(nome)
      ) {
        perdidas += 1;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await f.getByTestId("lancar-gravar").click();
    await expect(f.getByTestId("lancar-erro-geral")).toHaveText(FRASE_SEM_RESPOSTA_AO_LANCAR);
    await expect.poll(async () => (await turmasComNome(nome)).length).toBe(1);

    // O gestor toca de novo: o servidor devolve o que já gravou.
    await f.getByTestId("lancar-gravar").click();
    await expect(page.getByText(toastTurmaLancada(2, [])).first()).toBeVisible();
    await page.unroute("**/*");
    const turmas = await turmasComNome(nome);
    expect(turmas).toHaveLength(1);
    expect(await datasDaTurmaNoBanco(turmas[0].id)).toHaveLength(2);
  });
});

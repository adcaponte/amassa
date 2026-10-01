import { test, expect, type Page } from "@playwright/test";

import {
  avisoTurmaEmDiaFechado,
  caixaDataDeTurmaEmDiaFechado,
  FRASE_SEMANAS,
  FRASE_VENCIMENTO,
  toastTurmaLancada,
} from "@/lib/agenda/textos";
import { diaDaSemanaDe, NOMES_DOS_DIAS } from "@/lib/agenda/turma";
import { formatarDiaMes, somarDias } from "@/lib/producao/calendario";

import { datasDaTurmaNoBanco, eventoNoBanco, semearFechado, turmasComNome } from "./apoio/semear-agenda";
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
});

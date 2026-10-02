import { test, expect, type Page } from "@playwright/test";

import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  corpoConfirmarCancelarOficina,
  FRASE_JA_REMOVIDO,
  FRASE_PERDAS_DA_DATA_MUDARAM,
  TOAST_CANCELADA_OFICINA,
  TOAST_CANCELADA_TURMA,
  TOAST_DATA_VOLTOU,
  tituloConfirmarCancelarData,
  tituloConfirmarTirarBloqueio,
  toastBloqueioTirado,
} from "@/lib/agenda/textos";
import { formatarDiaMes, somarDias } from "@/lib/producao/calendario";

import {
  eventoNoBanco,
  inscricaoNoBanco,
  marcarPresencaNoBanco,
  semearCliente,
  semearFechado,
  semearInscricao,
  semearOficina,
  semearTurmaComDatas,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-03, Tarefa 2 (AGE-04, AGE-05, UI-D13): cancelar uma data NUNCA a apaga — ela fica riscada
// com "cancelada" e se desfaz; só o dia fechado se remove, com confirmação. Cada caso semeia o
// PRÓPRIO evento num dia reservado para ele e para o projeto (desktop e celular rodam juntos) e
// acha tudo pelo id — nenhuma afirmação global do banco. Nomes `[e2e]`, datas de Brasília.

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

// Dias 330+ — longe dos da `agenda lancamento` (300+) e da `agenda vistas`.
function diaReservado(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(330 + caso * 2 + projeto);
}

// 0 = domingo … 6 = sábado, de uma data civil (sem fuso: meio-dia UTC).
function diaDaSemanaDe(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

function cartao(page: Page, eventoId: string) {
  return page.locator(`[data-testid="agenda-cartao"][data-evento-id="${eventoId}"]`);
}

async function abrirFolhaDoEvento(page: Page, data: string, eventoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}`);
  await cartao(page, eventoId).click();
  await expect(page).toHaveURL(new RegExp(`[?&]evento=${eventoId}`));
}

async function semearOficinaNoDia(data: string, titulo: string) {
  return semearOficina({ titulo, data, inicio: "14:00", fim: "16:00", vagas: 6, precoCentavos: 9000 });
}

test.describe("agenda cancelamento", () => {
  test("oficina sem inscrito: cancela direto, fica riscada com “cancelada”, e o “Desfazer” do toast devolve", async ({
    page,
  }) => {
    const data = diaReservado(0);
    const titulo = `[e2e] Oficina sem ninguém ${sufixoUnico()}`;
    const eventoId = await semearOficinaNoDia(data, titulo);

    await fazerLogin(page);
    await abrirFolhaDoEvento(page, data, eventoId);
    const folha = page.getByTestId("folha-evento");
    await expect(folha.getByTestId("cancelar-data")).toBeVisible();

    await folha.getByTestId("cancelar-data").click();
    // Nada a perder: nenhuma confirmação, o toast já diz o que aconteceu.
    await expect(page.getByTestId("confirmar-cancelar-data")).toHaveCount(0);
    await expect(page.getByText(TOAST_CANCELADA_OFICINA)).toBeVisible();
    await expect(folha.getByTestId("desfazer-cancelamento")).toBeVisible();
    await expect(folha).toContainText("cancelada");

    // A linha continua no banco, carimbada.
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm ?? null).not.toBeNull();
    expect((await eventoNoBanco(eventoId))?.canceladoPor).not.toBeNull();

    // A data fica no lugar dela na semana, riscada, com a tag.
    await page.getByTestId("folha-evento-pronto").click();
    await expect(cartao(page, eventoId)).toContainText("cancelada");
    await expect(cartao(page, eventoId).getByText(titulo)).toHaveClass(/line-through/);

    // "Desfazer" do toast: a data volta.
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    await expect(page.getByText(TOAST_DATA_VOLTOU)).toBeVisible();
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm ?? null).toBeNull();
    await expect(cartao(page, eventoId)).not.toContainText("cancelada");
  });

  test("oficina com presença marcada: a confirmação diz o que se perde; desfazer não devolve a presença; cancelar de novo em duas abas não dá erro", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaReservado(1);
    const eventoId = await semearOficinaNoDia(data, `[e2e] Oficina com gente ${suf}`);
    const clienteId = await semearCliente({ nome: `[e2e] Pessoa ${suf}` });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 9000 });
    await marcarPresencaNoBanco(inscricaoId, "veio");

    await fazerLogin(page);
    await abrirFolhaDoEvento(page, data, eventoId);
    const folha = page.getByTestId("folha-evento");
    await expect(folha.getByTestId("inscrito")).toHaveCount(1);
    await folha.getByTestId("cancelar-data").click();

    const confirmacao = page.getByTestId("confirmar-cancelar-data");
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao).toContainText(
      tituloConfirmarCancelarData(diaDaSemanaPorExtenso(data), formatarDiaMes(data)),
    );
    await expect(confirmacao).toContainText(corpoConfirmarCancelarOficina(1, 1));
    await expect(confirmacao).toContainText("presença já marcada nesta data se perde");

    // "Manter a data" não grava nada.
    await page.getByTestId("confirmar-cancelar-data-nao").click();
    await expect(confirmacao).toHaveCount(0);
    expect((await eventoNoBanco(eventoId))?.canceladoEm).toBeNull();

    // Confirmar: a data é cancelada e a presença, limpa.
    await folha.getByTestId("cancelar-data").click();
    await page.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(page.getByText(TOAST_CANCELADA_OFICINA)).toBeVisible();
    await expect(confirmacao).toHaveCount(0);
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm ?? null).not.toBeNull();
    expect(await inscricaoNoBanco(inscricaoId)).toEqual({ presenca: null, direitoARepor: false });
    // Data cancelada: lista só de leitura.
    await expect(folha.getByTestId("presenca-veio")).toHaveCount(0);

    // "Desfazer cancelamento" devolve a data — sem a presença.
    await folha.getByTestId("desfazer-cancelamento").click();
    await expect(page.getByText(TOAST_DATA_VOLTOU)).toBeVisible();
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm ?? null).toBeNull();
    expect((await inscricaoNoBanco(inscricaoId))?.presenca).toBeNull();
    await expect(folha.getByTestId("cancelar-data")).toBeVisible();

    // Duas abas cancelam a mesma data, uma depois da outra: a segunda não dá erro (estado desejado).
    const outra = await page.context().newPage();
    await outra.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
    await expect(outra.getByTestId("folha-evento").getByTestId("cancelar-data")).toBeVisible();

    await folha.getByTestId("cancelar-data").click();
    await page.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(page.getByTestId("confirmar-cancelar-data")).toHaveCount(0);
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm ?? null).not.toBeNull();

    await outra.getByTestId("folha-evento").getByTestId("cancelar-data").click();
    await outra.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(outra.getByTestId("confirmar-cancelar-data")).toHaveCount(0);
    await expect(outra.getByTestId("confirmar-cancelar-data-erro")).toHaveCount(0);
    await expect(outra.getByTestId("cancelar-data-erro")).toHaveCount(0);
    await expect(outra.getByText(TOAST_CANCELADA_OFICINA)).toBeVisible();
    expect(await eventoNoBanco(eventoId)).not.toBeNull();
    await outra.close();
  });

  test("cancelar uma data de turma não mexe na data da semana anterior nem na da seguinte", async ({ page }) => {
    // Três semanas seguidas, o mesmo dia da semana; cancela-se a do meio.
    const primeira = diaReservado(2);
    const semanas = [primeira, somarDias(primeira, 7), somarDias(primeira, 14)];
    const { eventoIds } = await semearTurmaComDatas({
      nome: `[e2e] Turma ${sufixoUnico()}`,
      diaSemana: diaDaSemanaDe(semanas[0]),
      inicio: "19:00",
      fim: "21:00",
      vagas: 8,
      mensalidadeCentavos: 30000,
      diaVencimento: 10,
      datas: semanas,
    });
    const [idAnterior, idDoMeio, idSeguinte] = eventoIds;

    await fazerLogin(page);
    await abrirFolhaDoEvento(page, semanas[1], idDoMeio);
    await page.getByTestId("folha-evento").getByTestId("cancelar-data").click();
    await expect(page.getByText(TOAST_CANCELADA_TURMA)).toBeVisible();
    await expect.poll(async () => (await eventoNoBanco(idDoMeio))?.canceladoEm ?? null).not.toBeNull();

    expect((await eventoNoBanco(idAnterior))?.canceladoEm).toBeNull();
    expect((await eventoNoBanco(idSeguinte))?.canceladoEm).toBeNull();

    await page.getByTestId("folha-evento-pronto").click();
    await expect(cartao(page, idDoMeio)).toContainText("cancelada");
    await page.goto(`/gestao/agenda?semana=${semanas[0]}`);
    await expect(cartao(page, idAnterior)).not.toContainText("cancelada");
    await page.goto(`/gestao/agenda?semana=${semanas[2]}`);
    await expect(cartao(page, idSeguinte)).not.toContainText("cancelada");
  });

  test("dia fechado: “Tirar o bloqueio” pede confirmação e o remove; na outra aba, tirar de novo diz que já foi removido", async ({
    page,
  }) => {
    const data = diaReservado(3);
    const motivo = `[e2e] feriado ${sufixoUnico()}`;
    const fechadoId = await semearFechado({ data, motivo });

    await fazerLogin(page);
    const outra = await page.context().newPage();
    await outra.goto(`/gestao/agenda?semana=${data}&evento=${fechadoId}`);
    await expect(outra.getByTestId("folha-fechado")).toBeVisible();

    await abrirFolhaDoEvento(page, data, fechadoId);
    const folha = page.getByTestId("folha-fechado");
    await expect(folha).toContainText(motivo);
    await expect(folha).toContainText(`Fechado · ${diaDaSemanaPorExtenso(data)}, ${formatarDiaMes(data)} · o dia todo`);
    await expect(folha.getByTestId("folha-fechado-voltar")).toBeVisible();

    await folha.getByTestId("tirar-bloqueio").click();
    const confirmacao = page.getByTestId("confirmar-tirar-bloqueio");
    await expect(confirmacao).toContainText(tituloConfirmarTirarBloqueio(formatarDiaMes(data)));
    await page.getByTestId("confirmar-tirar-bloqueio-sim").click();
    await expect(page.getByText(toastBloqueioTirado(formatarDiaMes(data)))).toBeVisible();
    await expect(page.getByTestId("folha-fechado")).toHaveCount(0);
    await expect(cartao(page, fechadoId)).toHaveCount(0);
    await expect.poll(() => eventoNoBanco(fechadoId)).toBeNull();
    // Quem tirou não recebe o aviso de link velho.
    await expect(page.getByText("Esse lançamento não existe mais")).toHaveCount(0);

    // A outra aba ainda mostra a folha: tirar de novo é a frase humana, dentro do diálogo.
    await outra.getByTestId("folha-fechado").getByTestId("tirar-bloqueio").click();
    await outra.getByTestId("confirmar-tirar-bloqueio-sim").click();
    await expect(outra.getByTestId("confirmar-tirar-bloqueio-erro")).toHaveText(FRASE_JA_REMOVIDO);
    await expect(outra.getByTestId("confirmar-tirar-bloqueio")).toBeVisible();
    await outra.close();
  });
  test("WR-03 da revisão B: outro celular marca presença com a confirmação aberta — o “sim” não apaga mais do que ela disse; os números novos aparecem e só o segundo “sim” cancela", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaReservado(4);
    const eventoId = await semearOficinaNoDia(data, `[e2e] Oficina que muda ${suf}`);
    const primeira = await semearCliente({ nome: `[e2e] Primeira ${suf}` });
    const segunda = await semearCliente({ nome: `[e2e] Segunda ${suf}` });
    const daPrimeira = await semearInscricao({ eventoId, clienteId: primeira, tipo: "oficina", valorCentavos: 9000 });
    await marcarPresencaNoBanco(daPrimeira, "veio");

    await fazerLogin(page);
    await abrirFolhaDoEvento(page, data, eventoId);
    const folha = page.getByTestId("folha-evento");
    await folha.getByTestId("cancelar-data").click();
    const confirmacao = page.getByTestId("confirmar-cancelar-data");
    await expect(confirmacao).toContainText(corpoConfirmarCancelarOficina(1, 1));

    // Com o diálogo aberto, chega outra pessoa e é marcada em outro celular.
    const daSegunda = await semearInscricao({ eventoId, clienteId: segunda, tipo: "oficina", valorCentavos: 9000 });
    await marcarPresencaNoBanco(daSegunda, "veio");

    await page.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(page.getByTestId("confirmar-cancelar-data-mudou")).toHaveText(FRASE_PERDAS_DA_DATA_MUDARAM);
    await expect(confirmacao).toContainText(corpoConfirmarCancelarOficina(2, 2));
    expect((await eventoNoBanco(eventoId))?.canceladoEm).toBeNull();
    expect((await inscricaoNoBanco(daSegunda))?.presenca).toBe("veio");

    await page.getByTestId("confirmar-cancelar-data-sim").click();
    await expect(page.getByText(TOAST_CANCELADA_OFICINA).first()).toBeVisible();
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm ?? null).not.toBeNull();
    expect((await inscricaoNoBanco(daSegunda))?.presenca).toBeNull();
  });
});

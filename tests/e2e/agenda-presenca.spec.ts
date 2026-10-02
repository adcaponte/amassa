import { test, expect, type Page } from "@playwright/test";

import { valorDaAula } from "@/lib/agenda/mensalidade";
import { nomeDoMes } from "@/lib/agenda/semana";
import {
  complementoToastExperimentalCobrada,
  corpoTirarExperimentalGratuita,
  dicaSugestaoDaAula,
  faixaExperimental,
  FRASE_EXPERIMENTAL_SEM_ESCOLHA,
  FRASE_EXPERIMENTAL_VALOR,
  ROTULO_GRUPO_EXPERIMENTAL,
  TOAST_ENTROU_EXPERIMENTAL,
} from "@/lib/agenda/textos";
import { diaDaSemanaDe } from "@/lib/agenda/turma";
import { formatarReais } from "@/lib/financeiro/formato";

import {
  cancelarDataNoBanco,
  eventoNoBanco,
  inscricaoNoBanco,
  inscricoesDaPessoaNaData,
  saldoDeReposicaoNoBanco,
  semearCliente,
  semearInscricao,
  semearTurmaComDatas,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-08, Tarefa 3 (AGE-08, D-07, AGE-11, AGE-04): a presença de uma turma inteira é um toque por
// pessoa (o Valor central), a tag "marcar presença" pede o que falta, a aula experimental entra cobrada
// ou gratuita decidida na hora, a lista "Quem vem" tem uma ordem escrita, e cancelar enquanto outra aba
// marca termina coerente. Cada caso usa a PRÓPRIA turma e as PRÓPRIAS pessoas, com sufixo único, e só
// afirma o que é delas (desktop e celular rodam juntos). Nomes `[e2e]`, datas de Brasília.

const MENSALIDADE = 32000;

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

async function semearTurma(nome: string, datas: string[]) {
  return semearTurmaComDatas({
    nome,
    diaSemana: diaDaSemanaDe(datas[0]),
    inicio: "19:00",
    fim: "21:00",
    vagas: 8,
    mensalidadeCentavos: MENSALIDADE,
    diaVencimento: 10,
    datas,
  });
}

function cartao(page: Page, eventoId: string) {
  return page.locator(`[data-testid="agenda-cartao"][data-evento-id="${eventoId}"]`);
}

async function abrirFolha(page: Page, data: string, eventoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
  const folha = page.getByTestId("folha-evento");
  await expect(folha).toBeVisible();
  await expect(folha.getByTestId("quem-vem")).toBeVisible();
  return folha;
}

function campoDoSeletor(page: Page) {
  return page.getByTestId("folha-evento").getByRole("combobox", { name: "Colocar alguém" });
}

async function nomesDaLista(page: Page): Promise<string[]> {
  return page
    .getByTestId("folha-evento")
    .getByTestId("inscrito")
    .evaluateAll((linhas) => linhas.map((linha) => linha.querySelector("span")?.textContent ?? ""));
}

test.describe("agenda presenca", () => {
  test("(a) VALOR CENTRAL — a presença de uma turma de 6 em 8 toques: o cartão, um toque por pessoa, “Pronto”", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const ontem = somarDiasAoHoje(-1);
    const { eventoIds } = await semearTurma(`[e2e] Turma do valor central ${suf}`, [ontem]);
    const inscricoes: string[] = [];
    for (let indice = 1; indice <= 6; indice += 1) {
      const clienteId = await semearCliente({ nome: `[e2e] Aluno ${indice} ${suf}` });
      inscricoes.push(await semearInscricao({ eventoId: eventoIds[0], clienteId, tipo: "aluno" }));
    }
    // Faltou para o 2 e o 5; Veio para os outros.
    const desejadas = ["veio", "faltou", "veio", "veio", "faltou", "veio"] as const;

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${ontem}`);
    const oCartao = cartao(page, eventoIds[0]);
    await expect(oCartao.getByTestId("tag-marcar-presenca")).toBeVisible();

    let toques = 0;
    await oCartao.click();
    toques += 1;
    const folha = page.getByTestId("folha-evento");
    await expect(folha.getByTestId("inscrito")).toHaveCount(6);
    await expect(folha.getByTestId("tag-marcar-presenca")).toBeVisible();

    const inicio = Date.now();
    for (const [indice, inscricaoId] of inscricoes.entries()) {
      // Um toque por pessoa, sem esperar a gravação da anterior.
      await folha
        .locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`)
        .getByTestId(desejadas[indice] === "veio" ? "presenca-veio" : "presenca-faltou")
        .click();
      toques += 1;
    }
    const duracaoMs = Date.now() - inicio;
    await folha.getByTestId("folha-evento-pronto").click();
    toques += 1;
    await expect(folha).toBeHidden();

    expect(toques).toBe(8);
    for (const [indice, inscricaoId] of inscricoes.entries()) {
      await expect.poll(() => inscricaoNoBanco(inscricaoId)).toEqual({ presenca: desejadas[indice], direitoARepor: false });
    }
    // Ninguém ficou sem marcação: a tag some do cartão.
    await expect(oCartao.getByTestId("tag-marcar-presenca")).toHaveCount(0);

    const projeto = test.info().project.name;
    test.info().annotations.push({
      type: "valor-central",
      description: `${projeto}: ${toques} toques; ${duracaoMs} ms do primeiro ao último toque de presença`,
    });
    console.log(`[valor-central] ${projeto}: ${toques} toques; ${duracaoMs} ms do primeiro ao último toque de presença`);
  });

  test("(b) data passada com alguém sem marcação pede “marcar presença”; cancelada e hoje não pedem", async ({ page }) => {
    const suf = sufixoUnico();
    const passada = somarDiasAoHoje(-2);
    const cancelada = somarDiasAoHoje(-3);
    const hoje = somarDiasAoHoje(0);
    const clienteId = await semearCliente({ nome: `[e2e] Pendente ${suf}` });
    const { eventoIds } = await semearTurma(`[e2e] Turma pendente ${suf}`, [passada, cancelada, hoje]);
    for (const eventoId of eventoIds) {
      await semearInscricao({ eventoId, clienteId, tipo: "aluno" });
    }
    await cancelarDataNoBanco(eventoIds[1]);

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${passada}`);
    await expect(cartao(page, eventoIds[0]).getByTestId("tag-marcar-presenca")).toBeVisible();
    await page.goto(`/gestao/agenda?semana=${cancelada}`);
    await expect(cartao(page, eventoIds[1])).toBeVisible();
    await expect(cartao(page, eventoIds[1]).getByTestId("tag-marcar-presenca")).toHaveCount(0);
    await page.goto(`/gestao/agenda?semana=${hoje}`);
    await expect(cartao(page, eventoIds[2])).toBeVisible();
    await expect(cartao(page, eventoIds[2]).getByTestId("tag-marcar-presenca")).toHaveCount(0);

    // A folha da data passada diz o mesmo no sub-título; a cancelada não oferece "Colocar alguém".
    const folha = await abrirFolha(page, passada, eventoIds[0]);
    await expect(folha.getByTestId("tag-marcar-presenca")).toBeVisible();
    const folhaCancelada = await abrirFolha(page, cancelada, eventoIds[1]);
    await expect(folhaCancelada.getByTestId("colocar-alguem")).toHaveCount(0);
    await expect(folhaCancelada.getByTestId("tag-marcar-presenca")).toHaveCount(0);
  });

  test("(c) experimental: “Cobrar · Gratuita” sem nada marcado; “Cobrar” sugere o valor de uma aula, editável; “Gratuita” grava sem cobrar", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // Quatro datas num mês inteiro, bem no futuro (longe dos dias que as outras specs contam): a
    // sugestão é a mensalidade ÷ 4.
    const mes = somarDiasAoHoje(800).slice(0, 7);
    const datas = ["02", "09", "16", "23"].map((dia) => `${mes}-${dia}`);
    const alvo = datas[1];
    const { eventoIds } = await semearTurma(`[e2e] Turma experimental ${suf}`, datas);
    const eventoId = eventoIds[1];
    const cobrada = `[e2e] Clara Experimenta ${suf}`;
    const gratis = `[e2e] Gil De Graça ${suf}`;
    const cobradaId = await semearCliente({ nome: cobrada });
    const gratisId = await semearCliente({ nome: gratis });
    const sugerido = valorDaAula(MENSALIDADE, 4) ?? 0;

    await fazerLogin(page);
    const folha = await abrirFolha(page, alvo, eventoId);
    await campoDoSeletor(page).fill(`clara experimenta ${suf}`);
    const grupo = folha.getByTestId("grupo-do-contexto");
    await expect(grupo).toHaveAttribute("aria-label", ROTULO_GRUPO_EXPERIMENTAL);
    await grupo.getByTestId("seletor-opcao").filter({ hasText: cobrada }).click();

    await expect(folha.getByTestId("faixa-colocar")).toHaveText(faixaExperimental(cobrada));
    const segmentado = folha.getByRole("radiogroup", { name: "Esta aula é cobrada?" });
    await expect(segmentado.getByTestId("escolha-cobrar")).toHaveAttribute("aria-checked", "false");
    await expect(segmentado.getByTestId("escolha-gratuita")).toHaveAttribute("aria-checked", "false");
    await expect(folha.getByTestId("colocar-na-lista")).toBeDisabled();
    await expect(folha.getByTestId("escolha-sem-escolha")).toHaveText(FRASE_EXPERIMENTAL_SEM_ESCOLHA);

    await segmentado.getByTestId("escolha-cobrar").click();
    await expect(segmentado.getByTestId("escolha-cobrar")).toHaveAttribute("aria-checked", "true");
    const valor = folha.getByTestId("valor-da-aula");
    await expect(valor).toHaveValue(`${Math.floor(sugerido / 100)},${String(sugerido % 100).padStart(2, "0")}`);
    await expect(folha.getByTestId("valor-da-aula-dica")).toHaveText(
      dicaSugestaoDaAula(formatarReais(MENSALIDADE), 4, nomeDoMes(mes)),
    );
    await expect(folha.getByTestId("colocar-na-lista")).toBeEnabled();

    // Vazio é recusado embaixo do campo, sem gravar.
    await valor.fill("");
    await folha.getByTestId("colocar-na-lista").click();
    await expect(folha.getByTestId("valor-da-aula-erro")).toHaveText(FRASE_EXPERIMENTAL_VALOR);
    expect(await inscricoesDaPessoaNaData(eventoId, cobradaId)).toEqual([]);

    await valor.fill("40");
    await folha.getByTestId("colocar-na-lista").click();
    await expect(
      page.getByText(TOAST_ENTROU_EXPERIMENTAL + complementoToastExperimentalCobrada(formatarReais(4000))).first(),
    ).toBeVisible();
    await expect
      .poll(() => inscricoesDaPessoaNaData(eventoId, cobradaId))
      .toEqual([expect.objectContaining({ tipo: "experimental", cobrar: true, valorCentavos: 4000 })]);
    const linhaCobrada = folha.getByTestId("inscrito").filter({ hasText: cobrada });
    await expect(linhaCobrada.getByTestId("tag-experimental")).toBeVisible();
    await expect(linhaCobrada.getByTestId("tag-gratuita")).toHaveCount(0);

    // Outra pessoa, "Gratuita".
    await campoDoSeletor(page).fill(`gil de graca ${suf}`);
    await folha.getByTestId("seletor-opcao").filter({ hasText: gratis }).click();
    await folha.getByRole("radiogroup", { name: "Esta aula é cobrada?" }).getByTestId("escolha-gratuita").click();
    await expect(folha.getByTestId("valor-da-aula")).toHaveCount(0);
    await folha.getByTestId("colocar-na-lista").click();
    await expect(page.getByText(TOAST_ENTROU_EXPERIMENTAL, { exact: true }).first()).toBeVisible();
    await expect
      .poll(() => inscricoesDaPessoaNaData(eventoId, gratisId))
      .toEqual([expect.objectContaining({ tipo: "experimental", cobrar: false, valorCentavos: null })]);
    const linhaGratis = folha.getByTestId("inscrito").filter({ hasText: gratis });
    await expect(linhaGratis.getByTestId("tag-gratuita")).toBeVisible();

    // Tirar a gratuita: "{nome} sai só desta data."
    await linhaGratis.getByTestId("tirar-da-lista").click();
    const confirmacao = page.getByTestId("confirmar-tirar-da-lista");
    await expect(confirmacao.getByTestId("confirmar-tirar-da-lista-corpo")).toHaveText(corpoTirarExperimentalGratuita(gratis));
    await confirmacao.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect.poll(() => inscricoesDaPessoaNaData(eventoId, gratisId)).toEqual([]);
  });

  test("(d) a lista “Quem vem” é alunos, reposição, experimental — por nome, sem diferença de acento — e não muda ao recarregar", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = somarDiasAoHoje(760);
    const { eventoIds } = await semearTurma(`[e2e] Turma em ordem ${suf}`, [data]);
    const eventoId = eventoIds[0];
    const alunos = ["Zé", "ana", "Élio", "Eduardo", "Bruno", "Carla"].map((nome) => `[e2e] ${nome} ${suf}`);
    for (const nome of alunos) {
      await semearInscricao({ eventoId, clienteId: await semearCliente({ nome }), tipo: "aluno" });
    }
    const reposicao = `[e2e] Aaron ${suf}`;
    const experimental = `[e2e] Abel ${suf}`;
    await semearInscricao({ eventoId, clienteId: await semearCliente({ nome: reposicao }), tipo: "reposicao" });
    await semearInscricao({
      eventoId,
      clienteId: await semearCliente({ nome: experimental }),
      tipo: "experimental",
      cobrar: false,
    });
    const esperado = [
      ...["ana", "Bruno", "Carla", "Eduardo", "Élio", "Zé"].map((nome) => `[e2e] ${nome} ${suf}`),
      reposicao,
      experimental,
    ];

    await fazerLogin(page);
    await abrirFolha(page, data, eventoId);
    await expect(page.getByTestId("folha-evento").getByTestId("inscrito")).toHaveCount(8);
    expect(await nomesDaLista(page)).toEqual(esperado);
    for (let vez = 0; vez < 2; vez += 1) {
      await page.reload();
      await expect(page.getByTestId("folha-evento").getByTestId("inscrito")).toHaveCount(8);
      expect(await nomesDaLista(page)).toEqual(esperado);
    }
  });

  test("(e) cancelar a data enquanto outra aba marca “Faltou”: no fim, nenhuma falta e nenhuma aula a repor", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const ontem = somarDiasAoHoje(-1);
    const clienteId = await semearCliente({ nome: `[e2e] Corrida Cancelar ${suf}` });
    const { eventoIds } = await semearTurma(`[e2e] Turma da corrida ${suf}`, [ontem]);
    const eventoId = eventoIds[0];
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "aluno" });

    await fazerLogin(page);
    const outra = await page.context().newPage();
    const folhaQueMarca = await abrirFolha(page, ontem, eventoId);
    const folhaQueCancela = await abrirFolha(outra, ontem, eventoId);

    await Promise.all([
      folhaQueMarca
        .locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`)
        .getByTestId("presenca-faltou")
        .click(),
      folhaQueCancela.getByTestId("cancelar-data").click(),
    ]);

    // Se a falta chegou antes, o cancelamento pede confirmação (uma presença se perde) — e confirma.
    const confirmacao = outra.getByTestId("confirmar-cancelar-data");
    await expect
      .poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm !== null || (await confirmacao.isVisible()))
      .toBe(true);
    if (await confirmacao.isVisible()) {
      await confirmacao.getByTestId("confirmar-cancelar-data-sim").click();
    }
    await expect.poll(async () => (await eventoNoBanco(eventoId))?.canceladoEm !== null).toBe(true);
    await expect.poll(() => inscricaoNoBanco(inscricaoId)).toEqual({ presenca: null, direitoARepor: false });
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(0);
    await outra.close();
  });
});

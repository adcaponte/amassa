import { test, expect, type Page } from "@playwright/test";

import {
  corpoTirarReposicao,
  faixaReposicao,
  fraseSemAulaARepor,
  ROTULO_GRUPO_A_REPOR,
  TOAST_ENTROU_COMO_REPOSICAO,
  tagARepor,
  toastSaiuDaLista,
  COMPLEMENTO_TOAST_REPOSICAO_VOLTOU,
} from "@/lib/agenda/textos";
import { diaDaSemanaDe } from "@/lib/agenda/turma";

import {
  cancelarDataNoBanco,
  inscricaoNoBanco,
  inscricoesDaPessoaNaData,
  marcarFaltaComDireitoNoBanco,
  saldoDeReposicaoNoBanco,
  semearCliente,
  semearInscricao,
  semearOficina,
  semearTurmaComDatas,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-08, Tarefa 2 (AGE-09, AGE-10, AGE-04): a falta com direito a repor vira UMA aula a repor —
// uma conta sobre as linhas, nunca um contador —, que aparece primeiro ao colocar alguém numa data, é
// usada uma vez só (nem com dois celulares) e volta quando a reposição é desfeita. Cada caso usa a
// PRÓPRIA pessoa e a PRÓPRIA turma ou oficina, com sufixo único, e só afirma o que é delas — o saldo é
// sempre o daquela pessoa, nunca uma condição global do banco. Nomes `[e2e]`, datas de Brasília.

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

// Dias futuros 700+ — longe dos que as outras specs da Agenda reservam e CONTAM (300+, 330+, 360+, 500+
// e os dias 10 a 13 de `agenda vistas`). Um par por caso, um dia por projeto.
function diaReservado(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(700 + caso * 2 + projeto);
}

async function semearTurma(nome: string, datas: string[]) {
  return semearTurmaComDatas({
    nome,
    diaSemana: diaDaSemanaDe(datas[0]),
    inicio: "19:00",
    fim: "21:00",
    vagas: 8,
    mensalidadeCentavos: 32000,
    diaVencimento: 10,
    datas,
  });
}

// Uma pessoa com UMA aula a repor: falta com direito numa data passada de uma turma dela.
async function semearPessoaComUmaAulaARepor(suf: string, nome: string) {
  const clienteId = await semearCliente({ nome });
  const { eventoIds } = await semearTurma(`[e2e] Turma da falta ${suf}`, [somarDiasAoHoje(-7)]);
  const inscricaoId = await semearInscricao({ eventoId: eventoIds[0], clienteId, tipo: "aluno" });
  await marcarFaltaComDireitoNoBanco(inscricaoId);
  expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(1);
  return { clienteId, eventoDaFalta: eventoIds[0] };
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

async function abrirFicha(page: Page, clienteId: string) {
  await page.goto(`/gestao/agenda?aba=pessoas&pessoa=${clienteId}`);
  const ficha = page.getByTestId("ficha-pessoa");
  await expect(ficha.getByTestId("quadro-a-repor")).toBeVisible();
  return ficha;
}

test.describe("agenda reposicao", () => {
  test("(a) “Faltou” + “tem direito a repor” vira 1 aula a repor na ficha e em Pessoas; trocar para “Veio” tira o direito", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Aluna Faltou ${suf}`;
    const ontem = somarDiasAoHoje(-1);
    const clienteId = await semearCliente({ nome });
    const { eventoIds } = await semearTurma(`[e2e] Turma de ontem ${suf}`, [ontem]);
    const inscricaoId = await semearInscricao({ eventoId: eventoIds[0], clienteId, tipo: "aluno" });

    await fazerLogin(page);
    const folha = await abrirFolha(page, ontem, eventoIds[0]);
    const linha = folha.locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
    // Sem falta, sem caixa.
    await expect(linha.getByTestId("direito-a-repor")).toHaveCount(0);

    await linha.getByTestId("presenca-faltou").click();
    const caixa = linha.getByTestId("direito-a-repor");
    await expect(caixa).toBeVisible();
    await expect(caixa).not.toBeChecked();
    await expect.poll(() => inscricaoNoBanco(inscricaoId)).toEqual({ presenca: "faltou", direitoARepor: false });

    await caixa.click();
    await expect(caixa).toBeChecked();
    await expect.poll(() => inscricaoNoBanco(inscricaoId)).toEqual({ presenca: "faltou", direitoARepor: true });
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(1);

    // A ficha: o quadro "A REPOR 1 aula" e, nas últimas vindas, "faltou" + "repõe".
    const ficha = await abrirFicha(page, clienteId);
    await expect(ficha.getByTestId("quadro-a-repor-numero")).toHaveText("1");
    await expect(ficha.getByTestId("quadro-a-repor")).toContainText("aula");
    await expect(ficha.getByTestId("quadro-a-repor")).not.toContainText("aulas");
    await expect(ficha.getByTestId("ficha-vinda").filter({ hasText: "faltou" }).getByTestId("tag-repoe")).toHaveCount(1);

    // A lista de Pessoas: a tag âmbar "1 a repor".
    await page.goto(`/gestao/agenda?aba=pessoas&busca=${encodeURIComponent(suf)}`);
    const linhaDaPessoa = page.locator(`[data-testid="pessoa-linha"][data-cliente-id="${clienteId}"]`);
    await expect(linhaDaPessoa.getByTestId("pessoa-a-repor")).toHaveText(tagARepor(1));

    // "Veio" no lugar de "Faltou": a caixa some e o direito sai do banco na mesma instrução.
    const folhaDeNovo = await abrirFolha(page, ontem, eventoIds[0]);
    const linhaDeNovo = folhaDeNovo.locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
    await expect(linhaDeNovo.getByTestId("direito-a-repor")).toBeChecked();
    await linhaDeNovo.getByTestId("presenca-veio").click();
    await expect(linhaDeNovo.getByTestId("direito-a-repor")).toHaveCount(0);
    await expect.poll(() => inscricaoNoBanco(inscricaoId)).toEqual({ presenca: "veio", direitoARepor: false });
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(0);

    const fichaZerada = await abrirFicha(page, clienteId);
    await expect(fichaZerada.getByTestId("quadro-a-repor-numero")).toHaveText("0");
    await expect(fichaZerada.getByTestId("quadro-a-repor")).toContainText("aulas");
  });

  test("(b) com 1 aula a repor, o seletor mostra “Tem aula a repor” primeiro; colocar usa a aula; tirar a devolve", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Ana Repõe ${suf}`;
    const outra = `[e2e] Bia Sem Crédito ${suf}`;
    const { clienteId } = await semearPessoaComUmaAulaARepor(suf, nome);
    await semearCliente({ nome: outra });
    const futura = diaReservado(0);
    const { eventoIds } = await semearTurma(`[e2e] Turma da reposição ${suf}`, [futura]);
    const dataDaOficina = diaReservado(1);
    const oficinaId = await semearOficina({
      titulo: `[e2e] Oficina sem crédito ${suf}`,
      data: dataDaOficina,
      inicio: "14:00",
      fim: "16:00",
      vagas: 6,
      precoCentavos: 9000,
    });

    await fazerLogin(page);
    const folha = await abrirFolha(page, futura, eventoIds[0]);
    await campoDoSeletor(page).fill(suf);
    const grupos = folha.getByRole("listbox").getByRole("group");
    await expect(grupos).toHaveCount(2);
    await expect(grupos.first()).toHaveAttribute("aria-label", ROTULO_GRUPO_A_REPOR);
    const grupoARepor = folha.getByTestId("grupo-a-repor");
    const opcao = grupoARepor.getByTestId("seletor-opcao").filter({ hasText: nome });
    await expect(opcao).toHaveCount(1);
    await expect(opcao).toContainText(`${nome} — reposição · ${tagARepor(1)}`);
    // Quem não tem aula a repor fica só no grupo do contexto.
    await expect(grupoARepor.getByTestId("seletor-opcao").filter({ hasText: outra })).toHaveCount(0);
    await expect(folha.getByTestId("grupo-do-contexto").getByTestId("seletor-opcao").filter({ hasText: outra })).toHaveCount(1);

    await opcao.click();
    await expect(folha.getByTestId("faixa-colocar")).toHaveText(faixaReposicao(nome, 1));
    await folha.getByTestId("colocar-na-lista").click();
    await expect(page.getByText(TOAST_ENTROU_COMO_REPOSICAO).first()).toBeVisible();

    const linha = folha.getByTestId("inscrito").filter({ hasText: nome });
    await expect(linha.getByTestId("tag-reposicao")).toBeVisible();
    await expect
      .poll(() => inscricoesDaPessoaNaData(eventoIds[0], clienteId))
      .toEqual([expect.objectContaining({ tipo: "reposicao", cobrar: false, valorCentavos: null })]);
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(0);
    // Reposição não tem caixa de direito a repor, nem com falta.
    await linha.getByTestId("presenca-faltou").click();
    await expect
      .poll(() => inscricoesDaPessoaNaData(eventoIds[0], clienteId))
      .toEqual([expect.objectContaining({ tipo: "reposicao", presenca: "faltou" })]);
    await expect(linha.getByTestId("direito-a-repor")).toHaveCount(0);

    // Sem crédito, ela não aparece em "Tem aula a repor" de outra data — o grupo some (AGE-10 · empty).
    const folhaDaOficina = await abrirFolha(page, dataDaOficina, oficinaId);
    await campoDoSeletor(page).fill(suf);
    await expect(folhaDaOficina.getByTestId("seletor-opcao").filter({ hasText: nome })).toHaveCount(1);
    await expect(folhaDaOficina.getByTestId("grupo-a-repor")).toHaveCount(0);

    // Tirar a reposição: a confirmação diz que a aula volta, e volta.
    const folhaDeNovo = await abrirFolha(page, futura, eventoIds[0]);
    const linhaDeNovo = folhaDeNovo.getByTestId("inscrito").filter({ hasText: nome });
    await linhaDeNovo.getByTestId("tirar-da-lista").click();
    const confirmacao = page.getByTestId("confirmar-tirar-da-lista");
    await expect(confirmacao.getByTestId("confirmar-tirar-da-lista-corpo")).toHaveText(corpoTirarReposicao(nome, 1));
    await confirmacao.getByTestId("confirmar-tirar-da-lista-sim").click();
    await expect(page.getByText(toastSaiuDaLista(nome) + COMPLEMENTO_TOAST_REPOSICAO_VOLTOU).first()).toBeVisible();
    await expect.poll(() => inscricoesDaPessoaNaData(eventoIds[0], clienteId)).toEqual([]);
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(1);
  });

  test("(c) dois celulares usando a última aula a repor em datas diferentes: só uma reposição é aceita", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Caio Corrida ${suf}`;
    const { clienteId } = await semearPessoaComUmaAulaARepor(suf, nome);
    const datas = [diaReservado(2), diaReservado(3)];
    const { eventoIds } = await semearTurma(`[e2e] Turma da corrida ${suf}`, datas);

    await fazerLogin(page);
    const outra = await page.context().newPage();
    const folhas = [await abrirFolha(page, datas[0], eventoIds[0]), await abrirFolha(outra, datas[1], eventoIds[1])];
    for (const [indice, aba] of [page, outra].entries()) {
      await campoDoSeletor(aba).fill(suf);
      const opcao = folhas[indice].getByTestId("grupo-a-repor").getByTestId("seletor-opcao").filter({ hasText: nome });
      await expect(opcao).toContainText(tagARepor(1));
      await opcao.click();
      await expect(folhas[indice].getByTestId("faixa-colocar")).toHaveText(faixaReposicao(nome, 1));
    }

    await Promise.all(folhas.map((folha) => folha.getByTestId("colocar-na-lista").click()));

    // Uma das duas recebe a frase humana; a outra entrou.
    const recusa = fraseSemAulaARepor(nome);
    await expect
      .poll(async () => {
        const erros = await Promise.all(
          folhas.map(async (folha) =>
            (await folha.getByTestId("colocar-erro").count()) > 0 ? await folha.getByTestId("colocar-erro").innerText() : null,
          ),
        );
        return erros.filter((erro) => erro !== null);
      })
      .toEqual([recusa]);
    const inscricoes = [
      ...(await inscricoesDaPessoaNaData(eventoIds[0], clienteId)),
      ...(await inscricoesDaPessoaNaData(eventoIds[1], clienteId)),
    ];
    expect(inscricoes).toHaveLength(1);
    expect(inscricoes[0].tipo).toBe("reposicao");
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(0);
    await outra.close();
  });

  test("(d) cancelar a data da falta com direito tira a aula a repor — data cancelada não conta", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Davi Cancelada ${suf}`;
    const { clienteId, eventoDaFalta } = await semearPessoaComUmaAulaARepor(suf, nome);

    await fazerLogin(page);
    const ficha = await abrirFicha(page, clienteId);
    await expect(ficha.getByTestId("quadro-a-repor-numero")).toHaveText("1");

    await cancelarDataNoBanco(eventoDaFalta);
    expect(await saldoDeReposicaoNoBanco(clienteId)).toBe(0);
    const fichaDepois = await abrirFicha(page, clienteId);
    await expect(fichaDepois.getByTestId("quadro-a-repor-numero")).toHaveText("0");
    await page.goto(`/gestao/agenda?aba=pessoas&busca=${encodeURIComponent(suf)}`);
    await expect(
      page.locator(`[data-testid="pessoa-linha"][data-cliente-id="${clienteId}"]`).getByTestId("pessoa-a-repor"),
    ).toHaveCount(0);
  });

  test("(e) falta em oficina avulsa não oferece “tem direito a repor”", async ({ page }) => {
    const suf = sufixoUnico();
    const ontem = somarDiasAoHoje(-1);
    const clienteId = await semearCliente({ nome: `[e2e] Eva Oficina ${suf}` });
    const oficinaId = await semearOficina({
      titulo: `[e2e] Oficina de ontem ${suf}`,
      data: ontem,
      inicio: "14:00",
      fim: "16:00",
      vagas: 6,
      precoCentavos: 9000,
    });
    const inscricaoId = await semearInscricao({ eventoId: oficinaId, clienteId, tipo: "oficina", valorCentavos: 9000 });

    await fazerLogin(page);
    const folha = await abrirFolha(page, ontem, oficinaId);
    const linha = folha.locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
    await linha.getByTestId("presenca-faltou").click();
    await expect.poll(() => inscricaoNoBanco(inscricaoId)).toEqual({ presenca: "faltou", direitoARepor: false });
    await expect(linha.getByTestId("direito-a-repor")).toHaveCount(0);
  });
});

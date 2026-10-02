import { test, expect, type Page } from "@playwright/test";

import { descricaoDaLinha } from "@/lib/agenda/receber";
import {
  FRASE_MOTIVO_DISPENSA_LONGO,
  linhaDispensada,
  subLinhaDispensada,
  TOAST_DISPENSA_DESFEITA,
  TOAST_DISPENSADA,
  tituloConfirmarDispensar,
} from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  dispensaNoBanco,
  ligarVendaCanceladaAMensalidade,
  nomeDoGestorDeTeste,
  semearCliente,
  semearInscricao,
  semearMensalidade,
  semearOficina,
  semearTurmaComDatas,
  semearUsoLivreEncerrado,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-13, Tarefa 1 (D-09, UI-D15): “Dispensar a cobrança” tira a mensalidade ou a inscrição de “A
// receber” sem virar venda — com motivo opcional, quem e quando —, NUNCA apaga a linha, e se desfaz pela
// sanfona “Dispensadas” ou pelo “Desfazer” do toast. O uso livre não se dispensa. A dispensada não entra
// no lote nem no total. Nenhum caso afirma estado global: cada um acha a PRÓPRIA linha pelo `data-id`; o
// total é conferido contra a soma das linhas da mesma tela. Nomes `[e2e]` com sufixo único, dias 1300+.

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
  return somarDiasAoHoje(1300 + caso * 2 + projeto);
}

function linhaAReceber(
  page: Page,
  tipo: "mensalidade" | "inscricao" | "uso_livre",
  id: string,
) {
  return page.locator(
    `[data-testid="a-receber-linha"][data-tipo="${tipo}"][data-id="${id}"]`,
  );
}

function linhaDispensadaNaTela(page: Page, id: string) {
  return page.locator(`[data-testid="dispensada-linha"][data-id="${id}"]`);
}

async function abrirAReceber(page: Page) {
  await page.goto("/gestao/agenda?aba=receber");
  await expect(page.getByTestId("a-receber")).toBeVisible();
}

// Abre a sanfona “Dispensadas” (fechada por padrão) — só se ainda não estiver aberta.
async function abrirDispensadas(page: Page) {
  const sanfona = page.getByTestId("dispensadas");
  await expect(sanfona).toBeVisible();
  await expect(page.getByTestId("dispensadas-resumo")).toHaveText(
    /^Dispensadas \(\d+\)$/,
  );
  if ((await sanfona.getAttribute("open")) === null) {
    await page.getByTestId("dispensadas-resumo").click();
  }
}

// Uma turma, uma pessoa e a mensalidade dela num mês longe (o lote dos outros casos nunca a alcança).
async function semearMensalidadeDoCaso(suf: string, caso: number, valorCentavos = 32000) {
  const nome = `[e2e] Aluna ${suf}`;
  const turma = `[e2e] Turma ${suf}`;
  const clienteId = await semearCliente({ nome });
  const { turmaId } = await semearTurmaComDatas({
    nome: turma,
    diaSemana: 2,
    inicio: "19:00",
    fim: "21:00",
    vagas: 6,
    mensalidadeCentavos: valorCentavos,
    diaVencimento: 10,
    datas: [],
  });
  const mes = `${diaDoCaso(caso).slice(0, 7)}-01`;
  const mensalidadeId = await semearMensalidade({
    turmaId,
    clienteId,
    mes,
    valorCentavos,
    vencimento: `${mes.slice(0, 7)}-10`,
  });
  return { nome, turma, mes, clienteId, mensalidadeId };
}

// “R$ 1.234,56” → 123456.
function centavosDoTexto(texto: string): number {
  const numero = texto.replace(/[^\d,]/g, "").replace(",", ".");
  return Math.round(Number(numero) * 100);
}

async function dispensarPelaTela(
  page: Page,
  tipo: "mensalidade" | "inscricao",
  id: string,
  motivo: string | null,
) {
  await linhaAReceber(page, tipo, id).getByTestId("dispensar").click();
  const confirmacao = page.getByTestId("confirmar-dispensar");
  await expect(confirmacao).toBeVisible();
  if (motivo !== null) {
    await confirmacao.getByTestId("motivo-dispensa").fill(motivo);
  }
  await confirmacao.getByTestId("confirmar-dispensar-sim").click();
  await expect(confirmacao).toBeHidden();
}

test.describe("agenda dispensar", () => {
  test("(a) mensalidade: “Dispensar a cobrança” → motivo → sai de “A receber”, entra em “Dispensadas” com quem, quando e o motivo; a linha continua no banco", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { nome, turma, mes, mensalidadeId } = await semearMensalidadeDoCaso(suf, 1);
    const gestor = await nomeDoGestorDeTeste();

    await fazerLogin(page);
    await abrirAReceber(page);
    const linha = linhaAReceber(page, "mensalidade", mensalidadeId);
    await expect(linha.getByTestId("dispensar")).toHaveText("Dispensar a cobrança");

    await linha.getByTestId("dispensar").click();
    const confirmacao = page.getByTestId("confirmar-dispensar");
    await expect(
      confirmacao.getByRole("heading", {
        name: tituloConfirmarDispensar("mensalidade", nome),
      }),
    ).toBeVisible();
    await expect(confirmacao.getByLabel("Motivo (opcional)")).toHaveAttribute(
      "placeholder",
      "ex.: bolsa, saiu da turma no começo do mês",
    );
    await expect(confirmacao.getByTestId("confirmar-dispensar-nao")).toHaveText("Voltar");
    await confirmacao.getByTestId("motivo-dispensa").fill("[e2e] bolsa");
    await confirmacao.getByTestId("confirmar-dispensar-sim").click();

    await expect(page.getByText(TOAST_DISPENSADA)).toBeVisible();
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toHaveCount(0);

    await abrirDispensadas(page);
    const dispensada = linhaDispensadaNaTela(page, mensalidadeId);
    const descricao = descricaoDaLinha({ tipo: "mensalidade", turma, mes });
    await expect(dispensada.getByTestId("dispensada-titulo")).toHaveText(
      linhaDispensada(nome, descricao),
    );
    await expect(dispensada.getByTestId("dispensada-sub")).toHaveText(
      subLinhaDispensada(gestor, formatarDiaMes(hojeNoAtelie()), "[e2e] bolsa"),
    );
    await expect(
      dispensada.getByRole("button", {
        name: `Desfazer a dispensa de ${descricao} de ${nome}`,
      }),
    ).toBeVisible();

    // D-09: nada foi apagado — a linha da mensalidade continua, com os três campos.
    expect(await dispensaNoBanco("mensalidade", mensalidadeId)).toEqual({
      existe: true,
      dispensada: true,
      dispensadaPorNome: gestor,
      motivo: "[e2e] bolsa",
    });
  });

  test("(b) desfazer: pelo toast (dois toques = um desfazer) e pela sanfona “Dispensadas” — volta para “A receber”; sem motivo, a sub-linha termina na data", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { mensalidadeId } = await semearMensalidadeDoCaso(suf, 2);
    const gestor = await nomeDoGestorDeTeste();

    await fazerLogin(page);
    await abrirAReceber(page);

    // Pelo toast: dois toques rápidos no “Desfazer” — um desfazer só.
    await dispensarPelaTela(page, "mensalidade", mensalidadeId, null);
    await expect(page.getByText(TOAST_DISPENSADA)).toBeVisible();
    await page.getByRole("button", { name: "Desfazer", exact: true }).dblclick();
    await expect(page.getByText(TOAST_DISPENSA_DESFEITA)).toBeVisible();
    await expect(page.getByText(TOAST_DISPENSA_DESFEITA)).toHaveCount(1);
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toBeVisible();
    expect(await dispensaNoBanco("mensalidade", mensalidadeId)).toMatchObject({
      existe: true,
      dispensada: false,
      motivo: null,
    });

    // Pela sanfona, sem motivo (UI E17·partial: a sub-linha termina na data).
    await dispensarPelaTela(page, "mensalidade", mensalidadeId, null);
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toHaveCount(0);
    await abrirDispensadas(page);
    const dispensada = linhaDispensadaNaTela(page, mensalidadeId);
    await expect(dispensada.getByTestId("dispensada-sub")).toHaveText(
      subLinhaDispensada(gestor, formatarDiaMes(hojeNoAtelie()), null),
    );
    await dispensada.getByTestId("desfazer-dispensa").click();
    await expect(page.getByText(TOAST_DISPENSA_DESFEITA).first()).toBeVisible();
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toBeVisible();
    await expect(linhaDispensadaNaTela(page, mensalidadeId)).toHaveCount(0);
    expect(await dispensaNoBanco("mensalidade", mensalidadeId)).toEqual({
      existe: true,
      dispensada: false,
      dispensadaPorNome: null,
      motivo: null,
    });
  });

  test("(c) motivo com 201 caracteres: a frase embaixo do campo e nada gravado; com 200, dispensa", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { mensalidadeId } = await semearMensalidadeDoCaso(suf, 3);

    await fazerLogin(page);
    await abrirAReceber(page);
    await linhaAReceber(page, "mensalidade", mensalidadeId)
      .getByTestId("dispensar")
      .click();
    const confirmacao = page.getByTestId("confirmar-dispensar");
    const campo = confirmacao.getByTestId("motivo-dispensa");
    await campo.fill("m".repeat(201));
    await confirmacao.getByTestId("confirmar-dispensar-sim").click();

    await expect(confirmacao.getByTestId("motivo-dispensa-erro")).toHaveText(
      FRASE_MOTIVO_DISPENSA_LONGO,
    );
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toBeFocused();
    await expect(confirmacao).toBeVisible();
    expect(await dispensaNoBanco("mensalidade", mensalidadeId)).toMatchObject({
      dispensada: false,
    });

    const duzentos = `[e2e] ${"m".repeat(194)}`;
    await campo.fill(duzentos);
    await expect(confirmacao.getByTestId("motivo-dispensa-erro")).toHaveCount(0);
    await confirmacao.getByTestId("confirmar-dispensar-sim").click();
    await expect(confirmacao).toBeHidden();
    await expect(page.getByText(TOAST_DISPENSADA)).toBeVisible();
    expect(await dispensaNoBanco("mensalidade", mensalidadeId)).toMatchObject({
      dispensada: true,
      motivo: duzentos,
    });
  });

  test("(d) só mensalidade e inscrição se dispensam: o uso livre encerrado não tem “Dispensar a cobrança”; a inscrição e a mensalidade de venda cancelada têm", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const data = diaDoCaso(4);
    const clienteId = await semearCliente({ nome: `[e2e] Pessoa ${suf}` });
    const { usoLivreId } = await semearUsoLivreEncerrado({
      clienteId,
      data,
      horas: 2,
      pessoas: 1,
      precoHoraCentavos: 3000,
    });
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina ${suf}`,
      data,
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 15000,
    });
    const inscricaoId = await semearInscricao({
      eventoId,
      clienteId,
      tipo: "oficina",
      valorCentavos: 15000,
    });
    const { mensalidadeId } = await semearMensalidadeDoCaso(`${suf}-c`, 4, 20000);
    await ligarVendaCanceladaAMensalidade({
      mensalidadeId,
      valorCentavos: 20000,
      data: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await abrirAReceber(page);
    const uso = linhaAReceber(page, "uso_livre", usoLivreId);
    await expect(uso.getByTestId("recebi-agora")).toBeVisible();
    await expect(uso.getByTestId("dispensar")).toHaveCount(0);
    await expect(
      linhaAReceber(page, "inscricao", inscricaoId).getByTestId("dispensar"),
    ).toBeVisible();
    const cancelada = linhaAReceber(page, "mensalidade", mensalidadeId);
    await expect(cancelada.getByTestId("tag-venda-cancelada")).toBeVisible();
    await expect(cancelada.getByTestId("dispensar")).toBeVisible();

    // A inscrição também se dispensa — com o título dela.
    await linhaAReceber(page, "inscricao", inscricaoId).getByTestId("dispensar").click();
    await expect(
      page
        .getByTestId("confirmar-dispensar")
        .getByRole("heading", {
          name: tituloConfirmarDispensar("inscricao", `[e2e] Pessoa ${suf}`),
        }),
    ).toBeVisible();
    await page.getByTestId("confirmar-dispensar-sim").click();
    await expect(linhaAReceber(page, "inscricao", inscricaoId)).toHaveCount(0);
    expect(await dispensaNoBanco("inscricao", inscricaoId)).toMatchObject({
      existe: true,
      dispensada: true,
      motivo: null,
    });
  });

  test("(e) a mensalidade dispensada sai do lote e do total — o total é a soma das linhas na tela", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const { mensalidadeId } = await semearMensalidadeDoCaso(suf, 5, 27000);

    await fazerLogin(page);
    await abrirAReceber(page);
    const noLote = page.locator(`[data-testid="lote-linha"][data-id="${mensalidadeId}"]`);
    await expect(noLote).toHaveCount(1);

    await dispensarPelaTela(
      page,
      "mensalidade",
      mensalidadeId,
      "[e2e] saiu no começo do mês",
    );
    await expect(page.getByText(TOAST_DISPENSADA)).toBeVisible();
    await expect(linhaAReceber(page, "mensalidade", mensalidadeId)).toHaveCount(0);
    await expect(noLote).toHaveCount(0);

    // Recarregada do servidor: a dispensada não está no lote, e o total é exatamente a soma das linhas.
    await abrirAReceber(page);
    await expect(noLote).toHaveCount(0);
    await expect(linhaDispensadaNaTela(page, mensalidadeId)).toHaveCount(1);
    const valores = await page.getByTestId("a-receber-valor").allInnerTexts();
    const soma = valores.reduce((total, texto) => total + centavosDoTexto(texto), 0);
    await expect(page.getByTestId("a-receber-total")).toHaveText(formatarReais(soma));
  });
});

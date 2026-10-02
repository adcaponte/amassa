import { test, expect, type Page } from "@playwright/test";

import {
  avisoDiaComLancamentos,
  avisoDiaFechado,
  FRASE_FIM_ANTES_DO_COMECO,
  FRASE_HORARIO_VAZIO,
  FRASE_NOME_DA_AULA,
  FRASE_PRECO_POR_PESSOA,
  TOAST_LANCADO,
  toastDiaFechado,
} from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { eventoNoBanco, eventosComTitulo, semearOficina } from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-03, Tarefa 1 (AGE-01, AGE-12, D-13): a folha "Lançar na agenda" lança uma aula ou
// oficina avulsa e fecha um dia. Cada teste usa o PRÓPRIO título com sufixo único e, quando o caso
// depende do que mais existe no dia (o aviso D-13 conta lançamentos), um dia RESERVADO para ele e
// para o projeto — desktop e celular rodam ao mesmo tempo e nenhum caso afirma condição global do
// banco (CLAUDE.md). Datas sempre pelo dia de Brasília (`somarDiasAoHoje`). Nomes `[e2e]`.

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

// Um dia só deste caso e deste projeto, longe dos dias que as outras specs usam (300+).
function diaReservado(caso: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(300 + caso * 2 + projeto);
}

function folha(page: Page) {
  return page.getByTestId("folha-lancar");
}

// Abre a folha pelo "+ lançar" do dia, na semana dele.
async function abrirFolhaNoDia(page: Page, data: string) {
  await page.goto(`/gestao/agenda?semana=${data}`);
  await page.getByTestId(`agenda-dia-${data}`).getByTestId("agenda-lancar-no-dia").click();
  await expect(folha(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]lancar=1`));
  await expect(page).toHaveURL(new RegExp(`[?&]dia=${data}`));
  await expect(folha(page).getByTestId("lancar-data")).toHaveValue(data);
}

type Aula = { titulo: string; inicio: string; fim: string; vagas: string; preco: string };

async function preencherAula(page: Page, aula: Aula) {
  const f = folha(page);
  await f.getByTestId("lancar-nome").fill(aula.titulo);
  await f.getByTestId("lancar-inicio").fill(aula.inicio);
  await f.getByTestId("lancar-fim").fill(aula.fim);
  await f.getByTestId("lancar-vagas").fill(aula.vagas);
  await f.getByTestId("lancar-preco").fill(aula.preco);
}

function cartaoComTitulo(page: Page, data: string, titulo: string) {
  return page
    .getByTestId(`agenda-dia-${data}`)
    .getByTestId("agenda-cartao")
    .filter({ hasText: titulo });
}

test.describe("agenda lancamento", () => {
  test("“+ lançar” de amanhã lança uma oficina com vagas e preço “37,50” — o cartão no dia certo e 3750 centavos no banco", async ({
    page,
  }) => {
    const amanha = somarDiasAoHoje(1);
    const titulo = `[e2e] Oficina ${sufixoUnico()}`;

    await fazerLogin(page);
    await abrirFolhaNoDia(page, amanha);

    // Padrões da UI-SPEC: avulsa marcada, horário e preço vazios, vagas 8, público DESmarcado (decisão do
    // dono de 02/10/2026). A caixa não é tocada: a prova de ponta a ponta de que “sem escolha, não é público”.
    const f = folha(page);
    await expect(f.getByRole("radiogroup", { name: "O que lançar" })).toBeVisible();
    await expect(f.getByTestId("lancar-tipo-avulsa")).toHaveAttribute("aria-checked", "true");
    await expect(f.getByTestId("lancar-inicio")).toHaveValue("");
    await expect(f.getByTestId("lancar-preco")).toHaveValue("");
    await expect(f.getByTestId("lancar-vagas")).toHaveValue("8");
    await expect(f.getByTestId("lancar-publico")).toHaveAttribute("aria-checked", "false");
    await expect(f.getByTestId("lancar-gravar")).toHaveText("Lançar aula");

    await preencherAula(page, { titulo, inicio: "14:00", fim: "16:30", vagas: "6", preco: "37,50" });
    await f.getByTestId("lancar-gravar").click();

    await expect(page.getByText(TOAST_LANCADO).first()).toBeVisible();
    await expect(folha(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/lancar=/);

    const cartao = cartaoComTitulo(page, amanha, titulo);
    await expect(cartao).toHaveCount(1);
    await expect(cartao).toContainText("14:00");
    await expect(cartao).toContainText("0 / 6");
    await expect(cartao).toContainText("Oficina · até 16:30");

    const id = await cartao.getAttribute("data-evento-id");
    expect(id).not.toBeNull();
    const noBanco = await eventoNoBanco(id ?? "");
    expect(noBanco).toMatchObject({
      tipo: "avulsa",
      data: amanha,
      inicio: "14:00",
      fim: "16:30",
      titulo,
      vagas: 6,
      precoCentavos: 3750,
      publico: false,
      canceladoEm: null,
    });
  });

  test("erros embaixo dos campos, nada gravado: formulário vazio e fim antes do começo", async ({ page }) => {
    const titulo = `[e2e] Oficina errada ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await page.getByTestId("agenda-lancar").click();
    const f = folha(page);
    await expect(f).toBeVisible();

    // Gravar vazio: uma frase por campo, a folha continua aberta.
    await f.getByTestId("lancar-gravar").click();
    await expect(f.getByTestId("lancar-erro-titulo")).toHaveText(FRASE_NOME_DA_AULA);
    await expect(f.getByTestId("lancar-erro-inicio")).toHaveText(FRASE_HORARIO_VAZIO);
    await expect(f.getByTestId("lancar-erro-preco")).toHaveText(FRASE_PRECO_POR_PESSOA);
    await expect(f.getByTestId("lancar-nome")).toBeFocused();

    // Fim antes do começo: a frase fica embaixo do fim; o que foi digitado continua lá.
    await preencherAula(page, { titulo, inicio: "15:00", fim: "14:00", vagas: "8", preco: "10" });
    await f.getByTestId("lancar-gravar").click();
    await expect(f.getByTestId("lancar-erro-fim")).toHaveText(FRASE_FIM_ANTES_DO_COMECO);
    await expect(f.getByTestId("lancar-nome")).toHaveValue(titulo);
    await expect(f).toBeVisible();

    expect(await eventosComTitulo(titulo)).toHaveLength(0);
  });

  test("D-13: fechar um dia e lançar nele avisa e grava; fechar um dia com uma aula avisa e não mexe na aula", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const diaFechado = diaReservado(0);
    const motivo = `[e2e] motivo ${suf}`;
    const titulo = `[e2e] Oficina no fechado ${suf}`;

    await fazerLogin(page);

    // 1) Fechar o dia pela folha.
    await abrirFolhaNoDia(page, diaFechado);
    await folha(page).getByTestId("lancar-tipo-fechado").click();
    await expect(folha(page).getByTestId("lancar-gravar")).toHaveText("Fechar o dia");
    await folha(page).getByTestId("lancar-motivo").fill(motivo);
    await folha(page).getByTestId("lancar-gravar").click();
    await expect(page.getByText(toastDiaFechado(formatarDiaMes(diaFechado))).first()).toBeVisible();
    const fechado = cartaoComTitulo(page, diaFechado, motivo);
    await expect(fechado).toHaveCount(1);
    await expect(fechado).toContainText("dia todo");
    await expect(fechado).toContainText("Fechado · o dia todo");

    // 2) Lançar uma aula no dia fechado: o aviso aparece, o botão não muda e a aula é gravada.
    //    A última pílula escolhida (Fechado) vale enquanto a página estiver aberta.
    await page.getByTestId(`agenda-dia-${diaFechado}`).getByTestId("agenda-lancar-no-dia").click();
    await expect(folha(page).getByTestId("lancar-tipo-fechado")).toHaveAttribute("aria-checked", "true");
    await folha(page).getByTestId("lancar-tipo-avulsa").click();
    await expect(folha(page).getByTestId("aviso-dia-fechado")).toContainText(avisoDiaFechado(motivo));
    await expect(folha(page).getByTestId("lancar-gravar")).toHaveText("Lançar aula");
    await expect(folha(page).getByTestId("lancar-gravar")).toBeEnabled();
    await preencherAula(page, { titulo, inicio: "10:00", fim: "12:00", vagas: "4", preco: "0" });
    await folha(page).getByTestId("lancar-gravar").click();
    await expect(page.getByText(TOAST_LANCADO).first()).toBeVisible();
    await expect(cartaoComTitulo(page, diaFechado, titulo)).toHaveCount(1);
    // O fechado vem primeiro no dia.
    await expect(page.getByTestId(`agenda-dia-${diaFechado}`).getByTestId("agenda-cartao").first()).toContainText(
      motivo,
    );
    const [aula] = await eventosComTitulo(titulo);
    expect(aula).toMatchObject({ tipo: "avulsa", precoCentavos: 0, canceladoEm: null });

    // 3) Fechar um dia que já tem uma aula: o aviso conta 1 lançamento; a aula não muda.
    const diaComAula = diaReservado(1);
    const tituloSemeado = `[e2e] Aula semeada ${suf}`;
    const semeada = await semearOficina({
      titulo: tituloSemeado,
      data: diaComAula,
      inicio: "09:00",
      fim: "11:00",
      vagas: 5,
      precoCentavos: 5000,
    });
    await abrirFolhaNoDia(page, diaComAula);
    await folha(page).getByTestId("lancar-tipo-fechado").click();
    await expect(folha(page).getByTestId("aviso-dia-fechado")).toContainText(avisoDiaComLancamentos(1));
    await folha(page).getByTestId("lancar-motivo").fill(`[e2e] feriado ${suf}`);
    await folha(page).getByTestId("lancar-gravar").click();
    await expect(page.getByText(toastDiaFechado(formatarDiaMes(diaComAula))).first()).toBeVisible();
    await expect(cartaoComTitulo(page, diaComAula, `[e2e] feriado ${suf}`)).toHaveCount(1);
    expect(await eventoNoBanco(semeada)).toMatchObject({ titulo: tituloSemeado, canceladoEm: null });
    await expect(cartaoComTitulo(page, diaComAula, tituloSemeado)).not.toContainText("cancelada");
  });

  test("duas aulas no mesmo horário são gravadas as duas, sem aviso de horário repetido", async ({ page }) => {
    const suf = sufixoUnico();
    const dia = diaReservado(2);
    const primeira = `[e2e] Primeira ${suf}`;
    const segunda = `[e2e] Segunda ${suf}`;

    await fazerLogin(page);
    await abrirFolhaNoDia(page, dia);
    await preencherAula(page, { titulo: primeira, inicio: "19:00", fim: "21:00", vagas: "8", preco: "120" });
    await folha(page).getByTestId("lancar-gravar").click();
    await expect(cartaoComTitulo(page, dia, primeira)).toHaveCount(1);

    await page.getByTestId(`agenda-dia-${dia}`).getByTestId("agenda-lancar-no-dia").click();
    await expect(folha(page)).toBeVisible();
    await preencherAula(page, { titulo: segunda, inicio: "19:00", fim: "21:00", vagas: "8", preco: "120" });
    // Nenhum aviso: o dia não está fechado, e lançamento no mesmo horário não é assunto (§2.8).
    await expect(folha(page).getByTestId("aviso-dia-fechado")).toHaveText("");
    await folha(page).getByTestId("lancar-gravar").click();
    await expect(cartaoComTitulo(page, dia, segunda)).toHaveCount(1);
    await expect(cartaoComTitulo(page, dia, primeira)).toHaveCount(1);
    await expect(page.getByTestId(`agenda-dia-${dia}`).getByTestId("agenda-cartao")).toHaveCount(2);
  });

  test("duplo clique em “Lançar aula” cria UM evento", async ({ page }) => {
    const titulo = `[e2e] Duplo ${sufixoUnico()}`;
    const dia = somarDiasAoHoje(3);

    await fazerLogin(page);
    await abrirFolhaNoDia(page, dia);
    await preencherAula(page, { titulo, inicio: "08:00", fim: "09:00", vagas: "3", preco: "50" });
    await folha(page).getByTestId("lancar-gravar").dblclick();

    await expect(page.getByText(TOAST_LANCADO).first()).toBeVisible();
    await expect(cartaoComTitulo(page, dia, titulo)).toHaveCount(1);
    await expect.poll(async () => (await eventosComTitulo(titulo)).length).toBe(1);
    // E continua um só depois de a tela assentar.
    await page.waitForTimeout(500);
    expect(await eventosComTitulo(titulo)).toHaveLength(1);
  });
});

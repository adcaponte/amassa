import { test, expect, type Page } from "@playwright/test";

import { CONTEUDO_SITE } from "@/conteudo/site";
import { todoODia } from "@/lib/agenda/turma";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { semearAluno, semearCliente, semearInscricao, semearTurmaComDatas } from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-15, Tarefa 2 (AGE-18; D-10, D-11, D-12): o calendário vivo da raiz. Os eventos são
// lançados PELA TELA — a ação revalida "/" na hora; semear direto no banco não aparece por até 5 min
// (ISR, Pitfall 11). O que é semeado no banco (as pessoas, a turma) entra ANTES de uma ação de tela
// que revalida "/", e só então a raiz é aberta. Cada projeto usa dias reservados (40+), dentro da
// janela de 6 meses, e as asserções acham o PRÓPRIO evento pelo dia no Calendário — nenhuma afirma
// condição global do banco (outras specs também lançam eventos públicos). Nomes `[e2e]`.

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

function diaReservado(base: number): string {
  const projeto = test.info().project.name === "celular" ? 1 : 0;
  return somarDiasAoHoje(base + projeto);
}

function folha(page: Page) {
  return page.getByTestId("folha-lancar");
}

async function abrirFolhaNoDia(page: Page, data: string) {
  await page.goto(`/gestao/agenda?semana=${data}`);
  await page.getByTestId(`agenda-dia-${data}`).getByTestId("agenda-lancar-no-dia").click();
  await expect(folha(page)).toBeVisible();
}

async function lancarOficina(page: Page, data: string, titulo: string, publica: boolean) {
  await abrirFolhaNoDia(page, data);
  const f = folha(page);
  await f.getByTestId("lancar-nome").fill(titulo);
  await f.getByTestId("lancar-inicio").fill("14:00");
  await f.getByTestId("lancar-fim").fill("17:00");
  await f.getByTestId("lancar-vagas").fill("2");
  await f.getByTestId("lancar-preco").fill("120");
  if (!publica) {
    await f.getByTestId("lancar-publico").click();
    await expect(f.getByTestId("lancar-publico")).toHaveAttribute("aria-checked", "false");
  }
  await f.getByTestId("lancar-gravar").click();
  await expect(folha(page)).toHaveCount(0);
  await expect(
    page.getByTestId(`agenda-dia-${data}`).getByTestId("agenda-cartao").filter({ hasText: titulo }),
  ).toHaveCount(1);
}

async function fecharDia(page: Page, data: string, motivo: string) {
  await abrirFolhaNoDia(page, data);
  await folha(page).getByTestId("lancar-tipo-fechado").click();
  await folha(page).getByTestId("lancar-motivo").fill(motivo);
  await folha(page).getByTestId("lancar-gravar").click();
  await expect(folha(page)).toHaveCount(0);
}

function mesesEntre(de: string, ate: string): number {
  const [anoDe, mesDe] = de.split("-").map(Number);
  const [anoAte, mesAte] = ate.split("-").map(Number);
  return (anoAte - anoDe) * 12 + (mesAte - mesDe);
}

async function abrirCalendarioNoMes(page: Page, data: string) {
  await page.goto("/");
  const viva = page.getByTestId("site-agenda-viva");
  await expect(viva).toBeVisible();
  await viva.getByRole("tab", { name: "Calendário" }).click();
  const calendario = page.getByTestId("site-calendario");
  await expect(calendario).toBeVisible();
  for (let passo = 0; passo < mesesEntre(hojeNoAtelie(), data); passo += 1) {
    await calendario.getByRole("button", { name: "Próximo mês" }).click();
  }
  return calendario;
}

async function escolherDia(page: Page, data: string) {
  const calendario = await abrirCalendarioNoMes(page, data);
  await calendario.locator(`[data-testid="site-dia"][data-data="${data}"]`).click();
  return calendario;
}

test.describe("site agenda", () => {
  test("oficina pública pela tela aparece com preço, vagas e o WhatsApp; a privada não; lotada vira esgotado; nenhum nome, telefone nem motivo no HTML", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const suf = sufixoUnico();
    const dia = diaReservado(40);
    const diaFechado = diaReservado(44);
    const publica = `[e2e] Oficina ${suf}`;
    const privada = `[e2e] Oficina privada ${suf}`;
    const motivo = `[e2e] Motivo secreto ${suf}`;
    const nomes = [`[e2e] Ana Site ${suf}`, `[e2e] Beto Site ${suf}`];
    const telefones = ["(62) 98888-1111", "(62) 98888-2222"];

    await fazerLogin(page);
    await lancarOficina(page, dia, publica, true);
    await lancarOficina(page, dia, privada, false);

    // (a) a oficina pública aparece no dia, com preço por pessoa, material incluso, "últimas 2
    // vagas" e o link do WhatsApp com a mensagem inteira; a privada não aparece.
    let calendario = await escolherDia(page, dia);
    let cartao = calendario.getByTestId("site-cartao-evento").filter({ hasText: publica });
    await expect(cartao).toHaveCount(1);
    await expect(cartao).toHaveAttribute("data-tipo", "oficina");
    await expect(cartao).toContainText(/R\$\s120,00 por pessoa/);
    await expect(cartao).toContainText("material incluso");
    await expect(cartao).toContainText("últimas 2 vagas");
    const href = await cartao.getByTestId("site-reservar").getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\//);
    // O número é o do site (`CONTEUDO_SITE.zap`, o real desde 02/10/2026), não um qualquer.
    expect(new URL(href ?? "").pathname).toBe(`/${CONTEUDO_SITE.zap}`);
    expect(new URL(href ?? "").searchParams.get("text")).toBe(
      `Oi! Quero reservar: ${publica} (${formatarDiaMes(dia)}).`,
    );
    await expect(calendario.getByTestId("site-cartao-evento").filter({ hasText: privada })).toHaveCount(0);
    expect(await page.content()).not.toContain(privada);

    // (f) o uso livre não tem preço.
    await expect(page.getByTestId("site-uso-livre")).not.toContainText("R$");

    // (b, e) duas pessoas na oficina e uma turma pública com 1 aluno — semeadas; (d) fechar um dia
    // PELA TELA revalida "/".
    const eventoId = await page
      .goto(`/gestao/agenda?semana=${dia}`)
      .then(() =>
        page
          .getByTestId(`agenda-dia-${dia}`)
          .getByTestId("agenda-cartao")
          .filter({ hasText: publica })
          .getAttribute("data-evento-id"),
      );
    expect(eventoId).not.toBeNull();
    for (const [indice, nome] of nomes.entries()) {
      const clienteId = await semearCliente({ nome, telefone: telefones[indice] });
      await semearInscricao({ eventoId: eventoId ?? "", clienteId, tipo: "oficina", cobrar: true, valorCentavos: 12000 });
    }
    const dataDaTurma = diaReservado(46);
    const diaSemana = new Date(`${dataDaTurma}T12:00:00Z`).getUTCDay();
    const turma = `[e2e] Turma do site ${suf}`;
    const { turmaId } = await semearTurmaComDatas({
      nome: turma,
      diaSemana,
      inicio: "19:00",
      fim: "21:00",
      vagas: 6,
      mensalidadeCentavos: 32000,
      diaVencimento: 10,
      datas: [dataDaTurma, diaReservado(53)],
      publica: true,
    });
    const aluno = await semearCliente({ nome: `[e2e] Aluna Site ${suf}`, telefone: "(62) 97777-3333" });
    await semearAluno({ turmaId, clienteId: aluno, entrouEm: hojeNoAtelie() });

    await fecharDia(page, diaFechado, motivo);

    // (b) lotada: "esgotado" e nenhum botão de reservar.
    calendario = await escolherDia(page, dia);
    cartao = calendario.getByTestId("site-cartao-evento").filter({ hasText: publica });
    await expect(cartao).toContainText("esgotado");
    await expect(cartao.getByTestId("site-reservar")).toHaveCount(0);

    // (c) o HTML inteiro não tem o nome nem o telefone de ninguém.
    const html = await page.content();
    for (const texto of [...nomes, ...telefones, `[e2e] Aluna Site ${suf}`, "(62) 97777-3333"]) {
      expect(html).not.toContain(texto);
    }

    // (d) o dia fechado mostra "Fechado neste dia." e o motivo não está no HTML.
    calendario = await escolherDia(page, diaFechado);
    await expect(calendario).toContainText("Fechado neste dia.");
    expect(await page.content()).not.toContain(motivo);

    // (e) a turma pública aparece UMA vez na lista do mês, com "toda {dia}" e vagas − alunos ativos.
    calendario = await abrirCalendarioNoMes(page, dataDaTurma);
    const cartoesDaTurma = calendario.getByTestId("site-cartao-evento").filter({ hasText: turma });
    await expect(cartoesDaTurma).toHaveCount(1);
    await expect(cartoesDaTurma.first()).toHaveAttribute("data-tipo", "turma");
    await expect(cartoesDaTurma.first()).toContainText(todoODia(diaSemana));
    await expect(cartoesDaTurma.first()).toContainText("5 vagas");
    await expect(cartoesDaTurma.first()).toContainText(/R\$\s320,00 por mês/);
  });
});

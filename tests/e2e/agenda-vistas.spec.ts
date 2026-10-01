import { test, expect, type Page } from "@playwright/test";

import { tituloDaSemana, tituloDoMes, segundaDaSemana } from "@/lib/agenda/semana";
import { somarDias } from "@/lib/producao/calendario";

import { semearFechado, semearOficina } from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-03, Tarefa 3 (AGE-02, UI-D2, UI-D21, UI-D27): andar pela agenda — "‹ ›" e "Hoje" na
// semana, e a vista do mês com um ponto por lançamento e o resumo no `aria-label`. Os dias com
// lançamento são reservados por projeto (desktop e celular rodam juntos e o resumo CONTA o que há
// no dia); nenhum caso afirma condição global do banco. "Hoje" pelo dia de Brasília.

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

function deslocamentoDoProjeto(): number {
  return test.info().project.name === "celular" ? 1 : 0;
}

async function irParaOMesDe(page: Page, data: string) {
  await page.getByTestId("agenda-vista-mes").click();
  await expect(page.getByTestId("agenda-mes")).toBeVisible();
  // O alternador abre o mês de hoje; o dia pode estar no mês seguinte.
  if (data.slice(0, 7) !== hojeNoAtelie().slice(0, 7)) {
    await page.getByTestId("agenda-proxima").click();
  }
  await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDoMes(data.slice(0, 7)));
}

test.describe("agenda vistas", () => {
  test("“›” e “‹” mudam a semana e o título; “Hoje” volta e o cabeçalho de hoje está visível", async ({ page }) => {
    const hoje = hojeNoAtelie();
    const segunda = segundaDaSemana(hoje);

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    const titulo = page.getByTestId("agenda-titulo");
    await expect(titulo).toHaveText(tituloDaSemana(segunda));
    // Abrir sem `?semana=` rola até hoje.
    await expect(page.getByTestId(`agenda-dia-${hoje}`)).toBeInViewport();

    await page.getByRole("link", { name: "Próxima semana" }).click();
    await expect(titulo).toHaveText(tituloDaSemana(somarDias(segunda, 7)));
    // Um toque por vez: cada "‹" leva à semana anterior à que está NA TELA.
    await page.getByRole("link", { name: "Semana anterior" }).click();
    await expect(titulo).toHaveText(tituloDaSemana(segunda));
    await page.getByRole("link", { name: "Semana anterior" }).click();
    await expect(titulo).toHaveText(tituloDaSemana(somarDias(segunda, -7)));

    await page.getByTestId("agenda-hoje").click();
    await expect(titulo).toHaveText(tituloDaSemana(segunda));
    await expect(page.getByTestId(`agenda-dia-${hoje}`)).toBeInViewport();
    await expect(page.getByTestId(`agenda-dia-${hoje}`)).toContainText("hoje");

    // O alternador é neutro, em `tablist`, e a semana é a marcada.
    const alternador = page.getByRole("tablist", { name: "Ver a agenda por" });
    await expect(alternador.getByRole("tab", { name: "Semana" })).toHaveAttribute("aria-selected", "true");
    await expect(alternador.getByRole("tab", { name: "Mês" })).toHaveAttribute("aria-selected", "false");
  });

  test("uma oficina daqui a 10 dias: o mês mostra o ponto e “1 oficina”; tocar no dia abre a semana dele", async ({
    page,
  }) => {
    const data = somarDiasAoHoje(10 + deslocamentoDoProjeto());
    const titulo = `[e2e] Oficina do mês ${sufixoUnico()}`;
    const eventoId = await semearOficina({
      titulo,
      data,
      inicio: "15:00",
      fim: "17:00",
      vagas: 6,
      precoCentavos: 8000,
    });

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await irParaOMesDe(page, data);
    await expect(page).toHaveURL(/vista=mes/);

    const celula = page.getByTestId(`mes-dia-${data}`);
    await expect(celula).toHaveAttribute("aria-label", /1 oficina/);
    await expect(page.getByTestId("agenda-mes-legenda")).toContainText("Aula ou oficina avulsa");
    await expect(page.getByTestId("agenda-mes-vazio")).toHaveCount(0);
    await expect(page.getByText("Toque num dia para abrir a semana dele.")).toBeVisible();
    // A célula de hoje diz "hoje" (quando hoje está na grade deste mês).
    const celulaDeHoje = page.getByTestId(`mes-dia-${hojeNoAtelie()}`);
    if ((await celulaDeHoje.count()) > 0) {
      await expect(celulaDeHoje).toHaveAttribute("aria-label", / · hoje$/);
    }

    await celula.click();
    await expect(page).not.toHaveURL(/vista=mes/);
    await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDaSemana(segundaDaSemana(data)));
    await expect(
      page.getByTestId(`agenda-dia-${data}`).locator(`[data-testid="agenda-cartao"][data-evento-id="${eventoId}"]`),
    ).toBeVisible();
  });

  test("um dia fechado: a célula do mês diz “dia fechado”", async ({ page }) => {
    const data = somarDiasAoHoje(12 + deslocamentoDoProjeto());
    await semearFechado({ data, motivo: `[e2e] fechado do mês ${sufixoUnico()}` });

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await irParaOMesDe(page, data);
    await expect(page.getByTestId(`mes-dia-${data}`)).toHaveAttribute("aria-label", /: dia fechado/);
  });

  test("um mês sem nada: a grade sem pontos e “Nada marcado neste mês.”", async ({ page }) => {
    // Um mês distante, que nenhum caso usa.
    const mes = somarDiasAoHoje(3650).slice(0, 7);
    await fazerLogin(page);
    await page.goto(`/gestao/agenda?vista=mes&mes=${mes}`);
    await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDoMes(mes));
    await expect(page.getByTestId("agenda-mes-vazio")).toHaveText("Nada marcado neste mês.");
    await expect(page.getByTestId(`mes-dia-${mes}-15`)).toHaveAttribute("aria-label", /: nada marcado/);
  });

  test("a 320px a barra não cria rolagem lateral — na semana que cruza o ano e no mês", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await fazerLogin(page);

    await page.goto("/gestao/agenda?semana=2026-12-28");
    await expect(page.getByTestId("agenda-titulo")).toHaveText("28/12/2026 a 03/01/2027");
    await expect(page.getByTestId("agenda-proxima")).toBeInViewport();
    const semRolagemLateral = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await semRolagemLateral()).toBe(true);

    await page.goto("/gestao/agenda?vista=mes&mes=2026-12");
    await expect(page.getByTestId("agenda-mes")).toBeVisible();
    expect(await semRolagemLateral()).toBe(true);
  });
});

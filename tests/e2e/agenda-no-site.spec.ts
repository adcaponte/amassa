import { test, expect, type Page } from "@playwright/test";

import { DICA_NO_SITE } from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-15, Tarefa 3 (AGE-18, UI-D18, UI-D1): a aba "No site" mostra, ao vivo, o mesmo calendário
// que o visitante vê — e as cinco abas da Agenda quebram em 3 + 2 no celular. O caso "sem evento
// público" da aba é condição GLOBAL do banco e fica na caminhada do portão (plano 16). Cada projeto
// usa o próprio dia reservado (48+) e acha o próprio evento pelo dia. Nomes `[e2e]`.

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

function mesesEntre(de: string, ate: string): number {
  const [anoDe, mesDe] = de.split("-").map(Number);
  const [anoAte, mesAte] = ate.split("-").map(Number);
  return (anoAte - anoDe) * 12 + (mesAte - mesDe);
}

async function topoDe(page: Page, testId: string): Promise<number> {
  // O esqueleto do loading.tsx e o fallback do Suspense também desenham as abas: só a visível conta.
  await expect(page.getByTestId("agenda-carregando")).toBeHidden();
  const caixa = await page.locator(`[data-testid="${testId}"] >> visible=true`).first().boundingBox();
  expect(caixa, `${testId} sem caixa`).not.toBeNull();
  return Math.round(caixa?.y ?? 0);
}

test.describe("agenda no site", () => {
  test("(a) a aba “No site” mostra a oficina pública lançada pela tela, como no site, com o link real de WhatsApp", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const dia = diaReservado(48);
    const titulo = `[e2e] Oficina no site ${suf}`;

    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${dia}`);
    await page.getByTestId(`agenda-dia-${dia}`).getByTestId("agenda-lancar-no-dia").click();
    const folha = page.getByTestId("folha-lancar");
    await expect(folha).toBeVisible();
    await folha.getByTestId("lancar-nome").fill(titulo);
    await folha.getByTestId("lancar-inicio").fill("09:00");
    await folha.getByTestId("lancar-fim").fill("11:30");
    await folha.getByTestId("lancar-vagas").fill("5");
    await folha.getByTestId("lancar-preco").fill("80");
    // A caixa pública vem DESmarcada (decisão do dono de 02/10/2026): a oficina só vai para o site marcada.
    await folha.getByTestId("lancar-publico").click();
    await expect(folha.getByTestId("lancar-publico")).toHaveAttribute("aria-checked", "true");
    await folha.getByTestId("lancar-gravar").click();
    await expect(folha).toHaveCount(0);

    await page.getByTestId("aba-site").click();
    await expect(page).toHaveURL(/[?&]aba=site/);
    await expect(page.getByTestId("aba-site")).toHaveAttribute("aria-selected", "true");
    const aba = page.getByTestId("no-site");
    await expect(aba).toContainText(DICA_NO_SITE);
    const moldura = page.getByTestId("moldura-no-site");
    await expect(moldura).toBeVisible();
    await expect(moldura.getByRole("heading", { level: 2 })).toHaveText("Agenda do ateliê");

    await moldura.getByRole("tab", { name: "Calendário" }).click();
    const calendario = moldura.getByTestId("site-calendario");
    for (let passo = 0; passo < mesesEntre(hojeNoAtelie(), dia); passo += 1) {
      await calendario.getByRole("button", { name: "Próximo mês" }).click();
    }
    await calendario.locator(`[data-testid="site-dia"][data-data="${dia}"]`).click();
    const cartao = calendario.getByTestId("site-cartao-evento").filter({ hasText: titulo });
    await expect(cartao).toHaveCount(1);
    await expect(cartao).toContainText(/R\$\s80,00 por pessoa/);
    await expect(cartao).toContainText("5 vagas");
    const href = await cartao.getByTestId("site-reservar").getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?/);
    expect(new URL(href ?? "").searchParams.get("text")).toBe(`Oi! Quero reservar: ${titulo} (${formatarDiaMes(dia)}).`);
  });

  test("(b) as cinco abas: a 320px, 3 + 2 sem rolagem lateral; a 1280px, uma fileira", async ({ page }) => {
    await fazerLogin(page);

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/gestao/agenda");
    await expect(page.getByTestId("agenda-carregando")).toBeHidden();
    const abas = page.locator(`[data-testid="abas-da-agenda"] >> visible=true`).first();
    await expect(abas.getByRole("tab")).toHaveText(["Agenda", "Pessoas", /^Receber/, "No site", "Números"]);
    const primeira = await topoDe(page, "aba-agenda");
    expect(await topoDe(page, "aba-pessoas")).toBe(primeira);
    expect(await topoDe(page, "aba-receber")).toBe(primeira);
    const segunda = await topoDe(page, "aba-site");
    expect(segunda).toBeGreaterThan(primeira);
    expect(await topoDe(page, "aba-numeros")).toBe(segunda);
    const [largura, visivel] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(largura).toBeLessThanOrEqual(visivel);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/gestao/agenda");
    const topo = await topoDe(page, "aba-agenda");
    for (const outra of ["aba-pessoas", "aba-receber", "aba-site", "aba-numeros"]) {
      expect(await topoDe(page, outra)).toBe(topo);
    }
  });
});

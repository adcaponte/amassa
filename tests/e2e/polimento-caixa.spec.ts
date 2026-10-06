import { test, expect, type Page } from "@playwright/test";

import { formatarDiaMes } from "@/lib/producao/calendario";

import { medirCaixa } from "./apoio/medir-caixa";
import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// O Caixa da Fase 06.5 (06.5-12-PLAN.md, D-03 / UI-D7 / UI-D8, D-27):
// - "A pagar"/"A receber" e os tiles "A receber", "A pagar" e "Se tudo se cumprir" falam das
//   vencidas e das que vencem até hoje + 30; o resto fica a um toque, na mesma lista, sem navegar;
// - nenhum teste afirma o N exato de "Ver as {N}…": outros specs criam contas ao mesmo tempo.

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

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

test.describe("polimento caixa — janela", () => {
  test("“A receber” mostra até hoje + 30; a de depois fica atrás de “Ver…”, abre na mesma lista e fecha", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const tituloPerto = `[e2e] Caneca da Clarice Inventada ${suf}`;
    const tituloLonge = `[e2e] Travessa da Clarice Inventada ${suf}`;
    await semearContaAPagar({
      titulo: tituloPerto,
      pessoa: "Clarice Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 4200,
      vencimento: somarDiasAoHoje(10),
      tipo: "venda",
    });
    await semearContaAPagar({
      titulo: tituloLonge,
      pessoa: "Clarice Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 9900,
      vencimento: somarDiasAoHoje(45),
      tipo: "venda",
    });
    const ate = formatarDiaMes(somarDiasAoHoje(30));

    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=caixa");

    const aReceber = page.getByTestId("caixa-a-receber");
    await expect(aReceber).toBeVisible();
    await expect(aReceber).toContainText(`Vencidas e as que vencem até ${ate}.`);
    await expect(page.getByTestId("caixa-a-pagar")).toContainText(`Vencidas e as que vencem até ${ate}.`);

    // A de daqui a 10 dias está na janela; a de daqui a 45, não.
    await expect(aReceber.getByTestId("conta-cartao").filter({ hasText: tituloPerto })).toBeVisible();
    await expect(cartaoDaConta(page, tituloLonge)).toHaveCount(0);

    // Os três tiles que somam o futuro dizem até quando; o saldo, não.
    for (const tile of ["caixa-tile-receber", "caixa-tile-pagar", "caixa-tile-previsto"]) {
      await expect(page.getByTestId(tile).getByTestId("caixa-janela-ate")).toHaveText(`até ${ate}`);
    }
    await expect(page.getByTestId("caixa-tile-saldo").getByTestId("caixa-janela-ate")).toHaveCount(0);

    // O botão no fim da lista: singular ou plural de verdade (o N exato é de outros testes também).
    const botao = page.getByTestId("caixa-ver-depois-receber");
    await expect(botao).toHaveText(
      new RegExp(`^Ver (a que vence|as \\d+ que vencem) depois de ${ate.replace("/", "\\/")}$`),
    );
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    expect((await medirCaixa(botao)).height).toBeGreaterThanOrEqual(44);

    // Abre na mesma lista, sem navegar. O clique pode chegar antes da hidratação — confere e repete.
    const urlAntes = page.url();
    await expect(async () => {
      if ((await botao.getAttribute("aria-expanded")) !== "true") {
        await botao.click();
      }
      await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    expect(page.url()).toBe(urlAntes);

    const separador = aReceber.getByTestId("caixa-depois-de");
    await expect(separador).toHaveText(`Depois de ${ate}`);
    const depois = aReceber.locator("#caixa-depois-receber");
    await expect(depois.getByTestId("conta-cartao").filter({ hasText: tituloLonge })).toBeVisible();
    // A de perto continua acima da linha "Depois de", nunca dentro do bloco de depois.
    await expect(depois.getByTestId("conta-cartao").filter({ hasText: tituloPerto })).toHaveCount(0);
    await expect(botao).toHaveText(`Mostrar só até ${ate}`);

    // Tocar de novo esconde.
    await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    await expect(cartaoDaConta(page, tituloLonge)).toHaveCount(0);
    await expect(separador).toHaveCount(0);
    await expect(aReceber.getByTestId("conta-cartao").filter({ hasText: tituloPerto })).toBeVisible();
  });
});

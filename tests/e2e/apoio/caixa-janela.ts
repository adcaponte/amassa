// Auxiliar de teste do Caixa (06.5-12, D-03): desde a janela de 30 dias, "A pagar" e "A receber"
// mostram só as vencidas e as que vencem até hoje + 30; as de depois ficam atrás do botão "Ver as
// {N} que vencem depois de {dd/mm}" no fim de cada lista. Um teste que procura uma conta de
// vencimento distante (a 3ª parcela de uma venda 3x, a conta fixa gerada para um mês da frente)
// abre as duas listas antes — o que ele afirma sobre a conta não muda.
//
// Idempotente e tolerante: sem conta depois, o botão não existe e nada acontece; já aberta
// (`aria-expanded="true"`), não fecha. O clique pode chegar antes da hidratação e se perder —
// por isso o `toPass` confere o estado e só clica de novo se ele continuar fechado.
import { expect, type Page } from "@playwright/test";

export async function abrirContasDepoisDaJanela(page: Page): Promise<void> {
  // A seção real (não o esqueleto do `loading.tsx`) — o botão vem junto dela, do servidor.
  await expect(page.getByTestId("caixa-a-pagar")).toBeVisible();
  await expect(page.getByTestId("caixa-a-receber")).toBeVisible();
  for (const lista of ["pagar", "receber"] as const) {
    const botao = page.getByTestId(`caixa-ver-depois-${lista}`);
    if ((await botao.count()) === 0) {
      continue;
    }
    await expect(async () => {
      if ((await botao.getAttribute("aria-expanded")) !== "true") {
        await botao.click();
      }
      await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass({ timeout: 15000 });
  }
}

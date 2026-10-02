import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";

import {
  presencaNoBanco,
  semearCliente,
  semearInscricao,
  semearOficina,
} from "./apoio/semear-agenda";
import { hojeNoAtelie } from "./apoio/semear-financeiro";

// O traçador da Fase 5 (plano 01, critério 3 do ROADMAP, AGE-08 — o valor central): uma oficina de
// hoje na semana, a lista de quem vem, "Veio" em um toque — e o banco guardou. O caminho atravessa
// tela → Server Action `definirPresenca` → `lib/agenda/gravacao.ts` (trava) → `lib/agenda/presenca.ts`
// (puro) → banco → `lib/agenda/consultas.ts` → tela, sem atalho. Cada teste semeia a PRÓPRIA
// oficina com sufixo único e a acha pelo `data-evento-id` — nenhuma afirmação global do banco
// (CLAUDE.md). Nomes inventados com prefixo `[e2e]`; "hoje" é o dia de Brasília (`hojeNoAtelie`).

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

const VAGAS = 8;

// Uma oficina de hoje com duas pessoas inscritas.
async function semearOficinaDeHoje() {
  const suf = sufixoUnico();
  const titulo = `[e2e] Oficina ${suf}`;
  const nomeA = `[e2e] Pessoa ${suf} A`;
  const nomeB = `[e2e] Pessoa ${suf} B`;
  const eventoId = await semearOficina({
    titulo,
    data: hojeNoAtelie(),
    inicio: "14:00",
    fim: "17:00",
    vagas: VAGAS,
    precoCentavos: 12000,
  });
  const clienteA = await semearCliente({ nome: nomeA });
  const clienteB = await semearCliente({ nome: nomeB });
  const inscricaoA = await semearInscricao({
    eventoId,
    clienteId: clienteA,
    tipo: "oficina",
    valorCentavos: 12000,
  });
  const inscricaoB = await semearInscricao({
    eventoId,
    clienteId: clienteB,
    tipo: "oficina",
    valorCentavos: 12000,
  });
  return { titulo, nomeA, nomeB, eventoId, inscricaoA, inscricaoB };
}

function linhaDe(page: Page, inscricaoId: string) {
  return page
    .getByTestId("folha-evento")
    .locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
}

test.describe("agenda tracador", () => {
  test("a oficina de hoje na semana, a lista de quem vem, Veio em um toque, gravado e relido; tocar de novo desmarca", async ({
    page,
  }) => {
    const oficina = await semearOficinaDeHoje();

    await fazerLogin(page);
    await page.goto("/gestao/agenda");

    // Toque 1: o cartão, no grupo de hoje.
    const diaDeHoje = page.getByTestId(`agenda-dia-${hojeNoAtelie()}`);
    await expect(diaDeHoje).toContainText("hoje");
    const cartao = diaDeHoje.locator(
      `[data-testid="agenda-cartao"][data-evento-id="${oficina.eventoId}"]`,
    );
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(oficina.titulo);
    await expect(cartao).toContainText("14:00");
    await expect(cartao).toContainText(`2 / ${VAGAS}`);
    await expect(cartao).toContainText("Oficina · até 17:00");
    await expect(cartao).toHaveAttribute("data-tipo", "avulsa");
    await cartao.click();

    const folha = page.getByTestId("folha-evento");
    await expect(folha).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`[?&]evento=${oficina.eventoId}`));
    await expect(folha.getByRole("heading", { level: 3 })).toHaveText(`Quem vem · 2 de ${VAGAS}`);
    await expect(folha.getByTestId("inscrito")).toHaveCount(2);

    // Toque 2: "Veio" na pessoa A — o segmento fica marcado na hora (otimista) e o banco grava.
    const linhaA = linhaDe(page, oficina.inscricaoA);
    await expect(linhaA).toContainText(oficina.nomeA);
    const grupoA = linhaA.getByRole("group", { name: `Presença de ${oficina.nomeA}` });
    const veioA = grupoA.getByTestId("presenca-veio");
    await expect(veioA).toHaveAttribute("aria-pressed", "false");
    await veioA.click();
    await expect(veioA).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => presencaNoBanco(oficina.inscricaoA)).toBe("veio");
    // A pessoa B continua sem marcação.
    expect(await presencaNoBanco(oficina.inscricaoB)).toBeNull();

    // Recarregar com a folha aberta mostra "Veio" marcado — vindo do banco.
    await page.reload();
    await expect(page.getByTestId("folha-evento")).toBeVisible();
    await expect(linhaDe(page, oficina.inscricaoA).getByTestId("presenca-veio")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(linhaDe(page, oficina.inscricaoA).getByTestId("presenca-faltou")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Tocar "Veio" de novo desmarca: o cliente manda o estado desejado (nada).
    await linhaDe(page, oficina.inscricaoA).getByTestId("presenca-veio").click();
    await expect(linhaDe(page, oficina.inscricaoA).getByTestId("presenca-veio")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect.poll(() => presencaNoBanco(oficina.inscricaoA)).toBeNull();

    // "Pronto" fecha a folha e tira o parâmetro da URL.
    await page.getByTestId("folha-evento-pronto").click();
    await expect(page.getByTestId("folha-evento")).toHaveCount(0);
    await expect(page).not.toHaveURL(/evento=/);
  });

  test("dois celulares na mesma folha: o último a gravar vence, e a primeira tela, recarregada, mostra o banco", async ({
    page,
  }) => {
    const oficina = await semearOficinaDeHoje();

    await fazerLogin(page);
    const outra = await page.context().newPage();
    const endereco = `/gestao/agenda?evento=${oficina.eventoId}`;
    await page.goto(endereco);
    await outra.goto(endereco);
    await expect(linhaDe(page, oficina.inscricaoA)).toBeVisible();
    await expect(linhaDe(outra, oficina.inscricaoA)).toBeVisible();

    // Primeiro celular: "Faltou".
    await linhaDe(page, oficina.inscricaoA).getByTestId("presenca-faltou").click();
    await expect.poll(() => presencaNoBanco(oficina.inscricaoA)).toBe("faltou");

    // Segundo celular, que ainda não viu o "Faltou": "Veio" — o último a gravar vence.
    await linhaDe(outra, oficina.inscricaoA).getByTestId("presenca-veio").click();
    await expect.poll(() => presencaNoBanco(oficina.inscricaoA)).toBe("veio");

    await page.reload();
    await expect(linhaDe(page, oficina.inscricaoA).getByTestId("presenca-veio")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(linhaDe(page, oficina.inscricaoA).getByTestId("presenca-faltou")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await outra.close();
  });

  test("um link com um evento que não existe mostra o aviso e nenhuma folha", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/agenda?evento=${randomUUID()}`);

    await expect(
      page.getByText("Esse lançamento não existe mais — talvez tenha sido removido em outro celular."),
    ).toBeVisible();
    await expect(page.getByTestId("folha-evento")).toHaveCount(0);
    await expect(page.getByTestId("agenda-semana")).toBeVisible();
  });
});

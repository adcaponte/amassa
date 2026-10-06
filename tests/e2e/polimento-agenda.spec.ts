import { test, expect, type Page } from "@playwright/test";

import { fraseDataAindaNaoChegou, ROTULO_ABA_RECEBER } from "@/lib/agenda/textos";
import { diaDaSemanaDe, NOMES_CURTOS_DOS_DIAS } from "@/lib/agenda/turma";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { medirCaixa } from "./apoio/medir-caixa";
import {
  presencaNoBanco,
  semearCliente,
  semearInscricao,
  semearOficina,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Fase 06.5, plano 08 (D-12, D-05; achados 16 e 17 do Cowork; POL-05): a Agenda no celular.
// - A aba “Receber” (até 05/10/2026 “A receber”) cabe numa linha a 375 px, com o contador até 99.
// - Marcar presença numa data DEPOIS de hoje avisa e deixa (D-05, UI-D13): o aviso fica acima do
//   “Veio · Faltou”, uma vez por data, e o toque grava como sempre.
// Cada teste cria só o que é dele, com nome único, e nunca afirma estado global do banco — o caso sem
// cobranças (a aba sem contador) é `@vazio-global` e roda na cadeia `vazio-*`, antes de qualquer spec
// criar cobrança.

// Uma aba de uma linha: o `min-h-[44px]` da aba, nunca mais. Duas linhas de `text-corpo` dão 56 px
// (medido antes do conserto do recuo, com “Receber · 20”).
const ALTURA_DE_UMA_LINHA = 44;

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

// A aba visível (o `loading.tsx` também desenha abas; a da página é a que está à vista).
function abaReceber(page: Page) {
  return page
    .locator(`[data-testid="abas-da-agenda"] >> visible=true`)
    .first()
    .getByTestId("aba-receber");
}

async function alturaDaAba(page: Page): Promise<number> {
  return (await medirCaixa(abaReceber(page), "aba “Receber”")).height;
}

test.describe("polimento agenda — aba", () => {
  test("sem cobranças: “Receber”, sem contador, numa linha a 375 px @vazio-global", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await expect(page.getByTestId("agenda-carregando")).toBeHidden();

    await expect(abaReceber(page)).toHaveText(ROTULO_ABA_RECEBER);
    await expect(abaReceber(page)).toHaveText("Receber");
    expect(await alturaDaAba(page)).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);
  });

  test("com cobranças: “Receber · {N}” numa linha a 375 px, marcada ou não, e ainda numa linha com N = 99", async ({
    page,
  }) => {
    // Uma inscrição cobrada numa oficina longe de qualquer data que outro spec conte.
    const suf = sufixoUnico();
    const projeto = test.info().project.name === "celular" ? 1 : 0;
    const clienteId = await semearCliente({ nome: `[e2e] Pessoa ${suf}` });
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina ${suf}`,
      data: somarDiasAoHoje(1800 + projeto),
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 15000,
    });
    await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 15000 });

    await page.setViewportSize({ width: 375, height: 800 });
    await fazerLogin(page);

    // Desmarcada (peso 500), na semana.
    await page.goto("/gestao/agenda");
    await expect(page.getByTestId("agenda-carregando")).toBeHidden();
    await expect(abaReceber(page)).toHaveText(/^Receber · \d+$/);
    expect(await alturaDaAba(page)).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);

    // Marcada (peso 600, o rótulo mais largo).
    await page.goto("/gestao/agenda?aba=receber");
    await expect(page.getByTestId("a-receber")).toBeVisible();
    await expect(abaReceber(page)).toHaveAttribute("aria-selected", "true");
    await expect(abaReceber(page)).toHaveText(/^Receber · \d+$/);
    expect(await alturaDaAba(page)).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);

    // O pior caso do contador (E10): dois dígitos. O número real é global e não se controla daqui; o
    // texto da aba marcada é trocado no navegador e a caixa é medida de novo — a mesma aba, a mesma
    // classe, o mesmo peso. “44” é o par de dígitos mais largo da Inter (98,0 px, medido); “99” é o teto.
    for (const pior of ["Receber · 44", "Receber · 99"]) {
      await abaReceber(page).evaluate((elemento, texto) => {
        elemento.textContent = texto;
      }, pior);
      await expect(abaReceber(page)).toHaveText(pior);
      expect(await alturaDaAba(page), pior).toBeLessThanOrEqual(ALTURA_DE_UMA_LINHA);
    }

    // E nenhuma rolagem lateral da página por isso.
    const larguras = await page.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth,
      tela: document.documentElement.clientWidth,
    }));
    expect(larguras.rolagem).toBeLessThanOrEqual(larguras.tela);
  });
});

// O dia curto do aviso, “qui, 07/10” — a mesma composição da folha.
function diaCurto(data: string): string {
  return `${NOMES_CURTOS_DOS_DIAS[diaDaSemanaDe(data)]}, ${formatarDiaMes(data)}`;
}

// Uma oficina numa data com duas pessoas inscritas — duas linhas de “Veio · Faltou”.
async function semearOficinaComDuas(suf: string, data: string) {
  const eventoId = await semearOficina({
    titulo: `[e2e] Oficina da presença ${suf}`,
    data,
    inicio: "09:00",
    fim: "11:00",
    vagas: 8,
    precoCentavos: 12000,
  });
  const inscricoes: string[] = [];
  for (const indice of [1, 2]) {
    const clienteId = await semearCliente({ nome: `[e2e] Presença ${indice} ${suf}` });
    inscricoes.push(
      await semearInscricao({
        eventoId,
        clienteId,
        tipo: "oficina",
        valorCentavos: 12000,
      }),
    );
  }
  return { eventoId, inscricoes };
}

async function abrirFolha(page: Page, data: string, eventoId: string) {
  await page.goto(`/gestao/agenda?semana=${data}&evento=${eventoId}`);
  const folha = page.getByTestId("folha-evento");
  await expect(folha).toBeVisible();
  await expect(folha.getByTestId("folha-evento-lista")).toBeVisible();
  return folha;
}

function linhaDe(folha: ReturnType<Page["getByTestId"]>, inscricaoId: string) {
  return folha.locator(`[data-testid="inscrito"][data-inscricao-id="${inscricaoId}"]`);
}

test.describe("polimento agenda — presença", () => {
  test("data depois de hoje: o aviso com a data, uma vez, acima do “Veio · Faltou”; “Veio” grava e continua ao reabrir", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // “Hoje” é o de Brasília (`hojeNoAtelie`), o mesmo que o servidor entrega à semana.
    const daquiADois = somarDiasAoHoje(2);
    const { eventoId, inscricoes } = await semearOficinaComDuas(suf, daquiADois);

    await fazerLogin(page);
    const folha = await abrirFolha(page, daquiADois, eventoId);

    const aviso = folha.getByTestId("presenca-aviso-futuro");
    await expect(aviso).toHaveCount(1);
    await expect(aviso).toHaveAttribute("role", "status");
    await expect(aviso).toHaveText(fraseDataAindaNaoChegou(diaCurto(daquiADois)));
    await expect(aviso).toContainText(`(${diaCurto(daquiADois)})`);
    // Acima da lista (onde fica o “Veio · Faltou” de cada pessoa), nunca por pessoa.
    const caixaDoAviso = await medirCaixa(aviso);
    const caixaDaLista = await medirCaixa(folha.getByTestId("folha-evento-lista"));
    expect(caixaDoAviso.y + caixaDoAviso.height).toBeLessThanOrEqual(caixaDaLista.y);
    await expect(
      folha.getByTestId("folha-evento-lista").getByTestId("presenca-aviso-futuro"),
    ).toHaveCount(0);

    // Avisa e deixa: o segmentado está habilitado, e o toque grava.
    const primeira = linhaDe(folha, inscricoes[0]);
    const veio = primeira.getByTestId("presenca-veio");
    await expect(veio).toBeEnabled();
    await veio.click();
    await expect(veio).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => presencaNoBanco(inscricoes[0]), { timeout: 10_000 })
      .toBe("veio");
    expect(await presencaNoBanco(inscricoes[1])).toBeNull();

    // Reabrir: a marcação persiste, e o aviso continua (a data ainda não chegou).
    const deNovo = await abrirFolha(page, daquiADois, eventoId);
    await expect(
      linhaDe(deNovo, inscricoes[0]).getByTestId("presenca-veio"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(deNovo.getByTestId("presenca-aviso-futuro")).toHaveCount(1);
  });

  test("data de hoje: nenhum aviso, e o “Veio · Faltou” como sempre", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const hoje = hojeNoAtelie();
    const { eventoId, inscricoes } = await semearOficinaComDuas(suf, hoje);

    await fazerLogin(page);
    const folha = await abrirFolha(page, hoje, eventoId);

    await expect(
      linhaDe(folha, inscricoes[0]).getByTestId("presenca-veio"),
    ).toBeEnabled();
    await expect(folha.getByTestId("presenca-aviso-futuro")).toHaveCount(0);
  });
});

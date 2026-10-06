import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  cancelarOrdemNoBanco,
  etapasDaOrdemNoBanco,
  semearFicha,
  semearOrdem,
  type PecaParaSemear,
} from "./apoio/semear-producao";
import {
  lerContagem,
  semearContagem,
  semearForno,
  semearQueimaSemContagem,
} from "./apoio/semear-queimas";

// Os atalhos da folha "O que queimou?" (06.4-03-PLAN.md): os chips das ordens da Produção que
// esperam a queima (D-06, SÓ LEITURA) e "Repetir a última" do mesmo forno e tipo (D-01). Sem etiqueta
// de vazio: cada teste cadastra o próprio forno, de nome único, e roda em `desktop`/`celular`.
//
// Os chips são GLOBAIS (toda ordem ativa em `queima1` aparece em toda folha de biscoito): o teste
// acha o SEU chip por `data-ordem-id` e nunca afirma quantos chips há. No fim, cada teste cancela a
// própria ordem pelo banco (depois de provar que a Produção ficou intocada), para não semear chips
// nas folhas dos outros specs.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixo(): string {
  return `${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cartaoDoForno(page: Page, nome: string): Locator {
  return page.locator('[data-testid^="cartao-forno-"]').filter({ hasText: nome });
}

// Um forno de nome único, pelo banco, e a página do índice aberta.
async function abrirComFornoNovo(page: Page): Promise<string> {
  const nome = `[e2e] atalhos ${sufixo()}`;
  await semearForno(nome);
  await page.goto("/gestao/queimas");
  await expect(cartaoDoForno(page, nome)).toBeVisible({ timeout: 10000 });
  return nome;
}

// Registra uma queima pelo cartão (dois toques) e devolve o id da folha que abriu.
async function registrarEAbrirFolha(
  page: Page,
  nomeDoForno: string,
  tipo: "biscoito" | "esmalte" | "ouro",
): Promise<string> {
  const cartao = cartaoDoForno(page, nomeDoForno);
  await cartao.scrollIntoViewIfNeeded();
  await cartao.getByRole("button", { name: "Queimar" }).click();
  await cartao.getByTestId(`tipo-queima-${tipo}`).click();
  const folha = page.getByTestId("folha-contagem");
  await expect(folha).toBeVisible({ timeout: 5000 });
  return (await folha.getAttribute("data-queima-id")) ?? "";
}

async function semearFichaComMaiorLado(maiorMm: number, rotulo: string): Promise<string> {
  const { fichaId } = await semearFicha({
    nome: `[e2e] ficha ${rotulo} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    exclusiva: true,
    comItem: false,
    argilaMiligramas: 0,
    esmalteMiligramas: 0,
    larguraMm: maiorMm,
    profundidadeMm: Math.round(maiorMm / 2),
    alturaMm: Math.round(maiorMm / 4),
    horasMilesimos: 0,
  });
  return fichaId;
}

// Uma ordem ATIVA da casa com produção e secagem feitas: a etapa atual é `queima1` (biscoito).
async function semearOrdemEmBiscoito(
  nome: string,
  pecas: PecaParaSemear[],
  passaramNaAtual: number,
): Promise<string> {
  return semearOrdem({
    nome,
    tipo: "casa",
    caminho: "completo",
    status: "ativa",
    inicio: somarDiasAoHoje(-3),
    etapasFeitas: [
      { etapa: "producao", feitaEm: somarDiasAoHoje(-2) },
      { etapa: "secagem", feitaEm: somarDiasAoHoje(-1) },
    ],
    pecas,
    passaramNaAtual,
  });
}

function chipDaOrdem(page: Page, ordemId: string): Locator {
  return page
    .getByTestId("folha-contagem")
    .locator(`[data-testid="chip-ordem"][data-ordem-id="${ordemId}"]`);
}

test.describe("chips da produção", () => {
  test("um toque soma as pendentes nas internas pelo tamanho da ficha, Salvar grava, e a Produção fica intocada", async ({
    page,
  }) => {
    const [fichaP, fichaM] = await Promise.all([
      semearFichaComMaiorLado(80, "P"),
      semearFichaComMaiorLado(200, "M"),
    ]);
    const nomeDaOrdem = `[e2e] ordem chips ${sufixo()}`;
    const ordemId = await semearOrdemEmBiscoito(
      nomeDaOrdem,
      [
        { descricao: `[e2e] peça P de ${nomeDaOrdem}`, quantidade: 10, fichaId: fichaP },
        { descricao: `[e2e] peça M de ${nomeDaOrdem}`, quantidade: 6, fichaId: fichaM },
      ],
      4,
    );
    try {
      const antes = await etapasDaOrdemNoBanco(ordemId);

      await fazerLogin(page);
      const forno = await abrirComFornoNovo(page);
      const queimaId = await registrarEAbrirFolha(page, forno, "biscoito");
      const folha = page.getByTestId("folha-contagem");

      // 16 feitas, 4 já passaram: +12, 8 de P e 4 de M pela régua 10/25.
      const chip = chipDaOrdem(page, ordemId);
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText(`+12 · ${nomeDaOrdem}`);
      await expect(chip).toHaveAttribute("data-somado", "false");
      await expect(chip).toHaveAttribute("aria-label", `Somar 12 peças de ${nomeDaOrdem} às internas`);
      // O nome longo quebra dentro do chip (UI E3·long-text): nada de rolagem de lado.
      const larguras = await page.evaluate(() => ({
        rolagem: document.documentElement.scrollWidth,
        tela: document.documentElement.clientWidth,
      }));
      expect(larguras.rolagem).toBeLessThanOrEqual(larguras.tela);
      const caixa = await medirCaixa(chip, "chip do atalho");
      expect(caixa.height).toBeGreaterThanOrEqual(44);

      await chip.click();
      await expect(folha.getByTestId("contador-internas-p")).toHaveValue("8");
      await expect(folha.getByTestId("contador-internas-m")).toHaveValue("4");
      await expect(folha.getByTestId("contador-internas-g")).toHaveValue("0");
      await expect(chip).toHaveAttribute("data-somado", "true");
      await expect(chip).toBeDisabled();
      await expect(chip).toHaveText(`+12 · ${nomeDaOrdem} · somado`);
      await expect(folha.getByTestId("contagem-resumo")).toHaveText("12 peças");

      await folha.getByTestId("contagem-salvar").click();
      await expect(folha).toBeHidden({ timeout: 10000 });
      await expect
        .poll(async () => {
          const lida = await lerContagem(queimaId);
          return lida === null ? null : [lida.internas_p, lida.internas_m, lida.internas_g];
        }, { timeout: 10000 })
        .toEqual([8, 4, 0]);

      // Só leitura (QMC-06, U20): as etapas da ordem — `passaram` e `feita_em` — iguais às de antes.
      expect(await etapasDaOrdemNoBanco(ordemId)).toEqual(antes);
    } finally {
      await cancelarOrdemNoBanco(ordemId, somarDiasAoHoje(-3));
    }
  });

  test("ouro não tem chips", async ({ page }) => {
    const ficha = await semearFichaComMaiorLado(80, "P");
    const nomeDaOrdem = `[e2e] ordem chips ouro ${sufixo()}`;
    const ordemId = await semearOrdemEmBiscoito(
      nomeDaOrdem,
      [{ descricao: `[e2e] peça de ${nomeDaOrdem}`, quantidade: 3, fichaId: ficha }],
      0,
    );
    try {
      await fazerLogin(page);
      const forno = await abrirComFornoNovo(page);
      await registrarEAbrirFolha(page, forno, "ouro");
      const folha = page.getByTestId("folha-contagem");
      await expect(folha.getByTestId("contagem-titulo")).toBeVisible();
      await expect(folha.getByTestId("chip-ordem")).toHaveCount(0);
      await expect(folha.getByTestId("contagem-chips")).toHaveCount(0);
    } finally {
      await cancelarOrdemNoBanco(ordemId, somarDiasAoHoje(-3));
    }
  });

  test("peça sem medida pergunta o tamanho antes de somar", async ({ page }) => {
    const ficha = await semearFichaComMaiorLado(80, "P");
    const nomeDaOrdem = `[e2e] ordem sem medida ${sufixo()}`;
    const ordemId = await semearOrdemEmBiscoito(
      nomeDaOrdem,
      [
        { descricao: `[e2e] peça P de ${nomeDaOrdem}`, quantidade: 5, fichaId: ficha },
        // Sem ficha e sem item: "sem medida" (D-06).
        {
          descricao: `[e2e] peça sem ficha de ${nomeDaOrdem}`,
          quantidade: 3,
          fichaId: null,
          itemCatalogoId: null,
        },
      ],
      0,
    );
    try {
      await fazerLogin(page);
      const forno = await abrirComFornoNovo(page);
      await registrarEAbrirFolha(page, forno, "biscoito");
      const folha = page.getByTestId("folha-contagem");
      const chip = chipDaOrdem(page, ordemId);
      await expect(chip).toHaveText(`+8 · ${nomeDaOrdem}`);

      // O toque NÃO soma nada: abre a pergunta, com o foco no "P".
      await chip.click();
      const pergunta = folha.getByTestId("pergunta-tamanho");
      await expect(pergunta).toBeVisible();
      await expect(pergunta).toHaveAttribute("role", "group");
      await expect(pergunta).toHaveAttribute(
        "aria-label",
        `“${nomeDaOrdem}”: 3 peças sem medida na ficha. Em que tamanho elas entram?`,
      );
      await expect(folha.getByTestId("pergunta-tamanho-p")).toBeFocused();
      await expect(folha.getByTestId("pergunta-tamanho-g")).toHaveAttribute(
        "aria-label",
        "Somar 3 como G",
      );
      await expect(folha.getByTestId("contador-internas-p")).toHaveValue("0");
      await expect(folha.getByTestId("contador-internas-g")).toHaveValue("0");

      // "Não somar agora": fecha sem somar nada; o chip volta a tocável, com o foco.
      await folha.getByTestId("pergunta-tamanho-nao-somar").click();
      await expect(pergunta).toBeHidden();
      await expect(folha.getByTestId("contador-internas-p")).toHaveValue("0");
      await expect(chip).toHaveAttribute("data-somado", "false");
      await expect(chip).toBeFocused();

      // De novo, agora "G": a parte medida (5 P) e as 3 sem medida em G, de uma vez.
      await chip.click();
      await folha.getByTestId("pergunta-tamanho-g").click();
      await expect(pergunta).toBeHidden();
      await expect(folha.getByTestId("contador-internas-p")).toHaveValue("5");
      await expect(folha.getByTestId("contador-internas-m")).toHaveValue("0");
      await expect(folha.getByTestId("contador-internas-g")).toHaveValue("3");
      await expect(chip).toHaveAttribute("data-somado", "true");
      await expect(chip).toBeDisabled();
      await expect(chip).toContainText(" · somado");
    } finally {
      await cancelarOrdemNoBanco(ordemId, somarDiasAoHoje(-3));
    }
  });
});

// "dd/mm" do instante em Brasília — o dia civil que a dica mostra (nunca o dia UTC).
function diaMesEmBrasilia(instante: string): string {
  const [, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(instante))
    .split("-");
  return `${dia}/${mes}`;
}

function horasAtras(horas: number): string {
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
}

test.describe("repetir a última", () => {
  test("copia a última contada do mesmo forno e tipo, nunca a própria; sem anterior fica desabilitado", async ({
    page,
  }) => {
    const email = process.env.E2E_EMAIL_TESTE ?? "";
    const forno = `[e2e] repetir ${sufixo()}`;
    await semearForno(forno);
    // A (biscoito, mais antiga), B (biscoito, mais recente) e C (esmalte, mais recente que as duas —
    // outro tipo, nunca escolhida para biscoito).
    const instanteA = horasAtras(72);
    const instanteB = horasAtras(24);
    const queimaA = await semearQueimaSemContagem(forno, email, instanteA, "biscoito");
    const queimaB = await semearQueimaSemContagem(forno, email, instanteB, "biscoito");
    const queimaC = await semearQueimaSemContagem(forno, email, horasAtras(2), "esmalte");
    await semearContagem(queimaA, { internasP: 3, internasM: 2, externasG: 1, saiuCheio: true });
    await semearContagem(queimaB, {
      internasP: 10,
      internasM: 5,
      internasG: 2,
      externasP: 1,
      saiuCheio: false,
    });
    await semearContagem(queimaC, { internasP: 40 });

    await fazerLogin(page);
    await page.goto("/gestao/queimas");
    await expect(cartaoDoForno(page, forno)).toBeVisible({ timeout: 10000 });
    await registrarEAbrirFolha(page, forno, "biscoito");
    const folha = page.getByTestId("folha-contagem");
    const repetir = folha.getByTestId("contagem-repetir");
    const dica = folha.getByTestId("contagem-repetir-dica");

    await expect(repetir).toHaveText("Repetir a última");
    await expect(repetir).toBeEnabled();
    await expect(dica).toHaveText(`copia Biscoito de ${diaMesEmBrasilia(instanteB)}: 18 peças`);

    // Duas vezes: sobrescreve, nunca soma.
    await repetir.click();
    await repetir.click();
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("10");
    await expect(folha.getByTestId("contador-internas-m")).toHaveValue("5");
    await expect(folha.getByTestId("contador-internas-g")).toHaveValue("2");
    await expect(folha.getByTestId("contador-externas-p")).toHaveValue("1");
    await expect(folha.getByTestId("contador-externas-g")).toHaveValue("0");
    await expect(folha.getByTestId("contagem-saiu-cheio")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    await folha.getByTestId("contagem-pular").click();
    await expect(folha).toBeHidden({ timeout: 10000 });

    // Corrigindo B pelo Histórico, "Repetir" aponta a ANTERIOR a ela (A) — nunca a própria.
    await cartaoDoForno(page, forno).getByRole("link", { name: forno }).click();
    await expect(page).toHaveURL(/\/gestao\/queimas\/[0-9a-f-]{36}$/, { timeout: 10000 });
    await page.getByTestId(`corrigir-contagem-${queimaB}`).click();
    await expect(folha).toBeVisible({ timeout: 5000 });
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("10");
    await expect(dica).toHaveText(`copia Biscoito de ${diaMesEmBrasilia(instanteA)}: 6 peças`);
    await repetir.click();
    await expect(folha.getByTestId("contador-internas-p")).toHaveValue("3");
    await expect(folha.getByTestId("contador-internas-m")).toHaveValue("2");
    await expect(folha.getByTestId("contador-internas-g")).toHaveValue("0");
    await expect(folha.getByTestId("contador-externas-p")).toHaveValue("0");
    await expect(folha.getByTestId("contador-externas-g")).toHaveValue("1");
    await expect(folha.getByTestId("contagem-saiu-cheio")).toHaveAttribute("data-state", "checked");
    await folha.getByTestId("contagem-fechar-sem-salvar").click();
    await expect(folha).toBeHidden({ timeout: 10000 });

    // Ouro neste forno: nenhuma anterior → desabilitado, com a dica do porquê ligada por aria.
    await page.goto("/gestao/queimas");
    await registrarEAbrirFolha(page, forno, "ouro");
    await expect(repetir).toBeDisabled();
    await expect(dica).toHaveText("Ainda não há outra fornada de ouro contada neste forno.");
    const idDaDica = await dica.getAttribute("id");
    expect(idDaDica).toBeTruthy();
    await expect(repetir).toHaveAttribute("aria-describedby", idDaDica ?? "");
    await folha.getByTestId("contagem-pular").click();
    await expect(folha).toBeHidden({ timeout: 10000 });
  });
});

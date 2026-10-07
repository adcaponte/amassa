import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { diaEmBrasilia, semearOrdem } from "./apoio/semear-producao";

// A linha do tempo da Produção (plano 09, critério 4 do ROADMAP; PRD-07, D-06, UI-D18).
//
// Desktop e celular, em paralelo com o resto da suíte: cada caso semeia as SUAS ordens (sufixo
// único) e as acha pelo id — nenhuma afirmação global do banco. O intervalo desenhado depende de
// TODAS as ordens liberadas (inclusive as de outras specs), por isso a posição da linha de hoje é
// recalculada pelos `data-*` que o próprio painel expõe, nunca presumida.
//
// Nomes inventados, prefixo `[e2e]` — nenhum dado real.

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

// Dias entre duas datas civis `YYYY-MM-DD` (UTC só como régua de dias inteiros).
function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

function linhaDaOrdem(page: Page, ordemId: string): Locator {
  return page.getByTestId(`linha-do-tempo-ordem-${ordemId}`);
}

function segmento(linha: Locator, etapa: string, tipo: "cheio" | "listrado"): Locator {
  return linha.locator(
    `[data-testid="linha-do-tempo-segmento"][data-etapa="${etapa}"][data-tipo="${tipo}"]`,
  );
}

async function abrirLinhaDoTempo(page: Page) {
  await page.goto("/gestao/producao");
  const aba = page.getByRole("tab", { name: "Linha do tempo" });
  await aba.click();
  await expect(aba).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("producao-linha-do-tempo")).toBeVisible();
}

test.describe("producao linha do tempo", () => {
  test("(a) cheio do que aconteceu, listrado do previsto, o traço da entrega e a linha de hoje no lugar", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const hoje = diaEmBrasilia(0);
    const entrega = diaEmBrasilia(40);
    const ordemId = await semearOrdem({
      nome: `[e2e] Pratos na secagem ${sufixo}`,
      tipo: "encomenda",
      caminho: "completo",
      status: "ativa",
      inicio: diaEmBrasilia(-10),
      // Produção feita há 6 dias; secagem é a atual (4 de 15 dias) — cheio até hoje + listrado.
      etapasFeitas: [{ etapa: "producao", feitaEm: diaEmBrasilia(-6) }],
      pecas: [{ descricao: `[e2e] Prato ${sufixo}`, quantidade: 6 }],
      clienteNome: `[e2e] Cliente ${sufixo}`,
      entregaPrometida: entrega,
    });

    await fazerLogin(page);
    await abrirLinhaDoTempo(page);

    const alternador = page.getByRole("tablist", { name: "Ver a produção como" });
    await expect(alternador).toBeVisible();
    await expect(page.getByRole("tab", { name: "Quadro por etapa" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(
      page.getByRole("region", { name: "Linha do tempo das ordens — rola para os lados" }),
    ).toBeVisible();

    const linha = linhaDaOrdem(page, ordemId);
    await expect(linha).toBeVisible();
    // A coluna fixa: link para a ordem com o nome acessível inteiro.
    const link = linha.getByTestId("linha-do-tempo-link");
    await expect(link).toHaveAttribute("href", `/gestao/producao/${ordemId}`);
    await expect(link).toHaveAttribute("aria-label", /^\[e2e\] Pratos na secagem .*: Secagem, /);

    await expect(segmento(linha, "producao", "cheio")).toHaveCount(1);
    await expect(segmento(linha, "producao", "cheio")).toHaveAttribute(
      "aria-label",
      /^Produção: feita em \d{2}\/\d{2}, levou 4 dias$/,
    );
    await expect(segmento(linha, "producao", "listrado")).toHaveCount(0);
    await expect(segmento(linha, "secagem", "cheio")).toHaveCount(1);
    await expect(segmento(linha, "secagem", "listrado")).toHaveCount(1);
    await expect(segmento(linha, "secagem", "cheio")).toHaveAttribute(
      "aria-label",
      "Secagem: etapa atual, há 6 dias, previsto 15",
    );
    for (const futura of ["queima1", "esmaltacao", "queima2", "entrega"]) {
      await expect(segmento(linha, futura, "listrado")).toHaveCount(1);
      await expect(segmento(linha, futura, "cheio")).toHaveCount(0);
    }

    const tracoDaEntrega = linha.getByTestId("linha-do-tempo-entrega");
    await expect(tracoDaEntrega).toHaveCount(1);
    await expect(tracoDaEntrega).toHaveAttribute(
      "aria-label",
      `Entrega prometida: ${entrega.slice(8, 10)}/${entrega.slice(5, 7)}`,
    );

    // A linha de hoje na posição que o e2e recalcula: (hoje − primeiro dia) × px por dia, medida a
    // partir do começo da régua (as duas rolam juntas).
    const painel = page.getByTestId("producao-linha-do-tempo");
    const primeiroDia = await painel.getAttribute("data-primeiro-dia");
    const pxPorDia = Number(await painel.getAttribute("data-px-por-dia"));
    await expect(painel).toHaveAttribute("data-hoje", hoje);
    expect(primeiroDia).not.toBeNull();
    expect(pxPorDia).toBe(12);
    const esperado = diasEntre(primeiroDia as string, hoje) * pxPorDia;

    const caixaDaRegua = await medirCaixa(page.getByTestId("linha-do-tempo-regua"), "régua");
    const caixaDeHoje = await medirCaixa(page.getByTestId("linha-do-tempo-hoje"), "linha de hoje");
    expect(Math.abs(caixaDeHoje.x - caixaDaRegua.x - esperado)).toBeLessThanOrEqual(1);

    // O cheio da secagem termina na linha de hoje e o listrado começa nela.
    const caixaDoCheio = await medirCaixa(segmento(linha, "secagem", "cheio"), "secagem cheia");
    const caixaDoListrado = await medirCaixa(segmento(linha, "secagem", "listrado"), "secagem listrada");
    expect(Math.abs(caixaDoCheio.x + caixaDoCheio.width - caixaDeHoje.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(caixaDoListrado.x - caixaDeHoje.x)).toBeLessThanOrEqual(1);

    // A legenda embaixo.
    await expect(
      page.getByText("cor cheia = já aconteceu · listrado = previsto · linha vertical = hoje"),
    ).toBeVisible();
  });

  test("(b) ordem aguardando o sinal não tem linha — só aparece na seção Aguardando o sinal", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const [liberada, aguardando] = await Promise.all([
      semearOrdem({
        nome: `[e2e] Canecas liberadas ${sufixo}`,
        tipo: "casa",
        caminho: "completo",
        status: "ativa",
        inicio: diaEmBrasilia(-1),
        etapasFeitas: [],
        pecas: [{ descricao: `[e2e] Caneca ${sufixo}`, quantidade: 4 }],
        clienteNome: null,
      }),
      semearOrdem({
        nome: `[e2e] Tigelas esperando ${sufixo}`,
        tipo: "encomenda",
        caminho: "completo",
        status: "aguardando_sinal",
        inicio: null,
        etapasFeitas: [],
        pecas: [{ descricao: `[e2e] Tigela ${sufixo}`, quantidade: 3 }],
        clienteNome: `[e2e] Cliente ${sufixo}`,
      }),
    ]);

    await fazerLogin(page);
    await abrirLinhaDoTempo(page);

    await expect(linhaDaOrdem(page, liberada)).toBeVisible();
    await expect(linhaDaOrdem(page, aguardando)).toHaveCount(0);
    // A seção "Aguardando o sinal" aparece nas duas vistas.
    await expect(
      page.getByTestId("producao-aguardando").locator(`[data-ordem-id="${aguardando}"]`),
    ).toBeVisible();
  });

  test("(c) a escolha fica no cookie: recarregar abre na Linha do tempo, já no HTML do servidor", async ({
    page,
    context,
  }) => {
    const sufixo = sufixoUnico();
    await semearOrdem({
      nome: `[e2e] Vasos lembrados ${sufixo}`,
      tipo: "casa",
      caminho: "biscoito",
      status: "ativa",
      inicio: diaEmBrasilia(-3),
      etapasFeitas: [],
      pecas: [{ descricao: `[e2e] Vaso ${sufixo}`, quantidade: 2 }],
      clienteNome: null,
    });

    await fazerLogin(page);
    await page.goto("/gestao/producao");
    // Sem cookie, abre no quadro.
    await expect(page.getByRole("tab", { name: "Quadro por etapa" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("producao-quadro")).toBeVisible();

    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    await expect(page.getByTestId("producao-linha-do-tempo")).toBeVisible();
    // Escolher de novo a mesma vista não muda nada.
    await page.getByRole("tab", { name: "Linha do tempo" }).click();
    await expect(page.getByTestId("producao-linha-do-tempo")).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "producao_vista");
    expect(cookie?.value).toBe("tempo");
    expect(cookie?.path).toBe("/gestao");

    await page.reload();
    await expect(page.getByRole("tab", { name: "Linha do tempo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("producao-linha-do-tempo")).toBeVisible();
    await expect(page.getByTestId("producao-quadro")).toHaveCount(0);

    // O HTML que o servidor manda já vem na Linha do tempo — nunca pinta o quadro para trocar depois.
    const resposta = await page.request.get("/gestao/producao");
    expect(resposta.ok()).toBe(true);
    const html = await resposta.text();
    expect(html).toContain('data-testid="producao-linha-do-tempo"');
    expect(html).not.toContain('data-testid="producao-quadro"');
  });

  test("(d) teclado: Tab chega à região rolável e a seta para a direita rola", async ({ page }) => {
    const sufixo = sufixoUnico();
    // Uma ordem longa (começou há 120 dias, entrega daqui a 90): a linha do tempo fica mais larga
    // que qualquer tela, com espaço para rolar dos dois lados de hoje.
    await semearOrdem({
      nome: `[e2e] Painel longo ${sufixo}`,
      tipo: "encomenda",
      caminho: "completo",
      status: "ativa",
      inicio: diaEmBrasilia(-120),
      etapasFeitas: [{ etapa: "producao", feitaEm: diaEmBrasilia(-110) }],
      pecas: [{ descricao: `[e2e] Painel ${sufixo}`, quantidade: 1 }],
      clienteNome: `[e2e] Cliente ${sufixo}`,
      entregaPrometida: diaEmBrasilia(90),
    });

    await fazerLogin(page);
    await abrirLinhaDoTempo(page);

    const regiao = page.getByTestId("linha-do-tempo-area");
    // A aba marcada tem o foco depois do clique; o próximo Tab é a região (tabindex itinerante: a
    // outra aba não entra no Tab).
    await page.getByRole("tab", { name: "Linha do tempo" }).focus();
    await page.keyboard.press("Tab");
    await expect(regiao).toBeFocused();

    const antes = await regiao.evaluate((elemento) => elemento.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => regiao.evaluate((elemento) => elemento.scrollLeft))
      .toBeGreaterThan(antes);
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa, type CaixaMedida } from "./apoio/medir-caixa";
import { diaEmBrasilia, semearFicha, semearOrdem } from "./apoio/semear-producao";

// O quadro da Produção (plano 08, critério 3 do ROADMAP; PRD-01, PRD-05, PRD-13).
//
// Três blocos:
//
// 1. `producao quadro` — desktop e celular, em paralelo com o resto da suíte: cada caso semeia as
//    SUAS ordens (sufixo único) e as acha pelo `data-ordem-id`. Nenhuma afirmação global do banco —
//    os três números aqui nunca são conferidos por valor exato.
// 2. `producao numeros @vazio-historico` — SERIAL, no projeto `vazio-historico` da cadeia de
//    `dependencies` do `playwright.config.ts` (depois dos `vazio-*` só de leitura, antes de
//    `desktop`/`celular`): é o único ponto em que nenhuma outra ordem de produção existe, e por isso
//    o único lugar em que os três números exatos podem ser afirmados (Pitfall 12). Nunca por
//    `--grep` como muleta (CLAUDE.md).
// 3. `producao vazia @vazio-global` — só leitura, na cadeia `vazio-*`: sem nenhuma ordem, o vazio
//    total com "Nova ordem" e o cabeçalho sem botões (UI-D11).
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

function cartao(page: Page, ordemId: string): Locator {
  return page.locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`);
}

function cartaoNoQuadro(page: Page, ordemId: string): Locator {
  return page.getByTestId("producao-quadro").locator(`[data-ordem-id="${ordemId}"]`);
}

function cartaoAguardando(page: Page, ordemId: string): Locator {
  return page.getByTestId("producao-aguardando").locator(`[data-ordem-id="${ordemId}"]`);
}

async function semearAtiva(dados: {
  nome: string;
  tipo: "encomenda" | "casa";
  quantidade?: number;
  aMais?: number;
  passaramNaAtual?: number | null;
  entregaPrometida?: string | null;
  etapasFeitas?: { etapa: "producao" | "secagem"; feitaEm: string }[];
  fichaId?: string | null;
}): Promise<string> {
  return semearOrdem({
    nome: dados.nome,
    tipo: dados.tipo,
    caminho: "completo",
    status: "ativa",
    inicio: diaEmBrasilia(-2),
    etapasFeitas: dados.etapasFeitas ?? [],
    pecas: [
      {
        descricao: `[e2e] Peça de ${dados.nome}`,
        quantidade: dados.quantidade ?? 6,
        aMais: dados.aMais ?? 0,
        fichaId: dados.fichaId ?? null,
      },
    ],
    clienteNome: dados.tipo === "encomenda" ? `[e2e] Cliente de ${dados.nome}` : null,
    entregaPrometida: dados.entregaPrometida ?? null,
    passaramNaAtual: dados.passaramNaAtual ?? null,
  });
}

async function semearAguardando(dados: {
  nome: string;
  tipo: "encomenda" | "casa";
  quantidade?: number;
}): Promise<string> {
  return semearOrdem({
    nome: dados.nome,
    tipo: dados.tipo,
    caminho: "completo",
    status: "aguardando_sinal",
    inicio: null,
    etapasFeitas: [],
    pecas: [{ descricao: `[e2e] Peça de ${dados.nome}`, quantidade: dados.quantidade ?? 4 }],
    clienteNome: dados.tipo === "encomenda" ? `[e2e] Cliente de ${dados.nome}` : null,
  });
}

test.describe("producao quadro", () => {
  test("(a) as pílulas filtram o quadro e a seção aguardando: Encomendas, Da casa e Tudo", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const [encomendaAtiva, casaAtiva, encomendaAguardando, casaAguardando] = await Promise.all([
      semearAtiva({ nome: `[e2e] Pratos encomendados ${sufixo}`, tipo: "encomenda" }),
      semearAtiva({ nome: `[e2e] Canecas da casa ${sufixo}`, tipo: "casa" }),
      semearAguardando({ nome: `[e2e] Tigelas esperando ${sufixo}`, tipo: "encomenda" }),
      semearAguardando({ nome: `[e2e] Bules esperando ${sufixo}`, tipo: "casa" }),
    ]);

    await fazerLogin(page);
    await page.goto("/gestao/producao");

    const grupo = page.getByRole("group", { name: "Filtrar ordens" });
    await expect(grupo).toBeVisible();
    const tudo = page.getByTestId("producao-filtro-todas");
    const encomendas = page.getByTestId("producao-filtro-encomenda");
    const daCasa = page.getByTestId("producao-filtro-casa");
    await expect(tudo).toHaveText("Tudo");
    await expect(encomendas).toHaveText("Encomendas");
    await expect(daCasa).toHaveText("Da casa");
    // Começa em "Tudo" (o filtro não vai para a URL).
    await expect(tudo).toHaveAttribute("aria-pressed", "true");
    await expect(encomendas).toHaveAttribute("aria-pressed", "false");
    for (const pilula of [tudo, encomendas, daCasa]) {
      const caixa = await medirCaixa(pilula);
      expect(caixa.height).toBeGreaterThanOrEqual(44);
    }

    await expect(cartaoNoQuadro(page, encomendaAtiva)).toBeVisible();
    await expect(cartaoNoQuadro(page, casaAtiva)).toBeVisible();
    await expect(cartaoAguardando(page, encomendaAguardando)).toBeVisible();
    await expect(cartaoAguardando(page, casaAguardando)).toBeVisible();

    await encomendas.click();
    await expect(encomendas).toHaveAttribute("aria-pressed", "true");
    await expect(tudo).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/filtro|encomenda=/);
    await expect(cartaoNoQuadro(page, encomendaAtiva)).toBeVisible();
    await expect(cartao(page, casaAtiva)).toHaveCount(0);
    await expect(cartaoAguardando(page, encomendaAguardando)).toBeVisible();
    await expect(cartao(page, casaAguardando)).toHaveCount(0);

    await daCasa.click();
    await expect(daCasa).toHaveAttribute("aria-pressed", "true");
    await expect(cartao(page, encomendaAtiva)).toHaveCount(0);
    await expect(cartaoNoQuadro(page, casaAtiva)).toBeVisible();
    await expect(cartao(page, encomendaAguardando)).toHaveCount(0);
    await expect(cartaoAguardando(page, casaAguardando)).toBeVisible();

    await tudo.click();
    await expect(cartaoNoQuadro(page, encomendaAtiva)).toBeVisible();
    await expect(cartaoNoQuadro(page, casaAtiva)).toBeVisible();
    await expect(cartaoAguardando(page, encomendaAguardando)).toBeVisible();
    await expect(cartaoAguardando(page, casaAguardando)).toBeVisible();
  });

  test("(b) o cartão mostra cliente ou “da casa”, a mais, o parcial e o selo — e nenhuma hora", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    const nomeEncomenda = `[e2e] Jogo de jantar ${sufixo}`;
    // Começou há 2 dias, entrega em 2 dias: a previsão (32 dias de caminho) passa da entrega → "vai
    // atrasar".
    const [encomenda, casa] = await Promise.all([
      semearAtiva({
        nome: nomeEncomenda,
        tipo: "encomenda",
        quantidade: 30,
        aMais: 2,
        passaramNaAtual: 18,
        entregaPrometida: diaEmBrasilia(2),
      }),
      semearAtiva({ nome: `[e2e] Pratinhos da casa ${sufixo}`, tipo: "casa", quantidade: 1 }),
    ]);

    await fazerLogin(page);
    await page.goto("/gestao/producao");

    const doCliente = cartaoNoQuadro(page, encomenda);
    await expect(doCliente).toContainText(nomeEncomenda);
    await expect(doCliente).toContainText(`[e2e] Cliente de ${nomeEncomenda}`);
    await expect(doCliente).toContainText("30 peças + 2 a mais");
    await expect(doCliente.getByTestId("producao-cartao-parcial")).toHaveText(
      "18 de 32 já passaram",
    );
    await expect(doCliente).toContainText("há 2 dias nesta etapa · previsto 5");
    await expect(doCliente).toContainText("entrega ");
    await expect(doCliente.getByTestId("producao-selo")).toHaveAttribute("data-selo", "vai-atrasar");
    await expect(doCliente.getByTestId("producao-selo")).toContainText("vai atrasar");

    const daCasa = cartaoNoQuadro(page, casa);
    await expect(daCasa).toContainText("da casa");
    await expect(daCasa).toContainText("1 peça");
    await expect(daCasa).not.toContainText("a mais");
    await expect(daCasa).not.toContainText("já passaram");
    await expect(daCasa).not.toContainText("entrega ");
    await expect(daCasa.getByTestId("producao-selo")).toHaveAttribute("data-selo", "no-ritmo");

    // PRD-05: nenhuma hora de trabalho no quadro — nem no cartão, nem nos números, nem na coluna.
    for (const trecho of [doCliente, daCasa, page.getByTestId("producao-numeros")]) {
      const texto = await trecho.innerText();
      expect(texto).not.toMatch(/\d\s*h(\s|$)/m);
    }
    // O cartão é um link para a ordem.
    await expect(doCliente).toHaveAttribute("href", `/gestao/producao/${encomenda}`);
  });

  test("(c) seis colunas lado a lado a partir de 1280px; no celular, seções empilhadas — nunca rolagem de lado", async ({
    page,
  }) => {
    const sufixo = sufixoUnico();
    await semearAtiva({ nome: `[e2e] Vasos ${sufixo}`, tipo: "casa" });

    await fazerLogin(page);
    await page.goto("/gestao/producao");

    const etapas = ["producao", "secagem", "queima1", "esmaltacao", "queima2", "entrega"];
    const caixas: CaixaMedida[] = [];
    for (const etapa of etapas) {
      const coluna = page.getByTestId(`producao-coluna-${etapa}`);
      await expect(coluna).toBeVisible();
      caixas.push(await medirCaixa(coluna, `coluna ${etapa}`));
    }
    const noCelular = test.info().project.name === "celular";
    if (noCelular) {
      // Empilhadas: mesma coluna x, cada uma abaixo da anterior.
      for (let i = 1; i < caixas.length; i++) {
        expect(Math.round(caixas[i].x)).toBe(Math.round(caixas[0].x));
        expect(caixas[i].y).toBeGreaterThan(caixas[i - 1].y);
      }
    } else {
      // Desktop Chrome = 1280px de largura: seis colunas na mesma linha, da esquerda para a direita.
      expect(page.viewportSize()?.width).toBeGreaterThanOrEqual(1280);
      for (let i = 1; i < caixas.length; i++) {
        expect(Math.round(caixas[i].y)).toBe(Math.round(caixas[0].y));
        expect(caixas[i].x).toBeGreaterThan(caixas[i - 1].x);
      }
    }
    // A coluna vazia mostra "—" e diz o porquê ao leitor de tela; o h2 diz quantas.
    const esmaltacao = page.getByTestId("producao-coluna-esmaltacao");
    await expect(esmaltacao.getByRole("heading", { level: 2 })).toHaveAccessibleName(
      /^Esmaltação, \d+ (ordem|ordens)$/,
    );
    const semRolagemDeLado = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(semRolagemDeLado).toBe(true);
  });
});

test.describe.serial("producao numeros @vazio-historico", () => {
  // Uma na Queima de biscoito com 30 peças de uma ficha de linha que cabe 12 no biscoito (da casa),
  // uma na Produção com 5 + 1 a mais (encomenda) e uma aguardando o sinal (encomenda, 4 peças).
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  test.beforeAll(async () => {
    const { fichaId } = await semearFicha({
      nome: `[e2e] Prato raso de linha ${sufixo}`,
      exclusiva: false,
      comItem: true,
      argilaMiligramas: 800_000,
      esmalteMiligramas: 60_000,
      larguraMm: 250,
      profundidadeMm: 250,
      alturaMm: 30,
      horasMilesimos: 500,
      cabemBiscoitoInformado: 12,
      cabemEsmalteInformado: 8,
    });
    await semearOrdem({
      nome: `[e2e] Pratos rasos ${sufixo}`,
      tipo: "casa",
      caminho: "completo",
      status: "ativa",
      inicio: diaEmBrasilia(-25),
      etapasFeitas: [
        { etapa: "producao", feitaEm: diaEmBrasilia(-20) },
        { etapa: "secagem", feitaEm: diaEmBrasilia(-2) },
      ],
      pecas: [{ descricao: "[e2e] Prato raso", quantidade: 30, fichaId }],
    });
    await semearAtiva({
      nome: `[e2e] Xícaras encomendadas ${sufixo}`,
      tipo: "encomenda",
      quantidade: 5,
      aMais: 1,
    });
    await semearAguardando({ nome: `[e2e] Travessas esperando ${sufixo}`, tipo: "encomenda" });
  });

  async function numeros(page: Page) {
    return {
      emProducao: page.getByTestId("producao-numero-em-producao"),
      forno: page.getByTestId("producao-numero-forno"),
      aguardando: page.getByTestId("producao-numero-aguardando"),
    };
  }

  test("(1) em Tudo: 2 em produção com 36 peças, 1 esperando o forno (≈ 2,5 fornadas de biscoito), 1 aguardando", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/producao");
    const { emProducao, forno, aguardando } = await numeros(page);

    await expect(emProducao).toContainText("Em produção");
    await expect(emProducao.getByTestId("producao-numero-em-producao-valor")).toHaveText("2");
    await expect(emProducao).toContainText("2 ordens · 36 peças");

    await expect(forno).toContainText("Esperando o forno");
    await expect(forno.getByTestId("producao-numero-forno-valor")).toHaveText("1");
    const fornadas = forno.getByTestId("producao-numero-forno-fornadas");
    await expect(fornadas).toContainText("2,5 fornadas de biscoito");
    await expect(fornadas).toContainText("0 de esmalte");
    // O "≈" é desenho; o leitor de tela ouve "aproximadamente".
    await expect(fornadas.locator('[aria-hidden="true"]').first()).toHaveText(/≈/);
    await expect(fornadas.locator(".sr-only").first()).toHaveText(/aproximadamente/);
    await expect(forno).toContainText("estimativa pelo que cabe no forno");
    await expect(forno.getByTestId("producao-numero-forno-sem-estimativa")).toHaveCount(0);

    await expect(aguardando).toContainText("Aguardando sinal");
    await expect(aguardando.getByTestId("producao-numero-aguardando-valor")).toHaveText("1");
    await expect(aguardando).toContainText("não contam prazo ainda");
  });

  test("(2) os três números obedecem ao filtro", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/producao");
    const { emProducao, forno, aguardando } = await numeros(page);

    await page.getByTestId("producao-filtro-encomenda").click();
    await expect(emProducao.getByTestId("producao-numero-em-producao-valor")).toHaveText("1");
    await expect(emProducao).toContainText("1 ordem · 6 peças");
    await expect(forno.getByTestId("producao-numero-forno-valor")).toHaveText("0");
    await expect(forno).toContainText("nenhuma fornada na fila");
    await expect(aguardando.getByTestId("producao-numero-aguardando-valor")).toHaveText("1");

    await page.getByTestId("producao-filtro-casa").click();
    await expect(emProducao.getByTestId("producao-numero-em-producao-valor")).toHaveText("1");
    await expect(emProducao).toContainText("1 ordem · 30 peças");
    await expect(forno.getByTestId("producao-numero-forno-valor")).toHaveText("1");
    await expect(forno.getByTestId("producao-numero-forno-fornadas")).toContainText(
      "2,5 fornadas de biscoito",
    );
    await expect(aguardando.getByTestId("producao-numero-aguardando-valor")).toHaveText("0");

    await page.getByTestId("producao-filtro-todas").click();
    await expect(emProducao.getByTestId("producao-numero-em-producao-valor")).toHaveText("2");
  });
});

test("producao vazia @vazio-global", async ({ page }) => {
  await fazerLogin(page);
  await page.goto("/gestao/producao");

  const vazio = page.getByTestId("producao-vazio");
  await expect(vazio).toBeVisible();
  await expect(vazio).toContainText("Nada em produção agora.");
  await expect(vazio.getByTestId("nova-ordem-abrir")).toHaveText("Nova ordem");
  // UI-D11: o único "Nova ordem" é o do vazio; o cabeçalho fica sem botão nenhum.
  await expect(page.getByTestId("nova-ordem-abrir")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Imprimir folha geral/ })).toHaveCount(0);
  await expect(page.getByTestId("producao-numeros")).toHaveCount(0);
  await expect(page.getByTestId("producao-ver-concluidas")).toHaveCount(0);
});

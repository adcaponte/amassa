import { test, expect, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";

import { medirCaixa } from "./apoio/medir-caixa";
import { semearMaterial } from "./apoio/semear-estoque";
import { buscarCategoriaPorNome } from "./apoio/semear-financeiro";
import { diaDoMes, mesReservado } from "./apoio/mes-reservado";

// Fase 06.5 (Polimento), plano 03 — D-08 causa nº 2, POL-01. As telas que o Cowork achou rolando de
// lado no celular (achado 5: "Quanto cada área deixou"; os saldos do Estoque) passam a usar a peça
// comum `TabelaResponsiva`, que escolhe entre lista e tabela pela largura do CONTÊINER (UI-D2) — e o
// gráfico das Queimas abre na semana atual, com a legenda inteira (achado 7).
//
// Toda caixa é medida por `medirCaixa` (D-23) — nunca `boundingBox()` direto. Nomes semeados são
// inventados e prefixados "[e2e]"; nenhum teste afirma estado global do banco: o Mês olha um mês
// RESERVADO só para ele (`mes-reservado.ts`), e o Estoque acha os PRÓPRIOS materiais pelo sufixo.

// As larguras em que nada pode rolar de lado (UI-SPEC §Peça comum 2 — Prova).
const LARGURAS_SEM_ROLAGEM = [320, 375, 768, 1024] as const;

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

async function semRolagemLateral(page: Page, onde: string) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(
    scrollWidth,
    `${onde}: a página rola de lado (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth);
}

async function semRolagemNoElemento(elemento: Locator, onde: string) {
  await expect(elemento).toBeVisible();
  const [scrollWidth, clientWidth] = await elemento.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(
    scrollWidth,
    `${onde}: o elemento rola de lado (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth);
}

// Um documento pago (venda ou despesa) de uma linha só, numa data do mês reservado. IDEMPOTENTE pelo
// título: num `retries` do CI, o mesmo teste roda de novo no mesmo banco e não pode somar duas vezes.
// Mesmo molde de `semear-documento-antigo.ts` (documento → linha → parcela numa transação; a soma da
// parcela fecha com a da linha no `commit`).
async function semearDocumentoPago(dados: {
  tipo: "venda" | "despesa";
  titulo: string;
  data: string;
  categoria: string;
  valorCentavos: number;
}): Promise<void> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error("semearDocumentoPago: a variável E2E_EMAIL_TESTE não está definida.");
  }
  const categoriaId = await buscarCategoriaPorNome(dados.categoria);

  await comCliente(async (cliente) => {
    const jaExiste = await cliente.query("select 1 from documentos where titulo = $1 limit 1", [dados.titulo]);
    if (jaExiste.rowCount) {
      return;
    }
    const usuario = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1) limit 1",
      [email],
    );
    const criadoPor = usuario.rows[0]?.id;
    if (!criadoPor) {
      throw new Error(`semearDocumentoPago: nenhum usuário com o e-mail "${email}".`);
    }

    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into documentos (tipo, data, titulo, criado_por)
         values ($1::tipo_documento, $2, $3, $4)
         returning id`,
        [dados.tipo, dados.data, dados.titulo, criadoPor],
      );
      const documentoId = rows[0].id;

      await cliente.query(
        `insert into documento_linhas
           (documento_id, ordem, descricao, categoria_id, quantidade, valor_centavos)
         values ($1, 0, $2, $3, 1, $4)`,
        [documentoId, dados.titulo, categoriaId, dados.valorCentavos],
      );

      await cliente.query(
        `insert into parcelas
           (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
         values ($1, 1, $2, $3, 'dinheiro'::forma_pagamento, $2, $4)`,
        [documentoId, dados.data, dados.valorCentavos, criadoPor],
      );

      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}

test.describe("polimento celular — mês", () => {
  test("“Quanto cada área deixou”: lista no celular, tabela quando cabe, nunca rolagem lateral", async ({
    page,
  }) => {
    const projeto = test.info().project.name;
    const mes = mesReservado("polimento-mes", projeto);

    // Peças vendeu R$ 120,00 e não custou nada; a Loja só custou (R$ 45,00) — "Deixou" negativo;
    // Cafeteria e Espaço sem movimento nenhum.
    await semearDocumentoPago({
      tipo: "venda",
      titulo: `[e2e] polimento mês — venda de peças (${projeto})`,
      data: diaDoMes(mes, 5),
      categoria: "Peças prontas",
      valorCentavos: 12000,
    });
    await semearDocumentoPago({
      tipo: "despesa",
      titulo: `[e2e] polimento mês — mercadoria da loja (${projeto})`,
      data: diaDoMes(mes, 8),
      categoria: "Mercadoria para revenda",
      valorCentavos: 4500,
    });

    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=mes&mes=${mes}`);
    const involucro = page.getByTestId("tabela-responsiva");

    for (const largura of LARGURAS_SEM_ROLAGEM) {
      await page.setViewportSize({ width: largura, height: 900 });
      await semRolagemNoElemento(involucro, `Mês a ${largura}px (invólucro)`);
      await semRolagemLateral(page, `Mês a ${largura}px`);
    }

    // 375 px: a lista, com o "Deixou" de cada área à direita da primeira fileira.
    await page.setViewportSize({ width: 375, height: 900 });
    const pecas = page.getByTestId("mes-area-lista-pecas");
    const loja = page.getByTestId("mes-area-lista-loja");
    await expect(pecas).toBeVisible();
    await expect(page.getByTestId("mes-area-pecas")).toBeHidden();
    await expect(page.getByTestId("mes-juntas")).toBeHidden();

    await expect(pecas.getByTestId("mes-lista-deixou")).toHaveText("R$ 120,00");
    await expect(pecas).toContainText("vendeu R$ 120,00 · custou R$ 0,00");

    const deixouDaLoja = loja.getByTestId("mes-lista-deixou");
    await expect(deixouDaLoja).toHaveText("-R$ 45,00");
    await expect(deixouDaLoja).toHaveClass(/text-erro/);
    await expect(loja).toContainText("vendeu R$ 0,00 · custou R$ 45,00");

    // Área sem movimento: R$ 0,00 nos três números.
    for (const area of ["cafeteria", "espaco"]) {
      const fileira = page.getByTestId(`mes-area-lista-${area}`);
      await expect(fileira.getByTestId("mes-lista-deixou")).toHaveText("R$ 0,00");
      await expect(fileira).toContainText("vendeu R$ 0,00 · custou R$ 0,00");
    }

    const juntas = page.getByTestId("mes-juntas-lista");
    await expect(juntas).toBeVisible();
    await expect(juntas.getByTestId("mes-lista-deixou")).toHaveText("R$ 75,00");
    await expect(juntas).toHaveClass(/border-t-2/);
    await expect(juntas).toHaveClass(/font-semibold/);

    // 1280 px: a tabela de sempre; a lista some.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("mes-area-pecas")).toBeVisible();
    await expect(page.getByTestId("mes-juntas")).toBeVisible();
    await expect(pecas).toBeHidden();
    await expect(juntas).toBeHidden();
    const deixouDaLojaNaTabela = page.getByTestId("mes-area-loja").getByTestId("mes-tabela-deixou");
    await expect(deixouDaLojaNaTabela).toHaveText("-R$ 45,00");
    await expect(deixouDaLojaNaTabela).toHaveClass(/text-erro/);
    await expect(page.getByTestId("mes-area-cafeteria")).toContainText("R$ 0,00");
  });
});

test.describe("polimento celular — estoque", () => {
  test("saldos: cartões até a tabela caber de verdade no contêiner, nunca rolagem lateral", async ({ page }) => {
    const suf = `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const argila = await semearMaterial({
      nome: `[e2e] polimento argila de alta temperatura para torno ${suf}`,
      unidade: "kg",
      categoriaCompra: "Argila, esmalte e insumos",
      minimoMilesimos: 1000,
    });
    const cafe = await semearMaterial({
      nome: `[e2e] polimento café em grão ${suf}`,
      unidade: "kg",
      categoriaCompra: "Insumos da cafeteria",
    });

    await fazerLogin(page);
    await page.goto("/gestao/estoque");
    await expect(page.getByTestId("estoque-busca")).toBeVisible();
    // Só os dois deste teste na lista — a lista é global e outros testes semeiam em paralelo.
    await page.getByTestId("estoque-busca").fill(suf);

    const involucro = page.getByTestId("tabela-responsiva");
    const cartao = (itemId: string) => page.locator(`article[data-testid="estoque-cartao"][data-item-id="${itemId}"]`);
    const linha = (itemId: string) => page.locator(`tr[data-testid="estoque-cartao"][data-item-id="${itemId}"]`);

    for (const largura of LARGURAS_SEM_ROLAGEM) {
      await page.setViewportSize({ width: largura, height: 900 });
      // O cartão OU a linha da tabela — o que estiver visível na largura (as duas formas estão no HTML).
      await expect(
        page.locator(`[data-testid="estoque-cartao"][data-item-id="${argila}"]`).filter({ visible: true }),
      ).toBeVisible();
      await semRolagemNoElemento(involucro, `Estoque a ${largura}px (invólucro)`);
      await semRolagemLateral(page, `Estoque a ${largura}px`);
    }

    // 1024 px: com a lateral de 240 px o contêiner tem menos de 768 — cartões, não a tabela (que pede
    // 760 e, pela viewport de 980 px, aparecia sem caber).
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(cartao(argila)).toBeVisible();
    await expect(cartao(cafe)).toBeVisible();
    await expect(page.getByTestId("estoque-tabela")).toBeHidden();
    const caixaDoInvolucro = await medirCaixa(involucro, "invólucro do Estoque a 1024px");
    expect(caixaDoInvolucro.width).toBeLessThan(768);

    // 1280 px: a tabela cabe de verdade e aparece; os cartões somem.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("estoque-tabela")).toBeVisible();
    await expect(linha(argila)).toBeVisible();
    await expect(linha(cafe)).toBeVisible();
    await expect(cartao(argila)).toBeHidden();
    await semRolagemNoElemento(page.getByTestId("estoque-tabela"), "tabela do Estoque a 1280px");
  });
});

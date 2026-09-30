import { test, expect, type Page } from "@playwright/test";

import {
  cancelarOrdemNoBanco,
  conclusaoDaOrdemNoBanco,
  diaEmBrasilia,
  entradasDaProducaoNoBanco,
  estoqueDoItemNoBanco,
  fichaNoBanco,
  itemDaVendaNoBanco,
  semearFicha,
  semearOrdem,
} from "./apoio/semear-producao";

// A peça exclusiva que vai para o Estoque (Fase 06.1, plano 12 — D-12, PRD-16): na conclusão, a
// extra boa de peça EXCLUSIVA com destino "Entram no Estoque" passa pelo passo "Transformar em peça
// de linha" (categoria "Peças prontas" e o preço praticado da ficha, já preenchidos); ao concluir, a
// MESMA transação promove a ficha (pela mesma função de `editarFicha`), liga o estoque do item (D-13)
// e grava a entrada `producao`. E a ficha que uma ordem usa não se apaga (Pitfall 11). Cada teste
// semeia os PRÓPRIOS dados com sufixo único — nenhuma afirmação global do banco. Nomes inventados
// com `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(rotulo: string): string {
  const sufixo = `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return `[e2e] ${rotulo} ${sufixo}`;
}

const INICIO = diaEmBrasilia(-10);
const ETAPAS_ANTES_DA_ENTREGA = (["producao", "secagem", "queima1", "esmaltacao", "queima2"] as const).map(
  (etapa) => ({ etapa, feitaEm: diaEmBrasilia(-1) }),
);

// A ficha de peça com medidas e contagem informada — dá custo com os parâmetros da semente.
function fichaDoVaso(nome: string, exclusiva: boolean) {
  return semearFicha({
    nome,
    exclusiva,
    comItem: !exclusiva,
    argilaMiligramas: 300_000,
    esmalteMiligramas: 30_000,
    larguraMm: 200,
    profundidadeMm: 200,
    alturaMm: 30,
    horasMilesimos: 500,
    cabemBiscoitoInformado: 10,
    cabemEsmalteInformado: 10,
  });
}

// Uma encomenda ATIVA na Entrega, com UMA peça exclusiva: 3 pedidas + 2 a mais.
async function semearEncomendaDaExclusiva(nome: string) {
  const nomeDaFicha = `${nome} · vaso exclusivo`;
  const { fichaId } = await fichaDoVaso(nomeDaFicha, true);
  const ordemId = await semearOrdem({
    nome,
    tipo: "encomenda",
    caminho: "completo",
    status: "ativa",
    inicio: INICIO,
    etapasFeitas: ETAPAS_ANTES_DA_ENTREGA,
    pecas: [{ descricao: nomeDaFicha, quantidade: 3, aMais: 2, fichaId }],
    clienteNome: "[e2e] Cliente da exclusiva",
  });
  return { fichaId, ordemId, nomeDaFicha };
}

async function abrirConclusao(page: Page, ordemId: string) {
  await page.goto(`/gestao/producao/${ordemId}`);
  await page.getByTestId("ordem-concluir").click();
  const folha = page.getByTestId("folha-conclusao");
  await expect(folha).toBeVisible();
  const secao = folha.locator('section[data-testid^="conclusao-peca-"]');
  await expect(secao).toHaveCount(1);
  const pecaId = ((await secao.getAttribute("data-testid")) ?? "").replace("conclusao-peca-", "");
  return { folha, secao, pecaId };
}

test.describe("producao estoque", () => {
  test("(a) extra de peça exclusiva → “Entram no Estoque” → “Transformar em peça de linha” com “Peças prontas” e o preço da ficha; conclui: a ficha vira de linha, o item controla estoque em un, e entram 2", async ({
    page,
  }) => {
    const nome = nomeUnico("Exclusiva ao estoque");
    const { fichaId, ordemId, nomeDaFicha } = await semearEncomendaDaExclusiva(nome);
    await fazerLogin(page);

    const { folha, secao, pecaId } = await abrirConclusao(page, ordemId);
    const custoPelaFicha = Number(await secao.getAttribute("data-custo-pela-ficha"));
    expect(custoPelaFicha).toBeGreaterThan(0);

    // A sugestão da exclusiva é "Sem destino"; as DUAS opções aparecem; o passo não aparece ainda.
    const semDestino = folha.getByTestId(`conclusao-destino-${pecaId}-sem_destino`);
    const estoque = folha.getByTestId(`conclusao-destino-${pecaId}-estoque`);
    await expect(semDestino).toHaveAttribute("aria-checked", "true");
    await expect(semDestino).toContainText("peça exclusiva, não vou vender");
    await expect(estoque).toHaveAttribute("aria-checked", "false");
    await expect(folha.getByTestId(`conclusao-linha-${pecaId}`)).toHaveCount(0);

    await estoque.click();
    await expect(estoque).toHaveAttribute("aria-checked", "true");
    const passo = folha.getByTestId(`conclusao-linha-${pecaId}`);
    await expect(passo).toBeVisible();
    await expect(passo).toContainText("Transformar em peça de linha");
    await expect(passo).toContainText(
      "Para entrar no Estoque, a peça precisa estar no catálogo. Ela deixa de ser exclusiva e passa a ser peça de linha, com preço de venda — vai aparecer na Venda.",
    );
    await expect(folha.getByTestId(`conclusao-categoria-${pecaId}`)).toHaveText("Peças prontas");
    // O preço praticado da exclusiva semeada (R$ 90,00) — o campo aceita e devolve "90,00".
    await expect(folha.getByTestId(`conclusao-preco-${pecaId}`)).toHaveValue("90,00");
    await expect(passo).toContainText("é o preço que vai aparecer na Venda");
    // Custo pela ficha: nenhum campo de custo.
    await expect(folha.getByTestId(`conclusao-custo-${pecaId}`)).toHaveCount(0);

    await folha.getByTestId(`conclusao-preco-${pecaId}`).fill("120");
    await folha.getByTestId("conclusao-gravar").click();
    await expect(
      page.getByText(
        `Ordem entregue. 2 peças entraram no Estoque como pronta entrega. ${nomeDaFicha} passou a aparecer no Estoque.`,
      ),
    ).toBeVisible();
    await expect(page.getByTestId("folha-conclusao")).toHaveCount(0);

    // A ficha virou de linha, com item; o preço praticado dela ficou nulo (é o do item, D-18).
    const ficha = await fichaNoBanco(fichaId);
    expect(ficha.exclusiva).toBe(false);
    expect(ficha.precoPraticadoCentavos).toBeNull();
    const itemId = ficha.itemCatalogoId;
    expect(itemId).not.toBeNull();
    if (!itemId) {
      return;
    }
    expect(await itemDaVendaNoBanco(itemId)).toEqual({
      nome: nomeDaFicha,
      precoVendaCentavos: 12000,
      apareceNaVenda: true,
      categoriaVenda: "Peças prontas",
    });
    // D-13 na mesma transação: o item controla estoque, em un, "Produção da casa".
    expect(await estoqueDoItemNoBanco(itemId)).toEqual({
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Produção da casa",
    });
    // Uma entrada `producao` de 2 un, ligada à ordem, pelo custo da ficha × 2.
    expect(await entradasDaProducaoNoBanco(ordemId)).toEqual([
      {
        itemId,
        quantidadeMilesimos: 2000,
        valorCentavos: custoPelaFicha * 2,
        valorInformadoCentavos: custoPelaFicha * 2,
        motivo: null,
        nota: nome,
      },
    ]);
    const conclusao = await conclusaoDaOrdemNoBanco(ordemId);
    expect(conclusao.status).toBe("concluida");
    expect(conclusao.pecas).toEqual([
      { perdidas: 0, destinoExtras: "estoque", paraEstoque: 2, semDestino: 0 },
    ]);
  });

  test("(b) preço de venda apagado → “Diga o preço de venda — é o que vai aparecer na Venda.” e nada gravado", async ({
    page,
  }) => {
    const nome = nomeUnico("Exclusiva sem preco");
    const { fichaId, ordemId } = await semearEncomendaDaExclusiva(nome);
    await fazerLogin(page);

    const { folha, pecaId } = await abrirConclusao(page, ordemId);
    await folha.getByTestId(`conclusao-destino-${pecaId}-estoque`).click();
    await folha.getByTestId(`conclusao-preco-${pecaId}`).fill("");
    await folha.getByTestId("conclusao-gravar").click();

    await expect(folha.getByTestId(`conclusao-erro-preco-${pecaId}`)).toHaveText(
      "Diga o preço de venda — é o que vai aparecer na Venda.",
    );
    await expect(folha.getByTestId(`conclusao-preco-${pecaId}`)).toBeFocused();
    // A folha continua aberta e preenchida; nada foi gravado.
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId(`conclusao-destino-${pecaId}-estoque`)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await fichaNoBanco(fichaId)).toEqual({
      exclusiva: true,
      itemCatalogoId: null,
      precoPraticadoCentavos: 9000,
    });
    expect((await conclusaoDaOrdemNoBanco(ordemId)).status).toBe("ativa");
    expect(await entradasDaProducaoNoBanco(ordemId)).toEqual([]);
  });

  test("(c) apagar uma ficha usada numa ordem de produção: “Esta peça é usada em 1 ordem de produção — não dá para apagar.”", async ({
    page,
  }) => {
    const nome = nomeUnico("Ficha em ordem");
    const { fichaId } = await fichaDoVaso(`${nome} · vaso de linha`, false);
    await semearOrdem({
      nome,
      tipo: "encomenda",
      caminho: "completo",
      status: "ativa",
      inicio: INICIO,
      etapasFeitas: [],
      pecas: [{ descricao: `${nome} · vaso de linha`, quantidade: 2, fichaId }],
      clienteNome: "[e2e] Cliente da ficha em ordem",
    });
    await fazerLogin(page);

    await page.goto(`/gestao/financeiro?aba=pecas&peca=${fichaId}`);
    await expect(page.getByRole("heading", { name: "Precificar peça" })).toBeVisible();
    await page.getByRole("button", { name: "Apagar" }).click();
    await expect(page).toHaveURL(new RegExp(`apagarPeca=${fichaId}`));

    const dialogo = page.getByTestId("dialogo-apagar-peca");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Apagar" }).click();

    await expect(dialogo.getByTestId("dialogo-apagar-peca-erro")).toHaveText(
      "Esta peça é usada em 1 ordem de produção — não dá para apagar.",
    );
    await expect(dialogo).toBeVisible();
    // A ficha continua lá.
    expect((await fichaNoBanco(fichaId)).exclusiva).toBe(false);
  });

  test("(d) a edição que desmarca “exclusiva” continua promovendo a peça a de linha — o mesmo caminho, agora pelo ajudante", async ({
    page,
  }) => {
    const nome = nomeUnico("Exclusiva editada");
    const { fichaId } = await fichaDoVaso(`${nome} · vaso`, true);
    await fazerLogin(page);

    await page.goto(`/gestao/financeiro?aba=pecas&exclusivas=1&peca=${fichaId}`);
    await expect(page.getByRole("heading", { name: "Precificar peça" })).toBeVisible();
    await page.getByRole("checkbox", { name: /Peça exclusiva deste pedido/ }).click();
    await page.getByRole("combobox", { name: "Categoria de venda" }).click();
    await page.getByRole("option", { name: "Peças prontas" }).click();
    await page.getByTestId("ficha-campo-preco-praticado").fill("95");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();

    const ficha = await fichaNoBanco(fichaId);
    expect(ficha.exclusiva).toBe(false);
    expect(ficha.precoPraticadoCentavos).toBeNull();
    expect(ficha.itemCatalogoId).not.toBeNull();
    if (!ficha.itemCatalogoId) {
      return;
    }
    expect(await itemDaVendaNoBanco(ficha.itemCatalogoId)).toEqual({
      nome: `${nome} · vaso`,
      precoVendaCentavos: 9500,
      apareceNaVenda: true,
      categoriaVenda: "Peças prontas",
    });
    // A promoção pela Precificação NÃO liga estoque (Pitfall 6) — só a conclusão faz isso (D-13).
    expect((await estoqueDoItemNoBanco(ficha.itemCatalogoId)).controlaEstoque).toBe(false);
  });

  // Revisão 06.1, WR-01 — o dono escolheu (a) na Parte 0 (30/09/2026): a Precificação recusa marcar
  // "exclusiva" a ficha que uma ordem da produção da casa ainda aberta usa (a ordem ficaria sem item
  // onde guardar as peças); cancelada a ordem, a mesma edição passa.
  test("(e) ficha de linha numa produção da casa aberta: marcar “exclusiva” é recusado com o nome da ordem; cancelada a ordem, passa", async ({
    page,
  }) => {
    const nome = nomeUnico("Casa usa a ficha");
    const { fichaId, itemId } = await fichaDoVaso(`${nome} · caneca`, false);
    expect(itemId).toBeTruthy();
    const ordemId = await semearOrdem({
      nome,
      tipo: "casa",
      caminho: "completo",
      status: "ativa",
      inicio: INICIO,
      etapasFeitas: [],
      pecas: [{ descricao: `${nome} · caneca`, quantidade: 6, fichaId }],
      clienteNome: null,
    });
    await fazerLogin(page);

    await page.goto(`/gestao/financeiro?aba=pecas&peca=${fichaId}`);
    await expect(page.getByRole("heading", { name: "Precificar peça" })).toBeVisible();
    await page.getByRole("checkbox", { name: /Peça exclusiva deste pedido/ }).click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "produção da casa" })).toHaveText(
      `A ficha está na produção da casa “${nome}”. Conclua ou cancele a ordem na Produção antes de torná-la exclusiva. Nada foi gravado.`,
    );
    // Nada gravado: a ficha continua de linha, com o item.
    expect(await fichaNoBanco(fichaId)).toMatchObject({ exclusiva: false, itemCatalogoId: itemId });

    // Cancelada a ordem, a mesma edição passa.
    await cancelarOrdemNoBanco(ordemId, INICIO);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Peça salva.")).toBeVisible();
    expect(await fichaNoBanco(fichaId)).toMatchObject({ exclusiva: true, itemCatalogoId: null });
  });
});

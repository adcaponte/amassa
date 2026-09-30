import { test, expect, type Page } from "@playwright/test";

import { ligarFichaDePrecificacao } from "./apoio/semear-estoque";
import {
  conclusaoDaOrdemNoBanco,
  diaEmBrasilia,
  entradasDaProducaoNoBanco,
  estoqueDoItemNoBanco,
  levarAteAEntregaNoBanco,
  liberarOrdemNoBanco,
  numeroDoDocumentoNoBanco,
  semearFicha,
  semearItemDoEstoque,
  semearOrdem,
  semearOrdemDeOrcamento,
  vendaNoBanco,
  type PecaParaSemear,
} from "./apoio/semear-producao";

// Concluir a ordem (Fase 06.1, plano 11 — PRD-15/PRD-16/PRD-18, critério 6 do ROADMAP): a folha
// pergunta só quantas se perderam; as contas saem do módulo puro (briefing §7); as extras boas de
// peça de linha e as boas da produção da casa entram no Estoque com o custo da ficha, ligadas à
// ordem; o item que não controla estoque é ligado (D-13); sem custo pela ficha, o custo é pedido
// (D-14); nada toca na venda. Cada teste semeia os PRÓPRIOS dados com sufixo único — nenhuma
// afirmação global do banco. Nomes inventados com `[e2e]`.

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

// Uma ordem ATIVA, caminho completo, com todas as etapas feitas menos a Entrega.
async function semearOrdemNaEntrega(dados: {
  nome: string;
  tipo: "encomenda" | "casa";
  pecas: PecaParaSemear[];
}): Promise<string> {
  return semearOrdem({
    nome: dados.nome,
    tipo: dados.tipo,
    caminho: "completo",
    status: "ativa",
    inicio: INICIO,
    etapasFeitas: ETAPAS_ANTES_DA_ENTREGA,
    pecas: dados.pecas,
    clienteNome: dados.tipo === "encomenda" ? "[e2e] Cliente da conclusão" : null,
  });
}

// Uma peça de LINHA com o item já controlando estoque (em `un`) e a ficha que dá custo.
async function semearPecaDeLinhaComEstoque(nome: string) {
  const itemId = await semearItemDoEstoque({ nome: `${nome} · caneca` });
  const fichaId = await ligarFichaDePrecificacao(itemId);
  return { itemId, fichaId };
}

async function abrirConclusao(page: Page, ordemId: string) {
  await page.goto(`/gestao/producao/${ordemId}`);
  await page.getByTestId("ordem-concluir").click();
  const folha = page.getByTestId("folha-conclusao");
  await expect(folha).toBeVisible();
  return folha;
}

test.describe("producao concluir", () => {
  test("(a) encomenda de peça de linha: perdidas 1 → entrega 10 de 10, 1 extra boa entra no Estoque com o custo da ficha, ligada à ordem", async ({
    page,
  }) => {
    const nome = nomeUnico("Concluir linha");
    const { itemId, fichaId } = await semearPecaDeLinhaComEstoque(nome);
    const ordemId = await semearOrdemNaEntrega({
      nome,
      tipo: "encomenda",
      pecas: [{ descricao: `${nome} · caneca`, quantidade: 10, aMais: 2, fichaId }],
    });
    await fazerLogin(page);

    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-concluir")).toHaveText("Entreguei");
    await expect(page.getByTestId("ordem-terminei")).toHaveCount(0);

    const folha = await abrirConclusao(page, ordemId);
    await expect(folha.getByRole("heading", { name: "Entrega" })).toBeVisible();
    await expect(folha).toContainText(
      "Diga quantas se perderam no caminho (racharam, escorreu esmalte, quebraram). O resto a tela calcula.",
    );
    const secao = folha.locator('section[data-testid^="conclusao-peca-"]');
    await expect(secao).toHaveCount(1);
    const pecaId = ((await secao.getAttribute("data-testid")) ?? "").replace("conclusao-peca-", "");
    await expect(secao).toContainText("pedido 10 · fez 12");

    // Padrão 0: entrega 10 de 10 e 2 extras.
    const contas = folha.getByTestId(`conclusao-contas-${pecaId}`);
    await expect(contas).toContainText("Entregues ao cliente 10 de 10");
    await expect(contas).toContainText("Extras boas 2");

    await folha.getByTestId(`conclusao-perdidas-${pecaId}`).fill("1");
    await expect(contas).toContainText("Entregues ao cliente 10 de 10");
    await expect(contas).toContainText("Extras boas 1");
    await expect(contas).toContainText("Perdidas 1 de 12 feitas");
    await expect(folha.getByTestId("conclusao-faltam")).toHaveCount(0);

    // A sugestão da peça de linha: Estoque, com o custo da ficha.
    const custoPelaFicha = Number(await secao.getAttribute("data-custo-pela-ficha"));
    expect(custoPelaFicha).toBeGreaterThan(0);
    const estoque = folha.getByTestId(`conclusao-destino-${pecaId}-estoque`);
    await expect(estoque).toHaveAttribute("aria-checked", "true");
    await expect(estoque).toContainText("Entram no Estoque como pronta entrega");
    await expect(estoque).toContainText("cada, pela ficha");
    await expect(folha.getByTestId(`conclusao-destino-${pecaId}-sem_destino`)).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // Item já com estoque: nenhuma caixa do D-13; custo pela ficha: nenhum campo de custo.
    await expect(folha.getByTestId(`conclusao-liga-estoque-${pecaId}`)).toHaveCount(0);
    await expect(folha.getByTestId(`conclusao-custo-${pecaId}`)).toHaveCount(0);
    // Ordem de boca, sem venda: só a frase da perda medida.
    await expect(folha.getByTestId("conclusao-nota")).not.toContainText("Caixa");

    await expect(folha.getByTestId("conclusao-gravar")).toHaveText("Concluir ordem");
    await folha.getByTestId("conclusao-gravar").click();
    await expect(
      page.getByText("Ordem entregue. 1 peça entrou no Estoque como pronta entrega."),
    ).toBeVisible();
    await expect(page.getByTestId("folha-conclusao")).toHaveCount(0);

    // No banco: UMA entrada `producao`, ligada à ordem, pelo custo da ficha, sem motivo.
    const entradas = await entradasDaProducaoNoBanco(ordemId);
    expect(entradas).toEqual([
      {
        itemId,
        quantidadeMilesimos: 1000,
        valorCentavos: custoPelaFicha,
        valorInformadoCentavos: custoPelaFicha,
        motivo: null,
        nota: nome,
      },
    ]);
    const hoje = diaEmBrasilia();
    expect(await conclusaoDaOrdemNoBanco(ordemId)).toEqual({
      status: "concluida",
      concluidaEm: hoje,
      entregaParcial: false,
      entregaFeitaEm: hoje,
      pecas: [{ perdidas: 1, destinoExtras: "estoque", paraEstoque: 1, semDestino: 0 }],
    });

    // A ordem concluída: o resultado no lugar das ações, o selo, e nada editável.
    const resultado = page.getByTestId("ordem-resultado");
    await expect(resultado).toHaveAttribute("data-resultado", "concluida");
    await expect(resultado.getByTestId("ordem-resultado-peca")).toHaveText(
      `${nome} · caneca: 10 entregues · 1 para o estoque · 1 perdida de 12`,
    );
    await expect(resultado.getByTestId("ordem-resultado-dias")).toHaveText(
      "10 dias do início ao fim.",
    );
    await expect(resultado.getByTestId("ordem-entrega-parcial")).toHaveCount(0);
    await expect(page.getByTestId("producao-selo")).toHaveText("concluída");
    await expect(page.getByTestId("ordem-acoes")).toHaveCount(0);
    await expect(page.getByTestId("ordem-concluir")).toHaveCount(0);

    // O histórico do Estoque: "Da Produção · {ordem} · …" com o chip "da Produção".
    await page.goto("/gestao/estoque?aba=historico&limite=1000");
    const linha = page.locator(`[data-testid="historico-linha"][data-item-id="${itemId}"]`).first();
    await expect(linha.getByTestId("historico-detalhe")).toContainText(`Da Produção · ${nome} · `);
    await expect(linha.getByTestId("historico-chip")).toHaveText(["da Produção"]);
  });

  test("(b) encomenda do orçamento, perdidas 3 → “Faltam 3”, “Concluir como entrega parcial”, e a venda não muda", async ({
    page,
  }) => {
    const nome = nomeUnico("Concluir parcial");
    const semeada = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: true,
      pecas: [{ quantidade: 10 }],
    });
    await liberarOrdemNoBanco(semeada.ordemId, INICIO);
    await levarAteAEntregaNoBanco(semeada.ordemId, diaEmBrasilia(-1));
    const vendaAntes = await vendaNoBanco(semeada.documentoId);
    const vendaNumero = await numeroDoDocumentoNoBanco(semeada.documentoId);
    await fazerLogin(page);

    const folha = await abrirConclusao(page, semeada.ordemId);
    const campo = folha.locator('input[data-testid^="conclusao-perdidas-"]');
    await campo.fill("3");
    await expect(folha.getByTestId("conclusao-faltam")).toHaveText(
      "Faltam 3 para completar o pedido. Dá para concluir como entrega parcial, ou voltar e produzir mais.",
    );
    await expect(folha.locator('[data-testid^="conclusao-contas-"]')).toContainText(
      "Entregues ao cliente 7 de 10",
    );
    // Sem extras boas, o grupo de destino some.
    await expect(folha.getByRole("radiogroup")).toHaveCount(0);
    await expect(folha.getByTestId("conclusao-gravar")).toHaveText("Concluir como entrega parcial");
    await expect(folha.getByTestId("conclusao-nota")).toContainText(
      `O saldo a receber continua no Caixa (venda nº ${vendaNumero}).`,
    );

    // Perdidas fora da faixa: a frase do módulo puro, e nada é gravado.
    await campo.fill("11");
    await expect(folha.getByText("Diga um número de 0 a 10.")).toBeVisible();
    await campo.fill("3");

    await folha.getByTestId("conclusao-gravar").click();
    await expect(page.getByText("Ordem entregue.", { exact: true })).toBeVisible();

    const conclusao = await conclusaoDaOrdemNoBanco(semeada.ordemId);
    expect(conclusao.status).toBe("concluida");
    expect(conclusao.entregaParcial).toBe(true);
    expect(conclusao.pecas).toEqual([
      { perdidas: 3, destinoExtras: null, paraEstoque: 0, semDestino: 0 },
    ]);
    expect(await entradasDaProducaoNoBanco(semeada.ordemId)).toEqual([]);
    await expect(page.getByTestId("ordem-entrega-parcial")).toHaveText("Entrega parcial");
    await expect(page.getByTestId("ordem-resultado-peca")).toContainText(
      "7 entregues · 3 perdidas de 10",
    );
    // PRD-18: a venda e as parcelas continuam como estavam.
    expect(await vendaNoBanco(semeada.documentoId)).toEqual(vendaAntes);
  });

  test("(c) produção da casa com item do estoque sem ficha: o custo de cada peça é obrigatório e as boas entram a R$ 12,50", async ({
    page,
  }) => {
    const nome = nomeUnico("Concluir casa sem ficha");
    const itemId = await semearItemDoEstoque({ nome: `${nome} · vaso` });
    const ordemId = await semearOrdemNaEntrega({
      nome,
      tipo: "casa",
      pecas: [{ descricao: `${nome} · vaso`, quantidade: 4, itemCatalogoId: itemId }],
    });
    await fazerLogin(page);

    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-concluir")).toHaveText("Guardar no estoque");
    const folha = await abrirConclusao(page, ordemId);
    await expect(folha.getByRole("heading", { name: "Guardar no estoque" })).toBeVisible();
    await expect(folha.locator('section[data-testid^="conclusao-peca-"]')).toContainText("fez 4");
    await folha.locator('input[data-testid^="conclusao-perdidas-"]').fill("1");
    const contas = folha.locator('[data-testid^="conclusao-contas-"]');
    await expect(contas).toContainText("Boas 3");
    await expect(contas).not.toContainText("Entregues");
    // Casa: sem escolha de destino, e a nota do fim.
    await expect(folha.getByRole("radiogroup")).toHaveCount(0);
    await expect(folha.getByTestId("conclusao-nota")).toHaveText(
      "As 3 boas entram no Estoque como pronta entrega.",
    );

    const custo = folha.locator('input[data-testid^="conclusao-custo-"]');
    await expect(custo).toHaveValue("");
    await expect(folha).toContainText(
      "Esta peça não tem ficha de precificação — diga quanto custou cada uma, para o Estoque saber quanto ela vale.",
    );
    await folha.getByTestId("conclusao-gravar").click();
    await expect(folha.getByText("Diga o custo de cada peça — uma estimativa serve.")).toBeVisible();
    expect((await conclusaoDaOrdemNoBanco(ordemId)).status).toBe("ativa");

    await custo.fill("12,50");
    await expect(folha.locator('[data-testid^="conclusao-custo-previa-"]')).toHaveText(
      /^3 × R\$\s12,50 = R\$\s37,50 entram no Estoque$/,
    );
    await folha.getByTestId("conclusao-gravar").click();
    await expect(
      page.getByText("Ordem concluída. 3 peças entraram no Estoque como pronta entrega."),
    ).toBeVisible();

    const entradas = await entradasDaProducaoNoBanco(ordemId);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      itemId,
      quantidadeMilesimos: 3000,
      valorInformadoCentavos: 3750,
      motivo: null,
    });
    const conclusao = await conclusaoDaOrdemNoBanco(ordemId);
    expect(conclusao.entregaParcial).toBe(false);
    expect(conclusao.pecas).toEqual([
      { perdidas: 1, destinoExtras: "estoque", paraEstoque: 3, semDestino: 0 },
    ]);
    await expect(page.getByTestId("ordem-resultado-peca")).toHaveText(
      `${nome} · vaso: 3 para o estoque · 1 perdida de 4`,
    );
  });

  test("(d) produção da casa com peça de linha cujo item não controla estoque: a caixa do D-13, e o item passa a controlar em un, “Produção da casa”", async ({
    page,
  }) => {
    const nome = nomeUnico("Concluir liga estoque");
    const { fichaId, itemId } = await semearFicha({
      nome: `${nome} · prato`,
      exclusiva: false,
      comItem: true,
      argilaMiligramas: 300_000,
      esmalteMiligramas: 30_000,
      larguraMm: 200,
      profundidadeMm: 200,
      alturaMm: 30,
      horasMilesimos: 500,
      cabemBiscoitoInformado: 10,
      cabemEsmalteInformado: 10,
    });
    if (!itemId) {
      throw new Error("a ficha de linha precisa de item");
    }
    expect((await estoqueDoItemNoBanco(itemId)).controlaEstoque).toBe(false);
    const ordemId = await semearOrdemNaEntrega({
      nome,
      tipo: "casa",
      pecas: [{ descricao: `${nome} · prato`, quantidade: 2, fichaId }],
    });
    await fazerLogin(page);

    const folha = await abrirConclusao(page, ordemId);
    const secao = folha.locator('section[data-testid^="conclusao-peca-"]');
    const custoPelaFicha = Number(await secao.getAttribute("data-custo-pela-ficha"));
    expect(custoPelaFicha).toBeGreaterThan(0);
    await expect(folha.locator('[data-testid^="conclusao-liga-estoque-"]')).toHaveText(
      `${nome} · prato ainda não controla estoque. Ao concluir, ele passa a controlar (em unidades, categoria Produção da casa). Vai passar a aparecer no Estoque.`,
    );
    await folha.getByTestId("conclusao-gravar").click();
    await expect(
      page.getByText(
        `Ordem concluída. 2 peças entraram no Estoque como pronta entrega. ${nome} · prato passou a aparecer no Estoque.`,
      ),
    ).toBeVisible();

    expect(await estoqueDoItemNoBanco(itemId)).toEqual({
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Produção da casa",
    });
    const entradas = await entradasDaProducaoNoBanco(ordemId);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      itemId,
      quantidadeMilesimos: 2000,
      valorInformadoCentavos: custoPelaFicha * 2,
    });
  });

  test("(e) duas abas: a segunda conclusão recebe “já foi concluída” e o livro tem UMA entrada", async ({
    page,
    context,
  }) => {
    const nome = nomeUnico("Concluir duas abas");
    const { itemId, fichaId } = await semearPecaDeLinhaComEstoque(nome);
    const ordemId = await semearOrdemNaEntrega({
      nome,
      tipo: "encomenda",
      pecas: [{ descricao: `${nome} · caneca`, quantidade: 2, aMais: 1, fichaId }],
    });
    await fazerLogin(page);
    const outra = await context.newPage();

    const folhaA = await abrirConclusao(page, ordemId);
    const folhaB = await abrirConclusao(outra, ordemId);

    await folhaA.getByTestId("conclusao-gravar").click();
    await expect(
      page.getByText("Ordem entregue. 1 peça entrou no Estoque como pronta entrega."),
    ).toBeVisible();

    await folhaB.getByTestId("conclusao-gravar").click();
    await expect(
      outra.getByText(
        "Esta ordem já foi concluída — talvez em outro celular. A tela foi atualizada.",
      ),
    ).toBeVisible();
    await expect(outra.getByTestId("ordem-resultado")).toHaveAttribute("data-resultado", "concluida");

    const entradas = await entradasDaProducaoNoBanco(ordemId);
    expect(entradas).toHaveLength(1);
    expect(entradas[0].itemId).toBe(itemId);
    await outra.close();
  });
});

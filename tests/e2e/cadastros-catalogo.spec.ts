import { test, expect, type Page } from "@playwright/test";

import { desativarNoBanco, semearMaterial } from "./apoio/semear-estoque";
import { semearItem } from "./apoio/semear-financeiro";

// O traçado ponta a ponta do Catálogo em Cadastros (04.4-05-PLAN.md): criar um insumo só com
// estoque próprio, criar um item vendável, editar a ficha técnica dele, ver o efeito na Venda, e
// as recusas humanas (nem venda nem estoque; item em uso como insumo de outro). Nomes inventados
// e únicos por execução ("[e2e] ... {sufixo}") — nenhum dado real, o repositório é público. O
// primeiro teste afirma uma condição GLOBAL do banco ("nenhum item no catálogo") e por isso é
// marcado `@vazio-global`, rodando na cadeia `vazio-celular → vazio-desktop` de
// `playwright.config.ts`, ANTES de qualquer teste que escreva (mesma disciplina de
// `tests/e2e/abertura-tracador.spec.ts`/`tests/e2e/cotacoes-categorias.spec.ts`) — nunca isolado
// por `--grep` como muleta.

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

// O catálogo é GLOBAL e compartilhado por qualquer outro teste rodando ao mesmo tempo (nenhuma
// afirmação de condição vazia fora do caso `@vazio-global`) — o botão "+ Novo item" existe em DOIS
// lugares (o cabeçalho da lista populada, ou dentro do estado vazio), dependendo de outro worker
// já ter criado algum item do catálogo ou não. Espera por QUALQUER um dos dois e clica no que
// apareceu, em vez de supor qual estado o catálogo está.
async function abrirNovoItem(page: Page) {
  const botaoPopulado = page.getByTestId("novo-item");
  const botaoVazio = page
    .getByTestId("cadastros-vazio-catalogo")
    .getByRole("button", { name: "+ Novo item" });
  await Promise.race([
    botaoPopulado.waitFor({ state: "visible" }),
    botaoVazio.waitFor({ state: "visible" }),
  ]);
  if (await botaoPopulado.isVisible()) {
    await botaoPopulado.click();
  } else {
    await botaoVazio.click();
  }
}

// A linha do item pelo NOME EXATO — nunca `hasText` simples: a etiqueta "gasta 15 g de {insumo}"
// do CAFÉ contém o nome inteiro do GRÃO como substring, então `filter({ hasText: nomeDoGrao })`
// acha as duas linhas (achado real desta suíte). `getByText(nome, { exact: true })` só bate no
// `<span>` do nome propriamente dito, nunca na etiqueta que o cita por extenso.
function linhaDoCatalogo(page: Page, nome: string) {
  return page.getByTestId("catalogo-item").filter({ has: page.getByText(nome, { exact: true }) });
}

test.describe("cadastros catalogo — criar, editar, ficha técnica e o efeito na Venda", () => {
  test.describe.configure({ mode: "serial" });

  // Fase 5 (plano 05-01, D-17): a migração 0026 semeia os três itens que a Agenda acha por código
  // ("Mensalidade", "Inscrição em oficina", "Uso livre (hora)"), e item do sistema não se apaga
  // (gatilho `travar_item_do_sistema`). Fase 06.4 (plano 06.4-01, D-05): a 0030 semeia mais três,
  // os que as Queimas acham por código ("Queima externa P", "Queima externa M", "Queima externa G").
  // Num banco novo o Catálogo não é vazio: o que ele mostra, antes de qualquer item cadastrado pelo
  // dono, são EXATAMENTE esses seis — e o "+ Novo item" do cabeçalho da lista abre o diálogo de
  // verdade. O estado vazio ("Nada no catálogo ainda.") não aparece mais depois da 0026.
  test("com o banco sem nenhum item cadastrado, a sub-aba Catálogo mostra só os seis itens do sistema e o botão abre o diálogo de verdade @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=catalogo");

    await expect(page.getByRole("heading", { name: "Nada no catálogo ainda.", level: 2 })).toHaveCount(0);
    await expect(page.getByTestId("catalogo-item")).toHaveCount(6);
    for (const nome of [
      "Mensalidade",
      "Inscrição em oficina",
      "Uso livre (hora)",
      "Queima externa P",
      "Queima externa M",
      "Queima externa G",
    ]) {
      await expect(linhaDoCatalogo(page, nome)).toHaveCount(1);
    }

    const botaoNovoItem = page.getByTestId("novo-item");
    await expect(botaoNovoItem).toBeVisible();
    await botaoNovoItem.click();

    // A etapa de vazio é só leitura — confere que o diálogo de verdade abriu e fecha sem salvar
    // nada.
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("cria insumo, item vendável, edita a ficha técnica, mostra o efeito na Venda, e as duas recusas humanas", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeGrao = `[e2e] Grão de café ${suf}`;
    const nomeCafe = `[e2e] Café 200 ml ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=catalogo");

    // 1. Cria o insumo "Grão de café" — só estoque próprio, unidade g, categoria da compra
    // "Insumos da cafeteria". O catálogo pode estar vazio ou não neste ponto (outro worker pode
    // já ter escrito) — `abrirNovoItem` cobre os dois estados.
    await abrirNovoItem(page);
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await page.getByLabel("Nome").fill(nomeGrao);
    await page.getByRole("checkbox", { name: "Tem estoque próprio" }).click();
    await page.getByRole("combobox", { name: "Unidade" }).click();
    await page.getByRole("option", { name: "g", exact: true }).click();
    await page.getByRole("combobox", { name: "Categoria da compra" }).click();
    await page.getByRole("option", { name: "Insumos da cafeteria" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=catalogo$/);
    const linhaGrao = linhaDoCatalogo(page, nomeGrao);
    await expect(linhaGrao).toBeVisible();
    await expect(linhaGrao).toContainText("só insumo");
    await expect(linhaGrao).toContainText("estoque em g");

    // 2. Cria "Café 200 ml" — aparece na venda, nos mais usados, R$ 8, categoria "Bebidas e
    // comidas".
    await page.getByTestId("novo-item").click();
    await page.getByLabel("Nome").fill(nomeCafe);
    await page.getByRole("checkbox", { name: "Aparece na venda" }).click();
    await page.getByRole("combobox", { name: "Categoria de venda" }).click();
    await page.getByRole("option", { name: "Bebidas e comidas" }).click();
    await page.getByLabel("Preço de venda").fill("8");
    await page.getByRole("checkbox", { name: "Nos mais usados" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=catalogo$/);
    const linhaCafe = linhaDoCatalogo(page, nomeCafe);
    await expect(linhaCafe).toBeVisible();
    await expect(linhaCafe).toContainText("R$ 8,00");

    // 3. Edita o café e adiciona 15 g do grão na ficha técnica.
    await linhaCafe.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible();
    await page.getByRole("combobox", { name: "Insumo" }).click();
    await page.getByRole("option", { name: nomeGrao }).click();
    await page.getByLabel("Quantidade").fill("15");
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByTestId("ficha-linha")).toContainText(`15 g de ${nomeGrao}`);
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=catalogo$/);
    await expect(linhaCafe).toContainText(`gasta 15 g de ${nomeGrao}`);

    // 4. Na Venda, busca o café, põe na venda e o efeito mostra o que sai do estoque.
    await page.goto("/gestao/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await page.getByTestId("venda-atalho").filter({ hasText: nomeCafe }).click();

    const efeito = page.getByTestId("venda-efeito");
    await efeito.locator("summary").click();
    await expect(efeito).toContainText(`−15 g · ${nomeGrao}`);

    // 5. Tenta salvar um item sem "Aparece na venda" e sem "Tem estoque próprio" — a frase
    // aparece e o diálogo continua aberto e preenchido (nunca chega a submeter: o botão fica
    // desabilitado pela MESMA validação que o servidor usa).
    await page.goto("/gestao/cadastros?sub=catalogo");
    await page.getByTestId("novo-item").click();
    const nomeSemNada = `[e2e] Sem nada ${sufixoUnico()}`;
    await page.getByLabel("Nome").fill(nomeSemNada);
    await expect(
      page.getByText(
        "Marque Aparece na venda ou Tem estoque próprio — senão o item não aparece em lugar nenhum.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveValue(nomeSemNada);
    await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // 6. Tenta tirar o estoque do grão, que agora é insumo do café — recusado com o nome do
    // café.
    await linhaGrao.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Tem estoque próprio" }).click();
    await expect(
      page.getByText(`Esse item é insumo de ${nomeCafe} — tire da ficha técnica antes.`),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // 7. Cria um item sem preço — a lista mostra "valor na hora".
    await page.getByTestId("novo-item").click();
    const nomeSemPreco = `[e2e] Item sem preço ${sufixoUnico()}`;
    await page.getByLabel("Nome").fill(nomeSemPreco);
    await page.getByRole("checkbox", { name: "Aparece na venda" }).click();
    await page.getByRole("combobox", { name: "Categoria de venda" }).click();
    await page.getByRole("option", { name: "Bebidas e comidas" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=catalogo$/);
    await expect(
      linhaDoCatalogo(page, nomeSemPreco),
    ).toContainText("valor na hora");
  });

  test("a 320px de largura, /cadastros?sub=catalogo não exige rolagem horizontal", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/gestao/cadastros?sub=catalogo");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/gestao/cadastros?sub=catalogo rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

// Plano 06-08 (D-20): item se DESATIVA, nunca se apaga. Cada caso semeia os próprios itens com
// sufixo único ("[e2e] … {sufixo}") e só afirma sobre eles — nenhuma condição global do banco.
const CATEGORIA_DE_VENDA = "Bebidas e comidas";
const CATEGORIA_DE_COMPRA = "Argila, esmalte e insumos";

async function abrirEdicao(page: Page, nome: string) {
  await linhaDoCatalogo(page, nome).getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible();
}

test.describe("cadastros catalogo ativo — desativar em vez de apagar", () => {
  test("(a) desativar tira da Venda sem apagar, e reativar devolve", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Bolo de fubá ${suf}`;
    await semearItem({
      nome,
      categoriaVenda: CATEGORIA_DE_VENDA,
      precoCentavos: 1200,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=catalogo");
    await abrirEdicao(page, nome);

    await page.getByTestId("catalogo-desativar").click();
    const confirmacao = page.getByTestId("confirmar-desativacao");
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao).toContainText(`Desativar ${nome}?`);
    await expect(confirmacao).toContainText("Nada é apagado");
    await confirmacao.getByRole("button", { name: "Desativar item" }).click();

    await expect(page.getByText(`${nome} desativado.`)).toBeVisible();
    await expect(
      linhaDoCatalogo(page, nome).getByTestId("catalogo-chip-desativado"),
    ).toHaveText("Desativado");

    // Na Venda, a busca pelo sufixo não acha mais o item.
    await page.goto("/gestao/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await expect(page.getByTestId("venda-atalho").filter({ hasText: nome })).toHaveCount(0);

    // Reativar grava direto, sem confirmação, e o item volta à Venda.
    await page.goto("/gestao/cadastros?sub=catalogo");
    await abrirEdicao(page, nome);
    await page.getByTestId("catalogo-reativar").click();
    await expect(page.getByText(`${nome} reativado.`)).toBeVisible();
    await expect(
      linhaDoCatalogo(page, nome).getByTestId("catalogo-chip-desativado"),
    ).toHaveCount(0);

    await page.goto("/gestao/financeiro");
    await page.getByTestId("venda-busca").fill(suf);
    await expect(page.getByTestId("venda-atalho").filter({ hasText: nome })).toHaveCount(1);
  });

  test("(b) insumo da ficha de um produto ativo não desativa, e a recusa diz qual produto", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeInsumo = `[e2e] Grão ${suf}`;
    const nomeProduto = `[e2e] Café coado ${suf}`;
    const insumoId = await semearMaterial({
      nome: nomeInsumo,
      unidade: "g",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await semearItem({
      nome: nomeProduto,
      categoriaVenda: CATEGORIA_DE_VENDA,
      precoCentavos: 800,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId, quantidade: "15" }],
    });

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=catalogo");
    await abrirEdicao(page, nomeInsumo);

    await page.getByTestId("catalogo-desativar").click();
    const confirmacao = page.getByTestId("confirmar-desativacao");
    await confirmacao.getByRole("button", { name: "Desativar item" }).click();
    await expect(confirmacao.getByRole("alert")).toContainText(
      `Esse item é insumo de ${nomeProduto} — tire da ficha técnica antes.`,
    );
    await confirmacao.getByRole("button", { name: "Voltar" }).click();
    await expect(confirmacao).toBeHidden();

    await page.reload();
    await expect(linhaDoCatalogo(page, nomeInsumo)).toBeVisible();
    await expect(
      linhaDoCatalogo(page, nomeInsumo).getByTestId("catalogo-chip-desativado"),
    ).toHaveCount(0);
  });

  test("(c) item com movimentação no Estoque não troca de unidade", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Argila ${suf}`;
    const itemId = await semearMaterial({ nome, unidade: "kg", categoriaCompra: CATEGORIA_DE_COMPRA });

    await fazerLogin(page);

    // Uma entrada pela folha do Estoque — a porta de verdade do livro.
    await page.goto("/gestao/estoque");
    const cartao = page
      .locator(`[data-testid="estoque-cartao"][data-item-id="${itemId}"]`)
      .filter({ visible: true });
    await cartao.getByTestId("estoque-dar-baixa").click();
    const folha = page.getByTestId("folha-movimentacao");
    await folha.getByTestId("folha-tipo-entrada").click();
    await folha.getByTestId("folha-quantidade").fill("5");
    await folha.getByTestId("folha-custo").fill("21,00");
    await folha.getByTestId("folha-registrar").click();
    await expect(page.getByText(`Entrada de 5 kg em ${nome}.`)).toBeVisible();

    await page.goto("/gestao/cadastros?sub=catalogo");
    await abrirEdicao(page, nome);
    await page.getByRole("combobox", { name: "Unidade" }).click();
    await page.getByRole("option", { name: "g", exact: true }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(
      page.getByText(
        "Este item já tem movimentação no Estoque — a unidade e o “Tem estoque próprio” não mudam mais. Se ele saiu de uso, desative.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Editar item" })).toBeVisible();

    await page.reload();
    await expect(linhaDoCatalogo(page, nome)).toContainText("estoque em kg");
  });

  test("(d) insumo desativado não é opção nova na ficha, mas continua na ficha que já o tinha", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDesativado = `[e2e] Esmalte antigo ${suf}`;
    const nomeAtivo = `[e2e] Esmalte novo ${suf}`;
    const nomeComFicha = `[e2e] Caneca pintada ${suf}`;
    const nomeSemFicha = `[e2e] Prato raso ${suf}`;
    const desativadoId = await semearMaterial({
      nome: nomeDesativado,
      unidade: "g",
      categoriaCompra: CATEGORIA_DE_COMPRA,
    });
    await semearMaterial({ nome: nomeAtivo, unidade: "g", categoriaCompra: CATEGORIA_DE_COMPRA });
    await semearItem({
      nome: nomeComFicha,
      categoriaVenda: CATEGORIA_DE_VENDA,
      precoCentavos: 5000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: desativadoId, quantidade: "15" }],
    });
    await semearItem({
      nome: nomeSemFicha,
      categoriaVenda: CATEGORIA_DE_VENDA,
      precoCentavos: 4000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
    });
    // Montagem do cenário: o insumo já estava numa ficha quando foi desativado. Pela tela isso
    // seria recusado (caso b) — o banco é o único jeito de chegar aqui, como num item desativado
    // antes de a regra existir.
    await desativarNoBanco(desativadoId);

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=catalogo");

    // Outro produto: o desativado não aparece como insumo novo; o ativo, sim.
    await abrirEdicao(page, nomeSemFicha);
    await page.getByRole("combobox", { name: "Insumo" }).click();
    await expect(page.getByRole("option", { name: nomeAtivo })).toBeVisible();
    await expect(page.getByRole("option", { name: nomeDesativado })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancelar" }).click();

    // O produto que já tinha o insumo desativado na ficha continua com ele e salva sem erro.
    await abrirEdicao(page, nomeComFicha);
    await expect(page.getByTestId("ficha-linha")).toContainText(`15 g de ${nomeDesativado}`);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=catalogo$/);
    await expect(linhaDoCatalogo(page, nomeComFicha)).toContainText(
      `gasta 15 g de ${nomeDesativado}`,
    );
  });
});

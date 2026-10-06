import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { medirCaixa } from "./apoio/medir-caixa";
import { ligarVendaAInscricao, semearCliente, semearInscricao, semearOficina } from "./apoio/semear-agenda";
import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { saldoNoBanco, semearMaterial } from "./apoio/semear-estoque";
import { hojeNoAtelie, semearItem, somarDiasAoHoje } from "./apoio/semear-financeiro";
import { idDoDocumentoComLinha, semearFornecedor } from "./apoio/semear-fornecedores";

// O “Corrigir” uma venda (Fase 06.5, plano 17 — D-18 com a UI-D9 do dono, 05/10/2026; UI-D10, UI-D11,
// POL-08). A original CONTINUA VALENDO enquanto a corrigida é preenchida; ela só é cancelada na mesma
// transação em que a corrigida é lançada (plano 16). Cada teste semeia os PRÓPRIOS documentos e itens,
// com nomes inventados e sufixo único — nenhuma afirmação sobre o estado global do banco.

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

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

type DocumentoNoBanco = { id: string; numero: number; cancelado: boolean };

async function documentoNoBanco(id: string): Promise<DocumentoNoBanco> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string; numero: number; cancelado: boolean }>(
      "select id, numero, cancelado_em is not null as cancelado from documentos where id = $1",
      [id],
    );
    if (!rows[0]) {
      throw new Error(`documentoNoBanco: nenhum documento ${id}.`);
    }
    return rows[0];
  });
}

// As vendas que levam um item, na ordem do número.
async function vendasDoItem(itemId: string): Promise<(DocumentoNoBanco & { quantidade: number })[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<DocumentoNoBanco & { quantidade: number }>(
      `select d.id, d.numero, d.cancelado_em is not null as cancelado, l.quantidade
         from documento_linhas l
         join documentos d on d.id = l.documento_id
        where l.item_id = $1
        order by d.numero`,
      [itemId],
    );
    return rows;
  });
}

async function corrigidaPor(originalId: string): Promise<string | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ corrigido_id: string }>(
      "select corrigido_id from correcoes_de_documento where original_id = $1",
      [originalId],
    );
    return rows[0]?.corrigido_id ?? null;
  });
}

// Lança uma venda pela tela (molde de `estoque-financeiro.spec.ts`): busca pelo sufixo, toca o item quantas
// vezes pedir, paga em dinheiro e espera a navegação de sucesso.
async function venderPelaTela(page: Page, busca: string, nome: string, vezes: number) {
  await page.goto("/gestao/financeiro");
  await page.getByTestId("venda-busca").fill(busca);
  for (let vez = 0; vez < vezes; vez++) {
    await page.getByTestId("venda-atalho").filter({ hasText: nome }).click();
  }
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  const botao = page.getByRole("button", { name: "Lançar venda" });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page.getByText(/^Venda nº \d+ lançada/)).toBeVisible({ timeout: 10000 });
}

// Abre o detalhe do documento direto pelo Caixa (`?documentoId=`, o mesmo caminho de “Ver venda no
// Financeiro”) e toca em “Corrigir esta venda” (ou “… despesa”).
async function abrirCorrecao(page: Page, documentoId: string, tipo: "venda" | "despesa" = "venda") {
  await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${documentoId}`);
  const detalhe = page.getByTestId("documento-detalhe");
  await expect(detalhe).toBeVisible();
  const corrigir = detalhe.getByTestId("documento-corrigir");
  await expect(corrigir).toHaveText(`Corrigir esta ${tipo}`);
  await corrigir.click();
  await expect(page).toHaveURL(new RegExp(`aba=${tipo}&corrige=${documentoId}`));
  await expect(page.getByTestId("faixa-correcao")).toBeVisible();
}

// Os documentos (despesas) ligados a um fornecedor, na ordem do número.
async function despesasDoFornecedor(fornecedorId: string): Promise<(DocumentoNoBanco & { pessoaNome: string | null })[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<DocumentoNoBanco & { pessoaNome: string | null }>(
      `select id, numero, cancelado_em is not null as cancelado, pessoa_nome as "pessoaNome"
         from documentos
        where fornecedor_id = $1
        order by numero`,
      [fornecedorId],
    );
    return rows;
  });
}

test.describe("polimento corrigir — venda", () => {
  test("(a) “Corrigir” abre a Venda preenchida com a faixa; voltar ao Caixa sem lançar não muda nada", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Vaso da Clarice Inventada ${suf}`;
    const hoje = hojeNoAtelie();
    // Uma venda de valor livre, à vista EM ABERTO (vence hoje) — sem estoque.
    const original = await semearContaAPagar({
      titulo,
      pessoa: "Clarice Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 4200,
      vencimento: hoje,
      tipo: "venda",
    });

    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${original.documentoId}`);
    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    const corrigir = detalhe.getByTestId("documento-corrigir");
    await expect(corrigir).toHaveText("Corrigir esta venda");
    expect((await medirCaixa(corrigir)).height).toBeGreaterThanOrEqual(44);
    // À esquerda de “Cancelar esta venda”, na mesma fileira de ações (antes dele na ordem).
    await expect(
      detalhe.locator('[data-testid="documento-corrigir"] ~ button', { hasText: "Cancelar esta venda" }),
    ).toHaveCount(1);

    await corrigir.click();
    await expect(page).toHaveURL(new RegExp(`aba=venda&corrige=${original.documentoId}`));

    // A faixa: role="status", o id da original, as três linhas (sem o trecho do estoque).
    const faixa = page.getByTestId("faixa-correcao");
    await expect(faixa).toBeVisible();
    await expect(faixa).toHaveAttribute("role", "status");
    await expect(faixa).toHaveAttribute("data-original-id", original.documentoId);
    await expect(faixa.getByTestId("faixa-correcao-titulo")).toHaveText(`Corrigindo a venda nº ${original.numero}`);
    await expect(faixa.getByTestId("faixa-correcao-linha2")).toHaveText(
      `A nº ${original.numero} continua valendo até você lançar esta. Ao lançar, ela é cancelada (fica riscada no extrato) e esta entra no lugar, com outro número.`,
    );
    await expect(faixa).toContainText("Se sair sem lançar, nada muda.");
    await expect(faixa.getByTestId("faixa-correcao-de-fora")).toHaveCount(0);

    // O carrinho, a pessoa e o pagamento como estavam: a linha livre, R$ 42,00, à vista em aberto até hoje.
    await expect(page.getByTestId("venda-linha").filter({ hasText: titulo })).toBeVisible();
    await expect(page.getByTestId("venda-total")).toHaveText("R$ 42,00");
    await expect(page.getByPlaceholder("quem comprou")).toHaveValue("Clarice Inventada");
    await expect(page.getByTestId("pagamento-ja-pago").getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByTestId("pagamento-vence-em")).toHaveValue(hoje);
    const lancar = page.getByTestId("lancar-correcao");
    await expect(lancar).toHaveText(`Lançar e cancelar a nº ${original.numero}`);
    await expect(lancar).toBeEnabled();

    // Desistir: “Voltar ao Caixa” não grava nada — a original continua ativa e sem risco.
    await faixa.getByTestId("faixa-correcao-voltar").click();
    await expect(page).toHaveURL(/aba=caixa/);
    await expect(page.getByTestId("conta-cartao").filter({ hasText: titulo })).toBeVisible();
    expect((await documentoNoBanco(original.documentoId)).cancelado).toBe(false);
    expect(await corrigidaPor(original.documentoId)).toBeNull();
  });

  test("(b) mudar a quantidade e “Lançar e cancelar a nº N”: a original riscada, a nova no lugar, o estoque refeito", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const argila = await semearMaterial({
      nome: `[e2e] Argila da correção ${suf}`,
      unidade: "kg",
      categoriaCompra: "Argila, esmalte e insumos",
    });
    const nomeCaneca = `[e2e] Caneca da correção ${suf}`;
    const caneca = await semearItem({
      nome: nomeCaneca,
      categoriaVenda: "Peças prontas",
      precoCentavos: 5000,
      apareceNaVenda: true,
      atalhoVenda: false,
      controlaEstoque: false,
      atalhoCompra: false,
      ficha: [{ insumoId: argila, quantidade: "0.08" }],
    });

    await fazerLogin(page);
    await venderPelaTela(page, suf, nomeCaneca, 2);
    const [venda] = await vendasDoItem(caneca);
    expect(venda.quantidade).toBe(2);
    expect(await saldoNoBanco(argila)).toBe(-160);

    await abrirCorrecao(page, venda.id);
    const faixa = page.getByTestId("faixa-correcao");
    // A original mexeu no estoque: a faixa diz que o material volta.
    await expect(faixa.getByTestId("faixa-correcao-linha2")).toContainText(
      "(fica riscada no extrato, e o material dela volta ao estoque)",
    );
    const linha = page.getByTestId("venda-linha").filter({ hasText: nomeCaneca });
    await expect(linha.getByTestId("venda-linha-quantidade")).toHaveText("2");
    await expect(page.getByTestId("venda-total")).toHaveText("R$ 100,00");

    // Uma a mais — o carrinho regenera o pagamento (à vista, recebido, em dinheiro, como a original).
    await linha.getByRole("button", { name: "mais um" }).click();
    await expect(linha.getByTestId("venda-linha-quantidade")).toHaveText("3");
    await expect(page.getByTestId("venda-total")).toHaveText("R$ 150,00");
    await expect(page.getByTestId("pagamento-ja-pago").getByRole("checkbox")).toBeChecked();

    const lancar = page.getByTestId("lancar-correcao");
    await expect(lancar).toHaveText(`Lançar e cancelar a nº ${venda.numero}`);
    await expect(lancar).toBeEnabled();
    await lancar.click();

    // O toast cita os dois números; a tela volta à Venda comum, sem a faixa e sem `?corrige=`.
    const toast = page.getByText(
      // `\s`: o `Intl` separa “R$” do valor com espaço não separável (molde de `financeiro-despesa.spec.ts`).
      new RegExp(`^Venda nº ${venda.numero} cancelada e nº (\\d+) lançada no lugar · R\\$\\s150,00$`),
    );
    await expect(toast).toBeVisible({ timeout: 10000 });
    // O sonner some sozinho: o número da nova é lido já.
    const numeroNova = Number(/nº (\d+) lançada/.exec((await toast.textContent()) ?? "")?.[1]);
    await expect(page).not.toHaveURL(/corrige=/);
    await expect(page.getByTestId("faixa-correcao")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lançar venda" })).toBeVisible();

    // O banco: a original cancelada, a nova ativa com 3, o vínculo, e o estoque refeito (−160 voltou,
    // −240 saiu).
    const vendas = await vendasDoItem(caneca);
    expect(vendas).toHaveLength(2);
    expect(vendas[0]).toMatchObject({ id: venda.id, cancelado: true, quantidade: 2 });
    expect(vendas[1]).toMatchObject({ cancelado: false, quantidade: 3 });
    expect(vendas[1].numero).toBe(numeroNova);
    expect(await corrigidaPor(venda.id)).toBe(vendas[1].id);
    expect(await saldoNoBanco(argila)).toBe(-240);

    // No Caixa: a original riscada (“cancelada”), a nova ativa.
    await page.goto("/gestao/financeiro?aba=caixa");
    const linhasDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nomeCaneca });
    await expect(linhasDoExtrato).toHaveCount(2);
    await expect(linhasDoExtrato.filter({ hasText: "cancelada" })).toHaveCount(1);
    await expect(linhasDoExtrato.filter({ hasText: /R\$\s150,00/ })).not.toContainText("cancelada");
  });
});

// O detalhe conta a história da correção e diz por onde corrigir o que não se corrige aqui (06.5-17,
// Tarefa 2 — UI-D10; E12 partial/error da UI-SPEC).
test.describe("polimento corrigir — detalhe", () => {
  test("(a) depois da correção, a original diz “Corrigida pela…”, a nova “Corrige a…”, e o ?corrige= da original cancelada dá a frase de cancelada", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Prato da Aurora Inventada ${suf}`;
    const original = await semearContaAPagar({
      titulo,
      pessoa: "Aurora Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 7000,
      vencimento: hojeNoAtelie(),
      tipo: "venda",
    });

    await fazerLogin(page);
    // Corrigir sem nada mudar no meio: a versão da página e a da transação coincidem (plano 16).
    await abrirCorrecao(page, original.documentoId);
    await page.getByTestId("lancar-correcao").click();
    await expect(
      page.getByText(new RegExp(`^Venda nº ${original.numero} cancelada e nº \\d+ lançada no lugar · R\\$\\s70,00$`)),
    ).toBeVisible({ timeout: 10000 });
    const novaId = await corrigidaPor(original.documentoId);
    expect(novaId).not.toBeNull();
    const nova = await documentoNoBanco(novaId ?? "");

    // A original (cancelada): o vínculo, e nem botão nem frase de origem.
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${original.documentoId}`);
    let detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByTestId("documento-corrigida-por")).toHaveText(`Corrigida pela venda nº ${nova.numero}`);
    await expect(detalhe.getByTestId("documento-corrige")).toHaveCount(0);
    await expect(detalhe.getByTestId("documento-corrigir")).toHaveCount(0);
    await expect(detalhe.getByTestId("documento-sem-corrigir")).toHaveCount(0);

    // A nova: o vínculo do outro lado — e ela mesma se corrige, se precisar.
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${nova.id}`);
    detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByTestId("documento-corrige")).toHaveText(`Corrige a venda nº ${original.numero}`);
    await expect(detalhe.getByTestId("documento-corrigida-por")).toHaveCount(0);
    await expect(detalhe.getByTestId("documento-corrigir")).toBeVisible();

    // `?corrige=` da original já cancelada: a frase, com “Voltar ao Caixa” — nenhum carrinho.
    await page.goto(`/gestao/financeiro?aba=venda&corrige=${original.documentoId}`);
    const indisponivel = page.getByTestId("correcao-indisponivel");
    await expect(indisponivel).toContainText(
      `A venda nº ${original.numero} já foi cancelada — não há o que corrigir. Se precisar, lance uma venda nova.`,
    );
    await expect(indisponivel.getByTestId("correcao-voltar-ao-caixa")).toHaveText("Voltar ao Caixa");
    await expect(page.getByTestId("faixa-correcao")).toHaveCount(0);
    await expect(page.getByTestId("lancar-correcao")).toHaveCount(0);
  });

  test("(b) uma venda da Agenda diz por onde corrigir e não tem “Corrigir”; o ?corrige= dela dá a mesma frase", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const clienteId = await semearCliente({ nome: `[e2e] Benedita Inventada ${suf}` });
    // Longe dos dias que as outras specs da Agenda usam (300, 330, 360, 500, 600, 700…).
    const diaDaOficina = somarDiasAoHoje(test.info().project.name === "celular" ? 778 : 777);
    const eventoId = await semearOficina({
      titulo: `[e2e] Oficina de esmalte ${suf}`,
      data: diaDaOficina,
      inicio: "14:00",
      fim: "17:00",
      vagas: 8,
      precoCentavos: 9000,
    });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 9000 });
    const venda = await ligarVendaAInscricao({
      inscricaoId,
      valorCentavos: 9000,
      descricao: `[e2e] Inscrição da Benedita ${suf}`,
      data: hojeNoAtelie(),
    });
    const frase = "Esta venda veio da Agenda. Para corrigir, cancele aqui e lance de novo por lá.";

    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${venda.documentoId}`);
    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByTestId("documento-sem-corrigir")).toHaveText(frase);
    await expect(detalhe.getByTestId("documento-corrigir")).toHaveCount(0);
    // O cancelamento continua lá: é por ele que se corrige.
    await expect(detalhe.getByRole("button", { name: "Cancelar esta venda" })).toBeVisible();

    await page.goto(`/gestao/financeiro?aba=venda&corrige=${venda.documentoId}`);
    await expect(page.getByTestId("correcao-indisponivel")).toContainText(frase);
    await expect(page.getByTestId("faixa-correcao")).toHaveCount(0);
  });

  test("(c) ?corrige= que não acha a venda (uuid inexistente ou lixo) dá a frase de não achado", async ({ page }) => {
    const frase = "Não achei a venda a corrigir. Volte ao Caixa e toque em “Corrigir esta venda” de novo.";
    await fazerLogin(page);
    for (const valor of ["00000000-0000-4000-8000-000000000000", "nao-e-um-id"]) {
      await page.goto(`/gestao/financeiro?aba=venda&corrige=${valor}`);
      const indisponivel = page.getByTestId("correcao-indisponivel");
      await expect(indisponivel).toContainText(frase);
      await expect(indisponivel.getByTestId("correcao-voltar-ao-caixa")).toHaveAttribute("href", "/gestao/financeiro?aba=caixa");
      await expect(page.getByTestId("faixa-correcao")).toHaveCount(0);
    }
  });
});

// O “Corrigir” uma DESPESA (Fase 06.5, plano 18 — D-18/UI-D9, POL-08 “inclusive o fornecedor”): a Despesa
// abre com as linhas de material (a quantidade de estoque e o valor da linha antiga), o fornecedor do
// cadastro ainda ligado, a data e o pagamento. Lançar cancela a original — as entradas de material dela
// saem do estoque — e lança a nova, ligada ao mesmo fornecedor.
test.describe("polimento corrigir — despesa", () => {
  test("(a) uma compra de 5 corrigida para 3: o fornecedor ligado, a original riscada e o estoque com +3, não +8", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Olaria da Correção Inventada ${suf}`;
    const nomeDoMaterial = `[e2e] Esmalte da correção ${suf}`;
    const fornecedorId = await semearFornecedor({ nome: nomeDoFornecedor, vende: "esmalte" });
    const material = await semearItem({
      nome: nomeDoMaterial,
      apareceNaVenda: false,
      atalhoVenda: false,
      controlaEstoque: true,
      unidade: "un",
      categoriaCompra: "Argila, esmalte e insumos",
      atalhoCompra: true,
    });

    // A original, lançada pela tela: 5 un por R$ 100,00, paga em dinheiro, ligada ao fornecedor.
    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=despesa");
    await page.getByTestId("despesa-modo-compra").click();
    await page.getByTestId("compra-busca").fill(suf);
    await page.getByTestId("compra-atalho").filter({ hasText: nomeDoMaterial }).click();
    await expect(page.getByTestId("compra-linha")).toHaveCount(1);
    await page.getByLabel("Fornecedor (opcional)").fill(nomeDoFornecedor);
    await page.getByTestId("despesa-fornecedor-opcao").filter({ hasText: nomeDoFornecedor }).click();
    await expect(page.getByTestId("despesa-fornecedor-vinculo")).toHaveAttribute("data-estado", "ligado");
    await page.getByTestId("compra-quantos").fill("5");
    await page.getByTestId("compra-custou").fill("100");
    const lancarDespesa = page.getByRole("button", { name: "Lançar despesa" });
    await expect(lancarDespesa).toBeEnabled();
    await lancarDespesa.click();
    await expect(page.getByText(/^Despesa nº \d+ lançada · R\$\s100,00$/)).toBeVisible({ timeout: 10000 });
    const originalId = await idDoDocumentoComLinha(nomeDoMaterial);
    const original = await documentoNoBanco(originalId);
    expect(await saldoNoBanco(material)).toBe(5000);

    // “Corrigir esta despesa” → a Despesa preenchida, com a faixa na variante despesa (com o estoque).
    await abrirCorrecao(page, originalId, "despesa");
    const faixa = page.getByTestId("faixa-correcao");
    await expect(faixa).toHaveAttribute("data-original-id", originalId);
    await expect(faixa.getByTestId("faixa-correcao-titulo")).toHaveText(`Corrigindo a despesa nº ${original.numero}`);
    await expect(faixa.getByTestId("faixa-correcao-linha2")).toHaveText(
      `A nº ${original.numero} continua valendo até você lançar esta. Ao lançar, ela é cancelada (fica riscada no extrato, e as entradas de material dela saem do estoque) e esta entra no lugar, com outro número.`,
    );
    await expect(page.getByTestId("despesa-modo-compra")).toHaveAttribute("aria-pressed", "true");
    // O fornecedor escolhido, ainda ligado ao cadastro; a linha com a quantidade e o valor da original.
    await expect(page.getByLabel("Fornecedor (opcional)")).toHaveValue(nomeDoFornecedor);
    await expect(page.getByTestId("despesa-fornecedor-vinculo")).toHaveAttribute("data-estado", "ligado");
    const linha = page.getByTestId("compra-linha").filter({ hasText: nomeDoMaterial });
    await expect(linha).toHaveCount(1);
    await expect(linha.getByTestId("compra-quantos")).toHaveValue("5");
    await expect(linha.getByTestId("compra-custou")).toHaveValue("100,00");
    await expect(page.getByTestId("despesa-total")).toHaveText(/^R\$\s100,00$/);

    // 3 em vez de 5 — o total não muda, o pagamento continua como estava (pago).
    await linha.getByTestId("compra-quantos").fill("3");
    await expect(page.getByTestId("pagamento-ja-pago").getByRole("checkbox")).toBeChecked();
    const lancar = page.getByTestId("lancar-correcao");
    await expect(lancar).toHaveText(`Lançar e cancelar a nº ${original.numero}`);
    await expect(lancar).toBeEnabled();
    await lancar.click();

    const toast = page.getByText(
      new RegExp(`^Despesa nº ${original.numero} cancelada e nº (\\d+) lançada no lugar · R\\$\\s100,00$`),
    );
    await expect(toast).toBeVisible({ timeout: 10000 });
    const numeroNova = Number(/nº (\d+) lançada/.exec((await toast.textContent()) ?? "")?.[1]);
    await expect(page).not.toHaveURL(/corrige=/);
    await expect(page.getByTestId("faixa-correcao")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lançar despesa" })).toBeVisible();

    // O banco: a original cancelada, a nova ativa ligada ao MESMO fornecedor, o vínculo, e o estoque com +3
    // (as +5 da original saíram, as +3 da nova entraram).
    const despesas = await despesasDoFornecedor(fornecedorId);
    expect(despesas).toHaveLength(2);
    expect(despesas[0]).toMatchObject({ id: originalId, cancelado: true });
    expect(despesas[1]).toMatchObject({ numero: numeroNova, cancelado: false, pessoaNome: nomeDoFornecedor });
    expect(await corrigidaPor(originalId)).toBe(despesas[1].id);
    expect(await saldoNoBanco(material)).toBe(3000);

    // No Caixa: a original riscada, a nova ativa; o detalhe da nova mostra o fornecedor e o vínculo.
    await page.goto("/gestao/financeiro?aba=caixa");
    const linhasDoExtrato = page.getByTestId("extrato-linha").filter({ hasText: nomeDoMaterial });
    await expect(linhasDoExtrato).toHaveCount(2);
    await expect(linhasDoExtrato.filter({ hasText: "cancelada" })).toHaveCount(1);
    await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${despesas[1].id}`);
    const detalhe = page.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await expect(detalhe).toContainText(nomeDoFornecedor);
    await expect(detalhe.getByTestId("documento-corrige")).toHaveText(`Corrige a despesa nº ${original.numero}`);
  });
});

// Os documentos que têm uma linha com esta descrição (o título semeado, único por teste), na ordem do número.
async function documentosComLinha(descricao: string): Promise<DocumentoNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<DocumentoNoBanco>(
      `select distinct d.id, d.numero, d.cancelado_em is not null as cancelado
         from documento_linhas l
         join documentos d on d.id = l.documento_id
        where l.descricao = $1
        order by d.numero`,
      [descricao],
    );
    return rows;
  });
}

async function corrigeAlguma(novaId: string): Promise<boolean> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query("select 1 from correcoes_de_documento where corrigido_id = $1", [novaId]);
    return rows.length > 0;
  });
}

// A “outra pessoa” das recusas: um segundo `page` na MESMA sessão (outro celular do mesmo gestor) que cancela a
// original pelo detalhe do Caixa entre abrir e lançar a correção — nunca uma espera fixa.
async function cancelarEmOutraPagina(page: Page, documentoId: string, tipo: "venda" | "despesa") {
  const outra = await page.context().newPage();
  try {
    await outra.goto(`/gestao/financeiro?aba=caixa&documentoId=${documentoId}`);
    const detalhe = outra.getByTestId("documento-detalhe");
    await expect(detalhe).toBeVisible();
    await detalhe.getByRole("button", { name: `Cancelar esta ${tipo}` }).click();
    await outra.getByRole("alertdialog").getByRole("button", { name: `Cancelar ${tipo}`, exact: true }).click();
    await expect(outra.getByText(/^Lançamento nº \d+ cancelado\./)).toBeVisible({ timeout: 10000 });
  } finally {
    await outra.close();
  }
}

// … ou que recebe/paga a parcela em aberto da original pelo Caixa (“Recebi”/“Paguei” → “Confirmar”).
async function baixarEmOutraPagina(page: Page, titulo: string, toast: RegExp) {
  const outra = await page.context().newPage();
  try {
    await outra.goto("/gestao/financeiro?aba=caixa");
    const cartao = outra.getByTestId("conta-cartao").filter({ hasText: titulo });
    await cartao.getByRole("button", { name: /^(Paguei|Recebi)$/ }).click();
    await outra.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(outra.getByText(toast)).toBeVisible({ timeout: 10000 });
  } finally {
    await outra.close();
  }
}

// As recusas do lançamento da correção, na tela (Fase 06.5, plano 18 — 06.5-UI-SPEC.md §Erros “Lançar a
// correção”, E12 error): o motivo vem da ação (plano 16), a frase vai para `correcao-erro` (`role="alert"`, com
// o foco), os campos ficam, e o caminho depende do motivo. O `ja_corrigida` não tem caso de tela: ele só
// acontece com dois lançamentos SOBREPOSTOS da mesma correção, e está provado contra o Postgres pela prova de
// corrida do plano 16 (`scripts/provar-corridas-da-correcao.ts`, caso (b)); a tela só mostra a frase que a
// ação devolve, pelo mesmo caminho do `mudou`.
test.describe("polimento corrigir — recusas", () => {
  test("(a) venda — a original foi cancelada em outro celular: “cancelada”, e “Lançar como venda nova” lança uma venda comum", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Tigela da Dalva Inventada ${suf}`;
    const original = await semearContaAPagar({
      titulo,
      pessoa: "Dalva Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 3300,
      vencimento: hojeNoAtelie(),
      tipo: "venda",
    });

    await fazerLogin(page);
    await abrirCorrecao(page, original.documentoId);
    await cancelarEmOutraPagina(page, original.documentoId, "venda");

    await page.getByTestId("lancar-correcao").click();
    const erro = page.getByTestId("correcao-erro");
    await expect(erro).toHaveAttribute("data-motivo", "cancelada");
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(erro).toHaveText(
      `Nada foi lançado: a venda nº ${original.numero} já tinha sido cancelada (talvez em outro celular). Os dados continuam aqui — se esta venda ainda vale, toque em “Lançar como venda nova”.`,
    );
    await expect(erro).toBeFocused();
    // Os campos ficam; nenhum “Voltar ao Caixa” aqui — o caminho é o botão.
    await expect(page.getByTestId("venda-linha").filter({ hasText: titulo })).toBeVisible();
    await expect(page.getByTestId("correcao-erro-voltar")).toHaveCount(0);
    const comoNova = page.getByTestId("lancar-como-nova");
    await expect(comoNova).toHaveText("Lançar como venda nova");
    expect((await medirCaixa(comoNova)).height).toBeGreaterThanOrEqual(44);
    // O foco vai para ele logo depois da frase.
    await page.keyboard.press("Tab");
    await expect(comoNova).toBeFocused();

    await comoNova.click();
    // Sai do modo correção sem perder o que foi digitado: `?corrige=` sai da URL, a faixa troca a 2ª linha e
    // o “Lançar” volta ao herdado.
    await expect(page).not.toHaveURL(/corrige=/);
    await expect(page.getByTestId("faixa-correcao-linha2")).toHaveText(
      `A nº ${original.numero} já foi cancelada — esta não está mais ligada a ela.`,
    );
    await expect(page.getByTestId("correcao-erro")).toHaveCount(0);
    await expect(page.getByTestId("lancar-correcao")).toHaveCount(0);
    await expect(page.getByTestId("venda-linha").filter({ hasText: titulo })).toBeVisible();
    const lancar = page.getByRole("button", { name: "Lançar venda" });
    await expect(lancar).toBeEnabled();
    await lancar.click();
    // O toast comum — não cita a nº da original, que ninguém desta tela cancelou.
    await expect(page.getByText(/^Venda nº \d+ lançada/)).toBeVisible({ timeout: 10000 });

    // A original continua cancelada (uma vez só), a nova é comum: ativa e sem vínculo.
    const documentos = await documentosComLinha(titulo);
    expect(documentos).toHaveLength(2);
    expect(documentos[0]).toMatchObject({ id: original.documentoId, cancelado: true });
    expect(documentos[1].cancelado).toBe(false);
    expect(await corrigidaPor(original.documentoId)).toBeNull();
    expect(await corrigeAlguma(documentos[1].id)).toBe(false);
  });

  test("(b) venda — uma parcela foi recebida em outro celular: “mudou”, “Voltar ao Caixa” e nada gravado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Jarra da Iolanda Inventada ${suf}`;
    const original = await semearContaAPagar({
      titulo,
      pessoa: "Iolanda Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 5100,
      vencimento: hojeNoAtelie(),
      tipo: "venda",
    });

    await fazerLogin(page);
    await abrirCorrecao(page, original.documentoId);
    await baixarEmOutraPagina(page, titulo, /^Recebido: R\$\s51,00/);

    await page.getByTestId("lancar-correcao").click();
    const erro = page.getByTestId("correcao-erro");
    await expect(erro).toHaveAttribute("data-motivo", "mudou");
    await expect(erro).toHaveText(
      `Nada foi lançado: a venda nº ${original.numero} mudou depois que você abriu a correção. Volte ao Caixa e toque em “Corrigir esta venda” de novo, para partir do que vale agora.`,
    );
    await expect(erro).toBeFocused();
    const voltar = page.getByTestId("correcao-erro-voltar");
    await expect(voltar).toHaveText("Voltar ao Caixa");
    await expect(voltar).toHaveAttribute("href", "/gestao/financeiro?aba=caixa");
    await expect(page.getByTestId("lancar-como-nova")).toHaveCount(0);
    await expect(page.getByTestId("venda-linha").filter({ hasText: titulo })).toBeVisible();

    // Nada gravado: uma venda só com esta linha, ativa, sem vínculo.
    const documentos = await documentosComLinha(titulo);
    expect(documentos).toHaveLength(1);
    expect(documentos[0]).toMatchObject({ id: original.documentoId, cancelado: false });
    expect(await corrigidaPor(original.documentoId)).toBeNull();
  });

  test("(c) despesa — a original foi cancelada em outro celular: “cancelada”, e “Lançar como despesa nova” lança uma despesa comum", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Conserto do torno inventado ${suf}`;
    const original = await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 4500,
      vencimento: hojeNoAtelie(),
      tipo: "despesa",
    });

    await fazerLogin(page);
    await abrirCorrecao(page, original.documentoId, "despesa");
    // A despesa de uma linha sem item abre em “Outra despesa”, com a descrição e o valor.
    await expect(page.getByTestId("despesa-modo-outra")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#despesa-outra-descricao")).toHaveValue(titulo);
    await expect(page.locator("#despesa-outra-valor")).toHaveValue("45,00");
    await cancelarEmOutraPagina(page, original.documentoId, "despesa");

    await page.getByTestId("lancar-correcao").click();
    const erro = page.getByTestId("correcao-erro");
    await expect(erro).toHaveAttribute("data-motivo", "cancelada");
    await expect(erro).toHaveText(
      `Nada foi lançado: a despesa nº ${original.numero} já tinha sido cancelada (talvez em outro celular). Os dados continuam aqui — se esta despesa ainda vale, toque em “Lançar como despesa nova”.`,
    );
    await expect(erro).toBeFocused();
    const comoNova = page.getByTestId("lancar-como-nova");
    await expect(comoNova).toHaveText("Lançar como despesa nova");
    expect((await medirCaixa(comoNova)).height).toBeGreaterThanOrEqual(44);

    await comoNova.click();
    await expect(page).not.toHaveURL(/corrige=/);
    await expect(page.getByTestId("faixa-correcao-linha2")).toHaveText(
      `A nº ${original.numero} já foi cancelada — esta não está mais ligada a ela.`,
    );
    await expect(page.locator("#despesa-outra-descricao")).toHaveValue(titulo);
    const lancar = page.getByRole("button", { name: "Lançar despesa" });
    await expect(lancar).toBeEnabled();
    await lancar.click();
    await expect(page.getByText(/^Despesa nº \d+ lançada/)).toBeVisible({ timeout: 10000 });

    const documentos = await documentosComLinha(titulo);
    expect(documentos).toHaveLength(2);
    expect(documentos[0]).toMatchObject({ id: original.documentoId, cancelado: true });
    expect(documentos[1].cancelado).toBe(false);
    expect(await corrigidaPor(original.documentoId)).toBeNull();
    expect(await corrigeAlguma(documentos[1].id)).toBe(false);
  });

  test("(d) despesa — a parcela foi paga em outro celular: “mudou”, a frase de despesa, “Voltar ao Caixa” e nada gravado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Frete do forno inventado ${suf}`;
    const original = await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 6200,
      vencimento: hojeNoAtelie(),
      tipo: "despesa",
    });

    await fazerLogin(page);
    await abrirCorrecao(page, original.documentoId, "despesa");
    await baixarEmOutraPagina(page, titulo, /^Pago: R\$\s62,00/);

    await page.getByTestId("lancar-correcao").click();
    const erro = page.getByTestId("correcao-erro");
    await expect(erro).toHaveAttribute("data-motivo", "mudou");
    await expect(erro).toHaveText(
      `Nada foi lançado: a despesa nº ${original.numero} mudou depois que você abriu a correção. Volte ao Caixa e toque em “Corrigir esta despesa” de novo, para partir do que vale agora.`,
    );
    await expect(erro).toBeFocused();
    await expect(page.getByTestId("correcao-erro-voltar")).toHaveText("Voltar ao Caixa");
    await expect(page.getByTestId("lancar-como-nova")).toHaveCount(0);
    await expect(page.locator("#despesa-outra-descricao")).toHaveValue(titulo);

    const documentos = await documentosComLinha(titulo);
    expect(documentos).toHaveLength(1);
    expect(documentos[0]).toMatchObject({ id: original.documentoId, cancelado: false });
    expect(await corrigidaPor(original.documentoId)).toBeNull();
  });

  test("(e) despesa — a internet caiu no lançamento: “rede”, os campos ficam, e lançar de novo corrige", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const titulo = `[e2e] Lenha do forno inventada ${suf}`;
    const original = await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 7300,
      vencimento: hojeNoAtelie(),
      tipo: "despesa",
    });

    await fazerLogin(page);
    await abrirCorrecao(page, original.documentoId, "despesa");

    // A Server Action é um POST para a própria página, com o cabeçalho `next-action` (molde do plano 06.5-14):
    // a primeira não chega ao servidor; as seguintes passam.
    let derrubadas = 0;
    await page.route("**/gestao/financeiro**", async (rota) => {
      const requisicao = rota.request();
      if (derrubadas === 0 && requisicao.method() === "POST" && requisicao.headers()["next-action"]) {
        derrubadas += 1;
        await rota.abort("internetdisconnected");
        return;
      }
      await rota.continue();
    });

    try {
      await page.getByTestId("lancar-correcao").click();
      const erro = page.getByTestId("correcao-erro");
      await expect(erro).toHaveAttribute("data-motivo", "rede");
      await expect(erro).toHaveText(
        `Não deu para lançar. A despesa nº ${original.numero} continua valendo e nada novo foi gravado — verifique a internet e tente de novo.`,
      );
      await expect(erro).toBeFocused();
      await expect(page.getByTestId("lancar-como-nova")).toHaveCount(0);
      await expect(page.locator("#despesa-outra-descricao")).toHaveValue(titulo);
      expect(derrubadas).toBe(1);
      const documentos = await documentosComLinha(titulo);
      expect(documentos).toHaveLength(1);
      expect(documentos[0].cancelado).toBe(false);

      // A internet volta: lançar de novo corrige.
      const lancar = page.getByTestId("lancar-correcao");
      await expect(lancar).toBeEnabled();
      await lancar.click();
      await expect(
        page.getByText(
          new RegExp(`^Despesa nº ${original.numero} cancelada e nº \\d+ lançada no lugar · R\\$\\s73,00$`),
        ),
      ).toBeVisible({ timeout: 10000 });
      expect(await corrigidaPor(original.documentoId)).not.toBeNull();
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});

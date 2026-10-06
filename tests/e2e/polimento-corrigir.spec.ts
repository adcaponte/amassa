import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { medirCaixa } from "./apoio/medir-caixa";
import { ligarVendaAInscricao, semearCliente, semearInscricao, semearOficina } from "./apoio/semear-agenda";
import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { saldoNoBanco, semearMaterial } from "./apoio/semear-estoque";
import { hojeNoAtelie, semearItem, somarDiasAoHoje } from "./apoio/semear-financeiro";

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
// Financeiro”) e toca em “Corrigir esta venda”.
async function abrirCorrecao(page: Page, documentoId: string) {
  await page.goto(`/gestao/financeiro?aba=caixa&documentoId=${documentoId}`);
  const detalhe = page.getByTestId("documento-detalhe");
  await expect(detalhe).toBeVisible();
  const corrigir = detalhe.getByTestId("documento-corrigir");
  await expect(corrigir).toHaveText("Corrigir esta venda");
  await corrigir.click();
  await expect(page).toHaveURL(new RegExp(`aba=venda&corrige=${documentoId}`));
  await expect(page.getByTestId("faixa-correcao")).toBeVisible();
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

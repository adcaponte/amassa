import { test, expect, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";

// "Atualizar preços" (04.5-09-PLAN.md, D-23): compara peça a peça o mínimo CONGELADO com o de
// HOJE, sugere um preço que preserva a razão preço ÷ mínimo da época, e guarda a revisão anterior
// antes de reabrir. Nomes inventados e únicos por execução ("[e2e] ... {sufixo}") — nenhum dado
// real do ateliê, o repositório é público.
//
// Parâmetro dedicado a este spec (nunca tocado por outro): `preco_folga_negociacao` (desktop) /
// `preco_imposto_sobre_venda` (celular) — nenhum dos dois é usado por `precificacao-parametros.
// spec.ts` (material_argila/material_esmalte/perda_unica/preco_lucro/trabalho_hora) nem por
// `orcamentos-ciclo.spec.ts` (forno_desgaste_por_fornada/forno_tarifa_energia). Os dois entram no
// MESMO divisor do mínimo (`lib/precificacao/calculo.ts`, junto de lucro/imposto/comissão de
// canal): subir qualquer um dos dois só pode SUBIR o mínimo de uma peça calculada pelo canal
// "direto" (o único que um orçamento usa), nunca baixar — a mesma garantia de monotonicidade que
// `orcamentos-ciclo.spec.ts` já usa para o parâmetro dele.
//
// A ORDEM abaixo segue a letra do plano (a, b, c, d, e, g) — "f" (aprovado sem o botão) está
// registrado como `test.skip` com o motivo inline: não existe, nesta fase, nenhum caminho pela
// UI para aprovar um orçamento (o botão "Cliente aprovou" é do plano 12 e continua desabilitado)
// — ver SUMMARY, "Decidido sem o dono", e WINDOWS.md.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function chaveDoParametroDedicado(): "preco_folga_negociacao" | "preco_imposto_sobre_venda" {
  return test.info().project.name.endsWith("celular") ? "preco_imposto_sobre_venda" : "preco_folga_negociacao";
}

async function definirParametro(page: Page, chave: string, valorTexto: string): Promise<void> {
  await page.goto("/cadastros?sub=parametros");
  const campo = page.getByTestId(`parametro-${chave}`).locator("input");
  await campo.fill(valorTexto);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
  await expect(page).toHaveURL(/\/cadastros\?sub=parametros$/);
}

// O valor ORIGINAL semeado por 0019 de cada parâmetro dedicado — em pontos-base (a escala do
// catálogo, ver lib/precificacao/parametros.ts): `preco_folga_negociacao` nasce em 1000 (10%),
// `preco_imposto_sobre_venda` nasce em 0 (0%, D-10: MEI, o DAS entra como conta fixa).
const VALOR_ORIGINAL_DO_PARAMETRO: Record<string, number> = {
  preco_folga_negociacao: 1000,
  preco_imposto_sobre_venda: 0,
};

// Restaura, DIRETO no banco (mesmo padrão de tests/e2e/apoio/parametro-no-banco.ts — nunca
// @/db/Drizzle), o valor do parâmetro dedicado deste spec para o original semeado. Achado real da
// varredura completa do plano 04.5-13 (Tarefa 1): o teste (a) SOBE o parâmetro pela tela e nunca
// desfazia — qualquer spec de precificação que rodasse DEPOIS dele no MESMO banco efêmero (ex.:
// precificacao-ficha.spec.ts/precificacao-pecas.spec.ts, que esperam o selo/mínimo calculado com
// os valores PADRÃO da semente) herdava o parâmetro já elevado e via um selo/mínimo diferente do
// esperado — não uma flakiness de contenção, uma poluição real de estado entre arquivos de spec.
// `vigente_desde = hoje_brasilia()` (não `current_date`): a linha de HOJE é a única que o gatilho
// (0020/0021) permite corrigir sem violar D-15.
async function restaurarParametroDedicado(chave: string): Promise<void> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await cliente.query(
      "update parametros_precificacao set valor_inteiro = $2 where chave = $1 and vigente_desde = hoje_brasilia()",
      [chave, VALOR_ORIGINAL_DO_PARAMETRO[chave]],
    );
  } finally {
    await cliente.end();
  }
}

async function criarOrcamento(page: Page): Promise<string> {
  await page.goto("/financeiro?aba=orcamentos");
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  await expect(page).toHaveURL(/\/financeiro\?aba=orcamentos&orcamento=/, { timeout: 10000 });
  return orcamentoIdDaUrl(page);
}

function orcamentoIdDaUrl(page: Page): string {
  const url = new URL(page.url());
  return url.searchParams.get("orcamento") ?? "";
}

// Nunca `waitForLoadState` isolado — a URL final pode ser idêntica à atual (mesma armadilha já
// documentada em outros specs desta fase).
async function blurEEsperarNavegacao(page: Page, campo: Locator): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

async function preencherCliente(page: Page, orcamentoId: string, nome: string): Promise<void> {
  const campo = page.getByTestId("orcamento-campo-cliente");
  await campo.fill(nome);
  await blurEEsperarNavegacao(page, campo);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
}

// A MESMA receita de `orcamentos-ciclo.spec.ts` — só o nome e o preço mudam por chamada.
async function acrescentarPecaExclusiva(page: Page, orcamentoId: string, nome: string, precoReais: string): Promise<void> {
  await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  await page.getByRole("link", { name: "+ Peça exclusiva deste pedido" }).click();
  await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();

  await page.getByTestId("ficha-campo-nome").fill(nome);
  await page.getByTestId("ficha-campo-argila").fill("450");
  await page.getByTestId("ficha-campo-esmalte").fill("60");
  await page.getByTestId("ficha-campo-horas").fill("0,6");
  await page.getByTestId("ficha-campo-largura").fill("12");
  await page.getByTestId("ficha-campo-profundidade").fill("9");
  await page.getByTestId("ficha-campo-altura").fill("10");
  await page.getByTestId("ficha-campo-embalagem").fill("3");
  await page.getByTestId("ficha-campo-preco-praticado").fill(precoReais);
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${orcamentoId}$`), { timeout: 10000 });
  await expect(page.getByTestId("orcamento-linha").filter({ hasText: nome })).toBeVisible();
}

// Extrai só "R$ 1.234,56" de um texto maior (mesma técnica do resto da fase).
function extrairReais(texto: string): string {
  const casamento = texto.match(/R\$\s*[\d.]+,\d{2}/);
  if (!casamento) {
    throw new Error(`Não encontrei um valor em reais no texto: "${texto}"`);
  }
  return casamento[0];
}

function reaisParaCentavos(texto: string): number {
  const limpo = extrairReais(texto)
    .replace(/^R\$\s*/, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

// O campo de preço do diálogo não tem "R$" — só "132,00".
function precoDoInputParaCentavos(valorTexto: string): number {
  const limpo = valorTexto.replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

async function abrirDialogoAtualizarPrecos(page: Page, orcamentoId: string, rotuloDoBotao: string): Promise<void> {
  await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
  await page.getByRole("button", { name: rotuloDoBotao }).click();
  await expect(page.getByRole("dialog", { name: "Atualizar preços" })).toBeVisible();
}

test.describe("orcamentos revisao @parametro-global", () => {
  test.describe.configure({ mode: "serial" });

  // Restaura o parâmetro dedicado deste spec ao valor original, sempre — mesmo se algum teste
  // acima falhar. Sem isto, o parâmetro elevado pelo teste (a) sobrevive ao arquivo inteiro e
  // contamina qualquer outro spec de precificação que rode depois, no mesmo banco efêmero.
  test.afterAll(async ({}, testInfo) => {
    const chave = testInfo.project.name.endsWith("celular") ? "preco_imposto_sobre_venda" : "preco_folga_negociacao";
    await restaurarParametroDedicado(chave);
  });

  let orcamentoId = "";
  let suf = "";
  let nomeDaPeca = "";
  let totalAntesDaAtualizacao = "";
  let numeroOriginal = "";

  test("(a) parâmetro dedicado sobe o mínimo — 'Atualizar preços' mostra mínimo de antes/hoje, etiqueta 'subiu' e sugestão maior", async ({
    page,
  }) => {
    suf = sufixoUnico();
    await fazerLogin(page);

    orcamentoId = await criarOrcamento(page);
    await preencherCliente(page, orcamentoId, `[e2e] Cliente da revisao ${suf}`);
    nomeDaPeca = `[e2e] Revisao Caneca ${suf}`;
    await acrescentarPecaExclusiva(page, orcamentoId, nomeDaPeca, "100");

    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    // NUNCA `toHaveURL(/aviso=.../)`: o `AvisoFinanceiro` apaga `aviso` da URL com
    // `history.replaceState` no mesmo instante em que mostra o toast, então a asserção de URL
    // aposta numa janela de milissegundos e perde a corrida sob carga (WINDOWS #49/#52). A regra
    // já estava escrita em `cadastros-base.spec.ts` desde a 04.4 — esperar o TOAST, que é o
    // resultado que o usuário vê e que persiste.
    await expect(page.getByText("Marcado como enviado. Preços e custos ficaram congelados.")).toBeVisible({ timeout: 10000 });

    numeroOriginal = (await page.getByTestId("orcamento-numero").textContent()) ?? "";
    totalAntesDaAtualizacao = extrairReais((await page.getByTestId("orcamento-total").textContent()) ?? "");

    // Sobe o parâmetro dedicado — mesma conta do mínimo (lucro + folga + imposto), nunca pode
    // baixar o mínimo de uma peça calculada pelo canal "direto".
    const chave = chaveDoParametroDedicado();
    const novoValor = chave === "preco_imposto_sobre_venda" ? "15" : "30";
    await definirParametro(page, chave, novoValor);

    await abrirDialogoAtualizarPrecos(page, orcamentoId, "Atualizar preços");

    const linha = page.getByTestId("atualizar-linha").filter({ hasText: nomeDaPeca });
    await expect(linha).toBeVisible();

    const minimoAntesTexto = (await linha.getByTestId("atualizar-minimo-antes").textContent()) ?? "";
    const minimoHojeTexto = (await linha.getByTestId("atualizar-minimo-hoje").textContent()) ?? "";
    expect(reaisParaCentavos(minimoHojeTexto)).toBeGreaterThan(reaisParaCentavos(minimoAntesTexto));

    await expect(linha.getByTestId("atualizar-etiqueta")).toContainText("subiu");

    const precoSugeridoTexto = await linha.getByTestId("atualizar-preco-novo").inputValue();
    expect(precoDoInputParaCentavos(precoSugeridoTexto)).toBeGreaterThan(10000); // preço original era R$ 100,00
  });

  test("(b) confirmar guarda a revisão 1, sobe para revisão 2, volta a rascunho, mantém o número, e mostra o toast", async ({
    page,
  }) => {
    await fazerLogin(page);
    await abrirDialogoAtualizarPrecos(page, orcamentoId, "Atualizar preços");

    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(page.getByText("Revisão 2 criada como rascunho. Confira e marque como enviado.")).toBeVisible();

    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("rascunho");

    const numeroNovoTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";
    expect(numeroNovoTexto).toContain("· revisão 2");
    expect(numeroNovoTexto.replace(/\s*·\s*revisão 2$/, "")).toBe(numeroOriginal);
  });

  test("(c) o painel 'Só para você' mostra o histórico com a revisão 1 e o total de antes", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const historico = page.getByTestId("orcamento-historico-revisoes");
    await expect(historico).toContainText("revisão 1");
    await expect(historico).toContainText(totalAntesDaAtualizacao);
  });

  test("(d) num rascunho, o mesmo botão só sobe o preço que está abaixo do mínimo de hoje — sem criar revisão", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const numeroAntesTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";

    // Baixa o preço da peça para bem abaixo do mínimo atual (rascunho: o campo é editável).
    const linhaViva = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPeca });
    const campoPreco = linhaViva.getByTestId("orcamento-linha-preco");
    await campoPreco.fill("1,00");
    await blurEEsperarNavegacao(page, campoPreco);

    await abrirDialogoAtualizarPrecos(page, orcamentoId, "Atualizar preços");

    const linhaDoDialogo = page.getByTestId("atualizar-linha").filter({ hasText: nomeDaPeca });
    await expect(linhaDoDialogo.getByTestId("atualizar-etiqueta")).toContainText("está abaixo");
    const sugestaoTexto = await linhaDoDialogo.getByTestId("atualizar-preco-novo").inputValue();
    expect(precoDoInputParaCentavos(sugestaoTexto)).toBeGreaterThan(100); // maior que R$ 1,00

    await page.getByRole("button", { name: "Atualizar", exact: true }).click();
    await expect(page.getByText("Preços atualizados.")).toBeVisible();

    // Nenhuma revisão nova, status continua rascunho, número (com a mesma "· revisão 2") intacto.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("rascunho");
    const numeroDepoisTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";
    expect(numeroDepoisTexto).toBe(numeroAntesTexto);

    const linhaAtualizada = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPeca });
    await expect(linhaAtualizada.getByTestId("orcamento-linha-preco")).not.toHaveValue("1,00");
  });

  test("(e) num orçamento em que nada mudou desde o envio, o diálogo mostra a frase verde e as sugestões iguais aos preços atuais", async ({
    page,
  }) => {
    await fazerLogin(page);

    const orcamentoSemMudancaId = await criarOrcamento(page);
    await preencherCliente(page, orcamentoSemMudancaId, `[e2e] Cliente sem mudanca ${suf}`);
    const nomeDaPecaSemMudanca = `[e2e] Revisao Prato ${suf}`;
    await acrescentarPecaExclusiva(page, orcamentoSemMudancaId, nomeDaPecaSemMudanca, "80");

    // Enviado DEPOIS do parâmetro já ter subido (teste a) — nenhuma mudança acontece daqui até
    // abrir o diálogo, então o mínimo de hoje é IGUAL ao congelado.
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    // NUNCA `toHaveURL(/aviso=.../)`: o `AvisoFinanceiro` apaga `aviso` da URL com
    // `history.replaceState` no mesmo instante em que mostra o toast, então a asserção de URL
    // aposta numa janela de milissegundos e perde a corrida sob carga (WINDOWS #49/#52). A regra
    // já estava escrita em `cadastros-base.spec.ts` desde a 04.4 — esperar o TOAST, que é o
    // resultado que o usuário vê e que persiste.
    await expect(page.getByText("Marcado como enviado. Preços e custos ficaram congelados.")).toBeVisible({ timeout: 10000 });

    await abrirDialogoAtualizarPrecos(page, orcamentoSemMudancaId, "Atualizar preços");

    await expect(page.getByTestId("orcamento-atualizar-nada-mudou")).toContainText(
      "Nada mudou nos custos desde então.",
    );
    const linha = page.getByTestId("atualizar-linha").filter({ hasText: nomeDaPecaSemMudanca });
    await expect(linha.getByTestId("atualizar-etiqueta")).toContainText("igual");
    const sugestaoTexto = await linha.getByTestId("atualizar-preco-novo").inputValue();
    expect(precoDoInputParaCentavos(sugestaoTexto)).toBe(8000); // R$ 80,00, sem nenhuma mudança
  });

  // (f) "Um orçamento aprovado não tem 'Atualizar preços'" — a condição
  // `orcamento.status !== "aprovado"` em `EditorOrcamento` (que nem monta `AcoesDoOrcamento`'s
  // atualizar-preços nem `DialogoAtualizarPrecos` fora desse guarda) é a mesma já provada por
  // `orcamentos-ciclo.spec.ts` para o status aprovado inexistente nesta fase — mas não existe,
  // nesta fase, NENHUM caminho pela UI para aprovar um orçamento de verdade (o botão "Cliente
  // aprovou" é do plano 12 e está sempre desabilitado). Provar isto em e2e exigiria escrever no
  // banco por fora da UI, o que este spec não faz. Verificado por leitura de código
  // (`editor-orcamento.tsx`: o `if (orcamento.status !== "aprovado")` envolve o diálogo inteiro) e
  // registrado em WINDOWS.md como pendência para quando o plano 12 existir.
  test.skip(
    "(f) num orçamento aprovado o botão 'Atualizar preços' não existe",
    () => {},
  );

  test("(g) a 320px, o diálogo com várias linhas rola no corpo, o rodapé continua visível e todo alvo de toque mede ao menos 44px", async ({
    page,
  }) => {
    await fazerLogin(page);

    const orcamentoResponsivoId = await criarOrcamento(page);
    await preencherCliente(page, orcamentoResponsivoId, `[e2e] Cliente responsivo ${suf}`);
    for (let indice = 1; indice <= 6; indice += 1) {
      await acrescentarPecaExclusiva(page, orcamentoResponsivoId, `[e2e] Revisao Peca ${indice} ${suf}`, "50");
    }

    await page.setViewportSize({ width: 320, height: 700 });
    await abrirDialogoAtualizarPrecos(page, orcamentoResponsivoId, "Atualizar preços");

    const larguraDeRolagem = await page.evaluate(() => document.documentElement.scrollWidth);
    const larguraDaJanela = await page.evaluate(() => document.documentElement.clientWidth);
    expect(larguraDeRolagem).toBeLessThanOrEqual(larguraDaJanela + 1);

    const linhas = page.getByTestId("atualizar-linha");
    await expect(linhas).toHaveCount(6);

    const botaoAtualizar = page.getByRole("button", { name: "Atualizar", exact: true });
    const botaoCancelar = page.getByRole("button", { name: "Cancelar" });
    await expect(botaoAtualizar).toBeVisible();
    await expect(botaoCancelar).toBeVisible();

    for (const botao of [botaoAtualizar, botaoCancelar]) {
      const caixa = await botao.boundingBox();
      expect(caixa).not.toBeNull();
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
    }

    for (const entrada of await page.getByTestId("atualizar-preco-novo").all()) {
      const caixa = await entrada.boundingBox();
      expect(caixa).not.toBeNull();
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

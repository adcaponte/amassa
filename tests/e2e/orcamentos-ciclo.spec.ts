import { test, expect, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";

import { criarOrcamentoPelaTela } from "./apoio/novo-orcamento";

// O ciclo de vida do orçamento (04.5-08-PLAN.md): congelar ao enviar, a prova de que mudar um
// parâmetro ou criar um rascunho novo depois não mexe no que já foi congelado, recusar, voltar
// para rascunho e duplicar com número novo. Nomes inventados e únicos por execução
// ("[e2e] ... {sufixo}") — nenhum dado real do ateliê, o repositório é público.
//
// A ORDEM dos testes abaixo NÃO segue a ordem das letras do plano (b, c, d, e-duplicar, g, f-
// recusar) — decisão do executor (ver SUMMARY, "Decidido sem o dono"): "Recusou" só é aceito a
// partir de "enviado" (guarda do servidor), e "Duplicar a partir de um enviado" e o backstop de
// responsivo (com os CINCO botões do estado "enviado") precisam rodar ENQUANTO o orçamento ainda
// está enviado — então "recusar" (que tira o orçamento do estado enviado) fica por último. Todas
// as SETE letras do plano são cobertas; só a ORDEM de execução muda, para que o estado do
// orçamento sempre permita a próxima ação sem reabrir/reenviar sem necessidade.
//
// O parâmetro usado na prova de congelamento (caso 3) é DEDICADO a este teste — `forno_desgaste_
// por_fornada` (desktop) / `forno_tarifa_energia` (celular), nenhum dos dois tocado por
// `precificacao-parametros.spec.ts` (que usa material_argila/material_esmalte/perda_unica/
// preco_lucro/trabalho_hora) — para não disputar estado global do banco sob execução paralela.
// Os dois entram na MESMA conta (fornada = kWh × tarifa + desgaste): aumentar qualquer um dos dois
// só pode AUMENTAR o custo/mínimo de uma peça, nunca diminuir — a mesma garantia para os dois
// projetos, sem depender de qual valor exato cada um grava.

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

function chaveDoParametroDedicado(): "forno_desgaste_por_fornada" | "forno_tarifa_energia" {
  return test.info().project.name.endsWith("celular") ? "forno_tarifa_energia" : "forno_desgaste_por_fornada";
}

// O valor ORIGINAL semeado por 0019 de cada parâmetro dedicado (pontos-base/milésimos, a escala
// do catálogo — lib/precificacao/parametros.ts): `forno_desgaste_por_fornada` nasce em 1200
// (R$ 12,00), `forno_tarifa_energia` nasce em 78 (R$ 0,78/kWh).
const VALOR_ORIGINAL_DO_PARAMETRO: Record<string, number> = {
  forno_desgaste_por_fornada: 1200,
  forno_tarifa_energia: 78,
};

// Restaura, DIRETO no banco (mesmo padrão de tests/e2e/apoio/parametro-no-banco.ts — nunca
// @/db/Drizzle), o valor do parâmetro dedicado deste spec para o original semeado. Achado real da
// varredura completa do plano 04.5-13 (Tarefa 1, segunda rodada): o caso (3) sobe o parâmetro para
// "900" (R$ 900,00/kWh no projeto celular — mais de mil vezes o original) e nunca desfazia —
// qualquer spec de precificação rodando depois no MESMO banco efêmero (precificacao-ficha.spec.ts/
// precificacao-pecas.spec.ts, que esperam custo/mínimo calculados com os valores PADRÃO da
// semente) herdava o parâmetro elevado e via um custo/selo completamente diferente do esperado —
// não uma flakiness de contenção, uma poluição real de estado entre arquivos de spec (a mesma
// classe já corrigida em orcamentos-revisao.spec.ts para preco_folga_negociacao/
// preco_imposto_sobre_venda).
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

// Desde o 06.5-14 (D-15) o orçamento nasce no primeiro campo preenchido. Este cria pelo Título: o
// (1) precisa do cliente vazio (“falta o cliente e ao menos uma peça”), como antes.
async function criarOrcamento(page: Page): Promise<string> {
  return criarOrcamentoPelaTela(page, `[e2e] Pedido do ciclo ${sufixoUnico()}`, {
    campo: "titulo",
  });
}

// Sai do campo e espera a navegação de verdade — nunca `waitForLoadState` isolado, porque a URL
// final pode ser IDÊNTICA à atual (mesma armadilha documentada em `orcamentos-editor.spec.ts`/
// `orcamentos-total.spec.ts`).
async function blurEEsperarNavegacao(page: Page, campo: Locator): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), campo.blur()]);
}

async function preencherCliente(page: Page, orcamentoId: string, nome: string): Promise<void> {
  const campo = page.getByTestId("orcamento-campo-cliente");
  await campo.fill(nome);
  await blurEEsperarNavegacao(page, campo);
  await expect(page).toHaveURL(new RegExp(`orcamento=${orcamentoId}$`));
}

// A MESMA receita (medidas/material/horas) em toda chamada — a prova do caso 3 depende de duas
// peças com a receita IDÊNTICA calcularem valores diferentes só porque o parâmetro global mudou.
async function acrescentarPecaExclusiva(page: Page, orcamentoId: string, nome: string, precoReais: string): Promise<void> {
  await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
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

// Extrai só a parte "R$ 1.234,56" de um texto maior (mesma técnica de `orcamentos-total.spec.ts`
// — nunca limpar o texto inteiro, que pode ter outros dígitos/vírgulas).
function reaisParaCentavos(texto: string): number {
  const casamento = texto.match(/R\$\s*([\d.]+,\d{2})/);
  if (!casamento) {
    throw new Error(`Não encontrei um valor em reais no texto: "${texto}"`);
  }
  const limpo = casamento[1].replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

test.describe("orcamentos ciclo @parametro-global", () => {
  test.describe.configure({ mode: "serial" });

  // Restaura o parâmetro dedicado deste spec ao valor original, sempre — mesmo se algum teste
  // acima falhar. Sem isto, o parâmetro elevado pelo caso (3) sobrevive ao arquivo inteiro e
  // contamina qualquer outro spec de precificação que rode depois, no mesmo banco efêmero.
  test.afterAll(async ({}, testInfo) => {
    const chave = testInfo.project.name.endsWith("celular") ? "forno_tarifa_energia" : "forno_desgaste_por_fornada";
    await restaurarParametroDedicado(chave);
  });

  let orcamentoId = "";
  let suf = "";
  let nomeDaPeca = "";
  let minimoAntesDoParametroNovo = "";
  let totalAntesDoParametroNovo = "";
  let painelAntesDoParametroNovo = "";
  let minimoComParametroNovo = "";

  test("(1) sem cliente ou peça 'Marcar como enviado' fica desabilitado e mostra a frase de falta; preencher os dois habilita", async ({
    page,
  }) => {
    suf = sufixoUnico();
    await fazerLogin(page);
    orcamentoId = await criarOrcamento(page);

    const botaoEnviar = page.getByRole("button", { name: "Marcar como enviado" });
    await expect(botaoEnviar).toBeDisabled();
    await expect(page.getByTestId("orcamento-falta-enviar")).toHaveText(
      "Para enviar, falta o cliente e ao menos uma peça.",
    );

    await preencherCliente(page, orcamentoId, `[e2e] Cliente do ciclo ${suf}`);
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeDisabled();
    await expect(page.getByTestId("orcamento-falta-enviar")).toBeVisible();

    nomeDaPeca = `[e2e] Ciclo Caneca ${suf}`;
    await acrescentarPecaExclusiva(page, orcamentoId, nomeDaPeca, "100");

    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeEnabled();
    await expect(page.getByTestId("orcamento-falta-enviar")).toHaveCount(0);
  });

  test("(2) 'Marcar como enviado' congela: toast, chip âmbar com os dias restantes, e o cabeçalho vira texto", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByText("Marcado como enviado. Preços e custos ficaram congelados.")).toBeVisible();

    // Validade padrão de 10 dias, orçamento acabado de enviar hoje: exatamente "vale mais 10
    // dia(s)" — determinístico, `validadeDias` nunca foi tocado por este teste.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("enviado · vale mais 10 dia(s)");

    // Congelamento visual (04.5-UI-SPEC.md): nenhum `input` sobra visível na tela inteira.
    await expect(page.locator("main").locator("input")).toHaveCount(0);
    await expect(page.getByTestId("orcamento-para-quem").locator("input")).toHaveCount(0);

    minimoAntesDoParametroNovo = (await page.getByTestId("orcamento-linha-minimo").first().textContent()) ?? "";
    totalAntesDoParametroNovo = (await page.getByTestId("orcamento-total").textContent()) ?? "";
    painelAntesDoParametroNovo = (await page.getByTestId("orcamento-so-para-voce").textContent()) ?? "";

    await expect(page.getByTestId("orcamento-aviso-congelado")).toContainText(
      "Mudar parâmetros depois não altera este orçamento.",
    );
  });

  test("(3) 🔴 mudar um parâmetro depois de enviado não altera nenhum número congelado; um rascunho novo já usa o valor novo", async ({
    page,
  }) => {
    await fazerLogin(page);

    const chave = chaveDoParametroDedicado();
    const novoValorTexto = "900";

    await page.goto("/gestao/cadastros?sub=parametros");
    const campo = page.getByTestId(`parametro-${chave}`).locator("input");
    await campo.fill(novoValorTexto);
    await blurEEsperarNavegacao(page, campo);
    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=parametros$/);

    // O orçamento já enviado: total, mínimo da linha e o painel inteiro continuam EXATAMENTE os
    // mesmos de antes da mudança — é o coração do plano.
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-total")).toHaveText(totalAntesDoParametroNovo);
    await expect(page.getByTestId("orcamento-linha-minimo").first()).toHaveText(minimoAntesDoParametroNovo);
    await expect(page.getByTestId("orcamento-so-para-voce")).toHaveText(painelAntesDoParametroNovo);

    // Um rascunho NOVO, com a MESMA receita (mesma ficha), já usa o valor novo — o mínimo sobe.
    const novoOrcamentoId = await criarOrcamento(page);
    const nomeDaPecaNova = `[e2e] Ciclo Caneca Depois ${suf}`;
    await acrescentarPecaExclusiva(page, novoOrcamentoId, nomeDaPecaNova, "100");

    minimoComParametroNovo = (await page.getByTestId("orcamento-linha-minimo").first().textContent()) ?? "";
    expect(reaisParaCentavos(minimoComParametroNovo)).toBeGreaterThan(
      reaisParaCentavos(minimoAntesDoParametroNovo),
    );
  });

  test("(4) 'Voltar para rascunho' descongela: toast, chip neutro, campos editáveis, e o cálculo volta a usar os parâmetros de hoje", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    await page.getByRole("button", { name: "Voltar para rascunho" }).click();
    await expect(page.getByText("Voltou para rascunho. O cálculo usa os parâmetros de hoje.")).toBeVisible();
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("rascunho");

    // Os campos voltaram a ser editáveis.
    await expect(page.getByTestId("orcamento-campo-cliente")).toBeVisible();

    // O cálculo ao vivo agora usa o parâmetro NOVO — o mesmo valor que o rascunho do caso (3)
    // calculou para a MESMA receita (mesmo parâmetro, mesma peça).
    await expect(page.getByTestId("orcamento-linha-minimo").first()).toHaveText(minimoComParametroNovo);
  });

  test("(5) 'Duplicar' a partir de um orçamento enviado: nasce um rascunho com número DIFERENTE, mesma peça e mesmo preço", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    // Reenvia (o caso (4) devolveu para rascunho) para testar "Duplicar" a partir de um enviado,
    // como o plano descreve.
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    // NUNCA `toHaveURL(/aviso=.../)`: o `AvisoFinanceiro` apaga `aviso` da URL com
    // `history.replaceState` no mesmo instante em que mostra o toast, então a asserção de URL
    // aposta numa janela de milissegundos e perde a corrida sob carga (WINDOWS #49/#52). A regra
    // já estava escrita em `cadastros-base.spec.ts` desde a 04.4 — esperar o TOAST, que é o
    // resultado que o usuário vê e que persiste.
    await expect(page.getByText("Marcado como enviado. Preços e custos ficaram congelados.")).toBeVisible({ timeout: 10000 });

    const numeroOriginalTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";

    await page.getByRole("button", { name: "Duplicar" }).click();
    // NUNCA `toHaveURL(/aviso=.../)`: o `AvisoFinanceiro` apaga `aviso` da URL com
    // `history.replaceState` no mesmo instante em que mostra o toast, então a asserção de URL
    // aposta numa janela de milissegundos e perde a corrida sob carga (WINDOWS #49/#52). A regra
    // já estava escrita em `cadastros-base.spec.ts` desde a 04.4 — esperar o TOAST.
    //
    // Aqui o toast traz o número NOVO ("Cópia criada como rascunho nº ORC-2026-0NN."), que é
    // justamente o que este teste quer provar: o duplicado nasce com número diferente.
    await expect(page.getByText(/Cópia criada como rascunho nº ORC-\d{4}-\d{3}\./)).toBeVisible({
      timeout: 10000,
    });

    const numeroNovoTexto = (await page.getByTestId("orcamento-numero").textContent()) ?? "";
    expect(numeroNovoTexto).not.toBe(numeroOriginalTexto);
    expect(numeroNovoTexto).toMatch(/^nº ORC-\d{4}-\d{3}$/);

    const numeroSemPrefixo = numeroNovoTexto.replace(/^nº /, "");
    await expect(page.getByText(`Cópia criada como rascunho nº ${numeroSemPrefixo}.`)).toBeVisible();

    // Rascunho novo: mesma peça, mesma quantidade × preço (editável de novo, por ser rascunho),
    // chip neutro.
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("rascunho");
    const linhaDuplicada = page.getByTestId("orcamento-linha").filter({ hasText: nomeDaPeca });
    await expect(linhaDuplicada).toBeVisible();
    await expect(linhaDuplicada).toContainText("R$ 100,00");
    await expect(linhaDuplicada.getByTestId("orcamento-linha-quantidade")).toHaveValue("1");
    await expect(linhaDuplicada.getByTestId("orcamento-linha-preco")).toHaveValue("100,00");
  });

  test("(6) a 320px a barra de ações (6 botões, o estado 'enviado') não provoca rolagem horizontal e cada botão mede ao menos 44px", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);
    await expect(page.getByTestId("orcamento-acoes")).toBeVisible();

    const larguraDeRolagem = await page.evaluate(() => document.documentElement.scrollWidth);
    const larguraDaJanela = await page.evaluate(() => document.documentElement.clientWidth);
    expect(larguraDeRolagem).toBeLessThanOrEqual(larguraDaJanela + 1);

    // Eram 5 quando este teste foi escrito (plano 08); o plano 11 acrescentou "Ver como o cliente
    // vê" como botão SEMPRE visível, em qualquer status (acoes-do-orcamento.tsx) — 6 desde então.
    // Achado real da varredura completa do plano 04.5-13 (Tarefa 1): o teste falhava 100% das
    // vezes, não por contenção.
    const botoes = page.getByTestId("orcamento-acoes").getByRole("button");
    const contagem = await botoes.count();
    expect(contagem).toBe(6);

    const alturas: number[] = [];
    const posicoesY: number[] = [];
    for (let indice = 0; indice < contagem; indice += 1) {
      const caixa = await botoes.nth(indice).boundingBox();
      expect(caixa, `botão ${indice}`).not.toBeNull();
      alturas.push(caixa!.height);
      posicoesY.push(caixa!.y);
    }
    for (const altura of alturas) {
      expect(altura).toBeGreaterThanOrEqual(44);
    }
    // "quebra em mais de uma fileira" — nem todo botão está na mesma linha vertical.
    expect(new Set(posicoesY).size).toBeGreaterThan(1);
  });

  test("(7) 'Recusou' marca vermelho sem descongelar — os números não mudam", async ({ page }) => {
    await fazerLogin(page);
    await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${orcamentoId}`);

    const totalAntes = (await page.getByTestId("orcamento-total").textContent()) ?? "";
    const minimoAntes = (await page.getByTestId("orcamento-linha-minimo").first().textContent()) ?? "";

    await page.getByRole("button", { name: "Recusou" }).click();
    await expect(page.getByText("Marcado como recusado.")).toBeVisible();
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText("recusado");

    await expect(page.getByTestId("orcamento-total")).toHaveText(totalAntes);
    await expect(page.getByTestId("orcamento-linha-minimo").first()).toHaveText(minimoAntes);
  });

  // ⚠️ LEIA ISTO ANTES DE CONFIAR NESTE TESTE: ele é uma TRAVA DE REGRESSÃO, não a prova de um
  // bug. Medido em 2026-09-27, com o `orderBy` de `marcarComoEnviado` removido de propósito,
  // **este teste PASSA** — nem seis edições de quantidade nem a remoção de uma linha do meio
  // desalinham o snapshot hoje.
  //
  // Por quê: todo caminho de escrita do módulo preserva a ordem por construção. Editar
  // quantidade é HOT update (versão nova na mesma página, reaproveitando o ponteiro), e a
  // renumeração de `removerLinha` percorre em ordem CRESCENTE de `ordem`, anexando as versões
  // novas já na ordem certa.
  //
  // Então o que este teste guarda é o DIA EM QUE ISSO MUDAR — um recurso de reordenar linha, um
  // orçamento grande o bastante para o planejador escolher outra varredura, ou um mexido no laço
  // de renumeração. O contrato que ele tranca: `snapshot.linhas[indice]` casa com as linhas
  // ordenadas por `ordem`, e o número congelado de cada peça é o DELA.
  //
  // Escrever um teste que só passa não seria honesto sem esta nota. A alternativa — afirmar que
  // a correção conserta um bug observável — seria falsa: o defeito é latente.
  //
  // O teste usa três receitas DIFERENTES para que os mínimos sejam distintos entre si; com
  // receitas iguais, um desalinhamento passaria despercebido porque todos os números seriam o
  // mesmo. É o cuidado oposto ao do caso (3), que precisa de receitas idênticas.
  test("(8) o snapshot não desalinha: depois de tirar uma linha e enviar, cada peça mantém o SEU número congelado", async ({
    page,
  }) => {
    await fazerLogin(page);

    const sufixo = `${suf}-ordem`;
    const id = await criarOrcamento(page);
    await preencherCliente(page, id, `[e2e] Cliente Ordem ${sufixo}`);

    // Três receitas deliberadamente distintas — pequena, média e grande.
    const pecas = [
      { nome: `[e2e] A Pequena ${sufixo}`, argila: "200", horas: "0,3", largura: "8", preco: "40" },
      { nome: `[e2e] B Media ${sufixo}`, argila: "600", horas: "0,9", largura: "14", preco: "90" },
      { nome: `[e2e] C Grande ${sufixo}`, argila: "1200", horas: "1,8", largura: "22", preco: "180" },
    ];

    for (const peca of pecas) {
      await page.goto(`/gestao/financeiro?aba=orcamentos&orcamento=${id}`);
      await page.getByRole("link", { name: "+ Peça exclusiva deste pedido" }).click();
      await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();
      await page.getByTestId("ficha-campo-nome").fill(peca.nome);
      await page.getByTestId("ficha-campo-argila").fill(peca.argila);
      await page.getByTestId("ficha-campo-esmalte").fill("60");
      await page.getByTestId("ficha-campo-horas").fill(peca.horas);
      await page.getByTestId("ficha-campo-largura").fill(peca.largura);
      await page.getByTestId("ficha-campo-profundidade").fill("9");
      await page.getByTestId("ficha-campo-altura").fill("10");
      await page.getByTestId("ficha-campo-embalagem").fill("3");
      await page.getByTestId("ficha-campo-preco-praticado").fill(peca.preco);
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page).toHaveURL(new RegExp(`aba=orcamentos&orcamento=${id}$`), { timeout: 10000 });
      await expect(page.getByTestId("orcamento-linha").filter({ hasText: peca.nome })).toBeVisible();
    }

    // O mínimo de cada peça ANTES de congelar, lido pelo nome — nunca por posição, senão o teste
    // não conseguiria distinguir "ficou no lugar" de "trocou de lugar".
    const minimoPorNome = new Map<string, string>();
    for (const peca of pecas) {
      const linha = page.getByTestId("orcamento-linha").filter({ hasText: peca.nome });
      minimoPorNome.set(peca.nome, (await linha.getByTestId("orcamento-linha-minimo").textContent()) ?? "");
    }
    // Se as três receitas produzissem o mesmo mínimo, o teste seria vacuamente verde.
    expect(new Set(minimoPorNome.values()).size).toBe(3);

    // O GATILHO: editar a PRIMEIRA linha. O `update` grava versão nova da tupla, que passa a
    // voltar por último numa varredura sem ordenação. Quantidade não muda o mínimo unitário,
    // então os valores lidos acima continuam sendo a resposta certa.
    // 🔴 O GATILHO CERTO é TIRAR uma linha do meio, não editar quantidade.
    //
    // Medido nesta sessão, com o `orderBy` removido de propósito: seis edições de quantidade em
    // duas linhas NÃO reproduzem o defeito. A razão é que elas são HOT updates — a versão nova
    // da tupla fica na mesma página e REAPROVEITA o ponteiro, então a varredura devolve a linha
    // no lugar de sempre.
    //
    // Tirar uma linha é outra história: `removerLinha` (lib/orcamentos/acoes.ts) renumera as
    // seguintes com `update ... set ordem = ordem - 1`, e `ordem` é INDEXADA
    // (`UNIQUE(orcamento_id, ordem)`). Update em coluna indexada não é HOT: a tupla nova vai
    // para outro lugar, e a ordem física passa a divergir da coluna `ordem` — exatamente o que
    // a consulta sem `ORDER BY` devolvia ao acaso.
    //
    // E isto não é um caso de laboratório: montar um orçamento, tirar uma peça que o cliente
    // desistiu e mandar é o uso normal do módulo.
    const doMeio = page.getByTestId("orcamento-linha").filter({ hasText: pecas[1].nome });
    await doMeio.getByRole("button", { name: "tirar" }).click();
    await expect(page.getByTestId("dialogo-tirar-linha")).toBeVisible();
    await page.getByTestId("dialogo-tirar-linha").getByRole("button", { name: "tirar" }).click();
    await expect(page.getByTestId("orcamento-linha").filter({ hasText: pecas[1].nome })).toHaveCount(0, {
      timeout: 10000,
    });

    // As duas que sobraram são as que têm que manter o próprio número.
    const sobreviventes = [pecas[0], pecas[2]];

    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    // NUNCA `toHaveURL(/aviso=.../)`: o `AvisoFinanceiro` apaga `aviso` da URL com
    // `history.replaceState` no mesmo instante em que mostra o toast, então a asserção de URL
    // aposta numa janela de milissegundos e perde a corrida sob carga (WINDOWS #49/#52). A regra
    // já estava escrita em `cadastros-base.spec.ts` desde a 04.4 — esperar o TOAST, que é o
    // resultado que o usuário vê e que persiste.
    await expect(page.getByText("Marcado como enviado. Preços e custos ficaram congelados.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("orcamento-chip").first()).toHaveText(/enviado|expirado/);

    // Depois de congelado, o número de cada peça tem que continuar sendo O DELA.
    for (const peca of sobreviventes) {
      const linha = page.getByTestId("orcamento-linha").filter({ hasText: peca.nome });
      await expect(linha.getByTestId("orcamento-linha-minimo")).toHaveText(minimoPorNome.get(peca.nome)!);
    }
  });
});

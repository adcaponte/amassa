import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { formatarDataCurta, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { CATALOGO_DE_PARAMETROS } from "@/lib/precificacao/parametros";

import {
  contarHistoricoDoParametro,
  inserirLinhaAntigaDoParametro,
  valorDoParametroNaData,
} from "./apoio/parametro-no-banco";

// Parâmetros dentro de Cadastros (D-03, 04.5-02-PLAN.md): os 18 números do cálculo com data e
// selo, "Calcular minha hora" (ORC-04), e o aviso quando o divisor de preço não fecha (D-11).
//
// `desktop` e `celular` rodam este arquivo EM PARALELO contra o MESMO banco de teste efêmero
// (playwright.config.ts não isola este spec na cadeia `vazio-*`) — cada teste que GRAVA um
// parâmetro usa uma CHAVE diferente por projeto (`chaveDeValorParaEditar`/`chaveDoSeloParaAlternar`
// abaixo), a mesma disciplina de "sufixo único" de `tests/e2e/cadastros-base.spec.ts`, só que em
// forma de chave em vez de texto (parâmetro é numérico, não aceita um sufixo de nome).

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function chaveDeValorParaEditar(): "material_argila" | "material_esmalte" {
  return test.info().project.name.endsWith("celular") ? "material_esmalte" : "material_argila";
}

function chaveDoSeloParaAlternar(): "perda_unica" | "preco_lucro" {
  return test.info().project.name.endsWith("celular") ? "preco_lucro" : "perda_unica";
}

// Valores ORIGINAIS semeados por 0019 das chaves que os testes abaixo GRAVAM (nunca as que só
// alternam `medido`, que não muda o valor): material_argila 1000 (R$ 10,00/kg), material_esmalte
// 8400 (R$ 84,00/kg), trabalho_hora 3500 (R$ 35,00/h).
const VALOR_ORIGINAL_DO_PARAMETRO: Record<string, number> = {
  material_argila: 1000,
  material_esmalte: 8400,
  trabalho_hora: 3500,
};

// Restaura, DIRETO no banco (mesmo padrão de tests/e2e/apoio/parametro-no-banco.ts — nunca
// @/db/Drizzle), o valor de um parâmetro gravado por este spec para o original semeado. Achado
// real da varredura completa do plano 04.5-13 (Tarefa 1, terceira rodada): os dois testes que
// gravam valor (o de histórico e o de "Calcular minha hora") nunca desfaziam — qualquer spec de
// precificação rodando depois no MESMO banco efêmero (precificacao-ficha.spec.ts/
// precificacao-pecas.spec.ts, que esperam custo/mínimo calculados com os valores PADRÃO da
// semente) herdava o parâmetro alterado. Mesma classe já corrigida em orcamentos-revisao.spec.ts/
// orcamentos-ciclo.spec.ts para os respectivos parâmetros dedicados deles.
async function restaurarParametro(chave: string): Promise<void> {
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

// O teste do selo alterna `medido` e, até 2026-09-27, NINGUÉM desfazia: o `afterAll` só devolvia
// `valor_inteiro`, e a chave do selo (`perda_unica`/`preco_lucro`) nem passa por ele, porque o
// selo não muda valor nenhum. Ficava um parâmetro marcado "medido" para sempre, no banco efêmero
// inteiro.
//
// Isso não quebrava nada HOJE — `medido` não entra no cálculo, só na CONTAGEM de estimados que o
// painel "Só para você" mostra, e `orcamentos-total.spec.ts` só exige que a contagem seja
// positiva, o que 16 de 18 continua sendo. Mas é estado global deixado sujo, que é exatamente a
// classe de defeito que a WINDOWS #53 é. Um teste futuro que afirme a contagem EXATA quebraria
// sem motivo aparente.
//
// Todos os 18 parâmetros nascem `medido = false` (D-17), então restaurar é voltar a `false`.
async function restaurarSelo(chave: string): Promise<void> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    await cliente.query(
      "update parametros_precificacao set medido = false where chave = $1 and vigente_desde = hoje_brasilia()",
      [chave],
    );
  } finally {
    await cliente.end();
  }
}

// A data de hoje, no MESMO formato que a tela mostra (`formatarDataCurta(hojeEmBrasilia(...))`,
// lib/financeiro/formato.ts) — nunca uma segunda implementação de formatação no teste.
function hojeComoNaTela(): string {
  return formatarDataCurta(hojeEmBrasilia(new Date()));
}

test.describe("precificacao parametros @parametro-global", () => {
  test.describe.configure({ mode: "serial" });

  // Restaura os parâmetros que este arquivo GRAVA (material_argila/material_esmalte,
  // trabalho_hora) ao valor original, sempre — mesmo se algum teste acima falhar. Sem isto, o
  // valor alterado sobrevive ao arquivo inteiro e contamina qualquer outro spec de precificação
  // que rode depois, no mesmo banco efêmero.
  test.afterAll(async ({}, testInfo) => {
    const ehCelular = testInfo.project.name.endsWith("celular");
    await restaurarParametro(ehCelular ? "material_esmalte" : "material_argila");
    await restaurarParametro("trabalho_hora");
    // O selo `medido` também — ver o comentário de `restaurarSelo`.
    await restaurarSelo(ehCelular ? "preco_lucro" : "perda_unica");
  });

  test("a sub-aba Parâmetros abre, mostra os cinco grupos e ao menos 18 campos", async ({ page }) => {
    await fazerLogin(page);

    await page.goto("/gestao/cadastros?sub=parametros");
    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=parametros$/);
    await expect(page.getByTestId("cadastros-sub-parametros")).toHaveAttribute("aria-selected", "true");

    for (const grupo of ["Material", "Trabalho", "Forno", "Perda", "No preço"]) {
      await expect(page.getByRole("heading", { name: grupo, level: 3 })).toBeVisible();
    }

    // Cada linha de valor tem `data-testid="parametro-<chave>"` — os testids do selo/"desde"
    // também começam por "parametro-", então excluímos os dois pelo próprio nome do testid.
    const campos = page.locator(
      '[data-testid^="parametro-"]:not([data-testid*="selo-"]):not([data-testid*="desde-"])',
    );
    await expect(campos).toHaveCount(CATALOGO_DE_PARAMETROS.length);

    // A taxa do cartão aparece, mas nunca como um dos 18 campos editáveis (D-16).
    await expect(page.getByTestId("taxa-do-cartao-leitura")).toBeVisible();
    await expect(page.getByTestId("taxa-do-cartao-leitura").locator("input")).toHaveCount(0);
  });

  test("mudar o valor de um parâmetro grava por histórico: a nova linha mostra a data de hoje, e a antiga continua intacta no banco", async ({
    page,
  }) => {
    const chave = chaveDeValorParaEditar();
    const diasAtras = 10;
    const valorAntigoIlustrativo = 111100; // R$ 1.111,00 — só para existir uma linha "antiga" distinta.

    await inserirLinhaAntigaDoParametro({ chave, valorInteiro: valorAntigoIlustrativo, diasAtras });
    const antesDoHistorico = await contarHistoricoDoParametro(chave);
    expect(antesDoHistorico).toBeGreaterThanOrEqual(2); // a semente de hoje + a linha antiga acima.

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=parametros");

    const linha = page.getByTestId(`parametro-${chave}`);
    const novoValorTexto = test.info().project.name.endsWith("celular") ? "77,7" : "88,8";
    await linha.locator("input").fill(novoValorTexto);
    await linha.locator("input").blur();

    // A gravação bem-sucedida termina em NAVEGAÇÃO COMPLETA (`window.location.assign`) — esperar
    // o carregamento terminar é o que distingue "gravou de verdade" de um falso positivo (o campo
    // já mostra o texto digitado antes mesmo de a rede responder; sem esperar a navegação, uma
    // gravação que falhasse silenciosamente ainda pareceria ter passado).
    await page.waitForLoadState("load");
    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=parametros$/);

    await expect(page.getByTestId(`parametro-desde-${chave}`)).toHaveText(`desde ${hojeComoNaTela()}`);
    await expect(linha.locator("input")).toHaveValue(novoValorTexto);

    // A linha ANTIGA (inserida acima) continua com o MESMO valor — nenhuma escrita desta tela
    // passa por um `update` de valor/vigência (D-15).
    const valorAntigoDepois = await valorDoParametroNaData(chave, diasAtras);
    expect(valorAntigoDepois).toBe(valorAntigoIlustrativo);

    // O histórico segue tendo pelo menos as mesmas duas linhas de antes — editar HOJE de novo
    // atualiza a linha de HOJE (mesma vigência, gatilho não violado), nunca a de `diasAtras`.
    const depoisDoHistorico = await contarHistoricoDoParametro(chave);
    expect(depoisDoHistorico).toBeGreaterThanOrEqual(2);
  });

  test("tocar no selo alterna estimado ↔ medido, e recarregar a página mantém o novo estado", async ({
    page,
  }) => {
    const chave = chaveDoSeloParaAlternar();

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=parametros");

    const selo = page.getByTestId(`parametro-selo-${chave}`);
    const estadoInicial = await selo.getAttribute("aria-pressed");
    const novoEstado = estadoInicial === "true" ? "false" : "true";

    await selo.click();
    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=parametros$/);
    await expect(page.getByTestId(`parametro-selo-${chave}`)).toHaveAttribute("aria-pressed", novoEstado);
    await expect(page.getByTestId(`parametro-selo-${chave}`)).toHaveText(
      novoEstado === "true" ? "medido" : "estimado",
    );

    await page.reload();
    await expect(page.getByTestId(`parametro-selo-${chave}`)).toHaveAttribute("aria-pressed", novoEstado);
  });

  test("Calcular minha hora: horas em zero mostra 'Informe as horas.' sem número; preenchido, grava a hora com a data de hoje", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=parametros");

    await page.getByTestId("abrir-calcular-hora").click();
    await expect(page.getByRole("heading", { name: "Calcular minha hora" })).toBeVisible();

    const horasInput = page.getByTestId("hora-horas");
    await horasInput.fill("0");
    await expect(page.getByTestId("hora-informe-as-horas")).toHaveText("Informe as horas.");
    await expect(page.getByTestId("hora-valor")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Usar esta hora" })).toBeDisabled();

    await horasInput.fill("140");
    await expect(page.getByTestId("hora-valor")).toContainText("R$");
    await expect(page.getByTestId("hora-informe-as-horas")).toHaveCount(0);

    await page.getByRole("button", { name: "Usar esta hora" }).click();

    await expect(page).toHaveURL(/\/gestao\/cadastros\?sub=parametros/);
    await expect(page.getByText("Hora atualizada.")).toBeVisible();
    await expect(page.getByTestId("parametro-desde-trabalho_hora")).toHaveText(
      `desde ${hojeComoNaTela()}`,
    );
  });

  test("a taxa do cartão aparece como leitura, sem campo editável", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=parametros");

    const linhaDaTaxa = page.getByTestId("taxa-do-cartao-leitura");
    await expect(linhaDaTaxa).toBeVisible();
    await expect(linhaDaTaxa).toContainText("Taxa do cartão");
    await expect(linhaDaTaxa.locator("input")).toHaveCount(0);
  });

  test("a 320px, a sub-navegação de cinco pílulas não provoca rolagem horizontal, todo campo tem fonte de ao menos 16px e todo alvo de toque mede ao menos 44px", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/gestao/cadastros?sub=parametros");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/gestao/cadastros?sub=parametros rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    for (const sub of ["catalogo", "categorias", "fixas", "taxas", "parametros"]) {
      const pilula = page.getByTestId(`cadastros-sub-${sub}`);
      const caixa = await pilula.boundingBox();
      expect(caixa, `pílula "${sub}"`).not.toBeNull();
      expect(caixa!.height, `pílula "${sub}"`).toBeGreaterThanOrEqual(44);
    }

    const primeiraChave = CATALOGO_DE_PARAMETROS[0].chave;
    const primeiroCampo = page.getByTestId(`parametro-${primeiraChave}`).locator("input");
    const caixaDoCampo = await primeiroCampo.boundingBox();
    expect(caixaDoCampo).not.toBeNull();
    expect(caixaDoCampo!.height).toBeGreaterThanOrEqual(44);

    const fonteDoCampo = await primeiroCampo.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fonteDoCampo).toBeGreaterThanOrEqual(16);

    const primeiroSelo = page.getByTestId(`parametro-selo-${primeiraChave}`);
    const caixaDoSelo = await primeiroSelo.boundingBox();
    expect(caixaDoSelo).not.toBeNull();
    expect(caixaDoSelo!.height).toBeGreaterThanOrEqual(44);
    expect(caixaDoSelo!.width).toBeGreaterThanOrEqual(44);
  });
});

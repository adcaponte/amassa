import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { medirCaixa } from "./apoio/medir-caixa";
import { hojeNoAtelie } from "./apoio/semear-financeiro";

// O preço de galeria ou consignado (06.5-29-PLAN.md, D-16). O dono respondeu "b-sobre-o-direto"
// em 06/10/2026: galeria = preço mínimo direto ÷ (1 − comissão da galeria) — o ateliê recebe o
// mesmo que na venda direta. Antes, a comissão entrava no mesmo divisor do lucro e a caneca do
// Cowork saía a 7,7× o preço direto (achado 24; a conta em 06.5-CONTA-DA-GALERIA.md).
//
// Nenhum número fixo de preço: lucro, folga, imposto, perda e material são parâmetros GLOBAIS que
// outros specs mudam no mesmo banco, ao mesmo tempo. O que se confere é a RELAÇÃO entre os dois
// preços que a mesma tela mostra no mesmo instante, com a comissão vigente lida do banco — nenhum
// spec mexe em `preco_comissao_galeria`. Nada é salvo: a ficha calcula ao vivo enquanto se digita.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

async function comissaoVigenteEmPontosBase(): Promise<number> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    const resultado = await cliente.query<{ valor_inteiro: number }>(
      `select valor_inteiro from parametros_precificacao
       where chave = 'preco_comissao_galeria' and vigente_desde <= $1::date
       order by vigente_desde desc limit 1`,
      [hojeNoAtelie()],
    );
    const valor = resultado.rows[0]?.valor_inteiro;
    if (valor === undefined) throw new Error("a semente 0019 não gravou a comissão da galeria");
    return valor;
  } finally {
    await cliente.end();
  }
}

// "R$ 103,12" → 10312. Só dígitos: o separador de milhar e o espaço do Intl não importam.
function paraCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, "");
  if (digitos === "") throw new Error(`sem número em "${texto}"`);
  return Number(digitos);
}

test.describe("polimento precificação", () => {
  test("o preço de galeria é o mínimo direto ÷ (1 − comissão) — D-16", async ({ page }) => {
    const comissao = await comissaoVigenteEmPontosBase();

    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=pecas");
    await page.getByTestId("nova-peca").click();
    await expect(page.getByRole("heading", { name: "Peça nova" })).toBeVisible();

    // A caneca 300 ml dos outros specs de precificação (nada é salvo).
    await page.getByTestId("ficha-campo-nome").fill("[e2e] Caneca da galeria");
    await page.getByTestId("ficha-campo-argila").fill("450");
    await page.getByTestId("ficha-campo-esmalte").fill("60");
    await page.getByTestId("ficha-campo-horas").fill("0,6");
    await page.getByTestId("ficha-campo-largura").fill("12");
    await page.getByTestId("ficha-campo-profundidade").fill("9");
    await page.getByTestId("ficha-campo-altura").fill("10");
    await page.getByTestId("ficha-campo-embalagem").fill("3");

    const direto = page.getByTestId("ficha-minimo-direto");
    const galeria = page.getByTestId("ficha-minimo-galeria");
    await expect(galeria).toHaveText(/R\$/);

    // Os dois números vêm do mesmo render; o poll só espera o último campo digitado assentar.
    await expect
      .poll(async () => {
        const diretoCentavos = paraCentavos(await direto.innerText());
        const galeriaCentavos = paraCentavos(await galeria.innerText());
        return galeriaCentavos - Math.round((diretoCentavos * 10000) / (10000 - comissao));
      })
      .toBe(0);

    // O ateliê recebe na galeria o mesmo que na venda direta (a menos de um centavo de arredondamento).
    const diretoCentavos = paraCentavos(await direto.innerText());
    const galeriaCentavos = paraCentavos(await galeria.innerText());
    expect(Math.abs(Math.round((galeriaCentavos * (10000 - comissao)) / 10000) - diretoCentavos)).toBeLessThanOrEqual(1);

    // O número cabe na tela, também a 375 px.
    const caixa = await medirCaixa(galeria, "preço de galeria");
    const largura = page.viewportSize()?.width ?? 0;
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura);
  });

  test("Parâmetros explica a linha da galeria em “Como o preço é montado”", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=parametros");

    const linha = page.getByText("6 · Galeria ou consignado", { exact: true });
    await expect(linha).toBeVisible();
    await expect(page.getByText("preço mínimo ÷ (1 − comissão)", { exact: true })).toBeVisible();
  });
});

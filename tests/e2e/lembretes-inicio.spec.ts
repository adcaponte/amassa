import { test, expect, type Page } from "@playwright/test";

import { idDoUsuarioDoTeste, lerLembretePorTexto } from "./apoio/semear-lembretes";

// Lembretes no Início — o traçador da Fase 06.3 (06.3-01-PLAN.md, Tarefa 1; LMB-01, LMB-03): do campo
// "+ lembrete" da coluna "Para fazer" à Server Action `criarLembrete`, à tabela `lembretes` e de volta
// à lista, sem recarregar a página. A folha da casa continua no mesmo bloco.
//
// Nenhum teste aqui afirma condição global do banco: o texto é único (projeto + instante) e
// prefixado com `[e2e]` (CLAUDE.md). A trava consultiva entra no plano 03, com a primeira contagem.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

test.describe("lembretes inicio", () => {
  test("criar um lembrete pelo campo do Início com Enter faz a linha aparecer em Para fazer sem recarregar, e a linha está no banco com quem criou", async ({
    page,
  }) => {
    const texto = `[e2e] traçador ${test.info().project.name} ${Date.now()}`;

    await fazerLogin(page);
    await page.goto("/gestao");

    const bloco = page.getByTestId("inicio-bloco-anotacoes");
    await expect(bloco.getByText("Anotações e lembretes", { exact: true })).toBeVisible();
    // A folha da casa continua lá, na coluna ao lado.
    await expect(bloco.getByTestId("anotacoes-caixa")).toBeVisible();

    const coluna = bloco.getByTestId("lembretes-coluna");
    await expect(coluna.getByRole("heading", { name: "Para fazer" })).toBeVisible();

    // Sem recarregar: um marcador na `window` sobrevive só se a página não for recarregada.
    await page.evaluate(() => {
      (window as unknown as { __semRecarregar?: boolean }).__semRecarregar = true;
    });

    const campo = coluna.getByTestId("lembretes-novo-texto");
    await campo.fill(texto);
    await campo.press("Enter");

    const linha = coluna.getByTestId("lembretes-lista").getByTestId("lembrete-linha").filter({ hasText: texto });
    await expect(linha).toHaveCount(1);
    await expect(linha).toBeVisible();
    await expect(campo).toHaveValue("");
    expect(
      await page.evaluate(() => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar),
    ).toBe(true);

    const idDoUsuario = await idDoUsuarioDoTeste();
    await expect
      .poll(async () => {
        const gravado = await lerLembretePorTexto(texto);
        return gravado && {
          criado_por: gravado.criado_por,
          para_quando: gravado.para_quando,
          quem: gravado.quem,
          feito_em: gravado.feito_em,
          feito_por: gravado.feito_por,
        };
      })
      .toEqual({
        criado_por: idDoUsuario,
        para_quando: null,
        quem: null,
        feito_em: null,
        feito_por: null,
      });

    // A linha da tela é a linha do banco.
    const gravado = await lerLembretePorTexto(texto);
    await expect(linha).toHaveAttribute("data-id", gravado?.id ?? "");
  });
});

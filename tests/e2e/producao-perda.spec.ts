import { test, expect, type Page } from "@playwright/test";

import { contarHistoricoDoParametro } from "./apoio/parametro-no-banco";
import { diaEmBrasilia, semearOrdemEncerrada } from "./apoio/semear-producao";

// A perda medida dos últimos 6 meses em Cadastros → Parâmetros (Fase 06.1, plano 12 — D-08,
// PRD-17, critério 6 do ROADMAP): uma linha SÓ DE LEITURA no grupo "Perda", depois do parâmetro
// "Peças que se perdem no caminho". Σ perdidas ÷ Σ feitas das ordens concluídas na janela; as
// extras sem destino e as canceladas ficam fora; a casa entra.
//
// Os dois testes afirmam uma condição GLOBAL do banco (nenhuma / exatamente estas ordens
// concluídas nos últimos 6 meses) — por isso rodam na cadeia `vazio-*` do `playwright.config.ts`,
// nunca por `--grep` como muleta (CLAUDE.md):
// 1. `@vazio-global` — só leitura, antes de qualquer spec criar ordem: o vazio.
// 2. `@vazio-historico` — SERIAL, depois dos só-leitura e antes de `desktop`/`celular`: o único
//    ponto em que as ordens concluídas do banco são só as que este bloco semeia. O outro
//    `@vazio-historico` da Produção (`producao-quadro`) semeia ordens ATIVAS, que esta conta ignora.
// Nomes inventados, prefixo `[e2e]` — nenhum dado real.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

async function abrirParametros(page: Page) {
  await page.goto("/gestao/cadastros?sub=parametros");
  const linha = page.getByTestId("parametros-perda-medida");
  await expect(linha).toBeVisible();
  return linha;
}

test("parametros perda medida vazia @vazio-global", async ({ page }) => {
  await fazerLogin(page);
  const linha = await abrirParametros(page);
  await expect(linha).toHaveText("Ainda sem medida: nenhuma ordem concluída nos últimos 6 meses.");
  // Só leitura: nenhum botão na linha.
  await expect(linha.getByRole("button")).toHaveCount(0);
  // O parâmetro continua lá, editável, com o campo dele.
  await expect(page.getByTestId("parametro-perda_unica").locator("input")).toBeVisible();
});

test.describe.serial("parametros perda medida @vazio-historico", () => {
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  test.beforeAll(async () => {
    // Encomenda concluída: 50 + 10 a mais = 60 feitas, 3 perdidas; das 7 extras boas, 5 ficaram
    // SEM DESTINO — não são perda e não entram na conta.
    await semearOrdemEncerrada({
      nome: `[e2e] Perda encomenda ${sufixo}`,
      tipo: "encomenda",
      status: "concluida",
      quantidade: 50,
      aMais: 10,
      clienteNome: "[e2e] Cliente da perda",
      inicio: diaEmBrasilia(-30),
      concluidaEm: diaEmBrasilia(-3),
      perdidas: 3,
      semDestino: 5,
    });
    // Produção da casa concluída: 40 feitas, 1 perdida — a casa entra.
    await semearOrdemEncerrada({
      nome: `[e2e] Perda casa ${sufixo}`,
      tipo: "casa",
      status: "concluida",
      quantidade: 40,
      inicio: diaEmBrasilia(-20),
      concluidaEm: diaEmBrasilia(-2),
      perdidas: 1,
    });
    // Cancelada com perdidas: fica fora.
    await semearOrdemEncerrada({
      nome: `[e2e] Perda cancelada ${sufixo}`,
      tipo: "encomenda",
      status: "cancelada",
      quantidade: 20,
      clienteNome: "[e2e] Cliente que desistiu",
      inicio: diaEmBrasilia(-15),
      canceladaEm: diaEmBrasilia(-1),
      perdidas: 10,
    });
    // Concluída há mais de 6 meses: fora da janela.
    await semearOrdemEncerrada({
      nome: `[e2e] Perda antiga ${sufixo}`,
      tipo: "casa",
      status: "concluida",
      quantidade: 10,
      inicio: diaEmBrasilia(-230),
      concluidaEm: diaEmBrasilia(-220),
      perdidas: 10,
    });
  });

  test("(1) a linha mostra 4,0% e “4 de 100 peças feitas se perderam, em 2 ordens concluídas.” — e o parâmetro não muda", async ({
    page,
  }) => {
    const historicoAntes = await contarHistoricoDoParametro("perda_unica");
    await fazerLogin(page);
    const linha = await abrirParametros(page);
    const campoDoParametro = page.getByTestId("parametro-perda_unica").locator("input");
    const valorAntes = await campoDoParametro.inputValue();

    await expect(linha).toContainText("Perda medida nos últimos 6 meses");
    await expect(linha.getByTestId("perda-medida-valor")).toHaveText("4,0%");
    await expect(linha).toContainText(
      "4 de 100 peças feitas se perderam, em 2 ordens concluídas. As extras sem destino não entram nesta conta. O parâmetro continua sendo trocado aqui, à mão.",
    );
    // Só leitura: nenhum botão ("usar esta medida" não existe), e nada foi gravado no parâmetro.
    await expect(linha.getByRole("button")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("parametros-perda-medida")).toBeVisible();
    await expect(page.getByTestId("parametro-perda_unica").locator("input")).toHaveValue(valorAntes);
    expect(await contarHistoricoDoParametro("perda_unica")).toBe(historicoAntes);
  });
});

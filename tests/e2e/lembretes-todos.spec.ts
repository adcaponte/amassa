import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  destravarLembretesDeTeste,
  idDoUsuarioDoTeste,
  limparLembretes,
  semearLembrete,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// O primeiro nome da conta do e2e ("Gestora de Teste", `preparar-usuario.ts`).
const PRIMEIRO_NOME_DO_GESTOR_DE_TESTE = "Gestora";

// "Ver todos" — `/gestao/lembretes` (Fase 06.3, plano 05; LMB-09, D-01): os filtros na URL
// (Abertos/Feitos × Todos/Geral/pessoas), a autoria de cada linha, "Mostrar mais 50" e as mesmas
// ações do Início.
//
// Escreve em `lembretes` e afirma o que a tabela inteira devolve: o `describe` roda sob a MESMA
// trava consultiva de todo spec `lembretes-*` (`travarLembretesParaTeste`), em `mode: "serial"`, e
// cada caso começa por `limparLembretes()` — só dentro da trava. Textos inventados, prefixo `[e2e]`
// (CLAUDE.md). A pessoa das pílulas é escolhida pelo `data-filtro` com o id do usuário de teste,
// nunca pelo nome.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function pagina(page: Page): Locator {
  return page.getByTestId("lembretes-pagina");
}

function linhas(page: Page): Locator {
  return pagina(page).getByTestId("lembretes-lista").getByTestId("lembrete-linha");
}

function filtro(page: Page, valor: string): Locator {
  return pagina(page).locator(`[data-testid="lembretes-filtro"][data-filtro="${valor}"]`);
}

test.describe("lembretes todos", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // O outro projeto (desktop/celular) pode estar segurando a trava pelo describe inteiro.
    test.setTimeout(300_000);
    await travarLembretesParaTeste();
  });

  test.afterAll(async () => {
    await destravarLembretesDeTeste();
  });

  // (a) O traçador do plano 05: da URL ao banco — só os feitos "geral", com quem fez e quando.
  test("?situacao=feitos&quem=geral mostra só o feito geral, com feito por {nome} · dd/mm hh:mm em Brasília, e as pílulas Feitos e Geral marcadas", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const idDoUsuario = await idDoUsuarioDoTeste();
    await semearLembrete({ texto: `[e2e] todos aberto geral 1 ${projeto}` });
    await semearLembrete({ texto: `[e2e] todos aberto geral 2 ${projeto}` });
    await semearLembrete({ texto: `[e2e] todos aberto pessoa ${projeto}`, quem: idDoUsuario });
    const textoFeitoGeral = `[e2e] todos feito geral ${projeto}`;
    // 15:20 UTC = 12:20 em Brasília (UTC−3, sem horário de verão).
    const idFeitoGeral = await semearLembrete({
      texto: textoFeitoGeral,
      feitoEm: "2026-09-30T15:20:00.000Z",
    });
    await semearLembrete({
      texto: `[e2e] todos feito pessoa ${projeto}`,
      quem: idDoUsuario,
      feitoEm: "2026-09-30T16:00:00.000Z",
    });

    await fazerLogin(page);
    await page.goto("/gestao/lembretes?situacao=feitos&quem=geral");

    await expect(page.getByRole("heading", { level: 1, name: "Lembretes" })).toBeVisible();
    await expect(linhas(page)).toHaveCount(1);
    const linha = linhas(page).first();
    await expect(linha).toHaveAttribute("data-id", idFeitoGeral);
    await expect(linha).toHaveAttribute("data-situacao", "feito");
    await expect(linha.getByTestId("lembrete-texto")).toHaveText(textoFeitoGeral);
    await expect(linha.getByTestId("lembrete-autoria")).toHaveText(
      `feito por ${PRIMEIRO_NOME_DO_GESTOR_DE_TESTE} · 30/09 12:20`,
    );

    await expect(filtro(page, "feitos")).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "geral")).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "abertos")).not.toHaveAttribute("aria-current", /.*/);
    await expect(filtro(page, "todos")).not.toHaveAttribute("aria-current", /.*/);
  });
});

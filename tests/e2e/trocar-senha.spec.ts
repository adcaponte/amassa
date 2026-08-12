import { execSync } from "node:child_process";

import { test, expect, type Page } from "@playwright/test";

// Cobre o Lote C do BRIEF-NOTURNO.md: tela de trocar a própria senha. "Teste da Server Action"
// do brief é satisfeito aqui, não em Vitest — `exigirUsuario()` importa `@/lib/auth/auth`
// dinamicamente e só resolve dentro do bundler do Next.js, e `trocarSenha` toca o banco; não
// existe camada de mock para isso neste projeto. Estes três e2e provam a mesma coisa com
// banco, hash e sessão reais, evidência mais forte que um mock inventado só para este arquivo.
//
// Trocar senha MUTA estado compartilhado (a própria senha), então cada teste cria sua própria
// conta na hora, nunca a conta global de tests/e2e/apoio/preparar-usuario.ts — mesmo padrão do
// caso de desativação em tests/e2e/sessao.spec.ts. `testInfo.retry` no e-mail evita colisão
// entre a primeira tentativa e um retry em CI com a conta criada na primeira (causa raiz
// corrigida no plano 04-07, em autenticacao.spec.ts).
test.describe("trocar senha", () => {
  test.describe.configure({ mode: "serial" });

  async function criarConta(testInfo: {
    project: { name: string };
    retry: number;
    title: string;
  }): Promise<{ email: string; senha: string }> {
    const nome = "Conta de Troca de Senha";
    // Os três testes deste arquivo rodam no mesmo projeto e (na ausência de retry) no mesmo
    // "retry: 0" — sem um identificador por teste, os dois primeiros a chamar `criarConta`
    // colidiriam no mesmo e-mail. Um slug do título do teste resolve isso mantendo
    // `testInfo.project.name` e `testInfo.retry` no e-mail, como o plano exige.
    const slugDoTitulo = testInfo.title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const email = `troca-senha.${slugDoTitulo}.${testInfo.project.name}.${testInfo.retry}@exemplo.test`;

    const saida = execSync(`npm run criar-usuario -- --nome "${nome}" --email "${email}"`, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
      encoding: "utf-8",
    });
    const linhaSenha = saida.split("\n").find((linha) => linha.startsWith("SENHA: "));
    if (!linhaSenha) {
      throw new Error("scripts/criar-usuario.ts não imprimiu a linha 'SENHA: ' esperada.");
    }
    const senha = linhaSenha.slice("SENHA: ".length).trim();

    return { email, senha };
  }

  async function entrar(page: Page, email: string, senha: string) {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(senha);
    await page.getByRole("button", { name: "Entrar" }).click();
  }

  test("senha atual errada não troca", async ({ page }, testInfo) => {
    const { email, senha } = await criarConta(testInfo);

    await entrar(page, email, senha);
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/conta/senha");
    await page.getByLabel("Senha atual").fill("com-certeza-nao-e-a-senha-certa");
    await page.getByLabel("Senha nova", { exact: true }).fill("panela-barro-forno-quente");
    await page.getByLabel("Confirme a senha nova").fill("panela-barro-forno-quente");
    await page.getByRole("button", { name: "Trocar senha" }).click();

    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "A senha atual não confere. Confira e tente de novo.",
    );

    // A senha não foi trocada: sair e entrar de novo com a senha ORIGINAL chega em `/`.
    await page.context().clearCookies();
    await entrar(page, email, senha);
    await expect(page).toHaveURL(/\/$/);
  });

  test("senha nova curta é recusada pelo servidor", async ({ page }, testInfo) => {
    const { email, senha } = await criarConta(testInfo);

    await entrar(page, email, senha);
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/conta/senha");
    await page.getByLabel("Senha atual").fill(senha);
    await page.getByLabel("Senha nova", { exact: true }).fill("a".repeat(11));
    await page.getByLabel("Confirme a senha nova").fill("a".repeat(11));
    await page.getByRole("button", { name: "Trocar senha" }).click();

    await expect(page.locator("form").getByRole("alert")).toHaveText(
      "A senha nova precisa ter pelo menos 12 caracteres.",
    );
  });

  test("troca, sai, entra com a nova", async ({ page }, testInfo) => {
    const { email, senha } = await criarConta(testInfo);
    const senhaNova = "panela-barro-forno-quente";

    await entrar(page, email, senha);
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/conta/senha");
    await page.getByLabel("Senha atual").fill(senha);
    await page.getByLabel("Senha nova", { exact: true }).fill(senhaNova);
    await page.getByLabel("Confirme a senha nova").fill(senhaNova);
    await page.getByRole("button", { name: "Trocar senha" }).click();

    await expect(page.getByRole("status")).toHaveText("Senha trocada com sucesso.");

    // "Sair" desta spec: o botão de sair já é provado por casca.spec.ts/sessao.spec.ts, e
    // repeti-lo aqui só acrescentaria interação de menu específica de viewport.
    await page.context().clearCookies();

    await entrar(page, email, senha);
    await expect(page).toHaveURL(/\/login(\?|$)/);

    await entrar(page, email, senhaNova);
    await expect(page).toHaveURL(/\/$/);
  });
});

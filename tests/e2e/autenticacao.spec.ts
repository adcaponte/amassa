import { test, expect } from "@playwright/test";

import { MENSAGEM_CREDENCIAIS_INVALIDAS } from "@/lib/auth/credenciais";

// Cobre AUTH-03 (mensagem única) e AUTH-04 (limite de tentativas) do 02a-03-PLAN.md, nos dois
// projetos (desktop e celular).
//
// Os casos de "senha errada" e "senha certa" reaproveitam a conta de
// tests/e2e/apoio/preparar-usuario.ts (globalSetup), a mesma usada por
// tests/e2e/fundacao.spec.ts. O contador de tentativas é por e-mail e vive no processo do
// servidor durante a corrida inteira (lib/auth/tentativas-memoria.ts) — por isso este arquivo
// roda em modo serial (`mode: "serial"`, abaixo): sem isso, os quatro testes tentariam usar a
// mesma conta ao mesmo tempo (dentro do mesmo projeto E entre os dois projetos rodando em
// paralelo), e o teste de bloqueio, que soma seis tentativas reais de propósito, faria a
// suíte inteira competir por CPU e conexões de banco bem além do que qualquer timeout razoável
// cobre. Serial custa alguns segundos a mais na corrida completa; troca justa por não depender
// de contagem de corrida entre tentativas.
//
// O teste de bloqueio usa um e-mail fictício e exclusivo — sufixado com o nome do projeto
// (desktop/celular) para não colidir entre os dois projetos. Reaproveitar um e-mail de outra
// spec, ou entre os dois projetos, quebraria um teste vizinho três semanas depois, sem
// explicação.
test.describe("autenticação — mensagem única e limite de tentativas", () => {
  test.describe.configure({ mode: "serial" });

  test("senha errada para a conta que existe mostra a mensagem única", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill("senha-errada-de-proposito");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Escopado ao <form>: o Next.js injeta um "route announcer" próprio com role="alert" fora
    // do formulário (para leitores de tela anunciarem navegação) — sem o escopo, getByRole
    // encontraria os dois e falharia em modo estrito. Ainda é uma busca por papel, não por
    // classe de estilo.
    const alerta = page.locator("form").getByRole("alert");
    await expect(alerta).toBeVisible();
    await expect(alerta).toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);
  });

  test("e-mail que não existe mostra exatamente a mesma mensagem que senha errada", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("ninguem-tem-conta-aqui@exemplo.test");
    await page.getByLabel("Senha").fill("qualquer-coisa");
    await page.getByRole("button", { name: "Entrar" }).click();

    const alerta = page.locator("form").getByRole("alert");
    await expect(alerta).toBeVisible();
    // Igualdade exata de string, não "parecida" — é o que prova que os dois motivos de falha
    // são indistinguíveis pelo texto (T-02a-13).
    await expect(alerta).toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);
  });

  test("entrar com a senha certa depois de um erro anterior (abaixo do limite) funciona", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill("senha-errada-de-proposito-2");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);

    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();

    // O acerto zera o contador daquele e-mail — provado indiretamente aqui pelo login
    // funcionar mesmo depois do erro anterior.
    await expect(page).toHaveURL(/\/$/);
    // A raiz virou o painel inicial (D-16, 02b-03) — a saudação substitui o heading "AMASSA".
    await expect(page.getByRole("heading", { name: /^Olá, / })).toBeVisible();
  });

  test("a sexta tentativa seguida no mesmo e-mail mostra a mensagem de bloqueio com os minutos", async ({
    page,
  }, testInfo) => {
    // Seis idas e voltas reais, cada uma com uma conferência de hash argon2id de verdade
    // (T-02a-14 — o hash é sempre conferido, mesmo sem usuário). Argon2 é lento de propósito;
    // sob a carga cheia da suíte (os dois projetos × as quatro specs rodando ao mesmo tempo
    // contra o mesmo servidor), essas seis conferências podem ultrapassar o timeout padrão de
    // 30s só por contenção de CPU — não é uma trava real, é o custo (deliberado) do algoritmo.
    testInfo.setTimeout(60_000);

    // E-mail fictício, nunca cadastrado, exclusivo deste teste e deste projeto (ver
    // comentário no topo do arquivo).
    const emailBloqueio = `bloqueio.teste.${testInfo.project.name}@exemplo.test`;

    await page.goto("/login");

    // A mensagem de credencial inválida é IDÊNTICA nas cinco primeiras tentativas — por isso
    // não basta esperar o texto aparecer entre uma tentativa e a próxima: o alerta da
    // tentativa anterior já mostra esse mesmo texto, e a asserção passaria de imediato sobre
    // o DOM antigo, antes mesmo da resposta da tentativa atual chegar. Esperar explicitamente
    // a resposta do POST desta tentativa é o que sincroniza cada volta do laço com o pedido
    // que ela mesma disparou.
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      await page.getByLabel("E-mail").fill(emailBloqueio);
      await page.getByLabel("Senha").fill(`senha-errada-${tentativa}`);

      const respostaDoServidor = page.waitForResponse(
        (resposta) => resposta.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Entrar" }).click();
      await respostaDoServidor;

      // A quinta tentativa ainda mostra a mensagem de credencial inválida — o bloqueio só
      // começa DEPOIS do quinto erro, na sexta tentativa.
      await expect(page.locator("form").getByRole("alert")).toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);
    }

    const respostaDaSexta = page.waitForResponse((resposta) => resposta.request().method() === "POST");
    await page.getByLabel("E-mail").fill(emailBloqueio);
    await page.getByLabel("Senha").fill("senha-errada-6");
    await page.getByRole("button", { name: "Entrar" }).click();
    await respostaDaSexta;

    const alerta = page.locator("form").getByRole("alert");
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText("minuto");
    await expect(alerta).not.toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);
  });
});

import { execSync } from "node:child_process";

import { test, expect, type Page } from "@playwright/test";

import { alternarAtivo, usuarioExiste } from "./apoio/alternar-ativo";

// Cobre AUTH-05 (sessão de 30 dias, renovada a cada uso), AUTH-06 (sair encerra de verdade,
// inclusive contra o botão de voltar) e AUTH-09 (desativar tira o acesso sem apagar a
// linha) do 02a-04-PLAN.md, nos dois projetos (desktop e celular).
//
// Os três primeiros casos reaproveitam a conta de tests/e2e/apoio/preparar-usuario.ts
// (globalSetup), a mesma usada por tests/e2e/fundacao.spec.ts e
// tests/e2e/autenticacao.spec.ts — é preciso uma conta real para provar comportamento de
// sessão de verdade, e um login (sem mutar nada) não colide com nenhum outro teste.
//
// O caso da desativação (4) é diferente: ele MUTA `ativo`, e por isso roda contra uma conta
// PRÓPRIA, criada na hora, exclusiva deste teste e deste projeto — nunca a conta global. Na
// primeira versão deste arquivo ele reaproveitava a conta global e apenas "religava" ativo
// no fim; rodando de verdade (`npm run test:e2e`), o projeto `desktop` desativava a conta
// bem no instante em que o projeto `celular` tentava logar com ela em outro teste deste
// MESMO arquivo (os projetos rodam em paralelo, e `mode: "serial"` só serializa dentro de um
// projeto) — falha real, capturada como "erro=credenciais" onde deveria ter dado certo. Uma
// conta dedicada elimina a colisão na raiz, em vez de tentar apertar ainda mais a janela.
test.describe("sessão", () => {
  test.describe.configure({ mode: "serial" });

  async function fazerLogin(page: Page) {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  }

  // A 02b-02 moveu o botão Sair para dentro do menu do usuário (D-15): no celular ele fica
  // atrás do botão de avatar do cabeçalho (aria-label obrigatório); no desktop, atrás do
  // gatilho no rodapé da barra lateral. Os dois existem sempre no DOM — só um fica visível
  // por vez, conforme o breakpoint de 768px (`md:hidden`/`hidden md:flex`). A visibilidade é
  // o critério de escolha, nunca o nome do projeto do Playwright: ramificar por nome
  // esconderia uma regressão real em um dos dois tamanhos de tela.
  async function abrirMenuDoUsuario(page: Page) {
    const gatilhoCelular = page.getByRole("button", { name: "Abrir menu do usuário" });
    const gatilhoDesktop = page.locator('[data-slot="sidebar-footer"] button').first();

    if (await gatilhoCelular.isVisible()) {
      await gatilhoCelular.click();
    } else {
      await gatilhoDesktop.click();
    }
  }

  test("o cookie de sessao e persistente e vale cerca de 30 dias", async ({ page, context }) => {
    await fazerLogin(page);

    const cookies = await context.cookies();
    // O nome do cookie de sessão do Auth.js muda de prefixo conforme `secure` dinâmico da
    // biblioteca (`authjs.session-token` vs `__Secure-authjs.session-token`) — localizar por
    // sufixo, não por igualdade exata, é o que sobrevive a essa variação (risco documentado
    // no PLAN.md).
    const cookieDeSessao = cookies.find((cookie) => cookie.name.endsWith("session-token"));
    expect(cookieDeSessao, "cookie de sessão do Auth.js não encontrado no contexto").toBeDefined();

    // Prova em par: TEM data de expiração (um cookie sem data morreria ao fechar o
    // navegador — o oposto de AUTH-05) E essa data cai perto de 30 dias dali. Uma afirmação
    // sozinha não distingue "sessão de 30 dias" de "cookie de sessão do navegador com sorte
    // de coincidir".
    expect(cookieDeSessao!.expires).toBeGreaterThan(0);

    const agoraEmSegundos = Date.now() / 1000;
    const trintaDiasEmSegundos = 30 * 24 * 60 * 60;
    const umDiaDeFolgaEmSegundos = 24 * 60 * 60;
    expect(cookieDeSessao!.expires).toBeGreaterThan(
      agoraEmSegundos + trintaDiasEmSegundos - umDiaDeFolgaEmSegundos,
    );
    expect(cookieDeSessao!.expires).toBeLessThan(
      agoraEmSegundos + trintaDiasEmSegundos + umDiaDeFolgaEmSegundos,
    );

    // As três propriedades declaradas explicitamente em lib/auth/auth.config.ts (T-02a-18):
    // só o servidor lê o cookie, o canal precisa ser seguro, e a política de mesmo sítio é a
    // relaxada.
    expect(cookieDeSessao!.httpOnly).toBe(true);
    expect(cookieDeSessao!.secure).toBe(true);
    expect(cookieDeSessao!.sameSite).toBe("Lax");
  });

  test("um contexto novo com o estado salvo abre a raiz sem novo login", async ({
    page,
    context,
    browser,
  }) => {
    await fazerLogin(page);

    // A tradução fiel de "fechar e reabrir o navegador": um contexto NOVO, criado só a
    // partir do estado de armazenamento salvo (cookies), sem reaproveitar a página aberta.
    const estadoDeArmazenamento = await context.storageState();
    const novoContexto = await browser.newContext({ storageState: estadoDeArmazenamento });
    const novaPagina = await novoContexto.newPage();

    await novaPagina.goto("/");

    await expect(novaPagina).toHaveURL(/\/$/);
    await expect(novaPagina.getByRole("heading", { name: "AMASSA" })).toBeVisible();

    await novoContexto.close();
  });

  test("depois de sair o botao de voltar cai em /login", async ({ page }) => {
    await fazerLogin(page);
    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();

    await abrirMenuDoUsuario(page);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login(\?|$)/);

    // O caso que o cabeçalho Cache-Control: no-store da Tarefa 1 existe para fazer passar:
    // sem ele, o navegador serve a tela protegida do próprio cache (bfcache) em vez de pedir
    // de novo ao servidor — e o servidor, sem sessão, teria redirecionado.
    await page.goBack();

    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByText(/Olá, .* Você está autenticado\./)).not.toBeVisible();
  });

  test("conta desativada perde o acesso na requisicao seguinte e a linha continua no banco", async ({
    page,
  }, testInfo) => {
    // Conta dedicada a este teste e a este projeto (ver comentário no topo do arquivo) —
    // roda o mesmo scripts/criar-usuario.ts que tests/e2e/apoio/preparar-usuario.ts usa no
    // globalSetup, contra o mesmo banco de teste.
    const nome = "Conta Desativavel de Teste";
    const email = `desativavel.${testInfo.project.name}@exemplo.test`;

    const saida = execSync(`npm run criar-usuario -- --nome "${nome}" --email "${email}"`, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
      encoding: "utf-8",
    });
    const linhaSenha = saida.split("\n").find((linha) => linha.startsWith("SENHA: "));
    if (!linhaSenha) {
      throw new Error("scripts/criar-usuario.ts não imprimiu a linha 'SENHA: ' esperada.");
    }
    const senha = linhaSenha.slice("SENHA: ".length).trim();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(senha);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "AMASSA" })).toBeVisible();

    await alternarAtivo(email, false);

    await page.reload();

    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByText("Sua sessão foi encerrada. Entre novamente.")).toBeVisible();

    // Prova em par de AUTH-09: o acesso saiu (afirmado acima) E a linha continua no banco
    // (afirmado aqui) — desativar nunca é apagar.
    const existe = await usuarioExiste(email);
    expect(existe, "a linha do usuário sumiu do banco — desativar é ativo=false, nunca DELETE").toBe(
      true,
    );
  });
});

import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";

// Prova automatizada de UI-01 (D-09) — "parece certo na minha tela" não é teste. Corre em
// /login (rota pública, sem precisar de sessão), nos dois projetos (desktop e celular)
// declarados em playwright.config.ts. Cobre a "armadilha de silêncio" do @theme inline: um
// componente instalado sem o mapeamento não quebra o build nem aparece no console — só uma
// leitura de cor computada no navegador pega isso.
//
// Nomes de família de fonte: medidos de verdade no navegador durante o portão de retorno do
// tracer da Tarefa 2 (02b-01) — com `variable: "--fonte-archivo"` (a CSS custom property que
// D-10 pede, consumida pelo bloco @theme), o next/font/google gerava o nome LEGÍVEL da família
// ("Archivo Narrow", "Inter") mais o par "* Fallback" com métricas ajustadas — nunca o nome
// com hash (`__Archivo_Narrow_<hash>`) que só aparece no padrão de uso via `.className`
// direto, que este projeto não usa. Qualquer teste futuro de nome de fonte deve usar o nome
// medido, não o presumido.
//
// D-13 (fechado nesta mudança) trocou o "AMASSA" de texto em Archivo Narrow por um SVG da
// marca — o heading continua se chamando "AMASSA" (aria-label do <svg>, para o INFRA-02 de
// tests/e2e/fundacao.spec.ts), mas não sobra texto nele para medir fonte. Ancorar a prova de
// Archivo Narrow num único elemento foi exatamente o que mascarou, por toda a Fase 2b, o
// defeito real: `font-titulo` só era aplicado pelo `Logo`, nunca pelos papéis `display`/
// `título` em si (04-DESIGN-SYSTEM.md §4, 02b-UI-SPEC.md) — os outros seis usos reais desses
// papéis (saudação do painel, título de página, cabeçalho móvel, título de cartão, estado
// vazio, estado de erro) sempre renderizaram em Inter. A correção mora agora em
// `app/globals.css` (`@utility text-display`/`@utility text-titulo`, comentário lá explica o
// porquê), então a prova aqui mede TRÊS pontos reais e independentes — título de tela de
// módulo, saudação do painel e título de um cartão do painel — para que ancorar em um só nunca
// mais esconda uma regressão nos outros.
async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

test.describe("design system — cor e tipografia computadas no navegador (UI-01, D-09)", () => {
  test("botão 'Entrar' resolve para o terracota do design system", async ({ page }) => {
    await page.goto("/gestao/login");

    const botao = page.getByRole("button", { name: "Entrar" });
    const cor = await botao.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Igualdade exata de string — nunca uma comparação frouxa sobre "rgb" solto. É a prova
    // de que #894025 (--color-acento) chegou ao navegador através do mapeamento inteiro:
    // token cru → @theme inline → --color-primary → utilitário do Button.
    expect(cor).toBe("rgb(137, 64, 37)");
  });

  test("o <body> resolve para o fundo areia do design system", async ({ page }) => {
    await page.goto("/gestao/login");

    const cor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(cor).toBe("rgb(246, 243, 240)");
  });

  test("papel 'display'/'título' usa Archivo Narrow em três pontos independentes, e o corpo usa Inter", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Ponto 1 — saudação do painel inicial ("Olá, ..."), papel `display`. Rota "/" pós-login,
    // mesmo heading que tests/e2e/fundacao.spec.ts usa para provar o pós-login.
    const familiaSaudacao = await page
      .getByRole("heading", { name: /^Olá, / })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // Ponto 2 — título de um bloco do Início, papel `título`. `CardTitle` (shadcn) é um
    // <div data-slot="card-title">, não um heading — sem papel de acessibilidade próprio —
    // então a busca é pelo texto exato, não por getByRole. Fase 04.6, plano 06: o painel de
    // quatro cartões vazios ("Encomendas por etapa") virou o Início de verdade — o bloco
    // "Agenda de hoje" é o âncora nova, mesmo papel `título`, mesmo componente por baixo
    // (`BlocoDoInicio`, que reaproveita `CardTitle`).
    const familiaCartao = await page
      .getByText("Agenda de hoje", { exact: true })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // O corpo da própria rota autenticada — mesma fonte em toda a aplicação, então medir
    // aqui é equivalente a medir em /login.
    const familiaCorpo = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

    // Ponto 3 — título de uma tela de módulo (`CabecalhoPagina`, papel `display`). Fase 04.6,
    // plano 05 (D-13): "Produção" é o rótulo novo de Encomendas. Fase 06.1 (D-03): a rota é
    // `/gestao/producao`.
    await page.goto("/gestao/producao");
    // Plano 06.1-15: o esqueleto da Produção (`producao/loading.tsx`) desenha o MESMO `h1`
    // "Produção" do `CabecalhoPagina`. Sem esta espera, o localizador achava o `h1` do esqueleto,
    // o React o trocava pelo da página pronta, e o `getComputedStyle` de um elemento já fora do
    // documento devolvia "" — falhou uma vez na varredura completa, sob carga. "Nova ordem" só
    // existe na página pronta (no cabeçalho ou no vazio), nunca no esqueleto.
    await expect(page.getByTestId("nova-ordem-abrir").first()).toBeVisible();
    const familiaTituloModulo = await page
      .getByRole("heading", { name: "Produção", level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // Ancorado no início da lista de fontes — não basta "conter" Archivo Narrow em algum
    // lugar da pilha; a família real precisa vir PRIMEIRO (antes do "* Fallback" e de
    // qualquer fonte de sistema). Uma âncora solta passaria mesmo se só a "Archivo Narrow
    // Fallback" sobrevivesse em primeiro lugar — a âncora não deixa.
    //
    // `ArchivoNarrow`, sem espaço, desde 02/10/2026 (janela 60): com `next/font/local` no
    // Turbopack o nome da família é o nome da constante JS em `app/layout.tsx`, e identificador
    // não tem espaço. Mesmo arquivo `.woff2` de antes — só o rótulo mudou.
    expect(familiaSaudacao).toMatch(/^"?ArchivoNarrow"?,/);
    expect(familiaCartao).toMatch(/^"?ArchivoNarrow"?,/);
    expect(familiaTituloModulo).toMatch(/^"?ArchivoNarrow"?,/);
    expect(familiaCorpo).toMatch(/^"?Inter"?,/);

    // O nome na pilha só vale se existir uma `@font-face` com ESSE nome que o navegador de fato
    // carregou. Na troca para `next/font/local` a pilha chegou a sair `archivoNarrow, ...`
    // enquanto as `@font-face` se chamavam "Archivo Narrow" — nome nenhum casava, o título
    // renderizaria na fonte de reserva, e uma prova só de nome não pegaria se o nome esperado
    // fosse o errado. Aqui a primeira família da pilha precisa estar entre as faces carregadas.
    const facesCarregadas = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.replace(/["']/g, "").toLowerCase());
    });
    for (const pilha of [familiaTituloModulo, familiaCorpo]) {
      const primeira = pilha.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
      expect(facesCarregadas, `face carregada para "${primeira}"`).toContain(primeira);
    }
  });

  test("os campos de login têm fonte de pelo menos 16px e altura mínima de 44px (UI-09)", async ({
    page,
  }) => {
    await page.goto("/gestao/login");

    for (const rotulo of ["E-mail", "Senha"]) {
      const campo = page.getByLabel(rotulo);
      const tamanhoFonte = await campo.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      );
      const caixa = await medirCaixa(campo, `campo "${rotulo}"`);

      expect(tamanhoFonte).toBeGreaterThanOrEqual(16);
      expect(caixa.height).toBeGreaterThanOrEqual(44);
    }

    const botao = page.getByRole("button", { name: "Entrar" });
    const caixaBotao = await medirCaixa(botao, "botão Entrar");
    expect(caixaBotao.height).toBeGreaterThanOrEqual(44);
  });
});

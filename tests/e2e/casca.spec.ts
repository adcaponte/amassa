import { test, expect, type Page } from "@playwright/test";

import { ITENS_NAVEGACAO_CELULAR, ITENS_NAVEGACAO_LATERAL } from "@/lib/navegacao/itens";

import { medirCaixa } from "./apoio/medir-caixa";

// Cobre GES-12 (4 itens no celular / 7 no desktop, navegação final da Fase 04.6, D-11), GES-13
// (menu do usuário com 3 itens, D-12) e GES-14 ("Produção" como rótulo, D-13) — mais o que
// sobrou de UI-02/UI-03/UI-06/UI-07 da casca construída nos planos 02/03 da Fase 2b, que a
// navegação nova não muda. Roda nos dois projetos (desktop e celular) declarados em
// playwright.config.ts.
//
// Celular e lateral são constantes INDEPENDENTES desde o plano 05 (D-11) — a de baixo nunca é
// derivada da lateral por corte. `listaDaNavegacaoPeloProjeto` escolhe a lista certa pelo NOME
// do projeto Playwright (o único sinal confiável de "qual viewport" nestes testes específicos,
// que precisam saber de ANTEMÃO quantos itens esperar antes de olhar para o DOM).
function listaDaNavegacaoPeloProjeto(nomeDoProjeto: string) {
  return nomeDoProjeto.includes("celular") ? ITENS_NAVEGACAO_CELULAR : ITENS_NAVEGACAO_LATERAL;
}
//
// Barra lateral e barra inferior estão SEMPRE as duas no DOM (app/gestao/(app)/layout.tsx renderiza
// as duas incondicionalmente; só o CSS — "hidden md:flex" numa, "md:hidden" na outra —
// decide qual fica visível por breakpoint). Um elemento com "display: none" sai da árvore de
// acessibilidade do navegador, então localizar por papel/nome acessível (getByRole) já resolve
// sozinho para a metade visível em cada projeto — nunca ramificando por
// `testInfo.project.name`, o mesmo princípio que tests/e2e/sessao.spec.ts já usa para o
// gatilho do menu do usuário.
async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

// Escolhe a navegação principal visível no viewport atual: a barra inferior tem
// `aria-label="Navegação principal"` (nav de verdade); a barra lateral (Sidebar do shadcn com
// `collapsible="none"`) é um `<div data-slot="sidebar">` sem papel de `navigation` próprio.
async function localizarNavegacaoPrincipal(page: Page) {
  const barraInferior = page.getByRole("navigation", { name: "Navegação principal" });
  if (await barraInferior.isVisible()) {
    return barraInferior;
  }
  return page.locator('[data-slot="sidebar"]');
}

// Igual ao helper de tests/e2e/sessao.spec.ts: escolhe o gatilho pela visibilidade real, nunca
// pelo nome do projeto — o avatar do cabeçalho móvel no celular, o rodapé da lateral no
// desktop.
async function abrirMenuDoUsuario(page: Page) {
  const gatilhoCelular = page.getByRole("button", { name: "Abrir menu do usuário" });
  const gatilhoDesktop = page.locator('[data-slot="sidebar-footer"] button').first();

  if (await gatilhoCelular.isVisible()) {
    await gatilhoCelular.click();
  } else {
    await gatilhoDesktop.click();
  }
}

// Localiza o contêiner dos itens do menu do usuário pelo `data-testid` (as duas variantes o
// têm) — contar por aqui é o que permite provar "exatamente três" sem depender de texto nem de
// papel ARIA, que divergem entre a variante celular (link/botão soltos) e a desktop (menuitem do
// Radix).
function localizarItensDoMenu(page: Page) {
  return page.getByTestId("casca-menu-usuario-itens");
}

// `/gestao/encomendas` saiu desta lista na Fase 3 (03-01-PLAN.md, Tarefa 2), e `/gestao/queimas` sai agora,
// na varredura completa de fim de fase da Fase 4 (04-07-PLAN.md, Tarefa 1): em ambos os casos o
// botão deixou de ser inerte (agora é um fluxo real, com persistência via Postgres) e a nota
// "Chega na Fase N." deixou de fazer sentido — as duas mudanças são o objetivo da própria fase,
// não uma regressão. A tela ainda tem cabeçalho + estado vazio com frase de contexto quando não
// há forno nenhum, mas isso deixou de caber no contrato genérico "sempre a mesma casca vazia,
// nunca modificável" que este teste verifica só para os módulos que ainda não foram construídos.
// Cobertura de `/gestao/queimas` (cabeçalho, cadastro, registro de queima, persistência) vive em
// `tests/e2e/queimas-*.spec.ts`. `/gestao/estoque` sai pelo mesmo motivo na Fase 06 (plano 06-01): a
// tela passou a ler o livro de verdade, o vazio ganhou a frase da UI-SPEC e fica sem botão até o
// plano 06-09 — coberta por `tests/e2e/estoque-tracador.spec.ts` (o vazio, na cadeia `@vazio-global`).
// Achado pela varredura completa sem `--grep` (04-07): este teste
// nunca tinha rodado depois que `/gestao/queimas` deixou de ser um placeholder, porque nenhum plano da
// Fase 4 tocava `tests/e2e/casca.spec.ts` nem invocava o e2e sem `--grep` até este ponto.
//
// `/gestao/agenda` saiu na Fase 5 (plano 05-01, o traçador): a tela passou a ler a semana de verdade
// — coberta por `tests/e2e/agenda-tracador.spec.ts`. Era a ÚLTIMA tela de módulo inerte: a lista
// `TELAS_DE_MODULO` e o teste que a percorria saíram juntos, porque um laço sobre lista vazia passa
// sem provar nada. O 320px desta suíte (`ROTAS_A_320PX`) e `acessibilidade.spec.ts` continuam
// cobrindo `/gestao/agenda`.

const ROTAS_A_320PX = [
  "/gestao",
  "/gestao/producao",
  "/gestao/agenda",
  "/gestao/queimas",
  "/gestao/estoque",
  "/gestao/cadastros",
  // Fase 06.3 (plano 05): "ver todos" dos Lembretes — as pílulas de filtro quebram linha, nunca
  // rolam para o lado.
  "/gestao/lembretes",
  "/gestao/financeiro?aba=orcamentos",
  "/gestao/login",
];

test.describe("casca de navegação (GES-12, GES-13, GES-14, UI-03, UI-06, UI-07)", () => {
  // Cada teste faz o próprio login (fazerLogin), e cada login é uma conferência real de hash
  // argon2id — deliberadamente lenta (mesmo custo documentado em
  // tests/e2e/autenticacao.spec.ts e tests/e2e/sessao.spec.ts, que já rodam em série pelo
  // mesmo motivo: reduzir quantas conferências concorrentes a suíte inteira pede ao servidor
  // de uma vez). Sete testes por projeto sem essa configuração rodariam em paralelo (o padrão
  // de `fullyParallel: true` do playwright.config.ts); rodar em série aqui segue a mesma
  // convenção só por prudência de carga — nenhum destes testes muta estado compartilhado
  // entre si.
  test.describe.configure({ mode: "serial" });

  // Casos (a)/(b) do plano 05: a contagem e a ordem exatas das duas listas, na navegação de
  // verdade — não só na constante.
  test("a navegação principal visível tem os itens de ITENS_NAVEGACAO_CELULAR (4, celular: Início · Financeiro · Produção · Agenda) ou ITENS_NAVEGACAO_LATERAL (8, desktop, terminando em Cadastros), na ordem (GES-12, D-11)", async ({
    page,
  }, testInfo) => {
    await fazerLogin(page);

    const itens = listaDaNavegacaoPeloProjeto(testInfo.project.name);
    const navegacao = await localizarNavegacaoPrincipal(page);
    const links = navegacao.getByRole("link");
    await expect(links).toHaveCount(itens.length);

    for (const [indice, item] of itens.entries()) {
      await expect(links.nth(indice)).toHaveAccessibleName(item.rotulo);
    }
  });

  // Caso (c) do plano 05: Queimas e Estoque não aparecem na barra de baixo do celular — a mesma
  // asserção acima já prova isso pela contagem/ordem de 4 itens, mas este teste nomeia a
  // ausência explicitamente (celular) e a presença alcançável (desktop), em vez de deixar a
  // garantia implícita numa contagem genérica.
  test("Queimas e Estoque não aparecem na barra de baixo do celular, e continuam alcançáveis pela lateral no desktop (GES-12, D-11)", async ({
    page,
  }, testInfo) => {
    await fazerLogin(page);

    const navegacao = await localizarNavegacaoPrincipal(page);
    const ehCelular = testInfo.project.name.includes("celular");

    const linkQueimas = navegacao.getByRole("link", { name: "Queimas" });
    const linkEstoque = navegacao.getByRole("link", { name: "Estoque" });

    if (ehCelular) {
      await expect(linkQueimas).toHaveCount(0);
      await expect(linkEstoque).toHaveCount(0);
    } else {
      await expect(linkQueimas).toBeVisible();
      await expect(linkEstoque).toBeVisible();
    }
  });

  test("cada item leva a sua rota e só ele expõe aria-current entre os visíveis (GES-12)", async ({
    page,
  }, testInfo) => {
    await fazerLogin(page);

    const navegacao = await localizarNavegacaoPrincipal(page);
    const itens = listaDaNavegacaoPeloProjeto(testInfo.project.name);

    for (const item of itens) {
      await navegacao.getByRole("link", { name: item.rotulo }).click();

      const padraoDeUrl = item.href === "/gestao" ? /\/gestao$/ : new RegExp(`${item.href}$`);
      await expect(page).toHaveURL(padraoDeUrl);

      await expect(navegacao.getByRole("link", { name: item.rotulo })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // Conta só DENTRO do menu principal visível: a outra navegação principal (oculta por CSS)
      // fica de fora por construção, e um submenu da própria tela pode legitimamente marcar o seu
      // item — em /queimas o SeletorQueimas marca "Fornos" com aria-current, o que
      // queimas-relatorios.spec.ts exige. Contar na página inteira só passava no Next 15 porque a
      // tela de carregamento de /queimas (sem o submenu) estava no ar no instante da contagem.
      await expect(navegacao.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  // Caso (f) do plano 05: um caminho que não é módulo (a tela de trocar senha) não acende
  // nenhum item de navegação — mas as duas barras (a visível e a oculta por CSS) continuam
  // renderizadas no DOM.
  test("em /gestao/conta/senha nenhum item de navegação tem aria-current, e as duas barras continuam visíveis (GES-12, aresta empty)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/conta/senha");

    const navegacao = await localizarNavegacaoPrincipal(page);
    await expect(navegacao.locator('[aria-current="page"]')).toHaveCount(0);

    // A barra inferior tem role="navigation" própria; a lateral é o `[data-slot="sidebar"]` —
    // uma das duas está oculta por CSS (`display: none`), nunca ausente do DOM. `getByRole`
    // exclui elementos ocultos da árvore de acessibilidade por padrão — contar por aqui exigiria
    // `{ hidden: true }`; o seletor CSS direto (`locator`) encontra o elemento independente de
    // estar visível, que é exatamente o que "nunca ausente do DOM" precisa provar.
    await expect(page.locator('nav[aria-label="Navegação principal"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(1);
  });

  // Caso (d) do plano 05: o menu do usuário fica com exatamente três itens, nas duas variantes,
  // e nenhum deles é Orçamentos.
  test("o menu do usuário tem exatamente três itens, e nenhum é Orçamentos (GES-13, D-12)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await abrirMenuDoUsuario(page);

    const itensDoMenu = localizarItensDoMenu(page);
    await expect(itensDoMenu).toBeVisible();
    await expect(itensDoMenu.locator(":scope > *")).toHaveCount(3);
    await expect(itensDoMenu.getByText("Orçamentos")).toHaveCount(0);

    await expect(itensDoMenu.getByText("Abertura do Espaço")).toBeVisible();
    await expect(itensDoMenu.getByText("Trocar senha")).toBeVisible();
    await expect(itensDoMenu.getByText("Sair")).toBeVisible();
  });

  // Caso (e) do plano 05: Orçamentos saiu do menu, mas não da plataforma — a porta continua
  // aberta por URL direta, a mesma que ORC-17 criou dentro do Financeiro.
  test("/gestao/financeiro?aba=orcamentos continua abrindo a aba de Orçamentos — a porta sobreviveu, só o atalho do menu saiu (GES-13)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=orcamentos");

    await expect(page.getByTestId("financeiro-aba-orcamentos")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  // Caso (h) do plano 05: sem resíduo — nenhum separador órfão, nenhum ícone importado sem uso
  // (isso o `lint` já cobra), e "Sair" segue funcionando depois da remoção de Orçamentos.
  test("Sair continua funcionando depois da remoção de Orçamentos do menu (GES-13, aresta empty)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await abrirMenuDoUsuario(page);

    await localizarItensDoMenu(page).getByText("Sair").click();

    await expect(page).toHaveURL(/\/gestao\/login$/);
  });

  test("no desktop, a barra lateral tem largura fixa de 240px (UI-03)", async ({ page }) => {
    await fazerLogin(page);

    const barraLateral = page.locator('[data-slot="sidebar"]');

    if (!(await barraLateral.isVisible())) {
      // Na barra inferior do celular não existe barra lateral visível para medir — nada a
      // conferir aqui neste viewport.
      return;
    }

    const caixa = await medirCaixa(barraLateral, "barra lateral");
    expect(caixa.width).toBe(240);
  });

  // Caso (h) do plano 05 (a segunda metade — a primeira é o teste do menu acima): a 320px, com
  // quatro itens em vez de cinco, a barra de baixo não rola na horizontal e cada alvo mede pelo
  // menos 44px de altura.
  test("nenhuma das oito rotas exige rolagem horizontal a 320px de largura, e cada item da barra de baixo mede ao menos 44px de altura (UI-06, GES-12)", async ({
    page,
  }, testInfo) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });

    for (const rota of ROTAS_A_320PX) {
      await page.goto(rota);

      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);

      expect(
        scrollWidth,
        `a rota ${rota} rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
      ).toBeLessThanOrEqual(clientWidth);
    }

    if (testInfo.project.name.includes("celular")) {
      // A última rota do laço acima é /gestao/login, que não tem casca (sem barra de baixo) —
      // volta para uma rota autenticada antes de medir os alvos de toque.
      await page.goto("/gestao");

      const navegacao = page.getByRole("navigation", { name: "Navegação principal" });
      const links = navegacao.getByRole("link");
      const quantidade = await links.count();
      expect(quantidade).toBe(4);

      for (let indice = 0; indice < quantidade; indice += 1) {
        const caixa = await medirCaixa(links.nth(indice), `link ${indice} da barra de baixo`);
        expect(caixa.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  // Caso (g) do plano 05: tocar em Produção na barra de baixo chega à Produção, e o título da tela
  // mostra "Produção" — a rota e o encoding do rótulo, provados juntos. Fase 06.1 (D-03): a rota é
  // /gestao/producao.
  test("no celular, o cabeçalho mostra o título da tela atual, não um valor fixo — inclusive 'Produção' (GES-14, UI-07)", async ({
    page,
  }) => {
    await fazerLogin(page);

    // <header> aqui é um descendente só de <div>s (nenhum article/aside/main/nav/section entre
    // ele e o body), então mantém o papel implícito "banner" — sem precisar de aria-label
    // próprio para localizá-lo.
    const cabecalho = page.getByRole("banner");

    // Três rotas, não uma: o próprio defeito original era um valor que por acaso ficava
    // constante ("AMASSA" fixo). Uma rota só não distingue um título derivado de uma string fixa
    // que coincide com o esperado.
    const rotasEtitulos = [
      { href: "/gestao/producao", titulo: "Produção" },
      { href: "/gestao/queimas", titulo: "Queimas" },
      { href: "/gestao/cadastros", titulo: "Cadastros" },
    ];

    for (const { href, titulo } of rotasEtitulos) {
      await page.goto(href);

      if (!(await cabecalho.isVisible())) {
        // No desktop o cabeçalho móvel fica oculto por CSS (md:hidden) — nada a conferir aqui
        // neste viewport, mesmo princípio do teste de largura da barra lateral acima.
        return;
      }

      await expect(cabecalho).toContainText(titulo);
    }
  });
});

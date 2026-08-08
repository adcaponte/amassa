import { test, expect, type Page } from "@playwright/test";

import { ITENS_NAVEGACAO } from "@/lib/navegacao/itens";

// Cobre UI-02 (5 itens, item ativo), UI-03 (240px na lateral), UI-04 (Orçamentos fora da
// navegação principal), UI-06 (sem rolagem horizontal a 320px) e UI-07 (cabeçalho + estado
// vazio + botão inerte com nota) da casca construída nos planos 02 e 03 desta fase. Roda nos
// dois projetos (desktop e celular) declarados em playwright.config.ts.
//
// Barra lateral e barra inferior estão SEMPRE as duas no DOM (app/(app)/layout.tsx renderiza
// as duas incondicionalmente; só o CSS — "hidden md:flex" numa, "md:hidden" na outra —
// decide qual fica visível por breakpoint). Um elemento com "display: none" sai da árvore de
// acessibilidade do navegador, então localizar por papel/nome acessível (getByRole) já resolve
// sozinho para a metade visível em cada projeto — nunca ramificando por
// `testInfo.project.name`, o mesmo princípio que tests/e2e/sessao.spec.ts já usa para o
// gatilho do menu do usuário.
async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
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

type TelaDeModulo = {
  href: string;
  tituloPagina: string;
  tituloVazio: string;
  corpo: string;
  rotuloBotao: string;
  notaBotao: string;
};

const TELAS_DE_MODULO: readonly TelaDeModulo[] = [
  {
    href: "/encomendas",
    tituloPagina: "Encomendas",
    tituloVazio: "A roda ainda não gira.",
    corpo: "Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui.",
    rotuloBotao: "Nova encomenda",
    notaBotao: "Chega na Fase 3.",
  },
  {
    href: "/agenda",
    tituloPagina: "Agenda",
    tituloVazio: "Nenhuma turma na grade ainda.",
    corpo: "Cadastre a primeira turma e as aulas da semana aparecem aqui, com data e presença por aluna.",
    rotuloBotao: "Nova turma",
    notaBotao: "Chega na Fase 5.",
  },
  {
    href: "/queimas",
    tituloPagina: "Queimas",
    tituloVazio: "Nenhum forno cadastrado ainda.",
    corpo: "Cadastre o primeiro forno para começar a contar as queimas em dois toques.",
    rotuloBotao: "Novo forno",
    notaBotao: "Chega na Fase 4.",
  },
  {
    href: "/estoque",
    tituloPagina: "Estoque",
    tituloVazio: "Nada no estoque ainda.",
    corpo: "Cadastre o primeiro material — cerâmica, pintura ou bordado — para começar a controlar o saldo.",
    rotuloBotao: "Novo material",
    notaBotao: "Chega na Fase 6.",
  },
];

const ROTAS_A_320PX = [
  "/",
  "/encomendas",
  "/agenda",
  "/queimas",
  "/estoque",
  "/orcamentos",
  "/login",
];

test.describe("casca de navegação (UI-02, UI-03, UI-04, UI-06, UI-07)", () => {
  // Cada teste faz o próprio login (fazerLogin), e cada login é uma conferência real de hash
  // argon2id — deliberadamente lenta (mesmo custo documentado em
  // tests/e2e/autenticacao.spec.ts e tests/e2e/sessao.spec.ts, que já rodam em série pelo
  // mesmo motivo: reduzir quantas conferências concorrentes a suíte inteira pede ao servidor
  // de uma vez). Sete testes por projeto sem essa configuração rodariam em paralelo (o padrão
  // de `fullyParallel: true` do playwright.config.ts); rodar em série aqui segue a mesma
  // convenção só por prudência de carga — nenhum destes testes muta estado compartilhado
  // entre si.
  test.describe.configure({ mode: "serial" });

  test("a navegação principal visível tem exatamente 5 itens, na ordem e com os rótulos de ITENS_NAVEGACAO (UI-02)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const navegacao = await localizarNavegacaoPrincipal(page);
    const links = navegacao.getByRole("link");
    await expect(links).toHaveCount(5);

    for (const [indice, item] of ITENS_NAVEGACAO.entries()) {
      await expect(links.nth(indice)).toHaveAccessibleName(item.rotulo);
    }
  });

  test("cada item leva a sua rota e só ele expõe aria-current entre os visíveis (UI-02)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const navegacao = await localizarNavegacaoPrincipal(page);

    for (const item of ITENS_NAVEGACAO) {
      await navegacao.getByRole("link", { name: item.rotulo }).click();

      const padraoDeUrl = item.href === "/" ? /\/$/ : new RegExp(`${item.href}$`);
      await expect(page).toHaveURL(padraoDeUrl);

      await expect(navegacao.getByRole("link", { name: item.rotulo })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // ":visible" filtra a metade oculta por CSS (a outra navegação, sempre presente no DOM)
      // — só o item ativo da navegação que está de fato na tela conta.
      await expect(page.locator('[aria-current="page"]:visible')).toHaveCount(1);
    }
  });

  test("Orçamentos não aparece na navegação principal e só é alcançável pelo menu do usuário (UI-04)", async ({
    page,
  }) => {
    await fazerLogin(page);

    // No desktop, o `DropdownMenuItem asChild` do Radix aplica role="menuitem" no elemento
    // recebido (a mesma armadilha do botão Sair documentada em menu-usuario.tsx) — o link de
    // Orçamentos perde o papel nativo de "link" e passa a responder por "menuitem". No
    // celular, fora do DropdownMenu, o mesmo <Link> mantém role="link" normalmente. Combinar
    // os dois papéis é o que torna esta busca válida nos dois projetos, sem depender de qual
    // está ativo.
    const itemOrcamentos = page
      .getByRole("link", { name: "Orçamentos" })
      .or(page.getByRole("menuitem", { name: "Orçamentos" }));

    // Nenhum dos 5 links da navegação principal (visível em nenhum dos dois projetos) chama
    // "Orçamentos" — o conteúdo do menu do usuário fica desmontado (Radix Sheet/DropdownMenu)
    // enquanto fechado, então esta busca de página inteira não encontra nada por engano.
    await expect(itemOrcamentos).toHaveCount(0);

    await abrirMenuDoUsuario(page);
    await itemOrcamentos.click();

    await expect(page).toHaveURL(/\/orcamentos$/);
  });

  test("no desktop, a barra lateral tem largura fixa de 240px (UI-03)", async ({ page }) => {
    await fazerLogin(page);

    const barraLateral = page.locator('[data-slot="sidebar"]');

    if (!(await barraLateral.isVisible())) {
      // Na barra inferior do celular não existe barra lateral visível para medir — nada a
      // conferir aqui neste viewport.
      return;
    }

    const caixa = await barraLateral.boundingBox();
    expect(caixa?.width).toBe(240);
  });

  test("nenhuma das sete rotas exige rolagem horizontal a 320px de largura (UI-06)", async ({
    page,
  }) => {
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
  });

  test("cada tela de módulo tem cabeçalho, estado vazio com frase de contexto e botão inerte com nota (UI-07)", async ({
    page,
  }) => {
    await fazerLogin(page);

    for (const tela of TELAS_DE_MODULO) {
      await page.goto(tela.href);

      await expect(page.getByRole("heading", { name: tela.tituloPagina, level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: tela.tituloVazio, level: 2 })).toBeVisible();
      await expect(page.getByText(tela.corpo)).toBeVisible();

      const botao = page.getByRole("button", { name: tela.rotuloBotao });
      await expect(botao).toBeVisible();
      await expect(botao).toBeDisabled();
      await expect(botao).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByText(tela.notaBotao)).toBeVisible();
    }
  });

  test("/orcamentos mostra título e corpo, sem nenhum botão (UI-04, UI-07)", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/orcamentos");

    await expect(page.getByRole("heading", { name: "Orçamentos", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "A calculadora ainda não existe.", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Ela depende das planilhas de precificação do ateliê. Assim que estiverem prontas, o orçamento sai daqui.",
      ),
    ).toBeVisible();

    // Escopado a <main> (a área de conteúdo da página) — a casca ao redor tem seus próprios
    // botões (avatar/menu do usuário), que não são o que este critério mede.
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  });

  test("no celular, o cabeçalho mostra o título da tela atual, não um valor fixo (UI-07)", async ({
    page,
  }) => {
    await fazerLogin(page);

    // <header> aqui é um descendente só de <div>s (nenhum article/aside/main/nav/section entre
    // ele e o body), então mantém o papel implícito "banner" — sem precisar de aria-label
    // próprio para localizá-lo.
    const cabecalho = page.getByRole("banner");

    // Duas rotas, não uma: o próprio defeito era um valor que por acaso ficava constante
    // ("AMASSA" fixo). Uma rota só não distingue um título derivado de uma string fixa que
    // coincide com o esperado.
    const rotasEtitulos = [
      { href: "/encomendas", titulo: "Encomendas" },
      { href: "/queimas", titulo: "Queimas" },
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

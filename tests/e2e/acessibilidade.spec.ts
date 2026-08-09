import { execSync } from "node:child_process";

import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { ITENS_NAVEGACAO } from "@/lib/navegacao/itens";
import { NOME_ACESSIVEL_MENU_USUARIO } from "@/lib/acessibilidade/rotulos";

// Prova de máquina de UI-09 — alvo de toque medido, contraste varrido por ferramenta, nome
// acessível conferido por papel e navegação por teclado exercitada — sobre a casca inteira da
// fase, nos dois projetos (desktop e celular) do playwright.config.ts. UI-05 (o polegar) NÃO
// está aqui: nenhum teste mede conforto, é a verificação humana da Tarefa 3 do plano
// (02b-VERIFICACAO-HUMANA.md).
//
// Rótulos de navegação vêm de ITENS_NAVEGACAO e o nome acessível do avatar vem de
// NOME_ACESSIVEL_MENU_USUARIO (lib/acessibilidade/rotulos.ts, reexportado por
// cabecalho-movel.tsx) — nunca redigitados aqui.
// Uma acentuação redigitada à mão pode normalizar de forma Unicode diferente da string que a
// interface realmente usa (NFC x NFD), produzindo uma falha que não tem nada a ver com o
// comportamento real da aplicação. Importar a mesma constante elimina essa classe de erro.
async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Mesmo princípio de tests/e2e/casca.spec.ts e tests/e2e/sessao.spec.ts: escolher o elemento
// certo pela visibilidade real (a barra lateral e a barra inferior SEMPRE coexistem no DOM;
// só o CSS decide qual fica visível por breakpoint), nunca ramificando por
// `testInfo.project.name`.
async function localizarGatilhoDoMenu(page: Page): Promise<Locator> {
  const gatilhoCelular = page.getByRole("button", { name: NOME_ACESSIVEL_MENU_USUARIO });
  if (await gatilhoCelular.isVisible().catch(() => false)) {
    return gatilhoCelular;
  }
  return page.locator('[data-slot="sidebar-footer"] button').first();
}

// Rotas auditadas pela varredura de contraste e pela verificação de rolagem horizontal — as
// seis rotas protegidas da casca mais /login (a única rota pública). Mesma lista de sete
// rotas que tests/e2e/casca.spec.ts já usa para UI-06 nas telas do plano 03; repetida aqui
// porque UI-06 é reconferido sobre a fase inteira (a intenção explícita desta tarefa), não
// porque o conjunto de rotas mudou.
//
// 03-08-PLAN.md (Tarefa 2, fechamento da fase) acrescenta as três telas novas desta fase que
// ainda não tinham entrado aqui: o formulário aberto (`?nova`, Dialog/Sheet do plano 06) e a
// folha de impressão (`/encomendas/imprimir`, D-18/ENC-14 do plano 08). Mesmas
// `REGRAS_AUDITADAS` de sempre — nenhuma regra nova, nenhuma afrouxada.
const ROTAS_DA_FASE = [
  "/login",
  "/",
  "/encomendas",
  "/encomendas?nova",
  "/encomendas/imprimir",
  "/agenda",
  "/queimas",
  "/estoque",
  "/orcamentos",
] as const;

// Regras às quais esta fase se compromete — restringir com withRules é escolha deliberada
// (ver 02b-05-PLAN.md): uma varredura completa do axe-core traria achados de estrutura de
// documento (landmark, heading hierárquico, etc.) que pertencem à revisão da Fase 7, e um
// teste que falha por algo fora do escopo declarado é um teste que alguém acaba desligando.
const REGRAS_AUDITADAS = ["color-contrast", "button-name", "link-name", "aria-allowed-attr"];

async function irParaRotaAutenticada(page: Page, rota: (typeof ROTAS_DA_FASE)[number]) {
  if (rota === "/login") {
    await page.goto("/login");
    return;
  }
  await fazerLogin(page);
  if (rota !== "/") {
    await page.goto(rota);
  }
}

test.describe("acessibilidade — alvos de toque, nome acessível (UI-09)", () => {
  test.describe.configure({ mode: "serial" });

  test("cada item da barra inferior mede pelo menos 44px de altura e largura no celular (UI-09)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const barraInferior = page.getByRole("navigation", { name: "Navegação principal" });
    if (!(await barraInferior.isVisible())) {
      // Projeto desktop: a barra inferior não é renderizada visível neste breakpoint — nada a
      // medir aqui, a barra lateral tem o próprio teste abaixo.
      return;
    }

    for (const item of ITENS_NAVEGACAO) {
      const link = barraInferior.getByRole("link", { name: item.rotulo });
      const caixa = await link.boundingBox();
      expect(caixa?.height, `item "${item.rotulo}" da barra inferior`).toBeGreaterThanOrEqual(44);
      expect(caixa?.width, `item "${item.rotulo}" da barra inferior`).toBeGreaterThanOrEqual(44);
    }
  });

  test("o botão de avatar do cabeçalho móvel tem alvo de toque de pelo menos 44px (UI-09)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const avatar = page.getByRole("button", { name: NOME_ACESSIVEL_MENU_USUARIO });
    if (!(await avatar.isVisible().catch(() => false))) {
      // Projeto desktop: o cabeçalho móvel não existe neste breakpoint.
      return;
    }

    const caixa = await avatar.boundingBox();
    expect(caixa?.height).toBeGreaterThanOrEqual(44);
    expect(caixa?.width).toBeGreaterThanOrEqual(44);
  });

  test("getByRole('button', { name: 'Abrir menu do usuário' }) encontra exatamente um elemento no celular (UI-09)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const avatar = page.getByRole("button", { name: NOME_ACESSIVEL_MENU_USUARIO });
    if (!(await avatar.isVisible().catch(() => false))) {
      // Projeto desktop: o botão não existe (display: none tira o elemento da árvore de
      // acessibilidade) — nada a contar aqui, o requisito é só sobre o celular.
      return;
    }

    await expect(avatar).toHaveCount(1);
  });

  test("cada item da barra lateral mede pelo menos 44px de altura no desktop (UI-09)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const barraLateral = page.locator('[data-slot="sidebar"]');
    if (!(await barraLateral.isVisible())) {
      // Projeto celular: a barra lateral não é renderizada visível neste breakpoint.
      return;
    }

    for (const item of ITENS_NAVEGACAO) {
      const link = barraLateral.getByRole("link", { name: item.rotulo });
      const caixa = await link.boundingBox();
      expect(caixa?.height, `item "${item.rotulo}" da barra lateral`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("acessibilidade — navegação por teclado (UI-09)", () => {
  test.describe.configure({ mode: "serial" });

  test("dá para chegar do e-mail até 'Entrar' e logar usando só Tab e Enter, sem mouse (UI-09)", async ({
    page,
  }) => {
    await page.goto("/login");

    // Começa do <body> — nenhum clique, nenhum foco programático antes do primeiro Tab.
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("E-mail")).toBeFocused();
    await page.keyboard.type(process.env.E2E_EMAIL_TESTE ?? "");

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Senha")).toBeFocused();
    await page.keyboard.type(process.env.E2E_SENHA_TESTE ?? "");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
  });

  test("depois de logado, dá para chegar ao menu do usuário e abri-lo usando só o teclado (UI-09)", async ({
    page,
  }) => {
    await fazerLogin(page);

    const gatilho = await localizarGatilhoDoMenu(page);

    // "Uma sequência de Tab" — não um número fixo de toques: a posição do gatilho na ordem de
    // tabulação difere entre celular (primeiro elemento focável da página, o próprio avatar) e
    // desktop (depois dos 5 links da barra lateral). Um limite generoso de tentativas cobre os
    // dois sem ramificar por nome de projeto.
    let alcancado = false;
    for (let tentativa = 0; tentativa < 15 && !alcancado; tentativa++) {
      await page.keyboard.press("Tab");
      alcancado = await gatilho.evaluate((elemento) => elemento === document.activeElement);
    }
    expect(alcancado, "o gatilho do menu do usuário nunca recebeu foco por Tab").toBe(true);

    await page.keyboard.press("Enter");

    // Nas duas variantes (Sheet no celular, DropdownMenu no desktop) o item "Sair" fica
    // acessível por papel de botão assim que o menu abre — ver menu-usuario.tsx.
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  });
});

test.describe("acessibilidade — varredura de contraste com axe-core (UI-09)", () => {
  test.describe.configure({ mode: "serial" });

  for (const rota of ROTAS_DA_FASE) {
    test(`${rota} não tem violação de color-contrast, button-name, link-name ou aria-allowed-attr (UI-09)`, async ({
      page,
    }) => {
      await irParaRotaAutenticada(page, rota);

      const resultado = await new AxeBuilder({ page }).withRules(REGRAS_AUDITADAS).analyze();

      // Nenhuma violação some por lista de regras a ignorar ou recorte de seletor — se aparecer
      // aqui, é achado real (corrigir a interface) ou registro por escrito no SUMMARY com o
      // motivo (nunca as duas coisas ao mesmo tempo em silêncio).
      expect(
        resultado.violations,
        resultado.violations
          .map((violacao) => `${violacao.id}: ${violacao.help} (${violacao.nodes.length} nó(s))`)
          .join("\n"),
      ).toEqual([]);
    });
  }
});

test.describe("acessibilidade — sem rolagem horizontal a 320px (UI-06, reconferido)", () => {
  test.describe.configure({ mode: "serial" });

  test("nenhuma das rotas da fase exige rolagem horizontal a 320px de largura (UI-06)", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });

    for (const rota of ROTAS_DA_FASE) {
      await page.goto(rota === "/login" ? "/login" : rota);

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
});

// Backstop de UI-SPEC ("long-text E2, E3 — nome do usuário no menu e no rodapé da lateral"),
// registrado como `verification: backstop` no frontmatter do plano por não ter conta de teste
// com nome longo até agora. Convertido aqui numa asserção real: cria uma conta de verdade com
// nome longo via scripts/criar-usuario.ts (o mesmo script que qualquer gestor roda no
// servidor), loga com ela, mede o truncamento por CSS computado (não por "parece cortado na
// tela") e desativa a conta ao final — nunca apaga a linha (scripts/desativar-usuario.ts).
// E-mail exclusivo por projeto do Playwright para não colidir entre desktop e celular rodando
// em paralelo (mesmo cuidado de tests/e2e/autenticacao.spec.ts para o e-mail de bloqueio).
test.describe("acessibilidade — truncamento de nome longo (backstop do 02b-UI-SPEC.md)", () => {
  test.describe.configure({ mode: "serial" });

  test("nome de usuário longo trunca em uma linha com reticências, mostra o nome completo em title e não empurra a barra lateral de 240px", async ({
    page,
  }, testInfo) => {
    // 53 caracteres — mais longo que o exemplo de 43 caracteres do checklist humano (Tarefa 3
    // do plano) de propósito: a 43 caracteres o texto cabe justo dentro do Sheet do celular
    // (achado medindo de verdade, não presumindo) e não prova truncamento nesse viewport.
    const nomeLongo = "Maria Aparecida dos Santos Nascimento Silva Conceição";
    const emailLongo = `nome-longo.${testInfo.project.name}@exemplo.test`;
    const opcoesExecucao = {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
      encoding: "utf-8" as const,
    };

    const saidaCriacao = execSync(
      `npm run criar-usuario -- --nome "${nomeLongo}" --email "${emailLongo}"`,
      opcoesExecucao,
    );
    const linhaSenha = saidaCriacao.split("\n").find((linha) => linha.startsWith("SENHA: "));
    if (!linhaSenha) {
      throw new Error(
        "scripts/criar-usuario.ts não imprimiu a linha 'SENHA: ' esperada — a conta de nome longo não foi criada como esperado.",
      );
    }
    const senhaLonga = linhaSenha.slice("SENHA: ".length).trim();

    try {
      await page.goto("/login");
      await page.getByLabel("E-mail").fill(emailLongo);
      await page.getByLabel("Senha").fill(senhaLonga);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/$/);

      const avatarCelular = page.getByRole("button", { name: NOME_ACESSIVEL_MENU_USUARIO });
      const estaNoCelular = await avatarCelular.isVisible().catch(() => false);

      let elementoNome: Locator;
      if (estaNoCelular) {
        // No celular o nome só aparece depois de abrir o Sheet (SheetTitle em
        // menu-usuario.tsx, um <h2> do Radix Dialog.Title). Escopado por papel de heading —
        // a barra lateral (sempre no DOM, só oculta por CSS neste breakpoint) também tem o
        // mesmo nome em texto solto, e getByText sozinho encontraria os dois.
        await avatarCelular.click();
        elementoNome = page.getByRole("heading", { name: nomeLongo, level: 2 });
      } else {
        // No desktop o nome já está visível no gatilho do rodapé da barra lateral, sem
        // precisar abrir o DropdownMenu.
        elementoNome = page.locator('[data-slot="sidebar-footer"] button span[title]').first();

        const barraLateral = page.locator('[data-slot="sidebar"]');
        const caixaLateral = await barraLateral.boundingBox();
        expect(
          caixaLateral?.width,
          "o nome longo empurrou a largura da barra lateral para além dos 240px fixos",
        ).toBe(240);
      }

      await expect(elementoNome).toBeVisible();
      await expect(elementoNome).toHaveAttribute("title", nomeLongo);

      const medida = await elementoNome.evaluate((elemento) => ({
        scrollWidth: elemento.scrollWidth,
        clientWidth: elemento.clientWidth,
        textOverflow: getComputedStyle(elemento).textOverflow,
        whiteSpace: getComputedStyle(elemento).whiteSpace,
      }));

      expect(
        medida.scrollWidth,
        "o nome completo coube sem cortar — o teste não provou o truncamento (layout mudou ou nome curto demais)",
      ).toBeGreaterThan(medida.clientWidth);
      expect(medida.textOverflow).toBe("ellipsis");
      expect(medida.whiteSpace).toBe("nowrap");
    } finally {
      // Desativa sempre, mesmo se alguma asserção acima falhar — nunca deixa a conta de teste
      // ativa no banco.
      execSync(`npm run desativar-usuario -- --email "${emailLongo}"`, opcoesExecucao);
    }
  });
});

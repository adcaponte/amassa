import { test, expect, type Page } from "@playwright/test";

import { FRASE_VAZIO_CORPO, FRASE_VAZIO_TITULO, ROTULO_NOVO_ITEM } from "@/lib/abertura/textos";

// O traçado ponta a ponta do módulo Abertura do Espaço (04.2-01-PLAN.md, Tarefas 2 e 4): das
// três tabelas até um item cadastrado pela tela aparecendo agrupado por categoria, com as
// parcelas calculadas (nunca gravadas — D-05) e alcançável pelo menu do usuário. Dois itens em
// categorias diferentes, um a prazo e um à vista, e a barra inferior do celular continua com
// cinco itens (T-02b-*, `lib/navegacao/itens.ts` não é tocado por esta fase). O primeiro teste
// afirma uma condição GLOBAL do banco ("nenhum item de abertura existe") e por isso é marcado
// `@vazio-global`, rodando na cadeia `vazio-celular → vazio-desktop` de `playwright.config.ts`,
// ANTES de qualquer teste que escreva — nunca isolado por `--grep` como muleta (mesma disciplina
// de `tests/e2e/queimas-tracador.spec.ts`/`tests/e2e/estados.spec.ts`).
//
// Nomes inventados e reconhecíveis como tal ("Bancada de trabalho 3m", "Estante de secagem") —
// nenhum dado de pessoa real em lugar nenhum, o repositório é público.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Mesmo par de locators de `tests/e2e/casca.spec.ts` (`abrirMenuDoUsuario`) — o gatilho do
// celular tem `aria-label` próprio (`NOME_ACESSIVEL_MENU_USUARIO`); o do desktop é o primeiro
// botão do rodapé da barra lateral (o nome do gestor, sem rótulo acessível fixo).
async function abrirMenuDoUsuario(page: Page) {
  const gatilhoCelular = page.getByRole("button", { name: "Abrir menu do usuário" });
  const gatilhoDesktop = page.locator('[data-slot="sidebar-footer"] button').first();

  if (await gatilhoCelular.isVisible()) {
    await gatilhoCelular.click();
  } else {
    await gatilhoDesktop.click();
  }
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Confere a CONSISTÊNCIA do cabeçalho de grupo ("N itens · R$ X") contra as próprias linhas
// renderizadas — nunca um valor absoluto fixo. As categorias são compartilhadas entre os
// projetos `desktop`/`celular`, que rodam em paralelo verdadeiro contra o MESMO banco de teste
// (mesma disciplina de CLAUDE.md "Teste não pode afirmar condição global do banco sem
// isolamento"): outro worker pode ter um item "Móveis" próprio no ar ao mesmo tempo. Verificar
// que a soma do cabeçalho bate com a soma das linhas de fato desenhadas prova a regra de D4
// (contagem e soma do grupo) sem depender de quantos itens concorrentes existem no momento.
async function verificarConsistenciaDoGrupo(page: Page, rotuloCategoria: string) {
  const grupo = page.getByTestId("abertura-grupo-categoria").filter({ hasText: rotuloCategoria });
  await expect(grupo).toBeVisible();

  const textoTotal = (await grupo.getByTestId("abertura-total-grupo").innerText()).trim();
  // A contagem e a soma vivem numa LINHA do cabecalho que hoje tem mais de uma: desde o
  // plano 04.2-03 o mesmo cabecalho tambem mostra "N nao chegou" (ABE-04, contagem de
  // entregas vencidas do grupo). Casar contra o texto INTEIRO com ancoras passou a falhar
  // por causa dessa segunda linha - por um campo NOVO e correto, nao por regressao.
  // Procuramos a linha do total dentro do texto, em vez de exigir que ela seja o texto todo.
  const PADRAO_DO_TOTAL = /^([0-9]+) +(?:item|itens) *· *R[$] *([0-9.]+)$/;
  const linhaDoTotal = textoTotal
    .split(String.fromCharCode(10))
    .map((linha) => linha.trim())
    .find((linha) => PADRAO_DO_TOTAL.test(linha));
  const casamento = linhaDoTotal ? PADRAO_DO_TOTAL.exec(linhaDoTotal) : null;
  if (!casamento) {
    throw new Error(`Formato inesperado do total do grupo "${rotuloCategoria}": "${textoTotal}"`);
  }
  const contagemDoCabecalho = Number(casamento[1]);
  const totalDoCabecalho = Number(casamento[2].replace(/\./g, ""));

  await expect(grupo.getByTestId("abertura-linha-item")).toHaveCount(contagemDoCabecalho);

  const valoresDasLinhas = await grupo.getByTestId("abertura-valor-item").allInnerTexts();
  const somaDasLinhas = valoresDasLinhas.reduce(
    (total, texto) => total + Number(texto.replace(/[^\d]/g, "")),
    0,
  );
  expect(somaDasLinhas).toBe(totalDoCabecalho);
}

test.describe("abertura tracador — traçado do módulo Abertura do Espaço", () => {
  test.describe.configure({ mode: "serial" });

  test("com o banco sem nenhum item, 'Nada aqui ainda.' aparece e o botão abre o formulário do primeiro item @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/abertura");

    const frase = page.getByRole("heading", { name: FRASE_VAZIO_TITULO, level: 2 });
    await expect(frase).toHaveCount(1);
    await expect(frase).toBeVisible();
    await expect(page.getByText(FRASE_VAZIO_CORPO)).toBeVisible();

    const botaoDoEstadoVazio = page
      .getByTestId("estado-vazio")
      .getByRole("link", { name: ROTULO_NOVO_ITEM });
    await expect(botaoDoEstadoVazio).toBeVisible();
    await expect(botaoDoEstadoVazio).not.toHaveAttribute("aria-disabled", "true");
    await expect(botaoDoEstadoVazio).toHaveAttribute("href", "/abertura?item=novo");

    // O botão precisa FUNCIONAR, abrindo o formulário do primeiríssimo item — não ser inerte
    // (achado do 03-06, replicado em Queimas e aqui).
    await botaoDoEstadoVazio.click();
    await expect(page).toHaveURL(/\?item=novo$/);
    await expect(page.getByRole("heading", { name: "Novo item" })).toBeVisible();
  });

  test("o módulo é alcançado pelo menu do usuário, e a barra inferior do celular continua com 5 itens", async ({
    page,
  }) => {
    await fazerLogin(page);

    // "Abertura do Espaço" não aparece na navegação principal (mesma prova de UI-04 para
    // Orçamentos, em `casca.spec.ts`) — só existe depois de abrir o menu do usuário.
    const itemAbertura = page
      .getByRole("link", { name: "Abertura do Espaço" })
      .or(page.getByRole("menuitem", { name: "Abertura do Espaço" }));
    await expect(itemAbertura).toHaveCount(0);

    await abrirMenuDoUsuario(page);
    await itemAbertura.click();

    await expect(page).toHaveURL(/\/abertura$/);
    await expect(page.getByRole("heading", { name: "Abertura do Espaço", level: 1 })).toBeVisible();

    // A barra inferior do celular continua com exatamente 5 itens — nenhum sexto item foi
    // acrescentado por este módulo temporário (`lib/navegacao/itens.ts` intocado).
    if (test.info().project.name === "celular") {
      const barraInferior = page.getByRole("navigation", { name: "Navegação principal" });
      await expect(barraInferior.getByRole("link")).toHaveCount(5);
    }
  });

  test("um item a prazo e um item à vista, em categorias diferentes, aparecem agrupados com parcela e soma do grupo", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomePrazo = nomeUnico("Bancada de trabalho 3m");
    const nomeVista = nomeUnico("Estante de secagem");

    // Item a prazo — Móveis, 6 parcelas de 10 dias a partir de hoje.
    await page.goto("/abertura?item=novo");
    await page.getByLabel("O que é").fill(nomePrazo);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Móveis" }).click();
    await page.getByLabel("Valor total").fill("9800");
    await page.getByRole("combobox", { name: "Pagamento" }).click();
    await page.getByRole("option", { name: "A prazo" }).click();
    await page.getByLabel("Em quantas vezes").fill("6");
    await page.getByRole("button", { name: "Adicionar item" }).click();

    await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });

    // Item à vista — Equipamentos, sem entrega prevista.
    await page.goto("/abertura?item=novo");
    await page.getByLabel("O que é").fill(nomeVista);
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: "Equipamentos" }).click();
    await page.getByLabel("Valor total").fill("2100");
    // Pagamento já nasce "À vista" — o campo "Em quantas vezes" não aparece (D-05/D-06).
    await expect(page.getByLabel("Em quantas vezes")).toHaveCount(0);
    await page.getByRole("button", { name: "Adicionar item" }).click();

    await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });

    // Dois cabeçalhos de grupo, cada um com contagem e soma do grupo.
    const linhaPrazo = page.getByTestId("abertura-linha-item").filter({ hasText: nomePrazo });
    const linhaVista = page.getByTestId("abertura-linha-item").filter({ hasText: nomeVista });
    await expect(linhaPrazo).toBeVisible();
    await expect(linhaVista).toBeVisible();

    // A linha a prazo mostra 6× R$ 1.633 (9800/6, arredondado) e a etiqueta "a prazo".
    await expect(linhaPrazo).toContainText("a prazo");
    await expect(linhaPrazo.getByTestId("abertura-parcela").first()).toContainText("6×");
    await expect(linhaPrazo.getByTestId("abertura-parcela").first()).toContainText("R$ 1.633");

    // A linha à vista mostra a etiqueta "à vista" e uma data só (sem "×").
    await expect(linhaVista).toContainText("à vista");
    await expect(linhaVista.getByTestId("abertura-parcela").first()).not.toContainText("×");

    // Nenhuma etiqueta "chega" nas duas — nenhum item preencheu a entrega prevista (D-04).
    await expect(linhaPrazo).not.toContainText("chega");
    await expect(linhaVista).not.toContainText("chega");

    // Os cabeçalhos de grupo mostram contagem e soma — conferido contra as próprias linhas
    // desenhadas, não contra um valor absoluto (outro worker pode ter item próprio na mesma
    // categoria ao mesmo tempo).
    await verificarConsistenciaDoGrupo(page, "Móveis");
    await verificarConsistenciaDoGrupo(page, "Equipamentos");

    // Sobrevive a um recarregamento — a mesma prova contra perda silenciosa de
    // `queimas-tracador.spec.ts`.
    await page.reload();
    await expect(page.getByTestId("abertura-linha-item").filter({ hasText: nomePrazo })).toBeVisible();
    await expect(page.getByTestId("abertura-linha-item").filter({ hasText: nomeVista })).toBeVisible();
  });

  test("um item salvo sem preencher a entrega grava entrega_prevista_em nulo e não mostra etiqueta de chegada", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Prateleiras de parede");

    await page.goto("/abertura?item=novo");
    await page.getByLabel("O que é").fill(nome);
    await page.getByLabel("Valor total").fill("1500");
    // "Chega em (opcional)" permanece em branco de propósito.
    await page.getByRole("button", { name: "Adicionar item" }).click();

    await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });

    const linha = page.getByTestId("abertura-linha-item").filter({ hasText: nome });
    await expect(linha).toBeVisible();
    await expect(linha).not.toContainText("chega");
  });

  // Acessibilidade da tela (UI-SPEC §"Acessibilidade"): campos do formulário com no mínimo
  // 44px de altura, e nenhuma rolagem horizontal no viewport do celular (UI-06).
  test("os campos do formulário têm no mínimo 44px de altura", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/abertura?item=novo");

    for (const rotulo of ["O que é", "Valor total"]) {
      const caixa = await page.getByLabel(rotulo).boundingBox();
      expect(caixa?.height, `campo "${rotulo}" mede menos que 44px`).toBeGreaterThanOrEqual(44);
    }

    const caixaCategoria = await page.getByRole("combobox", { name: "Categoria" }).boundingBox();
    expect(caixaCategoria?.height).toBeGreaterThanOrEqual(44);

    const caixaPagamento = await page.getByRole("combobox", { name: "Pagamento" }).boundingBox();
    expect(caixaPagamento?.height).toBeGreaterThanOrEqual(44);
  });

  test("a 320px de largura, /abertura não exige rolagem horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/abertura");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/abertura rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

import { test, expect, type Page, type Locator } from "@playwright/test";

// O traçado ponta a ponta de Cadastros (04.4-02-PLAN.md, Tarefa 3): da barra do Financeiro até
// `/cadastros`, as quatro sub-abas, e Categorias/Taxas funcionando de verdade — criar, editar,
// travar por uso, desativar/reativar (nunca apagar) e a taxa da maquininha. Nomes inventados e
// reconhecíveis como tal ("[e2e] ..."), nenhuma afirmação GLOBAL do banco (CLAUDE.md: "Teste não
// pode afirmar condição global do banco sem isolamento") — a lista de categorias sempre tem pelo
// menos a semente da migração 0016 ("Juros, multas e descontos" e as demais), e a categoria
// criada por este teste usa um nome único por execução.
//
// REGRA DA TAXA (configuração global, lida também pelo plano 06 — o cartão): todo teste desta
// suíte que ESCREVE a taxa do cartão escreve SEMPRE o mesmo valor, 3,5% — a "taxa de teste".
// Nenhum teste, aqui ou em qualquer spec futuro, grava um valor diferente que fique persistido —
// assim a ordem de execução entre testes paralelos nunca muda o resultado de nenhum. Este teste
// testa a RECUSA acima de 30% (envia "31" e confere que o valor gravado continua 3,5, nunca que
// "31" foi salvo).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// O bloco de um grupo é o container que tem, como descendente, o `h3` com o rótulo do grupo —
// localizar por essa relação evita casar com o `h3` de outro grupo que por acaso contém um
// pedaço do mesmo texto.
function blocoDoGrupo(page: Page, rotuloGrupo: string): Locator {
  return page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: rotuloGrupo, level: 3 }) })
    .last();
}

test.describe("cadastros base — a casa dos Cadastros e as regras de Categorias/Taxas", () => {
  test.describe.configure({ mode: "serial" });

  test("Financeiro → pílula Cadastros → /cadastros com as quatro sub-abas e a barra do Financeiro no topo", async ({
    page,
  }) => {
    await fazerLogin(page);

    await page.goto("/financeiro");
    await page.getByTestId("financeiro-aba-cadastros").click();

    await expect(page).toHaveURL(/\/cadastros$/);
    await expect(page.getByRole("heading", { name: "Cadastros", level: 1 })).toBeVisible();

    // A MESMA barra do Financeiro aparece no topo (D-06) — "Cadastros" selecionada, "Venda"
    // continua alcançável sem passar pelo menu do usuário.
    await expect(page.getByTestId("financeiro-aba-cadastros")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("financeiro-aba-venda")).toBeVisible();

    // As quatro sub-abas.
    await expect(page.getByTestId("cadastros-sub-catalogo")).toBeVisible();
    await expect(page.getByTestId("cadastros-sub-categorias")).toBeVisible();
    await expect(page.getByTestId("cadastros-sub-fixas")).toBeVisible();
    await expect(page.getByTestId("cadastros-sub-taxas")).toBeVisible();
  });

  test("Categorias: a semente mostra 'Juros, multas e descontos' no grupo Geral; criar, nome repetido recusado, editar nome, trocar grupo sem uso, desativar e reativar", async ({
    page,
  }) => {
    await fazerLogin(page);

    await page.goto("/cadastros?sub=categorias");
    await expect(
      blocoDoGrupo(page, "Geral (custos da casa)").getByText("Juros, multas e descontos"),
    ).toBeVisible();

    // Cria uma categoria de receita da Loja.
    const nomeCriada = nomeUnico("Categoria de teste");

    await page.getByTestId("nova-categoria").click();
    await expect(page.getByRole("heading", { name: "Nova categoria" })).toBeVisible();
    await page.getByLabel("Nome").fill(nomeCriada);
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Receitas" }).click();
    await page.getByRole("combobox", { name: "Área" }).click();
    await page.getByRole("option", { name: "Loja" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=categorias$/);

    const linhaCriada = page.getByTestId("categoria-linha").filter({ hasText: nomeCriada });
    await expect(linhaCriada).toBeVisible();
    await expect(linhaCriada).toContainText("Loja");
    await expect(linhaCriada.getByTestId("categoria-uso")).toHaveText("0 lançamento(s)");
    await expect(blocoDoGrupo(page, "Receitas").getByText(nomeCriada)).toBeVisible();

    // Tenta criar outra com o mesmo nome em maiúsculas — o índice único (case-insensitive)
    // recusa, não o cliente.
    await page.getByTestId("nova-categoria").click();
    await page.getByLabel("Nome").fill(nomeCriada.toUpperCase());
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Já existe uma categoria com esse nome.")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // Edita o nome.
    const nomeEditado = `${nomeCriada} editado`;
    await linhaCriada.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar categoria" })).toBeVisible();
    await page.getByLabel("Nome").fill(nomeEditado);
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=categorias$/);
    const linhaEditada = page.getByTestId("categoria-linha").filter({ hasText: nomeEditado });
    await expect(linhaEditada).toBeVisible();

    // Troca o grupo para Custos e salva — sem uso (0 lançamentos, 0 itens, 0 contas fixas), a
    // troca passa.
    await linhaEditada.getByRole("button", { name: "Editar" }).click();
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Custos diretos de uma área" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=categorias$/);
    await expect(
      blocoDoGrupo(page, "Custos diretos de uma área").getByText(nomeEditado),
    ).toBeVisible();

    // Desativa — sem AlertDialog de confirmação (reversível): risca a linha e mostra o aviso.
    // NUNCA `toHaveURL(/aviso=.../)` — o aviso é limpo da URL por `history.replaceState` no mesmo
    // instante em que o toast aparece (mesma classe de achado real documentada em
    // `04.4-03-SUMMARY.md`/`04.4-08-SUMMARY.md`: asserção de URL transiente perde a corrida sob a
    // suíte inteira). O TOAST é o sinal real de que a navegação de sucesso terminou.
    const linhaFinal = page.getByTestId("categoria-linha").filter({ hasText: nomeEditado });
    await linhaFinal.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Categoria desativada.")).toBeVisible();
    await expect(linhaFinal.locator("span", { hasText: nomeEditado })).toHaveClass(
      /line-through/,
    );

    // Reativa.
    await linhaFinal.getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("Categoria reativada.")).toBeVisible();
    await expect(linhaFinal.locator("span", { hasText: nomeEditado })).not.toHaveClass(
      /line-through/,
    );
  });

  test("ao escolher 'Geral (custos da casa)' no diálogo, a área mostra 'Geral' fixo, sem seletor", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/cadastros?sub=categorias");

    await page.getByTestId("nova-categoria").click();
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Geral (custos da casa)" }).click();

    await expect(page.getByText("Geral", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Área" })).toHaveCount(0);

    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("Taxas: grava 3,5%, sobrevive a recarregar, e recusa acima de 30% sem alterar o valor gravado", async ({
    page,
  }) => {
    await fazerLogin(page);

    await page.goto("/cadastros?sub=taxas");
    await expect(page.getByRole("heading", { name: "Taxa do cartão" })).toBeVisible();

    await page.getByTestId("taxa-campo").fill("3,5");
    await page.getByRole("button", { name: "Salvar taxa" }).click();

    await expect(page).toHaveURL(/\/cadastros\?sub=taxas$/);
    await expect(page.getByTestId("taxa-campo")).toHaveValue("3,5");
    // "Salvar taxa" navega de verdade (`window.location.assign`) — a asserção de valor acima
    // passa só com o HTML da renderização no servidor, antes de o React hidratar e anexar o
    // `onSubmit`. Sem esperar a rede ficar ociosa aqui, o próximo clique corre o risco do mesmo
    // "clique perdido por hidratação" já documentado em `tests/e2e/encomendas-filtros.spec.ts`
    // (achado real DESTA execução: sem a espera, o segundo envio virou submissão nativa do
    // `<form>` — sem `preventDefault` — porque o clique chegou antes do `onSubmit` estar
    // anexado, navegando de verdade em vez de rodar a Server Action).
    await page.waitForLoadState("networkidle");

    await page.getByTestId("taxa-campo").fill("31");
    await page.getByRole("button", { name: "Salvar taxa" }).click();
    await expect(
      page.getByText("Confira: uma taxa acima de 30% não parece de maquininha."),
    ).toBeVisible();

    // O valor gravado no banco continua 3,5 — a tentativa de "31" nunca chegou a persistir.
    await page.reload();
    await expect(page.getByTestId("taxa-campo")).toHaveValue("3,5");
  });

  test("a 320px de largura, /cadastros?sub=categorias não exige rolagem horizontal", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/cadastros?sub=categorias");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/cadastros?sub=categorias rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

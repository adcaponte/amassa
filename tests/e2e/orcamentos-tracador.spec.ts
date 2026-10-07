import { test, expect, type Page } from "@playwright/test";

import { FRASE_VAZIO_CORPO, FRASE_VAZIO_TITULO, ROTULO_NOVO_ORCAMENTO } from "@/lib/orcamentos/textos";

import { medirCaixa } from "./apoio/medir-caixa";
import { criarOrcamentoPelaTela } from "./apoio/novo-orcamento";

// O traçador do módulo Orçamentos (04.5-01-PLAN.md, Tarefa 4): schema novo, cálculo puro, aba
// nova dentro do Financeiro, e "Novo orçamento" gravando um rascunho que aparece na lista como
// `nº ORC-2026-001` — de ponta a ponta, num caminho só.
//
// O primeiro teste afirma uma condição GLOBAL do banco ("nenhum orçamento existe") e por isso é
// marcado `@vazio-global`, rodando na cadeia `vazio-celular → vazio-desktop` de
// `playwright.config.ts`, ANTES de qualquer teste que escreva — nunca isolado por `--grep` como
// muleta (mesma disciplina de `tests/e2e/abertura-tracador.spec.ts`).

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

test.describe("orcamentos tracador — traçado do módulo Orçamentos", () => {
  test("com o banco sem nenhum orçamento, a aba mostra o vazio e o botão 'Novo orçamento' — só leitura @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=orcamentos");

    await expect(page.getByRole("heading", { name: FRASE_VAZIO_TITULO, level: 2 })).toBeVisible();
    await expect(page.getByText(FRASE_VAZIO_CORPO)).toBeVisible();

    // Desde o 06.5-14 (D-15) “Novo orçamento” é um link para o orçamento vazio, não um botão que
    // grava.
    const botao = page
      .getByTestId("orcamentos-lista")
      .getByRole("link", { name: ROTULO_NOVO_ORCAMENTO });
    await expect(botao).toBeVisible();
    // Este caso é SÓ LEITURA — nenhum clique, nenhuma gravação. A criação de verdade é o caso
    // seguinte, fora da cadeia @vazio-global.
  });

  test("'Novo orçamento' leva ao orçamento criado, com um número ORC-AAAA-NNN na lista", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Desde o 06.5-14 (D-15) o rascunho nasce no primeiro campo preenchido (`OrcamentoNovo`), não
    // no toque do botão: o auxiliar toca “Novo orçamento”, preenche o Cliente e espera o editor do
    // orçamento criado (navegação COMPLETA para `…&orcamento=<id>`).
    const cliente = `[e2e] Cliente do traçador ${test.info().project.name}-${Date.now()}`;
    await criarOrcamentoPelaTela(page, cliente);

    // O número já vem pronto no primeiro carregamento — sem nenhum estado intermediário "sem
    // número ainda" (04.5-UI-SPEC.md, seção "Numeração").
    await expect(page.getByTestId("orcamento-numero")).toHaveText(/^nº ORC-\d{4}-\d{3}$/);

    // E na lista, pela linha deste cliente — outro worker cria orçamentos ao mesmo tempo, então
    // nunca um valor absoluto fixo nem "o primeiro da lista".
    await page.goto("/gestao/financeiro?aba=orcamentos");
    const linha = page.getByTestId("orcamento-linha").filter({ hasText: cliente });
    await expect(linha).toHaveCount(1);
    await expect(linha.getByTestId("orcamento-numero")).toHaveText(/^nº ORC-\d{4}-\d{3}$/);
  });

  test("a 320px, a aba não rola na horizontal e as sete pílulas do Financeiro estão em duas fileiras", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/gestao/financeiro?aba=orcamentos");
    // O conteúdo real, não o esqueleto do `loading.tsx` (o streaming): medir antes media o vazio.
    await expect(page.getByTestId("orcamentos-lista")).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/gestao/financeiro?aba=orcamentos rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    // A quebra em duas fileiras é determinística (espaçador `basis-full`, não o navegador) — a
    // pílula "Venda" (fileira 1) e a pílula "Orçamentos" (fileira 2) têm posições verticais
    // diferentes em QUALQUER largura de tela, inclusive 320px.
    const caixaVenda = await medirCaixa(page.getByTestId("financeiro-aba-venda"), "pílula Venda");
    const caixaOrcamentos = await medirCaixa(
      page.getByTestId("financeiro-aba-orcamentos"),
      "pílula Orçamentos",
    );
    expect(caixaVenda.y).not.toBe(caixaOrcamentos.y);
  });

  // 🔴 Defeito real, visto pelo dono num Android em 2026-09-27 (e a captura não deixava dúvida):
  // o cartão da lista punha nome, total, chip e "Abrir" numa fileira só. Os três da direita
  // comiam a largura, sobrava uma coluna de poucos pixels para o nome, e o `break-words` quebrava
  // o título UMA PALAVRA POR LINHA — "jogo de mesa" virava um cartão de seis linhas.
  //
  // `flex-wrap` não bastava: o nome tem `flex-1`, então ENCOLHE em vez de empurrar os outros para
  // baixo. Por isso o cartão agora é `flex-col` no celular e só vira fileira a partir de `sm:`.
  //
  // O teste afirma o que o defeito violava: com o cartão empilhado, o título ocupa a largura útil
  // do cartão, e não uma tira estreita. Medir a LARGURA do título é o que pega a regressão —
  // afirmar "não rola na horizontal" não pegava, porque o cartão espremido também não rolava.
  test("a 360px, o título do orçamento ocupa a largura do cartão em vez de quebrar palavra por palavra", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 360, height: 800 });

    const titulo = `Jogo de mesa para a prova de largura ${Date.now().toString(36)}`;

    // Desde o 06.5-14 (D-15) o orçamento nasce no primeiro campo preenchido — aqui, o próprio
    // título que o teste mede.
    await criarOrcamentoPelaTela(page, titulo, { campo: "titulo" });

    await page.goto("/gestao/financeiro?aba=orcamentos");
    const cartao = page.getByTestId("orcamento-linha").filter({ hasText: titulo });

    const caixaCartao = await medirCaixa(cartao, "cartão do orçamento");
    const caixaTitulo = await medirCaixa(
      cartao.getByText(titulo, { exact: true }),
      "título do orçamento",
    );

    // 70% da largura do cartão é folgado para "ocupa a largura" e apertado o bastante para
    // reprovar a tira de ~60px que o defeito produzia (menos de 20% do cartão).
    const proporcao = caixaTitulo.width / caixaCartao.width;
    expect(
      proporcao,
      `o título ocupa só ${(proporcao * 100).toFixed(0)}% da largura do cartão (${caixaTitulo.width}px de ${caixaCartao.width}px) — é o cartão espremido de volta`,
    ).toBeGreaterThan(0.7);

    // E a consequência que o dono viu: o cartão não pode ficar alto feito uma coluna.
    expect(
      caixaCartao.height,
      `o cartão mede ${caixaCartao.height}px de altura — o título deve estar quebrando palavra por palavra de novo`,
    ).toBeLessThan(200);


  });

  test("todo botão visível da aba Orçamentos mede ao menos 44px de altura", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=orcamentos");
    // O conteúdo real, não o esqueleto do `loading.tsx` (o streaming).
    await expect(page.getByTestId("orcamentos-lista")).toBeVisible();

    // Escopado a <main> — a casca ao redor (avatar/menu do usuário) tem seus próprios botões,
    // que não são o que este critério mede (mesmo padrão de tests/e2e/casca.spec.ts). Desde o
    // 06.5-14 (D-15) “Novo orçamento” é um link com a aparência do botão (`data-slot="button"`) —
    // continua sendo um alvo de toque, então entra na medida.
    const botoes = page.locator("main").locator('button, a[data-slot="button"]');
    const contagem = await botoes.count();
    expect(contagem).toBeGreaterThan(0);

    for (let indice = 0; indice < contagem; indice += 1) {
      const botao = botoes.nth(indice);
      if (await botao.isVisible()) {
        const caixa = await medirCaixa(botao, `botão ${indice}`);
        expect(caixa.height, `botão ${indice} mede menos que 44px`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

import { test, expect, type Page } from "@playwright/test";

import { fraseConfirmarRemoverCategoria } from "@/lib/cotacoes/textos";

// Categorias do Comparador de Compras (04.3-02-PLAN.md): sub-abas com contagem, criar/renomear
// pelo mesmo diálogo, remover com confirmação dizendo quantas cotações se perdem (D-15), e os
// três estados obrigatórios da aba (vazia, carregando, com erro). "cotacoes categorias" no título
// do bloco é o recorte usado pelo orçamento de e2e deste plano
// (`npm run test:e2e -- --grep "cotacoes categorias"`).
//
// O PRIMEIRO teste afirma uma condição GLOBAL do banco ("nenhuma categoria de cotação existe") e
// por isso é marcado `@vazio-global`, rodando na cadeia `vazio-celular → vazio-desktop` de
// `playwright.config.ts` — ANTES de qualquer teste que crie categoria (desta suíte e de
// `cotacoes-tracador.spec.ts`), nunca isolado por `--grep` como muleta (CLAUDE.md §Conventions).
// Os demais testes rodam em modo SERIAL, dentro dos projetos `desktop`/`celular`, e reaproveitam
// categorias entre si (nomes únicos) para não multiplicar chamadas de rede à toa.
//
// Nomes inventados e reconhecíveis como tal ("Fornos de Teste", "Moedor de Teste") — nenhum dado
// real de fornecedor em arquivo versionado (o repositório é público).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// O nome de categoria tem teto de 60 pontos de código (Zod + `check` do banco) — o envoltório
// fixo deste template já consome 35 deles ("[e2e] " + projeto + timestamp + sufixo aleatório),
// então `rotulo` precisa caber em ~25 caracteres. Um rótulo mais longo estoura o teto em
// silêncio: o diálogo mostra o erro de validação e NUNCA navega, e um teste que só espera a URL
// mudar trava até o timeout (achado real desta suíte, não suposição).
function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// As DUAS formas do mesmo dado (cartão <660px / linha ≥660px) convivem no DOM ao mesmo tempo,
// alternadas só por CSS — `filter({ visible: true })` é obrigatório (mesma disciplina de
// `cotacoes-tracador.spec.ts`).
function linhasOuCartoesVisiveis(page: Page) {
  return page
    .getByTestId("cotacoes-linha")
    .filter({ visible: true })
    .or(page.getByTestId("cotacoes-cartao").filter({ visible: true }));
}

async function criarCategoria(page: Page, nome: string, { porEnter = false } = {}) {
  await page.getByRole("link", { name: "+ Nova categoria" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova categoria" })).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill(nome);
  if (porEnter) {
    await page.getByLabel("Nome", { exact: true }).press("Enter");
  } else {
    await page.getByRole("button", { name: "Criar" }).click();
  }
  await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, { timeout: 10000 });
}

async function criarCotacao(page: Page, empresa: string) {
  await page.getByRole("link", { name: "+ Nova cotação" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeVisible();
  await page.getByLabel("Empresa").fill(empresa);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeHidden({ timeout: 10000 });
}

test.describe("cotacoes categorias — sub-abas, criar/renomear/remover categoria, estados vazios", () => {
  test.describe.configure({ mode: "serial" });

  test("com o banco sem nenhuma categoria de cotação, a aba convida a criar a primeira e o botão abre o diálogo de verdade @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/abertura?aba=cotacoes");

    const vazio = page.getByTestId("cotacoes-vazio-categorias");
    await expect(vazio).toBeVisible();
    await expect(vazio.getByRole("heading", { name: "Nenhuma categoria ainda.", level: 2 })).toBeVisible();
    await expect(
      vazio.getByText("Crie uma categoria para começar a comparar — fornos, torno, moedor de café…"),
    ).toBeVisible();

    const botao = vazio.getByRole("link", { name: "+ Nova categoria" });
    await expect(botao).toBeVisible();
    await expect(botao).not.toHaveAttribute("aria-disabled", "true");

    // O botão precisa FUNCIONAR, abrindo o diálogo de verdade — não ser inerte (achado do 03-06,
    // replicado em toda esta base).
    await botao.click();
    await expect(page.getByRole("heading", { name: "Nova categoria" })).toBeVisible();
  });

  test("três categorias aparecem como pílulas com contagem, a criada por Enter fica ativa, e a página não rola a 320px", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeA = nomeUnico("Fornos de Teste");
    const nomeB = nomeUnico("Torno de Teste");
    const nomeC = nomeUnico("Moedor de Teste");

    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeA);
    await criarCategoria(page, nomeB);
    // A terceira, submetida pela tecla Enter — sem clicar no botão "Criar".
    await criarCategoria(page, nomeC, { porEnter: true });

    const pilulaA = page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeA });
    const pilulaB = page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeB });
    const pilulaC = page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeC });
    await expect(pilulaA).toBeVisible();
    await expect(pilulaB).toBeVisible();
    await expect(pilulaC).toBeVisible();

    // A recém-criada (por Enter) fica ativa.
    await expect(pilulaC).toHaveAttribute("aria-selected", "true");

    // Contagem "0" visível em todas — nenhuma categoria ganhou cotação ainda.
    await expect(pilulaA.getByTestId("cotacoes-sub-aba-contagem")).toHaveText("0");
    await expect(pilulaB.getByTestId("cotacoes-sub-aba-contagem")).toHaveText("0");
    await expect(pilulaC.getByTestId("cotacoes-sub-aba-contagem")).toHaveText("0");

    // Duas cotações em A — a contagem da pílula bate com as linhas de fato desenhadas quando A
    // está ativa (consistência, nunca valor absoluto — os projetos desktop/celular rodam em
    // paralelo verdadeiro contra o mesmo banco).
    await pilulaA.click();
    await expect(page).toHaveURL(/&categoria=[0-9a-f-]+$/);
    const empresa1 = nomeUnico("Cerâmica Teste 1");
    const empresa2 = nomeUnico("Cerâmica Teste 2");
    await criarCotacao(page, empresa1);
    await criarCotacao(page, empresa2);

    // `criarCotacao` só espera o DIÁLOGO sumir — a navegação completa (`window.location.assign`)
    // que ele dispara continua em andamento nesse instante. `.count()` não tem espera automática
    // (ao contrário de `expect(...)`), então lemos a contagem só depois de a ÚLTIMA linha/cartão
    // criado estar de fato visível — sem isso, uma corrida rara lê o DOM ainda no meio do reload
    // e conta 0 linhas com a pílula já em "2" (achado real do próprio e2e, não um defeito do
    // app: a pílula e as linhas vêm do MESMO carregamento de servidor, nunca dessincronizadas
    // depois de estáveis).
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresa2 })).toBeVisible();

    const contagemTexto = await pilulaA.getByTestId("cotacoes-sub-aba-contagem").innerText();
    const linhasDesenhadas = await linhasOuCartoesVisiveis(page).count();
    expect(Number(contagemTexto)).toBe(linhasDesenhadas);

    // A pílula de editar tem alvo de 44px e rótulo acessível nomeando a categoria.
    const botaoEditar = page.getByTestId("cotacoes-editar-categoria");
    await expect(botaoEditar).toBeVisible();
    const caixaEditar = await botaoEditar.boundingBox();
    expect(caixaEditar?.height, "o botão de editar categoria mede menos que 44px").toBeGreaterThanOrEqual(44);
    expect(caixaEditar?.width, "o botão de editar categoria mede menos que 44px").toBeGreaterThanOrEqual(44);

    // A 320px, com três pílulas + editar + "+ Nova categoria", a página não rola na horizontal.
    await page.setViewportSize({ width: 320, height: 800 });
    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/abertura?aba=cotacoes rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test("renomear funciona pelo mesmo diálogo, com o nome atual preenchido, e o nome antigo desaparece por completo", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeAntigo = nomeUnico("Fornos Renomear");
    const nomeNovo = nomeUnico("Fornos Renomeado");

    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeAntigo);

    await page.getByTestId("cotacoes-editar-categoria").click();
    const dialogo = page.getByRole("heading", { name: "Editar categoria" });
    await expect(dialogo).toBeVisible();

    // O campo já vem preenchido com o nome atual.
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(nomeAntigo);

    await page.getByLabel("Nome", { exact: true }).fill(nomeNovo);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, { timeout: 10000 });

    // O nome antigo desaparece POR COMPLETO — não presumir que o novo contém o antigo como
    // pedaço (os dois vêm de sufixos aleatórios diferentes — lição do plano 04.2-03).
    await expect(page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeAntigo })).toHaveCount(0);
    const pilulaNova = page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeNovo });
    await expect(pilulaNova).toBeVisible();
    await expect(pilulaNova).toHaveAttribute("aria-selected", "true");
  });

  test("remover categoria pede confirmação com a contagem certa nos três casos, e cancelar mantém tudo intacto", async ({
    page,
  }) => {
    await fazerLogin(page);

    // --- Caso zero: categoria vazia ---
    const nomeVazia = nomeUnico("Categoria Vazia");
    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeVazia);

    await page.getByTestId("cotacoes-editar-categoria").click();
    await expect(page.getByRole("heading", { name: "Editar categoria" })).toBeVisible();
    await page.getByRole("button", { name: "Excluir categoria" }).click();

    const fraseZero = fraseConfirmarRemoverCategoria(nomeVazia, 0);
    await expect(page.getByText(fraseZero)).toBeVisible();

    // Cancelar mantém tudo intacto: a categoria continua lá.
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeVazia })).toBeVisible();

    // Reabre e confirma de verdade — a pílula desaparece.
    await page.getByTestId("cotacoes-editar-categoria").click();
    await page.getByRole("button", { name: "Excluir categoria" }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes(&categoria=[0-9a-f-]+)?$/, { timeout: 10000 });
    await expect(page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeVazia })).toHaveCount(0);

    // --- Caso um: uma cotação (singular) ---
    const nomeUma = nomeUnico("Categoria Uma Cotacao");
    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeUma);
    const empresaUnica = nomeUnico("Fornecedor Único");
    await criarCotacao(page, empresaUnica);

    await page.getByTestId("cotacoes-editar-categoria").click();
    await page.getByRole("button", { name: "Excluir categoria" }).click();
    const fraseUma = fraseConfirmarRemoverCategoria(nomeUma, 1);
    await expect(page.getByText(fraseUma)).toBeVisible();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes(&categoria=[0-9a-f-]+)?$/, { timeout: 10000 });

    // A pílula E a cotação dela desapareceram junto (a cascata da migração 0012).
    await expect(page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeUma })).toHaveCount(0);
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaUnica })).toHaveCount(0);

    // --- Caso muitas: duas cotações (plural com número) ---
    const nomeDuas = nomeUnico("Categoria Duas Cotacoes");
    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeDuas);
    const empresaX = nomeUnico("Fornecedor X");
    const empresaY = nomeUnico("Fornecedor Y");
    await criarCotacao(page, empresaX);
    await criarCotacao(page, empresaY);

    await page.getByTestId("cotacoes-editar-categoria").click();
    await page.getByRole("button", { name: "Excluir categoria" }).click();
    const fraseDuas = fraseConfirmarRemoverCategoria(nomeDuas, 2);
    await expect(page.getByText(fraseDuas)).toBeVisible();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes(&categoria=[0-9a-f-]+)?$/, { timeout: 10000 });

    await expect(page.getByTestId("cotacoes-sub-aba").filter({ hasText: nomeDuas })).toHaveCount(0);
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaX })).toHaveCount(0);
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaY })).toHaveCount(0);
  });

  test("com a categoria selecionada e sem cotação, a aba convida a adicionar a primeira, nomeando a categoria", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nome = nomeUnico("Categoria Sem Cotacao");
    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nome);

    const vazio = page.getByTestId("cotacoes-vazio-cotacoes");
    await expect(vazio).toBeVisible();
    await expect(vazio.getByRole("heading", { name: "Nenhuma cotação aqui ainda.", level: 2 })).toBeVisible();
    // O corpo nomeia a categoria em MINÚSCULAS (UI-SPEC §Copywriting Contract).
    await expect(vazio.getByText(`Adicione a primeira cotação de ${nome.toLowerCase()}.`)).toBeVisible();

    const botao = vazio.getByRole("link", { name: "+ Nova cotação" });
    await expect(botao).toBeVisible();
    await botao.click();
    await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeVisible();
  });

  test("um identificador malformado em ?categoriaDialogo= cai na fronteira de erro da rota, sem vazar detalhe técnico", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nome = nomeUnico("Categoria Erro");
    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nome);
    const urlComACategoria = page.url();

    // `categoriaDialogo` só aceita o sentinela "nova" ou um identificador de categoria — um valor
    // que não é nenhum dos dois faz `obterCategoriaDeCotacao` estourar no Postgres (uuid
    // malformado), sem estar protegido por try/catch na página: é a fronteira de erro da ROTA
    // (`app/(app)/abertura/error.tsx`) quem precisa pegar isso, não um código defensivo novo
    // dentro da página. Prova real, sem quebrar código de propósito para o teste.
    await page.goto(`${urlComACategoria}&categoriaDialogo=nao-e-um-uuid`);

    await expect(page.getByRole("heading", { name: "Algo não funcionou.", level: 2 })).toBeVisible();
    await expect(
      page.getByText("Não deu para carregar a abertura do espaço. Verifique a internet e tente de novo."),
    ).toBeVisible();
    const botaoTentarDeNovo = page.getByRole("button", { name: "Tentar de novo" });
    await expect(botaoTentarDeNovo).toBeVisible();

    // Nenhuma propriedade do erro (mensagem crua do Postgres, pilha, digest do Next.js) aparece
    // na tela — mesma disciplina de `tests/e2e/estados.spec.ts`.
    const corpo = await page.locator("body").innerText();
    expect(corpo).not.toMatch(/invalid input syntax/i);
    expect(corpo).not.toMatch(/stack/i);
    expect(corpo).not.toMatch(/digest/i);
    expect(corpo).not.toMatch(/at .+:\d+:\d+/);

    // "Tentar de novo" (`reset()`) refaz a MESMA renderização — com o `categoriaDialogo`
    // malformado ainda na URL, o erro se repete de propósito (não é um defeito: a tela não tem
    // como saber que o parâmetro é inválido sem consultar o banco de novo). Voltar para a URL
    // limpa (sem `categoriaDialogo=`) é o caminho real de recuperação, e prova que nada foi
    // corrompido: a categoria criada continua lá.
    await page.goto(urlComACategoria);
    await expect(page.getByTestId("cotacoes-sub-aba").filter({ hasText: nome })).toBeVisible({
      timeout: 10000,
    });
  });
});

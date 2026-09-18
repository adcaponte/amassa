import { test, expect, type Page, type Locator } from "@playwright/test";

// As três leituras que fazem o comparador comparar (04.3-04-PLAN.md): ordenar por preço com o
// sem preço no fim (Tarefa 1), abrir o detalhe completo de uma cotação (Tarefa 2), e ver duas ou
// mais lado a lado em colunas (Tarefa 3). "cotacoes comparar" no título do bloco é o recorte
// usado pelo orçamento de e2e deste plano (`npm run test:e2e -- --grep "cotacoes comparar"`).
//
// Modo SERIAL, categoria própria por teste (nomes únicos) — mesma disciplina de
// `cotacoes-ciclo.spec.ts`/`cotacoes-categorias.spec.ts`.
//
// Nomes inventados e reconhecíveis como tal — nenhum dado real de fornecedor em arquivo
// versionado (o repositório é público).

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Mesmo orçamento de caracteres documentado em `cotacoes-categorias.spec.ts`.
function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// As DUAS formas do mesmo dado (cartão <660px / linha ≥660px) convivem no DOM ao mesmo tempo,
// alternadas só por CSS — `filter({ visible: true })` é obrigatório (mesma disciplina das outras
// suítes desta fase).
function linhasOuCartoesVisiveis(page: Page): Locator {
  return page
    .getByTestId("cotacoes-linha")
    .filter({ visible: true })
    .or(page.getByTestId("cotacoes-cartao").filter({ visible: true }));
}

async function criarCategoria(page: Page, nome: string) {
  await page.getByRole("link", { name: "+ Nova categoria" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova categoria" })).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill(nome);
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, { timeout: 10000 });
}

type DadosDaCotacao = {
  empresa: string;
  produto?: string;
  preco?: string;
  situacao?: "cotando" | "favorito" | "descartado";
  alertas?: string;
};

async function criarCotacao(page: Page, dados: DadosDaCotacao) {
  await page.getByRole("link", { name: "+ Nova cotação" }).first().click();
  await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeVisible();
  await page.getByLabel("Empresa").fill(dados.empresa);
  if (dados.produto) {
    await page.getByLabel("Especificação do produto").fill(dados.produto);
  }
  if (dados.preco) {
    // `exact: true`: sem isto, o accessible name "Preço" bate por SUBSTRING (case-insensitive)
    // com "Preço sob consulta" (já visível na lista de uma cotação sem preço criada antes) e com
    // o `aria-label` do botão de ordenar ("Ordenado por: ... preço: menor primeiro."), tornando o
    // locator ambíguo assim que a categoria já tem mais de uma cotação — achado real desta
    // Tarefa, não suposição.
    await page.getByLabel("Preço", { exact: true }).fill(dados.preco);
  }
  if (dados.situacao) {
    await page.getByRole("button", { name: dados.situacao, exact: true }).click();
  }
  if (dados.alertas) {
    await page.getByLabel("Alertas", { exact: false }).fill(dados.alertas);
  }
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Nova cotação" })).toBeHidden({ timeout: 10000 });
}

// Confere que as linhas/cartões VISÍVEIS aparecem, NA ORDEM DADA, nomeando cada posição pelo
// próprio nome da empresa daquela categoria — nunca por posição absoluta na página (outros
// projetos do Playwright rodam em paralelo contra o mesmo banco).
async function verificarOrdemVisivel(page: Page, empresasNaOrdem: string[]) {
  const linhas = linhasOuCartoesVisiveis(page);
  await expect(linhas).toHaveCount(empresasNaOrdem.length);
  const textos = await linhas.allTextContents();
  for (let indice = 0; indice < empresasNaOrdem.length; indice++) {
    expect(
      textos[indice],
      `posição ${indice}: esperava a linha/cartão de «${empresasNaOrdem[indice]}», achou "${textos[indice]}"`,
    ).toContain(empresasNaOrdem[indice]);
  }
}

test.describe("cotacoes comparar — ordenar por preço, abrir detalhe, comparar lado a lado", () => {
  test.describe.configure({ mode: "serial" });

  test("ordenar por preço funciona nos dois sentidos, com a sem preço sempre no fim, sem navegar e sem perder a marcação", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeCategoria = nomeUnico("Categoria Ordenar");
    // Preços deliberadamente FORA da ordem de cadastro, com uma SEM preço no meio — o caso que
    // D-11 nomeia.
    const empresaD = nomeUnico("Fornecedor D 2000");
    const empresaSemPreco = nomeUnico("Fornecedor Sem Preco");
    const empresaB = nomeUnico("Fornecedor B 500");
    const empresaA = nomeUnico("Fornecedor A 1000");

    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeCategoria);
    await criarCotacao(page, { empresa: empresaD, preco: "2000" });
    await criarCotacao(page, { empresa: empresaSemPreco });
    await criarCotacao(page, { empresa: empresaB, preco: "500" });
    await criarCotacao(page, { empresa: empresaA, preco: "1000" });

    // Ordem PADRÃO (antes de qualquer toque em ordenar): ordem de cadastro.
    await verificarOrdemVisivel(page, [empresaD, empresaSemPreco, empresaB, empresaA]);

    const botaoOrdenar = page.getByTestId("cotacoes-ordenar");
    await expect(botaoOrdenar).toBeVisible();
    const caixaBotao = await botaoOrdenar.boundingBox();
    expect(caixaBotao?.height, "o botão de ordenar mede menos que 44px").toBeGreaterThanOrEqual(44);
    await expect(botaoOrdenar).toHaveAttribute("aria-label", /Ordenado por: ordem de cadastro/i);

    // Marca uma cotação ANTES de trocar a ordem — a prova de que ordenar não navega nem apaga a
    // marcação (D-23): a marcação é estado só de cliente.
    const caixaMarcarD = page.getByRole("checkbox", { name: `Marcar «${empresaD}» para comparar` });
    await caixaMarcarD.click();
    await expect(caixaMarcarD).toBeChecked();
    const urlAntesDeOrdenar = page.url();

    // Primeiro toque: crescente — as três com preço sobem, a sem preço fica por ÚLTIMO.
    await botaoOrdenar.click();
    await verificarOrdemVisivel(page, [empresaB, empresaA, empresaD, empresaSemPreco]);
    await expect(botaoOrdenar).toHaveAttribute("aria-label", /Ordenado por: preço: menor primeiro/i);

    // Nem a URL mudou, nem a marcação sumiu.
    expect(page.url()).toBe(urlAntesDeOrdenar);
    await expect(caixaMarcarD).toBeChecked();

    // Segundo toque: decrescente — as três invertem, a sem preço continua por ÚLTIMO (o caso que
    // um ordenamento ingênuo erra, D-11).
    await botaoOrdenar.click();
    await verificarOrdemVisivel(page, [empresaD, empresaA, empresaB, empresaSemPreco]);
    await expect(botaoOrdenar).toHaveAttribute("aria-label", /Ordenado por: preço: maior primeiro/i);
    expect(page.url()).toBe(urlAntesDeOrdenar);
    await expect(caixaMarcarD).toBeChecked();

    // Terceiro toque: volta à ordem de cadastro, fechando o ciclo de três estados.
    await botaoOrdenar.click();
    await verificarOrdemVisivel(page, [empresaD, empresaSemPreco, empresaB, empresaA]);
    await expect(botaoOrdenar).toHaveAttribute("aria-label", /Ordenado por: ordem de cadastro/i);
  });

  test("clicar na linha abre o detalhe completo, com o alerta destacado, e não abre ao marcar; editar leva ao formulário", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeCategoria = nomeUnico("Categoria Detalhe");
    const empresaComAlerta = nomeUnico("Fornecedor Alerta");
    const empresaSemAlerta = nomeUnico("Fornecedor Sem Alerta");

    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeCategoria);
    await criarCotacao(page, {
      empresa: empresaComAlerta,
      produto: "Forno 180L · 1300°C",
      preco: "24900",
      alertas: "Voltagem 380V.\nConfirmar se o espaço comporta.",
    });
    await criarCotacao(page, { empresa: empresaSemAlerta, preco: "19500" });

    // Acionar a caixa de marcação NÃO abre o detalhe (o evento para ali — elementos IRMÃOS, não
    // descendentes do controle que abre o detalhe).
    const linhaComAlerta = linhasOuCartoesVisiveis(page).filter({ hasText: empresaComAlerta });
    await linhaComAlerta.getByRole("checkbox", { name: `Marcar «${empresaComAlerta}» para comparar` }).click();
    await expect(page.getByTestId("cotacoes-detalhe")).toBeHidden();

    // Abre o detalhe pelo controle de verdade (nome acessível nomeando a empresa e o alerta).
    const linkDetalhe = linhaComAlerta.getByTestId("cotacoes-abrir-detalhe");
    await expect(linkDetalhe).toHaveAttribute("aria-label", `Ver detalhes de «${empresaComAlerta}» — tem alerta`);
    await linkDetalhe.click();

    const detalhe = page.getByTestId("cotacoes-detalhe");
    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByRole("heading", { name: empresaComAlerta })).toBeVisible();
    await expect(detalhe.getByText("Forno 180L · 1300°C")).toBeVisible();
    await expect(detalhe.getByTestId("cotacoes-preco")).toHaveText("R$ 24.900");

    // Os seis rótulos aparecem, e o valor de um campo com quebra de linha vem por INTEIRO.
    for (const rotulo of [
      "Diferenciais",
      "Assistência técnica",
      "Condições de pagamento",
      "Contato",
      "Observações",
      "Alertas",
    ]) {
      await expect(detalhe.getByText(rotulo, { exact: false })).toBeVisible();
    }
    await expect(detalhe.getByText("Voltagem 380V.")).toBeVisible();

    // O campo de alertas vem DESTACADO — ícone visível, além da cor (WCAG 1.4.1).
    const campoAlertas = detalhe.getByTestId("cotacoes-campo-alertas");
    await expect(campoAlertas.getByTestId("cotacoes-alerta-icone")).toBeVisible();

    // "Editar" a partir do detalhe fecha o detalhe e abre o formulário DESTA MESMA cotação.
    await detalhe.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByTestId("cotacoes-detalhe")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Editar cotação" })).toBeVisible();
    await expect(page.getByLabel("Empresa")).toHaveValue(empresaComAlerta);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Editar cotação" })).toBeHidden();

    // A segunda cotação, SEM alertas: o campo de alertas aparece vazio, sem destaque nem ícone.
    const linhaSemAlerta = linhasOuCartoesVisiveis(page).filter({ hasText: empresaSemAlerta });
    await linhaSemAlerta.getByTestId("cotacoes-abrir-detalhe").click();
    const detalheSemAlerta = page.getByTestId("cotacoes-detalhe");
    await expect(detalheSemAlerta.getByRole("heading", { name: empresaSemAlerta })).toBeVisible();
    const campoAlertasVazio = detalheSemAlerta.getByTestId("cotacoes-campo-alertas");
    await expect(campoAlertasVazio.getByTestId("cotacoes-alerta-icone")).toHaveCount(0);
    await expect(campoAlertasVazio.getByText("—")).toBeVisible();

    // Fecha e reabre pelo TECLADO: Tab até o controle, Enter abre, Escape fecha.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cotacoes-detalhe")).toBeHidden();
    await linhaSemAlerta.getByTestId("cotacoes-abrir-detalhe").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cotacoes-detalhe")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cotacoes-detalhe")).toBeHidden();
  });
});

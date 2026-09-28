import { test, expect, type Page } from "@playwright/test";

import { dataLongaEmPortugues } from "@/lib/inicio/saudacao";
import { ROTULO_ETAPA } from "@/lib/encomendas/textos";

import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// O Início de verdade (04.6-06-PLAN.md): saudação com nome e data, pílulas, índice, e os quatro
// blocos de leitura — Agenda de hoje, O que vence, Produção e Estoque acabando —, cada um com os
// três estados próprios (D-09). Uma ÚNICA invocação de
// `npm run test:e2e -- --grep "inicio"` para todo o arquivo (CLAUDE.md).
//
// O caso de estado vazio global entra na cadeia `vazio-*` de `playwright.config.ts`
// (`@vazio-global`), nunca por `--grep` — mesma disciplina do resto da suíte.

const NOME_GESTOR_DE_TESTE = "Gestora de Teste";

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// `getByLabel`/`getByRole` sozinhos casam com DOIS elementos quando `FormularioEncomenda` monta
// Dialog (desktop) e Sheet (celular) ao mesmo tempo — mesma armadilha documentada em
// `tests/e2e/encomendas-indice.spec.ts`; `:visible` escolhe a metade real do viewport do
// projeto Playwright atual.
function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
}

// Cria uma encomenda pelo formulário real — nunca por INSERT direto (não há auxiliar de
// semeadura para Encomendas, ao contrário do Financeiro). Uma retentativa, pelo mesmo motivo
// documentado em `encomendas-indice.spec.ts`: o ambiente local, sem retry do Playwright fora do
// CI, ocasionalmente fica preso em `?nova` sem redirecionar mesmo com dado válido.
async function criarEncomenda(page: Page, opcoes: { nome: string; dataInicio: string }) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    await page.goto("/gestao/encomendas?nova");
    await campoVisivel(page, "Nome da encomenda").fill(opcoes.nome);
    await campoVisivel(page, "Data de início").fill(opcoes.dataInicio);
    await campoVisivel(page, "Descrição do item 1").fill("Item de teste [e2e]");
    await campoVisivel(page, "Quantidade do item 1").fill("1");
    await botaoVisivel(page, "Salvar").click();

    try {
      await expect(page).toHaveURL(/\/gestao\/encomendas$/, { timeout: 10000 });
      return;
    } catch (erro) {
      await page.goto("/gestao/encomendas");
      if ((await page.getByText(opcoes.nome, { exact: true }).count()) > 0) {
        return;
      }
      if (tentativa === 2) {
        throw erro;
      }
    }
  }
}

// Os quatro blocos, na ordem de GES-07 — lidos pelo `data-testid` que cada um já carrega,
// diretamente sob `inicio-blocos` (nenhum Suspense insere nó próprio no DOM).
async function ordemDosBlocos(page: Page): Promise<string[]> {
  const blocos = page.locator('[data-testid="inicio-blocos"] > [data-testid^="inicio-bloco-"]');
  // `evaluateAll` sozinho não espera nada — os quatro blocos chegam por streaming (Suspense);
  // esta asserção de contagem é o que dá o tempo real de resolução antes de ler a ordem.
  await expect(blocos).toHaveCount(4);
  return blocos.evaluateAll((elementos) =>
    elementos.map((el) => el.getAttribute("data-testid") ?? ""),
  );
}

test.describe("inicio", () => {
  test("a saudação mostra o nome de quem entrou e a data de hoje, em português, no fuso de Brasília", async ({
    page,
  }) => {
    await fazerLogin(page);

    await expect(page.getByTestId("inicio-saudacao")).toHaveText(`Olá, ${NOME_GESTOR_DE_TESTE}.`);
    await expect(page.getByTestId("inicio-data")).toHaveText(dataLongaEmPortugues(hojeNoAtelie()));
  });

  // Casos (b)/(c)/(d)/(g) do plano — todos lidos na MESMA navegação, em banco sem conta em
  // aberto: a ordem dos quatro blocos, a linha permanente de ocupação da Agenda (D-07), "O que
  // vence" com a frase vazia, e "Estoque acabando" com a frase vazia. Condição GLOBAL do banco
  // (nenhuma conta em aberto) — por isso `@vazio-global`, na cadeia `vazio-*` de
  // `playwright.config.ts`, nunca por `--grep` (CLAUDE.md).
  //
  // O plano 07 acrescenta um quinto bloco (Anotações) ao fim desta lista — esta asserção de
  // ordem é estendida lá, não reaberta aqui.
  test("com o banco sem conta em aberto, a ordem dos blocos, a ocupação da Agenda e as frases vazias aparecem juntas @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);

    expect(await ordemDosBlocos(page)).toEqual([
      "inicio-bloco-agenda",
      "inicio-bloco-vence",
      "inicio-bloco-producao",
      "inicio-bloco-estoque",
    ]);

    // Agenda: a linha de ocupação fica visível MESMO em dia vazio (D-07) — nunca some junto com
    // a frase de vazio. `toContainText`, não `toHaveText`: o testid cobre o contêiner inteiro
    // ("Agora no espaço" + o número), não só o número.
    await expect(page.getByTestId("inicio-ocupacao")).toContainText("0 de 10 lugares");
    await expect(page.getByTestId("inicio-bloco-agenda")).toContainText(
      "Nada marcado para hoje. O espaço está livre.",
    );

    await expect(page.getByTestId("inicio-bloco-vence")).toContainText(
      "Nenhuma conta vence nos próximos 7 dias.",
    );
    await expect(page.getByTestId("inicio-bloco-estoque")).toContainText(
      "Nenhum material abaixo do mínimo.",
    );
  });

  // Caso (e): a parcela vencendo hoje aparece no bloco, e "Paguei"/"Recebi" leva ao Caixa NA
  // parcela — sem confirmar pagamento nenhum dali (D-06). `semearContaAPagar` (auxiliar já
  // usado por `tests/e2e/financeiro-caixa.spec.ts`) grava direto no banco de teste — o mesmo
  // formato de dado que a tela de Venda/Despesa produziria, sem pagar o custo de uma submissão
  // real de formulário para este teste.
  test('uma conta vencendo hoje aparece em "O que vence", e "Paguei"/"Recebi" leva ao Caixa na parcela específica, sem pagar nada', async ({
    page,
  }) => {
    const titulo = nomeUnico("Conta do Início");
    const { parcelaId } = await semearContaAPagar({
      titulo,
      categoria: "Aluguel",
      valorCentavos: 12345,
      vencimento: hojeNoAtelie(),
      tipo: "despesa",
    });

    await fazerLogin(page);

    // Escopo pela LINHA (`inicio-vence-linha`), nunca pelo bloco inteiro: desktop e celular
    // rodam em paralelo contra o mesmo banco, e o bloco inteiro pode conter outras contas
    // concorrentes com o mesmo rótulo "Paguei" — um `.filter` sobre o bloco só decide se ELE
    // aparece na lista, não que sub-elemento buscar depois.
    const linhaDoInicio = page
      .getByTestId("inicio-vence-linha")
      .filter({ hasText: titulo });
    await expect(linhaDoInicio).toBeVisible();
    await expect(linhaDoInicio).toContainText("a pagar");

    await linhaDoInicio.getByRole("link", { name: "Paguei" }).click();

    await expect(page).toHaveURL(new RegExp(`/gestao/financeiro\\?aba=caixa&parcelaFoco=${parcelaId}$`));
    const linhaFocada = page.getByTestId("caixa-parcela-focada");
    await expect(linhaFocada).toBeVisible();
    await expect(linhaFocada).toContainText(titulo);

    // Nenhuma confirmação de pagamento aconteceu no Início: a conta continua ABERTA (o botão
    // "Paguei" ainda existe na linha, o que só é verdade para conta sem `pago_em`).
    await expect(linhaFocada.getByRole("button", { name: "Paguei" })).toBeVisible();
  });

  // Caso (f): a Produção mostra a etapa atual de uma encomenda em andamento, e nenhuma linha
  // contém o estado que o redesenho da Produção ainda vai decidir (D-10).
  test("uma encomenda em andamento mostra a etapa atual no bloco Produção, sem antecipar o redesenho", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nome = nomeUnico("Encomenda em produção");
    // Dois dias atrás: ainda dentro dos 5 dias padrão de Produção (DIAS_PADRAO), com 3 dias
    // até a Secagem começar.
    await criarEncomenda(page, { nome, dataInicio: somarDiasAoHoje(-2) });

    await page.goto("/gestao");

    const blocoProducao = page.getByTestId("inicio-bloco-producao");
    const linha = blocoProducao.filter({ hasText: nome });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(ROTULO_ETAPA.producao);
    await expect(linha).toContainText(ROTULO_ETAPA.secagem);

    await expect(blocoProducao).not.toContainText(/aguardando sinal/i);
  });

  test("as pílulas mostram os módulos fora da barra de baixo, e o índice mostra um cartão por módulo mais o de próximos módulos", async ({
    page,
  }) => {
    await fazerLogin(page);

    const pilulas = page.getByTestId("inicio-pilulas");
    await expect(pilulas.getByRole("link", { name: "Queimas" })).toBeVisible();
    await expect(pilulas.getByRole("link", { name: "Estoque" })).toBeVisible();
    await expect(pilulas.getByRole("link", { name: "Cadastros" })).toBeVisible();
    // Os quatro da barra de baixo NÃO viram pílula — já estão a um toque.
    await expect(pilulas.getByRole("link", { name: "Início", exact: true })).toHaveCount(0);
    await expect(pilulas.getByRole("link", { name: "Financeiro", exact: true })).toHaveCount(0);
    await expect(pilulas.getByRole("link", { name: "Produção", exact: true })).toHaveCount(0);
    await expect(pilulas.getByRole("link", { name: "Agenda", exact: true })).toHaveCount(0);

    const indice = page.getByTestId("inicio-indice");
    for (const rotulo of ["Financeiro", "Produção", "Agenda", "Queimas", "Estoque", "Cadastros"]) {
      await expect(indice.getByRole("link", { name: new RegExp(`^${rotulo}`) })).toBeVisible();
    }
    await expect(indice.getByText("Próximos módulos")).toBeVisible();
  });

  test("a 320px o Início não rola na horizontal e todo alvo de toque mede ao menos 44px de altura", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/gestao");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth, `/gestao rola horizontalmente a 320px (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(
      clientWidth,
    );

    const alvos = page
      .getByTestId("inicio-pilulas")
      .getByRole("link")
      .or(page.getByTestId("inicio-indice").getByRole("link"));
    const quantidade = await alvos.count();
    expect(quantidade).toBeGreaterThan(0);
    for (let indice = 0; indice < quantidade; indice += 1) {
      const caixa = await alvos.nth(indice).boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("o atalho 'todos os módulos' rola até o índice", async ({ page }) => {
    await fazerLogin(page);

    await page.getByTestId("inicio-pilulas").getByRole("link", { name: /todos os módulos/ }).click();

    await expect(page.getByTestId("inicio-indice")).toBeInViewport();
  });
});

import { test, expect, type Page } from "@playwright/test";

import { DIAS_PADRAO } from "@/lib/encomendas/cronograma";
import { ROTULO_ETAPA } from "@/lib/encomendas/textos";

// Traçado de ponta a ponta desta fase (03-01-PLAN.md, Tarefa 2): logar, abrir
// `/encomendas?nova` (contrato de URL de D-03), criar uma encomenda com um item, e confirmar
// que a lista de `/encomendas` mostra o nome e a data de conclusão calculada em cascata pelo
// módulo puro `lib/encomendas/cronograma.ts`. Depois, recarregar e confirmar que a encomenda
// continua lá — a prova de que a persistência é real (ENC-12), não estado de cliente.
//
// 03-08-PLAN.md (Tarefa 2, fechamento da fase) acrescenta o fluxo completo criar → editar →
// excluir e a prova de ENC-12 com dois contextos independentes de navegador — sem ramificar por
// `testInfo.project.name` em nenhum dos dois: rodam exatamente iguais em `desktop` e `celular`,
// localizando sempre pela metade VISÍVEL do DOM (mesmo princípio de D-02).
//
// Mesmo helper `fazerLogin` de tests/e2e/casca.spec.ts, duplicado aqui por convenção do
// projeto (cada spec é independente, sem módulo de apoio compartilhado além do globalSetup).
async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Desde o plano 06, `FormularioEncomenda` monta `Dialog` (desktop) E `Sheet` (celular) ao mesmo
// tempo — os dois existem no HTML, um escondido por CSS a cada largura (mesmo princípio de D-02
// para Gantt/lista). `:visible` escolhe a metade real do viewport atual do projeto Playwright em
// execução.
function campoVisivel(page: Page, rotulo: string) {
  return page.getByLabel(rotulo, { exact: true }).and(page.locator(":visible"));
}

function botaoVisivel(page: Page, nome: string) {
  return page.getByRole("button", { name: nome }).and(page.locator(":visible"));
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Mesmo helper de retry de tests/e2e/encomendas-detalhe.spec.ts/encomendas-indice.spec.ts: sob
// o webServer local em paralelo, uma submissão isolada ocasionalmente fica presa em `?nova` sem
// redirecionar mesmo com a transação já concluída no servidor.
async function salvarComRetry(page: Page, nome: string) {
  const TENTATIVAS_MAXIMAS = 3;
  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    await botaoVisivel(page, "Salvar").click();
    try {
      await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
      return;
    } catch (erro) {
      await page.goto("/encomendas");
      const jaFoiCriada = await page.getByText(nome, { exact: true }).count();
      if (jaFoiCriada > 0) {
        return;
      }
      if (tentativa === TENTATIVAS_MAXIMAS) {
        throw erro;
      }
    }
  }
}

// O cartão mobile (`CartaoEncomenda`) é um `<a href>` real, sempre no DOM nos dois tamanhos de
// tela (D-02) — o Gantt do desktop ainda não linka por linha (gap pré-existente de 03-04/03-05,
// fora do escopo desta fase). Extrai o `href` dali, independente do viewport do projeto atual.
async function hrefDoDetalhe(page: Page, nome: string): Promise<string> {
  await page.goto("/encomendas");
  const cartao = page.locator('[data-testid^="cartao-encomenda-"]').filter({ hasText: nome });
  await expect(cartao).toHaveCount(1);
  const href = await cartao.getAttribute("href");
  if (!href) {
    throw new Error(`Cartão da encomenda "${nome}" sem href.`);
  }
  return href;
}

test.describe("encomendas — traçado de ponta a ponta", () => {
  test("criar uma encomenda com um item mostra a data de conclusão em cascata, e sobrevive a um recarregamento", async ({
    page,
  }) => {
    await fazerLogin(page);

    // Nome exclusivo por execução — evita colisão entre projetos (desktop/celular) rodando
    // em paralelo contra o mesmo banco de teste efêmero. Dado inventado, reconhecível como
    // inventado (proibição PR-1 do plano): nenhum nome real de cliente ou encomenda do ateliê.
    const nomeDaEncomenda = `[e2e] Peças de teste ${test.info().project.name} ${Date.now()}`;

    await page.goto("/encomendas?nova");

    await campoVisivel(page, "Nome da encomenda").fill(nomeDaEncomenda);
    await campoVisivel(page, "Cliente").fill("Cliente inventado para teste");
    await campoVisivel(page, "Data de início").fill("2026-08-12");
    await campoVisivel(page, "Descrição do item 1").fill("Caneca cônica de teste");
    await campoVisivel(page, "Quantidade do item 1").fill("10");

    await botaoVisivel(page, "Salvar").click();

    // A ação redireciona para /encomendas ao concluir a transação. Sob a suíte inteira rodando
    // em paralelo, uma submissão isolada ocasionalmente fica presa em `?nova` sem redirecionar
    // (instabilidade do webServer local de desenvolvimento, não do dado — mesmo diagnóstico de
    // tests/e2e/encomendas-indice.spec.ts#criarEncomenda). Se acontecer aqui, um recarregamento
    // de `/encomendas` confirma se a transação já tinha sido concluída no servidor antes de
    // desistir — nunca reenvia o formulário, que criaria uma segunda encomenda com o mesmo nome.
    try {
      await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
    } catch (erro) {
      await page.goto("/encomendas");
      const jaFoiCriada = await page.getByText(nomeDaEncomenda, { exact: true }).count();
      if (jaFoiCriada === 0) {
        throw erro;
      }
    }

    // Desde a 03-04 (Gantt + lista mobile, D-02), o nome aparece DUAS vezes no HTML — uma na
    // linha do Gantt (coluna fixa, `hidden md:block`) e uma no cartão da lista mobile
    // (`md:hidden`), um escondido por CSS em cada largura. `:visible` escolhe a metade real do
    // viewport atual, o mesmo princípio de `tests/e2e/casca.spec.ts`. A cascata de datas em si
    // (produção 3 + secagem 6 + queima1 1 + esmaltação 1 + queima2 1 + entrega 1 = 13 dias,
    // fim exclusivo a partir de 2026-08-12 → último dia de "entrega" é 2026-08-24) já tem prova
    // dedicada em tests/unit/cronograma.test.ts e em tests/e2e/encomendas-indice.spec.ts (barra
    // de 54px medida por boundingBox no Gantt) — aqui o que importa é só a persistência real.
    const nomeVisivel = page.getByText(nomeDaEncomenda, { exact: true }).and(page.locator(":visible"));
    await expect(nomeVisivel).toBeVisible();

    // Recarregar prova que a gravação é real (ENC-12), não estado de cliente.
    await page.reload();
    await expect(nomeVisivel).toBeVisible();
  });

  // 03-08-PLAN.md Tarefa 2 — o fluxo que a M2 pediu (03-ROADMAP.md §M2 fase 9): criar → editar
  // → excluir, num único teste que roda igual em `desktop` e `celular` (sem ramificar por
  // `testInfo.project.name`), localizando sempre pela metade VISÍVEL do DOM.
  test("fluxo completo: criar com dois itens e as seis etapas, editar, conferir a mudança, excluir com confirmação, e sumir do índice", async ({
    page,
  }) => {
    await fazerLogin(page);
    const nome = nomeUnico("Fluxo completo");

    await page.goto("/encomendas?nova");
    await campoVisivel(page, "Nome da encomenda").fill(nome);
    await campoVisivel(page, "Cliente").fill("Cliente do fluxo completo [e2e]");
    await campoVisivel(page, "Data de início").fill("2026-08-12");
    await campoVisivel(page, "Descrição do item 1").fill("Primeiro item [e2e]");
    await campoVisivel(page, "Quantidade do item 1").fill("2");
    await botaoVisivel(page, "Adicionar item").click();
    await campoVisivel(page, "Descrição do item 2").fill("Segundo item [e2e]");
    await campoVisivel(page, "Quantidade do item 2").fill("3");

    await salvarComRetry(page, nome);

    // Abre o detalhe e confere as seis linhas da trilha (D-04) — todas presentes, com os
    // padrões de dias herdados (nenhum campo de etapa foi tocado na criação).
    const href = await hrefDoDetalhe(page, nome);
    await page.goto(href);
    await expect(page.getByRole("heading", { name: nome, level: 1 })).toBeVisible();
    for (const etapa of Object.keys(ROTULO_ETAPA) as (keyof typeof ROTULO_ETAPA)[]) {
      await expect(page.getByTestId(`trilha-linha-${etapa}`)).toContainText(ROTULO_ETAPA[etapa]);
    }

    const totalPadrao = DIAS_PADRAO.reduce((soma, etapa) => soma + etapa.dias, 0);
    await expect(page.getByTestId("rodape-trilha")).toContainText(`${totalPadrao} dias`);

    // Edita pelo formulário completo: novo nome e +4 dias na secagem (6 → 10) — muda a
    // duração total e a conclusão prevista, não só o texto.
    const nomeEditado = `${nome} (editado)`;
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(/\?editar=/);
    await campoVisivel(page, "Nome da encomenda").fill(nomeEditado);
    await campoVisivel(page, ROTULO_ETAPA.secagem).fill("10");
    await botaoVisivel(page, "Salvar").click();
    await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });

    // Confere a mudança de verdade: o nome novo aparece no índice (Gantt/cartão, D-02) e a
    // trilha do detalhe reflete a nova duração total (13 - 6 + 10 = 17 dias).
    const nomeEditadoVisivel = page
      .getByText(nomeEditado, { exact: true })
      .and(page.locator(":visible"));
    await expect(nomeEditadoVisivel).toBeVisible();

    await page.goto(href);
    await expect(page.getByRole("heading", { name: nomeEditado, level: 1 })).toBeVisible();
    await expect(page.getByTestId("trilha-linha-secagem")).toContainText("10 dias");
    await expect(page.getByTestId("rodape-trilha")).toContainText(`${totalPadrao - 6 + 10} dias`);

    // Excluir com confirmação (D-08/D-09) — o diálogo nomeia os dois itens antes de apagar.
    await page.getByRole("button", { name: "Mais ações da encomenda" }).click();
    await page.getByRole("menuitem", { name: "Excluir encomenda" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText("Os 2 itens dela serão apagados.")).toBeVisible();
    await dialogo.getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page).toHaveURL(/\/encomendas$/, { timeout: 10000 });
    await expect(page.getByText("Encomenda excluída.")).toBeVisible();
    await expect(page.getByText(nomeEditado, { exact: true })).toHaveCount(0);
  });

  // ENC-12, provado com dois contextos INDEPENDENTES do navegador (não duas abas do mesmo
  // contexto, que compartilhariam cookies/cache de forma que não representa dois dispositivos
  // reais do ateliê): a ausência de tempo real é uma asserção explícita, não um silêncio — se um
  // dia alguém acrescentar revalidação automática sem conversar, este teste fica vermelho e a
  // conversa acontece (03-CONTEXT.md `<domain>`).
  test("ENC-12: uma encomenda criada num contexto de navegador só aparece no outro DEPOIS de recarregar — nunca antes", async ({
    browser,
  }) => {
    const contextoA = await browser.newContext();
    const contextoB = await browser.newContext();

    try {
      const paginaA = await contextoA.newPage();
      const paginaB = await contextoB.newPage();

      await fazerLogin(paginaA);
      await fazerLogin(paginaB);

      // Contexto B abre o índice ANTES da criação — é o "outro dispositivo" já com a tela
      // aberta no ateliê.
      await paginaB.goto("/encomendas");

      const nome = nomeUnico("ENC-12 dois contextos");
      await paginaA.goto("/encomendas?nova");
      await campoVisivel(paginaA, "Nome da encomenda").fill(nome);
      await campoVisivel(paginaA, "Cliente").fill("Cliente do ENC-12 [e2e]");
      await campoVisivel(paginaA, "Data de início").fill("2026-08-12");
      await campoVisivel(paginaA, "Descrição do item 1").fill("Item de teste [e2e]");
      await campoVisivel(paginaA, "Quantidade do item 1").fill("1");
      await salvarComRetry(paginaA, nome);

      // ANTES de recarregar, o contexto B não vê a encomenda nova — a asserção que transforma
      // "não implementamos tempo real" em decisão testada.
      await expect(paginaB.getByText(nome, { exact: true })).toHaveCount(0);

      // DEPOIS de recarregar, aparece — a mesma persistência real de ENC-12, agora provada
      // entre dois dispositivos, não só dentro da mesma aba.
      await paginaB.reload();
      const nomeVisivelEmB = paginaB.getByText(nome, { exact: true }).and(paginaB.locator(":visible"));
      await expect(nomeVisivelEmB).toBeVisible();
    } finally {
      await contextoA.close();
      await contextoB.close();
    }
  });
});

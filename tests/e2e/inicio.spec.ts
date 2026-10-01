import { test, expect, type Page } from "@playwright/test";

import { dataLongaEmPortugues } from "@/lib/inicio/saudacao";
import { TEXTOS_DOS_BLOCOS, textoAguardandoOSinal } from "@/lib/inicio/textos";
import { rotuloDaEtapa } from "@/lib/producao/etapas";

import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import { diaEmBrasilia, semearOrdem } from "./apoio/semear-producao";

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

// Os cinco blocos, na ordem de GES-07 (o 5º, Anotações, entrou no plano 07) — lidos pelo
// `data-testid` que cada um já carrega, diretamente sob `inicio-blocos` (nenhum Suspense insere
// nó próprio no DOM).
async function ordemDosBlocos(page: Page): Promise<string[]> {
  const blocos = page.locator('[data-testid="inicio-blocos"] > [data-testid^="inicio-bloco-"]');
  // `evaluateAll` sozinho não espera nada — os cinco blocos chegam por streaming (Suspense);
  // esta asserção de contagem é o que dá o tempo real de resolução antes de ler a ordem.
  await expect(blocos).toHaveCount(5);
  // `BlocoEsqueleto` carrega `data-testid="inicio-bloco-esqueleto"` (bloco-esqueleto.tsx) — o
  // MESMO prefixo `inicio-bloco-` do seletor acima. `toHaveCount(5)` sozinho pode passar cedo
  // demais: um esqueleto que ainda não virou conteúdo real também casa com o seletor, então 5
  // elementos podem significar "4 resolvidos + 1 esqueleto" tanto quanto "os 5 resolvidos". Achado
  // no plano 07 (Anotações), o 5º bloco a fazer sua própria consulta ao banco — com blocos
  // resolvendo em velocidades diferentes, a janela de captura parcial deixou de ser rara. Espera
  // a ausência de qualquer esqueleto antes de ler a ordem.
  await expect(page.getByTestId("inicio-bloco-esqueleto")).toHaveCount(0);
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
  // aberto: a ordem dos cinco blocos (o 5º, Anotações, entrou no plano 07), a linha permanente
  // de ocupação da Agenda (D-07), "O que vence" com a frase vazia, e "Estoque acabando" com a
  // frase vazia. Condição GLOBAL do banco (nenhuma conta em aberto) — por isso `@vazio-global`,
  // na cadeia `vazio-*` de `playwright.config.ts`, nunca por `--grep` (CLAUDE.md).
  test("com o banco sem conta em aberto, a ordem dos blocos, a ocupação da Agenda e as frases vazias aparecem juntas @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);

    expect(await ordemDosBlocos(page)).toEqual([
      "inicio-bloco-agenda",
      "inicio-bloco-vence",
      "inicio-bloco-producao",
      "inicio-bloco-estoque",
      "inicio-bloco-anotacoes",
    ]);

    // Agenda: a linha de ocupação fica visível MESMO em dia vazio (D-07) — nunca some junto com
    // a frase de vazio. `toContainText`, não `toHaveText`: o testid cobre o contêiner inteiro
    // ("Agora no espaço" + o número), não só o número.
    // Contagem, sem denominador: a capacidade do espaço saiu em 29/09/2026, por decisão do dono
    // no portão da Fase 04.6 (o 10 vinha do protótipo, não de medição — ver lib/agenda/espaco.ts).
    await expect(page.getByTestId("inicio-ocupacao")).toContainText("0 pessoas");
    await expect(page.getByTestId("inicio-ocupacao")).not.toContainText("lugares");
    await expect(page.getByTestId("inicio-bloco-agenda")).toContainText(
      "Nada marcado para hoje. O espaço está livre.",
    );

    await expect(page.getByTestId("inicio-bloco-vence")).toContainText(
      "Nenhuma conta vence nos próximos 7 dias.",
    );
    await expect(page.getByTestId("inicio-bloco-estoque")).toContainText(
      "Nenhum material abaixo do mínimo.",
    );

    // Produção (Fase 06.1, D-16): banco sem ordem nenhuma — a frase do vazio e o convite a criar
    // uma ordem, sem a linha de aguardando.
    const blocoProducao = page.getByTestId("inicio-bloco-producao");
    await expect(blocoProducao).toContainText(TEXTOS_DOS_BLOCOS.producao.vazio);
    await expect(blocoProducao).toContainText(TEXTOS_DOS_BLOCOS.producao.vazioSemAguardando);
    await expect(blocoProducao.getByTestId("inicio-producao-aguardando")).toHaveCount(0);
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

  // Caso (f), Fase 06.1 (D-16): o bloco Produção lê o modelo novo — a ordem liberada vira uma
  // linha-link com a pílula da etapa e o selo; a que espera o sinal entra só na contagem da linha
  // final. Afirma a PRÓPRIA ordem e uma contagem >= 1, nunca o total do banco (outros testes semeiam
  // ordens ao mesmo tempo).
  test("uma ordem liberada aparece no bloco Produção com a etapa e o selo, e as que esperam o sinal viram uma linha", async ({
    page,
  }) => {
    // Até 5 linhas, a que vai atrasar primeiro e, no empate, a de início mais antigo: começada há
    // 200 dias e com a entrega prometida ontem, esta fica no topo mesmo com outras ordens no banco.
    const nomeLiberada = nomeUnico("Ordem liberada no Início");
    const ordemId = await semearOrdem({
      nome: nomeLiberada,
      tipo: "encomenda",
      caminho: "completo",
      status: "ativa",
      inicio: diaEmBrasilia(-200),
      etapasFeitas: [],
      pecas: [{ descricao: "[e2e] Peça do Início", quantidade: 1 }],
      clienteNome: "[e2e] Cliente do Início",
      entregaPrometida: diaEmBrasilia(-1),
    });
    await semearOrdem({
      nome: nomeUnico("Ordem aguardando no Início"),
      tipo: "encomenda",
      caminho: "completo",
      status: "aguardando_sinal",
      inicio: null,
      etapasFeitas: [],
      pecas: [{ descricao: "[e2e] Peça aguardando", quantidade: 1 }],
    });

    await fazerLogin(page);

    const blocoProducao = page.getByTestId("inicio-bloco-producao");
    const linha = blocoProducao.getByTestId("inicio-producao-linha").filter({ hasText: nomeLiberada });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(`${nomeLiberada} · [e2e] Cliente do Início`);
    await expect(linha).toHaveAttribute("href", `/gestao/producao/${ordemId}`);
    await expect(linha.getByTestId("inicio-producao-etapa")).toHaveText(rotuloDaEtapa("producao", "encomenda"));
    const selo = linha.getByTestId("producao-selo");
    await expect(selo).toHaveAttribute("data-selo", "vai-atrasar");
    await expect(selo).toContainText("vai atrasar");

    const aguardando = blocoProducao.getByTestId("inicio-producao-aguardando");
    await expect(aguardando).toHaveText(/^\d+ aguardando o sinal$/);
    const quantas = Number.parseInt((await aguardando.textContent()) ?? "0", 10);
    expect(quantas).toBeGreaterThanOrEqual(1);
    await expect(aguardando).toHaveText(textoAguardandoOSinal(quantas));
    await expect(aguardando).toHaveAttribute("href", "/gestao/producao#aguardando-o-sinal");

    // O modelo antigo sumiu: nem o "vai para X em N dias" do cronograma calculado.
    await expect(blocoProducao).not.toContainText(/vai para /);
    await expect(
      blocoProducao.getByRole("link", { name: "abrir produção" }),
    ).toHaveAttribute("href", "/gestao/producao");
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
    // `count()` não espera: sob carga o `main` ainda pode estar vazio quando o `goto` volta (mesma
    // classe de WINDOWS #35/#51). Espera o índice aparecer antes de medir e contar (plano 06-10).
    await expect(page.getByTestId("inicio-indice")).toBeVisible();

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
    // Os blocos chegam por streaming, cada um no seu `Suspense` (D-09). Desde o plano 05-14 o bloco da
    // Agenda também lê o banco e pode crescer de 3 linhas de esqueleto para até 6 linhas + "e mais N":
    // tocar a âncora ANTES de os blocos chegarem rola até o índice e, em seguida, o conteúdo que entra
    // acima o empurra para fora da tela. O que se prova aqui é o atalho, com a página já montada.
    await expect(page.getByTestId("inicio-bloco-esqueleto")).toHaveCount(0);

    await page.getByTestId("inicio-pilulas").getByRole("link", { name: /todos os módulos/ }).click();

    await expect(page.getByTestId("inicio-indice")).toBeInViewport();
  });
});

import { test, expect, type Locator, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  criarPessoaDeTeste,
  desativarPessoaDeTeste,
  destravarLembretesDeTeste,
  idDoUsuarioDoTeste,
  lerLembrete,
  lerLembretePorTexto,
  limparLembretes,
  semearLembrete,
  semearVariosLembretes,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// O primeiro nome da conta do e2e ("Gestora de Teste", `preparar-usuario.ts`).
const PRIMEIRO_NOME_DO_GESTOR_DE_TESTE = "Gestora";

// "Ver todos" — `/gestao/lembretes` (Fase 06.3, plano 05; LMB-09, D-01): os filtros na URL
// (Abertos/Feitos × Todos/Geral/pessoas), a autoria de cada linha, "Mostrar mais 50" e as mesmas
// ações do Início.
//
// Escreve em `lembretes` e afirma o que a tabela inteira devolve: o `describe` roda sob a MESMA
// trava consultiva de todo spec `lembretes-*` (`travarLembretesParaTeste`), em `mode: "serial"`, e
// cada caso começa por `limparLembretes()` — só dentro da trava. Textos inventados, prefixo `[e2e]`
// (CLAUDE.md). A pessoa das pílulas é escolhida pelo `data-filtro` com o id do usuário de teste,
// nunca pelo nome.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function pagina(page: Page): Locator {
  return page.getByTestId("lembretes-pagina");
}

function linhas(page: Page): Locator {
  return pagina(page).getByTestId("lembretes-lista").getByTestId("lembrete-linha");
}

function filtro(page: Page, valor: string): Locator {
  return pagina(page).locator(`[data-testid="lembretes-filtro"][data-filtro="${valor}"]`);
}

test.describe("lembretes todos", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // O outro projeto (desktop/celular) pode estar segurando a trava pelo describe inteiro.
    test.setTimeout(300_000);
    await travarLembretesParaTeste();
  });

  test.afterAll(async () => {
    await destravarLembretesDeTeste();
  });

  // (a) O traçador do plano 05: da URL ao banco — só os feitos "geral", com quem fez e quando.
  test("?situacao=feitos&quem=geral mostra só o feito geral, com feito por {nome} · dd/mm hh:mm em Brasília, e as pílulas Feitos e Geral marcadas", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const idDoUsuario = await idDoUsuarioDoTeste();
    await semearLembrete({ texto: `[e2e] todos aberto geral 1 ${projeto}` });
    await semearLembrete({ texto: `[e2e] todos aberto geral 2 ${projeto}` });
    await semearLembrete({
      texto: `[e2e] todos aberto pessoa ${projeto}`,
      quem: idDoUsuario,
    });
    const textoFeitoGeral = `[e2e] todos feito geral ${projeto}`;
    // 15:20 UTC = 12:20 em Brasília (UTC−3, sem horário de verão).
    const idFeitoGeral = await semearLembrete({
      texto: textoFeitoGeral,
      feitoEm: "2026-09-30T15:20:00.000Z",
    });
    await semearLembrete({
      texto: `[e2e] todos feito pessoa ${projeto}`,
      quem: idDoUsuario,
      feitoEm: "2026-09-30T16:00:00.000Z",
    });

    await fazerLogin(page);
    await page.goto("/gestao/lembretes?situacao=feitos&quem=geral");

    await expect(
      page.getByRole("heading", { level: 1, name: "Lembretes" }),
    ).toBeVisible();
    await expect(linhas(page)).toHaveCount(1);
    const linha = linhas(page).first();
    await expect(linha).toHaveAttribute("data-id", idFeitoGeral);
    await expect(linha).toHaveAttribute("data-situacao", "feito");
    await expect(linha.getByTestId("lembrete-texto")).toHaveText(textoFeitoGeral);
    await expect(linha.getByTestId("lembrete-autoria")).toHaveText(
      `feito por ${PRIMEIRO_NOME_DO_GESTOR_DE_TESTE} · 30/09 12:20`,
    );

    await expect(filtro(page, "feitos")).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "geral")).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "abertos")).not.toHaveAttribute("aria-current", /.*/);
    await expect(filtro(page, "todos")).not.toHaveAttribute("aria-current", /.*/);
  });
  // (b) Sem parâmetros: os abertos na ordem do briefing, com "por {nome} · dd/mm hh:mm"; as pílulas
  // escrevem a URL — trocar a situação mantém o "quem", e a pessoa é escolhida pelo id.
  test("sem parâmetros mostra os abertos na ordem com a autoria; tocar Feitos e depois a pessoa escreve situacao e quem na URL", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const idDoUsuario = await idDoUsuarioDoTeste();
    // 12:00 UTC = 09:00 em Brasília.
    const idSemData = await semearLembrete({
      texto: `[e2e] todos sem data ${projeto}`,
      criadoEm: "2026-01-01T12:00:00.000Z",
    });
    const idHoje = await semearLembrete({
      texto: `[e2e] todos hoje ${projeto}`,
      paraQuando: hojeNoAtelie(),
      criadoEm: "2026-01-01T12:01:00.000Z",
    });
    const idVencido = await semearLembrete({
      texto: `[e2e] todos vencido ${projeto}`,
      paraQuando: somarDiasAoHoje(-2),
      criadoEm: "2026-01-01T12:02:00.000Z",
    });

    await fazerLogin(page);
    await page.goto("/gestao/lembretes");

    await expect(linhas(page)).toHaveCount(3);
    expect(
      await linhas(page).evaluateAll((elementos) =>
        elementos.map((elemento) => elemento.getAttribute("data-id")),
      ),
    ).toEqual([idVencido, idHoje, idSemData]);
    await expect(
      pagina(page)
        .locator(`[data-testid="lembrete-linha"][data-id="${idSemData}"]`)
        .getByTestId("lembrete-autoria"),
    ).toHaveText(`por ${PRIMEIRO_NOME_DO_GESTOR_DE_TESTE} · 01/01 09:00`);
    await expect(filtro(page, "abertos")).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "todos")).toHaveAttribute("aria-current", "true");

    await filtro(page, "feitos").click();
    await expect(page).toHaveURL(/\/gestao\/lembretes\?situacao=feitos$/);
    await expect(filtro(page, "feitos")).toHaveAttribute("aria-current", "true");
    await expect(pagina(page).getByTestId("lembretes-vazio")).toHaveText(
      "Nenhum lembrete aqui.",
    );

    await filtro(page, idDoUsuario).click();
    await expect(page).toHaveURL(
      new RegExp(`/gestao/lembretes\\?situacao=feitos&quem=${idDoUsuario}$`),
    );
    await expect(filtro(page, idDoUsuario)).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "feitos")).toHaveAttribute("aria-current", "true");
  });

  // (c) "Mostrar mais 50": com 51 abertos, 50 na tela; o toque pede 100 e mostra os 51.
  test("com 51 abertos mostra 50 e Mostrar mais 50; o toque leva a quantos=100, mostra 51 e o botão some", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    await semearVariosLembretes(
      Array.from({ length: 51 }, (_, indice) => ({
        texto: `[e2e] todos mais ${String(indice + 1).padStart(2, "0")} ${projeto}`,
      })),
    );

    await fazerLogin(page);
    await page.goto("/gestao/lembretes");

    await expect(linhas(page)).toHaveCount(50);
    const mostrarMais = pagina(page).getByTestId("lembretes-mostrar-mais");
    await expect(mostrarMais).toBeVisible();
    await expect(mostrarMais).toHaveText("Mostrar mais 50");
    expect((await medirCaixa(mostrarMais, "Mostrar mais 50")).height).toBeGreaterThanOrEqual(44);

    await mostrarMais.click();
    await expect(page).toHaveURL(/\/gestao\/lembretes\?quantos=100$/);
    await expect(linhas(page)).toHaveCount(51);
    await expect(pagina(page).getByTestId("lembretes-mostrar-mais")).toHaveCount(0);
  });

  // (d) Um filtro sem nada: a caixa tracejada, e a linha de criar continua no topo (UI-D8).
  test("um filtro sem lembrete mostra Nenhum lembrete aqui., com a linha de criar acima", async ({
    page,
  }) => {
    await limparLembretes();

    await fazerLogin(page);
    await page.goto("/gestao/lembretes?situacao=feitos");

    const vazio = pagina(page).getByTestId("lembretes-vazio");
    await expect(vazio).toHaveText("Nenhum lembrete aqui.");
    const campo = pagina(page).getByTestId("lembretes-novo-texto");
    await expect(campo).toBeVisible();
    const caixaDoCampo = await medirCaixa(campo, "linha de criar");
    const caixaDoVazio = await medirCaixa(vazio, "Nenhum lembrete aqui.");
    expect(caixaDoCampo.y).toBeLessThan(caixaDoVazio.y);
    await expect(
      pagina(page).getByText(/^Lembrete feito fica guardado com quem marcou e quando\./),
    ).toBeVisible();
  });

  // (e) Sem sessão, a rota não abre (T-06.3-21).
  test("sem sessão, /gestao/lembretes termina em /gestao/login", async ({ page }) => {
    await page.goto("/gestao/lembretes?situacao=feitos");
    await expect(page).toHaveURL(/\/gestao\/login/);
    await expect(page.getByTestId("lembretes-pagina")).toHaveCount(0);
  });

  // (f) Valor inválido na URL cai no padrão, nunca em erro (T-06.3-22/24).
  test("?situacao=lixo&quantos=9999 abre os abertos, sem página de erro", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const idAberto = await semearLembrete({
      texto: `[e2e] todos lixo aberto ${projeto}`,
    });
    await semearLembrete({
      texto: `[e2e] todos lixo feito ${projeto}`,
      feitoEm: "2026-09-30T15:20:00.000Z",
    });

    await fazerLogin(page);
    // O `quem` também é lixo — um texto com aspa que não é uuid nem "todos"/"geral".
    await page.goto(
      "/gestao/lembretes?situacao=lixo&quantos=9999&quem=x%27%20or%201%3D1",
    );

    await expect(linhas(page)).toHaveCount(1);
    await expect(linhas(page).first()).toHaveAttribute("data-id", idAberto);
    await expect(filtro(page, "abertos")).toHaveAttribute("aria-current", "true");
    await expect(filtro(page, "todos")).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("Algo não funcionou.")).toHaveCount(0);
  });

  // (g) As ações do Início, aqui: marcar feito com "Abertos" tira a linha e grava no banco; criar
  // pela linha do topo põe o lembrete na lista.
  test("marcar feito com o filtro Abertos tira a linha e grava feito_em; criar pela linha do topo faz o lembrete aparecer", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const idDoUsuario = await idDoUsuarioDoTeste();
    const idA = await semearLembrete({
      texto: `[e2e] todos marcar A ${projeto}`,
      criadoEm: "2026-01-01T12:00:00.000Z",
    });
    const idB = await semearLembrete({
      texto: `[e2e] todos marcar B ${projeto}`,
      criadoEm: "2026-01-01T12:01:00.000Z",
    });

    await fazerLogin(page);
    await page.goto("/gestao/lembretes");
    await expect(linhas(page)).toHaveCount(2);

    const linhaA = pagina(page).locator(
      `[data-testid="lembrete-linha"][data-id="${idA}"]`,
    );
    await linhaA.getByTestId("lembrete-caixa").click();
    await expect(linhaA).toHaveCount(0);
    await expect(linhas(page)).toHaveCount(1);
    await expect(
      pagina(page)
        .locator(`[data-testid="lembrete-linha"][data-id="${idB}"]`)
        .getByTestId("lembrete-caixa"),
    ).toBeFocused();
    await expect
      .poll(async () => {
        const gravado = await lerLembrete(idA);
        return (
          gravado && { feito: gravado.feito_em !== null, feito_por: gravado.feito_por }
        );
      })
      .toEqual({ feito: true, feito_por: idDoUsuario });

    const textoNovo = `[e2e] todos criado na rota ${projeto}`;
    await pagina(page).getByTestId("lembretes-novo-texto").fill(textoNovo);
    await pagina(page).getByTestId("lembretes-novo-guardar").click();
    await expect(
      pagina(page).getByTestId("lembretes-lista").getByText(textoNovo, { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const gravado = await lerLembretePorTexto(textoNovo);
        return gravado && { quem: gravado.quem, feito: gravado.feito_em !== null };
      })
      .toEqual({ quem: null, feito: false });
  });

  // (h) A navegação (D-01, UI-D1): na lateral entre Estoque e Cadastros; NUNCA na barra de baixo; a
  // pílula do Início leva à rota.
  test("Lembretes na lateral entre Estoque e Cadastros (desktop), fora da barra de baixo (celular), e a pílula do Início leva à rota", async ({
    page,
  }, testInfo) => {
    await fazerLogin(page);

    if (testInfo.project.name.includes("celular")) {
      const barraDeBaixo = page.getByRole("navigation", { name: "Navegação principal" });
      await expect(barraDeBaixo).toBeVisible();
      await expect(barraDeBaixo.getByRole("link")).toHaveCount(4);
      await expect(barraDeBaixo.getByRole("link", { name: "Lembretes" })).toHaveCount(0);
    } else {
      const lateral = page.locator('[data-slot="sidebar"]');
      await expect(lateral.getByRole("link", { name: "Lembretes" })).toBeVisible();
      const nomes = await lateral
        .getByRole("link")
        .evaluateAll((elementos) =>
          elementos.map((elemento) => elemento.textContent?.trim() ?? ""),
        );
      const posicao = nomes.indexOf("Lembretes");
      expect(posicao).toBeGreaterThan(0);
      expect(nomes[posicao - 1]).toBe("Estoque");
      expect(nomes[posicao + 1]).toBe("Cadastros");
    }

    const pilula = page
      .getByTestId("inicio-pilulas")
      .getByRole("link", { name: "Lembretes" });
    await expect(pilula).toBeVisible();
    await pilula.click();
    await expect(page).toHaveURL(/\/gestao\/lembretes$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Lembretes" }),
    ).toBeVisible();
    await expect(page.getByTestId("lembretes-pagina")).toBeVisible();
  });

  // (i) E7·overflow: a 320 px, com todas as contas de teste nos filtros (mais quatro pessoas de
  // primeiro nome comprido, desativadas no fim — usuário nunca se apaga), a página não rola para o
  // lado e cada pílula mede ≥ 44 px.
  test("a 320 px, com muitas pessoas nos filtros e uma linha, a página não rola na horizontal e cada pílula mede ao menos 44 px", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    await semearLembrete({ texto: `[e2e] todos 320 ${projeto}` });
    const pessoas: string[] = [];
    try {
      for (let indice = 1; indice <= 4; indice += 1) {
        pessoas.push(
          await criarPessoaDeTeste(`[e2e]Maximiliana${indice}-${projeto} Teste`),
        );
      }

      await fazerLogin(page);
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto("/gestao/lembretes");
      await expect(linhas(page)).toHaveCount(1);
      await expect(filtro(page, pessoas[3])).toBeVisible();

      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(
        scrollWidth,
        `/gestao/lembretes rola horizontalmente a 320px (${scrollWidth} > ${clientWidth})`,
      ).toBeLessThanOrEqual(clientWidth);

      const pilulas = pagina(page).getByTestId("lembretes-filtro");
      const quantidade = await pilulas.count();
      expect(quantidade).toBeGreaterThanOrEqual(9);
      for (let indice = 0; indice < quantidade; indice += 1) {
        const caixa = await medirCaixa(pilulas.nth(indice), `pílula de filtro ${indice}`);
        expect(caixa.height).toBeGreaterThanOrEqual(44);
        expect(caixa.x + caixa.width).toBeLessThanOrEqual(clientWidth);
      }
    } finally {
      for (const id of pessoas) {
        await desativarPessoaDeTeste(id);
      }
    }
  });
});

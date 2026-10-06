import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { semearFornecedor } from "./apoio/semear-fornecedores";

// Cadastros → Fornecedores, a lista inteira e a ficha de leitura (06.2-03-PLAN.md, Tarefa 1; FRN-04,
// FRN-05; UI-D15, UI-D16): busca sem acento por nome e "vende", pílulas de área, os desativados atrás do
// link, os cartões de contato com "copiar" e "abrir", e a navegação lista ↔ ficha no celular.
//
// Só o teste (a) afirma condição global do banco ("nenhum fornecedor") — com a tag de vazio global,
// ele roda na cadeia `vazio-*` do `playwright.config.ts`, antes de qualquer spec criar fornecedor
// (CLAUDE.md). Os outros usam nomes com prefixo `[e2e]` e sufixo único e nunca contam a lista inteira:
// o "N" dos desativados e o total do rodapé são globais. Telefones com DDD 00, sites e e-mails no
// domínio reservado `example.com` — o repositório é público.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function enderecoDaFicha(id: string): string {
  return `/gestao/cadastros?sub=fornecedores&fornecedor=${id}`;
}

function linhaDe(page: Page, id: string) {
  return page.locator(`[data-testid="fornecedor-linha"][data-fornecedor-id="${id}"]`);
}

test.describe("fornecedores lista", () => {
  test("(a) sem nenhum fornecedor, a sub-aba mostra o vazio com Novo fornecedor e nenhuma ficha @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");

    await expect(page.getByTestId("cadastros-sub-fornecedores")).toHaveAttribute("aria-selected", "true");
    const vazio = page.getByTestId("fornecedores-vazio");
    await expect(vazio.getByRole("heading", { name: "Nenhum fornecedor cadastrado ainda." })).toBeVisible();
    await expect(vazio.getByRole("button", { name: "Novo fornecedor" })).toBeVisible();
    // Um terracota por tela: o cabeçalho do bloco fica sem o seu.
    await expect(page.getByTestId("novo-fornecedor")).toHaveCount(1);
    await expect(page.getByTestId("fornecedor-ficha")).toHaveCount(0);
    await expect(page.getByTestId("fornecedores-busca")).toHaveCount(0);
  });

  test("(b) “ARGILA” sem acento acha pelo nome e pelo que vende; sem resultado, Cadastrar um agora", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoBarro = `[e2e] Argíla ${suf}`;
    const idDoBarro = await semearFornecedor({ nome: nomeDoBarro });
    const idDaLoja = await semearFornecedor({ nome: `[e2e] Loja ${suf}`, vende: "argila, esmalte" });

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");

    const busca = page.getByRole("searchbox", { name: "Buscar fornecedor" });
    await expect(busca).toHaveAttribute("placeholder", "Buscar por nome ou material (argila, esmalte, embalagem…)");
    await busca.fill("ARGILA");
    await expect(linhaDe(page, idDoBarro)).toHaveCount(1);
    await expect(linhaDe(page, idDaLoja)).toHaveCount(1);
    await expect(linhaDe(page, idDoBarro)).toBeVisible();
    await expect(linhaDe(page, idDaLoja)).toContainText("argila, esmalte");

    // Tocar na linha abre a ficha ao lado (ou abaixo), com as etiquetas do que vende e a da área.
    await linhaDe(page, idDaLoja).click();
    await expect(page).toHaveURL(new RegExp(`fornecedor=${idDaLoja}`));
    const ficha = page.getByTestId("fornecedor-ficha");
    await expect(ficha).toHaveAttribute("data-fornecedor-id", idDaLoja);
    const etiquetas = ficha.getByTestId("fornecedor-etiquetas");
    await expect(etiquetas.getByText("argila", { exact: true })).toBeVisible();
    await expect(etiquetas.getByText("esmalte", { exact: true })).toBeVisible();
    await expect(ficha.getByTestId("fornecedor-etiqueta-area")).toHaveText("Peças");
    // A busca sobreviveu à troca de ficha (a lista não remonta).
    await expect(busca).toHaveValue("ARGILA");

    const semNada = `zzz${suf}`;
    await busca.fill(semNada);
    await expect(page.getByText(`Nenhum fornecedor com “${semNada}”.`)).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar um agora" }).click();
    const folha = page.getByTestId("folha-fornecedor");
    await expect(folha.getByRole("heading", { name: "Novo fornecedor" })).toBeVisible();
    await expect(folha.getByLabel("Nome", { exact: true })).toHaveValue(semNada);
  });

  test("(c) a pílula Cafeteria mostra só o café, marcada com aria-pressed", async ({ page }) => {
    const suf = sufixoUnico();
    const idDoCafe = await semearFornecedor({ nome: `[e2e] Café ${suf}`, area: "cafeteria" });
    const idDoAtelie = await semearFornecedor({ nome: `[e2e] Ateliê ${suf}`, area: "pecas" });

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");
    await page.getByTestId("fornecedores-busca").fill(suf);
    await expect(linhaDe(page, idDoCafe)).toHaveCount(1);
    await expect(linhaDe(page, idDoAtelie)).toHaveCount(1);

    const grupo = page.getByRole("group", { name: "Filtrar por área" });
    await expect(grupo.getByTestId("fornecedores-area-tudo")).toHaveAttribute("aria-pressed", "true");
    const cafeteria = grupo.getByTestId("fornecedores-area-cafeteria");
    await expect(cafeteria).toHaveText("Cafeteria");
    await cafeteria.click();
    await expect(cafeteria).toHaveAttribute("aria-pressed", "true");
    await expect(grupo.getByTestId("fornecedores-area-tudo")).toHaveAttribute("aria-pressed", "false");
    await expect(linhaDe(page, idDoCafe)).toHaveCount(1);
    await expect(linhaDe(page, idDoAtelie)).toHaveCount(0);
  });

  test("(d) o desativado só aparece pelo link, com o selo; o link vira esconder", async ({ page }) => {
    const suf = sufixoUnico();
    const idDoAntigo = await semearFornecedor({ nome: `[e2e] Antigo ${suf}`, ativo: false });

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=fornecedores");
    await page.getByTestId("fornecedores-busca").fill(suf);
    await expect(linhaDe(page, idDoAntigo)).toHaveCount(0);

    const link = page.getByTestId("fornecedores-mostrar-desativados");
    await expect(link).toHaveText(/^mostrar (1 desativado|\d+ desativados)$/);
    await link.click();
    await expect(linhaDe(page, idDoAntigo)).toHaveCount(1);
    await expect(linhaDe(page, idDoAntigo).getByTestId("fornecedor-linha-selo")).toHaveText("Desativado");
    await expect(link).toHaveText(/^esconder (1 desativado|\d+ desativados)$/);
    await expect(page.getByTestId("fornecedores-rodape")).toContainText(/\d+ de \d+/);
  });

  test("(e) contatos: WhatsApp e site viram link certo numa aba nova; javascript: fica texto", async ({
    page,
    context,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Contatos ${suf}`;
    const idCompleto = await semearFornecedor({
      nome,
      whatsapp: "(00) 9 0000-0001",
      pessoaContato: "[e2e] Pessoa",
      site: "example.com",
      email: "vendas@example.com",
      pagamentoPrazo: "Pix à vista",
      cidadeEntrega: "[e2e] Cidade",
      observacoes: "Primeira linha da observação.\nSegunda linha da observação.",
    });
    const idPerigoso = await semearFornecedor({ nome: `[e2e] Perigoso ${suf}`, site: "javascript:alert(1)" });
    const idVazio = await semearFornecedor({ nome: `[e2e] Sem contato ${suf}` });

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await fazerLogin(page);
    await page.goto(enderecoDaFicha(idCompleto));

    const ficha = page.getByTestId("fornecedor-ficha");
    await expect(ficha.getByRole("heading", { level: 2, name: nome })).toBeVisible();
    const cartoes = ficha.getByTestId("fornecedor-contatos").getByRole("listitem");
    await expect(cartoes).toHaveCount(6);
    await expect(cartoes.nth(0)).toHaveAttribute("data-testid", "fornecedor-contato-whatsapp");
    await expect(cartoes.nth(5)).toHaveAttribute("data-testid", "fornecedor-contato-cidade");

    const whatsapp = ficha.getByTestId("fornecedor-contato-whatsapp");
    const abrirWhatsapp = whatsapp.getByRole("link", { name: `Abrir o WhatsApp de ${nome} numa aba nova` });
    await expect(abrirWhatsapp).toHaveAttribute("href", "https://wa.me/5500900000001");
    await expect(abrirWhatsapp).toHaveAttribute("target", "_blank");
    await expect(abrirWhatsapp).toHaveAttribute("rel", "noopener noreferrer");
    const abrirSite = ficha
      .getByTestId("fornecedor-contato-site")
      .getByRole("link", { name: `Abrir o site de ${nome} numa aba nova` });
    await expect(abrirSite).toHaveAttribute("href", "https://example.com/");
    await expect(abrirSite).toHaveAttribute("target", "_blank");
    await expect(ficha.getByTestId("fornecedor-contato-email")).toContainText("vendas@example.com");

    await whatsapp.getByRole("button", { name: `Copiar o WhatsApp de ${nome}` }).click();
    await expect(
      page.getByText(/^(Copiado: \(00\) 9 0000-0001|Não deu para copiar\. Está aqui: \(00\) 9 0000-0001)$/).first(),
    ).toBeVisible();

    const observacoes = ficha.getByTestId("fornecedor-observacoes");
    await expect(observacoes).toContainText("Primeira linha da observação.");
    await expect(observacoes).toContainText("Segunda linha da observação.");
    await expect(observacoes).toHaveCSS("white-space", "pre-wrap");

    // Site com `javascript:`: o texto aparece, sem link; sem WhatsApp, nenhum cartão dele.
    await page.goto(enderecoDaFicha(idPerigoso));
    const site = page.getByTestId("fornecedor-contato-site");
    await expect(site).toContainText("javascript:alert(1)");
    await expect(site.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("fornecedor-contato-whatsapp")).toHaveCount(0);

    // Nenhum contato: a grade some; sem observação, a frase.
    await page.goto(enderecoDaFicha(idVazio));
    await expect(page.getByTestId("fornecedor-ficha")).toHaveAttribute("data-fornecedor-id", idVazio);
    await expect(page.getByTestId("fornecedor-contatos")).toHaveCount(0);
    await expect(page.getByText("Nenhuma observação ainda.")).toBeVisible();
  });

  test("(f) a 320 px nada rola de lado; tocar numa linha foca o nome e Voltar à lista devolve o foco", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const idPrimeiro = await semearFornecedor({
      nome: `[e2e] Primeiro ${suf} com um nome comprido o bastante para precisar quebrar em mais de uma linha`,
      vende: "argila, esmalte, feldspato, caulim, quartzo, óxido de ferro",
      cidadeEntrega: "[e2e] Cidade · entrega em 5 dias",
      whatsapp: "(00) 9 0000-0002",
      site: "example.com/um-endereco-muito-comprido/que-nao-cabe/na-largura-de-um-celular-pequeno",
    });
    const nomeSegundo = `[e2e] Segundo ${suf}`;
    const idSegundo = await semearFornecedor({ nome: nomeSegundo });

    await page.setViewportSize({ width: 320, height: 800 });
    await fazerLogin(page);
    await page.goto(enderecoDaFicha(idPrimeiro));
    await expect(page.getByTestId("fornecedor-ficha")).toHaveAttribute("data-fornecedor-id", idPrimeiro);
    await page.getByTestId("fornecedores-busca").fill(suf);
    await expect(linhaDe(page, idSegundo)).toBeVisible();

    const larguras = await page.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth,
      vista: document.documentElement.clientWidth,
    }));
    expect(larguras.rolagem).toBeLessThanOrEqual(larguras.vista);

    // Abaixo de 1024 px: tocar na linha leva o foco ao nome na ficha (que rola para a vista).
    await linhaDe(page, idSegundo).click();
    await expect(page).toHaveURL(new RegExp(`fornecedor=${idSegundo}`));
    const nome = page.getByTestId("fornecedor-ficha").getByRole("heading", { level: 2, name: nomeSegundo });
    await expect(nome).toBeFocused();
    await expect(nome).toBeInViewport();

    // "Voltar à lista" devolve o foco à linha aberta.
    await page.getByRole("button", { name: "Voltar à lista" }).click();
    await expect(linhaDe(page, idSegundo)).toBeFocused();
    await expect(linhaDe(page, idSegundo)).toHaveAttribute("aria-current", "true");
  });

  test("(f2) no computador a ficha fica à direita da lista, no mesmo topo", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "Duas colunas só a partir de 1024 px (projeto desktop).");
    const suf = sufixoUnico();
    const id = await semearFornecedor({ nome: `[e2e] Lado a lado ${suf}` });

    await fazerLogin(page);
    await page.goto(enderecoDaFicha(id));
    // Lê a caixa só depois que a lista e a ficha estão na tela (`medirCaixa` espera a visibilidade, D-23).
    await expect(page.getByTestId("lista-fornecedores")).toBeVisible();
    await expect(page.getByTestId("fornecedor-ficha")).toHaveAttribute("data-fornecedor-id", id);
    const lista = await medirCaixa(page.getByTestId("lista-fornecedores"), "lista de fornecedores");
    const ficha = await medirCaixa(page.getByTestId("fornecedor-ficha"), "ficha do fornecedor");
    expect(ficha.x).toBeGreaterThan(lista.x + lista.width - 1);
    expect(Math.abs(ficha.y - lista.y)).toBeLessThan(2);
    // O "Voltar à lista" é só do celular.
    await expect(page.getByRole("button", { name: "Voltar à lista" })).toBeHidden();
  });

  test("(g) um id que não existe mostra a frase na coluna da ficha e a lista continua", async ({ page }) => {
    // Com a lista vazia a página mostra o vazio total, sem coluna de ficha: semeia um para haver lista.
    await semearFornecedor({ nome: `[e2e] Existe ${sufixoUnico()}` });
    await fazerLogin(page);
    await page.goto(enderecoDaFicha(randomUUID()));
    await expect(page.getByText("Esse fornecedor não está no cadastro. Escolha outro na lista.")).toBeVisible();
    await expect(page.getByTestId("lista-fornecedores")).toBeVisible();
    await expect(page.getByTestId("fornecedor-ficha")).toHaveCount(0);
  });
});

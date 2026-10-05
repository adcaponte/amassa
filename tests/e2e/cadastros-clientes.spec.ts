import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { clientesComNome, semearCliente } from "./apoio/semear-agenda";

// Cadastros → Clientes (05-04-PLAN.md, Tarefa 1; D-01, D-16, AGE-06): o cadastro de pessoas do
// sistema — o MESMO das Pessoas da Agenda. Criar, achar sem acento, o aviso de homônimo (avisa, não
// grava, e o gestor decide), editar, os erros embaixo do campo e a fileira de pílulas a 320px.
//
// Só o caso `@vazio-global` afirma "nenhum cliente" — ele roda na cadeia `vazio-*`, antes de qualquer
// spec criar pessoas (CLAUDE.md: teste não afirma condição global do banco sem isolamento). Os outros
// usam nomes com sufixo único e prefixo `[e2e]`, telefones fictícios evidentes.

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

function enderecoDaBusca(busca: string): string {
  return `/gestao/cadastros?sub=clientes&busca=${encodeURIComponent(busca)}`;
}

test.describe("cadastros clientes", () => {
  test("(a) sem nenhum cliente, a sub-aba Clientes mostra o vazio com Novo cliente @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=clientes");

    await expect(page.getByTestId("cadastros-sub-clientes")).toHaveAttribute("aria-selected", "true");
    const vazio = page.getByTestId("clientes-vazio");
    await expect(vazio.getByRole("heading", { name: "Nenhum cliente cadastrado ainda." })).toBeVisible();
    await expect(
      vazio.getByText("Clientes nascem aqui ou pela Agenda (Pessoas → + Pessoa) — é o mesmo cadastro."),
    ).toBeVisible();
    await expect(vazio.getByRole("button", { name: "Novo cliente" })).toBeVisible();
  });

  test("(b) cadastrar com telefone e achar digitando sem acento", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] João ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=clientes");

    await page.getByTestId("novo-cliente").first().click();
    const formulario = page.getByTestId("formulario-cliente");
    await expect(formulario.getByRole("heading", { name: "Novo cliente" })).toBeVisible();
    await formulario.getByLabel("Nome").fill(nome);
    await formulario.getByLabel("Telefone (opcional)").fill("(00) 0000-0000");
    await formulario.getByRole("button", { name: "Salvar cliente" }).click();

    await expect(page.getByText("Pessoa cadastrada.").first()).toBeVisible();
    await expect(formulario).toBeHidden();
    expect(await clientesComNome(nome)).toHaveLength(1);

    // "joao" acha "João" — pela busca do servidor, por pedaço do nome.
    await page.getByRole("searchbox", { name: "Buscar pessoa" }).fill(`joao ${suf}`);
    await expect(page).toHaveURL(/busca=joao/);
    const linhas = page.getByTestId("cliente-linha");
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText(nome);
    await expect(linhas.first().getByTestId("cliente-linha-telefone")).toHaveText("(00) 0000-0000");

    // A dica diz que é o mesmo cadastro das Pessoas da Agenda.
    await expect(page.getByText("É o mesmo cadastro das Pessoas da Agenda.", { exact: false })).toBeVisible();
  });

  test("(c) homônimo: avisa com o telefone sem gravar; Usar filtra a lista; Criar outra pessoa grava a segunda", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeExistente = `[e2e] João ${suf}`;
    const nomeNovo = `[e2e] JOAO ${suf}`;
    await semearCliente({ nome: nomeExistente, telefone: "(00) 0000-0001" });

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=clientes");

    // 1ª tentativa: o aviso aparece, nada é gravado, e "Usar … que já existe" filtra a lista por ele.
    await page.getByTestId("novo-cliente").first().click();
    const formulario = page.getByTestId("formulario-cliente");
    await formulario.getByLabel("Nome").fill(nomeNovo);
    await formulario.getByRole("button", { name: "Salvar cliente" }).click();

    const aviso = formulario.getByTestId("aviso-homonimo");
    await expect(aviso).toContainText(`Já existe ${nomeExistente} · (00) 0000-0001. É a mesma pessoa?`);
    await expect(formulario).toBeVisible();
    expect(await clientesComNome(nomeNovo)).toHaveLength(1);

    await aviso.getByRole("button", { name: `Usar ${nomeExistente} que já existe` }).click();
    await expect(formulario).toBeHidden();
    await expect(page.getByRole("searchbox", { name: "Buscar pessoa" })).toHaveValue(nomeExistente);
    await expect(page.getByTestId("cliente-linha")).toHaveCount(1);
    expect(await clientesComNome(nomeNovo)).toHaveLength(1);

    // 2ª tentativa: "Criar outra pessoa" grava a segunda — homônimo permitido (D-16), nada fundido.
    await page.getByTestId("novo-cliente").first().click();
    await formulario.getByLabel("Nome").fill(nomeNovo);
    await formulario.getByRole("button", { name: "Salvar cliente" }).click();
    await expect(aviso).toContainText(`Já existe ${nomeExistente}`);
    await aviso.getByRole("button", { name: "Criar outra pessoa" }).click();

    await expect(page.getByText("Pessoa cadastrada.").first()).toBeVisible();
    await expect(formulario).toBeHidden();
    expect(await clientesComNome(nomeNovo)).toHaveLength(2);

    // As duas na lista, distinguidas pelo telefone / "sem telefone" (só o nome).
    const linhas = page.getByTestId("cliente-linha");
    await expect(linhas).toHaveCount(2);
    await expect(linhas.filter({ hasText: nomeExistente })).toContainText("(00) 0000-0001");
    await expect(linhas.filter({ hasText: nomeNovo }).getByTestId("cliente-linha-telefone")).toHaveCount(0);
  });

  test("(d) editar o telefone; editar o nome para o de um homônimo avisa e grava com Salvar mesmo assim", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeA = `[e2e] Pessoa ${suf} A`;
    const nomeB = `[e2e] Pessoa ${suf} B`;
    await semearCliente({ nome: nomeA, telefone: "(00) 0000-0002" });
    await semearCliente({ nome: nomeB, telefone: null });

    await fazerLogin(page);
    await page.goto(enderecoDaBusca(`pessoa ${suf}`));
    await expect(page.getByTestId("cliente-linha")).toHaveCount(2);

    // O telefone de A.
    await page.getByRole("button", { name: `Editar ${nomeA}` }).click();
    const formulario = page.getByTestId("formulario-cliente");
    await expect(formulario.getByRole("heading", { name: `Editar ${nomeA}` })).toBeVisible();
    await formulario.getByLabel("Telefone (opcional)").fill("(00) 0000-0003");
    await formulario.getByRole("button", { name: "Salvar cliente" }).click();
    await expect(page.getByText("Cadastro salvo.").first()).toBeVisible();
    await expect(formulario).toBeHidden();
    await expect(
      page.getByTestId("cliente-linha").filter({ hasText: nomeA }).getByTestId("cliente-linha-telefone"),
    ).toHaveText("(00) 0000-0003");

    // B passa a se chamar como A (sem acento e em maiúsculas): só o aviso, e "Salvar mesmo assim".
    await page.getByRole("button", { name: `Editar ${nomeB}` }).click();
    await formulario.getByLabel("Nome").fill(nomeA.toUpperCase());
    await formulario.getByRole("button", { name: "Salvar cliente" }).click();
    const aviso = formulario.getByTestId("aviso-homonimo");
    await expect(aviso).toContainText(`Já existe ${nomeA} · (00) 0000-0003. É a mesma pessoa?`);
    await expect(aviso.getByRole("button")).toHaveCount(0);
    await formulario.getByRole("button", { name: "Salvar mesmo assim" }).click();
    // O formulário só fecha depois de o servidor gravar. O toast "Cadastro salvo." da edição anterior
    // ainda pode estar na tela — esperar por ele aqui seria esperar pelo toast velho.
    await expect(formulario).toBeHidden();
    expect(await clientesComNome(nomeA)).toHaveLength(2);
  });

  test("(e) nome vazio, só espaços ou com 161 caracteres e telefone de 41 mostram o erro embaixo do campo; toque duplo cria um só", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Duplo ${suf}`;

    await fazerLogin(page);
    await page.goto("/gestao/cadastros?sub=clientes");
    await page.getByTestId("novo-cliente").first().click();
    const formulario = page.getByTestId("formulario-cliente");
    const salvar = formulario.getByTestId("cliente-salvar");

    await salvar.click();
    await expect(formulario.getByTestId("cliente-erro-nome")).toHaveText("Diga o nome da pessoa.");

    // Só espaços: recusado no servidor (a tela não valida antes).
    await formulario.getByLabel("Nome").fill("     ");
    await salvar.click();
    await expect(formulario.getByTestId("cliente-erro-nome")).toHaveText("Diga o nome da pessoa.");

    await formulario.getByLabel("Nome").fill("a".repeat(161));
    await salvar.click();
    await expect(formulario.getByTestId("cliente-erro-nome")).toHaveText("O nome pode ter até 160 caracteres.");

    await formulario.getByLabel("Nome").fill(nome);
    await formulario.getByLabel("Telefone (opcional)").fill("0".repeat(41));
    await salvar.click();
    await expect(formulario.getByTestId("cliente-erro-telefone")).toHaveText(
      "O telefone pode ter até 40 caracteres.",
    );
    expect(await clientesComNome(nome)).toHaveLength(0);

    // Toque duplo: o botão trava enquanto grava — uma pessoa só.
    await formulario.getByLabel("Telefone (opcional)").fill("");
    await salvar.dblclick();
    await expect(page.getByText("Pessoa cadastrada.").first()).toBeVisible();
    await expect(formulario).toBeHidden();
    expect(await clientesComNome(nome)).toHaveLength(1);
  });

  test("(f) a 320px, as pílulas de Cadastros não fazem a página rolar de lado e “Clientes” cabe inteira na fileira única", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/gestao/cadastros?sub=clientes");
    await expect(page.getByTestId("cadastros-sub-clientes")).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth, `rola de lado a 320px (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(clientWidth);

    // Fase 06.5 (D-09, 06.5-04-PLAN.md): uma fileira só, com rolagem lateral — Catálogo · Clientes ·
    // Fornecedores · Contas fixas · … na mesma altura, e "Clientes" inteira dentro do trilho.
    const caixaTrilho = await medirCaixa(page.getByTestId("cadastros-abas-trilho"));
    const caixaCatalogo = await medirCaixa(page.getByTestId("cadastros-sub-catalogo"));
    const caixaClientes = await medirCaixa(page.getByTestId("cadastros-sub-clientes"));
    const caixaFixas = await medirCaixa(page.getByTestId("cadastros-sub-fixas"));
    expect(Math.abs(caixaClientes.y - caixaCatalogo.y)).toBeLessThan(2);
    expect(Math.abs(caixaFixas.y - caixaClientes.y)).toBeLessThan(2);
    expect(caixaClientes.x).toBeGreaterThanOrEqual(caixaTrilho.x - 0.5);
    expect(caixaClientes.x + caixaClientes.width).toBeLessThanOrEqual(caixaTrilho.x + caixaTrilho.width + 0.5);

    // "Clientes" numa linha só, dentro da pílula.
    const linhasDoRotulo = await page.getByTestId("cadastros-sub-clientes").evaluate((elemento) => {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(elemento);
      return new Set([...intervalo.getClientRects()].map((retangulo) => Math.round(retangulo.top))).size;
    });
    expect(linhasDoRotulo).toBe(1);
  });
});

import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";

import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  clientesComNome,
  marcarPresencaNoBanco,
  semearCliente,
  semearInscricao,
  semearOficina,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// A aba Pessoas da Agenda (05-04-PLAN.md, Tarefa 2; AGE-06, D-01): as abas da Agenda, a busca sem
// acento, "+ Pessoa" (o mesmo formulário de Cadastros → Clientes) e a ficha da pessoa com as últimas
// vindas. Só o caso `@vazio-global` afirma "ninguém cadastrado" — ele roda na cadeia `vazio-*`, antes
// de qualquer spec criar pessoas (CLAUDE.md). Os outros usam nomes com sufixo único e prefixo `[e2e]`;
// "hoje" e "ontem" são dias de Brasília (`somarDiasAoHoje`).

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
  return `/gestao/agenda?aba=pessoas&busca=${encodeURIComponent(busca)}`;
}

test.describe("agenda pessoas", () => {
  test("(a) sem ninguém cadastrado, Pessoas mostra o vazio com + Pessoa como primário @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/gestao/agenda?aba=pessoas");

    // Pelo papel, não pelo `data-testid`: logo depois do `goto`, enquanto o React 19 segura a revelação do
    // `Suspense`, a cópia ainda OCULTA das abas convive com a visível — o `data-testid` acha as duas (strict
    // mode); o papel acessível só a visível. (Plano 05-14: apareceu ao entrar a aba Números.)
    await expect(page.getByRole("tab", { name: "Pessoas" })).toHaveAttribute("aria-selected", "true");
    const vazio = page.getByTestId("pessoas-vazio");
    await expect(vazio.getByRole("heading", { name: "Ninguém cadastrado ainda." })).toBeVisible();
    await expect(
      vazio.getByText("Cadastre a primeira pessoa — ela aparece também em Cadastros → Clientes."),
    ).toBeVisible();
    // Um "+ Pessoa" só — o do cabeçalho some no vazio.
    await expect(page.getByRole("button", { name: "+ Pessoa" })).toHaveCount(1);
    await expect(page.getByTestId("busca-pessoa")).toHaveCount(0);
  });

  test("(b) + Pessoa sem telefone: o toast, e a ficha abre com sem telefone e Ainda não veio.", async ({ page }) => {
    const nome = `[e2e] Maria ${sufixoUnico()}`;

    await fazerLogin(page);
    await page.goto("/gestao/agenda?aba=pessoas");
    await page.getByTestId("mais-pessoa").click();

    const formulario = page.getByTestId("formulario-cliente");
    await expect(formulario.getByRole("heading", { name: "Pessoa nova" })).toBeVisible();
    await formulario.getByLabel("Nome").fill(nome);
    await formulario.getByRole("button", { name: "Salvar pessoa" }).click();

    await expect(page.getByText("Pessoa cadastrada.").first()).toBeVisible();
    const ficha = page.getByTestId("ficha-pessoa");
    await expect(ficha.getByRole("heading", { name: nome })).toBeVisible();
    await expect(ficha.getByTestId("ficha-telefone")).toHaveText("sem telefone");
    await expect(ficha.getByTestId("ficha-sem-vindas")).toHaveText("Ainda não veio.");
    await expect(page).toHaveURL(/pessoa=/);
    expect(await clientesComNome(nome)).toHaveLength(1);

    // "Pronto" fecha a ficha e a pessoa está na lista (o mesmo cadastro de Cadastros → Clientes).
    await ficha.getByTestId("ficha-pronto").click();
    await expect(ficha).toBeHidden();
    await expect(page).not.toHaveURL(/pessoa=/);
  });

  test("(c) a busca acha por um pedaço do nome sem acento; sem resultado oferece Cadastrar “…”", async ({ page }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Márcia Antônia ${suf}`;
    await semearCliente({ nome, telefone: "(00) 0000-0000" });

    await fazerLogin(page);
    await page.goto("/gestao/agenda?aba=pessoas");
    await page.getByTestId("busca-pessoa").fill(`arcia antonia ${suf}`);
    await expect(page).toHaveURL(/busca=arcia/);
    const linhas = page.getByTestId("pessoa-linha");
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText(nome);
    await expect(linhas.first().getByTestId("pessoa-sub-linha")).toHaveText("(00) 0000-0000 · sem turma fixa");

    // Sem resultado: a frase e "Cadastrar “…”", que abre o formulário com o nome escrito.
    const semNinguem = `zz nada ${suf}`;
    await page.getByTestId("busca-pessoa").fill(semNinguem);
    await expect(page.getByTestId("pessoas-sem-resultado")).toContainText(`Nada encontrado para “${semNinguem}”.`);
    await page.getByRole("button", { name: `Cadastrar “${semNinguem}”` }).click();
    const formulario = page.getByTestId("formulario-cliente");
    await expect(formulario.getByLabel("Nome")).toHaveValue(semNinguem);
    await formulario.getByRole("button", { name: "Voltar" }).click();
    await expect(formulario).toBeHidden();
    expect(await clientesComNome(semNinguem)).toHaveLength(0);
  });

  test("(d) a ficha mostra a oficina de ontem com a tag veio; pessoa que não existe mais dá o toast e nada abre", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nome = `[e2e] Pessoa ${suf}`;
    const titulo = `[e2e] Oficina ${suf}`;
    const ontem = somarDiasAoHoje(-1);
    const clienteId = await semearCliente({ nome, telefone: null });
    const eventoId = await semearOficina({
      titulo,
      data: ontem,
      inicio: "14:00",
      fim: "16:00",
      vagas: 8,
      precoCentavos: 12000,
    });
    const inscricaoId = await semearInscricao({ eventoId, clienteId, tipo: "oficina", valorCentavos: 12000 });
    await marcarPresencaNoBanco(inscricaoId, "veio");

    await fazerLogin(page);
    await page.goto(enderecoDaBusca(nome));
    await page.getByRole("button", { name: `Abrir a ficha de ${nome}` }).click();

    const ficha = page.getByTestId("ficha-pessoa");
    await expect(ficha.getByRole("heading", { name: nome })).toBeVisible();
    const vinda = ficha.getByTestId("ficha-vinda");
    await expect(vinda).toHaveCount(1);
    await expect(vinda).toContainText(`${formatarDiaMes(ontem)} · ${titulo}`);
    await expect(vinda).toContainText("veio");

    // Link velho: o toast, a folha não abre e o parâmetro sai da URL.
    await page.goto(`/gestao/agenda?aba=pessoas&pessoa=${randomUUID()}`);
    await expect(
      page.getByText("Esse lançamento não existe mais — talvez tenha sido removido em outro celular.").first(),
    ).toBeVisible();
    await expect(page.getByTestId("ficha-pessoa")).toHaveCount(0);
    await expect(page).not.toHaveURL(/pessoa=/);
  });

  test("(e) Editar na ficha muda o telefone, e a sub-linha da lista mostra o novo", async ({ page }) => {
    const nome = `[e2e] Pessoa ${sufixoUnico()}`;
    await semearCliente({ nome, telefone: "(00) 0000-0004" });

    await fazerLogin(page);
    await page.goto(enderecoDaBusca(nome));
    await page.getByRole("button", { name: `Abrir a ficha de ${nome}` }).click();
    const ficha = page.getByTestId("ficha-pessoa");
    await expect(ficha.getByTestId("ficha-telefone")).toHaveText("(00) 0000-0004");

    // Um diálogo por vez: o formulário troca a ficha.
    await ficha.getByTestId("ficha-editar").click();
    const formulario = page.getByTestId("formulario-cliente");
    await expect(formulario.getByRole("heading", { name: `Editar ${nome}` })).toBeVisible();
    await expect(ficha).toBeHidden();
    await formulario.getByLabel("Telefone (opcional)").fill("(00) 0000-0005");
    await formulario.getByRole("button", { name: "Salvar pessoa" }).click();

    await expect(page.getByText("Cadastro salvo.").first()).toBeVisible();
    await expect(formulario).toBeHidden();
    await expect(ficha.getByTestId("ficha-telefone")).toHaveText("(00) 0000-0005");

    await ficha.getByTestId("ficha-pronto").click();
    await expect(ficha).toBeHidden();
    await expect(
      page.getByTestId("pessoa-linha").filter({ hasText: nome }).getByTestId("pessoa-sub-linha"),
    ).toHaveText("(00) 0000-0005 · sem turma fixa");
  });

  test("(f) as abas trocam por ?aba= e o voltar do navegador volta à aba anterior", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao/agenda");

    const abas = page.getByRole("tablist", { name: "Partes da Agenda" });
    await expect(abas.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("agenda-semana")).toBeVisible();

    await abas.getByRole("tab", { name: "Pessoas" }).click();
    await expect(page).toHaveURL(/aba=pessoas/);
    await expect(abas.getByRole("tab", { name: "Pessoas" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("lista-pessoas")).toBeVisible();
    await expect(page.getByTestId("agenda-semana")).toHaveCount(0);

    await page.goBack();
    await expect(page).not.toHaveURL(/aba=pessoas/);
    await expect(abas.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("agenda-semana")).toBeVisible();
  });
});

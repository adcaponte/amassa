import { execSync } from "node:child_process";

import { test, expect, type Page, type Locator } from "@playwright/test";

import { somarDias } from "@/lib/abertura/parcelas";
import { hojeEmBrasilia } from "@/lib/abertura/formato";

import { alternarAtivo } from "./apoio/alternar-ativo";
import { semearTarefasDeAbertura } from "./apoio/semear-abertura";

// O traçado do lado de TAREFAS do módulo Abertura do Espaço (04.2-02-PLAN.md): cadastro com
// responsável escolhido entre os gestores ativos (D-11), "ninguém ainda" como estado válido
// (ABE-07), agrupamento por área ordenado por urgência dentro do grupo (D-09/D-10) e a recusa do
// servidor quando o identificador de responsável aponta para um gestor que deixou de estar ativo
// (T-04.2-07). `mode: "serial"` porque o último caso cria e desativa uma conta DEDICADA — nunca
// a conta global de `E2E_EMAIL_TESTE`, pela mesma razão documentada em `tests/e2e/sessao.spec.ts`
// (desativar a conta compartilhada colide com qualquer outro teste, de qualquer arquivo, que
// esteja logando com ela ao mesmo tempo).
//
// Nomes inventados e reconhecíveis como tal — nenhum dado de pessoa real, o repositório é
// público.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function sufixoUnico(): string {
  return `${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${sufixoUnico()}`;
}

// Cria uma conta de gestor DEDICADA a um teste (nunca a conta global) — mesmo padrão de
// `tests/e2e/sessao.spec.ts` para qualquer teste que precise mutar `ativo`. Devolve e-mail e
// nome, prontos para aparecer na lista de responsáveis enquanto a conta estiver ativa.
function criarGestorDedicado(rotulo: string): { nome: string; email: string } {
  const nome = `[e2e] Gestor ${rotulo} ${test.info().project.name}`;
  const email = `gestor.${rotulo}.${test.info().project.name}.${Date.now()}@exemplo.test`;

  execSync(`npm run criar-usuario -- --nome "${nome}" --email "${email}"`, {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
    encoding: "utf-8",
  });

  return { nome, email };
}

async function abrirFormularioDeTarefa(page: Page) {
  await page.goto("/abertura?aba=tarefas&tarefa=nova");
  await expect(page.getByRole("heading", { name: "Nova tarefa" })).toBeVisible();
}

function linhaDaTarefa(page: Page, descricao: string): Locator {
  return page.getByTestId("abertura-linha-tarefa").filter({ hasText: descricao });
}

test.describe("abertura tarefas — traçado do lado de tarefas do módulo Abertura do Espaço", () => {
  test.describe.configure({ mode: "serial" });

  test("uma tarefa cadastrada com responsável escolhido aparece com o nome do responsável", async ({
    page,
  }) => {
    await fazerLogin(page);
    const descricao = nomeUnico("Orçar instalação elétrica");

    await abrirFormularioDeTarefa(page);
    await page.getByLabel("O que fazer").fill(descricao);
    await page.getByRole("combobox", { name: "Quem" }).click();
    // A conta de teste global (`Gestora de Teste`, criada por `preparar-usuario.ts`) está
    // sempre ativa — é o gestor mais simples de escolher sem precisar de conta dedicada.
    await page.getByRole("option", { name: "Gestora de Teste" }).click();
    await page.getByLabel("Até quando").fill(hojeEmBrasilia(new Date()));
    await page.getByRole("button", { name: "Adicionar tarefa" }).click();

    await expect(page).toHaveURL(/\?aba=tarefas$/, { timeout: 10000 });

    const linha = linhaDaTarefa(page, descricao);
    await expect(linha).toBeVisible();
    await expect(linha.getByTestId("abertura-responsavel-tarefa")).toHaveText("Gestora de Teste");
  });

  test("uma tarefa salva com 'Ninguém ainda' grava responsavel_id nulo e aparece sem nome", async ({
    page,
  }) => {
    await fazerLogin(page);
    const descricao = nomeUnico("Definir horários das turmas");

    await abrirFormularioDeTarefa(page);
    await page.getByLabel("O que fazer").fill(descricao);
    // "Quem" já nasce em "Ninguém ainda" — nada a selecionar (ABE-07/D-11).
    await page.getByLabel("Até quando").fill(hojeEmBrasilia(new Date()));
    await page.getByRole("button", { name: "Adicionar tarefa" }).click();

    await expect(page).toHaveURL(/\?aba=tarefas$/, { timeout: 10000 });

    const linha = linhaDaTarefa(page, descricao);
    await expect(linha).toBeVisible();
    await expect(linha.getByTestId("abertura-responsavel-tarefa")).toHaveCount(0);
  });

  test("dentro de um grupo, a ordem é vencida → hoje → futura, e o cabeçalho conta as atrasadas com consistência", async ({
    page,
  }) => {
    const hoje = hojeEmBrasilia(new Date());
    const sufixo = sufixoUnico();

    const vencida = `[e2e] Vencida ${sufixo}`;
    const deHoje = `[e2e] Hoje ${sufixo}`;
    const futura = `[e2e] Futura ${sufixo}`;

    // Enchimento de ordenação (D-10) — a aritmética de urgência já é provada, determinística e
    // sem servidor, por tests/unit/abertura-prazos.test.ts; aqui só se prova que a TELA respeita
    // o contrato com dado real de banco.
    await semearTarefasDeAbertura([
      { descricao: vencida, grupo: "montagem", prazoEm: somarDias(hoje, -5) },
      { descricao: deHoje, grupo: "montagem", prazoEm: hoje },
      { descricao: futura, grupo: "montagem", prazoEm: somarDias(hoje, 7) },
    ]);

    await fazerLogin(page);
    await page.goto("/abertura?aba=tarefas");

    const grupo = page.getByTestId("abertura-grupo-tarefa").filter({ hasText: "Montagem" });
    await expect(grupo).toBeVisible();

    // Ordem relativa das nossas três linhas dentro do grupo, na ordem em que aparecem no DOM —
    // não a posição absoluta (o grupo pode ter tarefas de outros workers rodando em paralelo).
    const nomesNaOrdem = (await grupo.getByTestId("abertura-linha-tarefa").allInnerTexts()).filter(
      (texto) => texto.includes(sufixo),
    );
    expect(nomesNaOrdem).toHaveLength(3);
    expect(nomesNaOrdem[0]).toContain(vencida);
    expect(nomesNaOrdem[1]).toContain(deHoje);
    expect(nomesNaOrdem[2]).toContain(futura);

    // O texto de cada etiqueta de urgência.
    await expect(linhaDaTarefa(page, vencida).getByTestId("abertura-etiqueta-urgencia")).toHaveText(
      "5 dias atrás",
    );
    await expect(linhaDaTarefa(page, deHoje).getByTestId("abertura-etiqueta-urgencia")).toHaveText(
      "hoje",
    );
    await expect(linhaDaTarefa(page, futura).getByTestId("abertura-etiqueta-urgencia")).toHaveText(
      "em 7 dias",
    );

    // Consistência do cabeçalho: o número de atrasadas do grupo bate com a contagem real de
    // linhas com a etiqueta "atrasada" — nunca um valor absoluto (outro worker/teste pode ter
    // sua própria tarefa atrasada no MESMO grupo "Montagem" ao mesmo tempo).
    const atrasadasNoCabecalho = grupo.getByTestId("abertura-atrasadas-do-grupo");
    await expect(atrasadasNoCabecalho).toBeVisible();
    const textoCabecalho = (await atrasadasNoCabecalho.innerText()).trim();
    const casamento = /^(\d+)\s+atrasadas?$/.exec(textoCabecalho);
    if (!casamento) {
      throw new Error(`Formato inesperado do total de atrasadas: "${textoCabecalho}"`);
    }
    const contagemDoCabecalho = Number(casamento[1]);
    const contagemReal = await grupo.locator('[data-urgencia="atrasada"]').count();
    expect(contagemReal).toBe(contagemDoCabecalho);
  });

  test("salvar uma tarefa apontando para um gestor que deixou de estar ativo é recusado com frase humana", async ({
    page,
  }) => {
    const gestor = criarGestorDedicado("inativo-ao-salvar");

    try {
      await fazerLogin(page);
      const descricao = nomeUnico("Agendar entrega do forno");

      await abrirFormularioDeTarefa(page);
      await page.getByLabel("O que fazer").fill(descricao);
      await page.getByRole("combobox", { name: "Quem" }).click();
      await page.getByRole("option", { name: gestor.nome }).click();
      await page.getByLabel("Até quando").fill(hojeEmBrasilia(new Date()));

      // O gestor é desativado DEPOIS de escolhido no formulário e ANTES do envio — exatamente a
      // corrida que T-04.2-07 descreve: a chave estrangeira prova que o identificador existe,
      // mas não que ele continua sendo um gestor ativo no instante do salvamento.
      await alternarAtivo(gestor.email, false);

      await page.getByRole("button", { name: "Adicionar tarefa" }).click();

      await expect(
        page.getByText("Esse gestor não está mais ativo. Escolha outro ou deixe em «Ninguém ainda»."),
      ).toBeVisible();
      // O formulário permanece aberto com o que foi digitado — nada se perde (UI-SPEC §"Estados
      // de erro").
      await expect(page.getByLabel("O que fazer")).toHaveValue(descricao);
    } finally {
      await alternarAtivo(gestor.email, true);
    }
  });
});

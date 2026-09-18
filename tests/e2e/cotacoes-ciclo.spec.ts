import { execSync } from "node:child_process";

import { test, expect, type Page } from "@playwright/test";

import { fraseConfirmarRemoverCotacao } from "@/lib/cotacoes/textos";

// O ciclo de vida da cotação (04.3-03-PLAN.md): editar NO LUGAR (inclusive a situação), remover
// nomeando a empresa, e a consequência visível disso — a descartada que não desaparece, e o
// alerta que se vê de longe. "cotacoes ciclo" no título do bloco é o recorte usado pelo
// orçamento de e2e deste plano (`npm run test:e2e -- --grep "cotacoes ciclo"`).
//
// Modo SERIAL: o primeiro caso de cada tarefa cria uma categoria/cotação próprias (nomes
// únicos), mas o caso de "duas contas" (Tarefa 1) cria e desativa uma conta de gestor DEDICADA —
// mesma disciplina de `tests/e2e/abertura-tarefas.spec.ts`/`acessibilidade.spec.ts`: nunca a
// conta global de `E2E_EMAIL_TESTE`.
//
// Nomes inventados e reconhecíveis como tal ("Fornecedor de Teste", "Cerâmica Teste") — nenhum
// dado real de fornecedor em arquivo versionado (o repositório é público).

const OPCOES_EXECUCAO = {
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
  encoding: "utf-8" as const,
};

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Mesmo orçamento de caracteres documentado em `cotacoes-categorias.spec.ts`: o envoltório fixo
// consome ~35 pontos de código, então `rotulo` precisa caber em ~25.
function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Lê a linha "SENHA: ..." impressa por `scripts/criar-usuario.ts` — mesmo padrão de
// `tests/e2e/acessibilidade.spec.ts`. Devolve nome/e-mail/senha prontos para login de verdade.
function criarGestorDedicado(rotulo: string): { nome: string; email: string; senha: string } {
  const nome = `[e2e] Gestor ${rotulo} ${test.info().project.name}`;
  const email = `gestor.${rotulo}.${test.info().project.name}.${Date.now()}@exemplo.test`;

  const saida = execSync(
    `npm run criar-usuario -- --nome "${nome}" --email "${email}"`,
    OPCOES_EXECUCAO,
  );
  const linhaSenha = saida.split("\n").find((linha) => linha.startsWith("SENHA: "));
  if (!linhaSenha) {
    throw new Error(
      "scripts/criar-usuario.ts não imprimiu a linha 'SENHA: ' esperada — a conta dedicada não ficou pronta como esperado.",
    );
  }
  return { nome, email, senha: linhaSenha.slice("SENHA: ".length).trim() };
}

function desativarGestor(email: string) {
  execSync(`npm run desativar-usuario -- --email "${email}"`, OPCOES_EXECUCAO);
}

// As DUAS formas do mesmo dado (cartão <660px / linha ≥660px) convivem no DOM ao mesmo tempo,
// alternadas só por CSS — `filter({ visible: true })` é obrigatório (mesma disciplina de
// `cotacoes-tracador.spec.ts`/`cotacoes-categorias.spec.ts`).
function linhasOuCartoesVisiveis(page: Page) {
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
    await page.getByLabel("Preço").fill(dados.preco);
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

test.describe("cotacoes ciclo — editar no lugar, remover nomeando a empresa, descartado e alerta", () => {
  test.describe.configure({ mode: "serial" });

  test("editar no lugar: mesmo formulário, título e rótulo trocam, situação muda dentro dele, e o identificador não muda", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeCategoria = nomeUnico("Categoria Editar");
    const empresaOriginal = nomeUnico("Fornecedor Original");
    const empresaNova = nomeUnico("Fornecedor Editado");

    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeCategoria);
    await criarCotacao(page, { empresa: empresaOriginal, produto: "Forno 180L", preco: "1500" });

    const linhaOriginal = linhasOuCartoesVisiveis(page).filter({ hasText: empresaOriginal });
    await expect(linhaOriginal).toBeVisible();

    // Abre pelo botão de editar — o mesmo formulário, agora em modo de edição.
    await linhaOriginal.getByTestId("cotacoes-editar").click();
    await expect(page.getByRole("heading", { name: "Editar cotação" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar" })).toBeVisible();

    // Os campos vêm PREENCHIDOS com o que foi salvo.
    await expect(page.getByLabel("Empresa")).toHaveValue(empresaOriginal);
    await expect(page.getByLabel("Especificação do produto")).toHaveValue("Forno 180L");
    await expect(page.getByLabel("Preço")).toHaveValue("1500");
    // "cotando" é a situação padrão — o botão reflete o valor atual com `aria-pressed`.
    await expect(page.getByRole("button", { name: "cotando", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Edita empresa, preço e situação — os três botões de alternância, alvo de 44px ou mais.
    const botaoFavorito = page.getByRole("button", { name: "favorito", exact: true });
    const caixaFavorito = await botaoFavorito.boundingBox();
    expect(caixaFavorito?.height, "o botão de situação mede menos que 44px").toBeGreaterThanOrEqual(44);

    await page.getByLabel("Empresa").fill(empresaNova);
    await page.getByLabel("Preço").fill("3200");
    await botaoFavorito.click();
    await expect(botaoFavorito).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, { timeout: 10000 });

    // O nome ANTIGO desaparece por completo — não presumir que o novo o contém.
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaOriginal })).toHaveCount(0);
    const linhaNova = linhasOuCartoesVisiveis(page).filter({ hasText: empresaNova });
    await expect(linhaNova).toBeVisible();
    await expect(linhaNova.getByTestId("cotacoes-selo")).toHaveText("favorito");
    await expect(linhaNova.getByTestId("cotacoes-preco")).toHaveText("R$ 3.200");

    // A contagem da categoria não mudou — ainda é a MESMA linha, não uma nova.
    await expect(page.getByTestId("cotacoes-contagem")).toHaveText("1 cotação");
    await expect(linhasOuCartoesVisiveis(page)).toHaveCount(1);

    // Reabrir a edição pela MESMA linha mostra os valores NOVOS — prova de que o identificador
    // não mudou (uma linha extra apareceria na contagem/lista se tivesse apagado e recriado).
    await linhaNova.getByTestId("cotacoes-editar").click();
    await expect(page.getByRole("heading", { name: "Editar cotação" })).toBeVisible();
    await expect(page.getByLabel("Empresa")).toHaveValue(empresaNova);
    await expect(page.getByLabel("Preço")).toHaveValue("3200");
    await expect(page.getByRole("button", { name: "favorito", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Os botões de editar/remover nomeiam a empresa e ficam numa linha de 44px ou mais.
    const botaoEditarNaLinha = linhaNova.getByTestId("cotacoes-editar");
    const botaoRemoverNaLinha = linhaNova.getByTestId("cotacoes-remover");
    await expect(botaoEditarNaLinha).toHaveAttribute("aria-label", `Editar cotação de «${empresaNova}»`);
    await expect(botaoRemoverNaLinha).toHaveAttribute(
      "aria-label",
      `Remover cotação de «${empresaNova}»`,
    );
    const caixaLinha = await linhaNova.boundingBox();
    expect(caixaLinha?.height, "a linha/cartão da cotação mede menos que 44px").toBeGreaterThanOrEqual(44);
  });

  test("uma segunda conta de gestor, em contexto de navegador próprio, vê a cotação e a edita — a primeira sessão vê a edição ao recarregar", async ({
    page,
    browser,
  }) => {
    const gestor = criarGestorDedicado("duas-contas");
    let segundoContexto: Awaited<ReturnType<typeof browser.newContext>> | null = null;

    try {
      await fazerLogin(page);

      const nomeCategoria = nomeUnico("Categoria Compartilhada");
      const empresa = nomeUnico("Fornecedor Compartilhado");

      await page.goto("/abertura?aba=cotacoes");
      await criarCategoria(page, nomeCategoria);
      await criarCotacao(page, { empresa, preco: "1000" });
      const urlComACategoria = page.url();

      // Segundo contexto de navegador — sessão própria, cookie próprio, nunca a mesma aba.
      segundoContexto = await browser.newContext();
      const segundaPagina = await segundoContexto.newPage();
      await segundaPagina.goto("/login");
      await segundaPagina.getByLabel("E-mail").fill(gestor.email);
      await segundaPagina.getByLabel("Senha").fill(gestor.senha);
      await segundaPagina.getByRole("button", { name: "Entrar" }).click();
      await expect(segundaPagina).toHaveURL(/\/$/);

      // (a) A segunda conta VÊ a cotação criada pela primeira — nenhum filtro por usuário (D-17).
      await segundaPagina.goto(urlComACategoria);
      const linhaNaSegunda = linhasOuCartoesVisiveis(segundaPagina).filter({ hasText: empresa });
      await expect(linhaNaSegunda).toBeVisible();

      // (b) ... e CONSEGUE editá-la — muda o preço por essa segunda sessão.
      await linhaNaSegunda.getByTestId("cotacoes-editar").click();
      await expect(segundaPagina.getByRole("heading", { name: "Editar cotação" })).toBeVisible();
      await expect(segundaPagina.getByLabel("Empresa")).toHaveValue(empresa);
      await segundaPagina.getByLabel("Preço").fill("2500");
      await segundaPagina.getByRole("button", { name: "Salvar" }).click();
      await expect(segundaPagina).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, {
        timeout: 10000,
      });

      // Volta ao primeiro contexto, recarrega, e o preço NOVO está lá.
      await page.reload();
      const linhaNaPrimeira = linhasOuCartoesVisiveis(page).filter({ hasText: empresa });
      await expect(linhaNaPrimeira.getByTestId("cotacoes-preco")).toHaveText("R$ 2.500");
    } finally {
      if (segundoContexto) {
        await segundoContexto.close();
      }
      // Desativa a conta dedicada — nunca apaga a linha (CLAUDE.md §Exclusão, AUTH-09).
      desativarGestor(gestor.email);
    }
  });

  test("remover uma cotação nomeia a empresa, cancelar mantém tudo intacto, e o botão de perigo dentro da edição abre a mesma confirmação", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeCategoria = nomeUnico("Categoria Remover");
    const empresaA = nomeUnico("Fornecedor A");
    const empresaB = nomeUnico("Fornecedor B");

    await page.goto("/abertura?aba=cotacoes");
    await criarCategoria(page, nomeCategoria);
    await criarCotacao(page, { empresa: empresaA });
    await criarCotacao(page, { empresa: empresaB });

    await expect(page.getByTestId("cotacoes-contagem")).toHaveText("2 cotações");

    const linhaA = linhasOuCartoesVisiveis(page).filter({ hasText: empresaA });
    await expect(linhaA).toBeVisible();

    // Abre a confirmação pelo botão de remover da linha/cartão — o texto NOMEIA a empresa.
    await linhaA.getByTestId("cotacoes-remover").click();
    const fraseA = fraseConfirmarRemoverCotacao(empresaA);
    await expect(page.getByText(fraseA)).toBeVisible();

    // Cancelar mantém tudo intacto: as duas cotações continuam lá.
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaA })).toBeVisible();
    await expect(page.getByTestId("cotacoes-contagem")).toHaveText("2 cotações");

    // O caminho pelo botão de perigo DENTRO do formulário de edição abre a MESMA confirmação —
    // nunca um segundo diálogo, nunca uma remoção direta.
    await linhaA.getByTestId("cotacoes-editar").click();
    await expect(page.getByRole("heading", { name: "Editar cotação" })).toBeVisible();
    await page.getByRole("button", { name: "Excluir cotação" }).click();
    await expect(page.getByText(fraseA)).toBeVisible();

    // Confirma de verdade.
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page).toHaveURL(/\/abertura\?aba=cotacoes&categoria=[0-9a-f-]+$/, { timeout: 10000 });

    // (a) a linha de A desapareceu; (b) a de B continua; (c) a contagem caiu exatamente em um.
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaA })).toHaveCount(0);
    await expect(linhasOuCartoesVisiveis(page).filter({ hasText: empresaB })).toBeVisible();
    await expect(page.getByTestId("cotacoes-contagem")).toHaveText("1 cotação");
  });
});

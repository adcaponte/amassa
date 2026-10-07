import { test, expect, type Page } from "@playwright/test";

import {
  FRASE_FALHA_AO_CRIAR_NOVO,
  FRASE_NADA_SALVO_ATE_PREENCHER,
} from "@/lib/orcamentos/textos";

import { abrirOrcamentoNovo, criarOrcamentoPelaTela } from "./apoio/novo-orcamento";

// “Novo orçamento” só cria o registro quando algo é preenchido (06.5-14-PLAN.md, D-15, achado 22 do
// Cowork: o ORC-004 “Sem título” esquecido). Nenhum teste aqui conta orçamentos do banco inteiro:
// “nada foi criado” é provado pela ausência de chamada de Server Action, e “um só” é contado pelo
// cliente inventado e único deste teste. Nomes inventados — o repositório é público.

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

// Toda Server Action do Next sai num POST com o cabeçalho `next-action`.
function registrarChamadasDeAcao(page: Page): string[] {
  const chamadas: string[] = [];
  page.on("request", (requisicao) => {
    if (requisicao.method() === "POST" && requisicao.headers()["next-action"]) {
      chamadas.push(requisicao.url());
    }
  });
  return chamadas;
}

test.describe("polimento orçamento novo", () => {
  test("tocar “Novo orçamento” não grava nada; sair sem preencher não cria nada nem diz nada", async ({
    page,
  }) => {
    await fazerLogin(page);
    const chamadas = registrarChamadasDeAcao(page);

    await abrirOrcamentoNovo(page);
    await expect(
      page.getByRole("heading", { name: "Novo orçamento", level: 2 }),
    ).toBeVisible();
    await expect(page.getByTestId("orcamento-nao-salvo")).toHaveText(
      FRASE_NADA_SALVO_ATE_PREENCHER,
    );
    // O editor de um orçamento existente não está aqui: nem número, nem chip.
    await expect(page.getByTestId("orcamento-numero")).toHaveCount(0);
    await expect(page.getByTestId("orcamento-chip")).toHaveCount(0);

    // Só espaços no Cliente e o Título vazio: sair dos dois não chama nada.
    const cliente = page.getByTestId("orcamento-campo-cliente");
    const titulo = page.getByTestId("orcamento-campo-titulo");
    await cliente.fill("   ");
    await titulo.focus();
    await titulo.blur();
    await expect(
      page.locator("#orcamento-novo-erro-cliente, #orcamento-novo-erro-titulo"),
    ).toHaveCount(0);

    // Volta para a lista pelo “◀ Todos”: nada foi gravado no caminho.
    await page.getByRole("link", { name: "◀ Todos" }).click();
    await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=orcamentos$/);
    await expect(page.getByTestId("orcamentos-lista")).toBeVisible();
    expect(chamadas, "nenhuma Server Action pode ter sido chamada").toEqual([]);
  });

  test("o primeiro campo preenchido cria o orçamento com ele, troca a URL e vira o editor de hoje", async ({
    page,
  }) => {
    const nomeDoCliente = `[e2e] Cliente novo orçamento ${sufixoUnico()}`;
    await fazerLogin(page);

    const id = await criarOrcamentoPelaTela(page, nomeDoCliente);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);

    // O editor de hoje: número já atribuído, chip “rascunho”, o cliente gravado; a frase sumiu.
    await expect(page.getByTestId("orcamento-numero")).toHaveText(/^nº ORC-\d{4}-\d{3}$/);
    await expect(page.getByTestId("orcamento-chip")).toContainText("rascunho");
    await expect(page.getByTestId("orcamento-campo-cliente")).toHaveValue(nomeDoCliente);
    await expect(page.getByTestId("orcamento-nao-salvo")).toHaveCount(0);

    // `replace`: o “voltar” do navegador cai na lista, nunca de novo no orçamento vazio.
    await page.goBack();
    await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=orcamentos$/);

    // Na lista (carregada de novo, nunca a do cache do navegador), um único orçamento deste cliente.
    await page.goto("/gestao/financeiro?aba=orcamentos");
    await expect(page.getByTestId("orcamentos-lista")).toBeVisible();
    await expect(
      page.getByTestId("orcamento-linha").filter({ hasText: nomeDoCliente }),
    ).toHaveCount(1);
  });
  test("a primeira gravação que falha avisa no campo e não perde o texto; sair dele de novo cria", async ({
    page,
  }) => {
    const nomeDoCliente = `[e2e] Cliente sem internet ${sufixoUnico()}`;
    await fazerLogin(page);
    await abrirOrcamentoNovo(page);

    // A Server Action é um POST para a própria página, com o cabeçalho `next-action`: a primeira
    // não chega ao servidor (a internet caiu); as seguintes passam.
    let derrubadas = 0;
    await page.route("**/gestao/financeiro**", async (rota) => {
      const requisicao = rota.request();
      if (
        derrubadas === 0 &&
        requisicao.method() === "POST" &&
        requisicao.headers()["next-action"]
      ) {
        derrubadas += 1;
        await rota.abort("internetdisconnected");
        return;
      }
      await rota.continue();
    });

    try {
      const campo = page.getByTestId("orcamento-campo-cliente");
      await campo.fill(nomeDoCliente);
      await campo.blur();

      const alerta = page.locator("#orcamento-novo-erro-cliente");
      await expect(alerta).toHaveText(FRASE_FALHA_AO_CRIAR_NOVO);
      await expect(alerta).toHaveAttribute("role", "alert");
      await expect(campo).toHaveValue(nomeDoCliente);
      await expect(campo).toBeEnabled();
      await expect(page).toHaveURL(
        /\/gestao\/financeiro\?aba=orcamentos&orcamento=novo$/,
      );
      expect(derrubadas).toBe(1);

      // A internet volta: sair do campo outra vez cria o orçamento, com o mesmo texto.
      await campo.focus();
      await campo.blur();
      await expect(page).toHaveURL(/orcamento=[0-9a-f]{8}-[0-9a-f-]{27}$/i, {
        timeout: 15000,
      });
      await expect(page.getByTestId("orcamento-cabecalho")).toBeVisible();
      await expect(page.getByTestId("orcamento-campo-cliente")).toHaveValue(
        nomeDoCliente,
      );
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }

    // A tentativa derrubada não criou nada: um único orçamento deste cliente.
    await page.goto("/gestao/financeiro?aba=orcamentos");
    await expect(page.getByTestId("orcamentos-lista")).toBeVisible();
    await expect(
      page.getByTestId("orcamento-linha").filter({ hasText: nomeDoCliente }),
    ).toHaveCount(1);
  });
});

import { test, expect, type Page } from "@playwright/test";

import {
  diaEmBrasilia,
  diaMes,
  definirInicioNoBanco,
  ordemNoBanco,
  pagoEmDaParcela,
  semearOrdemDeOrcamento,
} from "./apoio/semear-producao";

// A ordem que aguarda o sinal (Fase 06.1, plano 03, PRD-11, critério 1 do ROADMAP): vinda de
// orçamento aprovado, ela fica FORA do quadro, na seção "Aguardando o sinal"; a página dela lê o
// sinal no Caixa (a parcela 1 da venda — só leitura) e o dono libera à mão. O início vira o dia da
// liberação; um segundo "Liberar" é recusado e não muda o início. Cada teste semeia a PRÓPRIA
// ordem com sufixo único (nenhuma afirmação global do banco). Nomes inventados com `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(rotulo: string): string {
  const sufixo = `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return `[e2e] ${rotulo} ${sufixo}`;
}

function cartaoDaOrdem(page: Page, ordemId: string) {
  return page.locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`);
}

const FRASE_AGUARDANDO = "Aguardando o sinal. O prazo só começa a contar depois.";
const TOAST_LIBERADA = "Ordem liberada. O prazo começa a contar hoje.";
const FRASE_JA_LIBERADA = "Esta ordem já foi liberada. A tela foi atualizada.";

test.describe("producao sinal", () => {
  test("(a) a ordem aguardando aparece em “Aguardando o sinal” e em nenhuma coluna do quadro", async ({
    page,
  }) => {
    const nome = nomeUnico("Jogo aguardando");
    const { ordemId, entregaPrometida } = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: false,
    });

    await fazerLogin(page);
    await page.goto("/gestao/producao");

    const secao = page.locator("#aguardando-o-sinal");
    await expect(secao).toBeVisible();
    await expect(secao).toHaveAttribute("data-testid", "producao-aguardando");
    await expect(secao.getByRole("heading", { name: "Aguardando o sinal" })).toBeVisible();
    await expect(secao).toContainText(
      "Vieram de orçamento aprovado. Começam a contar quando o sinal for recebido no Caixa — ou quando você decidir começar assim mesmo.",
    );

    const cartao = secao.locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`);
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(nome);
    await expect(cartao).toContainText("2 peças");
    await expect(cartao.getByTestId("producao-cartao-aguardando")).toHaveText(
      `ainda não começou · entrega ${diaMes(entregaPrometida)}`,
    );
    await expect(cartao.getByTestId("producao-selo")).toHaveText("aguardando o sinal");

    // Fora do quadro: nenhuma das seis colunas tem o cartão.
    await expect(page.getByTestId("producao-quadro").locator(`[data-ordem-id="${ordemId}"]`)).toHaveCount(0);

    // O cartão leva à ordem.
    await cartao.click();
    await expect(page).toHaveURL(new RegExp(`/gestao/producao/${ordemId}$`));
  });

  test("(b) sem a parcela 1 paga: “ainda não consta”, os dois botões, e “Começar assim mesmo” libera", async ({
    page,
  }) => {
    const nome = nomeUnico("Jogo sem sinal");
    const { ordemId, parcelaSinalId } = await semearOrdemDeOrcamento({
      nome,
      plano: "sinal",
      sinalPago: false,
    });
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const caixa = page.getByTestId("ordem-caixa-aguardando");
    await expect(caixa).toContainText(FRASE_AGUARDANDO);
    const sinal = page.getByTestId("ordem-sinal");
    await expect(sinal).toContainText("O sinal ainda não consta como recebido no Caixa.");
    const verNoCaixa = sinal.getByRole("link", { name: "ver no Caixa" });
    await expect(verNoCaixa).toHaveAttribute("href", new RegExp(`parcelaFoco=${parcelaSinalId}`));
    await expect(page.getByTestId("ordem-liberar")).toHaveText("Sinal recebido — começar");
    await expect(page.getByTestId("ordem-comecar-assim-mesmo")).toHaveText("Começar assim mesmo");

    // Aguardando: nada começou, e não há "Terminei".
    await expect(page.getByTestId("ordem-subtitulo")).toContainText("ainda não começou");
    await expect(page.getByTestId("ordem-etapa-producao")).toContainText("ainda não começou");
    await expect(page.getByTestId("ordem-terminei")).toHaveCount(0);

    // "Começar assim mesmo" libera do mesmo jeito — e não toca na parcela do sinal.
    await page.getByTestId("ordem-comecar-assim-mesmo").click();
    await expect(page.getByText(TOAST_LIBERADA)).toBeVisible();
    await expect(caixa).toHaveCount(0);
    await expect(page.getByTestId("ordem-terminei")).toHaveText("Terminei: Produção");
    expect(await ordemNoBanco(ordemId)).toMatchObject({ status: "ativa", inicio: hoje });
    expect(await pagoEmDaParcela(parcelaSinalId)).toBeNull();
  });

  test("(c) com a parcela 1 paga: “Sinal recebido no Caixa em {dd/mm}.”, só o primário — e a ordem continua aguardando (receber não libera)", async ({
    page,
  }) => {
    const hoje = diaEmBrasilia();
    const pago = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo com sinal"),
      plano: "sinal",
      sinalPago: true,
    });
    const avistaAberto = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo à vista"),
      plano: "avista",
      sinalPago: false,
    });
    const avistaPago = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo à vista pago"),
      plano: "avista",
      sinalPago: true,
    });

    // Receber o sinal no Caixa nunca libera a ordem sozinho (briefing §3).
    expect(await ordemNoBanco(pago.ordemId)).toMatchObject({
      status: "aguardando_sinal",
      inicio: null,
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${pago.ordemId}`);
    await expect(page.getByTestId("ordem-sinal")).toContainText(
      `Sinal recebido no Caixa em ${diaMes(hoje)}.`,
    );
    await expect(page.getByTestId("ordem-liberar")).toBeVisible();
    await expect(page.getByTestId("ordem-comecar-assim-mesmo")).toHaveCount(0);

    // Plano à vista: a parcela 1 é o pagamento da aprovação.
    await page.goto(`/gestao/producao/${avistaAberto.ordemId}`);
    await expect(page.getByTestId("ordem-sinal")).toContainText(
      "O pagamento da aprovação ainda não consta como recebido no Caixa.",
    );
    await expect(page.getByTestId("ordem-comecar-assim-mesmo")).toBeVisible();

    await page.goto(`/gestao/producao/${avistaPago.ordemId}`);
    await expect(page.getByTestId("ordem-sinal")).toContainText(
      `Pagamento na aprovação: recebido em ${diaMes(hoje)}.`,
    );
    await expect(page.getByTestId("ordem-comecar-assim-mesmo")).toHaveCount(0);
  });

  test("(d) “Sinal recebido — começar”: toast, início = hoje no banco, e o cartão na coluna Produção", async ({
    page,
  }) => {
    const { ordemId, parcelaSinalId } = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo liberado"),
      plano: "sinal",
      sinalPago: true,
    });
    const hoje = diaEmBrasilia();

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);
    await page.getByTestId("ordem-liberar").click();
    await expect(page.getByText(TOAST_LIBERADA)).toBeVisible();
    await expect(page.getByTestId("ordem-caixa-aguardando")).toHaveCount(0);
    await expect(page.getByTestId("ordem-subtitulo")).toContainText(`começou ${diaMes(hoje)}`);

    expect(await ordemNoBanco(ordemId)).toMatchObject({ status: "ativa", inicio: hoje });
    // A parcela do sinal continua como estava (paga hoje) — a Produção só lê o Caixa.
    expect(await pagoEmDaParcela(parcelaSinalId)).toBe(hoje);

    await page.goto("/gestao/producao");
    await expect(
      page.getByTestId("producao-coluna-producao").locator(`[data-ordem-id="${ordemId}"]`),
    ).toBeVisible();
    await expect(page.locator(`#aguardando-o-sinal [data-ordem-id="${ordemId}"]`)).toHaveCount(0);
    await expect(cartaoDaOrdem(page, ordemId)).toContainText("há 0 dias nesta etapa · previsto 5");
  });

  test("(e) duas abas: liberar numa e tocar na outra → “já foi liberada” e o início não muda", async ({
    page,
    context,
  }) => {
    const { ordemId } = await semearOrdemDeOrcamento({
      nome: nomeUnico("Jogo duas abas"),
      plano: "sinal",
      sinalPago: false,
    });
    const ontem = diaEmBrasilia(-1);

    await fazerLogin(page);
    const outraAba = await context.newPage();
    await page.goto(`/gestao/producao/${ordemId}`);
    await outraAba.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-liberar")).toBeVisible();
    await expect(outraAba.getByTestId("ordem-liberar")).toBeVisible();

    await page.getByTestId("ordem-liberar").click();
    await expect(page.getByText(TOAST_LIBERADA)).toBeVisible();
    // Início afastado de hoje para o segundo toque não poder reescrevê-lo sem ser visto.
    await definirInicioNoBanco(ordemId, ontem);

    // A outra aba ainda mostra a caixa (estado velho) e toca.
    await outraAba.getByTestId("ordem-liberar").click();
    await expect(outraAba.getByTestId("ordem-liberar-erro")).toHaveText(FRASE_JA_LIBERADA);
    // A tela da segunda aba foi atualizada: a caixa sumiu, a frase ficou.
    await expect(outraAba.getByTestId("ordem-caixa-aguardando")).toHaveCount(0);
    await expect(outraAba.getByTestId("ordem-liberar-erro")).toHaveText(FRASE_JA_LIBERADA);

    expect(await ordemNoBanco(ordemId)).toMatchObject({ status: "ativa", inicio: ontem });
    await outraAba.close();
  });
});

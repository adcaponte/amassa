import { test, expect, type Page } from "@playwright/test";

import {
  diaEmBrasilia,
  diaMes,
  etapasDaOrdemNoBanco,
  semearOrdem,
  type OrdemParaSemear,
} from "./apoio/semear-producao";

// A trilha na mão (Fase 06.1, plano 05 — PRD-03, PRD-06, PRD-12; UI-D3, UI-D4, UI-D16): desfazer a
// última com confirmação que diz a data que se perde; o −/+ dos dias previstos só nas etapas
// futuras (aguardando: em todas); o parcial "já passaram [ ] de {total}" que aparece no quadro e
// nunca move a ordem; a previsão de conclusão; e o "Terminei" numa barra fixa no celular. Cada
// teste semeia a PRÓPRIA ordem com nome único e a acha pelo id — nenhuma afirmação global do banco.
// Nomes inventados com prefixo `[e2e]`.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

function nomeUnico(base: string): string {
  const sufixo = `${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return `[e2e] ${base} ${sufixo}`;
}

function semearNaTrilha(nome: string, dados: Partial<OrdemParaSemear> = {}): Promise<string> {
  return semearOrdem({
    nome,
    tipo: "casa",
    caminho: "completo",
    status: "ativa",
    inicio: diaEmBrasilia(),
    etapasFeitas: [],
    pecas: [{ descricao: `${nome} · caneca`, quantidade: 12 }],
    ...dados,
  });
}

function etapaNoBanco(etapas: Awaited<ReturnType<typeof etapasDaOrdemNoBanco>>, etapa: string) {
  const linha = etapas.find((cada) => cada.etapa === etapa);
  if (!linha) {
    throw new Error(`etapa ${etapa} não está no banco`);
  }
  return linha;
}

test.describe("producao trilha", () => {
  test("(a) desfazer pede confirmação com a data que se perde; Voltar não grava; Desfazer volta a etapa", async ({
    page,
  }) => {
    const nome = nomeUnico("Desfazer");
    const feitaEm = diaEmBrasilia(-2);
    const ordemId = await semearNaTrilha(nome, {
      inicio: diaEmBrasilia(-6),
      etapasFeitas: [{ etapa: "producao", feitaEm }],
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-etapa-secagem")).toHaveAttribute("data-estado", "atual");

    const desfazer = page.getByTestId("ordem-desfazer");
    await expect(desfazer).toHaveAccessibleName("Desfazer a última etapa: Produção");
    const dialogo = page.getByTestId("ordem-confirmar-desfazer");

    // "Voltar" fecha sem gravar.
    await desfazer.click();
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Desfazer: Produção?" })).toBeVisible();
    await expect(dialogo).toContainText(
      `A Produção volta a ser a etapa atual, e a data em que ela foi marcada como feita (${diaMes(feitaEm)}) se perde. Se marcar de novo, vale a data do dia em que marcar.`,
    );
    await dialogo.getByRole("button", { name: "Voltar" }).click();
    await expect(dialogo).toHaveCount(0);
    expect(etapaNoBanco(await etapasDaOrdemNoBanco(ordemId), "producao").feitaEm).toBe(feitaEm);

    // "Desfazer Produção" grava: a Produção volta a ser a atual e `feita_em` fica nulo.
    await desfazer.click();
    await dialogo.getByRole("button", { name: "Desfazer Produção" }).click();
    await expect(page.getByText("Desfeito: Produção voltou a ser a etapa atual.")).toBeVisible();
    await expect(page.getByTestId("ordem-etapa-producao")).toHaveAttribute("data-estado", "atual");
    await expect(page.getByTestId("ordem-terminei")).toHaveText("Terminei: Produção");
    expect(etapaNoBanco(await etapasDaOrdemNoBanco(ordemId), "producao").feitaEm).toBeNull();

    // Nenhuma etapa feita: "Desfazer" desabilitado.
    await expect(desfazer).toBeDisabled();

    // O toast do "Terminei" nunca oferece "Desfazer" (UI-D16) — desfazer só pela confirmação.
    await page.getByTestId("ordem-terminei").click();
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Feito: Produção." });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button")).toHaveCount(0);
    await expect(desfazer).toBeEnabled();
  });

  test("(a2) duas abas desfazem a mesma etapa: a segunda recebe “já tinha sido desfeita” e nada muda", async ({
    page,
    context,
  }) => {
    const ordemId = await semearNaTrilha(nomeUnico("Desfazer duas abas"), {
      inicio: diaEmBrasilia(-6),
      etapasFeitas: [
        { etapa: "producao", feitaEm: diaEmBrasilia(-4) },
        { etapa: "secagem", feitaEm: diaEmBrasilia(-1) },
      ],
    });

    await fazerLogin(page);
    const outraAba = await context.newPage();
    await page.goto(`/gestao/producao/${ordemId}`);
    await outraAba.goto(`/gestao/producao/${ordemId}`);

    await outraAba.getByTestId("ordem-desfazer").click();
    await expect(outraAba.getByTestId("ordem-confirmar-desfazer")).toBeVisible();

    await page.getByTestId("ordem-desfazer").click();
    await page.getByRole("button", { name: "Desfazer Secagem" }).click();
    await expect(page.getByText("Desfeito: Secagem voltou a ser a etapa atual.")).toBeVisible();

    // A segunda aba confirma a MESMA etapa que leu — o servidor recusa.
    await outraAba.getByRole("button", { name: "Desfazer Secagem" }).click();
    await expect(outraAba.getByTestId("ordem-desfazer-erro")).toHaveText(
      "Essa etapa já tinha sido desfeita. A tela foi atualizada.",
    );
    const etapas = await etapasDaOrdemNoBanco(ordemId);
    expect(etapaNoBanco(etapas, "producao").feitaEm).toBe(diaEmBrasilia(-4));
    expect(etapaNoBanco(etapas, "secagem").feitaEm).toBeNull();
    await outraAba.close();
  });

  test("(b) −/+ só nas etapas futuras; o previsto e a previsão mudam quando o servidor confirma", async ({
    page,
  }) => {
    // Início hoje, na Produção: previsão = hoje + 5 + 15 + 1 + 1 + 4 + 6 = hoje + 32.
    const ordemId = await semearNaTrilha(nomeUnico("Ajuste"), {
      tipo: "encomenda",
      clienteNome: "[e2e] Cliente do ajuste",
      entregaPrometida: diaEmBrasilia(32),
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const previsao = page.getByTestId("ordem-previsao");
    await expect(previsao).toHaveText(
      `Previsão de conclusão: ${diaMes(diaEmBrasilia(32))} · 0 dias de folga`,
    );
    await expect(page.getByText("A etapa só termina quando todas as peças passaram por ela.")).toBeVisible();

    // A etapa atual não tem −/+.
    await expect(page.getByTestId("ordem-ajuste-producao")).toHaveCount(0);
    // A Queima de biscoito tem 1 dia: "−" desabilitado, dizendo o porquê.
    const menosQueima1 = page.getByTestId("ordem-ajuste-menos-queima1");
    await expect(menosQueima1).toBeDisabled();
    await expect(menosQueima1).toHaveAccessibleName("Um dia a menos em Queima de biscoito");
    await expect(menosQueima1).toHaveAccessibleDescription("mínimo 1 dia");

    // "+" na Queima de esmalte: 4 → 5.
    const mais = page.getByTestId("ordem-ajuste-mais-queima2");
    await expect(mais).toHaveAccessibleName("Um dia a mais em Queima de esmalte");
    await mais.click();
    await expect(page.getByTestId("ordem-etapa-queima2")).toContainText("previsto 5 dias");
    expect(etapaNoBanco(await etapasDaOrdemNoBanco(ordemId), "queima2").diasPrevistos).toBe(5);
    await expect(previsao).toHaveText(
      `Previsão de conclusão: ${diaMes(diaEmBrasilia(33))} · 1 dia depois do prometido`,
    );
    await expect(page.getByTestId("ordem-previsao-folga")).toHaveClass(/text-erro/);
  });

  test("(b2) ordem aguardando o sinal: −/+ em todas as etapas, sem barra de ações nem previsão", async ({
    page,
  }) => {
    const ordemId = await semearNaTrilha(nomeUnico("Ajuste aguardando"), {
      tipo: "encomenda",
      clienteNome: "[e2e] Cliente aguardando",
      status: "aguardando_sinal",
      inicio: null,
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    for (const etapa of ["producao", "secagem", "queima1", "esmaltacao", "queima2", "entrega"]) {
      await expect(page.getByTestId(`ordem-ajuste-mais-${etapa}`)).toBeVisible();
    }
    await page.getByTestId("ordem-ajuste-menos-producao").click();
    await expect(page.getByTestId("ordem-etapa-producao")).toContainText("previsto 4 dias");
    expect(etapaNoBanco(await etapasDaOrdemNoBanco(ordemId), "producao").diasPrevistos).toBe(4);

    await expect(page.getByTestId("ordem-barra-fixa")).toHaveCount(0);
    await expect(page.getByTestId("ordem-previsao")).toHaveCount(0);
  });

  test("(c) parcial: “18 de 30 já passaram” no quadro, 31 é recusado, e o Terminei limpa o parcial", async ({
    page,
  }) => {
    const nome = nomeUnico("Parcial");
    const ordemId = await semearNaTrilha(nome, {
      tipo: "encomenda",
      clienteNome: "[e2e] Cliente do parcial",
      inicio: diaEmBrasilia(-3),
      etapasFeitas: [{ etapa: "producao", feitaEm: diaEmBrasilia(-1) }],
      pecas: [{ descricao: `${nome} · tigela`, quantidade: 26, aMais: 4 }],
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const campo = page.getByTestId("ordem-parcial");
    await expect(campo).toHaveAccessibleName("Quantas peças já passaram pela Secagem, de 30");
    await campo.fill("18");
    await campo.press("Enter");
    await expect
      .poll(async () => etapaNoBanco(await etapasDaOrdemNoBanco(ordemId), "secagem").passaram)
      .toBe(18);
    // O parcial nunca move a ordem.
    await expect(page.getByTestId("ordem-etapa-secagem")).toHaveAttribute("data-estado", "atual");

    // No quadro, o cartão mostra o parcial.
    await page.goto("/gestao/producao");
    const cartao = page
      .getByTestId("producao-coluna-secagem")
      .locator(`[data-testid="producao-cartao"][data-ordem-id="${ordemId}"]`);
    await expect(cartao.getByTestId("producao-cartao-parcial")).toHaveText("18 de 30 já passaram");

    // Fora da faixa: a frase com o total, o número digitado fica, nada gravado.
    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(campo).toHaveValue("18");
    await campo.fill("31");
    await campo.press("Enter");
    await expect(page.getByTestId("ordem-parcial-erro")).toHaveText("Diga um número de 0 a 30.");
    await expect(campo).toHaveValue("31");
    expect(etapaNoBanco(await etapasDaOrdemNoBanco(ordemId), "secagem").passaram).toBe(18);

    // Volta ao 18 (igual ao gravado — sair do campo não grava) e "Terminei" limpa o parcial.
    await campo.fill("18");
    await page.getByTestId("ordem-terminei").click();
    await expect(page.getByText("Feito: Secagem. Agora: Queima de biscoito.")).toBeVisible();
    const etapas = await etapasDaOrdemNoBanco(ordemId);
    expect(etapaNoBanco(etapas, "secagem").passaram).toBeNull();
    expect(etapaNoBanco(etapas, "secagem").feitaEm).toBe(diaEmBrasilia());
    // O campo agora é da Queima de biscoito, vazio.
    await expect(page.getByTestId("ordem-parcial")).toHaveValue("");
    await expect(page.getByTestId("ordem-parcial")).toHaveAccessibleName(
      "Quantas peças já passaram pela Queima de biscoito, de 30",
    );
  });

  test("(c2) ordem de uma peça só não tem o campo “já passaram”", async ({ page }) => {
    const nome = nomeUnico("Uma peça");
    const ordemId = await semearNaTrilha(nome, {
      pecas: [{ descricao: `${nome} · vaso`, quantidade: 1 }],
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);
    await expect(page.getByTestId("ordem-etapa-producao")).toHaveAttribute("data-estado", "atual");
    await expect(page.getByTestId("ordem-parcial")).toHaveCount(0);
  });

  test("(d) celular: “Terminei” e “Desfazer” numa barra fixa, sem rolar; desktop: fileira no bloco", async ({
    page,
  }) => {
    const ordemId = await semearNaTrilha(nomeUnico("Barra fixa"), {
      caminho: "biscoito",
      inicio: diaEmBrasilia(-20),
      etapasFeitas: [
        { etapa: "producao", feitaEm: diaEmBrasilia(-15) },
        { etapa: "secagem", feitaEm: diaEmBrasilia(-1) },
      ],
    });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);

    const barra = page.getByTestId("ordem-barra-fixa");
    const terminei = barra.getByTestId("ordem-terminei");
    const desfazer = barra.getByTestId("ordem-desfazer");
    await expect(terminei).toHaveText("Terminei: Queima de biscoito");

    if (test.info().project.name.includes("celular")) {
      await expect(barra).toHaveCSS("position", "fixed");
      await expect(barra).toHaveAttribute("data-acao-fixa", "");
      // Sem rolar: o botão já está na tela ao abrir a ordem.
      await expect(terminei).toBeInViewport();
      await expect(desfazer).toBeInViewport();
      // `innerText`: o rótulo da outra largura existe no DOM, escondido (`md:hidden` / `hidden md:inline`).
      await expect(desfazer).toHaveText("Desfazer", { useInnerText: true });
      await expect(desfazer).toHaveAccessibleName("Desfazer a última etapa: Secagem");
      // A barra fica acima da barra de navegação e o "Terminei" ocupa o resto da largura.
      const caixaDaBarra = await barra.boundingBox();
      const caixaDoBotao = await terminei.boundingBox();
      expect(caixaDaBarra && caixaDoBotao).toBeTruthy();
      expect(caixaDoBotao!.height).toBeGreaterThanOrEqual(52);
    } else {
      // No desktop não há barra fixa: a fileira fica no bloco "Etapas", à direita.
      await expect(barra).toHaveCSS("position", "static");
      await expect(desfazer).toHaveText("Desfazer a última", { useInnerText: true });
      await expect(
        page.getByRole("region", { name: "Etapas" }).getByTestId("ordem-terminei"),
      ).toBeVisible();
    }
  });

  test("(e) caminho “termina no biscoito”: a trilha tem 4 etapas", async ({ page }) => {
    const ordemId = await semearNaTrilha(nomeUnico("Biscoito"), { caminho: "biscoito" });

    await fazerLogin(page);
    await page.goto(`/gestao/producao/${ordemId}`);
    const linhas = page.getByTestId("ordem-trilha").locator(":scope > li");
    await expect(linhas).toHaveCount(4);
    await expect(page.getByTestId("ordem-etapa-esmaltacao")).toHaveCount(0);
    await expect(page.getByTestId("ordem-etapa-entrega")).toContainText("Guardar no estoque");
    await expect(page.getByTestId("ordem-subtitulo")).toContainText("termina no biscoito");
  });
});

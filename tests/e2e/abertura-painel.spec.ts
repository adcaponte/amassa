import { test, expect, type Page } from "@playwright/test";

import { FRASE_VAZIO_CORPO_MESES, FRASE_VAZIO_TITULO_MESES } from "@/lib/abertura/textos";

// O painel de três blocos e a visão "Por mês" do módulo Abertura do Espaço (04.2-04-PLAN.md):
// D-16 (fluxo mensal com composição e escala nomeada), D-15 (os três blocos do topo) e D-17/ABE-14
// (data de inauguração editável com contagem regressiva). Uma invocação de
// `npm run test:e2e -- --grep "abertura painel"` por tarefa deste plano (CLAUDE.md).
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

function nomeUnico(rotulo: string): string {
  return `[e2e] ${rotulo} ${test.info().project.name} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function criarItem(
  page: Page,
  opcoes: {
    nome: string;
    categoria?: string;
    valor: string;
    formaPagamento?: "prazo";
    parcelas?: string;
    primeiraParcelaEm?: string;
    entregaPrevistaEm?: string;
  },
) {
  await page.goto("/abertura?item=novo");
  await page.getByLabel("O que é").fill(opcoes.nome);
  if (opcoes.categoria) {
    await page.getByRole("combobox", { name: "Categoria" }).click();
    await page.getByRole("option", { name: opcoes.categoria }).click();
  }
  await page.getByLabel("Valor total").fill(opcoes.valor);
  if (opcoes.formaPagamento === "prazo") {
    await page.getByRole("combobox", { name: "Pagamento" }).click();
    await page.getByRole("option", { name: "A prazo" }).click();
    if (opcoes.parcelas) {
      await page.getByLabel("Em quantas vezes").fill(opcoes.parcelas);
    }
  }
  if (opcoes.primeiraParcelaEm) {
    const rotuloData = opcoes.formaPagamento === "prazo" ? "Primeira parcela" : "Quando paga";
    await page.getByLabel(rotuloData).fill(opcoes.primeiraParcelaEm);
  }
  if (opcoes.entregaPrevistaEm) {
    await page.getByLabel("Chega em (opcional)").fill(opcoes.entregaPrevistaEm);
  }
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page).toHaveURL(/\/abertura$/, { timeout: 10000 });
}

test.describe("abertura painel — o painel de três blocos e a visão Por mês", () => {
  // Tarefa 1 (D-16/ABE-13): condição GLOBAL do banco (nenhum item existe) — marcado
  // `@vazio-global`, roda na cadeia `vazio-celular → vazio-desktop` ANTES de qualquer teste que
  // escreva (CLAUDE.md "Teste não pode afirmar condição global do banco sem isolamento").
  test("com o banco sem nenhum item, a aba Por mês mostra o estado vazio do UI-SPEC @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.goto("/abertura?aba=meses");

    const frase = page.getByRole("heading", { name: FRASE_VAZIO_TITULO_MESES, level: 2 });
    await expect(frase).toBeVisible();
    await expect(page.getByText(FRASE_VAZIO_CORPO_MESES)).toBeVisible();
  });

  test("um item à vista e um item de 6 parcelas no mês corrente aparecem na aba Por mês, com escala e composição", async ({
    page,
  }) => {
    await fazerLogin(page);

    const hojeStr = new Date().toISOString().slice(0, 10);
    const nomeVista = nomeUnico("Estante de secagem");
    const nomeParcelado = nomeUnico("Forno elétrico 200L");

    await criarItem(page, {
      nome: nomeVista,
      categoria: "Móveis",
      valor: "2100",
      primeiraParcelaEm: hojeStr,
    });

    await criarItem(page, {
      nome: nomeParcelado,
      categoria: "Equipamentos",
      valor: "9800",
      formaPagamento: "prazo",
      parcelas: "6",
      primeiraParcelaEm: hojeStr,
    });

    await page.goto("/abertura?aba=meses");

    const mesAtual = page.getByTestId("abertura-mes").filter({ hasText: "este mês" });
    await expect(mesAtual).toHaveCount(1);

    // A barra tem `role="img"` e `aria-label` com a proporção em texto.
    const barra = mesAtual.getByTestId("abertura-mes-barra");
    await expect(barra).toHaveAttribute("aria-label", /% do mês mais pesado|mês mais pesado/);

    // A escala nomeada aparece em TEXTO ao lado da barra — nunca uma barra muda.
    await expect(mesAtual.getByTestId("abertura-mes-escala")).toBeVisible();

    // A composição mostra a fração da parcela do item parcelado ("· 1/6") e o item à vista SEM
    // fração nenhuma.
    await expect(
      mesAtual.getByTestId("abertura-mes-composicao").filter({ hasText: nomeParcelado }),
    ).toContainText(`${nomeParcelado} · 1/6`);
    const linhaVista = mesAtual
      .getByTestId("abertura-mes-composicao")
      .filter({ hasText: nomeVista });
    await expect(linhaVista).toBeVisible();
    await expect(linhaVista).not.toContainText("· 1/1");

    // O item de 6 parcelas continua aparecendo em meses futuros também — a virada de ano do
    // cálculo em si já é provada por `tests/unit/abertura-parcelas.test.ts`; aqui só confere que
    // a tela desenha mais de um mês quando o item parcelado gera mais de um.
    const totalDeMeses = await page.getByTestId("abertura-mes").count();
    expect(totalDeMeses).toBeGreaterThanOrEqual(6);
  });

  test("no viewport de celular, um item com nome longo não produz rolagem horizontal na aba Por mês", async ({
    page,
  }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });

    const nomeComprido = nomeUnico(
      "Bancada de trabalho em madeira maciça com prateleiras auxiliares e rodízios travantes",
    );
    const hojeStr = new Date().toISOString().slice(0, 10);

    await criarItem(page, {
      nome: nomeComprido,
      valor: "3500",
      primeiraParcelaEm: hojeStr,
    });

    await page.goto("/abertura?aba=meses");
    await expect(
      page.getByTestId("abertura-mes-composicao").filter({ hasText: nomeComprido }),
    ).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);

    expect(
      scrollWidth,
      `/abertura?aba=meses rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

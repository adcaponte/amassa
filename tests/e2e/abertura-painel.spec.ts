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

async function criarTarefaComPrazo(page: Page, opcoes: { descricao: string; prazoEm: string }) {
  await page.goto("/abertura?aba=tarefas&tarefa=nova");
  await page.getByLabel("O que fazer").fill(opcoes.descricao);
  await page.getByLabel("Até quando").fill(opcoes.prazoEm);
  await page.getByRole("button", { name: "Adicionar tarefa" }).click();
  await expect(page).toHaveURL(/\?aba=tarefas$/, { timeout: 10000 });
}

function lerNumero(texto: string): number {
  return Number(texto.replace(/[^\d]/g, "")) || 0;
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

  // Tarefa 2 (D-15/ABE-12): os três blocos do painel. Os números são GLOBAIS (somam TODO o
  // banco, não só o que este teste criou) — sob execução paralela de verdade, outro worker pode
  // estar criando item/tarefa ao mesmo tempo. Por isso as asserções são de CONSISTÊNCIA (relação
  // algébrica entre os próprios números lidos na mesma leitura) e de PISO (o que este teste criou
  // nunca é removido, então o total nunca fica MENOR que a contribuição própria) — nunca um valor
  // absoluto fixo (CLAUDE.md "Teste não pode afirmar condição global do banco sem isolamento").
  test("os três blocos do painel mostram números consistentes entre si, e o bloco de atenção fica vermelho quando a soma passa de zero", async ({
    page,
  }) => {
    await fazerLogin(page);

    const nomeAVista = nomeUnico("Torno elétrico");
    const nomeVencido = nomeUnico("Prateleiras de parede");
    const descricaoAtrasada = nomeUnico("Assinar contrato de energia");

    // Ambos com vencimento HOJE (padrão do formulário) — cada um soma no bloco "Sai neste mês".
    await criarItem(page, { nome: nomeAVista, valor: "4400" });
    // Entrega prevista bem no passado — SEMPRE vencida, qualquer que seja o dia do teste.
    await criarItem(page, { nome: nomeVencido, valor: "1500", entregaPrevistaEm: "2020-01-01" });
    await criarTarefaComPrazo(page, { descricao: descricaoAtrasada, prazoEm: "2020-01-01" });

    await page.goto("/abertura");

    const blocoComprometido = page.getByTestId("abertura-bloco-comprometido");
    const blocoMes = page.getByTestId("abertura-bloco-mes");
    const blocoAtencao = page.getByTestId("abertura-bloco-atencao");
    await expect(blocoComprometido).toBeVisible();
    await expect(blocoMes).toBeVisible();
    await expect(blocoAtencao).toBeVisible();

    const comprometido = lerNumero(
      await blocoComprometido.getByTestId("abertura-bloco-comprometido-valor").innerText(),
    );
    const linhaComprometido = await blocoComprometido.innerText();
    const [, aVistaTexto, aPrazoTexto] =
      /R\$\s*([\d.]+)\s*à vista\s*·\s*R\$\s*([\d.]+)\s*a prazo/.exec(linhaComprometido) ?? [];
    expect(aVistaTexto, `bloco Comprometido não bateu o formato esperado: "${linhaComprometido}"`)
      .toBeTruthy();
    const aVista = Number((aVistaTexto ?? "0").replace(/\./g, ""));
    const aPrazo = Number((aPrazoTexto ?? "0").replace(/\./g, ""));
    // Consistência algébrica — vale SEMPRE, não depende de quantos itens concorrentes existem.
    expect(aVista + aPrazo).toBe(comprometido);
    // Piso — os dois itens deste teste nunca são removidos, então o total nunca fica abaixo
    // deles (mas pode ser MAIOR, por causa de outros itens concorrentes).
    expect(comprometido).toBeGreaterThanOrEqual(4400 + 1500);

    const saiNesteMes = lerNumero(
      await blocoMes.getByTestId("abertura-bloco-mes-valor").innerText(),
    );
    expect(saiNesteMes).toBeGreaterThanOrEqual(4400 + 1500);

    const atencao = lerNumero(
      await blocoAtencao.getByTestId("abertura-bloco-atencao-valor").innerText(),
    );
    const linhaAtencao = await blocoAtencao.innerText();
    const [, atrasadasTexto, vencidasTexto] =
      /(\d+)\s*(?:tarefa atrasada|tarefas atrasadas)\s*·\s*(\d+)\s*(?:entrega vencida|entregas vencidas)/.exec(
        linhaAtencao,
      ) ?? [];
    expect(atrasadasTexto, `bloco Atenção não bateu o formato esperado: "${linhaAtencao}"`)
      .toBeTruthy();
    const atrasadas = Number(atrasadasTexto ?? "0");
    const vencidas = Number(vencidasTexto ?? "0");
    // Consistência: o número grande é SEMPRE a soma das duas linhas de baixo.
    expect(atrasadas + vencidas).toBe(atencao);
    // Piso: a tarefa e a entrega deste teste garantem que a soma nunca é zero.
    expect(atencao).toBeGreaterThanOrEqual(2);

    // O valor grande só fica vermelho quando a soma passa de zero — como este teste garante que
    // ela passa, o bloco PRECISA estar vermelho.
    await expect(blocoAtencao.getByTestId("abertura-bloco-atencao-valor")).toHaveClass(
      /text-erro/,
    );
  });
});

import { test, expect, type Page } from "@playwright/test";

import { buscarCategoriaPorNome } from "./apoio/semear-financeiro";
import { diaDoMes, mesReservado } from "./apoio/mes-reservado";

// O extrato por mês e por forma (D-11/D-12, 04.4-09-PLAN.md Tarefa 2): navegação ◀ mês ▶, filtro
// Todas · Dinheiro · Pix · Cartão, o total filtrado ("quanto entrou em dinheiro?") e o saldo
// "depois" continuando o acumulado GLOBAL mesmo com filtro aplicado. Cada caso roda no PRÓPRIO mês
// reservado (`mes-reservado.ts`) — nenhuma afirmação de número global do banco.

async function fazerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function esperarVendaLancada(page: Page) {
  await expect(page).toHaveURL(/\?aba=venda/, { timeout: 10000 });
}

// NUNCA `toHaveURL(/\?aba=despesa/)` — a Despesa parte de `/financeiro?aba=despesa` (o fragmento
// já é verdade ANTES de qualquer ação), então essa checagem não provaria nada (mesma classe de
// achado real documentada em `04.4-08-SUMMARY.md`: asserção de URL trivialmente verdadeira). O
// TOAST "Despesa nº N lançada" só aparece depois da navegação de sucesso — é o sinal real.
async function esperarDespesaLancada(page: Page) {
  await expect(page.getByText(/^Despesa nº \d+ lançada/)).toBeVisible({ timeout: 10000 });
}

// Lança uma venda "valor livre" na data pedida, à vista, na forma pedida — o caso mais simples
// para encher o extrato sem depender de nenhum item do catálogo.
async function lancarVendaLivre(
  page: Page,
  { data, descricao, valor, forma }: { data: string; descricao: string; valor: string; forma: "Pix" | "Dinheiro" | "Cartão" },
) {
  await page.goto("/financeiro");
  // `page.goto` só espera o evento `load` — a hidratação do React (que anexa o `onChange` do
  // campo "Data" controlado) roda um instante depois, ainda mais sob 8 workers disputando CPU.
  // Sem esta espera, `.fill()` no campo pode escrever o valor no DOM ANTES do handler existir; o
  // React, ao hidratar, sobrescreve de volta para o valor do próprio estado (hoje) — o documento
  // nasce com a data ERRADA sem nenhum erro reportado (mesmo achado de `encomendas-filtros.spec.ts`).
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByLabel("Data").fill(data);
  await page.getByRole("button", { name: "+ Valor livre" }).click();
  await page.getByLabel("O que é").fill(descricao);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Bebidas e comidas" }).click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page.getByRole("button", { name: "Pôr na venda" }).click();
  await page.getByRole("button", { name: forma, exact: true }).click();
  await page.getByRole("button", { name: "Lançar venda" }).click();
  await esperarVendaLancada(page);
}

// Lança uma "outra despesa" na data pedida, à vista, na forma pedida.
async function lancarDespesaLivre(
  page: Page,
  { data, descricao, valor, forma }: { data: string; descricao: string; valor: string; forma: "Pix" | "Dinheiro" | "Cartão" },
) {
  await page.goto("/financeiro?aba=despesa");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByTestId("despesa-modo-outra").click();
  await page.getByLabel("Data").fill(data);
  await page.getByLabel("Descrição").fill(descricao);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Aluguel" }).click();
  await page.getByLabel("Valor", { exact: true }).fill(valor);
  await page.getByRole("button", { name: forma, exact: true }).click();
  await page.getByRole("button", { name: "Lançar despesa" }).click();
  await esperarDespesaLancada(page);
}

function linhaDoExtrato(page: Page, texto: string) {
  return page.getByTestId("extrato-linha").filter({ hasText: texto });
}

async function saldoDepoisCentavos(page: Page, texto: string): Promise<number> {
  const conteudo = await linhaDoExtrato(page, texto).getByTestId("extrato-saldo-depois").innerText();
  // "saldo R$ 1.234,56" → 123456 (centavos), sem depender de locale de número do runner.
  const numero = conteudo
    .replace("saldo", "")
    .replace("R$", "")
    .trim()
    .replaceAll(".", "")
    .replace(",", ".");
  return Math.round(Number(numero) * 100);
}

test.describe("financeiro extrato", () => {
  test("navega por mês, filtra por forma, mantém o saldo global, e mostra os dois vazios", async ({ page }) => {
    await buscarCategoriaPorNome("Bebidas e comidas");
    await buscarCategoriaPorNome("Aluguel");

    const mes = mesReservado("extrato-lancamentos", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    const nome10 = `[e2e] Extrato dia10 ${suf}`;
    const nome12 = `[e2e] Extrato dia12 ${suf}`;
    const nome14 = `[e2e] Extrato despesa dia14 ${suf}`;
    const nome15 = `[e2e] Extrato dia15 ${suf}`;

    await fazerLogin(page);

    await lancarVendaLivre(page, { data: diaDoMes(mes, 10), descricao: nome10, valor: "100", forma: "Pix" });
    await lancarVendaLivre(page, { data: diaDoMes(mes, 12), descricao: nome12, valor: "50", forma: "Dinheiro" });
    await lancarDespesaLivre(page, { data: diaDoMes(mes, 14), descricao: nome14, valor: "20", forma: "Dinheiro" });
    await lancarVendaLivre(page, { data: diaDoMes(mes, 15), descricao: nome15, valor: "30", forma: "Pix" });

    await page.goto(`/financeiro?aba=caixa&mes=${mes}`);

    // As quatro linhas em ordem do mais recente (dia15, dia14, dia12, dia10).
    const linhas = page.getByTestId("extrato-linha");
    await expect(linhas).toHaveCount(4);
    await expect(linhas.nth(0)).toContainText(nome15);
    await expect(linhas.nth(1)).toContainText(nome14);
    await expect(linhas.nth(2)).toContainText(nome12);
    await expect(linhas.nth(3)).toContainText(nome10);

    const saldo15Antes = await saldoDepoisCentavos(page, nome15);
    const saldo14Antes = await saldoDepoisCentavos(page, nome14);
    const saldo12Antes = await saldoDepoisCentavos(page, nome12);
    const saldo10Antes = await saldoDepoisCentavos(page, nome10);

    // A diferença entre o saldo depois de duas linhas consecutivas é o valor com sinal da mais
    // nova: dia15 é uma venda de +R$30 (Pix); dia14 é uma despesa de −R$20; dia12 é uma venda de
    // +R$50.
    expect(saldo15Antes - saldo14Antes).toBe(3000);
    expect(saldo14Antes - saldo12Antes).toBe(-2000);
    expect(saldo12Antes - saldo10Antes).toBe(5000);

    // Lançamento retroativo (dia 5, R$ 7,00 no Pix) — o saldo depois de TODAS as quatro linhas
    // anteriores aumenta pelo MESMO valor (recálculo retroativo, key_link do plano 09).
    //
    // Nota de isolamento: "saldo depois" é ACUMULADO GLOBAL por desenho (D-12) — nunca escopado
    // por mês —, então mesmo dois projetos escrevendo em MESES reservados diferentes (desktop
    // sempre cronologicamente ANTES do celular, mes-reservado.ts) compartilham a MESMA régua: um
    // lançamento do projeto irmão datado antes do nosso mês desloca as QUATRO linhas por igual, de
    // um valor que não controlamos. A comparação abaixo por isso usa dois invariantes IMUNES a
    // esse deslocamento externo (ele afeta as duas leituras da mesma forma, cancelando na
    // subtração) em vez de comparar o valor absoluto contra "antes + R$ 7,00": (1) as quatro
    // linhas deslocam-se pelo MESMO tanto entre si; (2) a diferença entre a linha retroativa e a
    // que vem logo depois dela é exatamente o valor com sinal de dia10 (R$ 100,00) — mesma técnica
    // já usada acima para os pares consecutivos, aqui provando que a linha nova foi encadeada no
    // lugar certo com o valor certo (mesma classe de tolerância a escritor concorrente já
    // documentada para o total global de Queimas).
    const nome05 = `[e2e] Extrato retroativo dia05 ${suf}`;
    await lancarVendaLivre(page, { data: diaDoMes(mes, 5), descricao: nome05, valor: "7", forma: "Pix" });
    await page.goto(`/financeiro?aba=caixa&mes=${mes}`);

    const saldo15Depois = await saldoDepoisCentavos(page, nome15);
    const saldo14Depois = await saldoDepoisCentavos(page, nome14);
    const saldo12Depois = await saldoDepoisCentavos(page, nome12);
    const saldo10Depois = await saldoDepoisCentavos(page, nome10);
    const saldo05Depois = await saldoDepoisCentavos(page, nome05);

    const deslocamento = saldo15Depois - saldo15Antes;
    expect(saldo14Depois - saldo14Antes).toBe(deslocamento);
    expect(saldo12Depois - saldo12Antes).toBe(deslocamento);
    expect(saldo10Depois - saldo10Antes).toBe(deslocamento);
    // A NOSSA própria inserção sempre contribui pelo menos R$ 7,00 — um escritor concorrente só
    // pode aumentar esse deslocamento (nunca reduzi-lo abaixo do que nós mesmos inserimos).
    expect(deslocamento).toBeGreaterThanOrEqual(700);

    // A linha nova (dia05) encadeada certa: a diferença para dia10 (a próxima cronologicamente) é
    // exatamente o valor com sinal de dia10 — prova robusta, imune a qualquer deslocamento externo.
    expect(saldo10Depois - saldo05Depois).toBe(10000);

    // Filtro Dinheiro → só as duas de dinheiro (dia12 venda, dia14 despesa), com os MESMOS saldos
    // depois de antes do filtro (D-12 — o filtro esconde linhas, não recalcula saldo).
    //
    // A comparação usa a DIFERENÇA entre as duas linhas (não o valor absoluto de cada uma) pelo
    // mesmo motivo do bloco acima: clicar no filtro é outra navegação, outra janela onde o projeto
    // irmão pode ter deslocado o acumulado global — mas desloca as DUAS por igual, e a diferença
    // entre elas cancela esse deslocamento. Se o filtro recalculasse o saldo escopado só às linhas
    // visíveis (o bug que D-12 proíbe), essa diferença NÃO bateria mais com a do extrato completo.
    const diferencaAntesDoFiltro = saldo12Depois - saldo14Depois;
    await page.getByTestId("extrato-filtro-dinheiro").click();
    await expect(page).toHaveURL(/forma=dinheiro/);
    await expect(page.getByTestId("extrato-linha")).toHaveCount(2);
    await expect(linhaDoExtrato(page, nome10)).toHaveCount(0);
    await expect(linhaDoExtrato(page, nome15)).toHaveCount(0);
    const saldo12Filtrado = await saldoDepoisCentavos(page, nome12);
    const saldo14Filtrado = await saldoDepoisCentavos(page, nome14);
    expect(saldo12Filtrado - saldo14Filtrado).toBe(diferencaAntesDoFiltro);
    await expect(page.getByTestId("extrato-total-filtrado")).toContainText("Total em Dinheiro neste mês: + R$ 30,00");

    // Filtro Cartão → nenhuma linha nesta forma, com o vazio distinto do "sem movimento".
    await page.getByTestId("extrato-filtro-cartao").click();
    await expect(page.getByText("Nada neste mês, nesta forma.")).toBeVisible();

    // ◀ para o mês anterior (garantidamente vazio — meses reservados espaçados de 3 em 3) →
    // "Nada neste mês ainda."; ▶ volta ao mês de origem.
    //
    // Causa raiz real (achada na varredura completa da fase, nunca reproduzida sob --grep
    // isolado): sem esperar a navegação de "Todas" terminar antes de clicar em "mês anterior",
    // sob a suíte inteira (servidor Next único disputado por 8 workers) o segundo clique podia
    // acontecer ANTES do React re-renderizar `NavegacaoMes` com o novo `href` (sem `forma=`) —
    // clicando, então, no `href` ANTIGO ainda com `forma=cartao` embutido (NavegacaoMes recebe o
    // `href` pronto de quem chama, e preserva a forma corrente por desenho). O resultado seguia o
    // filtro de Cartão junto para o mês anterior E de volta, mostrando "Nada neste mês, nesta
    // forma." no mês de origem — mesma classe de asserção-sem-espera já documentada em
    // `04.4-08-SUMMARY.md`/`04.4-09-SUMMARY.md`, agora na forma de um CLIQUE cedo demais, não de
    // uma checagem de URL cedo demais. A URL sem `forma=` é estável (nunca limpa por
    // `history.replaceState`, ao contrário de `?aviso=`) — esperar por ela antes do próximo
    // clique garante que o `href` já foi atualizado no DOM.
    await page.getByTestId("extrato-filtro-todas").click();
    await expect(page).not.toHaveURL(/forma=/);
    await page.getByLabel("mês anterior").click();
    await expect(page.getByText("Nada neste mês ainda.")).toBeVisible();
    await page.getByLabel("mês seguinte").click();
    await expect(page.getByTestId("extrato-linha")).toHaveCount(5);
  });

  test("o total soma também no filtro 'Todas' — resposta ao item 13 da conferência do dono (26/09/2026)", async ({
    page,
  }) => {
    await buscarCategoriaPorNome("Bebidas e comidas");
    await buscarCategoriaPorNome("Aluguel");

    const mes = mesReservado("extrato-total-todas", test.info().project.name);
    const suf = `${test.info().project.name}-${Date.now()}`;

    const nomePix = `[e2e] Total todas pix ${suf}`;
    const nomeDinheiro = `[e2e] Total todas dinheiro ${suf}`;
    const nomeDespesa = `[e2e] Total todas despesa dinheiro ${suf}`;

    await fazerLogin(page);

    await lancarVendaLivre(page, { data: diaDoMes(mes, 10), descricao: nomePix, valor: "100", forma: "Pix" });
    await lancarVendaLivre(page, { data: diaDoMes(mes, 12), descricao: nomeDinheiro, valor: "20", forma: "Dinheiro" });
    await lancarDespesaLivre(page, { data: diaDoMes(mes, 14), descricao: nomeDespesa, valor: "5", forma: "Dinheiro" });

    await page.goto(`/financeiro?aba=caixa&mes=${mes}`);

    // "Todas" (sem `forma=` na URL) mostra o total do mês inteiro: 100 (Pix) + 20 (Dinheiro) − 5
    // (despesa em Dinheiro) = 115 — o dono, item 13: "aparece a frase com a soma em todas
    // categorias, mas nao na 'todas'".
    await expect(page.getByTestId("extrato-total-filtrado")).toContainText(
      "Total de todas as formas neste mês: + R$ 115,00",
    );

    // O filtro "Dinheiro" continua com a frase de sempre, e o valor dele sozinho (20 − 5 = 15).
    await page.getByTestId("extrato-filtro-dinheiro").click();
    await expect(page).toHaveURL(/forma=dinheiro/);
    await expect(page.getByTestId("extrato-total-filtrado")).toContainText(
      "Total em Dinheiro neste mês: + R$ 15,00",
    );

    // Voltando a "Todas", a frase do total do mês volta a aparecer.
    await page.getByTestId("extrato-filtro-todas").click();
    await expect(page).not.toHaveURL(/forma=/);
    await expect(page.getByTestId("extrato-total-filtrado")).toContainText(
      "Total de todas as formas neste mês: + R$ 115,00",
    );
  });

  test("a 320px de largura, o extrato não rola na horizontal", async ({ page }) => {
    await fazerLogin(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/financeiro?aba=caixa");

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `Extrato rola horizontalmente a 320px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  });
});

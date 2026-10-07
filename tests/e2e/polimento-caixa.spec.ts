import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

import { tituloDaContaFixa } from "@/lib/cadastros/contas-fixas";
import { nomeDoMes, nomeDoMesSemAno } from "@/lib/financeiro/formato";
import { janelaDoCaixa, mesesDaJanela } from "@/lib/financeiro/janela";
import { formatarDiaMes } from "@/lib/producao/calendario";

import { medirCaixa } from "./apoio/medir-caixa";
import { semearContaAPagar } from "./apoio/semear-conta-a-pagar";
import { buscarCategoriaPorNome, hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// O Caixa da Fase 06.5 (06.5-12-PLAN.md, D-03 / UI-D7 / UI-D8, D-27):
// - "A pagar"/"A receber" e os tiles "A receber", "A pagar" e "Se tudo se cumprir" falam das
//   vencidas e das que vencem até hoje + 30; o resto fica a um toque, na mesma lista, sem navegar;
// - o mês da janela sem contas fixas geradas avisa, com o atalho para gerar ali mesmo;
// - nenhum teste afirma o N exato de "Ver as {N}…": outros specs criam contas ao mesmo tempo.

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

function cartaoDaConta(page: Page, titulo: string) {
  return page.getByTestId("conta-cartao").filter({ hasText: titulo });
}

test.describe("polimento caixa — janela", () => {
  test("“A receber” mostra até hoje + 30; a de depois fica atrás de “Ver…”, abre na mesma lista e fecha", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const tituloPerto = `[e2e] Caneca da Clarice Inventada ${suf}`;
    const tituloLonge = `[e2e] Travessa da Clarice Inventada ${suf}`;
    await semearContaAPagar({
      titulo: tituloPerto,
      pessoa: "Clarice Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 4200,
      vencimento: somarDiasAoHoje(10),
      tipo: "venda",
    });
    await semearContaAPagar({
      titulo: tituloLonge,
      pessoa: "Clarice Inventada",
      categoria: "Bebidas e comidas",
      valorCentavos: 9900,
      vencimento: somarDiasAoHoje(45),
      tipo: "venda",
    });
    const ate = formatarDiaMes(somarDiasAoHoje(30));

    await fazerLogin(page);
    await page.goto("/gestao/financeiro?aba=caixa");

    const aReceber = page.getByTestId("caixa-a-receber");
    await expect(aReceber).toBeVisible();
    await expect(aReceber).toContainText(`Vencidas e as que vencem até ${ate}.`);
    await expect(page.getByTestId("caixa-a-pagar")).toContainText(`Vencidas e as que vencem até ${ate}.`);

    // A de daqui a 10 dias está na janela; a de daqui a 45, não.
    await expect(aReceber.getByTestId("conta-cartao").filter({ hasText: tituloPerto })).toBeVisible();
    await expect(cartaoDaConta(page, tituloLonge)).toHaveCount(0);

    // Os três tiles que somam o futuro dizem até quando; o saldo, não.
    for (const tile of ["caixa-tile-receber", "caixa-tile-pagar", "caixa-tile-previsto"]) {
      await expect(page.getByTestId(tile).getByTestId("caixa-janela-ate")).toHaveText(`até ${ate}`);
    }
    await expect(page.getByTestId("caixa-tile-saldo").getByTestId("caixa-janela-ate")).toHaveCount(0);

    // O botão no fim da lista: singular ou plural de verdade (o N exato é de outros testes também).
    const botao = page.getByTestId("caixa-ver-depois-receber");
    await expect(botao).toHaveText(
      new RegExp(`^Ver (a que vence|as \\d+ que vencem) depois de ${ate.replace("/", "\\/")}$`),
    );
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    expect((await medirCaixa(botao)).height).toBeGreaterThanOrEqual(44);

    // Abre na mesma lista, sem navegar. O clique pode chegar antes da hidratação — confere e repete.
    const urlAntes = page.url();
    await expect(async () => {
      if ((await botao.getAttribute("aria-expanded")) !== "true") {
        await botao.click();
      }
      await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    expect(page.url()).toBe(urlAntes);

    const separador = aReceber.getByTestId("caixa-depois-de");
    await expect(separador).toHaveText(`Depois de ${ate}`);
    const depois = aReceber.locator("#caixa-depois-receber");
    await expect(depois.getByTestId("conta-cartao").filter({ hasText: tituloLonge })).toBeVisible();
    // A de perto continua acima da linha "Depois de", nunca dentro do bloco de depois.
    await expect(depois.getByTestId("conta-cartao").filter({ hasText: tituloPerto })).toHaveCount(0);
    await expect(botao).toHaveText(`Mostrar só até ${ate}`);

    // Tocar de novo esconde.
    await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    await expect(cartaoDaConta(page, tituloLonge)).toHaveCount(0);
    await expect(separador).toHaveCount(0);
    await expect(aReceber.getByTestId("conta-cartao").filter({ hasText: tituloPerto })).toBeVisible();
  });
});

// --- O aviso do mês da janela sem contas fixas geradas (D-03 / UI-D8) -------------------------------
//
// "Nenhuma conta fixa gerada no mês corrente" é condição GLOBAL do banco: este describe roda na cadeia
// `@vazio-historico` (antes de `desktop`/`celular`, banco recém-criado) e deixa o banco como achou —
// a conta fixa criada sai desativada e as despesas que a geração deste teste criou saem canceladas.

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

async function criarContaFixaAtiva(nome: string): Promise<string> {
  const categoriaId = await buscarCategoriaPorNome("Aluguel");
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into contas_fixas (nome, categoria_id, valor_esperado_centavos, dia_vencimento, ativa)
       values ($1, $2, 43210, 28, true) returning id`,
      [nome, categoriaId],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`criarContaFixaAtiva: falha ao inserir "${nome}".`);
    }
    return id;
  });
}

// Desativa a conta deste teste e cancela as despesas de conta fixa que a geração dele criou: as da
// própria conta (qualquer mês) e as do mês corrente (que, nesta cadeia, não existiam antes — o aviso
// do mês corrente na tela é a prova).
async function devolverOBanco(contaFixaId: string, mesCorrente: string): Promise<void> {
  await comCliente(async (cliente) => {
    const email = process.env.E2E_EMAIL_TESTE ?? "";
    const { rows } = await cliente.query<{ id: string }>(
      "select id from usuarios where lower(email) = lower($1) limit 1",
      [email],
    );
    const gestorId = rows[0]?.id;
    if (!gestorId) {
      throw new Error(`devolverOBanco: nenhum usuário com o e-mail "${email}".`);
    }
    await cliente.query("update contas_fixas set ativa = false where id = $1", [contaFixaId]);
    await cliente.query(
      `update documentos set cancelado_em = now(), cancelado_por = $3
        where cancelado_em is null and conta_fixa_id is not null
          and (conta_fixa_id = $1 or mes_referencia = $2::date)`,
      [contaFixaId, `${mesCorrente}-01`, gestorId],
    );
  });
}

test.describe("polimento caixa — aviso das contas fixas @vazio-historico", () => {
  // Em série, a falha primeiro: os dois dependem do aviso do mês corrente, que o segundo apaga ao gerar.
  test.describe.configure({ mode: "serial" });

  test("a geração que falha no caminho mostra o erro e o aviso continua", async ({ page }) => {
    const hoje = hojeNoAtelie();
    const mesCorrente = hoje.slice(0, 7);
    const nome = `[e2e] Internet inventada ${sufixoUnico()}`;
    const contaFixaId = await criarContaFixaAtiva(nome);

    try {
      await fazerLogin(page);
      await page.goto("/gestao/financeiro?aba=caixa");
      const aviso = page.getByTestId(`caixa-aviso-fixas-${mesCorrente}`);
      await expect(aviso).toBeVisible();

      // A 320 px o aviso cabe: o botão quebra a frase dentro do aviso e o Caixa não rola de lado.
      // Achado da varredura completa do 06.5-30 (`financeiro-caixa:310` e `polimento-celular-linhas:133`,
      // `scrollWidth 328 > 320`): com uma conta fixa ativa e o mês sem gerar, "Gerar as contas de
      // outubro de 2026" ficava numa linha só — o `shrink-0` do `Button` — e empurrava a página. Os
      // `--grep` dos planos nunca tinham conta fixa ativa ao mesmo tempo, então o aviso não aparecia.
      await page.setViewportSize({ width: 320, height: 900 });
      const botaoA320 = page.getByTestId(`caixa-gerar-fixas-${mesCorrente}`);
      const caixaDoAvisoA320 = await medirCaixa(aviso, "o aviso a 320 px");
      const caixaDoBotaoA320 = await medirCaixa(botaoA320, "o botão do aviso a 320 px");
      expect(
        caixaDoBotaoA320.x + caixaDoBotaoA320.width,
        `o botão (${caixaDoBotaoA320.width}px) passa da borda do aviso a 320 px`,
      ).toBeLessThanOrEqual(caixaDoAvisoA320.x + caixaDoAvisoA320.width + 0.5);
      expect(caixaDoBotaoA320.height).toBeGreaterThanOrEqual(44);
      const [larguraRolavel, larguraVisivel] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(
        larguraRolavel,
        `Caixa com o aviso a 320 px rola de lado (scrollWidth ${larguraRolavel} > clientWidth ${larguraVisivel})`,
      ).toBeLessThanOrEqual(larguraVisivel);

      // A chamada da ação (POST com o cabeçalho `next-action`) não chega ao servidor.
      await page.route("**/gestao/financeiro**", async (rota) => {
        if (rota.request().method() === "POST" && rota.request().headers()["next-action"]) {
          await rota.abort("failed");
          return;
        }
        await rota.continue();
      });

      const botao = page.getByTestId(`caixa-gerar-fixas-${mesCorrente}`);
      const erro = page.getByText("Não deu para gerar as contas. Verifique a internet e tente de novo.");
      await expect(async () => {
        if (await botao.isEnabled()) {
          await botao.click({ timeout: 2000 });
        }
        await expect(erro).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30000 });

      // Nada foi gerado: o aviso continua, com o botão de volta.
      await expect(aviso).toBeVisible();
      await expect(botao).toBeEnabled();
      await expect(botao).toHaveText(`Gerar as contas de ${nomeDoMes(mesCorrente)}`);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await devolverOBanco(contaFixaId, mesCorrente);
    }
  });

  test("o mês sem contas fixas geradas avisa com o atalho; gerar volta ao Caixa com o toast e o aviso some", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const mesCorrente = hoje.slice(0, 7);
    const mesesDaJanelaDeHoje = mesesDaJanela(hoje, janelaDoCaixa(hoje).ate);
    const nome = `[e2e] Aluguel da sala inventada ${sufixoUnico()}`;
    const contaFixaId = await criarContaFixaAtiva(nome);

    try {
      await fazerLogin(page);
      await page.goto("/gestao/financeiro?aba=caixa");

      // Um aviso por mês da janela, em ordem, entre os tiles e as listas.
      const aviso = page.getByTestId(`caixa-aviso-fixas-${mesCorrente}`);
      await expect(aviso).toBeVisible();
      await expect(aviso).toHaveAttribute("role", "status");
      await expect(aviso).toContainText(`As contas fixas de ${nomeDoMes(mesCorrente)} ainda não foram geradas.`);
      await expect(aviso).toContainText(
        `O que vence em ${nomeDoMesSemAno(mesCorrente)} não aparece em “A pagar” nem conta em “Se tudo se cumprir”.`,
      );
      const avisos = page.locator('[data-testid^="caixa-aviso-fixas-"]');
      await expect(avisos).toHaveCount(mesesDaJanelaDeHoje.length);
      for (const [indice, mes] of mesesDaJanelaDeHoje.entries()) {
        await expect(avisos.nth(indice)).toHaveAttribute("data-testid", `caixa-aviso-fixas-${mes}`);
      }
      const tiles = await medirCaixa(page.getByTestId("caixa-tile-saldo"), "tile do saldo");
      const caixaDoAviso = await medirCaixa(aviso, "aviso do mês corrente");
      const listas = await medirCaixa(page.getByTestId("caixa-a-pagar"), "lista A pagar");
      expect(caixaDoAviso.y).toBeGreaterThan(tiles.y);
      expect(caixaDoAviso.y).toBeLessThan(listas.y);

      const link = aviso.getByRole("link", { name: "ver em Contas fixas" });
      await expect(link).toHaveAttribute("href", "/gestao/cadastros?sub=fixas");

      const botao = page.getByTestId(`caixa-gerar-fixas-${mesCorrente}`);
      await expect(botao).toHaveText(`Gerar as contas de ${nomeDoMes(mesCorrente)}`);
      expect((await medirCaixa(botao)).height).toBeGreaterThanOrEqual(44);

      // Gerar — o clique pode chegar antes da hidratação; repete só enquanto nada aconteceu (o botão
      // fica desabilitado enquanto envia, e "Gerar" é idempotente no servidor de qualquer jeito).
      const mesPorExtenso = nomeDoMes(mesCorrente);
      const toastDasContas = page.getByText(
        new RegExp(
          `^(1 conta de ${mesPorExtenso} criada|([2-9]|\\d{2,}) contas de ${mesPorExtenso} criadas) no Caixa\\.$`,
        ),
      );
      await expect(async () => {
        if ((await botao.count()) > 0 && (await botao.isEnabled())) {
          await botao.click({ timeout: 2000 });
        }
        await expect(toastDasContas).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30000 });

      // De volta ao Caixa, a URL limpa e o aviso daquele mês some (o servidor não o devolve mais);
      // o do mês seguinte, se a janela chega nele, continua.
      await expect(page).toHaveURL(/\/gestao\/financeiro\?aba=caixa$/);
      await expect(page.getByTestId("caixa-a-pagar")).toBeVisible();
      await expect(page.getByTestId(`caixa-aviso-fixas-${mesCorrente}`)).toHaveCount(0);
      for (const mes of mesesDaJanelaDeHoje.slice(1)) {
        await expect(page.getByTestId(`caixa-aviso-fixas-${mes}`)).toBeVisible();
      }
    } finally {
      await devolverOBanco(contaFixaId, mesCorrente);
    }
  });

  // 06.5-WR-03 (quick 261007-shs; decisão do dono, 07/10/2026 — “perguntar antes”), pelo atalho do Caixa. As
  // afirmações são sobre a conta C pelo `data-conta-id`, nunca pela contagem de opções: outras contas canceladas
  // do banco podem aparecer — e ficam desmarcadas e canceladas.
  test("uma conta cancelada no mês corrente: gerar pergunta, Voltar não grava, marcada volta uma vez", async ({
    page,
  }) => {
    const hoje = hojeNoAtelie();
    const mesCorrente = hoje.slice(0, 7);
    const nome = `[e2e] Internet cancelada inventada ${sufixoUnico()}`;
    const contaFixaId = await criarContaFixaAtiva(nome);
    // A despesa de C no mês corrente, já CANCELADA no Caixa.
    const semeada = await semearContaAPagar({
      titulo: tituloDaContaFixa(nome, mesCorrente),
      categoria: "Aluguel",
      valorCentavos: 43210,
      vencimento: hoje,
      tipo: "despesa",
    });
    await comCliente((cliente) =>
      cliente.query(
        `update documentos
            set conta_fixa_id = $2, mes_referencia = $3::date, cancelado_em = now(),
                cancelado_por = (select id from usuarios where lower(email) = lower($4) limit 1)
          where id = $1`,
        [semeada.documentoId, contaFixaId, `${mesCorrente}-01`, process.env.E2E_EMAIL_TESTE ?? ""],
      ),
    );
    const ativasDeC = () =>
      comCliente(async (cliente) => {
        const { rows } = await cliente.query<{ total: string }>(
          `select count(*)::text as total from documentos
            where conta_fixa_id = $1 and mes_referencia = $2::date and cancelado_em is null`,
          [contaFixaId, `${mesCorrente}-01`],
        );
        return Number(rows[0]?.total ?? 0);
      });

    try {
      await fazerLogin(page);
      await page.goto("/gestao/financeiro?aba=caixa");
      const aviso = page.getByTestId(`caixa-aviso-fixas-${mesCorrente}`);
      await expect(aviso).toBeVisible();
      const botao = page.getByTestId(`caixa-gerar-fixas-${mesCorrente}`);
      const dialogo = page.getByTestId("gerar-canceladas");
      const opcaoDeC = dialogo.locator(`[data-testid="gerar-cancelada-opcao"][data-conta-id="${contaFixaId}"]`);

      // O clique pode chegar antes da hidratação: repete só enquanto o diálogo não abriu.
      const abrirDialogo = async () => {
        await expect(async () => {
          if (!(await dialogo.isVisible()) && (await botao.isEnabled())) {
            await botao.click({ timeout: 2000 });
          }
          await expect(dialogo).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 30000 });
      };

      // Gerar pergunta antes: C aparece pelo nome, desmarcada. Nada foi gravado.
      await abrirDialogo();
      await expect(opcaoDeC).toContainText(nome);
      await expect(opcaoDeC.getByRole("checkbox")).not.toBeChecked();
      expect((await medirCaixa(opcaoDeC, "a opção de C")).height).toBeGreaterThanOrEqual(44);
      expect(await ativasDeC()).toBe(0);

      // “Voltar”: fecha sem gravar — C continua sem despesa ativa e o aviso continua.
      await dialogo.getByTestId("gerar-canceladas-voltar").click();
      await expect(dialogo).toHaveCount(0);
      expect(await ativasDeC()).toBe(0);
      await expect(aviso).toBeVisible();

      // Gerar de novo, marcando C: ela volta, uma vez.
      await abrirDialogo();
      await opcaoDeC.getByRole("checkbox").click();
      await expect(opcaoDeC.getByRole("checkbox")).toBeChecked();
      await dialogo.getByTestId("gerar-canceladas-confirmar").click();
      const mesPorExtenso = nomeDoMes(mesCorrente);
      await expect(
        page.getByText(
          new RegExp(`^(1 conta de ${mesPorExtenso} criada|([2-9]|\\d{2,}) contas de ${mesPorExtenso} criadas) no Caixa\\.`),
        ),
      ).toBeVisible({ timeout: 10000 });
      expect(await ativasDeC()).toBe(1);
      await expect(page.getByTestId("caixa-a-pagar")).toBeVisible();
      await expect(page.getByTestId(`caixa-aviso-fixas-${mesCorrente}`)).toHaveCount(0);
    } finally {
      await devolverOBanco(contaFixaId, mesCorrente);
    }
  });
});

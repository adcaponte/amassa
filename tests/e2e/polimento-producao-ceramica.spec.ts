import { test, expect, type Page, type Route } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { ordensComONomeNoBanco, semearFicha, semearItemDoEstoque } from "./apoio/semear-producao";

// Fase 06.5, plano 28 (D-01, achado 3 do Cowork): só PEÇA DE CERÂMICA vira ordem de produção. O dono
// escolheu em 06/10/2026 a opção "a-ficha" — peça de cerâmica é a que tem ficha de precificação. O
// seletor "Peça" da produção da casa deixa de oferecer "Itens do estoque" (por onde chegavam "Bolo do
// dia", "Pin coffee" e pincéis) e `criarOrdem` recusa, no banco, um item sem ficha enviado à força.
//
// Cada teste cria só o que é dele, com nome único. O vazio ("nenhuma ficha no banco") é condição
// GLOBAL: vai num teste só de leitura `@vazio-global`, na cadeia `vazio-*` do `playwright.config.ts`,
// que roda no banco recém-criado antes de qualquer spec semear ficha.

const FRASE_SEM_PECA_DE_CERAMICA =
  "Nenhuma peça de cerâmica precificada ainda. Cadastre a ficha em Financeiro → Peças.";
const ROTULO_ONDE_CADASTRAR_PECA = "abrir Financeiro → Peças";

function fraseSoCeramicaViraOrdem(nome: string): string {
  return `Só peça de cerâmica vira ordem de produção — “${nome}” não é. Escolha uma peça do Catálogo.`;
}

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

// Abre a "Nova ordem" pelo botão da Produção (no cabeçalho, ou no estado vazio — nunca os dois).
async function abrirFolha(page: Page) {
  await page.goto("/gestao/producao");
  await page.getByTestId("nova-ordem-abrir").click();
  const folha = page.getByTestId("folha-nova-ordem");
  await expect(folha).toBeVisible();
  await expect(page).toHaveURL(/[?&]nova=1/);
  return folha;
}

test.describe("polimento produção — cerâmica", () => {
  test("a casa só oferece peça com ficha, e o item sem ficha enviado à força é recusado sem criar nada", async ({
    page,
  }) => {
    const nomeDaPeca = nomeUnico("Caneca de cerâmica");
    const { fichaId } = await semearFicha({
      nome: nomeDaPeca,
      exclusiva: false,
      comItem: true,
      argilaMiligramas: 350000,
      esmalteMiligramas: 40000,
      larguraMm: 90,
      profundidadeMm: 90,
      alturaMm: 100,
      horasMilesimos: 500,
    });
    const nomeDoItem = nomeUnico("Bolo de teste");
    const itemId = await semearItemDoEstoque({ nome: nomeDoItem });
    const nome = nomeUnico("Ordem forçada com bolo");

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("nova-ordem-tipo-casa")).toHaveAttribute("aria-checked", "true");

    // O seletor: a peça precificada aparece; o item do estoque sem ficha e o grupo dele, não.
    await folha.getByTestId("nova-ordem-peca-1").click();
    const opcoes = page.getByTestId("nova-ordem-opcoes-1");
    await expect(opcoes.getByRole("option", { name: nomeDaPeca, exact: true })).toBeVisible();
    await expect(opcoes.getByText("Peças precificadas", { exact: true })).toBeVisible();
    await expect(opcoes.getByRole("option", { name: nomeDoItem, exact: true })).toHaveCount(0);
    await expect(opcoes.getByText("Itens do estoque", { exact: true })).toHaveCount(0);
    await opcoes.getByRole("option", { name: nomeDaPeca, exact: true }).click();
    await expect(folha.getByTestId("nova-ordem-peca-1")).toContainText(nomeDaPeca);
    await folha.getByTestId("nova-ordem-nome").fill(nome);

    // O envio forçado (T-06.5-81): a tela não oferece o item, então quem tenta burlar troca a peça
    // no PEDIDO. A rota intercepta a chamada de `criarOrdem` (POST com `Next-Action`, corpo com as
    // peças) e troca a ficha escolhida pelo item sem ficha — o servidor é quem tem de recusar.
    let trocou = false;
    await page.route("**/gestao/producao**", async (route: Route) => {
      const pedido = route.request();
      const corpo = pedido.postData();
      if (
        pedido.method() !== "POST" ||
        pedido.headers()["next-action"] === undefined ||
        corpo === null ||
        !corpo.includes('"pecas"')
      ) {
        await route.continue();
        return;
      }
      const daFicha = `"origem":"ficha","fichaId":"${fichaId}"`;
      expect(corpo, "o pedido de criarOrdem leva a ficha escolhida").toContain(daFicha);
      trocou = true;
      await route.continue({
        postData: corpo.replace(daFicha, `"origem":"item","itemCatalogoId":"${itemId}"`),
      });
    });

    await folha.getByTestId("nova-ordem-criar").click();

    const recusa = folha.locator('[data-testid="nova-ordem-erro"][data-campo="peca-1"]');
    await expect(recusa).toHaveText(fraseSoCeramicaViraOrdem(nomeDoItem));
    await expect(recusa).toHaveAttribute("role", "alert");
    expect(trocou).toBe(true);
    // Nada foi criado: a folha continua aberta e nenhuma ordem tem o nome que este teste escreveu.
    await expect(folha).toBeVisible();
    await expect(page).toHaveURL(/[?&]nova=1/);
    expect(await ordensComONomeNoBanco(nome)).toEqual([]);
  });

  test("sem nenhuma peça de cerâmica, a casa mostra o vazio com o link para Financeiro → Peças @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("nova-ordem-tipo-casa")).toHaveAttribute("aria-checked", "true");

    const vazio = folha.getByTestId("nova-ordem-catalogo-vazio");
    await expect(vazio).toContainText(FRASE_SEM_PECA_DE_CERAMICA);
    const link = vazio.getByRole("link", { name: ROTULO_ONDE_CADASTRAR_PECA });
    await expect(link).toHaveAttribute("href", "/gestao/financeiro?aba=pecas");
    expect((await medirCaixa(link, "o link do vazio")).height).toBeGreaterThanOrEqual(44);
    // Sem peça, nada a criar: o seletor não aparece e "Criar ordem" fica desligado, dizendo por quê.
    await expect(folha.getByTestId("nova-ordem-peca-1")).toHaveCount(0);
    await expect(folha.getByTestId("nova-ordem-criar")).toBeDisabled();
  });
});

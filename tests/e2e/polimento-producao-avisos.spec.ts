import { test, expect, type Page } from "@playwright/test";

import { medirCaixa } from "./apoio/medir-caixa";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  diaMes,
  ordemNoBanco,
  ordensComONomeNoBanco,
  semearOrdem,
  semearOrdemEncerrada,
} from "./apoio/semear-producao";

// Fase 06.5, plano 07 (D-11, achados 12, 14 e 15 do Cowork): os três avisos pequenos da Produção.
// Cada teste cria só o que é dele, com nome único, e nunca afirma estado global do banco. "Hoje" é o
// dia de Brasília (`somarDiasAoHoje`, sobre `hojeNoAtelie()`), o mesmo que a página entrega à folha.

const TEXTO_AVISO_PRAZO_CORPO =
  "Dá para criar assim mesmo; ela já nasce atrasada. Para caber, mude a entrega ou ajuste os dias das etapas depois de criar.";

const TEXTO_AVISO_IMPRESSAO_A4 =
  "Esta folha é para imprimir em A4 — no celular a prévia fica apertada, mas o papel sai certo.";

// Os previstos padrão (`DIAS_PREVISTOS_PADRAO`, D-10): 5 + 15 + 1 + 4 + 1 + 6 no completo e
// 5 + 15 + 1 + 6 no que termina no biscoito.
const DIAS_DO_COMPLETO = 32;
const DIAS_DO_BISCOITO = 27;

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

async function abrirFolha(page: Page) {
  await page.goto("/gestao/producao");
  await page.getByTestId("nova-ordem-abrir").click();
  const folha = page.getByTestId("folha-nova-ordem");
  await expect(folha).toBeVisible();
  await expect(folha.getByTestId("nova-ordem-peca-1")).toBeVisible();
  return folha;
}

function manchete(diasDasEtapas: number, diasDepois: number): string {
  const prontaEm = diaMes(somarDiasAoHoje(diasDasEtapas));
  const depois = diasDepois === 1 ? "1 dia" : `${diasDepois} dias`;
  return `As etapas somam ${diasDasEtapas} dias — a ordem fica pronta em ${prontaEm}, ${depois} depois da entrega.`;
}

test.describe("polimento produção — avisos", () => {
  test("prazo: a entrega que não cabe é avisada na folha, some quando cabe ou é apagada, e criar continua possível", async ({
    page,
  }) => {
    const nome = nomeUnico("Pratos com prazo curto");
    const entregaCurta = somarDiasAoHoje(15);

    await fazerLogin(page);
    const folha = await abrirFolha(page);
    await folha.getByTestId("nova-ordem-nome").fill(nome);
    await folha.getByTestId("nova-ordem-tipo-encomenda").click();
    await folha.getByTestId("nova-ordem-cliente").fill(nomeUnico("Cliente"));
    await expect(folha.getByTestId("nova-ordem-caminho-completo")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    const aviso = folha.getByTestId("nova-ordem-aviso-prazo");
    const entrega = folha.getByTestId("nova-ordem-entrega");
    // Sem data, nada a avisar.
    await expect(aviso).toHaveCount(0);

    // Caminho completo, entrega em 15 dias: pronta em hoje + 32, 17 dias depois.
    await entrega.fill(entregaCurta);
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAttribute("role", "status");
    await expect(aviso).toContainText(manchete(DIAS_DO_COMPLETO, DIAS_DO_COMPLETO - 15));
    await expect(aviso).toContainText(TEXTO_AVISO_PRAZO_CORPO);
    // Logo abaixo do campo de entrega.
    const caixaDoCampo = await medirCaixa(entrega, "campo da entrega");
    const caixaDoAviso = await medirCaixa(aviso, "aviso de prazo");
    expect(caixaDoAviso.y).toBeGreaterThanOrEqual(caixaDoCampo.y + caixaDoCampo.height);
    expect(caixaDoAviso.y - (caixaDoCampo.y + caixaDoCampo.height)).toBeLessThanOrEqual(24);

    // Trocar o caminho recalcula: biscoito soma 27, pronta 12 dias depois.
    await folha.getByTestId("nova-ordem-caminho-biscoito").click();
    await expect(aviso).toContainText(manchete(DIAS_DO_BISCOITO, DIAS_DO_BISCOITO - 15));
    await folha.getByTestId("nova-ordem-caminho-completo").click();
    await expect(aviso).toContainText(manchete(DIAS_DO_COMPLETO, DIAS_DO_COMPLETO - 15));

    // Entrega que cabe: o aviso some.
    await entrega.fill(somarDiasAoHoje(60));
    await expect(aviso).toHaveCount(0);
    // Data apagada: continua sem aviso; a data curta de novo o traz de volta.
    await entrega.fill(entregaCurta);
    await expect(aviso).toBeVisible();
    await entrega.fill("");
    await expect(aviso).toHaveCount(0);

    // Com o aviso visível, "Criar ordem" cria — e a ordem nasce com "vai atrasar".
    await entrega.fill(entregaCurta);
    await expect(aviso).toBeVisible();
    await expect(folha.getByTestId("nova-ordem-criar")).toBeEnabled();
    await folha.getByTestId("nova-ordem-peca-1").click();
    await page.getByRole("option", { name: "Outra peça — escrever o nome", exact: true }).click();
    await folha.getByTestId("nova-ordem-peca-nome-1").fill("Prato raso");
    await folha.getByTestId("nova-ordem-criar").click();

    await expect(page).toHaveURL(/\/gestao\/producao\/[0-9a-f-]{36}$/);
    const ids = await ordensComONomeNoBanco(nome);
    expect(ids).toHaveLength(1);
    expect(await ordemNoBanco(ids[0])).toMatchObject({
      status: "ativa",
      entregaPrometida: entregaCurta,
    });

    await page.goto("/gestao/producao");
    const selo = page
      .locator(`[data-testid="producao-cartao"][data-ordem-id="${ids[0]}"]`)
      .getByTestId("producao-selo");
    await expect(selo).toHaveAttribute("data-selo", "vai-atrasar");
    // A mesma conta do aviso: 17 dias.
    await expect(selo).toContainText(`vai atrasar ${DIAS_DO_COMPLETO - 15} dias`);
  });

  test("A4: as duas folhas de impressão avisam só no celular, e o aviso nunca vai ao papel", async ({
    page,
  }) => {
    // Uma ordem própria garante que a folha geral não é o estado vazio.
    const ordemId = await semearOrdem({
      nome: nomeUnico("Folha no celular"),
      tipo: "casa",
      caminho: "completo",
      status: "ativa",
      inicio: somarDiasAoHoje(0),
      etapasFeitas: [],
      pecas: [{ descricao: "Caneca", quantidade: 4 }],
    });

    await fazerLogin(page);
    for (const endereco of ["/gestao/producao/imprimir", `/gestao/producao/${ordemId}/imprimir`]) {
      await page.emulateMedia({ media: "screen" });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(endereco);
      const aviso = page.getByTestId("folha-aviso-a4");
      await expect(aviso).toBeVisible();
      await expect(aviso).toHaveText(TEXTO_AVISO_IMPRESSAO_A4);
      await expect(aviso.locator("svg")).toHaveAttribute("aria-hidden", "true");
      // Numa linha própria, embaixo dos dois botões da barra.
      const voltar = await medirCaixa(page.getByTestId("folha-voltar"), "Voltar");
      const imprimir = await medirCaixa(page.getByTestId("folha-imprimir"), "Imprimir folha");
      const caixaDoAviso = await medirCaixa(aviso, "aviso A4");
      expect(caixaDoAviso.y).toBeGreaterThanOrEqual(
        Math.max(voltar.y + voltar.height, imprimir.y + imprimir.height),
      );

      // No papel, nem no celular.
      await page.emulateMedia({ media: "print" });
      await expect(aviso).toBeHidden();

      // No desktop, não aparece, e a barra continua uma fileira só.
      await page.emulateMedia({ media: "screen" });
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(aviso).toBeHidden();
      const voltarNoDesktop = await medirCaixa(page.getByTestId("folha-voltar"), "Voltar");
      const imprimirNoDesktop = await medirCaixa(page.getByTestId("folha-imprimir"), "Imprimir");
      expect(Math.abs(voltarNoDesktop.y - imprimirNoDesktop.y)).toBeLessThanOrEqual(1);
      await page.emulateMedia({ media: "print" });
      await expect(aviso).toBeHidden();
    }
  });

  test("levou: as Concluídas dizem “no mesmo dia” e “levou 1 dia”, no lugar do número solto", async ({
    page,
  }) => {
    const hoje = somarDiasAoHoje(0);
    const noMesmoDia = await semearOrdemEncerrada({
      nome: nomeUnico("Concluída no mesmo dia"),
      tipo: "casa",
      quantidade: 3,
      inicio: hoje,
      status: "concluida",
      concluidaEm: hoje,
      perdidas: 0,
    });
    const umDia = await semearOrdemEncerrada({
      nome: nomeUnico("Concluída em um dia"),
      tipo: "casa",
      quantidade: 3,
      inicio: somarDiasAoHoje(-1),
      status: "concluida",
      concluidaEm: hoje,
      perdidas: 0,
    });

    await fazerLogin(page);
    await page.goto("/gestao/producao/concluidas");
    await expect(page.getByTestId("concluidas-lista")).toBeVisible();
    const linha = (id: string) =>
      page.locator(`[data-testid="concluidas-linha"][data-ordem-id="${id}"]`);
    // Concluídas hoje: entre as mais recentes; o "Mostrar mais 50" as traz se outras as empurrarem.
    for (let pagina = 0; pagina < 20; pagina++) {
      if ((await linha(noMesmoDia).count()) > 0 && (await linha(umDia).count()) > 0) {
        break;
      }
      const mais = page.getByTestId("concluidas-mais");
      if ((await mais.count()) === 0) {
        break;
      }
      const antes = await page.getByTestId("concluidas-linha").count();
      await mais.click();
      await expect(page.getByTestId("concluidas-linha")).not.toHaveCount(antes);
    }
    await expect(linha(noMesmoDia).getByTestId("concluidas-dias")).toHaveText("no mesmo dia");
    await expect(linha(umDia).getByTestId("concluidas-dias")).toHaveText("levou 1 dia");
  });
});

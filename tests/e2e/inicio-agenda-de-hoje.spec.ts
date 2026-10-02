import { test, expect, type Page } from "@playwright/test";

import { horaDe } from "@/lib/agenda/horario";

import {
  agoraNoAtelie,
  apagarFechadoNoBanco,
  cancelarDataNoBanco,
  lancamentosDoDia,
  marcarPresencaNoBanco,
  semearCliente,
  semearFechado,
  semearInscricao,
  semearOficina,
  semearUsoLivre,
  travarODiaDaAgenda,
} from "./apoio/semear-agenda";
import { somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-14 (D-05, D-18, GES-09, UI-D19): o bloco "Agenda de hoje" do Início lê a Agenda — as linhas do
// dia, cada uma abrindo a folha, e "Agora no espaço" de verdade.
//
// O número EXATO de "Agora no espaço" e as contagens de linhas do dia são condição GLOBAL do banco (tudo o
// que existe hoje) — por isso a série roda na cadeia `vazio-historico` de `playwright.config.ts`, antes de
// `desktop`/`celular` semearem coisas de hoje, e nunca por `--grep` (CLAUDE.md). Os casos são cumulativos:
// cada um conta com o que o anterior deixou. A aba Números (`agenda-numeros.spec.ts`) roda na mesma etapa e
// semeia no mês — as duas séries se revezam pela trava `travarODiaDaAgenda`, e as contagens de linhas partem
// do que já existia hoje quando esta série pegou a trava (`base`).
//
// "Agora" perto da meia-noite: o intervalo da oficina que cobre o agora é encaixado no dia (início ≥ 00:00,
// fim ≤ 23:59 — `check (fim > inicio)` recusaria o que atravessa a meia-noite, Pitfall 12); nos últimos
// minutos do dia a série espera o dia virar antes de semear. A lógica exaustiva do agora fica no
// unitário de `pessoasAgoraNoEspaco`.

const VAGAS = 8;

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

function linhas(page: Page) {
  return page.getByTestId("inicio-bloco-agenda").getByTestId("inicio-agenda-linha");
}

function linha(page: Page, id: string) {
  return page.getByTestId("inicio-bloco-agenda").locator(`[data-testid="inicio-agenda-linha"][data-id="${id}"]`);
}

test.describe.serial("inicio agenda de hoje @vazio-historico", () => {
  // Preenchidos pelo caso (a) e lidos pelos seguintes.
  let hoje = "";
  let oficina = { id: "", titulo: "" };
  let usoDeHoje = { id: "", nome: "" };
  let usoDeOntem = "";
  let fechadoId: string | null = null;
  // Quantos lançamentos já existiam hoje ao pegar a trava (a série dos Números pode ter deixado algum).
  let base = 0;
  let trava: { soltar: () => Promise<void> } | null = null;

  test.beforeAll(async () => {
    test.setTimeout(15 * 60_000);
    // A série inteira cabe em poucos minutos; nos últimos 10 do dia, espera virar (o "hoje" do servidor e o
    // da semente têm de ser o mesmo dia).
    const { minutos } = agoraNoAtelie();
    if (minutos >= 1430) {
      await new Promise((resolver) => setTimeout(resolver, (1440 - minutos) * 60_000 + 30_000));
    }
    trava = await travarODiaDaAgenda();
  });

  test.afterAll(async () => {
    // O dia fechado de HOJE sai, para os casos de `desktop`/`celular` que lançam em hoje (D-13).
    try {
      if (fechadoId !== null) {
        await apagarFechadoNoBanco(fechadoId);
      }
    } finally {
      await trava?.soltar();
    }
  });

  test("(a) “Agora no espaço” soma o uso livre de hoje no espaço e os inscritos da oficina que cobre o agora, sem quem faltou e sem o uso esquecido de ontem", async ({
    page,
  }) => {
    const agora = agoraNoAtelie();
    hoje = agora.data;
    base = await lancamentosDoDia(hoje);
    const suf = sufixoUnico();

    // A oficina cobre o agora, encaixada no dia: até 1 h antes, até 2 h depois (ou 23:59).
    const inicio = horaDe(Math.max(0, agora.minutos - 60));
    const fim = agora.minutos + 120 > 1439 ? "23:59" : horaDe(agora.minutos + 120);
    oficina = { id: "", titulo: `[e2e] Oficina de agora ${suf}` };
    oficina.id = await semearOficina({ titulo: oficina.titulo, data: hoje, inicio, fim, vagas: VAGAS, precoCentavos: 9000 });
    const inscricoes: string[] = [];
    for (const letra of ["A", "B", "C"]) {
      const clienteId = await semearCliente({ nome: `[e2e] Aluna ${letra} ${suf}` });
      inscricoes.push(await semearInscricao({ eventoId: oficina.id, clienteId, tipo: "oficina", valorCentavos: 9000 }));
    }
    await marcarPresencaNoBanco(inscricoes[0], "faltou");

    // O uso de hoje, no espaço, com 2 pessoas; o de ONTEM esquecido no espaço, com 5 (D-18: não conta).
    usoDeHoje = { id: "", nome: `[e2e] Uso de hoje ${suf}` };
    const clienteDoUso = await semearCliente({ nome: usoDeHoje.nome });
    usoDeHoje.id = await semearUsoLivre({
      clienteId: clienteDoUso,
      data: hoje,
      chegadaPrevista: inicio,
      horasPrevistas: 2,
      pessoas: 2,
      estado: "no_espaco",
      chegada: inicio,
    });
    const clienteDeOntem = await semearCliente({ nome: `[e2e] Uso de ontem ${suf}` });
    usoDeOntem = await semearUsoLivre({
      clienteId: clienteDeOntem,
      data: somarDiasAoHoje(-1),
      chegadaPrevista: "10:00",
      horasPrevistas: 2,
      pessoas: 5,
      estado: "no_espaco",
      chegada: "10:00",
    });

    await fazerLogin(page);
    // 2 do uso livre + 3 inscritos − 1 que faltou = 4. Uma contagem, sem "de", sem lugares.
    const faixa = page.getByTestId("inicio-ocupacao");
    await expect(faixa).toHaveText(/^Agora no espaço\s*4 pessoas$/);
    await expect(faixa).not.toContainText(/\bde\s+\d|lugar|capacidade/);
    await expect(page.getByTestId("inicio-bloco-agenda")).not.toContainText("Nada marcado para hoje.");
  });

  test("(b) as linhas do dia: a oficina com “3 de {vagas} inscritos” e “marcar presença”, o uso livre com “2 pessoas · no espaço”; tocar a oficina abre a folha com a lista", async ({
    page,
  }) => {
    await fazerLogin(page);
    await expect(linhas(page)).toHaveCount(Math.min(6, base + 2));

    const daOficina = linha(page, oficina.id);
    await expect(daOficina).toHaveAttribute("data-tipo", "avulsa");
    await expect(daOficina).toContainText(oficina.titulo);
    await expect(daOficina).toContainText(`3 de ${VAGAS} inscritos`);
    // Já passou do início e duas pessoas estão sem marcação.
    await expect(daOficina.getByTestId("inicio-agenda-marcar-presenca")).toHaveText("marcar presença");

    const doUso = linha(page, usoDeHoje.id);
    await expect(doUso).toHaveAttribute("data-tipo", "uso_livre");
    await expect(doUso).toContainText(`Uso livre · ${usoDeHoje.nome}`);
    await expect(doUso).toContainText("2 pessoas · no espaço");
    // O uso esquecido de ontem não é linha de hoje.
    await expect(linha(page, usoDeOntem)).toHaveCount(0);

    // Toque 1: a linha. Toque 2 já seria o "Veio" de alguém na lista.
    await daOficina.click();
    await expect(page).toHaveURL(new RegExp(`/gestao/agenda\\?semana=\\d{4}-\\d{2}-\\d{2}&evento=${oficina.id}`));
    const folha = page.getByTestId("folha-evento");
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId("inscrito")).toHaveCount(3);
  });

  test("(c) com 7 lançamentos hoje (ou mais), 6 linhas e “e mais {N}” para a semana; a data cancelada aparece riscada com a tag", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    // Já há 2 (a oficina e o uso de hoje); mais 5 avulsas sem ninguém, uma delas cancelada à 00:00 (a
    // primeira do dia, nunca cortada).
    const cancelada = await semearOficina({
      titulo: `[e2e] Cancelada ${suf}`,
      data: hoje,
      inicio: "00:00",
      fim: "00:30",
      vagas: 4,
      precoCentavos: 1000,
    });
    await cancelarDataNoBanco(cancelada);
    for (let indice = 1; indice <= 4; indice += 1) {
      await semearOficina({
        titulo: `[e2e] Extra ${indice} ${suf}`,
        data: hoje,
        inicio: horaDe(indice * 60),
        fim: horaDe(indice * 60 + 30),
        vagas: 4,
        precoCentavos: 1000,
      });
    }

    await fazerLogin(page);
    await expect(linhas(page)).toHaveCount(6);
    const mais = page.getByTestId("inicio-agenda-mais");
    // Sozinha no dia, a série chega a 7: "e mais 1".
    await expect(mais).toHaveText(`e mais ${base + 7 - 6}`);
    await expect(mais).toHaveAttribute("href", new RegExp(`/gestao/agenda\\?semana=${hoje}`));

    const daCancelada = linha(page, cancelada);
    await expect(daCancelada.getByTestId("inicio-agenda-cancelada")).toHaveText("cancelada");
    await expect(daCancelada.locator(".line-through")).toHaveCount(1);
    // Ninguém inscrito na cancelada: a contagem não muda.
    await expect(page.getByTestId("inicio-ocupacao")).toHaveText(/^Agora no espaço\s*4 pessoas$/);
  });

  test("(d) um dia fechado hoje vem primeiro, com “Fechado · {motivo}” e “o dia todo”", async ({ page }) => {
    const motivo = `[e2e] Feriado ${sufixoUnico()}`;
    fechadoId = await semearFechado({ data: hoje, motivo });

    await fazerLogin(page);
    const primeira = linhas(page).first();
    await expect(primeira).toHaveAttribute("data-tipo", "fechado");
    await expect(primeira).toContainText(`Fechado · ${motivo}`);
    await expect(primeira).toContainText("o dia todo");
    await expect(primeira).toHaveAttribute("href", new RegExp(`evento=${fechadoId}`));
    await expect(linhas(page)).toHaveCount(6);
    await expect(page.getByTestId("inicio-agenda-mais")).toHaveText(`e mais ${base + 8 - 6}`);
  });
});

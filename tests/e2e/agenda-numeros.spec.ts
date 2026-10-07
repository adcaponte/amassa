import { test, expect, type Page } from "@playwright/test";

import { DIAS_DAS_BARRAS } from "@/lib/agenda/numeros";
import { segundaDaSemana } from "@/lib/agenda/semana";
import { diasEntre } from "@/lib/producao/calendario";

import { medirCaixa } from "./apoio/medir-caixa";
import {
  agoraNoAtelie,
  marcarFaltaComDireitoNoBanco,
  marcarPresencaNoBanco,
  presencasDoPeriodo,
  semearCliente,
  semearInscricao,
  semearTurmaComDatas,
  semearUsoLivreEncerrado,
  travarODiaDaAgenda,
} from "./apoio/semear-agenda";

// Plano 05-14 (AGE-19, UI-D22): a aba Números — só leitura, do dia 1 até hoje no fuso do ateliê, sem
// dinheiro. Os quatro quadros e as barras somam o banco INTEIRO do mês, então a série roda na cadeia
// `vazio-historico` (antes de `desktop`/`celular` semearem o mês) e confere pelas DIFERENÇAS entre a leitura
// de antes e a de depois de semear. O bloco do Início (`inicio-agenda-de-hoje.spec.ts`) roda na mesma
// etapa e semeia no mês — as duas séries se revezam pela trava `travarODiaDaAgenda`. A presença não se
// subtrai (é uma razão): os dois lados de antes vêm do banco (`presencasDoPeriodo`), e a porcentagem
// esperada é a regra do UI-SPEC (meio para cima) sobre eles.

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

type Leitura = {
  horas: number;
  visitas: number;
  faltas: number;
  aRepor: number;
  pessoas: number;
  barras: Record<string, number>;
};

function numeroDeHoras(texto: string): number {
  const casamento = /^([\d.]+) h$/.exec(texto.trim());
  if (!casamento) {
    throw new Error(`Horas fora do formato "{h} h": "${texto}"`);
  }
  return Number(casamento[1].replace(/\./g, ""));
}

async function texto(page: Page, testId: string): Promise<string> {
  return ((await page.getByTestId(testId).textContent()) ?? "").trim();
}

async function lerNumeros(page: Page): Promise<Leitura> {
  await page.goto("/gestao/agenda?aba=numeros");
  await expect(page.getByTestId("agenda-numeros")).toBeVisible();
  const visitas = /^(\d+) visitas?$/.exec(await texto(page, "numeros-quadro-uso-sub"));
  const subPresenca = await texto(page, "numeros-quadro-presenca-sub");
  const faltas = subPresenca === "nenhuma presença marcada" ? ["", "0"] : /^(\d+) faltas?$/.exec(subPresenca);
  if (!visitas || !faltas) {
    throw new Error(`Sub-linhas fora do formato: "${visitas}" / "${subPresenca}"`);
  }
  const barras: Record<string, number> = {};
  for (const dia of DIAS_DAS_BARRAS) {
    barras[dia] = numeroDeHoras(await texto(page, `numeros-barra-${dia}-valor`));
  }
  return {
    horas: numeroDeHoras(await texto(page, "numeros-quadro-uso-numero")),
    visitas: Number(visitas[1]),
    faltas: Number(faltas[1]),
    aRepor: Number(await texto(page, "numeros-quadro-repor-numero")),
    pessoas: Number(await texto(page, "numeros-quadro-pessoas-numero")),
    barras,
  };
}

function diaDaBarra(data: string): string {
  return DIAS_DAS_BARRAS[diasEntre(segundaDaSemana(data), data)];
}

function porcentoMeioParaCima(parte: number, todo: number): number {
  return Math.floor((200 * parte + todo) / (2 * todo));
}

test.describe.serial("agenda numeros @vazio-historico", () => {
  let trava: { soltar: () => Promise<void> } | null = null;

  test.beforeAll(async () => {
    test.setTimeout(15 * 60_000);
    // Nos últimos minutos do dia, espera virar: o "hoje" do servidor e o da semente têm de ser o mesmo.
    const { minutos } = agoraNoAtelie();
    if (minutos >= 1430) {
      await new Promise((resolver) => setTimeout(resolver, (1440 - minutos) * 60_000 + 30_000));
    }
    trava = await travarODiaDaAgenda();
  });

  test.afterAll(async () => {
    await trava?.soltar();
  });

  test("os quatro quadros e a barra do dia somam o que foi semeado no mês: horas-pessoa, presença, faltas, aulas a repor e pessoas diferentes", async ({
    page,
  }) => {
    const agora = agoraNoAtelie();
    const hoje = agora.data;
    const primeiro = `${hoje.slice(0, 7)}-01`;
    // O dia 1 do mês (um dia do período que o Início não usa); no dia 1, só ele existe — hoje.
    const data = primeiro;
    // A data da turma (2h30) NUNCA cobre o agora: com gente "Veio", ela contaria em "Agora no espaço".
    const [inicio, fim] = agora.minutos >= 200 ? ["00:00", "02:30"] : ["20:00", "22:30"];
    const suf = sufixoUnico();

    await fazerLogin(page);
    const antes = await lerNumeros(page);
    const presencasAntes = await presencasDoPeriodo(primeiro, hoje);

    // Uso livre encerrado: 3 h cheias × 2 pessoas = 6 horas-pessoa, 1 visita.
    const clienteDoUso = await semearCliente({ nome: `[e2e] Números uso ${suf}` });
    await semearUsoLivreEncerrado({ clienteId: clienteDoUso, data, horas: 3, pessoas: 2, precoHoraCentavos: 3000 });

    // Uma data de turma de 2h30 com 2 "Veio" e 1 "Faltou" com direito a repor.
    const { eventoIds } = await semearTurmaComDatas({
      nome: `[e2e] Turma dos Números ${suf}`,
      diaSemana: 1,
      inicio,
      fim,
      vagas: 6,
      mensalidadeCentavos: 20000,
      diaVencimento: 10,
      datas: [data],
    });
    const inscricoes: string[] = [];
    for (const letra of ["A", "B", "C"]) {
      const clienteId = await semearCliente({ nome: `[e2e] Números aluna ${letra} ${suf}` });
      inscricoes.push(await semearInscricao({ eventoId: eventoIds[0], clienteId, tipo: "aluno" }));
    }
    await marcarPresencaNoBanco(inscricoes[0], "veio");
    await marcarPresencaNoBanco(inscricoes[1], "veio");
    await marcarFaltaComDireitoNoBanco(inscricoes[2]);

    const depois = await lerNumeros(page);

    // USO LIVRE: +6 h e +1 visita.
    expect(depois.horas - antes.horas).toBe(6);
    expect(depois.visitas - antes.visitas).toBe(1);
    // PRESENÇA NAS AULAS: veio ÷ marcadas, meio para cima (67% com o mês vazio antes) e +1 falta, no plural
    // de verdade.
    const veio = presencasAntes.veio + 2;
    const marcadas = presencasAntes.veio + presencasAntes.faltou + 3;
    await expect(page.getByTestId("numeros-quadro-presenca-numero")).toHaveText(`${porcentoMeioParaCima(veio, marcadas)}%`);
    const faltas = presencasAntes.faltou + 1;
    await expect(page.getByTestId("numeros-quadro-presenca-sub")).toHaveText(faltas === 1 ? "1 falta" : `${faltas} faltas`);
    // AULAS A REPOR: a falta com direito abre 1.
    expect(depois.aRepor - antes.aRepor).toBe(1);
    // PESSOAS NO ESPAÇO: a do uso e as duas que vieram (quem só faltou não conta).
    expect(depois.pessoas - antes.pessoas).toBe(3);
    // A barra do dia da semana da data: 6 do uso + 2 presentes × teto(2h30) = 6 da aula.
    const dia = diaDaBarra(data);
    expect(depois.barras[dia] - antes.barras[dia]).toBe(12);
    for (const outro of DIAS_DAS_BARRAS.filter((d) => d !== dia)) {
      expect(depois.barras[outro]).toBe(antes.barras[outro]);
    }

    // O título do mês, a ordem das barras (segunda → domingo) e a dica; nada de dinheiro.
    await expect(page.getByTestId("agenda-numeros")).toContainText(", até hoje");
    await expect(page.locator('[data-testid^="numeros-barra-"][data-testid$="-valor"]')).toHaveCount(7);
    const ordem = await page
      .locator('li[data-testid^="numeros-barra-"]')
      .evaluateAll((itens) => itens.map((item) => item.getAttribute("data-testid")));
    expect(ordem).toEqual(DIAS_DAS_BARRAS.map((d) => `numeros-barra-${d}`));
    await expect(page.getByTestId("agenda-numeros")).toContainText("Horas-pessoa: cada pessoa presente conta as horas que ficou.");
    await expect(page.getByTestId("agenda-numeros")).not.toContainText("R$");
    // Pelo papel, não pelo `data-testid`: enquanto o React 19 segura a revelação do `Suspense`, a cópia
    // ainda oculta das abas convive com a do esqueleto, e só a visível tem o papel acessível.
    await expect(page.getByRole("tab", { name: "Números" })).toHaveAttribute("aria-selected", "true");
  });

  test("a 360px os quadros ficam 2 × 2, sem cortar o rótulo nem rolar a página na horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await fazerLogin(page);
    await page.goto("/gestao/agenda?aba=numeros");
    await expect(page.getByTestId("agenda-numeros")).toBeVisible();

    const caixas = await Promise.all(
      ["uso", "presenca", "repor", "pessoas"].map(async (quadro) => {
        return medirCaixa(page.getByTestId(`numeros-quadro-${quadro}`), `o quadro ${quadro}`);
      }),
    );
    // 2 × 2: o 1º e o 2º na mesma fileira, o 3º e o 4º embaixo.
    expect(Math.abs(caixas[0].y - caixas[1].y)).toBeLessThan(2);
    expect(Math.abs(caixas[2].y - caixas[3].y)).toBeLessThan(2);
    expect(caixas[2].y).toBeGreaterThan(caixas[0].y + caixas[0].height - 2);

    // "PRESENÇA NAS AULAS" quebra em linhas, sem cortar; a página não rola na horizontal.
    const rotulo = page.getByTestId("numeros-quadro-presenca-rotulo");
    const cabe = await rotulo.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth);
    expect(cabe).toBe(true);
    const semRolagem = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(semRolagem).toBe(true);
  });
});

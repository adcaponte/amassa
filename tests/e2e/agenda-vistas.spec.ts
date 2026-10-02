import { test, expect, type Page } from "@playwright/test";

import { tituloDaSemana, tituloDoMes, segundaDaSemana } from "@/lib/agenda/semana";
import { somarDias } from "@/lib/producao/calendario";

import {
  cancelarDataNoBanco,
  ligarVendaACobranca,
  semearCliente,
  semearFechado,
  semearInscricao,
  semearOficina,
  semearTurmaComDatas,
  semearUsoLivre,
  semearUsoLivreEncerrado,
} from "./apoio/semear-agenda";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";

// Plano 05-03, Tarefa 3 (AGE-02, UI-D2, UI-D21, UI-D27): andar pela agenda — "‹ ›" e "Hoje" na
// semana, e a vista do mês com um ponto por lançamento e o resumo no `aria-label`. Os dias com
// lançamento são reservados por projeto (desktop e celular rodam juntos e o resumo CONTA o que há
// no dia); nenhum caso afirma condição global do banco. "Hoje" pelo dia de Brasília.

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

function deslocamentoDoProjeto(): number {
  return test.info().project.name === "celular" ? 1 : 0;
}

async function irParaOMesDe(page: Page, data: string) {
  await page.getByTestId("agenda-vista-mes").click();
  await expect(page.getByTestId("agenda-mes")).toBeVisible();
  // O alternador abre o mês de hoje; o dia pode estar no mês seguinte.
  if (data.slice(0, 7) !== hojeNoAtelie().slice(0, 7)) {
    await page.getByTestId("agenda-proxima").click();
  }
  await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDoMes(data.slice(0, 7)));
}

// A régua da rolagem lateral a 320px (backstops E2 e E4 do 05-UI-SPEC.md). Devolve o que está errado — lista
// vazia = nada estoura. Duas medidas:
//
// 1. A página: `scrollWidth <= clientWidth`. NUNCA `innerWidth`: no projeto celular (Pixel 7, `isMobile`) o
//    Chromium alarga o `innerWidth` até o conteúdo que estoura — medido em 02/10/2026: um bloco de 400px numa
//    tela de 320px deu innerWidth 400 e clientWidth 320, e `scrollWidth <= innerWidth` passava com a página
//    rolando de lado. Foi por isso que só o desktop acusou o defeito no CI (run 36956290624).
// 2. A coluna: nada da barra nem da semana/do mês passa da borda da coluna (320 − 2 × 24px). Esta pega o
//    estouro mesmo quando a sobra de 24px do `px-6` o esconde da medida 1 — e essa sobra depende da fonte do
//    sistema: "28/12/2026 a 03/01/2027" mede ~182px no Chromium do Windows e ~196px no do Linux do CI, e
//    com o título preso numa linha o `nav` ia a 310px num caso e a 328px no outro.
async function estourosA320(page: Page, conteudo: "agenda-semana" | "agenda-mes"): Promise<string[]> {
  return page.evaluate(async (testIdDoConteudo) => {
    await document.fonts.ready;
    const problemas: string[] = [];
    const raiz = document.documentElement;
    if (raiz.scrollWidth > raiz.clientWidth) {
      problemas.push(`a página rola de lado: scrollWidth ${raiz.scrollWidth} > clientWidth ${raiz.clientWidth}`);
    }
    const barra = document.querySelector('[data-testid="agenda-barra"]');
    const corpo = document.querySelector(`[data-testid="${testIdDoConteudo}"]`);
    if (barra === null || corpo === null) {
      return [...problemas, "a barra ou o conteúdo da vista não está na tela"];
    }
    const coluna = barra.getBoundingClientRect();
    for (const elemento of [...barra.querySelectorAll("*"), ...corpo.querySelectorAll("*")]) {
      const caixa = elemento.getBoundingClientRect();
      if (caixa.width === 0 && caixa.height === 0) {
        continue;
      }
      if (caixa.left < coluna.left - 0.5 || caixa.right > coluna.right + 0.5) {
        const texto = (elemento.textContent ?? "").trim().slice(0, 40);
        problemas.push(
          `<${elemento.tagName.toLowerCase()}> "${texto}" vai de ${caixa.left.toFixed(1)} a ${caixa.right.toFixed(1)}px; a coluna, de ${coluna.left.toFixed(1)} a ${coluna.right.toFixed(1)}px`,
        );
      }
    }
    return problemas;
  }, conteudo);
}

// O texto mais longo que o banco aceita (checks de `db/schema.ts`): título de evento e nome de turma até 120,
// nome de pessoa até 160. Com espaços (quebra entre palavras) e sem espaço nenhum (só quebra no meio — "W", o
// glifo mais largo).
function textoComEspacos(tamanho: number, semente: string): string {
  let texto = `[e2e] ${semente}`;
  while (texto.length < tamanho) {
    texto += " oficina de cerâmica de alta temperatura";
  }
  return `${texto.slice(0, tamanho - 1)}x`;
}

function textoSemEspaco(tamanho: number, semente: string): string {
  return `[e2e]${semente.replace(/[^A-Za-z0-9]/g, "")}`.padEnd(tamanho, "W");
}

test.describe("agenda vistas", () => {
  test("“›” e “‹” mudam a semana e o título; “Hoje” volta e o cabeçalho de hoje está visível", async ({ page }) => {
    const hoje = hojeNoAtelie();
    const segunda = segundaDaSemana(hoje);

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    const titulo = page.getByTestId("agenda-titulo");
    await expect(titulo).toHaveText(tituloDaSemana(segunda));
    // Abrir sem `?semana=` rola até hoje.
    await expect(page.getByTestId(`agenda-dia-${hoje}`)).toBeInViewport();

    await page.getByRole("link", { name: "Próxima semana" }).click();
    await expect(titulo).toHaveText(tituloDaSemana(somarDias(segunda, 7)));
    // Um toque por vez: cada "‹" leva à semana anterior à que está NA TELA.
    await page.getByRole("link", { name: "Semana anterior" }).click();
    await expect(titulo).toHaveText(tituloDaSemana(segunda));
    await page.getByRole("link", { name: "Semana anterior" }).click();
    await expect(titulo).toHaveText(tituloDaSemana(somarDias(segunda, -7)));

    await page.getByTestId("agenda-hoje").click();
    await expect(titulo).toHaveText(tituloDaSemana(segunda));
    await expect(page.getByTestId(`agenda-dia-${hoje}`)).toBeInViewport();
    await expect(page.getByTestId(`agenda-dia-${hoje}`)).toContainText("hoje");

    // O alternador é neutro, em `tablist`, e a semana é a marcada.
    const alternador = page.getByRole("tablist", { name: "Ver a agenda por" });
    await expect(alternador.getByRole("tab", { name: "Semana" })).toHaveAttribute("aria-selected", "true");
    await expect(alternador.getByRole("tab", { name: "Mês" })).toHaveAttribute("aria-selected", "false");
  });

  test("uma oficina daqui a 10 dias: o mês mostra o ponto e “1 oficina”; tocar no dia abre a semana dele", async ({
    page,
  }) => {
    const data = somarDiasAoHoje(10 + deslocamentoDoProjeto());
    const titulo = `[e2e] Oficina do mês ${sufixoUnico()}`;
    const eventoId = await semearOficina({
      titulo,
      data,
      inicio: "15:00",
      fim: "17:00",
      vagas: 6,
      precoCentavos: 8000,
    });

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await irParaOMesDe(page, data);
    await expect(page).toHaveURL(/vista=mes/);

    const celula = page.getByTestId(`mes-dia-${data}`);
    await expect(celula).toHaveAttribute("aria-label", /1 oficina/);
    await expect(page.getByTestId("agenda-mes-legenda")).toContainText("Aula ou oficina avulsa");
    await expect(page.getByTestId("agenda-mes-vazio")).toHaveCount(0);
    await expect(page.getByText("Toque num dia para abrir a semana dele.")).toBeVisible();
    // A célula de hoje diz "hoje" (quando hoje está na grade deste mês).
    const celulaDeHoje = page.getByTestId(`mes-dia-${hojeNoAtelie()}`);
    if ((await celulaDeHoje.count()) > 0) {
      await expect(celulaDeHoje).toHaveAttribute("aria-label", / · hoje$/);
    }

    await celula.click();
    await expect(page).not.toHaveURL(/vista=mes/);
    await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDaSemana(segundaDaSemana(data)));
    await expect(
      page.getByTestId(`agenda-dia-${data}`).locator(`[data-testid="agenda-cartao"][data-evento-id="${eventoId}"]`),
    ).toBeVisible();
  });

  test("um dia fechado: a célula do mês diz “dia fechado”", async ({ page }) => {
    const data = somarDiasAoHoje(12 + deslocamentoDoProjeto());
    await semearFechado({ data, motivo: `[e2e] fechado do mês ${sufixoUnico()}` });

    await fazerLogin(page);
    await page.goto("/gestao/agenda");
    await irParaOMesDe(page, data);
    await expect(page.getByTestId(`mes-dia-${data}`)).toHaveAttribute("aria-label", /: dia fechado/);
  });

  test("um mês sem nada: a grade sem pontos e “Nada marcado neste mês.”", async ({ page }) => {
    // Um mês distante, que nenhum caso usa.
    const mes = somarDiasAoHoje(3650).slice(0, 7);
    await fazerLogin(page);
    await page.goto(`/gestao/agenda?vista=mes&mes=${mes}`);
    await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDoMes(mes));
    await expect(page.getByTestId("agenda-mes-vazio")).toHaveText("Nada marcado neste mês.");
    await expect(page.getByTestId(`mes-dia-${mes}-15`)).toHaveAttribute("aria-label", /: nada marcado/);
  });

  test("a 320px a barra não cria rolagem lateral — na semana que cruza o ano e no mês", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await fazerLogin(page);

    await page.goto("/gestao/agenda?semana=2026-12-28");
    await expect(page.getByTestId("agenda-titulo")).toHaveText("28/12/2026 a 03/01/2027");
    await expect(page.getByTestId("agenda-proxima")).toBeInViewport();
    await expect.poll(() => estourosA320(page, "agenda-semana")).toEqual([]);

    await page.goto("/gestao/agenda?vista=mes&mes=2026-12");
    await expect(page.getByTestId("agenda-mes")).toBeVisible();
    await expect.poll(() => estourosA320(page, "agenda-mes")).toEqual([]);
  });

  test("a 320px, a semana e o mês com o texto mais longo que o sistema aceita não criam rolagem lateral", async ({
    page,
  }) => {
    // Uma semana distante, só deste caso e de cada projeto (14 dias entre o desktop e o celular) — nenhum outro
    // arquivo semeia tão longe; o "mês sem nada" fica em +3650 dias.
    const segunda = segundaDaSemana(somarDiasAoHoje(2600 + 14 * deslocamentoDoProjeto()));
    const dia = (n: number) => somarDias(segunda, n);
    const sufixo = sufixoUnico();

    // Segunda: o dia fechado (motivo de 120), a data de uma turma nele ("dia fechado"), e uma oficina de 120
    // caracteres com 999 vagas e duas inscrições cobradas ("2 / 999", "2 a receber").
    await semearFechado({ data: dia(0), motivo: textoComEspacos(120, `fechado ${sufixo}`) });
    const turma = await semearTurmaComDatas({
      nome: textoComEspacos(120, `turma ${sufixo}`),
      diaSemana: 1,
      inicio: "19:00",
      fim: "21:30",
      vagas: 999,
      mensalidadeCentavos: 32000,
      diaVencimento: 10,
      datas: [dia(0)],
      publica: true,
    });
    const oficinaId = await semearOficina({
      titulo: textoComEspacos(120, `oficina ${sufixo}`),
      data: dia(0),
      inicio: "09:00",
      fim: "12:00",
      vagas: 999,
      precoCentavos: 999_999,
    });
    for (const n of [1, 2]) {
      const clienteId = await semearCliente({ nome: textoComEspacos(160, `pessoa ${n} ${sufixo}`) });
      await semearInscricao({ eventoId: oficinaId, clienteId, tipo: "oficina", valorCentavos: 999_999 });
    }
    // Terça: uma oficina cancelada de título SEM espaço (120 caracteres).
    const canceladaId = await semearOficina({
      titulo: textoSemEspaco(120, `cancelada${sufixo}`),
      data: dia(1),
      inicio: "14:00",
      fim: "17:00",
      vagas: 999,
      precoCentavos: 5000,
    });
    await cancelarDataNoBanco(canceladaId);
    // Quarta: um uso livre reservado de nome com 160 caracteres e 50 pessoas (o teto).
    const reservadoDe = await semearCliente({ nome: textoComEspacos(160, `uso ${sufixo}`) });
    const reservadoId = await semearUsoLivre({ clienteId: reservadoDe, data: dia(2), chegadaPrevista: "10:00", pessoas: 50 });
    // Quinta: um uso livre encerrado de nome SEM espaço (160) cuja venda foi cancelada, com o número de venda mais
    // longo que o banco guarda (10 dígitos): "venda nº {N} cancelada", a tag que não quebrava.
    const encerradoDe = await semearCliente({ nome: textoSemEspaco(160, `uso${sufixo}`) });
    const encerrado = await semearUsoLivreEncerrado({
      clienteId: encerradoDe,
      data: dia(3),
      horas: 3,
      pessoas: 50,
      precoHoraCentavos: 5000,
    });
    const numeroDaVenda = 2_000_000_000 + Math.floor(Math.random() * 147_000_000);
    await ligarVendaACobranca({
      tipo: "uso_livre",
      id: encerrado.usoLivreId,
      valorCentavos: encerrado.valorCentavos,
      data: dia(3),
      paga: false,
      cancelada: true,
      numero: numeroDaVenda,
    });

    await page.setViewportSize({ width: 320, height: 720 });
    await fazerLogin(page);
    await page.goto(`/gestao/agenda?semana=${segunda}`);
    await expect(page.getByTestId("agenda-titulo")).toHaveText(tituloDaSemana(segunda));
    // O pior conteúdo está mesmo na tela — senão a régua passaria de graça.
    const cartaoDoEvento = (id: string) => page.locator(`[data-testid="agenda-cartao"][data-evento-id="${id}"]`);
    await expect(cartaoDoEvento(turma.eventoIds[0]).getByTestId("tag-dia-fechado")).toBeVisible();
    await expect(cartaoDoEvento(oficinaId).getByTestId("tag-a-receber")).toHaveText("2 a receber");
    await expect(cartaoDoEvento(oficinaId)).toContainText("2 / 999");
    await expect(cartaoDoEvento(canceladaId)).toContainText("cancelada");
    await expect(page.locator(`[data-testid="agenda-cartao"][data-uso-id="${reservadoId}"]`)).toContainText(
      "50 pessoas",
    );
    await expect(
      page.locator(`[data-testid="agenda-cartao"][data-uso-id="${encerrado.usoLivreId}"]`).getByTestId("tag-venda-cancelada"),
    ).toHaveText(`venda nº ${numeroDaVenda} cancelada`);
    await expect.poll(() => estourosA320(page, "agenda-semana")).toEqual([]);

    await page.goto(`/gestao/agenda?vista=mes&mes=${segunda.slice(0, 7)}`);
    await expect(page.getByTestId(`mes-dia-${dia(0)}`)).toHaveAttribute("aria-label", /dia fechado/);
    await expect.poll(() => estourosA320(page, "agenda-mes")).toEqual([]);
  });
});

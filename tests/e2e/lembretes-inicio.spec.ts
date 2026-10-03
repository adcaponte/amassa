import { test, expect, type Page } from "@playwright/test";

import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  destravarLembretesDeTeste,
  idDoUsuarioDoTeste,
  lerLembretePorTexto,
  limparLembretes,
  semearLembrete,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// Lembretes no Início — o traçador da Fase 06.3 (06.3-01-PLAN.md, Tarefa 1; LMB-01, LMB-03): do campo
// "+ lembrete" da coluna "Para fazer" à Server Action `criarLembrete`, à tabela `lembretes` e de volta
// à lista, sem recarregar a página. A folha da casa continua no mesmo bloco.
//
// Plano 06.3-03: a coluna "Para fazer" completa — ordem do briefing, rótulos de prazo no dia de
// Brasília, contagem, "e mais N" e a linha de criar com data e pessoa.
//
// Contagem é condição GLOBAL da tabela `lembretes`: todo caso deste `describe` roda sob a trava
// consultiva `travarLembretesParaTeste` (a MESMA de todo spec `lembretes-*` que escreve), em
// `mode: "serial"`, e o caso que conta começa por `limparLembretes()` — só dentro da trava. O
// estado vazio da semente fica FORA, num `@vazio-global` (cadeia `vazio-*` do
// `playwright.config.ts`, nunca `--grep`). Textos inventados, prefixo `[e2e]` (CLAUDE.md); "hoje" e
// os dias vizinhos de `hojeNoAtelie()`/`somarDiasAoHoje(n)`, nunca do dia UTC do relógio.

async function fazerLogin(page: Page) {
  await page.goto("/gestao/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL_TESTE ?? "");
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA_TESTE ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/gestao$/);
}

// "dd/mm" de um dia civil "AAAA-MM-DD" — sem `Date`, sem fuso.
function diaMes(dia: string): string {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

test.describe("lembretes inicio", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // O outro projeto (desktop/celular) pode estar segurando a trava pelo describe inteiro: a espera
    // passa do tempo padrão de um gancho. Tempo explícito, não retentativa.
    test.setTimeout(240_000);
    await travarLembretesParaTeste();
  });

  test.afterAll(async () => {
    await destravarLembretesDeTeste();
  });

  test("criar um lembrete pelo campo do Início com Enter faz a linha aparecer em Para fazer sem recarregar, e a linha está no banco com quem criou", async ({
    page,
  }) => {
    const texto = `[e2e] traçador ${test.info().project.name} ${Date.now()}`;
    // Desde o plano 03 a coluna mostra só 6: com 6 ou mais abertos deixados pelo outro projeto, um
    // sem data novo cairia no "e mais N". Começa do zero, dentro da trava.
    await limparLembretes();

    await fazerLogin(page);
    await page.goto("/gestao");

    const bloco = page.getByTestId("inicio-bloco-anotacoes");
    await expect(bloco.getByText("Anotações e lembretes", { exact: true })).toBeVisible();
    // A folha da casa continua lá, na coluna ao lado.
    await expect(bloco.getByTestId("anotacoes-caixa")).toBeVisible();

    const coluna = bloco.getByTestId("lembretes-coluna");
    await expect(coluna.getByRole("heading", { name: "Para fazer" })).toBeVisible();

    // Sem recarregar: um marcador na `window` sobrevive só se a página não for recarregada.
    await page.evaluate(() => {
      (window as unknown as { __semRecarregar?: boolean }).__semRecarregar = true;
    });

    const campo = coluna.getByTestId("lembretes-novo-texto");
    await campo.fill(texto);
    await campo.press("Enter");

    const linha = coluna
      .getByTestId("lembretes-lista")
      .getByTestId("lembrete-linha")
      .filter({ hasText: texto });
    await expect(linha).toHaveCount(1);
    await expect(linha).toBeVisible();
    await expect(campo).toHaveValue("");
    expect(
      await page.evaluate(
        () => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar,
      ),
    ).toBe(true);

    const idDoUsuario = await idDoUsuarioDoTeste();
    await expect
      .poll(async () => {
        const gravado = await lerLembretePorTexto(texto);
        return (
          gravado && {
            criado_por: gravado.criado_por,
            para_quando: gravado.para_quando,
            quem: gravado.quem,
            feito_em: gravado.feito_em,
            feito_por: gravado.feito_por,
          }
        );
      })
      .toEqual({
        criado_por: idDoUsuario,
        para_quando: null,
        quem: null,
        feito_em: null,
        feito_por: null,
      });

    // A linha da tela é a linha do banco.
    const gravado = await lerLembretePorTexto(texto);
    await expect(linha).toHaveAttribute("data-id", gravado?.id ?? "");
  });

  // O traçador do plano 03 (LMB-04, LMB-05): as regras puras do plano 02 ligadas ao Início, com
  // `hoje` vindo da PÁGINA.
  test("com 7 abertos (1 vencido ontem, 1 hoje, 1 amanhã, 1 futuro e 3 sem data), o Início mostra 6 na ordem do briefing com os rótulos, a contagem 7 abertos · 1 vencido e e mais 1 — ver todos", async ({
    page,
  }) => {
    const projeto = test.info().project.name;
    await limparLembretes();

    const ontem = somarDiasAoHoje(-1);
    // Semeados fora de ordem, de propósito: a ordem da tela não pode ser a da inserção.
    const semData3 = await semearLembrete({
      texto: `[e2e] sem data 3 ${projeto}`,
      criadoEm: "2026-01-01T12:02:00.000Z",
    });
    const futuro = await semearLembrete({
      texto: `[e2e] futuro ${projeto}`,
      paraQuando: somarDiasAoHoje(10),
    });
    const semData1 = await semearLembrete({
      texto: `[e2e] sem data 1 ${projeto}`,
      criadoEm: "2026-01-01T12:00:00.000Z",
    });
    const amanha = await semearLembrete({
      texto: `[e2e] amanhã ${projeto}`,
      paraQuando: somarDiasAoHoje(1),
    });
    const vencido = await semearLembrete({
      texto: `[e2e] vencido ${projeto}`,
      paraQuando: ontem,
    });
    const semData2 = await semearLembrete({
      texto: `[e2e] sem data 2 ${projeto}`,
      criadoEm: "2026-01-01T12:01:00.000Z",
    });
    const deHoje = await semearLembrete({
      texto: `[e2e] hoje ${projeto}`,
      paraQuando: hojeNoAtelie(),
    });

    await fazerLogin(page);
    await page.goto("/gestao");

    const bloco = page.getByTestId("inicio-bloco-anotacoes");
    const coluna = bloco.getByTestId("lembretes-coluna");
    const linhas = coluna.getByTestId("lembretes-lista").getByTestId("lembrete-linha");

    await expect(linhas).toHaveCount(6);
    const ids = await linhas.evaluateAll((elementos) =>
      elementos.map((e) => e.getAttribute("data-id")),
    );
    expect(ids).toEqual([vencido, deHoje, amanha, futuro, semData1, semData2]);
    expect(ids).not.toContain(semData3);

    await expect(linhas.nth(0)).toHaveAttribute("data-situacao", "vencido");
    await expect(linhas.nth(0).getByTestId("lembrete-prazo")).toHaveText(
      `venceu ${diaMes(ontem)} · ontem`,
    );
    await expect(linhas.nth(1)).toHaveAttribute("data-situacao", "hoje");
    await expect(linhas.nth(1).getByTestId("lembrete-prazo")).toHaveText("hoje");
    await expect(linhas.nth(2)).toHaveAttribute("data-situacao", "amanha");
    await expect(linhas.nth(2).getByTestId("lembrete-prazo")).toHaveText("amanhã");
    await expect(linhas.nth(3)).toHaveAttribute("data-situacao", "futuro");
    await expect(linhas.nth(3).getByTestId("lembrete-prazo")).toHaveText(
      diaMes(somarDiasAoHoje(10)),
    );
    await expect(linhas.nth(4)).toHaveAttribute("data-situacao", "sem-data");
    await expect(linhas.nth(4).getByTestId("lembrete-prazo")).toHaveCount(0);

    await expect(coluna.getByTestId("lembretes-contagem")).toHaveText(
      "7 abertos · 1 vencido",
    );
    const mais = coluna.getByTestId("lembretes-mais");
    await expect(mais).toHaveText("e mais 1 — ver todos");
    await expect(mais).toHaveAttribute("href", "/gestao/lembretes");
    await expect(coluna.getByTestId("lembretes-vazio")).toHaveCount(0);

    await expect(
      bloco.getByRole("link", { name: "ver todos os lembretes" }),
    ).toHaveAttribute("href", "/gestao/lembretes");
  });
});

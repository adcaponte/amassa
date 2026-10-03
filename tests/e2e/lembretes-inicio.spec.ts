import { test, expect, type Page } from "@playwright/test";

import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  contarLembretes,
  criarPessoaDeTeste,
  desativarPessoaDeTeste,
  destravarLembretesDeTeste,
  idDoUsuarioDoTeste,
  lerLembretePorTexto,
  limparLembretes,
  semearLembrete,
  travarLembretesParaTeste,
} from "./apoio/semear-lembretes";

// As frases da tela, verbatim da 06.3-UI-SPEC.md (§Erros, §Estados vazios) — escritas aqui, não
// importadas de `lib/`, para o teste reprovar se a copy mudar sem querer.
const FRASE_ESCREVA_ANTES_DE_GUARDAR = "Escreva o lembrete antes de guardar.";
const FRASE_PESSOA_INVALIDA =
  "Essa pessoa não está mais na lista. Escolha outra ou deixe “geral”.";
const FRASE_NADA_PARA_FAZER =
  "Nada para fazer. Escreva um lembrete na linha acima — com data ele fica vermelho quando vencer.";
// O primeiro nome da conta do e2e ("Gestora de Teste", `preparar-usuario.ts`).
const PRIMEIRO_NOME_DO_GESTOR_DE_TESTE = "Gestora";

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
// estado vazio da semente fica FORA, num teste de vazio global (cadeia `vazio-*` do
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

  // Caso (a) da Tarefa 2 (LMB-03): data e pessoa num toque cada; depois de guardar, tudo volta ao
  // padrão e a fileira de opções some (UI-D17).
  test("guardar com a data de hoje e a pessoa de teste grava para_quando e quem, mostra hoje e o chip, e volta ao padrão com a fileira escondida", async ({
    page,
  }) => {
    await limparLembretes();
    const texto = `[e2e] com data e pessoa ${test.info().project.name}`;
    const hoje = hojeNoAtelie();
    const idDoUsuario = await idDoUsuarioDoTeste();

    await fazerLogin(page);
    await page.goto("/gestao");
    const coluna = page.getByTestId("lembretes-coluna");
    const campo = coluna.getByTestId("lembretes-novo-texto");
    const data = coluna.getByTestId("lembretes-novo-data");
    const geral = coluna.locator('[data-testid="lembretes-pessoa"][data-pessoa="geral"]');
    const pessoa = coluna.locator(
      `[data-testid="lembretes-pessoa"][data-pessoa="${idDoUsuario}"]`,
    );

    // Fechada até o campo receber foco; o padrão é sem data e "geral".
    await expect(data).toBeHidden();
    await campo.click();
    await expect(data).toBeVisible();
    await expect(data).toHaveValue("");
    await expect(geral).toHaveAttribute("aria-pressed", "true");
    await expect(pessoa).toHaveAttribute("aria-pressed", "false");
    await expect(pessoa).toHaveText(PRIMEIRO_NOME_DO_GESTOR_DE_TESTE);

    await campo.fill(texto);
    await data.fill(hoje);
    await pessoa.click();
    await expect(pessoa).toHaveAttribute("aria-pressed", "true");
    await expect(geral).toHaveAttribute("aria-pressed", "false");
    // Limpar a data volta a "sem data" — e escolher de novo.
    await data.fill("");
    await expect(data).toHaveValue("");
    await data.fill(hoje);
    await coluna.getByTestId("lembretes-novo-guardar").click();

    const linha = coluna.getByTestId("lembrete-linha").filter({ hasText: texto });
    await expect(linha).toHaveCount(1);
    await expect(linha).toHaveAttribute("data-situacao", "hoje");
    await expect(linha.getByTestId("lembrete-prazo")).toHaveText("hoje");
    await expect(linha.getByTestId("lembrete-chip")).toHaveText(
      PRIMEIRO_NOME_DO_GESTOR_DE_TESTE,
    );

    await expect(campo).toHaveValue("");
    await expect(campo).toBeFocused();
    await expect(data).toBeHidden();
    await expect(data).toHaveValue("");
    await expect(geral).toHaveAttribute("aria-pressed", "true");
    await expect(coluna.getByTestId("lembretes-contagem")).toHaveText("1 aberto");

    await expect
      .poll(async () => {
        const gravado = await lerLembretePorTexto(texto);
        return gravado && { para_quando: gravado.para_quando, quem: gravado.quem };
      })
      .toEqual({ para_quando: hoje, quem: idDoUsuario });
  });

  // Caso (b) (UI-D9): o vazio não vai ao servidor e diz o que fazer.
  test("guardar com o campo vazio ou só com espaços mostra a frase, devolve o foco e não cria nada; digitar faz a frase sumir", async ({
    page,
  }) => {
    await limparLembretes();
    await fazerLogin(page);
    await page.goto("/gestao");
    const coluna = page.getByTestId("lembretes-coluna");
    const campo = coluna.getByTestId("lembretes-novo-texto");
    const erro = coluna.getByTestId("lembretes-novo-erro");

    await coluna.getByTestId("lembretes-novo-guardar").click();
    await expect(erro).toHaveText(FRASE_ESCREVA_ANTES_DE_GUARDAR);
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(campo).toBeFocused();

    await campo.fill("   ");
    await campo.press("Enter");
    await expect(erro).toHaveText(FRASE_ESCREVA_ANTES_DE_GUARDAR);
    await expect(campo).toBeFocused();
    expect(await contarLembretes()).toBe(0);
    await expect(coluna.getByTestId("lembretes-contagem")).toHaveText("nada pendente");

    await campo.press("a");
    await expect(erro).toHaveCount(0);
  });

  // Caso (c) (T-06.3-11): a pessoa foi desativada entre abrir a página e guardar. A recusa é do
  // servidor; nada do que foi escolhido se perde.
  test("com a pessoa escolhida desativada antes de guardar, a frase do servidor aparece e o texto, a data e a pílula ficam", async ({
    page,
  }) => {
    await limparLembretes();
    const projeto = test.info().project.name;
    const pessoaId = await criarPessoaDeTeste(`[e2e] Pessoa ${projeto}`);
    const texto = `[e2e] pessoa que saiu ${projeto}`;
    const depoisDeAmanha = somarDiasAoHoje(2);

    await fazerLogin(page);
    await page.goto("/gestao");
    const coluna = page.getByTestId("lembretes-coluna");
    const campo = coluna.getByTestId("lembretes-novo-texto");
    const data = coluna.getByTestId("lembretes-novo-data");
    const pilula = coluna.locator(
      `[data-testid="lembretes-pessoa"][data-pessoa="${pessoaId}"]`,
    );

    await campo.click();
    await campo.fill(texto);
    await data.fill(depoisDeAmanha);
    await pilula.click();
    await expect(pilula).toHaveAttribute("aria-pressed", "true");

    await desativarPessoaDeTeste(pessoaId);
    await coluna.getByTestId("lembretes-novo-guardar").click();

    await expect(coluna.getByTestId("lembretes-novo-erro")).toHaveText(
      FRASE_PESSOA_INVALIDA,
    );
    await expect(campo).toHaveValue(texto);
    await expect(data).toHaveValue(depoisDeAmanha);
    await expect(pilula).toHaveAttribute("aria-pressed", "true");
    expect(await contarLembretes()).toBe(0);
  });

  // Caso (d): o campo corta no teto do Zod (200).
  test("colar 210 caracteres no campo deixa 200", async ({ page }) => {
    await fazerLogin(page);
    await page.goto("/gestao");
    const coluna = page.getByTestId("lembretes-coluna");
    const campo = coluna.getByTestId("lembretes-novo-texto");

    // Colar só depois da hidratação. Na varredura completa do 06.3-06 (8 workers), colar logo depois
    // do `goto` deu 0 caracteres nos dois projetos: o texto entrou no HTML do servidor e o React,
    // ao hidratar o campo controlado (`value={texto}`, vazio), o apagou. A fileira de opções só
    // aparece pelo `onFocus` do React (UI-D17) — vê-la é a prova de que o campo já é do React.
    // Molde: o `toPass` do `fornecedores-campo` (f), 06.2-13. A asserção é a mesma.
    await expect(async () => {
      await campo.blur();
      await campo.focus();
      await expect(coluna.getByTestId("lembretes-novo-data")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });

    await page.keyboard.insertText("[e2e]".padEnd(210, "x"));
    expect((await campo.inputValue()).length).toBe(200);
  });

  // Caso (e): 320 px com um texto de 200 sem espaço e a fileira de opções aberta.
  test("a 320px, com um lembrete de 200 caracteres sem espaço e a fileira aberta, nada rola na horizontal e todo alvo da linha de criar mede 44px", async ({
    page,
  }) => {
    await limparLembretes();
    const longo = "[e2e]".padEnd(200, "x");
    await semearLembrete({ texto: longo });

    await page.setViewportSize({ width: 320, height: 900 });
    await fazerLogin(page);
    await page.goto("/gestao");
    const coluna = page.getByTestId("lembretes-coluna");
    await expect(
      coluna.getByTestId("lembrete-linha").filter({ hasText: longo }),
    ).toBeVisible();
    // Os outros blocos chegam por streaming: medir só com a página inteira na tela.
    await expect(page.getByTestId("inicio-bloco-esqueleto")).toHaveCount(0);

    const campo = coluna.getByTestId("lembretes-novo-texto");
    await campo.click();
    const data = coluna.getByTestId("lembretes-novo-data");
    await expect(data).toBeVisible();

    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(
      scrollWidth,
      `/gestao rola horizontalmente a 320px (${scrollWidth} > ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);

    const alvos = [
      campo,
      coluna.getByTestId("lembretes-novo-guardar"),
      // A pílula de data é o `<label>` em volta do campo de data.
      data.locator(".."),
    ];
    const pilulas = coluna.getByTestId("lembretes-pessoa");
    const quantas = await pilulas.count();
    expect(quantas).toBeGreaterThanOrEqual(2);
    for (let indice = 0; indice < quantas; indice += 1) {
      alvos.push(pilulas.nth(indice));
    }
    for (const alvo of alvos) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

// O estado vazio da semente (UI E3·empty): condição GLOBAL da tabela — nenhum lembrete existe. Fora
// da trava e com a tag de vazio global no título: entra na cadeia `vazio-*` do
// `playwright.config.ts`, que roda antes de `desktop`/`celular` (os únicos que escrevem em
// `lembretes`) — nunca por `--grep`.
test.describe("lembretes inicio — estado da semente", () => {
  test("com o banco recém-semeado, a coluna mostra a frase do vazio e nada pendente @vazio-global", async ({
    page,
  }) => {
    await fazerLogin(page);
    const coluna = page.getByTestId("lembretes-coluna");

    await expect(coluna.getByTestId("lembretes-vazio")).toHaveText(FRASE_NADA_PARA_FAZER);
    await expect(coluna.getByTestId("lembretes-contagem")).toHaveText("nada pendente");
    await expect(coluna.getByTestId("lembretes-mais")).toHaveCount(0);
    await expect(coluna.getByTestId("lembrete-linha")).toHaveCount(0);
  });
});

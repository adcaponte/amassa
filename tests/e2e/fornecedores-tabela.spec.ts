import { test, expect, type APIResponse, type Page } from "@playwright/test";

import { formatarDataCurta } from "@/lib/financeiro/formato";

import { pdfSintetico } from "./apoio/arquivos-sinteticos";
import { hojeNoAtelie, somarDiasAoHoje } from "./apoio/semear-financeiro";
import {
  anexoExisteNoBanco,
  anexosNoBanco,
  definirAtivoNoBanco,
  definirValeDesdeNoBanco,
  semearFornecedor,
} from "./apoio/semear-fornecedores";

// A tabela de preços vigente e o tirar anexo (06.2-08-PLAN.md, Tarefa 1 — o traçador; FRN-10, FRN-11;
// UI-D19, UI-D24, D-09): a ficha responde "a tabela dele está em dia?" com a linha "Última tabela de
// preços" e o selo de 120 dias; tirar um anexo pede a confirmação que diz o nome, o tipo, o tamanho e o
// que muda na linha de cima, e apaga a linha e o arquivo — o GET passa a 404.
//
// "Hoje" sempre de Brasília (`hojeNoAtelie`/`somarDiasAoHoje`), nunca o dia UTC; a idade da tabela é
// trocada só na DATA (`definirValeDesdeNoBanco`) — os arquivos sobem pela folha ou pelo PUT, sintéticos,
// nunca semeados em disco. Nenhum teste afirma condição global do banco: cada um semeia o seu fornecedor
// `[e2e]` com sufixo único e só olha os anexos dele. Entre guardar/tirar e conferir, a página NÃO é
// recarregada (a lista se atualiza sozinha), a não ser onde o teste diz.

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

function enderecoDaFicha(id: string): string {
  return `/gestao/cadastros?sub=fornecedores&fornecedor=${id}`;
}

// Abre a ficha de um fornecedor e espera ela desenhar (o h2 com o nome).
async function abrirFicha(page: Page, id: string, nome: string) {
  await page.goto(enderecoDaFicha(id));
  const ficha = page.getByTestId("fornecedor-ficha");
  await expect(ficha).toHaveAttribute("data-fornecedor-id", id);
  await expect(ficha.getByRole("heading", { level: 2, name: nome })).toBeVisible();
  return ficha;
}

// O mesmo PUT que a folha faz — para semear anexos pela ROTA, sem a tela.
async function enviarPelaRota(
  page: Page,
  meta: { fornecedorId: string; nome: string; tipo: string; extensao: string; valeDesde?: string },
  corpo: Buffer,
): Promise<APIResponse> {
  const query = new URLSearchParams({
    fornecedorId: meta.fornecedorId,
    nome: meta.nome,
    tipo: meta.tipo,
    extensao: meta.extensao,
    ...(meta.valeDesde !== undefined ? { valeDesde: meta.valeDesde } : {}),
  });
  return page.request.put(`/gestao/api/fornecedores/anexos?${query.toString()}`, {
    data: corpo,
    headers: { "content-type": "application/octet-stream" },
  });
}

// Sobe um PDF pela rota e devolve o id do anexo.
async function subirPdf(
  page: Page,
  meta: { fornecedorId: string; nome: string; tipo: string; valeDesde?: string },
  bytes = 4 * 1024,
): Promise<string> {
  const resposta = await enviarPelaRota(page, { ...meta, extensao: "pdf" }, pdfSintetico(bytes));
  expect(resposta.status()).toBe(200);
  return ((await resposta.json()) as { dados: { id: string } }).dados.id;
}

function linhaDoAnexo(page: Page, id: string) {
  return page.locator(`[data-testid="anexo-linha"][data-anexo-id="${id}"]`);
}

const FRASE_SEM_TABELA = "Sem tabela de preços ainda.";
const SELO_VELHA = "tem mais de 4 meses — pedir a nova?";
const FRASE_JA_TIRADO = "Esse anexo já tinha sido tirado. A ficha foi atualizada.";
const FRASE_FALHA_AO_TIRAR = "Não deu para tirar o anexo. Verifique a internet e tente de novo.";

test.describe("fornecedores tabela vigente", () => {
  test("(a) traçador: “Subir a primeira” → a tabela vigente com o selo “recente” e a linha marcada", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Tabela primeira ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nomeDoFornecedor);

    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(FRASE_SEM_TABELA);
    await tabela.getByRole("button", { name: "Subir a primeira" }).click();

    // A folha abre já com Tipo = Tabela de preços.
    const folha = page.getByTestId("folha-anexo");
    await expect(folha.getByRole("heading", { name: "Novo anexo" })).toBeVisible();
    await expect(folha.getByRole("combobox", { name: "Tipo" })).toContainText("Tabela de preços");

    const hoje = hojeNoAtelie();
    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: "tabela-outubro.pdf", mimeType: "application/pdf", buffer: pdfSintetico(8 * 1024) });
    await expect(folha.getByLabel("Nome do anexo")).toHaveValue("tabela-outubro");
    await expect(folha.getByRole("combobox", { name: "Tipo" })).toContainText("Tabela de preços");
    await expect(folha.getByLabel("Vale a partir de")).toHaveValue(hoje);
    await folha.getByRole("button", { name: "Guardar anexo" }).click();

    await expect(page.getByText(`Anexo guardado em ${nomeDoFornecedor}.`).first()).toBeVisible();
    await expect(folha).toBeHidden();

    // A linha de cima, sem recarregar: o nome, a data, "abrir" e o selo "recente".
    const [noBanco] = await anexosNoBanco(id);
    expect(noBanco).toMatchObject({ nome: "tabela-outubro", tipo: "tabela", valeDesde: hoje });
    await expect(tabela).toContainText(
      `Última tabela de preços: tabela-outubro · vale desde ${formatarDataCurta(hoje)} · `,
    );
    const abrir = tabela.getByRole("link", { name: "Abrir tabela-outubro" });
    await expect(abrir).toHaveText("abrir");
    await expect(abrir).toHaveAttribute("href", `/gestao/api/fornecedores/anexos/${noBanco.id}`);
    await expect(abrir).toHaveAttribute("target", "_blank");
    await expect(abrir).toHaveAttribute("rel", "noopener");
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText("recente");
    await expect(tabela.getByRole("button", { name: "Subir a primeira" })).toHaveCount(0);

    // A linha do anexo: borda dourada de 4 px E o selo de texto "vigente" (a cor nunca é a única pista).
    const linha = linhaDoAnexo(page, noBanco.id);
    await expect(linha.getByTestId("anexo-selo-vigente")).toHaveText("vigente");
    await expect(linha).toContainText(`Tabela de preços · vigente · vale desde ${formatarDataCurta(hoje)} · PDF · 8 KB · `);
    await expect(linha).toHaveCSS("border-left-width", "4px");
    await expect(linha).toHaveCSS("border-left-color", "rgb(202, 138, 4)");
    await expect(linha.getByRole("button", { name: "Tirar tabela-outubro" })).toHaveText("tirar");
  });

  test("(b) passados 121 dias o selo vira “tem mais de 4 meses”; com 120, “recente”", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Tabela velha ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const anexoId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Tabela de junho", tipo: "tabela", valeDesde: hojeNoAtelie() });

    const dia121 = somarDiasAoHoje(-121);
    await definirValeDesdeNoBanco(anexoId, dia121);
    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(`vale desde ${formatarDataCurta(dia121)}`);
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText(SELO_VELHA);

    const dia120 = somarDiasAoHoje(-120);
    await definirValeDesdeNoBanco(anexoId, dia120);
    await page.reload();
    await expect(tabela).toContainText(`vale desde ${formatarDataCurta(dia120)}`);
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText("recente");
  });

  test("(c) tabela sem “vale desde”: a linha diz a data de envio", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Tabela sem data ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    await subirPdf(page, { fornecedorId: id, nome: "[e2e] Tabela sem data", tipo: "tabela" });

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(
      `Última tabela de preços: [e2e] Tabela sem data · enviada em ${formatarDataCurta(hojeNoAtelie())} · `,
    );
    await expect(tabela).not.toContainText("vale desde");
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText("recente");
  });

  test("(d) tirar a vigente: a confirmação cita a anterior, a linha some, o GET dá 404 e a anterior passa a valer", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Duas tabelas ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const antigaId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Tabela antiga", tipo: "tabela", valeDesde: hojeNoAtelie() });
    const novaId = await subirPdf(
      page,
      { fornecedorId: id, nome: "[e2e] Tabela nova", tipo: "tabela", valeDesde: hojeNoAtelie() },
      6 * 1024,
    );
    await definirValeDesdeNoBanco(antigaId, somarDiasAoHoje(-200));
    await definirValeDesdeNoBanco(novaId, somarDiasAoHoje(-10));

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText("Última tabela de preços: [e2e] Tabela nova");
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText("recente");
    await expect(linhaDoAnexo(page, novaId).getByTestId("anexo-selo-vigente")).toBeVisible();
    await expect(linhaDoAnexo(page, antigaId).getByTestId("anexo-selo-vigente")).toHaveCount(0);

    const href = await linhaDoAnexo(page, novaId).getByRole("link", { name: "Abrir [e2e] Tabela nova" }).getAttribute("href");
    expect(href).toBe(`/gestao/api/fornecedores/anexos/${novaId}`);

    await linhaDoAnexo(page, novaId).getByRole("button", { name: "Tirar [e2e] Tabela nova" }).click();
    const confirmacao = page.getByTestId("confirmar-tirar-anexo");
    await expect(confirmacao.getByRole("heading", { name: "Tirar “[e2e] Tabela nova”?" })).toBeVisible();
    await expect(confirmacao.getByTestId("confirmar-tirar-anexo-corpo")).toHaveText(
      "O arquivo (PDF, 6 KB) sai da ficha e do servidor — não dá para desfazer. É a tabela de preços vigente: “[e2e] Tabela antiga” passa a valer.",
    );
    await expect(confirmacao.getByRole("button", { name: "Voltar" })).toBeFocused();

    await confirmacao.getByRole("button", { name: "Tirar anexo" }).click();
    await expect(page.getByText("Anexo removido.").first()).toBeVisible();
    await expect(confirmacao).toBeHidden();

    // Sem recarregar: a linha some, a contagem desce e a antiga vira a vigente, com o selo de 4 meses.
    await expect(linhaDoAnexo(page, novaId)).toHaveCount(0);
    await expect(ficha.getByTestId("fornecedor-anexos-contagem")).toHaveText("· 1");
    await expect(tabela).toContainText("Última tabela de preços: [e2e] Tabela antiga");
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText(SELO_VELHA);
    await expect(linhaDoAnexo(page, antigaId).getByTestId("anexo-selo-vigente")).toBeVisible();

    // A linha saiu do banco e o GET do link antigo dá 404 com a frase JSON.
    expect(await anexoExisteNoBanco(novaId)).toBe(false);
    const leitura = await page.request.get(href ?? "");
    expect(leitura.status()).toBe(404);
    expect(await leitura.json()).toEqual({ erro: "Esse anexo não existe." });
  });

  test("(e) tirar a única tabela: a confirmação avisa e a ficha fica sem tabela", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Tabela única ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const anexoId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Só esta", tipo: "tabela", valeDesde: hojeNoAtelie() });

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    await linhaDoAnexo(page, anexoId).getByRole("button", { name: "Tirar [e2e] Só esta" }).click();
    const confirmacao = page.getByTestId("confirmar-tirar-anexo");
    await expect(confirmacao.getByTestId("confirmar-tirar-anexo-corpo")).toHaveText(
      "O arquivo (PDF, 4 KB) sai da ficha e do servidor — não dá para desfazer. É a única tabela de preços deste fornecedor: a ficha fica sem tabela.",
    );
    await confirmacao.getByRole("button", { name: "Tirar anexo" }).click();
    await expect(page.getByText("Anexo removido.").first()).toBeVisible();

    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(FRASE_SEM_TABELA);
    await expect(tabela.getByRole("button", { name: "Subir a primeira" })).toBeVisible();
    await expect(ficha.getByTestId("fornecedor-sem-anexos")).toBeVisible();
    expect(await anexoExisteNoBanco(anexoId)).toBe(false);
  });

  test("(f) duas abas: tirar o que a outra já tirou dá a frase própria, sem erro 500", async ({ page, context }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Duas abas ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const anexoId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Catálogo duplo", tipo: "catalogo" });

    await abrirFicha(page, id, nomeDoFornecedor);
    const outra = await context.newPage();
    const errosDoServidor: number[] = [];
    outra.on("response", (resposta) => {
      if (resposta.status() >= 500) {
        errosDoServidor.push(resposta.status());
      }
    });
    await abrirFicha(outra, id, nomeDoFornecedor);

    // Na primeira aba, tira.
    await linhaDoAnexo(page, anexoId).getByRole("button", { name: "Tirar [e2e] Catálogo duplo" }).click();
    const confirmacao = page.getByTestId("confirmar-tirar-anexo");
    await expect(confirmacao.getByTestId("confirmar-tirar-anexo-corpo")).toHaveText(
      "O arquivo (PDF, 4 KB) sai da ficha e do servidor — não dá para desfazer.",
    );
    await confirmacao.getByRole("button", { name: "Tirar anexo" }).click();
    await expect(page.getByText("Anexo removido.").first()).toBeVisible();
    expect(await anexoExisteNoBanco(anexoId)).toBe(false);

    // Na segunda, desatualizada, tira o mesmo.
    await linhaDoAnexo(outra, anexoId).getByRole("button", { name: "Tirar [e2e] Catálogo duplo" }).click();
    const confirmacaoDaOutra = outra.getByTestId("confirmar-tirar-anexo");
    await confirmacaoDaOutra.getByRole("button", { name: "Tirar anexo" }).click();
    await expect(outra.getByText(FRASE_JA_TIRADO).first()).toBeVisible();
    await expect(confirmacaoDaOutra).toBeHidden();
    await expect(linhaDoAnexo(outra, anexoId)).toHaveCount(0);
    expect(errosDoServidor).toEqual([]);
    await outra.close();
  });

  test("(g) só um catálogo em PDF: catálogo nunca vira a tabela vigente", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Só catálogo ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const anexoId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Catálogo", tipo: "catalogo" });

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    await expect(ficha.getByTestId("fornecedor-tabela-vigente")).toContainText(FRASE_SEM_TABELA);
    await expect(ficha.getByTestId("fornecedor-selo-tabela")).toHaveCount(0);
    await expect(linhaDoAnexo(page, anexoId)).toBeVisible();
    await expect(ficha.getByTestId("anexo-selo-vigente")).toHaveCount(0);
    await expect(linhaDoAnexo(page, anexoId)).toHaveCSS("border-left-width", "1px");
  });

  test("(h) sem contato, sem observação e sem anexo: a grade some e as duas frases de vazio aparecem", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Ficha vazia ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    await expect(ficha.getByTestId("fornecedor-contatos")).toHaveCount(0);
    await expect(ficha.getByTestId("fornecedor-sem-observacao")).toHaveText("Nenhuma observação ainda.");
    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(FRASE_SEM_TABELA);
    await expect(tabela.getByRole("button", { name: "Subir a primeira" })).toBeVisible();
    await expect(ficha.getByTestId("fornecedor-anexos-contagem")).toHaveText("· 0");
  });

  test("(i) D-09: uma tabela com “vale desde” no futuro é a vigente e conta como recente", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Tabela futura ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const futuraId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Tabela do mês que vem", tipo: "tabela", valeDesde: hojeNoAtelie() });
    const atualId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Tabela de agora", tipo: "tabela", valeDesde: hojeNoAtelie() });
    const futuro = somarDiasAoHoje(30);
    await definirValeDesdeNoBanco(futuraId, futuro);
    await definirValeDesdeNoBanco(atualId, somarDiasAoHoje(-5));

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(
      `Última tabela de preços: [e2e] Tabela do mês que vem · vale desde ${formatarDataCurta(futuro)} · `,
    );
    await expect(tabela.getByTestId("fornecedor-selo-tabela")).toHaveText("recente");
    await expect(linhaDoAnexo(page, futuraId).getByTestId("anexo-selo-vigente")).toBeVisible();
    await expect(linhaDoAnexo(page, atualId).getByTestId("anexo-selo-vigente")).toHaveCount(0);
  });

  test("(j) sem rede, “Tirar anexo” mostra o erro dentro do diálogo, que continua aberto", async ({
    page,
    context,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Tirar sem rede ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const anexoId = await subirPdf(page, { fornecedorId: id, nome: "[e2e] Nota", tipo: "nota" });

    await abrirFicha(page, id, nomeDoFornecedor);
    await linhaDoAnexo(page, anexoId).getByRole("button", { name: "Tirar [e2e] Nota" }).click();
    const confirmacao = page.getByTestId("confirmar-tirar-anexo");
    await expect(confirmacao.getByRole("heading", { name: "Tirar “[e2e] Nota”?" })).toBeVisible();

    await context.setOffline(true);
    try {
      await confirmacao.getByRole("button", { name: "Tirar anexo" }).click();
      await expect(confirmacao.getByTestId("confirmar-tirar-anexo-erro")).toHaveText(FRASE_FALHA_AO_TIRAR);
      await expect(confirmacao).toBeVisible();
      await expect(confirmacao.getByRole("button", { name: "Voltar" })).toBeEnabled();
      await expect(confirmacao.getByRole("button", { name: "Tirar anexo" })).toBeEnabled();
    } finally {
      await context.setOffline(false);
    }

    await confirmacao.getByRole("button", { name: "Voltar" }).click();
    await expect(confirmacao).toBeHidden();
    await expect(linhaDoAnexo(page, anexoId)).toBeVisible();
    expect(await anexoExisteNoBanco(anexoId)).toBe(true);
  });

  test("(k) UI-D24: desativado sem tabela não oferece “Subir a primeira”; com anexo, abrir e tirar continuam", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const semTabela = `[e2e] Desativado sem tabela ${suf}`;
    const semTabelaId = await semearFornecedor({ nome: semTabela, ativo: false });
    const comTabela = `[e2e] Desativado com tabela ${suf}`;
    const comTabelaId = await semearFornecedor({ nome: comTabela });

    await fazerLogin(page);
    const anexoId = await subirPdf(page, { fornecedorId: comTabelaId, nome: "[e2e] Tabela guardada", tipo: "tabela", valeDesde: hojeNoAtelie() });
    await definirAtivoNoBanco(comTabelaId, false);

    let ficha = await abrirFicha(page, semTabelaId, semTabela);
    const tabela = ficha.getByTestId("fornecedor-tabela-vigente");
    await expect(tabela).toContainText(FRASE_SEM_TABELA);
    await expect(tabela.getByRole("button", { name: "Subir a primeira" })).toHaveCount(0);

    ficha = await abrirFicha(page, comTabelaId, comTabela);
    await expect(ficha.getByTestId("fornecedor-tabela-vigente").getByRole("link", { name: "Abrir [e2e] Tabela guardada" })).toBeVisible();
    await linhaDoAnexo(page, anexoId).getByRole("button", { name: "Tirar [e2e] Tabela guardada" }).click();
    await page.getByTestId("confirmar-tirar-anexo").getByRole("button", { name: "Tirar anexo" }).click();
    await expect(page.getByText("Anexo removido.").first()).toBeVisible();
    await expect(ficha.getByTestId("fornecedor-tabela-vigente")).toContainText(FRASE_SEM_TABELA);
    await expect(ficha.getByTestId("fornecedor-tabela-vigente").getByRole("button", { name: "Subir a primeira" })).toHaveCount(0);
    expect(await anexoExisteNoBanco(anexoId)).toBe(false);
  });
});

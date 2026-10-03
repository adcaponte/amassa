import { test, expect, type APIResponse, type Page } from "@playwright/test";

import { formatarDataCurta } from "@/lib/financeiro/formato";

import { htmlDisfarcado, pdfSintetico, xlsxSintetico } from "./apoio/arquivos-sinteticos";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import { anexosNoBanco, contarAnexos, semearFornecedor } from "./apoio/semear-fornecedores";

// Os anexos pela FICHA (06.2-06-PLAN.md, Tarefa 1 — o traçador; FRN-06, FRN-09; UI-D6, UI-D8, UI-D9,
// UI-D10, UI-D11, UI-D24): o gestor toca "Novo anexo", escolhe um PDF, a folha preenche o Nome, o Tipo
// e a data, "Guardar anexo" faz o PUT cru da rota do plano 05, e a linha do anexo aparece com "Abrir",
// que serve o MESMO arquivo, com os cabeçalhos certos.
//
// Os arquivos são SINTÉTICOS, gerados em memória (`apoio/arquivos-sinteticos.ts`) e entregues ao
// `<input type="file">` por `setInputFiles` com buffer — nenhum binário versionado, nenhum arquivo
// semeado em disco. Nenhum teste afirma condição global do banco: cada um semeia o seu fornecedor
// `[e2e]` com sufixo único e só olha os anexos dele.

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

// Abre a ficha de um fornecedor e espera ela desenhar (o h2 com o nome) — a seção de anexos vem junto.
async function abrirFicha(page: Page, id: string, nome: string) {
  await page.goto(enderecoDaFicha(id));
  const ficha = page.getByTestId("fornecedor-ficha");
  await expect(ficha).toHaveAttribute("data-fornecedor-id", id);
  await expect(ficha.getByRole("heading", { level: 2, name: nome })).toBeVisible();
  return ficha;
}

// O mesmo PUT que a folha faz (`fetch(url, { method: "PUT", body: arquivo })`) — para semear anexos
// pela ROTA, sem a tela.
async function enviarPelaRota(
  page: Page,
  meta: { fornecedorId: string; nome: string; tipo: string; extensao: string },
  corpo: Buffer,
): Promise<APIResponse> {
  const query = new URLSearchParams(meta);
  return page.request.put(`/gestao/api/fornecedores/anexos?${query.toString()}`, {
    data: corpo,
    headers: { "content-type": "application/octet-stream" },
  });
}

const FRASE_SEM_ANEXOS =
  "Nenhum arquivo deste fornecedor. É aqui que a tabela de preços e o catálogo param de se perder no WhatsApp.";
const FRASE_DESATIVADO_SEM_ENVIO = "Fornecedor desativado. Reative para subir anexos.";
const FRASE_TIPO_PELA_ASSINATURA =
  "Esse arquivo não entra: o conteúdo dele não é PDF, foto nem planilha, mesmo que o nome diga que é. Aceita PDF, foto (JPG, PNG, WebP, HEIC) e planilha (XLSX, XLS, CSV).";

test.describe("fornecedores anexos", () => {
  test("(a) traçador: sobe um PDF pela folha, vê a linha do anexo e o “Abrir” serve o mesmo arquivo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Anexos pela folha ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nomeDoFornecedor);

    // Vazio: a frase herdada, e "Novo anexo" no cabeçalho da seção.
    const secao = ficha.getByTestId("fornecedor-anexos");
    await expect(secao.getByTestId("fornecedor-sem-anexos")).toHaveText(FRASE_SEM_ANEXOS);
    await expect(secao.getByTestId("fornecedor-anexos-contagem")).toHaveText("· 0");
    await secao.getByRole("button", { name: "Novo anexo" }).click();

    const folha = page.getByTestId("folha-anexo");
    await expect(folha.getByRole("heading", { name: "Novo anexo" })).toBeVisible();
    // Sem arquivo, "Guardar anexo" começa desabilitado (UI E7·empty).
    const guardar = folha.getByRole("button", { name: "Guardar anexo" });
    await expect(guardar).toBeDisabled();

    const pdf = pdfSintetico(50 * 1024);
    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: "tabela-de-precos.pdf", mimeType: "application/pdf", buffer: pdf });

    // O preenchimento automático: o Nome vem do arquivo sem a extensão; PDF → Tabela de preços e
    // "Vale a partir de" = hoje no ateliê (nunca o dia UTC).
    const hoje = hojeNoAtelie();
    await expect(folha.getByTestId("anexo-escolhido")).toContainText("tabela-de-precos.pdf");
    await expect(folha.getByLabel("Nome do anexo")).toHaveValue("tabela-de-precos");
    await expect(folha.getByRole("combobox", { name: "Tipo" })).toContainText("Tabela de preços");
    await expect(folha.getByLabel("Vale a partir de")).toHaveValue(hoje);
    await expect(guardar).toBeEnabled();

    await guardar.click();

    await expect(page.getByText(`Anexo guardado em ${nomeDoFornecedor}.`).first()).toBeVisible();
    await expect(folha).toBeHidden();

    const linha = secao.getByTestId("anexo-linha");
    await expect(linha).toHaveCount(1);
    await expect(secao.getByTestId("fornecedor-anexos-contagem")).toHaveText("· 1");
    await expect(linha.getByTestId("anexo-tile")).toHaveText("PDF");
    await expect(linha).toContainText("tabela-de-precos");
    // A única tabela é a vigente: o selo "vigente" entra depois do tipo (plano 08, UI-D19).
    await expect(linha).toContainText(`Tabela de preços · vigente · vale desde ${formatarDataCurta(hoje)} · PDF · 50 KB · `);

    const [noBanco] = await anexosNoBanco(id);
    expect(noBanco).toMatchObject({ nome: "tabela-de-precos", tipo: "tabela", valeDesde: hoje, extensao: "pdf" });
    await expect(linha).toHaveAttribute("data-anexo-id", noBanco.id);

    // "Abrir": aba nova, `rel="noopener"`, para a rota sob /gestao/api/ — e o GET serve o mesmo arquivo.
    const abrir = linha.getByRole("link", { name: "Abrir tabela-de-precos" });
    await expect(abrir).toHaveAttribute("target", "_blank");
    await expect(abrir).toHaveAttribute("rel", "noopener");
    const href = await abrir.getAttribute("href");
    expect(href).toBe(`/gestao/api/fornecedores/anexos/${noBanco.id}`);

    const leitura = await page.request.get(href ?? "");
    expect(leitura.status()).toBe(200);
    const cabecalhos = leitura.headers();
    expect(cabecalhos["content-type"]).toBe("application/pdf");
    expect(cabecalhos["content-disposition"]).toMatch(/^inline; /);
    expect(cabecalhos["content-disposition"]).toContain(`filename*=UTF-8''${encodeURIComponent("tabela-de-precos.pdf")}`);
    expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(await leitura.body(), pdf)).toBe(0);
  });

  test("(b) um HTML com nome .pdf é recusado pela assinatura, e o arquivo continua escolhido", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Anexo disfarçado ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    await ficha.getByTestId("fornecedor-anexos").getByRole("button", { name: "Novo anexo" }).click();

    const folha = page.getByTestId("folha-anexo");
    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: htmlDisfarcado() });
    await folha.getByRole("button", { name: "Guardar anexo" }).click();

    const erro = folha.getByTestId("anexo-erro");
    await expect(erro).toHaveText(FRASE_TIPO_PELA_ASSINATURA);
    await expect(erro).toHaveAttribute("role", "alert");
    // A folha continua aberta, com o arquivo escolhido para trocar ou tentar de novo.
    await expect(folha.getByTestId("anexo-escolhido")).toContainText("falso.pdf");
    await expect(folha.getByText("Trocar arquivo")).toBeVisible();
    await expect(folha.getByRole("button", { name: "Guardar anexo" })).toBeEnabled();
    expect(await contarAnexos(id)).toBe(0);
  });

  test("(c) fornecedor desativado: a frase da UI-D24 fica no lugar de “Novo anexo”", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Anexos de desativado ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor, ativo: false });

    await fazerLogin(page);
    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const secao = ficha.getByTestId("fornecedor-anexos");
    await expect(secao.getByTestId("fornecedor-anexo-desativado")).toHaveText(FRASE_DESATIVADO_SEM_ENVIO);
    await expect(secao.getByRole("button", { name: "Novo anexo" })).toHaveCount(0);
    await expect(secao.getByTestId("fornecedor-sem-anexos")).toBeVisible();
  });

  test("(d) dois PDFs, um depois do outro: o mais recente é a primeira linha", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Ordem dos anexos ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const primeiro = await enviarPelaRota(
      page,
      { fornecedorId: id, nome: "[e2e] Tabela antiga", tipo: "tabela", extensao: "pdf" },
      pdfSintetico(4 * 1024),
    );
    expect(primeiro.status()).toBe(200);
    const segundo = await enviarPelaRota(
      page,
      { fornecedorId: id, nome: "[e2e] Tabela nova", tipo: "tabela", extensao: "pdf" },
      pdfSintetico(6 * 1024),
    );
    expect(segundo.status()).toBe(200);
    const idDoSegundo = ((await segundo.json()) as { dados: { id: string } }).dados.id;

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const linhas = ficha.getByTestId("anexo-linha");
    await expect(linhas).toHaveCount(2);
    await expect(linhas.first()).toHaveAttribute("data-anexo-id", idDoSegundo);
    await expect(linhas.first()).toContainText("[e2e] Tabela nova");
    await expect(linhas.nth(1)).toContainText("[e2e] Tabela antiga");
    // Sem "vale desde" (enviado sem a data): a meta não inventa uma.
    await expect(linhas.first()).not.toContainText("vale desde");
  });

  test("(e) planilha: tile “XLSX” e “Baixar”, sem aba nova", async ({ page }) => {
    const suf = sufixoUnico();
    const nomeDoFornecedor = `[e2e] Planilha do fornecedor ${suf}`;
    const id = await semearFornecedor({ nome: nomeDoFornecedor });

    await fazerLogin(page);
    const envio = await enviarPelaRota(
      page,
      { fornecedorId: id, nome: "[e2e] Catálogo em planilha", tipo: "catalogo", extensao: "xlsx" },
      xlsxSintetico(),
    );
    expect(envio.status()).toBe(200);

    const ficha = await abrirFicha(page, id, nomeDoFornecedor);
    const linha = ficha.getByTestId("anexo-linha");
    await expect(linha).toHaveCount(1);
    await expect(linha.getByTestId("anexo-tile")).toHaveText("XLSX");
    await expect(linha).toContainText("Catálogo · XLSX · ");
    const baixar = linha.getByRole("link", { name: "Baixar [e2e] Catálogo em planilha" });
    await expect(baixar).toBeVisible();
    await expect(baixar).not.toHaveAttribute("target", /.+/);
    await expect(linha.getByRole("link", { name: /^Abrir / })).toHaveCount(0);
  });
});

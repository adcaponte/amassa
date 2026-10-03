import { promises as fs } from "node:fs";
import path from "node:path";

import { test, expect, type APIResponse, type Page } from "@playwright/test";
import sharp from "sharp";

import {
  heicSintetico,
  jpegComEnchimento,
  pdfSintetico,
  pngTransparente,
  xlsxSintetico,
} from "./apoio/arquivos-sinteticos";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import { anexosNoBanco, contarAnexos, semearFornecedor } from "./apoio/semear-fornecedores";

// A foto e a planilha pela folha (06.2-07-PLAN.md, Tarefa 1 — o traçador; FRN-06, FRN-07; D-07, D-A03):
// a foto do catálogo entra reduzida e sem localização, com prévia; a planilha cai como tabela e baixa;
// o arquivo grande demais ou do tipo errado é recusado na folha, ANTES da rede — e o servidor repete a
// barreira.
//
// A única foto "real" é `tests/fixtures/orcamentos-foto-com-gps.jpg`, já versionada e SINTÉTICA (04.5:
// um JPEG 40×30 do `sharp` com um EXIF montado à mão, coordenada inventada). O resto é gerado em
// memória (`apoio/arquivos-sinteticos.ts`). Nenhum teste afirma condição global do banco: cada um semeia
// o seu fornecedor `[e2e]` com sufixo único e só olha os anexos dele.

const CAMINHO_FOTO_COM_GPS = path.join(process.cwd(), "tests/fixtures/orcamentos-foto-com-gps.jpg");
const MIB = 1048576;

const FRASE_HEIC_NAO_ABRE =
  "Essa foto está em HEIC e não deu para abrir aqui. No iPhone, envie pela galeria (ela converte para JPG) ou ative “Mais compatível” em Ajustes → Câmera → Formatos.";

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

// Semeia um fornecedor, entra, abre a ficha dele e a folha "Novo anexo".
async function abrirFolhaDeAnexo(page: Page, rotulo: string) {
  const nomeDoFornecedor = `[e2e] ${rotulo} ${sufixoUnico()}`;
  const id = await semearFornecedor({ nome: nomeDoFornecedor });
  await fazerLogin(page);
  await page.goto(`/gestao/cadastros?sub=fornecedores&fornecedor=${id}`);
  const ficha = page.getByTestId("fornecedor-ficha");
  await expect(ficha).toHaveAttribute("data-fornecedor-id", id);
  await expect(ficha.getByRole("heading", { level: 2, name: nomeDoFornecedor })).toBeVisible();
  const secao = ficha.getByTestId("fornecedor-anexos");
  await secao.getByRole("button", { name: "Novo anexo" }).click();
  const folha = page.getByTestId("folha-anexo");
  await expect(folha.getByRole("heading", { name: "Novo anexo" })).toBeVisible();
  return { id, nomeDoFornecedor, secao, folha };
}

// Conta os `PUT` da rota de anexos que a página faz — a prova de que a recusa no cliente não gastou rede.
function contarEnvios(page: Page): { total: () => number } {
  let total = 0;
  page.on("request", (requisicao) => {
    if (requisicao.method() === "PUT" && requisicao.url().includes("/api/fornecedores/anexos")) {
      total += 1;
    }
  });
  return { total: () => total };
}

// O mesmo PUT que a folha faz, sem a tela.
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

test.describe("fornecedores foto e planilha", () => {
  test("(a) traçador: a foto com GPS tem prévia, cai como “Outro” e é servida como JPEG sem EXIF", async ({
    page,
  }) => {
    const { id, nomeDoFornecedor, secao, folha } = await abrirFolhaDeAnexo(page, "Foto pela folha");
    const fotoComGps = await fs.readFile(CAMINHO_FOTO_COM_GPS);
    // A entrada TEM o EXIF — senão "sem EXIF" na saída seria vácuo.
    expect(fotoComGps.includes(Buffer.from("Exif"))).toBe(true);

    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: "vitrine.jpg", mimeType: "image/jpeg", buffer: fotoComGps });

    await expect(folha.getByRole("img", { name: "Prévia de vitrine.jpg" })).toBeVisible();
    await expect(folha.getByTestId("anexo-escolhido")).toContainText("vitrine.jpg");
    await expect(folha.getByLabel("Nome do anexo")).toHaveValue("vitrine");
    await expect(folha.getByRole("combobox", { name: "Tipo" })).toContainText("Outro");
    // A data só existe para tabela de preços (UI-D8).
    await expect(folha.getByLabel("Vale a partir de")).toHaveCount(0);

    await folha.getByRole("button", { name: "Guardar anexo" }).click();
    await expect(page.getByText(`Anexo guardado em ${nomeDoFornecedor}.`).first()).toBeVisible();
    await expect(folha).toBeHidden();

    const linha = secao.getByTestId("anexo-linha");
    await expect(linha).toHaveCount(1);
    await expect(linha.getByTestId("anexo-tile")).toHaveText("JPG");
    await expect(linha).toContainText("Outro · JPG · ");

    const [noBanco] = await anexosNoBanco(id);
    expect(noBanco).toMatchObject({ nome: "vitrine", tipo: "outro", extensao: "jpg", arquivoTipo: "image/jpeg" });
    expect(noBanco.arquivoCaminho).toMatch(/\.jpg$/);

    const abrir = linha.getByRole("link", { name: "Abrir vitrine" });
    await expect(abrir).toHaveAttribute("target", "_blank");
    const leitura = await page.request.get((await abrir.getAttribute("href")) ?? "");
    expect(leitura.status()).toBe(200);
    expect(leitura.headers()["content-type"]).toBe("image/jpeg");
    expect(leitura.headers()["content-disposition"]).toMatch(/^inline; /);
    const corpo = await leitura.body();
    expect([corpo[0], corpo[1]]).toEqual([0xff, 0xd8]);
    expect(corpo.includes(Buffer.from("Exif"))).toBe(false);
    expect(corpo.length).toBe(noBanco.arquivoBytes);
    expect((await sharp(corpo).metadata()).exif).toBeUndefined();
  });

  test("(b) um PNG transparente com nome .jpg entra como foto: 2000 × 667 e fundo branco", async ({ page }) => {
    const id = await semearFornecedor({ nome: `[e2e] Captura transparente ${sufixoUnico()}` });
    await fazerLogin(page);

    const envio = await enviarPelaRota(
      page,
      { fornecedorId: id, nome: "[e2e] captura", tipo: "outro", extensao: "jpg" },
      await pngTransparente(3000, 1000),
    );
    expect(envio.status()).toBe(200);
    const idDoAnexo = ((await envio.json()) as { dados: { id: string } }).dados.id;

    const leitura = await page.request.get(`/gestao/api/fornecedores/anexos/${idDoAnexo}`);
    expect(leitura.status()).toBe(200);
    expect(leitura.headers()["content-type"]).toBe("image/jpeg");
    const imagem = sharp(await leitura.body());
    const meta = await imagem.metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([2000, 667]);
    const { data } = await imagem.raw().toBuffer({ resolveWithObject: true });
    // JPEG é com perda: "branco" com folga de 2 em cada canal (sem `flatten`, seria [0, 0, 0]).
    expect(data[0]).toBeGreaterThanOrEqual(253);
    expect(data[1]).toBeGreaterThanOrEqual(253);
    expect(data[2]).toBeGreaterThanOrEqual(253);
  });

  test("(c) planilha pela folha: “Tabela de preços”, data vazia, a linha “XLSX” com “Baixar”", async ({ page }) => {
    const { id, secao, folha } = await abrirFolhaDeAnexo(page, "Planilha pela folha");

    await folha.getByLabel("Escolher arquivo").setInputFiles({
      name: "precos-outubro.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: xlsxSintetico(),
    });
    await expect(folha.getByLabel("Nome do anexo")).toHaveValue("precos-outubro");
    await expect(folha.getByRole("combobox", { name: "Tipo" })).toContainText("Tabela de preços");
    await expect(folha.getByLabel("Vale a partir de")).toHaveValue("");
    // Planilha não tem prévia.
    await expect(folha.getByTestId("anexo-previa")).toHaveCount(0);

    await folha.getByRole("button", { name: "Guardar anexo" }).click();
    await expect(folha).toBeHidden();

    const linha = secao.getByTestId("anexo-linha");
    await expect(linha).toHaveCount(1);
    await expect(linha.getByTestId("anexo-tile")).toHaveText("XLSX");
    await expect(linha.getByRole("link", { name: "Baixar precos-outubro" })).toBeVisible();
    const [noBanco] = await anexosNoBanco(id);
    expect(noBanco).toMatchObject({ tipo: "tabela", valeDesde: null, extensao: "xlsx" });
  });

  test("(d) recusas na folha, antes da rede: extensão, foto grande e PDF grande", async ({ page }) => {
    const { id, folha } = await abrirFolhaDeAnexo(page, "Recusas no cliente");
    const envios = contarEnvios(page);
    const escolher = folha.getByLabel(/^(Escolher|Trocar) arquivo$/);
    const guardar = folha.getByRole("button", { name: "Guardar anexo" });
    const recusa = folha.getByTestId("anexo-recusa");

    await escolher.setInputFiles({
      name: "x.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("[e2e] um docx de mentira"),
    });
    await expect(recusa).toHaveText(
      ".docx não entra. Aceita PDF, foto (JPG, PNG, WebP, HEIC) e planilha (XLSX, XLS, CSV).",
    );
    await expect(guardar).toBeDisabled();
    await expect(folha.getByText("Trocar arquivo")).toBeVisible();

    await escolher.setInputFiles({ name: "grande.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(11 * MIB, 0) });
    await expect(recusa).toHaveText("grande.jpg tem 11,0 MB. O limite é 10 MB para foto.");
    await expect(guardar).toBeDisabled();
    await expect(folha.getByTestId("anexo-previa")).toHaveCount(0);

    await escolher.setInputFiles({ name: "grande.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(21 * MIB, 0x20) });
    await expect(recusa).toHaveText("grande.pdf tem 21,0 MB. O limite é 20 MB para PDF e planilha.");
    await expect(guardar).toBeDisabled();

    // O formulário também não envia por Enter num campo.
    await folha.getByLabel("Nome do anexo").fill("[e2e] tentativa");
    await folha.getByLabel("Nome do anexo").press("Enter");
    await expect(recusa).toBeVisible();

    expect(envios.total()).toBe(0);
    expect(await contarAnexos(id)).toBe(0);
  });

  test("(e) servidor: uma foto acima de 10 MiB contornando a folha → 413 com a frase de foto", async ({ page }) => {
    const id = await semearFornecedor({ nome: `[e2e] Foto grande pela rota ${sufixoUnico()}` });
    await fazerLogin(page);

    const resposta = await enviarPelaRota(
      page,
      { fornecedorId: id, nome: "[e2e] foto grande", tipo: "outro", extensao: "jpg" },
      jpegComEnchimento(11 * MIB),
    );
    expect(resposta.status()).toBe(413);
    expect(await resposta.json()).toEqual({
      ok: false,
      erro: "[e2e] foto grande.jpg tem 11,0 MB. O limite é 10 MB para foto.",
    });
    expect(await contarAnexos(id)).toBe(0);
  });

  test("(f) HEIC que o servidor não abre: a frase do HEIC, nada gravado e sem prévia", async ({ page }) => {
    const { id, folha } = await abrirFolhaDeAnexo(page, "HEIC pela folha");

    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: "foto.heic", mimeType: "image/heic", buffer: heicSintetico() });
    await expect(folha.getByTestId("anexo-escolhido")).toContainText("foto.heic");
    // O Chrome não desenha HEIC: o `onError` esconde a prévia, sem mensagem.
    await expect(folha.getByTestId("anexo-previa")).toHaveCount(0);
    await expect(folha.getByTestId("anexo-recusa")).toHaveCount(0);

    await folha.getByRole("button", { name: "Guardar anexo" }).click();
    const erro = folha.getByTestId("anexo-erro");
    await expect(erro).toHaveText(FRASE_HEIC_NAO_ABRE);
    await expect(erro).toHaveAttribute("role", "alert");
    await expect(folha.getByTestId("anexo-escolhido")).toContainText("foto.heic");
    expect(await contarAnexos(id)).toBe(0);
  });

  test("(g) trocar o arquivo refaz o preenchimento só onde está vazio: o Nome digitado fica", async ({ page }) => {
    const { folha } = await abrirFolhaDeAnexo(page, "Trocar arquivo");
    const nome = folha.getByLabel("Nome do anexo");
    const tipo = folha.getByRole("combobox", { name: "Tipo" });

    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: "tabela-outubro.pdf", mimeType: "application/pdf", buffer: pdfSintetico(4096) });
    await expect(nome).toHaveValue("tabela-outubro");
    await expect(tipo).toContainText("Tabela de preços");
    await expect(folha.getByLabel("Vale a partir de")).toHaveValue(hojeNoAtelie());

    await nome.fill("");
    await nome.fill("[e2e] Vitrine da loja");

    await folha
      .getByLabel("Trocar arquivo")
      .setInputFiles({ name: "vitrine.jpg", mimeType: "image/jpeg", buffer: await fs.readFile(CAMINHO_FOTO_COM_GPS) });
    await expect(folha.getByTestId("anexo-escolhido")).toContainText("vitrine.jpg");
    await expect(nome).toHaveValue("[e2e] Vitrine da loja");
    await expect(tipo).toContainText("Outro");
    await expect(folha.getByRole("img", { name: "Prévia de vitrine.jpg" })).toBeVisible();
  });

  test("(h) um nome de arquivo de 200 caracteres vira um Nome do anexo de 120", async ({ page }) => {
    const { folha } = await abrirFolhaDeAnexo(page, "Nome enorme");
    const nomeDoArquivo = `${"tabela-de-precos-".repeat(11)}${"x".repeat(200 - 17 * 11 - 4)}.pdf`;
    expect(nomeDoArquivo).toHaveLength(200);

    await folha
      .getByLabel("Escolher arquivo")
      .setInputFiles({ name: nomeDoArquivo, mimeType: "application/pdf", buffer: pdfSintetico(4096) });
    await expect(folha.getByTestId("anexo-escolhido")).toContainText(nomeDoArquivo);
    await expect(folha.getByLabel("Nome do anexo")).toHaveValue(nomeDoArquivo.slice(0, 120));
  });
});

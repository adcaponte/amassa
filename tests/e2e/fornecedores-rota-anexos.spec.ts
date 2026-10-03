import { test, expect, type APIResponse, type Page } from "@playwright/test";

import { LIMITE_DOCUMENTO_BYTES } from "@/lib/fornecedores/arquivo";

import {
  csvSintetico,
  htmlDisfarcado,
  pdfSintetico,
  xlsxSintetico,
  zipQualquer,
} from "./apoio/arquivos-sinteticos";
import { hojeNoAtelie } from "./apoio/semear-financeiro";
import {
  anexosNoBanco,
  contarAnexos,
  idDoUsuarioDoTeste,
  semearAnexoSemArquivo,
  semearFornecedor,
} from "./apoio/semear-fornecedores";

// O caminho do byte dos anexos de fornecedor, pela ROTA (06.2-05-PLAN.md, Tarefa 1; FRN-06/07/08/09;
// D-01, D-08, D-A01, D-A04): o PUT com o arquivo CRU no corpo e os metadados na query, fora do
// middleware; o GET em stream, atrás da sessão. Tudo por requisições HTTP reais — a folha que faz este
// mesmo PUT é do plano 06.
//
// Os arquivos são SINTÉTICOS, gerados em memória (`apoio/arquivos-sinteticos.ts`) e enviados pela rota
// — nenhum arquivo é semeado em disco (no CI o app roda num contêiner). Nenhum teste afirma condição
// global do banco: cada um semeia o seu fornecedor `[e2e]` com sufixo único e só olha os anexos dele.

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

type MetadadosDoEnvio = {
  fornecedorId: string;
  nome: string;
  tipo: string;
  extensao: string;
  valeDesde?: string;
  nota?: string;
};

function enderecoDoEnvio(meta: MetadadosDoEnvio): string {
  const query = new URLSearchParams({
    fornecedorId: meta.fornecedorId,
    nome: meta.nome,
    tipo: meta.tipo,
    extensao: meta.extensao,
    ...(meta.valeDesde !== undefined ? { valeDesde: meta.valeDesde } : {}),
    ...(meta.nota !== undefined ? { nota: meta.nota } : {}),
  });
  return `/gestao/api/fornecedores/anexos?${query.toString()}`;
}

function enderecoDoAnexo(id: string): string {
  return `/gestao/api/fornecedores/anexos/${id}`;
}

// O mesmo PUT que a folha do plano 06 faz: `fetch(url, { method: "PUT", body: arquivo })`.
async function enviar(
  page: Page,
  meta: MetadadosDoEnvio,
  corpo: Buffer,
  cabecalhos: Record<string, string> = {},
): Promise<APIResponse> {
  return page.request.put(enderecoDoEnvio(meta), {
    data: corpo,
    headers: { "content-type": "application/octet-stream", ...cabecalhos },
  });
}

const FRASE_TIPO_PELA_ASSINATURA =
  "Esse arquivo não entra: o conteúdo dele não é PDF, foto nem planilha, mesmo que o nome diga que é. Aceita PDF, foto (JPG, PNG, WebP, HEIC) e planilha (XLSX, XLS, CSV).";
const FRASE_ARQUIVO_VAZIO = "Esse arquivo está vazio. Escolha outro.";
const FRASE_DESATIVADO =
  "Este fornecedor foi desativado enquanto você enviava. Reative-o para subir anexos — nada foi guardado.";
const FRASE_ARQUIVO_SUMIU = "Não deu para achar este arquivo no servidor. Avise quem cuida do backup.";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

test.describe("fornecedores rota de anexos", () => {
  test("(a) traçador: um PDF de 50 KB sobe pelo PUT cru e volta inteiro pelo GET, com os cabeçalhos certos", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Rota de anexos ${suf}` });
    await fazerLogin(page);

    const pdf = pdfSintetico(50 * 1024);
    const nome = `[e2e] Tabela de preços ${suf}`;
    const hoje = hojeNoAtelie();
    const resposta = await enviar(
      page,
      { fornecedorId, nome, tipo: "tabela", valeDesde: hoje, extensao: "pdf" },
      pdf,
      { "content-type": "application/pdf" },
    );
    expect(resposta.status()).toBe(200);
    const corpo = (await resposta.json()) as { ok: boolean; dados: { id: string } };
    expect(corpo.ok).toBe(true);
    expect(corpo.dados.id).toMatch(/^[0-9a-f-]{36}$/);

    const linhas = await anexosNoBanco(fornecedorId);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      id: corpo.dados.id,
      nome,
      tipo: "tabela",
      valeDesde: hoje,
      nota: null,
      arquivoTipo: "application/pdf",
      arquivoBytes: pdf.length,
      extensao: "pdf",
      criadoPor: await idDoUsuarioDoTeste(),
    });
    // O nome no disco é um uuid decidido pelo servidor — nunca o nome que a pessoa deu.
    expect(linhas[0].arquivoCaminho).toMatch(/^[0-9a-f-]{36}\.pdf$/);

    const leitura = await page.request.get(enderecoDoAnexo(corpo.dados.id));
    expect(leitura.status()).toBe(200);
    const cabecalhos = leitura.headers();
    expect(cabecalhos["content-type"]).toBe("application/pdf");
    expect(cabecalhos["content-disposition"]).toMatch(/^inline; /);
    expect(cabecalhos["content-disposition"]).toContain(
      `filename*=UTF-8''${encodeURIComponent(`${nome}.pdf`)}`,
    );
    expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
    expect(cabecalhos["cache-control"]).toContain("no-store");
    expect(Buffer.compare(await leitura.body(), pdf)).toBe(0);
  });

  test("(b) D-08: um PDF de ~12 MB chega inteiro — o PUT está fora do corte de 10 MB do middleware", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Anexo grande ${suf}` });
    await fazerLogin(page);

    const pdf = pdfSintetico(12 * 1024 * 1024);
    const resposta = await enviar(
      page,
      { fornecedorId, nome: `[e2e] Catálogo grande ${suf}`, tipo: "catalogo", extensao: "pdf" },
      pdf,
      { "content-type": "application/pdf" },
    );
    expect(resposta.status()).toBe(200);
    const { dados } = (await resposta.json()) as { dados: { id: string } };

    const [linha] = await anexosNoBanco(fornecedorId);
    expect(linha.arquivoBytes).toBe(pdf.length);

    const leitura = await page.request.get(enderecoDoAnexo(dados.id));
    expect(leitura.status()).toBe(200);
    expect(leitura.headers()["content-length"]).toBe(String(pdf.length));
    const recebido = await leitura.body();
    expect(recebido.length).toBe(pdf.length);
    expect(Buffer.compare(recebido, pdf)).toBe(0);
  });

  test("(c) sem sessão: GET de um anexo que existe e de um que não existe, e o PUT — 401 JSON nos três, nada gravado", async ({
    page,
    browser,
  }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Sem sessão ${suf}` });
    await fazerLogin(page);
    const envio = await enviar(
      page,
      { fornecedorId, nome: `[e2e] Nota ${suf}`, tipo: "nota", extensao: "pdf" },
      pdfSintetico(2048),
    );
    expect(envio.status()).toBe(200);
    const { dados } = (await envio.json()) as { dados: { id: string } };

    const contextoSemSessao = await browser.newContext();
    try {
      const base = page.url();
      for (const id of [dados.id, crypto.randomUUID()]) {
        const leitura = await contextoSemSessao.request.get(new URL(enderecoDoAnexo(id), base).toString(), {
          maxRedirects: 0,
        });
        expect(leitura.status()).toBe(401);
        expect(leitura.headers()["content-type"]).toContain("application/json");
        expect(((await leitura.json()) as { erro: string }).erro).toBeTruthy();
      }

      const putSemSessao = await contextoSemSessao.request.put(
        new URL(
          enderecoDoEnvio({ fornecedorId, nome: `[e2e] Intruso ${suf}`, tipo: "outro", extensao: "pdf" }),
          base,
        ).toString(),
        { data: pdfSintetico(2048), headers: { "content-type": "application/pdf" }, maxRedirects: 0 },
      );
      expect(putSemSessao.status()).toBe(401);
      expect(putSemSessao.headers()["content-type"]).toContain("application/json");
      const corpo = (await putSemSessao.json()) as { ok: boolean; erro: string };
      expect(corpo.ok).toBe(false);
      expect(corpo.erro).toBeTruthy();
    } finally {
      await contextoSemSessao.close();
    }
    expect(await contarAnexos(fornecedorId)).toBe(1);
  });

  test("(d) 20 MiB + 1 byte: 413 com a frase do limite, e nada gravado", async ({ page }) => {
    test.setTimeout(120_000);
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Grande demais ${suf}` });
    await fazerLogin(page);

    let resposta: APIResponse | null = null;
    try {
      resposta = await enviar(
        page,
        { fornecedorId, nome: `[e2e] Enorme ${suf}`, tipo: "catalogo", extensao: "pdf" },
        pdfSintetico(LIMITE_DOCUMENTO_BYTES + 1),
        { "content-type": "application/pdf" },
      );
    } catch (erro) {
      // Suposição A2 da pesquisa: se o servidor fechar a conexão antes de o cliente acabar de mandar,
      // o 413 pode não chegar. O que tem de valer de qualquer jeito é "nada gravado" (abaixo).
      // O `console.warn` aparece na saída do reporter `list` — a anotação sozinha não aparece.
      const descricao = `a conexão caiu em vez do 413: ${String(erro)}`;
      test.info().annotations.push({ type: "A2", description: descricao });
      console.warn(`[A2] ${descricao}`);
    }
    if (resposta) {
      expect(resposta.status()).toBe(413);
      const corpo = (await resposta.json()) as { ok: boolean; erro: string };
      expect(corpo.ok).toBe(false);
      expect(corpo.erro).toContain("O limite é 20 MB para PDF e planilha.");
    }
    expect(await contarAnexos(fornecedorId)).toBe(0);
  });

  test("(e) assinatura, não extensão: HTML com nome .pdf e zip com nome .xlsx → 415 com a frase, nada gravado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Disfarces ${suf}` });
    await fazerLogin(page);

    const casos: Array<{ corpo: Buffer; extensao: string }> = [
      { corpo: htmlDisfarcado(), extensao: "pdf" },
      { corpo: zipQualquer(), extensao: "xlsx" },
    ];
    for (const caso of casos) {
      const resposta = await enviar(
        page,
        { fornecedorId, nome: `[e2e] Disfarçado ${suf}`, tipo: "tabela", extensao: caso.extensao },
        caso.corpo,
      );
      expect(resposta.status()).toBe(415);
      expect(((await resposta.json()) as { erro: string }).erro).toBe(FRASE_TIPO_PELA_ASSINATURA);
    }
    expect(await contarAnexos(fornecedorId)).toBe(0);
  });

  test("(f) planilhas: XLSX e CSV entram e voltam como attachment, com nosniff e o tipo certo", async ({ page }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Planilhas ${suf}` });
    await fazerLogin(page);

    const casos: Array<{ corpo: Buffer; extensao: string; mime: string }> = [
      { corpo: xlsxSintetico(), extensao: "xlsx", mime: MIME_XLSX },
      { corpo: csvSintetico(), extensao: "csv", mime: "text/csv" },
    ];
    for (const caso of casos) {
      const resposta = await enviar(
        page,
        { fornecedorId, nome: `[e2e] Preços ${caso.extensao} ${suf}`, tipo: "tabela", extensao: caso.extensao },
        caso.corpo,
      );
      expect(resposta.status()).toBe(200);
      const { dados } = (await resposta.json()) as { dados: { id: string } };

      const leitura = await page.request.get(enderecoDoAnexo(dados.id));
      expect(leitura.status()).toBe(200);
      const cabecalhos = leitura.headers();
      expect(cabecalhos["content-type"]).toBe(caso.mime);
      expect(cabecalhos["content-disposition"]).toMatch(/^attachment; /);
      expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
      expect(Buffer.compare(await leitura.body(), caso.corpo)).toBe(0);
    }

    const linhas = await anexosNoBanco(fornecedorId);
    expect(linhas.map((linha) => [linha.extensao, linha.arquivoTipo])).toEqual([
      ["xlsx", MIME_XLSX],
      ["csv", "text/csv"],
    ]);
  });

  test("(g) CSRF: um PUT com Origin de outro endereço → 403, nada gravado", async ({ page }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Outra origem ${suf}` });
    await fazerLogin(page);

    const resposta = await enviar(
      page,
      { fornecedorId, nome: `[e2e] De fora ${suf}`, tipo: "outro", extensao: "pdf" },
      pdfSintetico(2048),
      { origin: "https://outro.example" },
    );
    expect(resposta.status()).toBe(403);
    expect(((await resposta.json()) as { ok: boolean }).ok).toBe(false);
    expect(await contarAnexos(fornecedorId)).toBe(0);
  });

  test("(h) dois envios ao mesmo tempo para o mesmo fornecedor gravam dois anexos independentes", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Concorrência ${suf}` });
    await fazerLogin(page);

    const [primeiro, segundo] = await Promise.all([
      enviar(page, { fornecedorId, nome: `[e2e] Um ${suf}`, tipo: "outro", extensao: "pdf" }, pdfSintetico(4096)),
      enviar(page, { fornecedorId, nome: `[e2e] Dois ${suf}`, tipo: "outro", extensao: "pdf" }, pdfSintetico(8192)),
    ]);
    expect(primeiro.status()).toBe(200);
    expect(segundo.status()).toBe(200);
    const idUm = ((await primeiro.json()) as { dados: { id: string } }).dados.id;
    const idDois = ((await segundo.json()) as { dados: { id: string } }).dados.id;
    expect(idUm).not.toBe(idDois);

    const linhas = await anexosNoBanco(fornecedorId);
    expect(linhas).toHaveLength(2);
    expect(new Set(linhas.map((linha) => linha.arquivoCaminho)).size).toBe(2);
    expect(linhas.map((linha) => linha.arquivoBytes).sort((a, b) => a - b)).toEqual([4096, 8192]);
  });

  test("(i) FRN-06 empty: corpo vazio, nome vazio e “vale desde” fora de tabela → 400 com a frase, nada gravado", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Vazios ${suf}` });
    await fazerLogin(page);

    const vazio = await enviar(
      page,
      { fornecedorId, nome: `[e2e] Vazio ${suf}`, tipo: "outro", extensao: "pdf" },
      Buffer.alloc(0),
    );
    expect(vazio.status()).toBe(400);
    expect(((await vazio.json()) as { erro: string }).erro).toBe(FRASE_ARQUIVO_VAZIO);

    const semNome = await enviar(
      page,
      { fornecedorId, nome: "   ", tipo: "outro", extensao: "pdf" },
      pdfSintetico(2048),
    );
    expect(semNome.status()).toBe(400);
    expect(((await semNome.json()) as { erro: string }).erro).toBe("Dê um nome ao anexo.");

    const dataForaDeTabela = await enviar(
      page,
      { fornecedorId, nome: `[e2e] Catálogo ${suf}`, tipo: "catalogo", valeDesde: hojeNoAtelie(), extensao: "pdf" },
      pdfSintetico(2048),
    );
    expect(dataForaDeTabela.status()).toBe(400);

    expect(await contarAnexos(fornecedorId)).toBe(0);
  });

  test("(j) fornecedor desativado → 409 com a frase, nada gravado", async ({ page }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Desativado ${suf}`, ativo: false });
    await fazerLogin(page);

    const resposta = await enviar(
      page,
      { fornecedorId, nome: `[e2e] Tarde demais ${suf}`, tipo: "outro", extensao: "pdf" },
      pdfSintetico(2048),
    );
    expect(resposta.status()).toBe(409);
    expect(((await resposta.json()) as { erro: string }).erro).toBe(FRASE_DESATIVADO);
    expect(await contarAnexos(fornecedorId)).toBe(0);
  });

  test("(k) nome com acento, aspas e barra: o content-disposition tem filename*=UTF-8'' e um filename ASCII limpo", async ({
    page,
  }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Nomes difíceis ${suf}` });
    await fazerLogin(page);

    const nome = `Tabela de preços "set"/2026 ${suf}`;
    const resposta = await enviar(
      page,
      { fornecedorId, nome, tipo: "tabela", extensao: "pdf" },
      pdfSintetico(2048),
    );
    expect(resposta.status()).toBe(200);
    const { dados } = (await resposta.json()) as { dados: { id: string } };

    const leitura = await page.request.get(enderecoDoAnexo(dados.id));
    expect(leitura.status()).toBe(200);
    const disposicao = leitura.headers()["content-disposition"];
    const partes = /^inline; filename="([^"]*)"; filename\*=UTF-8''(\S+)$/.exec(disposicao);
    expect(partes, disposicao).not.toBeNull();
    const [, ascii, codificado] = partes!;
    expect(ascii).not.toMatch(/["/\\;]/);
    expect(ascii).toBe(`Tabela de precos set-2026 ${suf}.pdf`);
    expect(decodeURIComponent(codificado)).toBe(`${nome}.pdf`);
  });

  test("(l) UI E4·error: anexo cujo arquivo sumiu do disco → GET 404 com a frase própria em JSON", async ({ page }) => {
    const suf = sufixoUnico();
    const fornecedorId = await semearFornecedor({ nome: `[e2e] Arquivo sumido ${suf}` });
    const anexoId = await semearAnexoSemArquivo(fornecedorId, `[e2e] Sumido ${suf}`);
    await fazerLogin(page);

    const leitura = await page.request.get(enderecoDoAnexo(anexoId));
    expect(leitura.status()).toBe(404);
    expect(leitura.headers()["content-type"]).toContain("application/json");
    expect(((await leitura.json()) as { erro: string }).erro).toBe(FRASE_ARQUIVO_SUMIU);
  });
});

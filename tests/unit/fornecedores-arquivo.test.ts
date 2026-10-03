import { fileTypeFromBuffer } from "file-type";
import { describe, expect, it } from "vitest";

import {
  classificarArquivo,
  familiaPelaExtensao,
  LIMITE_DOCUMENTO_BYTES,
  LIMITE_FOTO_BYTES,
  nomeDoAnexoPeloArquivo,
  pareceTexto,
  preenchimentoPeloArquivo,
  recusaNoCliente,
  textoDoTamanho,
} from "@/lib/fornecedores/arquivo";
import {
  FRASE_ARQUIVO_VAZIO,
  fraseTamanhoDeDocumento,
  fraseTamanhoDeFoto,
  fraseTipoPelaExtensao,
} from "@/lib/fornecedores/textos";

import {
  csvSintetico,
  htmlDisfarcado,
  pdfSintetico,
  xlsCfbSintetico,
  xlsxSintetico,
  zipQualquer,
} from "../e2e/apoio/arquivos-sinteticos";

// As regras do arquivo de um anexo de fornecedor (06.2-05-PLAN.md): a classificação pela assinatura
// (função pura sobre o que o `file-type` achou), o texto do tamanho e o nome sugerido pela folha.

const AMOSTRA_VAZIA = new Uint8Array();
const texto = (conteudo: string) => new TextEncoder().encode(conteudo);

describe("classificarArquivo — assinatura, não extensão (o que o file-type achou)", () => {
  it("pdf → documento, mesmo sem extensão no nome", () => {
    expect(
      classificarArquivo({
        detectado: { ext: "pdf", mime: "application/pdf" },
        extensaoDoNome: "",
        amostra: AMOSTRA_VAZIA,
      }),
    ).toEqual({ ok: true, tipo: { familia: "documento", extensao: "pdf", mime: "application/pdf" } });
  });

  it("cfb (OLE) com nome .xls → planilha xls application/vnd.ms-excel", () => {
    expect(
      classificarArquivo({
        detectado: { ext: "cfb", mime: "application/x-cfb" },
        extensaoDoNome: "xls",
        amostra: AMOSTRA_VAZIA,
      }),
    ).toEqual({
      ok: true,
      tipo: { familia: "planilha", extensao: "xls", mime: "application/vnd.ms-excel" },
    });
  });

  it("cfb (OLE) com nome .doc → recusa", () => {
    expect(
      classificarArquivo({
        detectado: { ext: "cfb", mime: "application/x-cfb" },
        extensaoDoNome: "doc",
        amostra: AMOSTRA_VAZIA,
      }),
    ).toEqual({ ok: false, motivo: "tipo" });
  });

  it("sem assinatura + .csv + texto → planilha csv", () => {
    expect(
      classificarArquivo({ detectado: undefined, extensaoDoNome: "csv", amostra: texto("material;preço\n") }),
    ).toEqual({ ok: true, tipo: { familia: "planilha", extensao: "csv", mime: "text/csv" } });
  });

  it("sem assinatura + .csv + amostra que começa com <html> → recusa", () => {
    expect(
      classificarArquivo({
        detectado: undefined,
        extensaoDoNome: "csv",
        amostra: texto("<html><script>alert(1)</script></html>"),
      }),
    ).toEqual({ ok: false, motivo: "tipo" });
  });

  it("zip → recusa", () => {
    expect(
      classificarArquivo({
        detectado: { ext: "zip", mime: "application/zip" },
        extensaoDoNome: "xlsx",
        amostra: AMOSTRA_VAZIA,
      }),
    ).toEqual({ ok: false, motivo: "tipo" });
  });
});

describe("textoDoTamanho — como o protótipo escreve", () => {
  it.each([
    [51200, "50 KB"],
    [12 * 1048576, "12,0 MB"],
    [10, "1 KB"],
  ] as const)("%i bytes → %s", (bytes, esperado) => {
    expect(textoDoTamanho(bytes)).toBe(esperado);
  });
});

describe("nomeDoAnexoPeloArquivo — o nome sem a última extensão, até 120", () => {
  it("tira só a última extensão", () => {
    expect(nomeDoAnexoPeloArquivo("Tabela de preços set.2026.pdf")).toBe("Tabela de preços set.2026");
  });

  it("nome de 200 caracteres sai com 120", () => {
    const longo = `${"a".repeat(200)}.pdf`;
    expect([...nomeDoAnexoPeloArquivo(longo)]).toHaveLength(120);
  });
});

describe("preenchimentoPeloArquivo — a folha ao escolher o arquivo (UI-SPEC)", () => {
  const base = { hoje: "2026-10-03", nomeAtual: "", valeDesdeAtual: "", tipoTocadoPelaPessoa: false };

  it("PDF → nome do arquivo, tabela e vale desde hoje", () => {
    expect(preenchimentoPeloArquivo({ ...base, nomeDoArquivo: "Tabela set-2026.pdf" })).toEqual({
      nome: "Tabela set-2026",
      tipo: "tabela",
      valeDesde: "2026-10-03",
    });
  });

  it("planilha → tabela, data como está; foto → outro", () => {
    expect(preenchimentoPeloArquivo({ ...base, nomeDoArquivo: "precos.xlsx" })).toEqual({
      nome: "precos",
      tipo: "tabela",
      valeDesde: "",
    });
    expect(preenchimentoPeloArquivo({ ...base, nomeDoArquivo: "vitrine.JPEG" }).tipo).toBe("outro");
  });

  it("nome já escrito e tipo trocado pela pessoa ficam como estão", () => {
    expect(
      preenchimentoPeloArquivo({
        ...base,
        nomeDoArquivo: "Tabela.pdf",
        nomeAtual: "Catálogo de verão",
        tipoTocadoPelaPessoa: true,
      }),
    ).toEqual({ nome: "Catálogo de verão", tipo: null, valeDesde: "" });
  });
});

// ——— Tarefa 2: a matriz "assinatura, não extensão", borda por borda, com o `file-type` DE VERDADE
// chamado aqui no teste (o módulo puro nunca o importa) sobre os MESMOS buffers sintéticos do e2e. ———

// O que a rota faz: o `file-type` olha o conteúdo, a amostra são os primeiros 8 KB.
async function classificarDeVerdade(conteudo: Buffer, extensaoDoNome: string) {
  const detectado = await fileTypeFromBuffer(conteudo);
  return classificarArquivo({ detectado, extensaoDoNome, amostra: conteudo.subarray(0, 8192) });
}

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8");

describe("documento: o PDF entra pela assinatura %PDF", () => {
  it("pdfSintetico → documento pdf, qualquer que seja a extensão do nome", async () => {
    for (const extensao of ["pdf", "", "txt"]) {
      expect(await classificarDeVerdade(pdfSintetico(4096), extensao)).toEqual({
        ok: true,
        tipo: { familia: "documento", extensao: "pdf", mime: "application/pdf" },
      });
    }
  });
});

describe("planilha XLSX: zip só entra se o [Content_Types].xml disser planilha", () => {
  it("xlsxSintetico → planilha xlsx", async () => {
    expect(await classificarDeVerdade(xlsxSintetico(), "xlsx")).toEqual({
      ok: true,
      tipo: {
        familia: "planilha",
        extensao: "xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  });

  it("zipQualquer com nome .xlsx → recusa (o file-type diz zip)", async () => {
    expect(await fileTypeFromBuffer(zipQualquer())).toEqual({ ext: "zip", mime: "application/zip" });
    expect(await classificarDeVerdade(zipQualquer(), "xlsx")).toEqual({ ok: false, motivo: "tipo" });
  });

  it("xlsm (planilha com macro) → recusa, mesmo sendo planilha", () => {
    expect(
      classificarArquivo({
        detectado: { ext: "xlsm", mime: "application/vnd.ms-excel.sheet.macroenabled.12" },
        extensaoDoNome: "xlsm",
        amostra: new Uint8Array(),
      }),
    ).toEqual({ ok: false, motivo: "tipo" });
  });
});

describe("planilha XLS: o OLE (cfb) só entra com nome .xls", () => {
  it("xlsCfbSintetico com .xls → planilha xls", async () => {
    expect(await classificarDeVerdade(xlsCfbSintetico(), "xls")).toEqual({
      ok: true,
      tipo: { familia: "planilha", extensao: "xls", mime: "application/vnd.ms-excel" },
    });
  });

  it("xlsCfbSintetico com .doc → recusa; com .XLS em caixa alta → planilha", async () => {
    expect(await classificarDeVerdade(xlsCfbSintetico(), "doc")).toEqual({ ok: false, motivo: "tipo" });
    expect((await classificarDeVerdade(xlsCfbSintetico(), "XLS")).ok).toBe(true);
  });
});

describe("planilha CSV (A-04): sem assinatura, só com nome .csv e conteúdo de texto", () => {
  it("csvSintetico com .csv → planilha csv text/csv", async () => {
    expect(await classificarDeVerdade(csvSintetico(), "csv")).toEqual({
      ok: true,
      tipo: { familia: "planilha", extensao: "csv", mime: "text/csv" },
    });
  });

  it("csvSintetico com .txt → recusa (texto sem assinatura só entra como .csv)", async () => {
    expect(await classificarDeVerdade(csvSintetico(), "txt")).toEqual({ ok: false, motivo: "tipo" });
  });

  it("CSV com BOM UTF-8 → planilha", async () => {
    const comBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), csvSintetico()]);
    expect((await classificarDeVerdade(comBom, "csv")).ok).toBe(true);
  });
});

describe("disfarces (Pitfall 7, T-06.2-18): HTML e SVG nunca entram", () => {
  it("htmlDisfarcado com nome .pdf → recusa", async () => {
    expect(await classificarDeVerdade(htmlDisfarcado(), "pdf")).toEqual({ ok: false, motivo: "tipo" });
  });

  it("htmlDisfarcado com nome .csv → recusa (começa com <)", async () => {
    expect(await classificarDeVerdade(htmlDisfarcado(), "csv")).toEqual({ ok: false, motivo: "tipo" });
  });

  it("<svg> com nome .svg, .csv e .jpg → recusa", async () => {
    for (const extensao of ["svg", "csv", "jpg"]) {
      expect(await classificarDeVerdade(SVG, extensao)).toEqual({ ok: false, motivo: "tipo" });
    }
  });

  it("HTML com espaços e BOM antes do < → recusa", async () => {
    const disfarce = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("  \n\t"), htmlDisfarcado()]);
    expect(await classificarDeVerdade(disfarce, "csv")).toEqual({ ok: false, motivo: "tipo" });
  });
});

describe("pareceTexto — o NUL separa binário de texto", () => {
  it("texto UTF-8 com acento → é texto", () => {
    expect(pareceTexto(csvSintetico())).toBe(true);
  });

  it("um byte nulo na amostra → não é texto (e o CSV é recusado)", async () => {
    const comNulo = Buffer.concat([csvSintetico(), Buffer.from([0x00]), csvSintetico()]);
    expect(pareceTexto(comNulo)).toBe(false);
    expect(await classificarDeVerdade(comNulo, "csv")).toEqual({ ok: false, motivo: "tipo" });
  });

  it("bytes de controle demais → não é texto; tab, CR e LF não contam", () => {
    const controles = Buffer.alloc(100, 0x41);
    controles.fill(0x01, 0, 2);
    expect(pareceTexto(controles)).toBe(false);
    expect(pareceTexto(Buffer.from("a\tb\r\nc\n"))).toBe(true);
  });

  it("amostra vazia → não é texto", () => {
    expect(pareceTexto(new Uint8Array())).toBe(false);
  });
});

describe("limites e família pela extensão", () => {
  it("20 MB e 10 MB na conta do protótipo (MiB)", () => {
    expect(LIMITE_DOCUMENTO_BYTES).toBe(20_971_520);
    expect(LIMITE_FOTO_BYTES).toBe(10_485_760);
  });

  it.each([
    ["JPEG", "foto"],
    ["pdf", "documento"],
    ["XLS", "planilha"],
    ["csv", "planilha"],
    ["heic", "foto"],
    ["xlsm", null],
    ["svg", null],
    ["zip", null],
    ["", null],
  ] as const)("familiaPelaExtensao(%s) → %s", (extensao, familia) => {
    expect(familiaPelaExtensao(extensao)).toBe(familia);
  });
});

// ——— Plano 06.2-07, Tarefa 1: a recusa ANTES da rede e o preenchimento da foto e da planilha. ———

describe("recusaNoCliente — a folha barra antes da rede, com as constantes do servidor", () => {
  it("foto de exatamente 10 MiB passa; 1 byte a mais → a frase de foto com o tamanho", () => {
    expect(recusaNoCliente({ nome: "foto.jpg", bytes: 10 * 1048576 })).toBeNull();
    expect(recusaNoCliente({ nome: "foto.jpg", bytes: 10 * 1048576 + 1 })).toBe(
      fraseTamanhoDeFoto("foto.jpg", "10,0 MB"),
    );
    expect(recusaNoCliente({ nome: "foto.jpg", bytes: 10 * 1048576 + 1 })).toBe(
      "foto.jpg tem 10,0 MB. O limite é 10 MB para foto.",
    );
  });

  it("PDF acima de 20 MiB → a frase de documento", () => {
    expect(recusaNoCliente({ nome: "t.pdf", bytes: 20 * 1048576 + 1 })).toBe(
      fraseTamanhoDeDocumento("t.pdf", "20,0 MB"),
    );
  });

  it("extensão fora da lista → “.docx não entra. …”", () => {
    expect(recusaNoCliente({ nome: "x.docx", bytes: 10 })).toBe(fraseTipoPelaExtensao("docx"));
    expect(recusaNoCliente({ nome: "x.docx", bytes: 10 })).toBe(
      ".docx não entra. Aceita PDF, foto (JPG, PNG, WebP, HEIC) e planilha (XLSX, XLS, CSV).",
    );
  });

  it("arquivo de 0 byte → a frase de vazio", () => {
    expect(recusaNoCliente({ nome: "x.pdf", bytes: 0 })).toBe(FRASE_ARQUIVO_VAZIO);
    expect(FRASE_ARQUIVO_VAZIO).toBe("Esse arquivo está vazio. Escolha outro.");
  });

  it("nome sem extensão não é recusado pelo tipo (o servidor decide pela assinatura); o teto é o de 20 MiB", () => {
    expect(recusaNoCliente({ nome: "LEIAME", bytes: 1024 })).toBeNull();
    expect(recusaNoCliente({ nome: "LEIAME", bytes: 15 * 1048576 })).toBeNull();
    expect(recusaNoCliente({ nome: "LEIAME", bytes: 20 * 1048576 + 1 })).toBe(
      fraseTamanhoDeDocumento("LEIAME", "20,0 MB"),
    );
  });
});

describe("preenchimentoPeloArquivo — foto e planilha (plano 07)", () => {
  const base = { hoje: "2026-10-03", valeDesdeAtual: "", tipoTocadoPelaPessoa: false };

  it("foto com o Nome já digitado: o Nome fica e o tipo vira outro", () => {
    expect(
      preenchimentoPeloArquivo({ ...base, nomeDoArquivo: "vitrine.heic", nomeAtual: "Catálogo de inverno" }),
    ).toEqual({ nome: "Catálogo de inverno", tipo: "outro", valeDesde: "" });
  });

  it("foto com o tipo trocado pela pessoa: o tipo não muda", () => {
    expect(
      preenchimentoPeloArquivo({
        ...base,
        nomeDoArquivo: "vitrine.png",
        nomeAtual: "",
        tipoTocadoPelaPessoa: true,
      }).tipo,
    ).toBeNull();
  });

  it("planilha: tabela e a data vazia (não é hoje, como o PDF)", () => {
    expect(preenchimentoPeloArquivo({ ...base, nomeDoArquivo: "precos.csv", nomeAtual: "" })).toEqual({
      nome: "precos",
      tipo: "tabela",
      valeDesde: "",
    });
  });
});

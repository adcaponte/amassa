import { describe, expect, it } from "vitest";

import {
  classificarArquivo,
  nomeDoAnexoPeloArquivo,
  preenchimentoPeloArquivo,
  textoDoTamanho,
} from "@/lib/fornecedores/arquivo";

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

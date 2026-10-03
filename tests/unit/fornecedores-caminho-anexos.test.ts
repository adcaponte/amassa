import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  NOME_DE_ANEXO_VALIDO,
  caminhoDoAnexo,
  caminhoTemporario,
  diretorioDeAnexos,
  nomeDeArquivoNovo,
  type ExtensaoNoDisco,
} from "../../lib/fornecedores/caminho-anexos";

// A porta única por onde um anexo de fornecedor vira caminho no disco (06.2-06-PLAN.md, Tarefa 2;
// T-06.2-17, travessia de caminho; D-A02, a pasta). Molde: `orcamentos-caminho-fotos.test.ts`. Cada
// aresta numa `describe` com o nome da regra.

const UUID = "0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10";
const NOME_VALIDO = `${UUID}.pdf`;
const EXTENSOES: readonly ExtensaoNoDisco[] = ["pdf", "jpg", "xlsx", "xls", "csv"];

describe("caminho-anexos", () => {
  const original = process.env.CAMINHO_ANEXOS_FORNECEDORES;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.CAMINHO_ANEXOS_FORNECEDORES;
    } else {
      process.env.CAMINHO_ANEXOS_FORNECEDORES = original;
    }
  });

  describe("D-A02: o diretório vem do ambiente; sem ele, uma pasta ignorada pelo git dentro do projeto", () => {
    it("sem CAMINHO_ANEXOS_FORNECEDORES, cai em .dados/anexos-fornecedores no diretório do processo", () => {
      delete process.env.CAMINHO_ANEXOS_FORNECEDORES;
      expect(diretorioDeAnexos()).toBe(path.join(process.cwd(), ".dados/anexos-fornecedores"));
    });

    it("com CAMINHO_ANEXOS_FORNECEDORES definida (a imagem e o compose), o diretório é exatamente ela", () => {
      process.env.CAMINHO_ANEXOS_FORNECEDORES = "/dados/anexos-fornecedores";
      expect(diretorioDeAnexos()).toBe("/dados/anexos-fornecedores");
    });

    it("variável vazia conta como ausente (nunca a raiz do disco)", () => {
      process.env.CAMINHO_ANEXOS_FORNECEDORES = "";
      expect(diretorioDeAnexos()).toBe(path.join(process.cwd(), ".dados/anexos-fornecedores"));
    });

    it("nunca dentro de public/ — nenhum anexo tem URL pública", () => {
      delete process.env.CAMINHO_ANEXOS_FORNECEDORES;
      expect(diretorioDeAnexos().split(path.sep)).not.toContain("public");
    });
  });

  describe("caminhoDoAnexo aceita só <uuid>.<ext> e junta com o diretório", () => {
    it.each(EXTENSOES)("um uuid seguido de .%s fica dentro do diretório de anexos", (extensao) => {
      process.env.CAMINHO_ANEXOS_FORNECEDORES = "/dados/anexos-fornecedores";
      const nome = `${UUID}.${extensao}`;
      const caminho = caminhoDoAnexo(nome);
      expect(caminho).toBe(path.join("/dados/anexos-fornecedores", nome));
      expect(path.dirname(caminho)).toBe(path.normalize("/dados/anexos-fornecedores"));
    });

    it("sem a variável, o caminho fica dentro da pasta local", () => {
      delete process.env.CAMINHO_ANEXOS_FORNECEDORES;
      expect(caminhoDoAnexo(NOME_VALIDO)).toBe(path.join(process.cwd(), ".dados/anexos-fornecedores", NOME_VALIDO));
    });
  });

  describe("T-06.2-17: travessia de caminho lança antes de qualquer I/O", () => {
    const recusados: Array<[string, string]> = [
      ["../x.pdf", "subir de pasta"],
      [`../${NOME_VALIDO}`, "subir de pasta com um nome válido no fim"],
      [`a/${NOME_VALIDO}`, "barra antes do nome"],
      [`${UUID}/x.pdf`, "barra no meio"],
      [`a\\${NOME_VALIDO}`, "barra invertida"],
      [`/etc/${NOME_VALIDO}`, "caminho absoluto"],
      [`${NOME_VALIDO}\u0000`, "byte nulo no fim"],
      [`${UUID}\u0000.pdf`, "byte nulo no meio"],
      [`${NOME_VALIDO}\n`, "quebra de linha no fim"],
      [`${UUID}.PDF`, "extensão em maiúscula"],
      [`${UUID.toUpperCase()}.pdf`, "uuid em maiúscula"],
      [`${UUID}.exe`, "extensão estranha"],
      [`${UUID}.jpeg`, "extensão que o servidor nunca grava (jpeg)"],
      [`${UUID}.pdf.exe`, "extensão dupla"],
      [`${UUID}.exe.pdf`, "extensão dupla com .pdf no fim"],
      [".pdf", "sem identificador"],
      [UUID, "sem extensão"],
      ["", "vazio"],
      [`.envio-${UUID}`, "o temporário de um envio em curso"],
    ];

    it.each(recusados)("%j (%s) lança", (nome) => {
      expect(NOME_DE_ANEXO_VALIDO.test(nome)).toBe(false);
      expect(() => caminhoDoAnexo(nome)).toThrow(/inválido/);
    });
  });

  describe("nomeDeArquivoNovo sorteia um uuid do servidor + a extensão decidida", () => {
    it.each(EXTENSOES)("para .%s, o nome casa com NOME_DE_ANEXO_VALIDO", (extensao) => {
      const nome = nomeDeArquivoNovo(extensao);
      expect(NOME_DE_ANEXO_VALIDO.test(nome)).toBe(true);
      expect(nome.endsWith(`.${extensao}`)).toBe(true);
    });

    it("dois nomes nunca coincidem", () => {
      expect(nomeDeArquivoNovo("pdf")).not.toBe(nomeDeArquivoNovo("pdf"));
    });

    it("uma extensão fora da lista lança (nunca grava um nome que a leitura recusaria)", () => {
      expect(() => nomeDeArquivoNovo("exe" as ExtensaoNoDisco)).toThrow(/inválida/);
    });
  });

  describe("caminhoTemporario nunca é servível: mora na pasta dos anexos e não casa o nome válido", () => {
    it("fica dentro do diretório de anexos (o rename para o final não cruza sistema de arquivos)", () => {
      process.env.CAMINHO_ANEXOS_FORNECEDORES = "/dados/anexos-fornecedores";
      expect(path.dirname(caminhoTemporario())).toBe(path.normalize("/dados/anexos-fornecedores"));
    });

    it("o nome do temporário nunca casa NOME_DE_ANEXO_VALIDO, e caminhoDoAnexo o recusa", () => {
      for (let i = 0; i < 20; i += 1) {
        const nome = path.basename(caminhoTemporario());
        expect(nome.startsWith(".envio-")).toBe(true);
        expect(NOME_DE_ANEXO_VALIDO.test(nome)).toBe(false);
        expect(() => caminhoDoAnexo(nome)).toThrow();
      }
    });
  });
});

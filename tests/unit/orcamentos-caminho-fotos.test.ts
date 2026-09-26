import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import {
  NOME_DE_ARQUIVO_VALIDO,
  caminhoDaFoto,
  diretorioDeFotos,
} from "../../lib/orcamentos/caminho-fotos";

const NOME_VALIDO = "0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10.jpg";

describe("caminho-fotos", () => {
  afterEach(() => {
    delete process.env.CAMINHO_FOTOS;
  });

  describe("diretorioDeFotos", () => {
    it("sem CAMINHO_FOTOS, cai num diretório local dentro do projeto", () => {
      delete process.env.CAMINHO_FOTOS;
      expect(diretorioDeFotos()).toBe(path.join(process.cwd(), ".dados/fotos-orcamentos"));
    });

    it("com CAMINHO_FOTOS definida, o diretório é exatamente ela", () => {
      process.env.CAMINHO_FOTOS = "/dados/fotos-orcamentos";
      expect(diretorioDeFotos()).toBe("/dados/fotos-orcamentos");
    });
  });

  describe("NOME_DE_ARQUIVO_VALIDO", () => {
    it("aceita um identificador seguido de .jpg", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test(NOME_VALIDO)).toBe(true);
    });

    it("recusa travessia de diretório (../.env)", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test("../.env")).toBe(false);
    });

    it("recusa nome com barra (a/b.jpg)", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test("a/b.jpg")).toBe(false);
    });

    it("recusa nome sem identificador (.jpg)", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test(".jpg")).toBe(false);
    });

    it("recusa nome com barra invertida", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test("0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10\\.jpg")).toBe(
        false,
      );
    });

    it("recusa nome com byte nulo", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test("0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10.jpg\u0000")).toBe(
        false,
      );
    });

    it("recusa o mesmo identificador com extensão diferente", () => {
      expect(NOME_DE_ARQUIVO_VALIDO.test("0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10.png")).toBe(false);
    });
  });

  describe("caminhoDaFoto", () => {
    it("junta o nome válido com o diretório de fotos", () => {
      process.env.CAMINHO_FOTOS = "/dados/fotos-orcamentos";
      expect(caminhoDaFoto(NOME_VALIDO)).toBe(path.join("/dados/fotos-orcamentos", NOME_VALIDO));
    });

    it("recusa (lança) travessia de diretório", () => {
      expect(() => caminhoDaFoto("../.env")).toThrow(/inválido/);
    });

    it("recusa (lança) nome com barra", () => {
      expect(() => caminhoDaFoto("a/b.jpg")).toThrow();
    });

    it("recusa (lança) nome vazio de identificador", () => {
      expect(() => caminhoDaFoto(".jpg")).toThrow();
    });

    it("recusa (lança) nome com barra invertida", () => {
      expect(() => caminhoDaFoto("0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10\\.jpg")).toThrow();
    });

    it("recusa (lança) nome com byte nulo", () => {
      expect(() => caminhoDaFoto("0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10.jpg\u0000")).toThrow();
    });

    it("recusa (lança) o mesmo identificador com extensão diferente", () => {
      expect(() => caminhoDaFoto("0b9cbf59-13e4-4b1f-9c2a-8f7c9d6e5a10.png")).toThrow();
    });
  });
});

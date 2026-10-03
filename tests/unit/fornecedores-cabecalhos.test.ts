import { describe, expect, it } from "vitest";

import { disposicao, ehAbertoNaAba, mesmaOrigem } from "../../lib/fornecedores/cabecalhos";

// Os cabeçalhos que vão para o navegador quando um anexo sai (06.2-06-PLAN.md, Tarefa 2; T-06.2-22,
// injeção de cabeçalho; Pitfall 6, nome fora do ASCII; Pitfall 8, CSRF no PUT). Cada aresta numa
// `describe` com o nome da regra.

// O valor de `filename="…"` e o de `filename*=UTF-8''…` de um `Content-Disposition`.
function partes(valor: string): { ascii: string; utf8: string } {
  const ascii = /; filename="([^"]*)";/.exec(valor)?.[1];
  const utf8 = /; filename\*=UTF-8''(.*)$/.exec(valor)?.[1];
  if (ascii === undefined || utf8 === undefined) {
    throw new Error(`Content-Disposition fora do formato: ${JSON.stringify(valor)}`);
  }
  return { ascii, utf8 };
}

// ASCII imprimível sem aspas, barras, barra invertida nem ponto e vírgula.
const ASCII_SEGURO = /^[\x20-\x7e]+$/;
const PROIBIDOS_NO_ASCII = /["/\\;]/;
// O `attr-char` da RFC 5987 (o que sobra do `encodeURIComponent` depois de trocar `'()*`) + `%`.
const RFC_5987 = /^[A-Za-z0-9!#$&+\-.^_`|~%]+$/;

const NOME_PERIGOSO = 'Tabela de preços "set"/2026\r\nX';

describe("cabecalhos dos anexos", () => {
  describe("T-06.2-22: disposicao nunca deixa CR, LF nem outro controle chegar ao cabeçalho", () => {
    it("o nome com aspas, barra e CRLF sai numa linha só, começando por inline;", () => {
      const valor = disposicao({ nome: NOME_PERIGOSO, extensao: "pdf", inline: true });
      expect(valor.startsWith("inline; ")).toBe(true);
      expect(valor).not.toMatch(/[\r\n]/);
      expect(valor).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    });

    it.each(["\u0000", "\t", "\u001b", "\u007f", "\u0085", "\u2028"])(
      "o caractere %j no nome não quebra o cabeçalho",
      (caractere) => {
        const valor = disposicao({ nome: `a${caractere}b`, extensao: "pdf", inline: true });
        expect(valor).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028]/);
        expect(partes(valor).ascii).toMatch(ASCII_SEGURO);
      },
    );

    it("um nome que tenta abrir outro parâmetro (\"; filename=evil) fica preso dentro do valor", () => {
      const valor = disposicao({ nome: 'x"; filename="evil.html', extensao: "pdf", inline: true });
      // Exatamente dois parâmetros: o texto do nome nunca fecha a aspa nem abre um `;` próprio.
      expect(valor).toMatch(/^inline; filename="[^"\\;]*"; filename\*=UTF-8''[^\s";]*$/);
      expect(partes(valor).ascii).not.toMatch(PROIBIDOS_NO_ASCII);
      expect(partes(valor).ascii.endsWith(".pdf")).toBe(true);
    });
  });

  describe("Pitfall 6: filename=\"…\" em ASCII imprimível, sem aspas nem barras", () => {
    it("acento vira a letra sem marca; aspas saem; barra vira hífen; a extensão é a do servidor", () => {
      const { ascii } = partes(disposicao({ nome: NOME_PERIGOSO, extensao: "pdf", inline: true }));
      expect(ascii).toMatch(ASCII_SEGURO);
      expect(ascii).not.toMatch(PROIBIDOS_NO_ASCII);
      expect(ascii).toBe("Tabela de precos set-2026X.pdf");
    });

    it("barra invertida e ponto e vírgula também saem do filename ASCII", () => {
      const { ascii } = partes(disposicao({ nome: "a\\b;c", extensao: "csv", inline: false }));
      expect(ascii).not.toMatch(PROIBIDOS_NO_ASCII);
      expect(ascii.endsWith(".csv")).toBe(true);
    });

    it("um nome só de caracteres fora do ASCII cai em “anexo”", () => {
      const { ascii, utf8 } = partes(disposicao({ nome: "目录 😀", extensao: "pdf", inline: true }));
      expect(ascii).toBe("anexo.pdf");
      expect(decodeURIComponent(utf8)).toBe("目录 😀.pdf");
    });

    it("um nome vazio (ou só de controles) vira “anexo” nas duas formas", () => {
      const { ascii, utf8 } = partes(disposicao({ nome: "\r\n", extensao: "pdf", inline: true }));
      expect(ascii).toBe("anexo.pdf");
      expect(decodeURIComponent(utf8)).toBe("anexo.pdf");
    });
  });

  describe("RFC 5987: filename*=UTF-8'' volta ao nome original", () => {
    it("acento, aspas e barra voltam exatamente, com a extensão do servidor", () => {
      const nome = 'Tabela de preços "set"/2026 (com frete) 100%';
      const { utf8 } = partes(disposicao({ nome, extensao: "pdf", inline: true }));
      expect(utf8).toMatch(RFC_5987);
      expect(decodeURIComponent(utf8)).toBe(`${nome}.pdf`);
    });

    it("com CR/LF no nome, volta o original SEM os controles — o resto é idêntico", () => {
      const { utf8 } = partes(disposicao({ nome: NOME_PERIGOSO, extensao: "pdf", inline: true }));
      expect(utf8).toMatch(RFC_5987);
      expect(decodeURIComponent(utf8)).toBe('Tabela de preços "set"/2026X.pdf');
    });

    it("o valor codificado não tem aspa simples, parênteses nem asterisco crus", () => {
      const { utf8 } = partes(disposicao({ nome: "it's (a) *star*", extensao: "xlsx", inline: false }));
      expect(utf8).not.toMatch(/['()*]/);
      expect(decodeURIComponent(utf8)).toBe("it's (a) *star*.xlsx");
    });
  });

  describe("UI-D9: só PDF e foto abrem na aba; planilha sempre baixa", () => {
    it.each(["pdf", "jpg"])("%s abre na aba", (extensao) => {
      expect(ehAbertoNaAba(extensao)).toBe(true);
      expect(disposicao({ nome: "x", extensao, inline: ehAbertoNaAba(extensao) }).startsWith("inline; ")).toBe(
        true,
      );
    });

    it.each(["xlsx", "xls", "csv", "html", "svg", ""])("%j baixa (attachment)", (extensao) => {
      expect(ehAbertoNaAba(extensao)).toBe(false);
      expect(
        disposicao({ nome: "x", extensao, inline: ehAbertoNaAba(extensao) }).startsWith("attachment; "),
      ).toBe(true);
    });
  });

  describe("Pitfall 8: mesmaOrigem decide o 403 do PUT", () => {
    it("sem Origin (requisição que não veio de um navegador) → aceita", () => {
      expect(mesmaOrigem({ origin: null, host: "amassacerrado.com.br", forwardedHost: null })).toBe(true);
      expect(mesmaOrigem({ origin: undefined, host: "amassacerrado.com.br", forwardedHost: null })).toBe(true);
      expect(mesmaOrigem({ origin: "", host: "amassacerrado.com.br", forwardedHost: null })).toBe(true);
    });

    it("Origin do mesmo host → aceita (sem diferença de caixa)", () => {
      expect(
        mesmaOrigem({ origin: "https://amassacerrado.com.br", host: "amassacerrado.com.br", forwardedHost: null }),
      ).toBe(true);
      expect(
        mesmaOrigem({ origin: "https://AmassaCerrado.com.br", host: "amassacerrado.com.br", forwardedHost: null }),
      ).toBe(true);
      expect(mesmaOrigem({ origin: "http://localhost:3000", host: "localhost:3000", forwardedHost: null })).toBe(true);
    });

    it("Origin de outro host → recusa", () => {
      expect(
        mesmaOrigem({ origin: "https://evil.example", host: "amassacerrado.com.br", forwardedHost: null }),
      ).toBe(false);
      expect(
        mesmaOrigem({ origin: "https://amassacerrado.com.br.evil.example", host: "amassacerrado.com.br", forwardedHost: null }),
      ).toBe(false);
      // Mesmo nome, outra porta: outro host.
      expect(mesmaOrigem({ origin: "http://localhost:4000", host: "localhost:3000", forwardedHost: null })).toBe(false);
    });

    it("Origin que não é URL (inclusive o literal null) → recusa", () => {
      expect(mesmaOrigem({ origin: "null", host: "amassacerrado.com.br", forwardedHost: null })).toBe(false);
      expect(mesmaOrigem({ origin: "não é url", host: "amassacerrado.com.br", forwardedHost: null })).toBe(false);
    });

    it("x-forwarded-host vence host (atrás do Caddy o host é o endereço interno)", () => {
      expect(
        mesmaOrigem({
          origin: "https://amassacerrado.com.br",
          host: "0.0.0.0:3000",
          forwardedHost: "amassacerrado.com.br",
        }),
      ).toBe(true);
      expect(
        mesmaOrigem({
          origin: "http://0.0.0.0:3000",
          host: "0.0.0.0:3000",
          forwardedHost: "amassacerrado.com.br",
        }),
      ).toBe(false);
    });

    it("com vários x-forwarded-host, vale o primeiro", () => {
      expect(
        mesmaOrigem({
          origin: "https://amassacerrado.com.br",
          host: "app:3000",
          forwardedHost: "amassacerrado.com.br, proxy.interno",
        }),
      ).toBe(true);
      expect(
        mesmaOrigem({
          origin: "https://proxy.interno",
          host: "app:3000",
          forwardedHost: "amassacerrado.com.br, proxy.interno",
        }),
      ).toBe(false);
    });

    it("com Origin e sem host nenhum para comparar → recusa", () => {
      expect(mesmaOrigem({ origin: "https://amassacerrado.com.br", host: null, forwardedHost: null })).toBe(false);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MARCA } from "@/conteudo/marca";
import { dominioDoSite, urlDoSite } from "@/lib/site/url";

// Quick 261030-n01 (30/10/2026): a marca mora em `conteudo/marca.ts` e a URL EFETIVA do site sai de
// `urlDoSite()` — `NEXT_PUBLIC_SITE_URL` quando preenchida, `MARCA.url` quando vazia ou ausente.
// Os domínios de exemplo abaixo são `.example` de propósito: nenhum domínio real escrito à mão.

describe("MARCA — os dados da marca", () => {
  it("nome e nome curto", () => {
    expect(MARCA.nome).toBe("AMULETO ARTE E CAFÉ");
    expect(MARCA.nomeCurto).toBe("AMULETO");
    expect(MARCA.descricao).toBe("Ateliê de cerâmica, café e loja em Pirenópolis.");
    expect(MARCA.cidade).toBe("Pirenópolis, GO");
  });

  it("domínio e url", () => {
    expect(MARCA.dominio).toBe("amuleto.art.br");
    expect(MARCA.url).toBe("https://amuleto.art.br");
  });

  it("Instagram", () => {
    expect(MARCA.instagramUsuario).toBe("@amuletoartecafe");
    expect(MARCA.instagramUrl).toBe("https://www.instagram.com/amuletoartecafe/");
  });

  it("e-mail", () => {
    expect(MARCA.email).toBe("amuletoartecafe@gmail.com");
  });

  it("WhatsApp no formato 55 + DDD + número", () => {
    expect(MARCA.whatsapp).toMatch(/^55\d{10,11}$/);
  });
});

// `urlDoSite(undefined)` cai no padrão do parâmetro, que é a variável de ambiente: ela é zerada
// aqui para o caso "ausente" não depender do shell de quem roda o teste.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("urlDoSite — a URL efetiva do site", () => {
  it("cai em MARCA.url quando a variável está ausente, vazia ou só com espaço", () => {
    expect(urlDoSite(undefined)).toBe(MARCA.url);
    expect(urlDoSite("")).toBe(MARCA.url);
    expect(urlDoSite("   ")).toBe(MARCA.url);
  });

  it("usa o valor da variável quando preenchida", () => {
    expect(urlDoSite("https://dominio-antigo.example")).toBe("https://dominio-antigo.example");
  });

  it("devolve só a origem, sem barra final nem caminho", () => {
    expect(urlDoSite("https://dominio-antigo.example/")).toBe("https://dominio-antigo.example");
    expect(urlDoSite("https://dominio-antigo.example/qualquer/caminho")).toBe(
      "https://dominio-antigo.example",
    );
  });

  it("apara espaço em volta do valor", () => {
    expect(urlDoSite("  https://dominio-antigo.example  ")).toBe("https://dominio-antigo.example");
  });

  it("aceita http com porta (desenvolvimento)", () => {
    expect(urlDoSite("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("lança com frase que nomeia a variável quando o valor não é endereço", () => {
    expect(() => urlDoSite("não é url")).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => urlDoSite("não é url")).toThrow(/https:\/\//);
  });

  it("lança quando o protocolo não é http nem https", () => {
    expect(() => urlDoSite("ftp://dominio-antigo.example")).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe("dominioDoSite — o host da URL efetiva", () => {
  it("devolve o host do valor da variável", () => {
    expect(dominioDoSite("https://dominio-antigo.example")).toBe("dominio-antigo.example");
  });

  it("cai em MARCA.dominio sem variável", () => {
    expect(dominioDoSite(undefined)).toBe(MARCA.dominio);
  });
});

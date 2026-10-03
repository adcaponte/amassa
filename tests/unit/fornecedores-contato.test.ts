import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { linkDoWhatsApp, urlDoSite } from "@/lib/fornecedores/contato";

// Os links da ficha do fornecedor (06.2-03-PLAN.md, Tarefas 1 e 2; FRN-05; Pitfalls 9 e 10 da
// pesquisa; T-06.2-09 e T-06.2-11). Telefones de teste com DDD 00 e sites no domínio reservado
// `example.com` — o repositório é público. A Tarefa 2 acrescenta as matrizes de borda do EDGE-COVERAGE
// (empty, encoding), uma categoria por `describe`.

describe("linkDoWhatsApp", () => {
  it("11 dígitos com DDD ganham o 55 na frente", () => {
    expect(linkDoWhatsApp("(00) 9 0000-0001")).toBe("https://wa.me/5500900000001");
  });
});

describe("urlDoSite", () => {
  it("sem esquema, vira https", () => {
    expect(urlDoSite("example.com")).toBe("https://example.com/");
  });

  it("javascript: nunca vira link", () => {
    expect(urlDoSite("javascript:alert(1)")).toBeNull();
  });
});

describe("pureza", () => {
  it("lib/fornecedores/contato.ts não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/contato.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

// ——— Tarefa 2: as arestas do EDGE-COVERAGE (FRN-05), uma categoria por `describe`. ———

describe("empty — sem contato, sem link", () => {
  it.each([null, undefined, "", "   ", "\t\n"])("WhatsApp %j → sem link", (texto) => {
    expect(linkDoWhatsApp(texto)).toBeNull();
  });

  it.each([null, undefined, "", "   ", "\t\n"])("site %j → sem link", (texto) => {
    expect(urlDoSite(texto)).toBeNull();
  });

  it("WhatsApp sem nenhum dígito → sem link", () => {
    expect(linkDoWhatsApp("não tem")).toBeNull();
    expect(linkDoWhatsApp("( ) -")).toBeNull();
  });
});

describe("encoding — só dígitos no wa.me; só http(s) no site", () => {
  it.each([
    ["9 dígitos (sem DDD)", "9 0000-0001", null],
    ["10 dígitos (fixo com DDD)", "(00) 0000-0001", "https://wa.me/550000000001"],
    ["11 dígitos (celular com DDD)", "(00) 9 0000-0001", "https://wa.me/5500900000001"],
    ["12 dígitos começando por 55", "+55 (00) 0000-0001", "https://wa.me/550000000001"],
    ["13 dígitos começando por 55", "+55 00 9 0000-0001", "https://wa.me/5500900000001"],
    ["12 dígitos começando por 11 (outro DDI)", "+11 00 0000-0001", null],
    ["13 dígitos começando por 44", "+44 00 9000 00001", null],
    ["14 dígitos", "+55 00 9 0000-00011", null],
    ["só dígitos, sem máscara", "00900000001", "https://wa.me/5500900000001"],
  ] as const)("%s → %s", (_caso, texto, esperado) => {
    expect(linkDoWhatsApp(texto)).toBe(esperado);
  });

  it("o link só tem dígitos depois de wa.me/, mesmo com letras e símbolos no texto", () => {
    const link = linkDoWhatsApp("tel: (00) 9 0000-0001 <script>");
    expect(link).toBe("https://wa.me/5500900000001");
    expect(link).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });

  it.each([
    ["http com host", "http://x.example", "http://x.example/"],
    ["https com caminho", "https://example.com/loja", "https://example.com/loja"],
    ["sem esquema, com caminho", "example.com/loja", "https://example.com/loja"],
    ["sem esquema, com porta", "example.com:8080", "https://example.com:8080/"],
    ["espaços em volta", "  example.com  ", "https://example.com/"],
    ["esquema em maiúsculas", "HTTPS://Example.com", "https://example.com/"],
  ] as const)("site %s → %s", (_caso, texto, esperado) => {
    expect(urlDoSite(texto)).toBe(esperado);
  });

  it.each([
    "ftp://x",
    "data:text/html,x",
    "javascript:x",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "vbscript:msgbox(1)",
    "mailto:vendas@example.com",
    "file:///etc/passwd",
    "https://",
    "exemplo com espaço.com",
  ])("site %j → sem link", (texto) => {
    expect(urlDoSite(texto)).toBeNull();
  });
});

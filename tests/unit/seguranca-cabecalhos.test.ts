import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CABECALHOS_DE_SEGURANCA, POLITICA_DE_CONTEUDO } from "../../lib/seguranca/cabecalhos";

// D-19 (Fase 06.5): a lista pura que o `next.config.ts` espalha em `headers()`. O e2e
// `tests/e2e/polimento-seguranca.spec.ts` confere que ela chega de verdade às respostas.
const NOMES_ESPERADOS = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "X-Frame-Options",
  "Permissions-Policy",
  "Content-Security-Policy-Report-Only",
];

function valorDe(nome: string): string {
  const cabecalho = CABECALHOS_DE_SEGURANCA.find((item) => item.key.toLowerCase() === nome.toLowerCase());
  expect(cabecalho, `cabeçalho ${nome} ausente`).toBeDefined();
  return cabecalho!.value;
}

describe("CABECALHOS_DE_SEGURANCA", () => {
  it("tem os seis cabeçalhos, nenhum a mais", () => {
    expect(CABECALHOS_DE_SEGURANCA.map((item) => item.key).sort()).toEqual([...NOMES_ESPERADOS].sort());
  });

  it("não repete nenhum nome (sem distinguir maiúscula)", () => {
    const nomes = CABECALHOS_DE_SEGURANCA.map((item) => item.key.toLowerCase());
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("nenhum valor vazio", () => {
    for (const item of CABECALHOS_DE_SEGURANCA) {
      expect(item.value.trim(), item.key).not.toBe("");
    }
  });

  it("HSTS de pelo menos um ano, com includeSubDomains e SEM preload", () => {
    const hsts = valorDe("Strict-Transport-Security");
    const maxAge = /max-age=(\d+)/.exec(hsts);
    expect(maxAge).not.toBeNull();
    expect(Number(maxAge![1])).toBeGreaterThanOrEqual(31536000);
    expect(hsts).toContain("includeSubDomains");
    expect(hsts.toLowerCase()).not.toContain("preload");
  });

  it("os valores fixos da D-19", () => {
    expect(valorDe("X-Content-Type-Options")).toBe("nosniff");
    expect(valorDe("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(valorDe("X-Frame-Options")).toBe("DENY");
  });

  it("Permissions-Policy fecha câmera, microfone, geolocalização, pagamento e USB", () => {
    const politica = valorDe("Permissions-Policy");
    for (const recurso of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(politica).toContain(`${recurso}=()`);
    }
  });

  it("a CSP vai SÓ em report-only, com frame-ancestors 'none'", () => {
    expect(valorDe("Content-Security-Policy-Report-Only")).toBe(POLITICA_DE_CONTEUDO);
    expect(POLITICA_DE_CONTEUDO).toContain("frame-ancestors 'none'");
    expect(POLITICA_DE_CONTEUDO).toContain("default-src 'self'");
    // Nenhuma CSP que bloqueia: o Next injeta script em linha; travar é decisão futura, medida.
    expect(CABECALHOS_DE_SEGURANCA.some((item) => item.key.toLowerCase() === "content-security-policy")).toBe(false);
  });

  it("o next.config.ts espalha a lista em headers() e desliga o X-Powered-By", () => {
    const configuracao = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(configuracao).toContain("poweredByHeader: false");
    expect(configuracao).toContain("async headers()");
    expect(configuracao).toContain("...CABECALHOS_DE_SEGURANCA");
  });
});

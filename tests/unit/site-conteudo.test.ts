import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTEUDO_SITE, MENSAGENS_DO_WHATSAPP, SLOTS_DE_IMAGEM } from "@/conteudo/site";

// Fase 04.6 (D-15/D-17/D-18/D-20): o conteúdo do site inteiro mora num arquivo versionado,
// zero import, sem marcação HTML e sem preço. Este teste prova as garantias que o SUMMARY do
// plano promete — não a redação exata do texto (isso é revisão humana, "judgment" na tabela de
// verificação do plano).
describe("conteudo/site.ts — conteúdo do site público (D-15, D-17, D-18, D-20)", () => {
  it("os nove trechos com marcação viram estrutura, nunca string HTML", () => {
    expect(CONTEUDO_SITE.obra).toEqual({
      destaque: expect.any(String),
      resto: expect.any(String),
    });
    expect(CONTEUDO_SITE.heroTitulo).toEqual({
      linha1: expect.any(String),
      linha2: expect.any(String),
    });
    expect(CONTEUDO_SITE.passo1).toEqual({ titulo: expect.any(String), corpo: expect.any(String) });
    expect(CONTEUDO_SITE.passo2).toEqual({ titulo: expect.any(String), corpo: expect.any(String) });
    expect(CONTEUDO_SITE.passo3).toEqual({ titulo: expect.any(String), corpo: expect.any(String) });
    expect(CONTEUDO_SITE.contato).toEqual({
      endereco: expect.any(String),
      horario: expect.any(String),
      whatsappRotulo: expect.any(String),
      instagramUsuario: expect.any(String),
      instagramUrl: expect.any(String),
    });
    expect(CONTEUDO_SITE.rodape).toEqual({ linha: expect.any(String), quemSomos: expect.any(String) });
  });

  it("nenhum campo de texto do site contém marcação HTML (<b>, <span>, <a>)", () => {
    function coletarStrings(valor: unknown, caminho: string, acumulador: [string, string][]) {
      if (typeof valor === "string") {
        acumulador.push([caminho, valor]);
        return;
      }
      if (valor && typeof valor === "object") {
        for (const [chave, filho] of Object.entries(valor)) {
          coletarStrings(filho, `${caminho}.${chave}`, acumulador);
        }
      }
    }

    const strings: [string, string][] = [];
    coletarStrings(CONTEUDO_SITE, "CONTEUDO_SITE", strings);

    for (const [caminho, valor] of strings) {
      expect(valor, `${caminho} não deveria conter marcação HTML`).not.toMatch(/<[a-z][\s\S]*>/i);
    }
  });

  it("D-18: nenhuma das quatro chaves de preço (c1/c2/c3 + agLivre) traz número", () => {
    for (const chave of ["c1Preco", "c2Preco", "c3Preco", "agLivre"] as const) {
      const texto = CONTEUDO_SITE[chave];
      expect(texto, `${chave} não deveria conter "R$"`).not.toMatch(/R\$/);
      expect(texto, `${chave} não deveria conter valor em dinheiro (dígitos com vírgula)`).not.toMatch(
        /\d+,\d{2}/,
      );
    }
  });

  it("D-17: zap é só dígitos, com 55 e DDD", () => {
    expect(CONTEUDO_SITE.zap).toMatch(/^55\d{10,11}$/);
  });

  it("MENSAGENS_DO_WHATSAPP tem as quatro mensagens nomeadas", () => {
    expect(Object.keys(MENSAGENS_DO_WHATSAPP).sort()).toEqual(
      ["aulas", "orcamento", "site", "usoLivre"].sort(),
    );
    for (const mensagem of Object.values(MENSAGENS_DO_WHATSAPP)) {
      expect(mensagem.length).toBeGreaterThan(0);
    }
  });

  it("D-20: fachada e mapa não têm arquivo (slot vazio não renderiza)", () => {
    expect(SLOTS_DE_IMAGEM.fachada.arquivo).toBeNull();
    expect(SLOTS_DE_IMAGEM.mapa.arquivo).toBeNull();
  });

  it("os cinco slots de foto têm arquivo e alt preenchidos", () => {
    for (const chave of ["abertura", "cafe", "usoLivre", "loja", "encomendas"] as const) {
      const slot = SLOTS_DE_IMAGEM[chave];
      expect(slot.arquivo).toEqual(expect.any(String));
      expect(slot.alt.length).toBeGreaterThan(0);
    }
  });

  it("nenhuma menção a /gestao no arquivo de conteúdo", () => {
    const conteudo = readFileSync(join(process.cwd(), "conteudo/site.ts"), "utf-8");
    expect(conteudo).not.toContain("gestao");
  });

  it("conteudo/site.ts não importa nada e não declara let/var", () => {
    const conteudo = readFileSync(join(process.cwd(), "conteudo/site.ts"), "utf-8");
    expect(conteudo.match(/^import /m)).toBeNull();
    expect(conteudo.match(/^\s*(let|var) /m)).toBeNull();
  });
});

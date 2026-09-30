import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAMINHOS_ANTIGOS,
  DATA_DE_REMOCAO_DA_PRODUCAO,
  DATA_DE_REMOCAO_DOS_REDIRECIONAMENTOS,
  PREFIXOS_DA_PRODUCAO,
  REDIRECIONAMENTOS_ANTIGOS,
  REDIRECIONAMENTOS_DA_PRODUCAO,
} from "../../lib/rotas/redirecionamentos-antigos";

// Conferida no plano 04 (Fase 04.6): a lista continua só a raiz. `app/sitemap.ts` (novo neste
// plano) não é rota de CONTEÚDO do site — é o XML que o buscador lê, sem seção nem âncora
// própria — então não entra aqui. A interseção com os 13 caminhos antigos continua vazia; a
// reserva de nome (D-01) vale até 2027-03-28 — depois disso, esta lista pode crescer sem medo
// de colidir com um caminho antigo já removido.
const ROTAS_PUBLICAS_DO_SITE_ONDA_1 = ["/"];

// Casa um `source` de redirecionamento (que pode ter um segmento dinâmico `:id`) contra um
// caminho concreto — usado pelo teste (f) para provar que nenhum DESTINO (sempre um caminho
// concreto sob /gestao) jamais bateria com um SOURCE da própria lista, inclusive quando o
// source tem `:id`.
function casaComSource(source: string, caminho: string): boolean {
  const segmentosSource = source.split("/");
  const segmentosCaminho = caminho.split("/");
  if (segmentosSource.length !== segmentosCaminho.length) return false;
  return segmentosSource.every(
    (segmento, indice) => segmento.startsWith(":") || segmento === segmentosCaminho[indice],
  );
}

describe("REDIRECIONAMENTOS_ANTIGOS", () => {
  it("(a) são exatamente 13 entradas", () => {
    expect(CAMINHOS_ANTIGOS).toHaveLength(13);
    expect(REDIRECIONAMENTOS_ANTIGOS).toHaveLength(13);
  });

  it("(b) nenhum source repetido", () => {
    expect(new Set(CAMINHOS_ANTIGOS).size).toBe(CAMINHOS_ANTIGOS.length);
  });

  it("(c) nenhum source contém curinga de caminho", () => {
    for (const source of CAMINHOS_ANTIGOS) {
      expect(source.includes("*")).toBe(false);
    }
  });

  it("(d) todo destination é o source prefixado por /gestao", () => {
    for (const redirecionamento of REDIRECIONAMENTOS_ANTIGOS) {
      expect(redirecionamento.destination).toBe(`/gestao${redirecionamento.source}`);
    }
  });

  it("(e) permanent é false em todas", () => {
    for (const redirecionamento of REDIRECIONAMENTOS_ANTIGOS) {
      expect(redirecionamento.permanent).toBe(false);
    }
  });

  it("(f) nenhum destination casa com nenhum source da lista (sem laço), inclusive por segmento dinâmico", () => {
    for (const redirecionamento of REDIRECIONAMENTOS_ANTIGOS) {
      for (const source of CAMINHOS_ANTIGOS) {
        expect(casaComSource(source, redirecionamento.destination)).toBe(false);
      }
    }
  });

  it("(g) CAMINHOS_ANTIGOS não contém / nem /api/health", () => {
    expect(CAMINHOS_ANTIGOS).not.toContain("/");
    expect(CAMINHOS_ANTIGOS).not.toContain("/api/health");
  });

  it("(h) CAMINHOS_ANTIGOS é disjunto das rotas públicas do site (onda 1)", () => {
    const interseccao = CAMINHOS_ANTIGOS.filter((caminho) =>
      ROTAS_PUBLICAS_DO_SITE_ONDA_1.includes(caminho),
    );
    expect(interseccao).toEqual([]);
  });

  it("(i) o comentário do módulo contém a data literal de remoção", () => {
    const conteudo = readFileSync(
      join(process.cwd(), "lib/rotas/redirecionamentos-antigos.ts"),
      "utf8",
    );
    expect(conteudo).toContain("remover após 2027-03-28");
    expect(DATA_DE_REMOCAO_DOS_REDIRECIONAMENTOS).toBe("2027-03-28");
  });

  it("declara /encomendas/imprimir antes de /encomendas/:id (o literal precisa vencer)", () => {
    const indiceImprimir = CAMINHOS_ANTIGOS.indexOf("/encomendas/imprimir");
    const indiceId = CAMINHOS_ANTIGOS.indexOf("/encomendas/:id");
    expect(indiceImprimir).toBeGreaterThanOrEqual(0);
    expect(indiceId).toBeGreaterThanOrEqual(0);
    expect(indiceImprimir).toBeLessThan(indiceId);
  });

  it("declara /queimas/relatorios antes de /queimas/:id (o literal precisa vencer)", () => {
    const indiceRelatorios = CAMINHOS_ANTIGOS.indexOf("/queimas/relatorios");
    const indiceId = CAMINHOS_ANTIGOS.indexOf("/queimas/:id");
    expect(indiceRelatorios).toBeGreaterThanOrEqual(0);
    expect(indiceId).toBeGreaterThanOrEqual(0);
    expect(indiceRelatorios).toBeLessThan(indiceId);
  });
});

// Fase 06.1 (D-03, D-17): os endereços antigos do módulo de Encomendas, que virou a Produção,
// redirecionam por seis meses — lista explícita, sem curinga, destinos internos fixos (T-06.1-52).
describe("REDIRECIONAMENTOS_DA_PRODUCAO", () => {
  it("são exatamente 3 entradas, na ordem: a raiz do módulo, /imprimir e :id", () => {
    expect(REDIRECIONAMENTOS_DA_PRODUCAO.map(({ source }) => source)).toEqual([
      "/gestao/encomendas",
      "/gestao/encomendas/imprimir",
      "/gestao/encomendas/:id",
    ]);
  });

  it("cada destino é o equivalente em /gestao/producao", () => {
    expect(REDIRECIONAMENTOS_DA_PRODUCAO.map(({ destination }) => destination)).toEqual([
      "/gestao/producao",
      "/gestao/producao/imprimir",
      "/gestao/producao/:id",
    ]);
    expect(PREFIXOS_DA_PRODUCAO).toEqual({
      antigo: "/gestao/encomendas",
      novo: "/gestao/producao",
    });
    for (const { source, destination } of REDIRECIONAMENTOS_DA_PRODUCAO) {
      expect(source.startsWith(PREFIXOS_DA_PRODUCAO.antigo)).toBe(true);
      expect(destination.startsWith(PREFIXOS_DA_PRODUCAO.novo)).toBe(true);
    }
  });

  it("o literal /imprimir vem antes de :id (senão :id casaria com imprimir)", () => {
    const sources = REDIRECIONAMENTOS_DA_PRODUCAO.map(({ source }) => source);
    expect(sources.indexOf("/gestao/encomendas/imprimir")).toBeLessThan(
      sources.indexOf("/gestao/encomendas/:id"),
    );
  });

  it("nenhum curinga, permanent false em todas, nenhum destino casa com um source (sem laço)", () => {
    const todos = [...REDIRECIONAMENTOS_ANTIGOS, ...REDIRECIONAMENTOS_DA_PRODUCAO];
    for (const redirecionamento of REDIRECIONAMENTOS_DA_PRODUCAO) {
      expect(redirecionamento.source.includes("*")).toBe(false);
      expect(redirecionamento.destination.includes("*")).toBe(false);
      expect(redirecionamento.permanent).toBe(false);
      for (const { source } of todos) {
        expect(casaComSource(source, redirecionamento.destination)).toBe(false);
      }
    }
  });

  it("não mexe nos 13 da raiz", () => {
    expect(REDIRECIONAMENTOS_ANTIGOS).toHaveLength(13);
    expect(DATA_DE_REMOCAO_DOS_REDIRECIONAMENTOS).toBe("2027-03-28");
  });

  it("a data de remoção é AAAA-MM-DD, depois de 2026-09-30, e está no comentário do módulo", () => {
    expect(DATA_DE_REMOCAO_DA_PRODUCAO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DATA_DE_REMOCAO_DA_PRODUCAO > "2026-09-30").toBe(true);
    // Seis meses civis depois do dia da implementação (2026-09-30): nunca antes de 2027-03-30.
    expect(DATA_DE_REMOCAO_DA_PRODUCAO >= "2027-03-30").toBe(true);
    const conteudo = readFileSync(
      join(process.cwd(), "lib/rotas/redirecionamentos-antigos.ts"),
      "utf8",
    );
    expect(conteudo).toContain(`remover após ${DATA_DE_REMOCAO_DA_PRODUCAO}`);
  });

  it("next.config.ts devolve as duas listas", () => {
    const conteudo = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(conteudo).toContain("...REDIRECIONAMENTOS_ANTIGOS");
    expect(conteudo).toContain("...REDIRECIONAMENTOS_DA_PRODUCAO");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAMINHOS_ANTIGOS,
  DATA_DE_REMOCAO_DOS_REDIRECIONAMENTOS,
  REDIRECIONAMENTOS_ANTIGOS,
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

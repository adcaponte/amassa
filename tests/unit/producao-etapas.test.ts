import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { caminhoOrdem, etapaProducao, statusOrdem, tipoOrdem } from "@/db/schema";
import {
  CAMINHOS_DE_ORDEM,
  DIAS_PREVISTOS_PADRAO,
  ETAPAS_DE_QUEIMA,
  ETAPAS_DO_CAMINHO,
  ORDEM_DAS_COLUNAS,
  STATUS_DE_ORDEM,
  TIPOS_DE_ORDEM,
  etapasIniciais,
  rotuloDaColuna,
  rotuloDaEtapa,
} from "@/lib/producao/etapas";

// Fase 06.1 (plano 01). As uniões de `lib/producao/etapas.ts` são REDECLARADAS à mão (o módulo é
// puro, não importa `@/db/schema`) — estes testes são o elo que obriga as duas cópias a
// continuarem iguais, no molde de `tests/unit/cronograma.test.ts` (paridade com o enum).
describe("paridade com os enums de db/schema.ts", () => {
  it("ORDEM_DAS_COLUNAS e o caminho completo casam, na mesma ordem, com etapaProducao.enumValues", () => {
    expect(ORDEM_DAS_COLUNAS).toEqual(etapaProducao.enumValues);
    expect(ETAPAS_DO_CAMINHO.completo).toEqual(etapaProducao.enumValues);
  });

  it("STATUS_DE_ORDEM casa com statusOrdem.enumValues", () => {
    expect(STATUS_DE_ORDEM).toEqual(statusOrdem.enumValues);
  });

  it("CAMINHOS_DE_ORDEM casa com caminhoOrdem.enumValues", () => {
    expect(CAMINHOS_DE_ORDEM).toEqual(caminhoOrdem.enumValues);
  });

  it("TIPOS_DE_ORDEM casa com tipoOrdem.enumValues", () => {
    expect(TIPOS_DE_ORDEM).toEqual(tipoOrdem.enumValues);
  });
});

describe("caminhos (PRD-04)", () => {
  it("o caminho biscoito é producao, secagem, queima1, entrega", () => {
    expect(ETAPAS_DO_CAMINHO.biscoito).toEqual(["producao", "secagem", "queima1", "entrega"]);
  });

  it("o caminho biscoito é subsequência do completo, e a entrega fecha os dois", () => {
    let proximo = 0;
    for (const etapa of ETAPAS_DO_CAMINHO.biscoito) {
      const indice = ETAPAS_DO_CAMINHO.completo.indexOf(etapa, proximo);
      expect(indice).toBeGreaterThanOrEqual(proximo);
      proximo = indice + 1;
    }
    expect(ETAPAS_DO_CAMINHO.completo.at(-1)).toBe("entrega");
    expect(ETAPAS_DO_CAMINHO.biscoito.at(-1)).toBe("entrega");
  });

  it("nenhum caminho é vazio: completo tem 6 etapas e biscoito 4", () => {
    expect(ETAPAS_DO_CAMINHO.completo).toHaveLength(6);
    expect(ETAPAS_DO_CAMINHO.biscoito).toHaveLength(4);
  });

  it("as etapas de queima são queima1 e queima2", () => {
    expect(ETAPAS_DE_QUEIMA).toEqual(["queima1", "queima2"]);
  });
});

describe("DIAS_PREVISTOS_PADRAO (D-10)", () => {
  it("é 5/15/1/1/4/6", () => {
    expect(DIAS_PREVISTOS_PADRAO).toEqual({
      producao: 5,
      secagem: 15,
      queima1: 1,
      esmaltacao: 1,
      queima2: 4,
      entrega: 6,
    });
  });

  it("soma 32 no caminho completo e 27 no que termina no biscoito", () => {
    const soma = (caminho: "completo" | "biscoito") =>
      etapasIniciais(caminho).reduce((total, etapa) => total + etapa.diasPrevistos, 0);
    expect(soma("completo")).toBe(32);
    expect(soma("biscoito")).toBe(27);
  });

  it("a migração 0024 (bloco (b) do D-02) repete os mesmos seis pares (etapa, posição, dias)", () => {
    const sql = readFileSync(join(process.cwd(), "db/migrations/0024_producao.sql"), "utf8");
    const pares = [...sql.matchAll(/\('(\w+)',\s*(\d+),\s*(\d+)\)/g)].map((casamento) => ({
      etapa: casamento[1],
      posicao: Number(casamento[2]),
      dias: Number(casamento[3]),
    }));
    expect(pares).toEqual(
      ETAPAS_DO_CAMINHO.completo.map((etapa, posicao) => ({
        etapa,
        posicao,
        dias: DIAS_PREVISTOS_PADRAO[etapa],
      })),
    );
  });
});

describe("etapasIniciais", () => {
  it("o caminho completo nasce com as seis etapas, posições 0..5 e os previstos padrão", () => {
    expect(etapasIniciais("completo")).toEqual([
      { etapa: "producao", posicao: 0, diasPrevistos: 5 },
      { etapa: "secagem", posicao: 1, diasPrevistos: 15 },
      { etapa: "queima1", posicao: 2, diasPrevistos: 1 },
      { etapa: "esmaltacao", posicao: 3, diasPrevistos: 1 },
      { etapa: "queima2", posicao: 4, diasPrevistos: 4 },
      { etapa: "entrega", posicao: 5, diasPrevistos: 6 },
    ]);
  });

  it("o caminho biscoito nasce com quatro etapas, posições 0..3", () => {
    expect(etapasIniciais("biscoito")).toEqual([
      { etapa: "producao", posicao: 0, diasPrevistos: 5 },
      { etapa: "secagem", posicao: 1, diasPrevistos: 15 },
      { etapa: "queima1", posicao: 2, diasPrevistos: 1 },
      { etapa: "entrega", posicao: 3, diasPrevistos: 6 },
    ]);
  });
});

describe("rótulos", () => {
  it("rotuloDaEtapa escreve os nomes da UI-SPEC, e a última muda com o tipo", () => {
    expect(rotuloDaEtapa("producao", "encomenda")).toBe("Produção");
    expect(rotuloDaEtapa("secagem", "casa")).toBe("Secagem");
    expect(rotuloDaEtapa("queima1", "encomenda")).toBe("Queima de biscoito");
    expect(rotuloDaEtapa("esmaltacao", "encomenda")).toBe("Esmaltação");
    expect(rotuloDaEtapa("queima2", "encomenda")).toBe("Queima de esmalte");
    expect(rotuloDaEtapa("entrega", "encomenda")).toBe("Entrega");
    expect(rotuloDaEtapa("entrega", "casa")).toBe("Guardar no estoque");
  });

  it("rotuloDaColuna: a última coluna é “Entrega / estoque”", () => {
    expect(ORDEM_DAS_COLUNAS.map(rotuloDaColuna)).toEqual([
      "Produção",
      "Secagem",
      "Queima de biscoito",
      "Esmaltação",
      "Queima de esmalte",
      "Entrega / estoque",
    ]);
  });
});

describe("etapasIniciais e a ordenação por posição (PRD-04 · ordering)", () => {
  it("devolve posição 0..n−1 na ordem de ETAPAS_DO_CAMINHO, sem repetição, nos dois caminhos", () => {
    for (const caminho of CAMINHOS_DE_ORDEM) {
      const etapas = etapasIniciais(caminho);
      expect(etapas.map((etapa) => etapa.etapa)).toEqual(ETAPAS_DO_CAMINHO[caminho]);
      expect(etapas.map((etapa) => etapa.posicao)).toEqual(
        ETAPAS_DO_CAMINHO[caminho].map((_, indice) => indice),
      );
      expect(new Set(etapas.map((etapa) => etapa.etapa)).size).toBe(etapas.length);
      expect(new Set(etapas.map((etapa) => etapa.posicao)).size).toBe(etapas.length);
    }
  });

  it("cada chamada devolve uma lista nova — mexer nela não muda a próxima", () => {
    const primeira = etapasIniciais("completo");
    primeira.reverse();
    expect(etapasIniciais("completo")[0]).toMatchObject({ etapa: "producao", posicao: 0 });
  });
});

import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { compararMigracoes, lerJornalDoCheckout } from "../../scripts/conferir-migracoes-da-imagem.mjs";

// 06.5-WR-04 (quick 261007-shs; decisão do dono, 07/10/2026): o job `banco` migra o Postgres efêmero PELA
// imagem `ferramentas` — a que o dono roda à mão em produção, depois do backup — e este conferidor prova, pelo
// hash de cada arquivo, que ela aplicou exatamente as migrações do commit. Um Dockerfile que deixe de copiar
// `db/migrations/` (WINDOWS #13) passa a reprovar no pipeline, não no Roteiro.

const jornal = [
  { tag: "0030_x", when: 1, hash: "a".repeat(64) },
  { tag: "0031_y", when: 2, hash: "b".repeat(64) },
];

describe("compararMigracoes", () => {
  it("iguais: nenhum problema (created_at chega como texto — o bigint do pg)", () => {
    expect(
      compararMigracoes({
        jornal,
        aplicadas: [
          { created_at: "1", hash: "a".repeat(64) },
          { created_at: "2", hash: "b".repeat(64) },
        ],
      }),
    ).toEqual([]);
  });

  it("a imagem não aplicou uma migração do commit", () => {
    const problemas = compararMigracoes({ jornal, aplicadas: [{ created_at: "1", hash: "a".repeat(64) }] });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("0031_y");
    expect(problemas[0]).toContain("não aplicou");
  });

  it("o arquivo da imagem difere do commit", () => {
    const problemas = compararMigracoes({
      jornal,
      aplicadas: [
        { created_at: "1", hash: "a".repeat(64) },
        { created_at: "2", hash: "c".repeat(64) },
      ],
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("0031_y");
    expect(problemas[0]).toContain("difere do commit");
  });

  it("o banco tem uma migração que o commit não conhece", () => {
    const problemas = compararMigracoes({
      jornal,
      aplicadas: [
        { created_at: "1", hash: "a".repeat(64) },
        { created_at: "2", hash: "b".repeat(64) },
        { created_at: "3", hash: "d".repeat(64) },
      ],
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("o commit não conhece");
  });
});

describe("lerJornalDoCheckout", () => {
  it("uma entrada por linha do _journal.json, com o sha256 de cada .sql do disco", () => {
    const entradas = lerJornalDoCheckout("db/migrations");
    const arquivosSql = readdirSync("db/migrations").filter((nome) => nome.endsWith(".sql"));
    expect(entradas).toHaveLength(arquivosSql.length);
    for (const entrada of entradas) {
      expect(arquivosSql).toContain(`${entrada.tag}.sql`);
      expect(entrada.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isSafeInteger(entrada.when)).toBe(true);
    }
    expect(entradas.at(-1)?.tag).toBe("0031_polimento");
  });
});

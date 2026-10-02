import { describe, expect, it } from "vitest";

import { chaveDoEnvio, umaVezPorEnvio } from "@/lib/agenda/envios";

// WR-06 da revisão B: a mesma chave de envio (da mesma pessoa, na mesma ação, com os mesmos dados) grava
// uma vez só; recusa e falha liberam a chave; sem chave, tudo grava como antes.

const CHAVE = "3f1c2b7a-9d4e-4c1a-8b2f-6e5d4c3b2a10";

function contador() {
  let vezes = 0;
  return {
    get vezes() {
      return vezes;
    },
    gravar: async () => {
      vezes += 1;
      return { ok: true as const, dados: { id: `registro-${vezes}` } };
    },
  };
}

describe("chaveDoEnvio", () => {
  it("é nula sem uma chave de envio válida", () => {
    expect(chaveDoEnvio("u1", "lancarTurma", { nome: "x" }, { nome: "x" })).toBeNull();
    expect(chaveDoEnvio("u1", "lancarTurma", { chaveDeEnvio: "não é uuid" }, {})).toBeNull();
    expect(chaveDoEnvio("u1", "lancarTurma", null, {})).toBeNull();
  });

  it("separa pessoa, ação e dados", () => {
    const base = chaveDoEnvio("u1", "lancarTurma", { chaveDeEnvio: CHAVE }, { nome: "A" });
    expect(base).not.toBeNull();
    expect(chaveDoEnvio("u2", "lancarTurma", { chaveDeEnvio: CHAVE }, { nome: "A" })).not.toBe(base);
    expect(chaveDoEnvio("u1", "lancarAvulsa", { chaveDeEnvio: CHAVE }, { nome: "A" })).not.toBe(base);
    expect(chaveDoEnvio("u1", "lancarTurma", { chaveDeEnvio: CHAVE }, { nome: "B" })).not.toBe(base);
  });
});

describe("umaVezPorEnvio", () => {
  it("a mesma chave grava uma vez e devolve o mesmo resultado — também com a primeira ainda no ar", async () => {
    const gravacao = contador();
    const chave = `teste|mesma|${Math.random()}`;
    const [primeira, segunda] = await Promise.all([
      umaVezPorEnvio(chave, gravacao.gravar),
      umaVezPorEnvio(chave, gravacao.gravar),
    ]);
    const terceira = await umaVezPorEnvio(chave, gravacao.gravar);
    expect(gravacao.vezes).toBe(1);
    expect(segunda).toEqual(primeira);
    expect(terceira).toEqual(primeira);
  });

  it("recusa e falha liberam a chave: tentar de novo grava de fato", async () => {
    const chave = `teste|recusa|${Math.random()}`;
    const recusada = await umaVezPorEnvio(chave, async () => ({ ok: false as const, erro: "não" }));
    expect(recusada.ok).toBe(false);
    await expect(
      umaVezPorEnvio(chave, async () => {
        throw new Error("rede");
      }),
    ).rejects.toThrow("rede");
    const gravacao = contador();
    await umaVezPorEnvio(chave, gravacao.gravar);
    expect(gravacao.vezes).toBe(1);
  });

  it("sem chave, cada chamada grava", async () => {
    const gravacao = contador();
    await umaVezPorEnvio(null, gravacao.gravar);
    await umaVezPorEnvio(null, gravacao.gravar);
    expect(gravacao.vezes).toBe(2);
  });
});

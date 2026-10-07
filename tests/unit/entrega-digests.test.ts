import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

// 06.5-WR-04 (quick 261007-shs; decisão do dono, 07/10/2026): a guarda de regressão do workflow de entrega.
// As duas imagens circulam pelo DIGEST que `construir` subiu — nunca pela tag mutável `:<sha>` —, a
// `ferramentas` migra o Postgres efêmero do job `banco` antes de ser promovida, e `publicar` promove pelos
// digests e confere o resultado. O `js-yaml` (4.3.1) é dependência transitiva já instalada, sem tipos.

type Passo = { id?: string; name?: string; run?: string; uses?: string; env?: Record<string, unknown> };
type Job = {
  needs?: string | string[];
  outputs?: Record<string, string>;
  steps?: Passo[];
};
type Fluxo = { jobs: Record<string, Job> };

const yaml = createRequire(import.meta.url)("js-yaml") as { load(texto: string): unknown };
const TEXTO = readFileSync(".github/workflows/entrega.yml", "utf8");
const FLUXO = yaml.load(TEXTO) as Fluxo;

function job(nome: string): Job {
  const encontrado = FLUXO.jobs[nome];
  if (!encontrado) {
    throw new Error(`O workflow não tem o job ${nome}.`);
  }
  return encontrado;
}

function needs(nome: string): string[] {
  const valor = job(nome).needs;
  return valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];
}

function passos(nome: string): Passo[] {
  return job(nome).steps ?? [];
}

function runs(nome: string): string[] {
  return passos(nome).flatMap((passo) => (passo.run ? [passo.run] : []));
}

function indiceDoPasso(nome: string, criterio: (passo: Passo) => boolean): number {
  return passos(nome).findIndex(criterio);
}

describe("entrega.yml — construir expõe os digests", () => {
  it("os dois build-push-action têm id e as saídas são os digests deles", () => {
    const construir = job("construir");
    const idDe = (alvo: string) =>
      passos("construir").find((passo) => passo.uses?.startsWith("docker/build-push-action") && passo.id === alvo);
    expect(idDe("app")).toBeDefined();
    expect(idDe("ferramentas")).toBeDefined();
    expect(construir.outputs).toEqual({
      digest_app: "${{ steps.app.outputs.digest }}",
      digest_ferramentas: "${{ steps.ferramentas.outputs.digest }}",
    });
  });

  it("todo job que lê needs.construir.outputs tem construir no needs", () => {
    for (const [nome, definicao] of Object.entries(FLUXO.jobs)) {
      if (JSON.stringify(definicao).includes("needs.construir.outputs")) {
        expect(needs(nome), `o job ${nome} lê as saídas de construir`).toContain("construir");
      }
    }
  });
});

describe("entrega.yml — ninguém consome a tag mutável", () => {
  it("e2e baixa e roda a imagem app pelo digest", () => {
    const pelaImagem = "@${{ needs.construir.outputs.digest_app }}";
    expect(runs("e2e").some((run) => run.includes("docker pull") && run.includes(pelaImagem))).toBe(true);
    expect(runs("e2e").some((run) => run.includes("docker run") && run.includes(pelaImagem))).toBe(true);
  });

  it("nenhum run de e2e, banco ou publicar usa :<sha> ou ferramentas-<sha>", () => {
    for (const nome of ["e2e", "banco", "publicar"]) {
      for (const run of runs(nome)) {
        expect(run, `um passo de ${nome}`).not.toContain(":${{ github.sha }}");
        expect(run, `um passo de ${nome}`).not.toContain("ferramentas-${{ github.sha }}");
      }
    }
  });
});

describe("entrega.yml — banco migra pela imagem ferramentas e confere", () => {
  it("banco espera construir", () => {
    expect(needs("banco")).toEqual(expect.arrayContaining(["qualidade", "construir"]));
  });

  it("db/migrate.ts só roda dentro de docker run da ferramentas pelo digest", () => {
    const migracoes = runs("banco").filter((run) => run.includes("db/migrate.ts"));
    expect(migracoes.length).toBeGreaterThan(0);
    for (const run of migracoes) {
      expect(run).toContain("docker run");
      expect(run).toContain("@${{ needs.construir.outputs.digest_ferramentas }}");
    }
  });

  it("a conferência vem depois da migração pela imagem e antes de test:migracoes", () => {
    const migrar = indiceDoPasso("banco", (passo) => Boolean(passo.run?.includes("db/migrate.ts")));
    const conferir = indiceDoPasso("banco", (passo) =>
      Boolean(passo.run?.includes("scripts/conferir-migracoes-da-imagem.mjs")),
    );
    const testar = indiceDoPasso("banco", (passo) => Boolean(passo.run?.includes("test:migracoes")));
    expect(migrar).toBeGreaterThanOrEqual(0);
    expect(conferir).toBeGreaterThan(migrar);
    expect(testar).toBeGreaterThan(conferir);
  });
});

describe("entrega.yml — publicar promove pelos digests e confere", () => {
  it("publicar espera construir, e2e e banco", () => {
    expect(needs("publicar")).toEqual(expect.arrayContaining(["construir", "e2e", "banco"]));
  });

  it("promove :latest e :ferramentas pelos digests", () => {
    const textoDoJob = JSON.stringify(job("publicar"));
    expect(textoDoJob).toContain("needs.construir.outputs.digest_app");
    expect(textoDoJob).toContain("needs.construir.outputs.digest_ferramentas");
    const criacoes = runs("publicar").filter((run) => run.includes("imagetools create"));
    expect(criacoes.some((run) => run.includes(":latest") && run.includes("@$DIGEST_APP"))).toBe(true);
    expect(criacoes.some((run) => run.includes(":ferramentas") && run.includes("@$DIGEST_FERRAMENTAS"))).toBe(true);
  });

  it("confere que as tags apontam para os digests testados, depois de criá-las", () => {
    const criar = passos("publicar").findLastIndex((passo) => Boolean(passo.run?.includes("imagetools create")));
    const conferir = indiceDoPasso("publicar", (passo) =>
      Boolean(passo.name?.includes("Conferir que as tags apontam para os digests testados")),
    );
    expect(conferir).toBeGreaterThan(criar);
    const run = passos("publicar")[conferir]?.run ?? "";
    expect(run).toContain("imagetools inspect");
    expect(run).toContain("Digest:");
  });
});

describe("entrega.yml — só o banco efêmero", () => {
  it("todo DATABASE_URL aponta para a URL efêmera de teste", () => {
    const visitar = (valor: unknown): void => {
      if (Array.isArray(valor)) {
        valor.forEach(visitar);
        return;
      }
      if (valor && typeof valor === "object") {
        for (const [chave, filho] of Object.entries(valor)) {
          if (chave === "DATABASE_URL") {
            expect(filho).toBe("${{ env.DATABASE_URL_TESTE }}");
          }
          if (chave === "DATABASE_URL_TESTE") {
            expect(filho).toMatch(/^postgresql:\/\/amassa_teste:[^@]+@127\.0\.0\.1:5432\/amassa_teste$/);
          }
          visitar(filho);
        }
      }
    };
    visitar(FLUXO);
    for (const [, valor] of TEXTO.matchAll(/DATABASE_URL="([^"]*)"/g)) {
      expect(valor).toBe("${{ env.DATABASE_URL_TESTE }}");
    }
  });

  it("o texto não cita o alias de migração do npm (01-ARQUITETURA §8)", () => {
    expect(TEXTO).not.toContain("db:" + "migrate");
  });
});

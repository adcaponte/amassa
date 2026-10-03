import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIAS_PARA_TABELA_VELHA,
  efeitoDeTirar,
  seloDaTabela,
  tabelaVigente,
  type AnexoParaVigencia,
} from "@/lib/fornecedores/tabela-vigente";

// A tabela de preços vigente e o selo de 120 dias (06.2-08-PLAN.md; FRN-11, D-09). "Hoje" sempre por
// parâmetro, como dia civil de Brasília.

let contador = 0;
function anexo(dados: Partial<AnexoParaVigencia> & Pick<AnexoParaVigencia, "tipo">): AnexoParaVigencia {
  contador += 1;
  const sequencia = String(contador).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${sequencia}`,
    nome: `anexo ${contador}`,
    valeDesde: null,
    enviadoEm: "2026-09-01",
    criadoEm: "2026-09-01T15:00:00.000Z",
    ...dados,
  };
}

describe("pureza", () => {
  it("lib/fornecedores/tabela-vigente.ts não importa React, Next, o banco nem o driver", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/fornecedores/tabela-vigente.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+"(@\/db|react|next|drizzle-orm|pg)[/"]/);
    expect(fonte).not.toContain("toISOString");
  });

  it("o limite é 120 dias", () => {
    expect(DIAS_PARA_TABELA_VELHA).toBe(120);
  });
});

// ——— Tarefa 1: o <behavior> do traçador. ———

describe("tabelaVigente", () => {
  it("lista vazia → null", () => {
    expect(tabelaVigente([])).toBeNull();
  });

  it("só um catálogo → null", () => {
    expect(tabelaVigente([anexo({ tipo: "catalogo" })])).toBeNull();
  });

  it("tabelas de maio e de agosto → a de agosto", () => {
    const maio = anexo({ tipo: "tabela", valeDesde: "2026-05-01" });
    const agosto = anexo({ tipo: "tabela", valeDesde: "2026-08-01" });
    expect(tabelaVigente([maio, agosto])?.id).toBe(agosto.id);
    expect(tabelaVigente([agosto, maio])?.id).toBe(agosto.id);
  });
});

describe("seloDaTabela", () => {
  it("vale desde 04/06 com hoje 02/10 (120 dias) → recente", () => {
    expect(seloDaTabela({ valeDesde: "2026-06-04", enviadoEm: "2026-06-04" }, "2026-10-02")).toBe("recente");
  });

  it("vale desde 03/06 com hoje 02/10 (121 dias) → velha", () => {
    expect(seloDaTabela({ valeDesde: "2026-06-03", enviadoEm: "2026-10-01" }, "2026-10-02")).toBe("velha");
  });
});

describe("efeitoDeTirar", () => {
  const antiga = anexo({ tipo: "tabela", nome: "Tabela antiga", valeDesde: "2026-03-01" });
  const nova = anexo({ tipo: "tabela", nome: "Tabela nova", valeDesde: "2026-09-01" });
  const catalogo = anexo({ tipo: "catalogo", nome: "Catálogo" });

  it("a vigente com outra tabela → vigente-com-anterior, com o nome da outra", () => {
    expect(efeitoDeTirar([antiga, nova, catalogo], nova.id)).toEqual({
      caso: "vigente-com-anterior",
      anterior: "Tabela antiga",
    });
  });

  it("a única tabela → unica-tabela", () => {
    expect(efeitoDeTirar([nova, catalogo], nova.id)).toEqual({ caso: "unica-tabela" });
  });

  it("um catálogo → comum", () => {
    expect(efeitoDeTirar([antiga, nova, catalogo], catalogo.id)).toEqual({ caso: "comum" });
  });

  it("uma tabela que não é a vigente → comum (nada muda na linha de cima)", () => {
    expect(efeitoDeTirar([antiga, nova], antiga.id)).toEqual({ caso: "comum" });
  });
});

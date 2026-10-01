import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buscaDaUrl,
  escaparPadraoDeBusca,
  quantosDaUrl,
  subLinhaDaPessoa,
} from "@/lib/clientes/lista";

// 05-04-PLAN.md, Tarefa 1: os puros da lista de clientes (Cadastros → Clientes e Agenda → Pessoas).
// A busca vira `like` no banco — `%`, `_` e a barra digitados são escapados aqui, e o termo vai como
// PARÂMETRO (T-05-19).

describe("escaparPadraoDeBusca", () => {
  it("escapa %, _ e a barra invertida", () => {
    expect(escaparPadraoDeBusca("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("texto comum passa igual", () => {
    expect(escaparPadraoDeBusca("João da Silva")).toBe("João da Silva");
    expect(escaparPadraoDeBusca("")).toBe("");
  });

  it("aspas e ponto e vírgula não são do like — passam iguais (o termo é parâmetro, nunca SQL)", () => {
    expect(escaparPadraoDeBusca("o'brien; drop")).toBe("o'brien; drop");
  });
});

describe("quantosDaUrl", () => {
  it("ausente → 50", () => {
    expect(quantosDaUrl(undefined)).toBe(50);
    expect(quantosDaUrl(null)).toBe(50);
  });

  it.each([
    ["50", 50],
    ["100", 100],
    ["500", 500],
  ])("“%s” → %d", (valor, esperado) => {
    expect(quantosDaUrl(valor)).toBe(esperado);
  });

  it.each(["75", "0", "-50", "abc", "", "1e2", " 100", "100.0"])("“%s” → 50", (valor) => {
    expect(quantosDaUrl(valor)).toBe(50);
  });

  it.each(["9999", "1000", "550"])("acima do teto (“%s”) → 500", (valor) => {
    expect(quantosDaUrl(valor)).toBe(500);
  });

  it("lista repetida (?quantos=a&quantos=b) → 50", () => {
    expect(quantosDaUrl(["100", "150"])).toBe(50);
  });
});

describe("buscaDaUrl", () => {
  it("apara e devolve o texto", () => {
    expect(buscaDaUrl("  joao ")).toBe("joao");
  });

  it("ausente, vazio ou lista → ''", () => {
    expect(buscaDaUrl(undefined)).toBe("");
    expect(buscaDaUrl("   ")).toBe("");
    expect(buscaDaUrl(["a", "b"])).toBe("");
  });

  it("corta em 160 caracteres", () => {
    expect(buscaDaUrl("a".repeat(300))).toHaveLength(160);
  });
});

describe("subLinhaDaPessoa", () => {
  it("sem telefone e sem turma → “sem turma fixa”", () => {
    expect(subLinhaDaPessoa({ telefone: null, turmas: [] })).toBe("sem turma fixa");
  });

  it("com telefone → “{telefone} · sem turma fixa”", () => {
    expect(subLinhaDaPessoa({ telefone: "(00) 0000-0000", turmas: [] })).toBe(
      "(00) 0000-0000 · sem turma fixa",
    );
  });

  it("com turmas → “{telefone} · {turma} ({dia}) · …”", () => {
    expect(
      subLinhaDaPessoa({
        telefone: "(00) 0000-0000",
        turmas: [
          { nome: "Torno à noite", dia: "ter" },
          { nome: "Modelagem", dia: "sáb" },
        ],
      }),
    ).toBe("(00) 0000-0000 · Torno à noite (ter) · Modelagem (sáb)");
    expect(subLinhaDaPessoa({ telefone: null, turmas: [{ nome: "Torno", dia: "qua" }] })).toBe("Torno (qua)");
  });

  // 05-07-PLAN.md: as turmas chegam de `turmasPorCliente` já na ordem da tela (segunda → domingo) e
  // com o dia abreviado — a sub-linha mantém a ordem e nunca corta o nome (a linha quebra).
  it("as turmas da Agenda, na ordem recebida, com o nome inteiro", () => {
    const nomeLongo = "Turma ".repeat(20).trim();
    expect(
      subLinhaDaPessoa({
        telefone: null,
        turmas: [
          { nome: "Modelagem", dia: "seg" },
          { nome: nomeLongo, dia: "qui" },
          { nome: "Torno", dia: "dom" },
        ],
      }),
    ).toBe(`Modelagem (seg) · ${nomeLongo} (qui) · Torno (dom)`);
  });
});

describe("lib/clientes/lista.ts é puro", () => {
  it("não importa nada", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/clientes/lista.ts"), "utf8");
    expect(fonte).not.toMatch(/^\s*import\s/m);
  });
});

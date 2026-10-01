import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ordenarInscritos, planejarPresenca, type InscritoParaOrdenar } from "@/lib/agenda/presenca";

// A ação grava o estado DESEJADO (Pattern 2): o "desmarcar" é o cliente mandar `null`; reenviar o
// mesmo pedido nunca inverte a marcação (AGE-08 · idempotency).
describe("planejarPresenca", () => {
  it("de nada para veio", () => {
    expect(planejarPresenca({ presenca: null, direitoARepor: false }, "veio")).toEqual({
      presenca: "veio",
      direitoARepor: false,
    });
  });

  it("sempre devolve o desejado — reenviar veio continua veio", () => {
    expect(planejarPresenca({ presenca: "veio", direitoARepor: false }, "veio")).toEqual({
      presenca: "veio",
      direitoARepor: false,
    });
    expect(planejarPresenca({ presenca: "veio", direitoARepor: false }, null)).toEqual({
      presenca: null,
      direitoARepor: false,
    });
  });

  it("sair de faltou limpa o direito a repor", () => {
    expect(planejarPresenca({ presenca: "faltou", direitoARepor: true }, "veio")).toEqual({
      presenca: "veio",
      direitoARepor: false,
    });
    expect(planejarPresenca({ presenca: "faltou", direitoARepor: true }, null)).toEqual({
      presenca: null,
      direitoARepor: false,
    });
  });

  it("permanecer em faltou mantém o direito que já havia; chegar em faltou começa sem", () => {
    expect(planejarPresenca({ presenca: "faltou", direitoARepor: true }, "faltou")).toEqual({
      presenca: "faltou",
      direitoARepor: true,
    });
    expect(planejarPresenca({ presenca: "veio", direitoARepor: false }, "faltou")).toEqual({
      presenca: "faltou",
      direitoARepor: false,
    });
  });
});

function inscrito(id: string, nome: string, tipo: InscritoParaOrdenar["tipo"]): InscritoParaOrdenar {
  return { id, nome, tipo };
}

describe("ordenarInscritos", () => {
  it("alunos, reposições, experimentais, oficina; por nome sem diferença de acento; desempate por id", () => {
    const ordenados = ordenarInscritos([
      inscrito("6", "Zeca", "oficina"),
      inscrito("5", "Bia", "experimental"),
      inscrito("4", "Ana", "reposicao"),
      inscrito("3", "Élio", "aluno"),
      inscrito("2", "Eduardo", "aluno"),
      inscrito("1", "Davi", "aluno"),
      inscrito("0", "davi", "aluno"),
    ]);
    expect(ordenados.map((pessoa) => pessoa.id)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("não muda a lista recebida", () => {
    const lista = [inscrito("b", "Bia", "aluno"), inscrito("a", "Ana", "aluno")];
    ordenarInscritos(lista);
    expect(lista.map((pessoa) => pessoa.id)).toEqual(["b", "a"]);
  });
});

describe("pureza", () => {
  it("lib/agenda/presenca.ts só importa os tipos da Agenda", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/presenca.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import .* from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    expect(imports.every((origem) => origem === "./tipos")).toBe(true);
  });
});

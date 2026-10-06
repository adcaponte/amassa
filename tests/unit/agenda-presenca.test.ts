import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  dataAindaNaoChegou,
  ordenarInscritos,
  planejarPresenca,
  precisaMarcarPresenca,
  type InscritoParaOrdenar,
} from "@/lib/agenda/presenca";

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

describe("precisaMarcarPresenca", () => {
  // AGE-08: a tag "marcar presença" aparece numa data ANTERIOR a hoje, não cancelada, com alguém sem
  // marcação. Hoje ainda não pede (a aula pode não ter acontecido); a data cancelada nunca pede.
  const HOJE = "2026-10-14";
  const ONTEM = "2026-10-13";

  it("data de ontem com alguém sem marcação pede presença", () => {
    expect(precisaMarcarPresenca({ data: ONTEM, cancelada: false, inscritos: [{ presenca: null }] }, HOJE)).toBe(
      true,
    );
    expect(
      precisaMarcarPresenca(
        { data: "2026-09-30", cancelada: false, inscritos: [{ presenca: "veio" }, { presenca: null }] },
        HOJE,
      ),
    ).toBe(true);
  });

  it("todos marcados (veio ou faltou) não pede", () => {
    expect(
      precisaMarcarPresenca(
        { data: ONTEM, cancelada: false, inscritos: [{ presenca: "veio" }, { presenca: "faltou" }] },
        HOJE,
      ),
    ).toBe(false);
  });

  it("data cancelada nunca pede", () => {
    expect(precisaMarcarPresenca({ data: ONTEM, cancelada: true, inscritos: [{ presenca: null }] }, HOJE)).toBe(
      false,
    );
  });

  it("a data de hoje e as futuras não pedem", () => {
    expect(precisaMarcarPresenca({ data: HOJE, cancelada: false, inscritos: [{ presenca: null }] }, HOJE)).toBe(
      false,
    );
    expect(
      precisaMarcarPresenca({ data: "2026-10-15", cancelada: false, inscritos: [{ presenca: null }] }, HOJE),
    ).toBe(false);
  });

  it("sem inscritos não pede", () => {
    expect(precisaMarcarPresenca({ data: ONTEM, cancelada: false, inscritos: [] }, HOJE)).toBe(false);
  });
});

describe("dataAindaNaoChegou", () => {
  // D-05 (Fase 06.5): marcar presença numa data DEPOIS de hoje avisa e deixa. No dia e antes, nada.
  const HOJE = "2026-10-05";

  it("antes de hoje: já chegou", () => {
    expect(dataAindaNaoChegou("2026-10-04", HOJE)).toBe(false);
    expect(dataAindaNaoChegou("2025-12-31", HOJE)).toBe(false);
  });

  it("no dia: já chegou (a aula de hoje pode estar acontecendo)", () => {
    expect(dataAindaNaoChegou(HOJE, HOJE)).toBe(false);
  });

  it("depois de hoje: ainda não chegou — amanhã, daqui a dois dias e na virada do ano", () => {
    expect(dataAindaNaoChegou("2026-10-06", HOJE)).toBe(true);
    expect(dataAindaNaoChegou("2026-10-07", HOJE)).toBe(true);
    expect(dataAindaNaoChegou("2027-01-01", "2026-12-31")).toBe(true);
  });

  it("compara a data civil, não o texto do mês: 09 antes de 10", () => {
    expect(dataAindaNaoChegou("2026-09-30", "2026-10-01")).toBe(false);
    expect(dataAindaNaoChegou("2026-10-01", "2026-09-30")).toBe(true);
  });
});

describe("pureza", () => {
  it("lib/agenda/presenca.ts só importa os tipos da Agenda", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/presenca.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import .* from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    expect(imports.every((origem) => origem === "./tipos")).toBe(true);
  });
});

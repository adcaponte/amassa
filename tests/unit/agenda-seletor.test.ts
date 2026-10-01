import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { gruposDoSeletor, LIMITE_DO_SELETOR, type PessoaDoSeletor } from "@/lib/agenda/seletor";
import { rotuloDoGrupoDoSeletor } from "@/lib/agenda/textos";

function pessoas(quantas: number): PessoaDoSeletor[] {
  return Array.from({ length: quantas }, (_, indice) => ({
    id: `id-${indice}`,
    nome: `Pessoa ${indice}`,
    telefone: indice % 2 === 0 ? null : `(00) 0000-000${indice % 10}`,
  }));
}

// O seletor de pessoa (UI-D5; backstop E8·overflow): no máximo 8 por grupo, e um aviso de que há
// mais quando há — a faixa de confirmação e "Colocar na lista" ficam sempre alcançáveis.
describe("gruposDoSeletor", () => {
  it("o teto é 8", () => {
    expect(LIMITE_DO_SELETOR).toBe(8);
  });

  it("12 pessoas e ninguém a repor: só o grupo do contexto, com 8 linhas e temMais", () => {
    const grupos = gruposDoSeletor({ aRepor: [], demais: pessoas(12), rotuloDemais: "Inscrever" });
    expect(grupos).toHaveLength(1);
    expect(grupos[0].chave).toBe("demais");
    expect(grupos[0].rotulo).toBe("Inscrever");
    expect(grupos[0].pessoas).toHaveLength(8);
    expect(grupos[0].pessoas.map((pessoa) => pessoa.id)).toEqual(pessoas(8).map((pessoa) => pessoa.id));
    expect(grupos[0].temMais).toBe(true);
  });

  it("exatamente 8 não tem mais; 9 (o que a consulta pede para saber) tem", () => {
    expect(gruposDoSeletor({ aRepor: [], demais: pessoas(8), rotuloDemais: "Pessoas" })[0].temMais).toBe(false);
    expect(gruposDoSeletor({ aRepor: [], demais: pessoas(9), rotuloDemais: "Pessoas" })[0].temMais).toBe(true);
  });

  it("3 pessoas: as 3, sem temMais", () => {
    const grupos = gruposDoSeletor({ aRepor: [], demais: pessoas(3), rotuloDemais: "Inscrever" });
    expect(grupos).toHaveLength(1);
    expect(grupos[0].pessoas).toHaveLength(3);
    expect(grupos[0].temMais).toBe(false);
  });

  it("ninguém: nenhum grupo", () => {
    expect(gruposDoSeletor({ aRepor: [], demais: [], rotuloDemais: "Inscrever" })).toEqual([]);
  });

  it("quem tem aula a repor vem primeiro, com o próprio teto, e não se repete no grupo do contexto", () => {
    const aRepor = pessoas(10).map((cliente) => ({ cliente, saldo: 1 }));
    const demais = [...pessoas(3), { id: "outra", nome: "Outra", telefone: null }];
    const grupos = gruposDoSeletor({ aRepor, demais, rotuloDemais: "Aula experimental / avulsa" });
    expect(grupos.map((grupo) => grupo.chave)).toEqual(["a_repor", "demais"]);
    expect(grupos[0].rotulo).toBe("Tem aula a repor");
    expect(grupos[0].pessoas).toHaveLength(8);
    expect(grupos[0].temMais).toBe(true);
    expect(grupos[1].pessoas.map((pessoa) => pessoa.id)).toEqual(["outra"]);
    expect(grupos[1].temMais).toBe(false);
  });

  it("o grupo a repor carrega o saldo de cada pessoa; o do contexto não", () => {
    const [ana, bia, caio] = pessoas(3);
    const grupos = gruposDoSeletor({
      aRepor: [
        { cliente: ana, saldo: 2 },
        { cliente: bia, saldo: 1 },
      ],
      demais: [caio],
      rotuloDemais: "Inscrever",
    });
    expect(grupos[0].chave).toBe("a_repor");
    expect(grupos[0].pessoas.map((pessoa) => [pessoa.id, pessoa.aRepor])).toEqual([
      [ana.id, 2],
      [bia.id, 1],
    ]);
    expect(grupos[1].pessoas[0].aRepor).toBeUndefined();
  });

  it("saldo 0 não entra no grupo a repor — e a pessoa continua no grupo do contexto", () => {
    const [ana, bia] = pessoas(2);
    const grupos = gruposDoSeletor({
      aRepor: [
        { cliente: ana, saldo: 0 },
        { cliente: bia, saldo: 1 },
      ],
      demais: [ana, bia],
      rotuloDemais: "Inscrever",
    });
    expect(grupos.map((grupo) => grupo.chave)).toEqual(["a_repor", "demais"]);
    expect(grupos[0].pessoas.map((pessoa) => pessoa.id)).toEqual([bia.id]);
    expect(grupos[1].pessoas.map((pessoa) => pessoa.id)).toEqual([ana.id]);
  });

  it("ninguém com saldo: o grupo a repor não aparece (AGE-10 · empty)", () => {
    const [ana] = pessoas(1);
    expect(gruposDoSeletor({ aRepor: [{ cliente: ana, saldo: 0 }], demais: [], rotuloDemais: "Inscrever" })).toEqual(
      [],
    );
  });
});

describe("rotuloDoGrupoDoSeletor", () => {
  it("oficina inscreve, data de turma é experimental/avulsa, sem data são pessoas", () => {
    expect(rotuloDoGrupoDoSeletor("avulsa")).toBe("Inscrever");
    expect(rotuloDoGrupoDoSeletor("turma")).toBe("Aula experimental / avulsa");
    expect(rotuloDoGrupoDoSeletor(null)).toBe("Pessoas");
  });
});

describe("pureza", () => {
  it("lib/agenda/seletor.ts só importa as frases da Agenda", () => {
    const fonte = readFileSync(join(process.cwd(), "lib/agenda/seletor.ts"), "utf8");
    const imports = [...fonte.matchAll(/^import [\s\S]*? from "([^"]+)";$/gm)].map((casamento) => casamento[1]);
    expect(imports.every((origem) => origem === "./textos")).toBe(true);
  });
});

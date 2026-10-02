import { describe, expect, it } from "vitest";

import { areaFinanceira } from "@/db/schema";
import { AREAS_DO_FORNECEDOR, esquemaFornecedor } from "@/lib/fornecedores/esquemas";

// 06.2-01-PLAN.md (FRN-02): o cadastro de fornecedores valida no SERVIDOR com os MESMOS tetos dos
// checks `fornecedores_*_comprimento` da 0028 — nome aparado de 1 a 120 caracteres; whatsapp 40,
// site 300, observações 4000, os outros textos 160; opcionais vazios viram `null`.

function primeiraMensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaFornecedor — o essencial", () => {
  it("apara o nome e deixa todos os opcionais nulos", () => {
    const resultado = esquemaFornecedor.safeParse({ nome: "  Loja X  ", area: "pecas" });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({
      nome: "Loja X",
      area: "pecas",
      vende: null,
      cidadeEntrega: null,
      whatsapp: null,
      pessoaContato: null,
      email: null,
      site: null,
      pagamentoPrazo: null,
      observacoes: null,
    });
  });

  it("nome só com espaços → “Diga o nome do fornecedor.” no campo nome", () => {
    const resultado = esquemaFornecedor.safeParse({ nome: "   ", area: "pecas" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("Diga o nome do fornecedor.");
    expect(resultado.error?.issues[0]?.path).toEqual(["nome"]);
  });
});

// As bordas do FRN-02 (06.2-EDGE-COVERAGE.json): os mesmos números dos checks da 0028, que o
// `test:migracoes` prova no banco (`conferirFornecedores`).
describe("esquemaFornecedor — bordas do nome", () => {
  it.each([
    ["1 caractere", "a"],
    ["120 caracteres", "x".repeat(120)],
    // Encoding: 120 caracteres acentuados são 240 bytes em UTF-8 — o teto conta caracteres.
    ["120 caracteres acentuados", "é".repeat(120)],
    // Pontos de código, como o length() do Postgres: um emoji é 1 (e 2 unidades UTF-16).
    ["120 emojis", "🙂".repeat(120)],
  ])("%s → aceito", (_descricao, nome) => {
    const resultado = esquemaFornecedor.safeParse({ nome, area: "pecas" });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.nome).toBe(nome);
  });

  it("“  Loja  ” vira “Loja”", () => {
    expect(esquemaFornecedor.safeParse({ nome: "  Loja  ", area: "pecas" }).data?.nome).toBe("Loja");
  });

  it("o teto vale depois do trim: 120 caracteres com espaços em volta passam", () => {
    const nome = "x".repeat(120);
    expect(esquemaFornecedor.safeParse({ nome: `   ${nome}  `, area: "pecas" }).data?.nome).toBe(nome);
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["só espaços e quebras", "\t \n"],
  ])("nome %s → “Diga o nome do fornecedor.”", (_descricao, nome) => {
    const resultado = esquemaFornecedor.safeParse({ nome, area: "pecas" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("Diga o nome do fornecedor.");
  });

  it("nome ausente → “Diga o nome do fornecedor.”", () => {
    const resultado = esquemaFornecedor.safeParse({ area: "pecas" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("Diga o nome do fornecedor.");
  });

  it.each([
    ["121 caracteres", "x".repeat(121)],
    ["121 caracteres acentuados", "é".repeat(121)],
  ])("%s → “O nome pode ter até 120 caracteres.”", (_descricao, nome) => {
    const resultado = esquemaFornecedor.safeParse({ nome, area: "pecas" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("O nome pode ter até 120 caracteres.");
    expect(resultado.error?.issues[0]?.path).toEqual(["nome"]);
  });
});

describe("esquemaFornecedor — tetos dos textos opcionais", () => {
  it.each([
    ["observacoes", 4000, "As observações podem ter até 4.000 caracteres."],
    ["whatsapp", 40, "WhatsApp / telefone pode ter até 40 caracteres."],
    ["site", 300, "Site / loja online pode ter até 300 caracteres."],
    ["vende", 160, "O que vende pode ter até 160 caracteres."],
    ["cidadeEntrega", 160, "Cidade / entrega pode ter até 160 caracteres."],
    ["pessoaContato", 160, "Pessoa de contato pode ter até 160 caracteres."],
    ["email", 160, "E-mail pode ter até 160 caracteres."],
    ["pagamentoPrazo", 160, "Pagamento e prazo pode ter até 160 caracteres."],
  ] as const)("%s: %i aceito, um a mais recusado com a frase", (campo, teto, frase) => {
    const noTeto = esquemaFornecedor.safeParse({ nome: "Loja", area: "pecas", [campo]: "a".repeat(teto) });
    expect(noTeto.success).toBe(true);
    expect(noTeto.data?.[campo]).toBe("a".repeat(teto));

    const acima = esquemaFornecedor.safeParse({ nome: "Loja", area: "pecas", [campo]: "a".repeat(teto + 1) });
    expect(acima.success).toBe(false);
    expect(primeiraMensagem(acima)).toBe(frase);
    expect(acima.error?.issues[0]?.path).toEqual([campo]);
  });

  it("os textos opcionais são aparados", () => {
    const resultado = esquemaFornecedor.safeParse({
      nome: "Loja",
      area: "pecas",
      whatsapp: "  (00) 0000-0000  ",
      observacoes: "\n  lote ruim em agosto  \n",
    });
    expect(resultado.data?.whatsapp).toBe("(00) 0000-0000");
    expect(resultado.data?.observacoes).toBe("lote ruim em agosto");
  });
});

describe("esquemaFornecedor — vazios viram null", () => {
  const OPCIONAIS = [
    "vende",
    "cidadeEntrega",
    "whatsapp",
    "pessoaContato",
    "email",
    "site",
    "pagamentoPrazo",
    "observacoes",
  ] as const;

  it.each([[""], ["   "], [null], [undefined]])("todos os opcionais %j → null, nunca string vazia", (valor) => {
    const entrada: Record<string, unknown> = { nome: "Loja", area: "pecas" };
    for (const campo of OPCIONAIS) entrada[campo] = valor;
    const resultado = esquemaFornecedor.safeParse(entrada);
    expect(resultado.success).toBe(true);
    for (const campo of OPCIONAIS) {
      expect(resultado.data?.[campo]).toBeNull();
    }
  });
});

describe("esquemaFornecedor — área", () => {
  it.each(["pecas", "cafeteria", "loja", "espaco", "geral"])("%s é aceita", (area) => {
    expect(esquemaFornecedor.safeParse({ nome: "Loja", area }).success).toBe(true);
  });

  it.each([["fornecedor"], [""], [null], [undefined], ["PECAS"]])("área %j → recusada", (area) => {
    const resultado = esquemaFornecedor.safeParse({ nome: "Loja", area });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["area"]);
    expect(primeiraMensagem(resultado)).toBe("Escolha a área na lista.");
  });
});

describe("AREAS_DO_FORNECEDOR", () => {
  it("é o mesmo conjunto do enum `area_financeira` do banco", () => {
    expect([...AREAS_DO_FORNECEDOR].sort()).toEqual([...areaFinanceira.enumValues].sort());
  });

  it("segue a ordem do protótipo", () => {
    expect(AREAS_DO_FORNECEDOR).toEqual(["pecas", "cafeteria", "loja", "espaco", "geral"]);
  });
});

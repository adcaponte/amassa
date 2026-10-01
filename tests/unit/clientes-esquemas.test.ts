import { describe, expect, it } from "vitest";

import { esquemaCliente, esquemaEdicaoDeCliente } from "@/lib/clientes/esquemas";

// 05-04-PLAN.md, Tarefa 1 (D-01, D-16): o cadastro de pessoas valida no SERVIDOR — nome aparado de 1
// a 160 caracteres (o mesmo teto de `documentos.pessoa_nome`), telefone opcional de até 40, vazio vira
// nulo; `confirmarHomonimo` só pula o aviso de homônimo.

function primeiraMensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message;
}

describe("esquemaCliente", () => {
  it("apara o nome", () => {
    const resultado = esquemaCliente.safeParse({ nome: "  Ana  ", telefone: "" });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.nome).toBe("Ana");
  });

  it.each(["", "   ", "\t \n"])("nome vazio ou só espaços (%j) → “Diga o nome da pessoa.”", (nome) => {
    const resultado = esquemaCliente.safeParse({ nome, telefone: "" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("Diga o nome da pessoa.");
  });

  it("nome ausente → “Diga o nome da pessoa.”", () => {
    const resultado = esquemaCliente.safeParse({ telefone: "" });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("Diga o nome da pessoa.");
  });

  it("160 caracteres passa; 161 → “O nome pode ter até 160 caracteres.”", () => {
    expect(esquemaCliente.safeParse({ nome: "a".repeat(160) }).success).toBe(true);
    const resultado = esquemaCliente.safeParse({ nome: "a".repeat(161) });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("O nome pode ter até 160 caracteres.");
  });

  it("conta pontos de código, como o length() do Postgres (160 emojis passam)", () => {
    expect(esquemaCliente.safeParse({ nome: "🙂".repeat(160) }).success).toBe(true);
  });

  it.each([[""], ["   "], [null], [undefined]])("telefone %j vira null", (telefone) => {
    const resultado = esquemaCliente.safeParse({ nome: "Ana", telefone });
    expect(resultado.success).toBe(true);
    expect(resultado.data?.telefone).toBeNull();
  });

  it("telefone é texto livre, aparado", () => {
    const resultado = esquemaCliente.safeParse({ nome: "Ana", telefone: "  (00) 0000-0000 ramal 2 " });
    expect(resultado.data?.telefone).toBe("(00) 0000-0000 ramal 2");
  });

  it("40 caracteres de telefone passam; 41 → “O telefone pode ter até 40 caracteres.”", () => {
    expect(esquemaCliente.safeParse({ nome: "Ana", telefone: "0".repeat(40) }).success).toBe(true);
    const resultado = esquemaCliente.safeParse({ nome: "Ana", telefone: "0".repeat(41) });
    expect(resultado.success).toBe(false);
    expect(primeiraMensagem(resultado)).toBe("O telefone pode ter até 40 caracteres.");
  });

  it("o erro do telefone aponta para o campo telefone", () => {
    const resultado = esquemaCliente.safeParse({ nome: "Ana", telefone: "0".repeat(41) });
    expect(resultado.error?.issues[0]?.path).toEqual(["telefone"]);
  });

  it("confirmarHomonimo é opcional e booleano", () => {
    expect(esquemaCliente.safeParse({ nome: "Ana" }).data?.confirmarHomonimo).toBeUndefined();
    expect(esquemaCliente.safeParse({ nome: "Ana", confirmarHomonimo: true }).data?.confirmarHomonimo).toBe(
      true,
    );
    expect(esquemaCliente.safeParse({ nome: "Ana", confirmarHomonimo: "sim" }).success).toBe(false);
  });
});

describe("esquemaEdicaoDeCliente", () => {
  const id = "0b3d6c1e-8a4f-4c2b-9d7e-1f2a3b4c5d6e";

  it("exige um id uuid além dos campos do cadastro", () => {
    expect(esquemaEdicaoDeCliente.safeParse({ id, nome: "Ana", telefone: "" }).success).toBe(true);
    const semId = esquemaEdicaoDeCliente.safeParse({ nome: "Ana" });
    expect(semId.success).toBe(false);
    expect(primeiraMensagem(semId)).toBe(
      "Esse cadastro não existe mais — talvez tenha sido removido em outro celular.",
    );
    expect(esquemaEdicaoDeCliente.safeParse({ id: "1; drop table clientes", nome: "Ana" }).success).toBe(
      false,
    );
  });

  it("valida o nome com as mesmas frases", () => {
    const resultado = esquemaEdicaoDeCliente.safeParse({ id, nome: "  " });
    expect(primeiraMensagem(resultado)).toBe("Diga o nome da pessoa.");
  });
});

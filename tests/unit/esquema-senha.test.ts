import { describe, expect, it } from "vitest";

import { esquemaTrocaDeSenha, TAMANHO_MINIMO_SENHA } from "../../lib/auth/esquema-senha";

describe("esquemaTrocaDeSenha", () => {
  it("recusa senha nova com 11 caracteres, com mensagem em português", () => {
    expect(TAMANHO_MINIMO_SENHA).toBe(12);

    const resultado = esquemaTrocaDeSenha.safeParse({
      senhaAtual: "qualquer-senha-atual",
      senhaNova: "a".repeat(11),
      confirmacao: "a".repeat(11),
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(
        "A senha nova precisa ter pelo menos 12 caracteres.",
      );
    }
  });

  it("aceita senha nova com 12 caracteres", () => {
    const resultado = esquemaTrocaDeSenha.safeParse({
      senhaAtual: "qualquer-senha-atual",
      senhaNova: "a".repeat(12),
      confirmacao: "a".repeat(12),
    });

    expect(resultado.success).toBe(true);
  });

  it("aceita uma frase de palavras sem maiúscula, número ou símbolo além do hífen", () => {
    const resultado = esquemaTrocaDeSenha.safeParse({
      senhaAtual: "qualquer-senha-atual",
      senhaNova: "panela-barro-forno-quente",
      confirmacao: "panela-barro-forno-quente",
    });

    expect(resultado.success).toBe(true);
  });

  it("recusa quando a confirmação diverge da senha nova, com mensagem em português", () => {
    const resultado = esquemaTrocaDeSenha.safeParse({
      senhaAtual: "qualquer-senha-atual",
      senhaNova: "panela-barro-forno-quente",
      confirmacao: "panela-barro-forno-diferente",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const problema = resultado.error.issues.find(
        (issue) => issue.path.join(".") === "confirmacao",
      );
      expect(problema?.message).toBe("A confirmação não bate com a senha nova.");
    }
  });

  it("recusa senha atual vazia, com mensagem em português", () => {
    const resultado = esquemaTrocaDeSenha.safeParse({
      senhaAtual: "",
      senhaNova: "panela-barro-forno-quente",
      confirmacao: "panela-barro-forno-quente",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const problema = resultado.error.issues.find(
        (issue) => issue.path.join(".") === "senhaAtual",
      );
      expect(problema?.message).toBe("Digite sua senha atual.");
    }
  });
});

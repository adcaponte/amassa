import { describe, expect, it } from "vitest";

import { avaliarAutorizacao } from "../../lib/auth/exigir-usuario";

// Prova a regra de autorização — a ÚNICA porta do sistema (`02-MODELO-DE-DADOS.md` §0) —
// sem banco e sem sessão, com uma linha de usuário fabricada no mesmo formato que
// `db/schema.ts` produz de verdade (inclusive `senhaHash`, para provar que ele nunca sai
// no objeto devolvido).
const LINHA_ATIVA = {
  id: "3f6a7b8c-1111-4c2a-9f3e-000000000001",
  nome: "Gestora de Teste",
  email: "gestora@exemplo.test",
  senhaHash: "$argon2id$v=19$m=19456,t=2,p=1$segredo-nao-deveria-sair-daqui",
  papel: "gestor" as const,
  ativo: true,
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
};

describe("avaliarAutorizacao", () => {
  it("usuário ativo é devolvido, autorizado", () => {
    const resultado = avaliarAutorizacao(LINHA_ATIVA);

    expect(resultado.autorizado).toBe(true);
    if (resultado.autorizado) {
      expect(resultado.usuario).toEqual({
        id: LINHA_ATIVA.id,
        nome: LINHA_ATIVA.nome,
        email: LINHA_ATIVA.email,
        papel: LINHA_ATIVA.papel,
      });
    }
  });

  it("usuário inativo é recusado", () => {
    const resultado = avaliarAutorizacao({ ...LINHA_ATIVA, ativo: false });

    expect(resultado).toEqual({ autorizado: false, motivo: "usuario-inativo" });
  });

  it("usuário ausente (sem sessão ou e-mail sem conta) é recusado", () => {
    const resultado = avaliarAutorizacao(undefined);

    expect(resultado).toEqual({ autorizado: false, motivo: "usuario-nao-encontrado" });
  });

  it("o objeto devolvido na aceitação não contém a chave do hash de senha", () => {
    const resultado = avaliarAutorizacao(LINHA_ATIVA);

    expect(resultado.autorizado).toBe(true);
    if (resultado.autorizado) {
      expect(resultado.usuario).not.toHaveProperty("senhaHash");
      expect(Object.keys(resultado.usuario)).not.toContain("senhaHash");
    }
  });
});

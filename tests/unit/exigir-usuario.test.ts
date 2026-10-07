import { describe, expect, it } from "vitest";

import { redirect } from "next/navigation";
import { cache } from "react";

import { avaliarAutorizacao, ehFaltaDeSessao } from "../../lib/auth/exigir-usuario";

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

// 06.2-WR-01 (quick 261005-2yu, 05/10/2026): só a falta de sessão — o `redirect()` que
// `exigirUsuario()` lança — é "sessão terminou"; banco fora ou `auth()` lançando é falha do servidor.
describe("ehFaltaDeSessao", () => {
  it("o erro do redirect real de next/navigation é falta de sessão", () => {
    let capturado: unknown;
    try {
      redirect("/gestao/login?sessao=encerrada");
    } catch (erro) {
      capturado = erro;
    }
    expect(capturado).toBeDefined();
    expect(ehFaltaDeSessao(capturado)).toBe(true);
  });

  it("qualquer outro erro não é falta de sessão", () => {
    expect(ehFaltaDeSessao(new Error("connect ECONNREFUSED"))).toBe(false);
    expect(ehFaltaDeSessao({ digest: "NEXT_NOT_FOUND" })).toBe(false);
    expect(ehFaltaDeSessao({ digest: 42 })).toBe(false);
    expect(ehFaltaDeSessao("NEXT_REDIRECT;replace;/x;307;")).toBe(false);
    expect(ehFaltaDeSessao(null)).toBe(false);
    expect(ehFaltaDeSessao(undefined)).toBe(false);
  });

  // 06.5-19 (D-20): as rotas da foto e do PDF do orçamento passaram a decidir por esta função. Um
  // erro do próprio Next que TAMBÉM tem `digest`, mas não é de redirect, nunca vira 401.
  it("um erro com digest que não é de redirect (DYNAMIC_SERVER_USAGE) não é falta de sessão", () => {
    const erroDinamico = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    expect(ehFaltaDeSessao(erroDinamico)).toBe(false);
    expect(ehFaltaDeSessao({ digest: "DYNAMIC_SERVER_USAGE" })).toBe(false);
  });

  it("um Error comum (o banco fora) não é falta de sessão", () => {
    expect(ehFaltaDeSessao(new Error("Connection terminated unexpectedly"))).toBe(false);
    expect(ehFaltaDeSessao(new TypeError("fetch failed"))).toBe(false);
  });

  // 06.5-19 (D-21): `exigirUsuario` passou a ser embrulhada em `cache` do React. A premissa de que as
  // rotas dependem — o `cache` relança o MESMO erro do `redirect()`, com o mesmo `digest` — medida aqui
  // com o `cache` e o `redirect` reais (fora de uma requisição o `cache` só repassa a chamada).
  it("embrulhada em cache do React, a recusa continua sendo falta de sessão", async () => {
    const recusa = cache(async (): Promise<never> => redirect("/gestao/login?sessao=encerrada"));
    let capturado: unknown;
    try {
      await recusa();
    } catch (erro) {
      capturado = erro;
    }
    expect(ehFaltaDeSessao(capturado)).toBe(true);
  });
});

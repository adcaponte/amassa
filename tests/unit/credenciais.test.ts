import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  avaliarCredenciais,
  MENSAGEM_CREDENCIAIS_INVALIDAS,
  type UsuarioParaCredencial,
} from "../../lib/auth/credenciais";

// O hash de referência aqui é só um texto qualquer — o teste não usa argon2 de verdade, só
// confere QUANTAS vezes e CONTRA QUAL hash a função de conferência (injetada) foi chamada.
const HASH_DE_REFERENCIA = "hash-de-referencia-gerado-na-inicializacao";

function usuarioAtivo(senhaHash = "hash-real-do-usuario"): UsuarioParaCredencial {
  return { senhaHash, ativo: true };
}

function usuarioInativo(senhaHash = "hash-real-do-usuario-desativado"): UsuarioParaCredencial {
  return { senhaHash, ativo: false };
}

describe("lib/auth/credenciais.ts importa apenas tipos", () => {
  it("não referencia nenhum módulo de runtime (zero imports — os tipos são locais)", () => {
    const codigo = readFileSync(resolve(process.cwd(), "lib/auth/credenciais.ts"), "utf-8");
    const linhasDeImport = codigo.split("\n").filter((linha) => /^\s*import\s/.test(linha));

    expect(linhasDeImport).toHaveLength(0);
  });

  it("a mensagem única não menciona 'não encontrado' nem 'inexistente'", () => {
    const codigo = readFileSync(resolve(process.cwd(), "lib/auth/credenciais.ts"), "utf-8");
    expect((codigo.match(/não encontrado/g) ?? []).length).toBe(0);
    expect((codigo.match(/inexistente/g) ?? []).length).toBe(0);
  });
});

describe("avaliarCredenciais", () => {
  it("usuário existe, ativo, senha confere: devolve o usuário autenticado", async () => {
    const conferirHash = vi.fn().mockResolvedValue(true);
    const usuario = usuarioAtivo();

    const resultado = await avaliarCredenciais(usuario, "senha-certa", conferirHash, HASH_DE_REFERENCIA);

    expect(resultado).toEqual({ autenticado: true, usuario });
    expect(conferirHash).toHaveBeenCalledTimes(1);
    expect(conferirHash).toHaveBeenCalledWith(usuario.senhaHash, "senha-certa");
  });

  it("usuário existe, ativo, senha não confere: recusa com a constante de mensagem", async () => {
    const conferirHash = vi.fn().mockResolvedValue(false);
    const usuario = usuarioAtivo();

    const resultado = await avaliarCredenciais(usuario, "senha-errada", conferirHash, HASH_DE_REFERENCIA);

    expect(resultado).toEqual({ autenticado: false, mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS });
  });

  it("usuário não existe: recusa com a MESMA constante, e a conferência de hash roda uma vez contra o hash de referência", async () => {
    const conferirHash = vi.fn().mockResolvedValue(false);

    const resultado = await avaliarCredenciais(undefined, "qualquer-senha", conferirHash, HASH_DE_REFERENCIA);

    expect(resultado).toEqual({ autenticado: false, mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS });
    expect(conferirHash).toHaveBeenCalledTimes(1);
    expect(conferirHash).toHaveBeenCalledWith(HASH_DE_REFERENCIA, "qualquer-senha");
  });

  it("usuário existe mas está desativado: recusa com a mesma constante, e a conferência de hash também roda", async () => {
    const conferirHash = vi.fn().mockResolvedValue(true); // mesmo com a senha "certa"
    const usuario = usuarioInativo();

    const resultado = await avaliarCredenciais(usuario, "senha-certa", conferirHash, HASH_DE_REFERENCIA);

    expect(resultado).toEqual({ autenticado: false, mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS });
    expect(conferirHash).toHaveBeenCalledTimes(1);
  });

  it("a conferência de hash lança (hash corrompido): recusa com a mesma constante, sem vazar o erro", async () => {
    const conferirHash = vi.fn().mockRejectedValue(new Error("hash malformado no formato PHC"));
    const usuario = usuarioAtivo();

    const resultado = await avaliarCredenciais(usuario, "senha-qualquer", conferirHash, HASH_DE_REFERENCIA);

    expect(resultado).toEqual({ autenticado: false, mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS });
  });

  it("os quatro caminhos de recusa devolvem objetos indistinguíveis (mesmo texto, mesma forma)", async () => {
    const senhaErrada = await avaliarCredenciais(
      usuarioAtivo(),
      "errada",
      vi.fn().mockResolvedValue(false),
      HASH_DE_REFERENCIA,
    );
    const semUsuario = await avaliarCredenciais(
      undefined,
      "qualquer",
      vi.fn().mockResolvedValue(false),
      HASH_DE_REFERENCIA,
    );
    const desativado = await avaliarCredenciais(
      usuarioInativo(),
      "qualquer",
      vi.fn().mockResolvedValue(true),
      HASH_DE_REFERENCIA,
    );
    const hashLancou = await avaliarCredenciais(
      usuarioAtivo(),
      "qualquer",
      vi.fn().mockRejectedValue(new Error("corrompido")),
      HASH_DE_REFERENCIA,
    );

    expect(senhaErrada).toEqual(semUsuario);
    expect(semUsuario).toEqual(desativado);
    expect(desativado).toEqual(hashLancou);
  });
});

// Envoltório do módulo nativo de hash. Roda só em Node — nunca é importado por
// `lib/auth/auth.config.ts` nem por `middleware.ts`, porque `@node-rs/argon2` é um binário
// nativo que não carrega no runtime Edge (ver `01-ARQUITETURA.md` §4).
import { randomInt } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";

// Sem caracteres visualmente ambíguos (0/O, 1/l/I) — a senha é lida uma única vez, de uma
// tela de terminal, e digitada de cabeça pela pessoa que a recebe.
const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TAMANHO_SENHA = 20;

export function gerarSenhaForte(): string {
  let senha = "";
  for (let i = 0; i < TAMANHO_SENHA; i++) {
    senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
  }
  return senha;
}

export async function gerarHash(senha: string): Promise<string> {
  // `algorithm` não é passado de propósito: `Algorithm` é um enum ambiente do
  // `@node-rs/argon2`, inacessível com `isolatedModules` (tsconfig.json). O padrão de
  // `hash()` sem essa opção já é argon2id — confirmado empiricamente pelo prefixo
  // `$argon2id$` do hash resultante.
  return hash(senha);
}

export async function conferirHash(hashArmazenado: string, senha: string): Promise<boolean> {
  // O algoritmo, o custo de memória e o sal já estão codificados no próprio hash (formato
  // PHC) — `verify` os lê de lá, sem precisar deles como opção aqui.
  return verify(hashArmazenado, senha);
}

"use server";

// Arquivo separado de `lib/auth/acoes.ts` de propósito: aquele arquivo documenta
// explicitamente que NÃO toca o banco, e esta ação toca (`UPDATE` em `usuarios.senha_hash`).
//
// Troca voluntária, NÃO obrigatória (BRIEF-NOTURNO.md, Lote C, DECIDIDO). Sem coluna
// `senha_provisoria`, sem migração, sem forçar troca no primeiro acesso — é só um `UPDATE` na
// coluna que já existe.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { conferirHash, gerarHash } from "@/lib/auth/senha";

import { esquemaTrocaDeSenha } from "./esquema-senha";

export type ResultadoDeTrocaDeSenha = { ok: true } | { ok: false; erro: string };

export async function trocarSenha(entradaBruta: unknown): Promise<ResultadoDeTrocaDeSenha> {
  // PRIMEIRA instrução do corpo — regra do CLAUDE.md, verificada por `npm run verificar-acoes`
  // por árvore sintática. O id do usuário vem da sessão, nunca do cliente: o schema Zod abaixo
  // não tem campo de id, e não deve ganhar um — troca só a própria senha.
  const usuarioAtual = await exigirUsuario();

  const resultado = esquemaTrocaDeSenha.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: resultado.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const dados = resultado.data;

  // `exigirUsuario()` devolve o usuário SEM o hash, de propósito — precisa ser lido de novo
  // aqui, pelo id da sessão.
  const linhas = await db
    .select({ senhaHash: usuarios.senhaHash })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioAtual.id))
    .limit(1);
  const senhaHashAtual = linhas[0]?.senhaHash;

  if (!senhaHashAtual || !(await conferirHash(senhaHashAtual, dados.senhaAtual))) {
    return { ok: false, erro: "A senha atual não confere. Confira e tente de novo." };
  }

  await db
    .update(usuarios)
    .set({ senhaHash: await gerarHash(dados.senhaNova) })
    .where(eq(usuarios.id, usuarioAtual.id));

  return { ok: true };
}

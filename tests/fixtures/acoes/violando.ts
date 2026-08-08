// Fixture de scripts/verificar-acoes.mjs — nunca importada por código de produção. Existe só
// para provar que o portão REPROVA uma ação que toca o banco antes de chamar
// exigirUsuario() — e que a mensagem cita o nome da função.
"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

export async function listarNomesSemAutorizar() {
  const linhas = await db
    .select({ nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.ativo, true));
  const usuarioAtual = await exigirUsuario();
  return { linhas, usuarioAtual };
}

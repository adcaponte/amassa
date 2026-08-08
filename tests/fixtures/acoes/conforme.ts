// Fixture de scripts/verificar-acoes.mjs — nunca importada por código de produção. Existe só
// para provar que o portão APROVA uma ação que chama exigirUsuario() como primeira instrução
// do corpo.
"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

export async function listarNomesDeUsuarios() {
  const usuarioAtual = await exigirUsuario();
  return db
    .select({ nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioAtual.id));
}

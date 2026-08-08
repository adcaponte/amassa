// Fixture de scripts/verificar-acoes.mjs — nunca importada por código de produção. Existe só
// para provar que o portão NÃO cobra um arquivo de ações que não importa o cliente do
// banco — a fronteira deliberada que impede o portão de virar ruído e acabar desligado.
"use server";

import { redirect } from "next/navigation";

export async function irParaInicio() {
  redirect("/");
}

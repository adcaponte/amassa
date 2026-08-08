// Fixture de scripts/verificar-acoes.mjs — nunca importada por código de produção. Prova a
// correção do CR-01: esta ação NÃO importa `@/db` diretamente, só o módulo de apoio
// apoio-alcanca-banco.ts — mas alcança o banco por transitividade, e o portão precisa
// reprová-la por não chamar exigirUsuario() como primeira instrução do corpo.
"use server";

import { buscarNomesDeUsuarios } from "./apoio-alcanca-banco";

export async function listarNomesPorHelperSemAutorizar() {
  return buscarNomesDeUsuarios();
}

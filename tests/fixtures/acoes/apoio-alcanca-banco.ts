// Fixture de scripts/verificar-acoes.mjs — nunca importada por código de produção. Módulo de
// apoio que alcança o banco DIRETAMENTE (importa `@/db`), usado por violando-transitivo.ts
// para provar que o portão segue o alcance por transitividade (CR-01): um arquivo de ação que
// só importa este helper, e não `@/db` diretamente, ainda precisa ser cobrado.
import { db } from "@/db";
import { usuarios } from "@/db/schema";

export async function buscarNomesDeUsuarios() {
  return db.select({ nome: usuarios.nome }).from(usuarios);
}

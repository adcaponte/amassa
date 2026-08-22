// Fixture de tests/unit/leituras-ordenadas.test.ts — nunca importada por código de produção
// nem chamada por ninguém. Existe só para o caminhador de árvore sintática LER: prova que o
// portão APROVA uma leitura de `encomenda_etapas` que termina em
// `.orderBy(asc(encomendaEtapas.ordem))`, o padrão correto que este plano leva a
// `lib/encomendas/acoes.ts`.
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { encomendaEtapas } from "@/db/schema";

export async function consultaComOrdenacao(encomendaId: string) {
  return db
    .select({
      etapa: encomendaEtapas.etapa,
      dias: encomendaEtapas.dias,
      esperaDias: encomendaEtapas.esperaDias,
    })
    .from(encomendaEtapas)
    .where(eq(encomendaEtapas.encomendaId, encomendaId))
    .orderBy(asc(encomendaEtapas.ordem));
}

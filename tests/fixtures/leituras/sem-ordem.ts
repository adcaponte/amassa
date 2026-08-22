// Fixture de tests/unit/leituras-ordenadas.test.ts — nunca importada por código de produção
// nem chamada por ninguém. Existe só para o caminhador de árvore sintática LER: prova que o
// portão REPROVA uma leitura de `encomenda_etapas` sem `.orderBy(asc(encomendaEtapas.ordem))`
// — a mesma forma exata do defeito do gap 16 da verificação, antes da correção de
// `lib/encomendas/acoes.ts`.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { encomendaEtapas } from "@/db/schema";

export async function consultaSemOrdenacao(encomendaId: string) {
  return db
    .select({
      etapa: encomendaEtapas.etapa,
      dias: encomendaEtapas.dias,
      esperaDias: encomendaEtapas.esperaDias,
    })
    .from(encomendaEtapas)
    .where(eq(encomendaEtapas.encomendaId, encomendaId));
}

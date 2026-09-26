// Numeração `ORC-{ano}-{sequencial}` (D-05/D-06/ORC-12) — padrão documentado em
// `.planning/phases/04.5-financeiro-parte-2/04.5-RESEARCH.md`, "Pattern 1: Tabela contadora com
// upsert transacional". `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` dentro do Postgres
// bloqueia a linha do ano até a transação chamadora commitar ou reverter (postgresql.org,
// "Explicit Locking") — duas transações concorrentes pedindo o sequencial do MESMO ano nunca
// recebem o mesmo número, e nenhuma delas precisa de `SELECT ... FOR UPDATE` explícito.
//
// Nunca uma contagem lida antes de gravar (o maior valor existente, mais um): lido fora de um
// lock, isso tem janela de corrida clássica — duas requisições simultâneas leem o mesmo valor,
// as duas tentam gravar o mesmo número.

import { sql } from "drizzle-orm";

import type { db } from "@/db";
import { contadoresOrcamento } from "@/db/schema";

// O tipo da transação do Drizzle, derivado do próprio `db` (nunca importado de
// `drizzle-orm/node-postgres`, que exigiria conhecer o tipo genérico exato usado por `db/index.ts`).
export type TransacaoDoBanco = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Só existe para ser chamada DENTRO de `db.transaction(async (tx) => ...)` — chamar com `db`
// direto (fora de uma transação) é uso errado: é a REVERSÃO da transação que garante D-06 (um
// número que nunca chegou a ser de um orçamento de verdade nunca vira um buraco — se a gravação
// do orçamento falhar depois deste incremento, o Postgres desfaz o incremento junto).
export async function proximoSequencialDeOrcamento(tx: TransacaoDoBanco, ano: number): Promise<number> {
  const [contador] = await tx
    .insert(contadoresOrcamento)
    .values({ ano, ultimoNumero: 1 })
    .onConflictDoUpdate({
      target: contadoresOrcamento.ano,
      set: { ultimoNumero: sql`${contadoresOrcamento.ultimoNumero} + 1` },
    })
    .returning({ ultimoNumero: contadoresOrcamento.ultimoNumero });

  return contador.ultimoNumero;
}

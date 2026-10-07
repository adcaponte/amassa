import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { correcoesDeDocumento } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOTIVO =
  "correcoes_de_documento ou o índice parcial das contas fixas não estão no banco — a migração 0031 foi aplicada?";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o `matcher`
// de `middleware.ts` só alcança `/gestao`. Molde `/api/health/queimas`. Existe para duas coisas:
//
// 1. A conferência de fora do Roteiro 22 (`docs/operacao/22-migracao-polimento.md`, plano 06.5-11):
//    depois do `implantar` e do `db:migrate`, um `curl` de fora prova que o app PUBLICADO enxerga a
//    migração 0031 — 200 só se a tabela `correcoes_de_documento` existe E o índice único parcial
//    `documentos_conta_fixa_mes_ativo_uk` existe (as duas coisas nascem na 0031). Antes do deploy a
//    rota não existe (404); entre o fim do `implantar` e o `db:migrate` ela fica 503 — o sinal de que
//    a migração ainda falta.
// 2. O monitoramento externo: se alguém restaurar um backup anterior à 0031, o “Corrigir” quebra — e
//    esta rota fica 503 no mesmo instante.
//
// T-06.5-27: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). A leitura da tabela pede uma
// linha qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantas correções
// existem nem o nome do banco; o texto do erro do Postgres vai só ao log do servidor.
export async function GET() {
  try {
    await db.select({ id: correcoesDeDocumento.id }).from(correcoesDeDocumento).limit(1);
    const indice = await db.execute(
      sql`select 1 from pg_indexes where schemaname = 'public' and indexname = 'documentos_conta_fixa_mes_ativo_uk'`,
    );
    if (indice.rows.length === 0) {
      console.error(`Falha ao conferir a estrutura do Polimento: ${MOTIVO}`);
      return NextResponse.json({ status: "erro", motivo: MOTIVO }, { status: 503 });
    }
  } catch (erro) {
    console.error(`Falha ao conferir a estrutura do Polimento: ${MOTIVO}`, erro);
    return NextResponse.json({ status: "erro", motivo: MOTIVO }, { status: 503 });
  }

  return NextResponse.json({ status: "ok" });
}

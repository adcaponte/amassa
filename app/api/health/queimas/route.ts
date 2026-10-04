import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { itensCatalogo, queimaContagens, queimaVendas } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOTIVO =
  "queima_contagens, queima_vendas ou os itens das Queimas não estão no banco — a migração 0030 foi aplicada?";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o `matcher`
// de `middleware.ts` só alcança `/gestao`. Molde `/api/health/lembretes`. Existe para duas coisas:
//
// 1. A conferência de fora do Roteiro 21 (`docs/operacao/21-migracao-queimas.md`, plano 06.4-07):
//    depois do `implantar` e do `db:migrate`, um `curl` de fora prova que o app PUBLICADO enxerga a
//    migração 0030 — 200 só se a coluna `saiu_cheio` de `queima_contagens` e a `quantidade_p` de
//    `queima_vendas` existem E o item do sistema `queima_externa_p` foi semeado (as três coisas
//    nascem na 0030). Entre o fim do `implantar` e o `db:migrate` ela fica 503: é o sinal de que a
//    migração ainda falta.
// 2. O monitoramento externo: se alguém restaurar um backup anterior à 0030, as Queimas quebram — e
//    esta rota fica 503 no mesmo instante.
//
// T-06.4-08: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). As consultas pedem uma linha
// qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantas queimas foram
// contadas, quanto se vendeu, nem o nome do banco.
export async function GET() {
  try {
    await db.select({ saiuCheio: queimaContagens.saiuCheio }).from(queimaContagens).limit(1);
    await db.select({ quantidadeP: queimaVendas.quantidadeP }).from(queimaVendas).limit(1);
    const [item] = await db
      .select({ id: itensCatalogo.id })
      .from(itensCatalogo)
      .where(eq(itensCatalogo.chaveDoSistema, "queima_externa_p"))
      .limit(1);
    if (!item) {
      console.error(`Falha ao conferir a estrutura das Queimas: ${MOTIVO}`);
      return NextResponse.json({ status: "erro", motivo: MOTIVO }, { status: 503 });
    }
  } catch (erro) {
    console.error(`Falha ao conferir a estrutura das Queimas: ${MOTIVO}`, erro);
    return NextResponse.json({ status: "erro", motivo: MOTIVO }, { status: 503 });
  }

  return NextResponse.json({ status: "ok" });
}

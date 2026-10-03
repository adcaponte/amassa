import { NextResponse } from "next/server";
import { db } from "@/db";
import { lembretes } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o
// `matcher` de `middleware.ts` só alcança `/gestao`. Existe para duas coisas:
//
// 1. A conferência de fora do Roteiro 20 (`docs/operacao/20-migracao-lembretes.md`, plano 06.3-06):
//    depois do `implantar` e do `db:migrate`, um `curl` de fora prova que o app PUBLICADO enxerga a
//    migração 0029 — 200 só se a coluna `feito_por` da tabela `lembretes` existe, e as duas nascem
//    na 0029. Entre o fim do `implantar` e o `db:migrate` ela fica 503: é o sinal de que a migração
//    ainda falta — e, nessa janela, a coluna "Para fazer" do Início mostra o próprio erro enquanto a
//    folha da casa segue funcionando (o `Promise.allSettled` do plano 06.3-01).
// 2. O monitoramento externo, no molde de `/api/health/fornecedores`: se alguém restaurar um backup
//    anterior à 0029, os Lembretes quebram — e esta rota fica 503 no mesmo instante.
//
// T-06.3-08: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). A consulta pede uma linha
// qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantos lembretes
// existem, o que dizem, para quem, para quando, nem o nome do banco. A rota é pública, e o monitor
// só precisa de "ok" ou "erro".
export async function GET() {
  try {
    await db.select({ feitoPor: lembretes.feitoPor }).from(lembretes).limit(1);
  } catch (erro) {
    console.error("Falha ao conferir a estrutura dos Lembretes:", erro);
    return NextResponse.json(
      {
        status: "erro",
        motivo: "O banco não tem a estrutura dos Lembretes — a migração 0029 foi aplicada?",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

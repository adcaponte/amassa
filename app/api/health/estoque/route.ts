import { NextResponse } from "next/server";
import { db } from "@/db";
import { itensCatalogo, movimentacoesEstoque } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o
// `matcher` de `middleware.ts` só alcança `/gestao`. Existe para duas coisas:
//
// 1. O Passo 7 do Roteiro 15 (`docs/operacao/15-migracao-estoque.md`): depois do `push` da Fase
//    06, um `curl` de fora prova que o app PUBLICADO enxerga a migração 0023 — 200 só se a tabela
//    do livro e as colunas novas do catálogo existem. É a conferência DEPOIS do código; a de ANTES
//    é o SQL do Passo 5, porque antes do `push` esta rota ainda nem existe no ar.
// 2. O monitoramento externo, no molde de `/api/health/backup`: se alguém restaurar um backup
//    anterior à 0023, toda venda quebra (D-33) — e esta rota fica 503 no mesmo instante.
//
// T-06-49: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). As duas consultas pedem uma
// linha qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantos
// materiais existem, quanto há em estoque, quanto vale, nem o nome do banco. A rota é pública, e o
// monitor só precisa de "ok" ou "erro".
export async function GET() {
  try {
    await db
      .select({ id: movimentacoesEstoque.id })
      .from(movimentacoesEstoque)
      .limit(1);
    await db
      .select({
        minimo: itensCatalogo.estoqueMinimoMilesimos,
        ativo: itensCatalogo.ativo,
      })
      .from(itensCatalogo)
      .limit(1);
  } catch (erro) {
    console.error("Falha ao conferir a estrutura do Estoque:", erro);
    return NextResponse.json(
      {
        status: "erro",
        motivo: "O banco não tem a estrutura do Estoque — a migração 0023 foi aplicada?",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

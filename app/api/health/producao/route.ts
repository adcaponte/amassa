import { NextResponse } from "next/server";
import { db } from "@/db";
import { movimentacoesEstoque, ordensProducao } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o
// `matcher` de `middleware.ts` só alcança `/gestao`. Existe para duas coisas:
//
// 1. O Passo 6 do Roteiro 16 (`docs/operacao/16-migracao-producao.md`): depois do `implantar` e do
//    `db:migrate`, um `curl` de fora prova que o app PUBLICADO enxerga as migrações 0024 e 0025 —
//    200 só se a tabela das ordens e a coluna `material_da_ordem` do livro do Estoque existem.
//    Entre o fim do `implantar` e o `db:migrate` (a janela do D-09) ela fica 503: é o sinal de que
//    a migração ainda falta. A prova de dentro é o SQL do Passo 7.
// 2. O monitoramento externo, no molde de `/api/health/estoque`: se alguém restaurar um backup
//    anterior à 0024, a Produção, a aprovação de orçamento e a baixa pela ordem quebram — e esta
//    rota fica 503 no mesmo instante.
//
// T-06.1-56: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). As duas consultas pedem uma
// linha qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantas ordens
// existem, de quem são, quanto valem, nem o nome do banco. A rota é pública, e o monitor só
// precisa de "ok" ou "erro".
export async function GET() {
  try {
    await db.select({ id: ordensProducao.id }).from(ordensProducao).limit(1);
    await db
      .select({ material: movimentacoesEstoque.materialDaOrdem })
      .from(movimentacoesEstoque)
      .limit(1);
  } catch (erro) {
    console.error("Falha ao conferir a estrutura da Produção:", erro);
    return NextResponse.json(
      {
        status: "erro",
        motivo: "O banco não tem a estrutura da Produção — a migração 0024 foi aplicada?",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { clientes, documentos, movimentacoesEstoque } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o
// `matcher` de `middleware.ts` só alcança `/gestao`. Existe para duas coisas:
//
// 1. O Passo 6 do Roteiro 17 (`docs/operacao/17-migracao-agenda.md`): depois do `implantar` e do
//    `db:migrate`, um `curl` de fora prova que o app PUBLICADO enxerga a migração 0026 — 200 só se
//    a tabela de clientes, a coluna `cliente_id` das vendas e a coluna `uso_livre_id` do livro do
//    Estoque existem, e as três nascem na 0026. Entre o fim do `implantar` e o `db:migrate` (a
//    janela da D-15) ela fica 503: é o sinal de que a migração ainda falta — e, nessa janela, toda
//    venda e toda baixa falham, porque o `insert` do Drizzle lista as duas colunas novas. A prova
//    de dentro é o SQL do Passo 7.
// 2. O monitoramento externo, no molde de `/api/health/producao`: se alguém restaurar um backup
//    anterior à 0026, a Agenda, o Caixa e a baixa de estoque quebram — e esta rota fica 503 no
//    mesmo instante.
//
// T-05-74: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). As três consultas pedem uma
// linha qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantas pessoas
// estão cadastradas, quem são, quanto devem, nem o nome do banco. A rota é pública, e o monitor só
// precisa de "ok" ou "erro".
export async function GET() {
  try {
    await db.select({ id: clientes.id }).from(clientes).limit(1);
    await db.select({ cliente: documentos.clienteId }).from(documentos).limit(1);
    await db
      .select({ usoLivre: movimentacoesEstoque.usoLivreId })
      .from(movimentacoesEstoque)
      .limit(1);
  } catch (erro) {
    console.error("Falha ao conferir a estrutura da Agenda:", erro);
    return NextResponse.json(
      {
        status: "erro",
        motivo: "O banco não tem a estrutura da Agenda — a migração 0026 foi aplicada?",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

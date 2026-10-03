import { NextResponse } from "next/server";
import { db } from "@/db";
import { documentos, execucoesBackup, fornecedorAnexos } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e o
// `matcher` de `middleware.ts` só alcança `/gestao`. Existe para duas coisas:
//
// 1. O Passo 8 do Roteiro 19 (`docs/operacao/19-migracao-fornecedores.md`): depois do `implantar` e
//    do `db:migrate`, um `curl` de fora prova que o app PUBLICADO enxerga a migração 0028 — 200 só
//    se a tabela dos anexos dos fornecedores, a coluna `fornecedor_id` dos documentos e a coluna
//    `anexos_destino_externo_ok` do registro de backups existem, e as três nascem na 0028. Entre o
//    fim do `implantar` e o `db:migrate` (a janela do Pitfall 12 da pesquisa da 06.2) ela fica 503:
//    é o sinal de que a migração ainda falta — e, nessa janela, todo `insert` em `documentos`
//    falha (vendas, despesas, Agenda, contas fixas), porque o Drizzle lista a coluna nova. A prova
//    de dentro é o SQL do Passo 8.
// 2. O monitoramento externo, no molde de `/api/health/agenda`: se alguém restaurar um backup
//    anterior à 0028, o Caixa, as despesas e os Fornecedores quebram — e esta rota fica 503 no
//    mesmo instante.
//
// T-06.2-45: o corpo é SÓ `{ status }` (e um `motivo` fixo no erro). As três consultas pedem uma
// linha qualquer com `limit(1)` e o resultado é descartado — a resposta nunca diz quantos
// fornecedores ou anexos existem, quem são, quanto se gastou com eles, nem o nome do banco. A rota
// é pública, e o monitor só precisa de "ok" ou "erro".
export async function GET() {
  try {
    await db.select({ arquivo: fornecedorAnexos.arquivoCaminho }).from(fornecedorAnexos).limit(1);
    await db.select({ fornecedor: documentos.fornecedorId }).from(documentos).limit(1);
    await db
      .select({ externo: execucoesBackup.anexosDestinoExternoOk })
      .from(execucoesBackup)
      .limit(1);
  } catch (erro) {
    console.error("Falha ao conferir a estrutura dos Fornecedores:", erro);
    return NextResponse.json(
      {
        status: "erro",
        motivo: "O banco não tem a estrutura dos Fornecedores — a migração 0028 foi aplicada?",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

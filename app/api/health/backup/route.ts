import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { execucoesBackup } from "@/db/schema";
import { decidirFrescorDoBackup, type ExecucaoBackup } from "@/lib/backup/frescor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota pública — `lib/auth/rotas-publicas.ts` já libera todo o prefixo `/api/health`, e a
// spec confirma que ela responde sem sessão (é o que permite um monitor externo vigiá-la a
// cada cinco minutos, 01-ARQUITETURA.md §9).
//
// A tabela `execucoes_backup` é a única fonte da resposta — nunca inspeciona arquivo, porque
// o dump é escrito por outro contêiner (o host, via cron) e porque assim o envio externo
// também entra na conta, não só a geração local. A decisão de frescor vive inteiramente em
// `lib/backup/frescor.ts`; esta rota só faz a consulta e delega.
//
// T-02a-28: o corpo da resposta traz só status/motivo/instante/idade — nunca caminho de
// arquivo, nome do destino externo, nome de banco ou o tamanho absoluto em bytes, que
// revelaria o volume de dados do ateliê a qualquer pessoa na internet.
export async function GET() {
  let ultimaExecucao: ExecucaoBackup | null;

  try {
    const linhas = await db
      .select({
        quando: execucoesBackup.quando,
        sucesso: execucoesBackup.sucesso,
        destinoExternoOk: execucoesBackup.destinoExternoOk,
        mensagem: execucoesBackup.mensagem,
      })
      .from(execucoesBackup)
      .orderBy(desc(execucoesBackup.quando))
      .limit(1);
    ultimaExecucao = linhas[0] ?? null;
  } catch (erro) {
    console.error("Falha ao consultar execucoes_backup:", erro);
    // Indistinguível de "nenhum backup registrado" para o monitor externo — e é o
    // comportamento certo: os dois casos exigem alguém olhando.
    return NextResponse.json(
      {
        status: "erro",
        motivo: "Não foi possível ler o registro de backups.",
        ultimoBackupEm: null,
        idadeEmHoras: null,
      },
      { status: 503 },
    );
  }

  const decisao = decidirFrescorDoBackup(ultimaExecucao, new Date());

  return NextResponse.json(
    {
      status: decisao.status,
      motivo: decisao.motivo,
      ultimoBackupEm: decisao.ultimoBackupEm,
      idadeEmHoras: decisao.idadeEmHoras,
    },
    { status: decisao.http },
  );
}

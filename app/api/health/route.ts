import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { verificacaoInfraestrutura } from "@/db/schema";
import { interpretarSaudeDoBanco } from "@/lib/saude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Consulta real ao Postgres — não responde 200 sem tocar no banco (critério INFRA-03).
// A decisão de status/HTTP vive no módulo puro `lib/saude.ts`; esta rota só executa a
// consulta e monta a resposta a partir do resultado.
export async function GET() {
  let consultaFuncionou = true;

  try {
    await db.select({ total: count() }).from(verificacaoInfraestrutura);
  } catch (erro) {
    console.error("Falha na consulta de saúde do banco:", erro);
    consultaFuncionou = false;
  }

  const { status, banco, http } = interpretarSaudeDoBanco(consultaFuncionou);
  return NextResponse.json({ status, banco }, { status: http });
}

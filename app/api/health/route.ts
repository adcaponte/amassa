import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { verificacaoInfraestrutura } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Consulta real ao Postgres — não responde 200 sem tocar no banco (critério INFRA-03).
export async function GET() {
  try {
    await db.select({ total: count() }).from(verificacaoInfraestrutura);
    return NextResponse.json({ status: "ok", banco: "ok" }, { status: 200 });
  } catch (erro) {
    console.error("Falha na consulta de saúde do banco:", erro);
    return NextResponse.json({ status: "erro", banco: "erro" }, { status: 503 });
  }
}

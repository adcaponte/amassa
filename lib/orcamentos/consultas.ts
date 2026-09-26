// Leituras do módulo Orçamentos. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página; `lib/orcamentos/acoes.ts` fica só com escrita
// (mesmo molde de `lib/financeiro/consultas.ts`).
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { orcamentos } from "@/db/schema";

export type OrcamentoParaLista = {
  id: string;
  ano: number;
  sequencial: number;
  revisao: number;
  status: (typeof orcamentos.status.enumValues)[number];
  clienteNome: string | null;
  titulo: string | null;
  data: string;
  validadeDias: number;
};

// Ordenada por `ano desc, sequencial desc` — a mesma ordem do protótipo (o mais recente primeiro
// é sempre `ORC-{ano mais alto}-{sequencial mais alto}`). Seleção por coluna, nunca `select()`
// solto (CLAUDE.md/molde do projeto).
export async function listarOrcamentos(): Promise<OrcamentoParaLista[]> {
  return db
    .select({
      id: orcamentos.id,
      ano: orcamentos.ano,
      sequencial: orcamentos.sequencial,
      revisao: orcamentos.revisao,
      status: orcamentos.status,
      clienteNome: orcamentos.clienteNome,
      titulo: orcamentos.titulo,
      data: orcamentos.data,
      validadeDias: orcamentos.validadeDias,
    })
    .from(orcamentos)
    .orderBy(desc(orcamentos.ano), desc(orcamentos.sequencial));
}

import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { encomendaEtapas, encomendaItens, encomendas } from "@/db/schema";

// Leitura do índice de `/encomendas`. Sem `"use server"` — não é uma Server Action, é uma
// consulta chamada direto do Server Component da página; `lib/encomendas/acoes.ts` fica só
// com escrita. Nesta fatia, sem janela de data e sem filtro — o plano 07 acrescenta a janela
// de 12 meses de D-11/03-UI-SPEC.md.
export type EncomendaComFilhos = typeof encomendas.$inferSelect & {
  itens: (typeof encomendaItens.$inferSelect)[];
  etapas: (typeof encomendaEtapas.$inferSelect)[];
};

// Ordenado por `data_inicio` ascendente (D-12, padrão), itens e etapas por `ordem`. Três
// consultas (encomendas, itens, etapas) + agrupamento em memória, em vez de `db.query` com
// `relations()`: o schema desta fase não declara relações Drizzle ainda, e esta fatia não
// precisa delas para uma lista simples.
export async function listarEncomendasDoIndice(): Promise<EncomendaComFilhos[]> {
  const linhasDeEncomenda = await db.select().from(encomendas).orderBy(asc(encomendas.dataInicio));

  if (linhasDeEncomenda.length === 0) {
    return [];
  }

  const idsDeEncomenda = linhasDeEncomenda.map((linha) => linha.id);

  const [linhasDeItem, linhasDeEtapa] = await Promise.all([
    db
      .select()
      .from(encomendaItens)
      .where(inArray(encomendaItens.encomendaId, idsDeEncomenda))
      .orderBy(asc(encomendaItens.ordem)),
    db
      .select()
      .from(encomendaEtapas)
      .where(inArray(encomendaEtapas.encomendaId, idsDeEncomenda))
      .orderBy(asc(encomendaEtapas.ordem)),
  ]);

  return linhasDeEncomenda.map((encomenda) => ({
    ...encomenda,
    itens: linhasDeItem.filter((item) => item.encomendaId === encomenda.id),
    etapas: linhasDeEtapa.filter((etapa) => etapa.encomendaId === encomenda.id),
  }));
}

// Leitura da página de detalhe (`/encomendas/[id]`, plano 05). `null` quando o `id` não existe —
// a página decide entre mostrar a encomenda ou `notFound()`. O status da linha sempre vem direto
// da coluna: nenhum campo aqui é deduzido de data (D-05 — a proibição vale também na leitura).
export async function buscarEncomenda(id: string): Promise<EncomendaComFilhos | null> {
  const [linhaDeEncomenda] = await db
    .select()
    .from(encomendas)
    .where(eq(encomendas.id, id))
    .limit(1);

  if (!linhaDeEncomenda) {
    return null;
  }

  const [itensDaEncomenda, etapasDaEncomenda] = await Promise.all([
    db
      .select()
      .from(encomendaItens)
      .where(eq(encomendaItens.encomendaId, id))
      .orderBy(asc(encomendaItens.ordem)),
    db
      .select()
      .from(encomendaEtapas)
      .where(eq(encomendaEtapas.encomendaId, id))
      .orderBy(asc(encomendaEtapas.ordem)),
  ]);

  return {
    ...linhaDeEncomenda,
    itens: itensDaEncomenda,
    etapas: etapasDaEncomenda,
  };
}

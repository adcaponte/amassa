import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { cotacaoCategorias, cotacoes } from "@/db/schema";

import type { SituacaoCotacao } from "./textos";

// Leituras da aba Cotações de `/abertura`. Sem `"use server"` — mesmo molde de
// `lib/abertura/consultas.ts`: não são Server Actions, são consultas chamadas direto do Server
// Component da página; `lib/cotacoes/acoes.ts` fica só com escrita.

export type CategoriaDeCotacao = {
  id: string;
  nome: string;
  // Convertido para texto ISO na saída (nunca uma instância de `Date`) — é o que
  // `lib/cotacoes/ordenacao.ts` e os Client Components consomem, mesma disciplina de
  // `lib/queimas/consultas.ts`.
  criadoEm: string;
};

// Ordenada por criação (UI-SPEC §Assunções item 6) — a ordem de exibição das sub-abas. Uma
// consulta por lista, nunca uma por linha.
export async function listarCategoriasDeCotacao(): Promise<CategoriaDeCotacao[]> {
  const linhas = await db
    .select({ id: cotacaoCategorias.id, nome: cotacaoCategorias.nome, criadoEm: cotacaoCategorias.criadoEm })
    .from(cotacaoCategorias)
    .orderBy(asc(cotacaoCategorias.criadoEm));

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    criadoEm: linha.criadoEm.toISOString(),
  }));
}

export type Cotacao = {
  id: string;
  categoriaId: string;
  empresa: string;
  produto: string;
  precoCentavos: number | null;
  situacao: SituacaoCotacao;
  diferenciais: string;
  assistencia: string;
  pagamento: string;
  contato: string;
  observacoes: string;
  alertas: string;
  criadoEm: string;
};

function paraCotacao(linha: typeof cotacoes.$inferSelect): Cotacao {
  return {
    id: linha.id,
    categoriaId: linha.categoriaId,
    empresa: linha.empresa,
    produto: linha.produto,
    precoCentavos: linha.precoCentavos,
    situacao: linha.situacao,
    diferenciais: linha.diferenciais,
    assistencia: linha.assistencia,
    pagamento: linha.pagamento,
    contato: linha.contato,
    observacoes: linha.observacoes,
    alertas: linha.alertas,
    criadoEm: linha.criadoEm.toISOString(),
  };
}

// Ordenada por criação — a ordem PADRÃO do protótipo (UI-SPEC §Assunções item 7); ordenar por
// preço é feito no CLIENTE, sobre esta mesma lista, por `lib/cotacoes/ordenacao.ts`. Uma consulta
// por lista, nunca uma por linha.
export async function listarCotacoesDaCategoria(categoriaId: string): Promise<Cotacao[]> {
  const linhas = await db
    .select()
    .from(cotacoes)
    .where(eq(cotacoes.categoriaId, categoriaId))
    .orderBy(asc(cotacoes.criadoEm));

  return linhas.map(paraCotacao);
}

export async function obterCotacao(id: string): Promise<Cotacao | null> {
  const [linha] = await db.select().from(cotacoes).where(eq(cotacoes.id, id)).limit(1);
  return linha ? paraCotacao(linha) : null;
}

// A contagem de cotações por categoria (pílula "Fornos 3", UI-SPEC) — de TODAS as categorias de
// uma vez, nunca uma consulta por pílula. Categoria sem nenhuma cotação não aparece no `group by`
// e entra como 0 no mapa devolvido, para a pílula sempre mostrar o número (UI-SPEC §Assunções
// item 4: "0" aparece, nunca é omitido).
export async function contarCotacoesPorCategoria(): Promise<Map<string, number>> {
  const linhas = await db
    .select({ categoriaId: cotacoes.categoriaId, total: count() })
    .from(cotacoes)
    .groupBy(cotacoes.categoriaId);

  return new Map(linhas.map((linha) => [linha.categoriaId, linha.total]));
}

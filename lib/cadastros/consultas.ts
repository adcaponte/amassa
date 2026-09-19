// Leituras do módulo Cadastros. Sem `"use server"` — não são Server Actions, mesmo molde de
// `lib/financeiro/consultas.ts`: consultas chamadas direto do Server Component da página;
// `lib/cadastros/acoes.ts` fica só com escrita.
import { asc, count, countDistinct, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import { categorias, configuracaoFinanceira, contasFixas, documentoLinhas, itensCatalogo } from "@/db/schema";

import type { AreaFinanceira, GrupoDeCategoria } from "./categorias";

// A taxa do cartão, em pontos-base, ou 0 quando a configuração ainda não existe (a migração não
// semeia nenhuma linha) — nunca um valor inventado. Mesma leitura de
// `obterConfiguracaoFinanceira` (lib/financeiro/consultas.ts), mas só o campo que esta tela
// precisa.
export async function obterTaxaDoCartao(): Promise<number> {
  const [linha] = await db
    .select({ taxaCartaoPontosBase: configuracaoFinanceira.taxaCartaoPontosBase })
    .from(configuracaoFinanceira)
    .limit(1);

  return linha?.taxaCartaoPontosBase ?? 0;
}

export type CategoriaComUso = {
  id: string;
  nome: string;
  grupo: GrupoDeCategoria;
  area: AreaFinanceira;
  ativa: boolean;
  chaveDoSistema: string | null;
  // Documentos DISTINTOS com pelo menos uma linha nesta categoria — a mesma contagem do
  // protótipo ("N lançamento(s)"), nunca a contagem de linhas soltas.
  lancamentos: number;
  itens: number;
  contasFixas: number;
};

// TODAS as categorias (ativas e inativas — Categorias nunca apaga, só desativa) com o uso de
// cada uma, numa consulta agregada por origem de uso (nunca uma consulta por categoria, T-04.4
// mesma disciplina de `lib/financeiro/consultas.ts::listarMovimentos`). Quatro leituras no
// total, sempre — o custo não cresce com o número de categorias.
export async function listarCategoriasComUso(): Promise<CategoriaComUso[]> {
  const [todasAsCategorias, lancamentosPorCategoria, itensPorCategoria, contasPorCategoria] =
    await Promise.all([
      db
        .select({
          id: categorias.id,
          nome: categorias.nome,
          grupo: categorias.grupo,
          area: categorias.area,
          ativa: categorias.ativa,
          chaveDoSistema: categorias.chaveDoSistema,
        })
        .from(categorias)
        .orderBy(asc(categorias.criadoEm)),
      db
        .select({ categoriaId: documentoLinhas.categoriaId, total: countDistinct(documentoLinhas.documentoId) })
        .from(documentoLinhas)
        .groupBy(documentoLinhas.categoriaId),
      // Um item conta para a categoria dele de venda OU de compra — cada linha de
      // `itens_catalogo` só é contada UMA vez, mesmo quando as duas colunas apontam para a
      // mesma categoria (`or`, nunca duas consultas separadas somadas, que dobraria a contagem
      // nesse caso de borda).
      db
        .select({
          categoriaVendaId: itensCatalogo.categoriaVendaId,
          categoriaCompraId: itensCatalogo.categoriaCompraId,
        })
        .from(itensCatalogo)
        .where(
          or(isNotNull(itensCatalogo.categoriaVendaId), isNotNull(itensCatalogo.categoriaCompraId)),
        ),
      db
        .select({ categoriaId: contasFixas.categoriaId, total: count() })
        .from(contasFixas)
        .groupBy(contasFixas.categoriaId),
    ]);

  const lancamentosPorId = new Map(
    lancamentosPorCategoria.map((linha) => [linha.categoriaId, Number(linha.total)]),
  );
  const contasPorId = new Map(contasPorCategoria.map((linha) => [linha.categoriaId, Number(linha.total)]));

  const itensPorId = new Map<string, number>();
  for (const item of itensPorCategoria) {
    const idsEnvolvidos = new Set(
      [item.categoriaVendaId, item.categoriaCompraId].filter((id): id is string => id !== null),
    );
    for (const id of idsEnvolvidos) {
      itensPorId.set(id, (itensPorId.get(id) ?? 0) + 1);
    }
  }

  return todasAsCategorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    grupo: categoria.grupo,
    area: categoria.area,
    ativa: categoria.ativa,
    chaveDoSistema: categoria.chaveDoSistema,
    lancamentos: lancamentosPorId.get(categoria.id) ?? 0,
    itens: itensPorId.get(categoria.id) ?? 0,
    contasFixas: contasPorId.get(categoria.id) ?? 0,
  }));
}

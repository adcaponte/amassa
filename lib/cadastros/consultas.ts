// Leituras do módulo Cadastros. Sem `"use server"` — não são Server Actions, mesmo molde de
// `lib/financeiro/consultas.ts`: consultas chamadas direto do Server Component da página;
// `lib/cadastros/acoes.ts` fica só com escrita.
import { and, asc, count, countDistinct, eq, inArray, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  categorias,
  configuracaoFinanceira,
  contasFixas,
  documentoLinhas,
  fichaTecnica,
  itensCatalogo,
} from "@/db/schema";

import { areaDoItem, type InsumoDisponivel, type Unidade } from "./catalogo";
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

export type CategoriaResumida = {
  id: string;
  nome: string;
  area: AreaFinanceira;
  ativa: boolean;
};

export type LinhaDaFichaTecnica = {
  insumoId: string;
  insumoNome: string;
  unidade: Unidade;
  quantidade: string;
};

export type ItemDoCatalogoCompleto = {
  id: string;
  nome: string;
  precoVendaCentavos: number | null;
  aparecenaVenda: boolean;
  atalhoVenda: boolean;
  controlaEstoque: boolean;
  atalhoCompra: boolean;
  unidade: Unidade | null;
  categoriaVendaId: string | null;
  categoriaCompraId: string | null;
  categoriaVenda: CategoriaResumida | null;
  categoriaCompra: CategoriaResumida | null;
  area: AreaFinanceira;
  ficha: LinhaDaFichaTecnica[];
};

// TODOS os itens do catálogo, com a categoria de venda/compra (nome, área, ativa — mesmo com a
// categoria desativada, 04.4-UI-SPEC.md: "item continua listado, vendável e editável") e a ficha
// técnica embutida. DUAS consultas — itens+categorias (dois `leftJoin` na MESMA tabela via
// `alias`, nunca uma terceira consulta para nome/unidade do insumo: o insumo É um item do
// catálogo, então o nome/unidade dele já está no mapa desta própria consulta) e fichas — nunca
// uma consulta por item.
export async function listarCatalogoCompleto(): Promise<ItemDoCatalogoCompleto[]> {
  const categoriaVenda = alias(categorias, "categoria_venda_do_item");
  const categoriaCompra = alias(categorias, "categoria_compra_do_item");

  const [itens, fichas] = await Promise.all([
    db
      .select({
        id: itensCatalogo.id,
        nome: itensCatalogo.nome,
        precoVendaCentavos: itensCatalogo.precoVendaCentavos,
        aparecenaVenda: itensCatalogo.aparecenaVenda,
        atalhoVenda: itensCatalogo.atalhoVenda,
        controlaEstoque: itensCatalogo.controlaEstoque,
        atalhoCompra: itensCatalogo.atalhoCompra,
        unidade: itensCatalogo.unidade,
        categoriaVendaId: itensCatalogo.categoriaVendaId,
        categoriaCompraId: itensCatalogo.categoriaCompraId,
        categoriaVendaNome: categoriaVenda.nome,
        categoriaVendaArea: categoriaVenda.area,
        categoriaVendaAtiva: categoriaVenda.ativa,
        categoriaCompraNome: categoriaCompra.nome,
        categoriaCompraArea: categoriaCompra.area,
        categoriaCompraAtiva: categoriaCompra.ativa,
      })
      .from(itensCatalogo)
      .leftJoin(categoriaVenda, eq(itensCatalogo.categoriaVendaId, categoriaVenda.id))
      .leftJoin(categoriaCompra, eq(itensCatalogo.categoriaCompraId, categoriaCompra.id))
      .orderBy(asc(itensCatalogo.criadoEm)),
    db
      .select({
        itemId: fichaTecnica.itemId,
        insumoId: fichaTecnica.insumoId,
        quantidade: fichaTecnica.quantidade,
      })
      .from(fichaTecnica),
  ]);

  // Insumo É um item do catálogo — nome/unidade dele já vêm da MESMA consulta acima, nunca uma
  // terceira consulta.
  const itemPorId = new Map(itens.map((item) => [item.id, item]));

  const fichaPorItem = new Map<string, LinhaDaFichaTecnica[]>();
  for (const linha of fichas) {
    const insumo = itemPorId.get(linha.insumoId);
    if (!insumo) {
      continue;
    }
    const lista = fichaPorItem.get(linha.itemId) ?? [];
    lista.push({
      insumoId: linha.insumoId,
      insumoNome: insumo.nome,
      unidade: (insumo.unidade ?? "un") as Unidade,
      quantidade: linha.quantidade,
    });
    fichaPorItem.set(linha.itemId, lista);
  }

  return itens.map((item) => {
    const categoriaVendaResumida: CategoriaResumida | null = item.categoriaVendaId
      ? {
          id: item.categoriaVendaId,
          nome: item.categoriaVendaNome ?? "",
          area: (item.categoriaVendaArea ?? "geral") as AreaFinanceira,
          ativa: item.categoriaVendaAtiva ?? false,
        }
      : null;
    const categoriaCompraResumida: CategoriaResumida | null = item.categoriaCompraId
      ? {
          id: item.categoriaCompraId,
          nome: item.categoriaCompraNome ?? "",
          area: (item.categoriaCompraArea ?? "geral") as AreaFinanceira,
          ativa: item.categoriaCompraAtiva ?? false,
        }
      : null;

    return {
      id: item.id,
      nome: item.nome,
      precoVendaCentavos: item.precoVendaCentavos,
      aparecenaVenda: item.aparecenaVenda,
      atalhoVenda: item.atalhoVenda,
      controlaEstoque: item.controlaEstoque,
      atalhoCompra: item.atalhoCompra,
      unidade: item.unidade as Unidade | null,
      categoriaVendaId: item.categoriaVendaId,
      categoriaCompraId: item.categoriaCompraId,
      categoriaVenda: categoriaVendaResumida,
      categoriaCompra: categoriaCompraResumida,
      area: areaDoItem(categoriaVendaResumida, categoriaCompraResumida),
      ficha: fichaPorItem.get(item.id) ?? [],
    };
  });
}

export type InsumoParaFicha = InsumoDisponivel & { unidade: Unidade | null };

// TODOS os itens do catálogo — id, nome, controlaEstoque (o mesmo formato que `validarItem`
// espera) e a unidade (para o diálogo mostrar "15 g de Grão de café", não só o nome). Usada pelo
// diálogo para a MESMA checagem que o servidor faz, e para a lista de insumos candidatos da
// ficha técnica.
export async function listarInsumosDisponiveis(): Promise<InsumoParaFicha[]> {
  const itens = await db
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      controlaEstoque: itensCatalogo.controlaEstoque,
      unidade: itensCatalogo.unidade,
    })
    .from(itensCatalogo)
    .orderBy(asc(itensCatalogo.nome));

  return itens.map((item) => ({ ...item, unidade: item.unidade as Unidade | null }));
}

export type CategoriaParaItem = {
  id: string;
  nome: string;
  grupo: GrupoDeCategoria;
  area: AreaFinanceira;
};

// Categorias ATIVAS de receita (venda), custo e geral (compra) — o diálogo do item soma a
// categoria ATUAL do item (mesmo quando desativada) por cima desta lista, nunca o contrário
// (04.4-UI-SPEC.md: "categoria desativada... aparece como a opção atual e não some do
// formulário").
export async function listarCategoriasParaItem(): Promise<{
  vendaveis: CategoriaParaItem[];
  compraveis: CategoriaParaItem[];
}> {
  const linhas = await db
    .select({ id: categorias.id, nome: categorias.nome, grupo: categorias.grupo, area: categorias.area })
    .from(categorias)
    .where(and(eq(categorias.ativa, true), inArray(categorias.grupo, ["receita", "custo", "geral"])))
    .orderBy(asc(categorias.nome));

  return {
    vendaveis: linhas.filter((categoria) => categoria.grupo === "receita"),
    compraveis: linhas.filter((categoria) => categoria.grupo === "custo" || categoria.grupo === "geral"),
  };
}

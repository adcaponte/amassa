// Leituras do módulo Financeiro. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página; `lib/financeiro/acoes.ts` fica só com escrita
// (mesmo molde de `lib/abertura/consultas.ts`/`lib/queimas/consultas.ts`).
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { categorias, configuracaoFinanceira, documentoLinhas, documentos, parcelas } from "@/db/schema";

import { totalDasLinhas, tituloDoDocumento } from "./documento";
import type { MovimentoParaExtrato } from "./extrato";
import type { AreaFinanceira, FormaDePagamento, GrupoDeCategoria } from "./textos";

export type ConfiguracaoFinanceira = {
  taxaCartaoPontosBase: number;
  saldoInicialCentavos: number;
  dataSaldoInicial: string | null;
};

// A linha única de configuração, ou os padrões quando ela ainda não existe (a migração 0014 NÃO
// semeia linha nenhuma): taxa 0, saldo 0, sem data — nunca um valor inventado.
export async function obterConfiguracaoFinanceira(): Promise<ConfiguracaoFinanceira> {
  const [linha] = await db.select().from(configuracaoFinanceira).limit(1);

  if (!linha) {
    return { taxaCartaoPontosBase: 0, saldoInicialCentavos: 0, dataSaldoInicial: null };
  }

  return {
    taxaCartaoPontosBase: linha.taxaCartaoPontosBase,
    saldoInicialCentavos: linha.saldoInicialCentavos,
    dataSaldoInicial: linha.dataSaldoInicial,
  };
}

export type CategoriaParaEscolha = {
  id: string;
  nome: string;
  grupo: GrupoDeCategoria;
  area: AreaFinanceira;
};

// Só categorias ATIVAS, dos grupos pedidos, em ordem de criação (nenhuma reordenação manual
// nesta fase) — o usuário nunca escolhe a área, ela vem junto da categoria (briefing §2).
export async function listarCategoriasParaEscolha(
  grupos: readonly GrupoDeCategoria[],
): Promise<CategoriaParaEscolha[]> {
  return db
    .select({ id: categorias.id, nome: categorias.nome, grupo: categorias.grupo, area: categorias.area })
    .from(categorias)
    .where(and(eq(categorias.ativa, true), inArray(categorias.grupo, grupos)))
    .orderBy(asc(categorias.criadoEm));
}

// Toda parcela PAGA, com número, tipo, cancelado e o título calculado a partir das linhas — TRÊS
// consultas (parcelas+documentos, documento_linhas, contagem de parcelas), nunca uma consulta por
// linha (T-04.2-11, mesma disciplina do resto do projeto).
export async function listarMovimentos(): Promise<MovimentoParaExtrato[]> {
  const parcelasPagas = await db
    .select({
      parcelaId: parcelas.id,
      documentoId: documentos.id,
      numeroDocumento: documentos.numero,
      numeroParcela: parcelas.numero,
      tipo: documentos.tipo,
      pagoEm: parcelas.pagoEm,
      forma: parcelas.forma,
      valorCentavos: parcelas.valorCentavos,
      taxaPontosBase: parcelas.taxaPontosBase,
      canceladoEm: documentos.canceladoEm,
      titulo: documentos.titulo,
    })
    .from(parcelas)
    .innerJoin(documentos, eq(parcelas.documentoId, documentos.id))
    .where(isNotNull(parcelas.pagoEm));

  if (parcelasPagas.length === 0) {
    return [];
  }

  const idsDosDocumentos = [...new Set(parcelasPagas.map((linha) => linha.documentoId))];

  const [linhasDosDocumentos, contagemDeParcelas] = await Promise.all([
    db
      .select({
        documentoId: documentoLinhas.documentoId,
        nome: documentoLinhas.descricao,
        quantidade: documentoLinhas.quantidade,
      })
      .from(documentoLinhas)
      .where(inArray(documentoLinhas.documentoId, idsDosDocumentos))
      .orderBy(asc(documentoLinhas.ordem)),
    db
      .select({ documentoId: parcelas.documentoId, total: count() })
      .from(parcelas)
      .where(inArray(parcelas.documentoId, idsDosDocumentos))
      .groupBy(parcelas.documentoId),
  ]);

  const linhasPorDocumento = new Map<string, { nome: string; quantidade: number }[]>();
  for (const linha of linhasDosDocumentos) {
    const lista = linhasPorDocumento.get(linha.documentoId) ?? [];
    lista.push({ nome: linha.nome, quantidade: linha.quantidade });
    linhasPorDocumento.set(linha.documentoId, lista);
  }

  const contagemPorDocumento = new Map(
    contagemDeParcelas.map((linha) => [linha.documentoId, linha.total]),
  );

  return parcelasPagas.map((parcela) => ({
    parcelaId: parcela.parcelaId,
    documentoId: parcela.documentoId,
    numeroDocumento: parcela.numeroDocumento,
    numeroParcela: parcela.numeroParcela,
    deQuantas: contagemPorDocumento.get(parcela.documentoId) ?? 1,
    tipo: parcela.tipo,
    // `pagoEm` nunca é nulo aqui — a consulta acima só traz parcelas pagas (`isNotNull`).
    pagoEm: parcela.pagoEm as string,
    forma: parcela.forma as FormaDePagamento,
    valorCentavos: parcela.valorCentavos,
    taxaPontosBase: parcela.taxaPontosBase,
    cancelado: parcela.canceladoEm !== null,
    titulo: tituloDoDocumento({
      titulo: parcela.titulo,
      linhas: linhasPorDocumento.get(parcela.documentoId) ?? [],
    }),
  }));
}

export type ParcelaEmAberto = { tipo: "venda" | "despesa"; valorCentavos: number };

// Parcelas ABERTAS (sem `pago_em`) de documento NÃO cancelado — alimenta os tiles "A receber"/
// "A pagar" (`resumoDoCaixa`, `lib/financeiro/extrato.ts`).
export async function listarParcelasEmAberto(): Promise<ParcelaEmAberto[]> {
  const linhas = await db
    .select({ tipo: documentos.tipo, valorCentavos: parcelas.valorCentavos })
    .from(parcelas)
    .innerJoin(documentos, eq(parcelas.documentoId, documentos.id))
    .where(and(isNull(parcelas.pagoEm), isNull(documentos.canceladoEm)));

  return linhas;
}

export type DocumentoParaAviso = { numero: number; totalCentavos: number; parcelasEmAberto: number };

// O que o aviso pós-navegação precisa mostrar ("Venda nº N lançada · R$ X"): número, total
// (soma das linhas, a mesma regra de `totalDasLinhas`) e quantas parcelas continuam em aberto.
// `null` quando o identificador não corresponde a nenhum documento (a página trata isso
// simplesmente não mostrando o aviso).
export async function obterDocumentoParaAviso(id: string): Promise<DocumentoParaAviso | null> {
  const [documento] = await db
    .select({ numero: documentos.numero })
    .from(documentos)
    .where(eq(documentos.id, id))
    .limit(1);

  if (!documento) {
    return null;
  }

  const linhas = await db
    .select({ valorCentavos: documentoLinhas.valorCentavos })
    .from(documentoLinhas)
    .where(eq(documentoLinhas.documentoId, id));

  const [{ total: parcelasEmAbertoTotal }] = await db
    .select({ total: count() })
    .from(parcelas)
    .where(and(eq(parcelas.documentoId, id), isNull(parcelas.pagoEm)));

  return {
    numero: documento.numero,
    totalCentavos: totalDasLinhas(linhas),
    parcelasEmAberto: Number(parcelasEmAbertoTotal),
  };
}

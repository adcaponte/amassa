// Leituras do módulo Financeiro. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página; `lib/financeiro/acoes.ts` fica só com escrita
// (mesmo molde de `lib/abertura/consultas.ts`/`lib/queimas/consultas.ts`).
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  categorias,
  configuracaoFinanceira,
  documentoLinhas,
  documentos,
  fichaTecnica,
  itensCatalogo,
  parcelas,
  usuarios,
} from "@/db/schema";

import type { ItemParaEfeito } from "./efeito-estoque";
import { totalDasLinhas, tituloDoDocumento } from "./documento";
import type { MovimentoParaExtrato } from "./extrato";
import type { AreaFinanceira, FormaDePagamento, GrupoDeCategoria, TipoDeDocumentoParaTexto } from "./textos";

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

export type ItemDoCatalogoParaVenda = {
  id: string;
  nome: string;
  area: AreaFinanceira;
  precoVendaCentavos: number | null;
  atalhoVenda: boolean;
};

// Só itens que APARECEM NA VENDA (`aparece_na_venda = true`), com a área que vem da categoria de
// venda — o gestor nunca escolhe área, ela é sempre derivada (briefing §2). Ordem de criação,
// mesma disciplina de `listarCategoriasParaEscolha` (nenhuma reordenação manual nesta fase).
export async function listarCatalogoDaVenda(): Promise<ItemDoCatalogoParaVenda[]> {
  return db
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      area: categorias.area,
      precoVendaCentavos: itensCatalogo.precoVendaCentavos,
      atalhoVenda: itensCatalogo.atalhoVenda,
    })
    .from(itensCatalogo)
    .innerJoin(categorias, eq(itensCatalogo.categoriaVendaId, categorias.id))
    .where(eq(itensCatalogo.aparecenaVenda, true))
    .orderBy(asc(itensCatalogo.criadoEm));
}

export type ItemDoCatalogoParaCompra = {
  id: string;
  nome: string;
  area: AreaFinanceira;
  unidade: string;
  atalhoCompra: boolean;
};

// Só itens que CONTROLAM ESTOQUE (`controla_estoque = true`), com a área da categoria de COMPRA
// — mesma disciplina de `listarCatalogoDaVenda` (ordem de criação, área nunca escolhida pelo
// usuário, ela vem da categoria). `unidade` nunca é nula aqui: a restrição
// `itens_catalogo_controla_exige_unidade_e_categoria_compra` do banco garante as duas juntas.
export async function listarCatalogoDaCompra(): Promise<ItemDoCatalogoParaCompra[]> {
  const linhas = await db
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      area: categorias.area,
      unidade: itensCatalogo.unidade,
      atalhoCompra: itensCatalogo.atalhoCompra,
    })
    .from(itensCatalogo)
    .innerJoin(categorias, eq(itensCatalogo.categoriaCompraId, categorias.id))
    .where(eq(itensCatalogo.controlaEstoque, true))
    .orderBy(asc(itensCatalogo.criadoEm));

  return linhas.map((linha) => ({ ...linha, unidade: linha.unidade ?? "un" }));
}

// TODOS os itens do catálogo, com a ficha técnica embutida — alimenta
// `lib/financeiro/efeito-estoque.ts::efeitoNoEstoque`. DUAS consultas (itens + fichas), nunca uma
// consulta por item, mesma disciplina de `listarMovimentos` acima.
export async function listarItensParaEfeito(): Promise<ItemParaEfeito[]> {
  const [itens, fichas] = await Promise.all([
    db
      .select({
        id: itensCatalogo.id,
        nome: itensCatalogo.nome,
        unidade: itensCatalogo.unidade,
        controlaEstoque: itensCatalogo.controlaEstoque,
      })
      .from(itensCatalogo),
    db
      .select({
        itemId: fichaTecnica.itemId,
        insumoId: fichaTecnica.insumoId,
        quantidade: fichaTecnica.quantidade,
      })
      .from(fichaTecnica),
  ]);

  const fichaPorItem = new Map<string, { insumoId: string; quantidade: string }[]>();
  for (const linha of fichas) {
    const lista = fichaPorItem.get(linha.itemId) ?? [];
    lista.push({ insumoId: linha.insumoId, quantidade: linha.quantidade });
    fichaPorItem.set(linha.itemId, lista);
  }

  return itens.map((item) => ({
    id: item.id,
    nome: item.nome,
    unidade: item.unidade,
    controlaEstoque: item.controlaEstoque,
    ficha: fichaPorItem.get(item.id) ?? [],
  }));
}

export type ContaEmAberto = {
  documentoId: string;
  parcelaId: string;
  numeroDocumento: number;
  numeroParcela: number;
  deQuantas: number;
  tipo: TipoDeDocumentoParaTexto;
  titulo: string;
  pessoa: string | null;
  vencimento: string;
  rotulo: string | null;
  valorCentavos: number;
};

// Parcelas ABERTAS de documento NÃO cancelado, com o título calculado e a contagem de parcelas do
// documento — alimenta `ListasCaixa` ("A pagar"/"A receber", FNC-07). TRÊS consultas (parcelas +
// documentos, documento_linhas, contagem de parcelas), nunca uma consulta por linha (mesma
// disciplina de `listarMovimentos`). Ordenadas por vencimento e, no empate, por número do
// documento.
export async function listarContasEmAberto(): Promise<ContaEmAberto[]> {
  const parcelasAbertas = await db
    .select({
      parcelaId: parcelas.id,
      documentoId: documentos.id,
      numeroDocumento: documentos.numero,
      numeroParcela: parcelas.numero,
      tipo: documentos.tipo,
      vencimento: parcelas.vencimento,
      rotulo: parcelas.rotulo,
      pessoaNome: documentos.pessoaNome,
      titulo: documentos.titulo,
      valorCentavos: parcelas.valorCentavos,
    })
    .from(parcelas)
    .innerJoin(documentos, eq(parcelas.documentoId, documentos.id))
    .where(and(isNull(parcelas.pagoEm), isNull(documentos.canceladoEm)));

  if (parcelasAbertas.length === 0) {
    return [];
  }

  const idsDosDocumentos = [...new Set(parcelasAbertas.map((linha) => linha.documentoId))];

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

  return parcelasAbertas
    .map((parcela) => ({
      documentoId: parcela.documentoId,
      parcelaId: parcela.parcelaId,
      numeroDocumento: parcela.numeroDocumento,
      numeroParcela: parcela.numeroParcela,
      deQuantas: contagemPorDocumento.get(parcela.documentoId) ?? 1,
      tipo: parcela.tipo,
      titulo: tituloDoDocumento({
        titulo: parcela.titulo,
        linhas: linhasPorDocumento.get(parcela.documentoId) ?? [],
      }),
      pessoa: parcela.pessoaNome,
      vencimento: parcela.vencimento,
      rotulo: parcela.rotulo,
      valorCentavos: parcela.valorCentavos,
    }))
    .sort((a, b) => {
      if (a.vencimento !== b.vencimento) {
        return a.vencimento < b.vencimento ? -1 : 1;
      }
      return a.numeroDocumento - b.numeroDocumento;
    });
}

export type LinhaDoDocumentoParaDetalhe = {
  descricao: string;
  quantidade: number;
  quantidadeEstoque: string | null;
  unidade: string | null;
  categoriaNome: string;
  valorCentavos: number;
  ehDiferenca: boolean;
};

export type ParcelaDoDocumentoParaDetalhe = {
  id: string;
  numero: number;
  vencimento: string;
  valorCentavos: number;
  forma: FormaDePagamento;
  pagoEm: string | null;
  rotulo: string | null;
};

export type DocumentoParaDetalhe = {
  id: string;
  numero: number;
  tipo: TipoDeDocumentoParaTexto;
  data: string;
  pessoa: string | null;
  titulo: string;
  cancelado: boolean;
  canceladoPorNome: string | null;
  canceladoEm: string | null;
  deQuantasParcelas: number;
  linhas: LinhaDoDocumentoParaDetalhe[];
  parcelas: ParcelaDoDocumentoParaDetalhe[];
};

// O detalhe do documento ("Ver"): documentos + quem cancelou (join com usuarios), linhas (com a
// categoria e se é a linha de diferença) e parcelas — TRÊS consultas, uma por tabela de
// lançamento, nunca uma consulta por documento. Devolve um MAPA por id (nunca uma segunda
// consulta ao abrir o detalhe — quem chama já recebeu tudo de uma vez).
export async function listarDocumentosParaDetalhe(
  ids: readonly string[],
): Promise<Map<string, DocumentoParaDetalhe>> {
  if (ids.length === 0) {
    return new Map();
  }

  const [documentosCarregados, linhasCarregadas, parcelasCarregadas] = await Promise.all([
    db
      .select({
        id: documentos.id,
        numero: documentos.numero,
        tipo: documentos.tipo,
        data: documentos.data,
        pessoaNome: documentos.pessoaNome,
        titulo: documentos.titulo,
        canceladoEm: documentos.canceladoEm,
        canceladoPorNome: usuarios.nome,
      })
      .from(documentos)
      .leftJoin(usuarios, eq(documentos.canceladoPor, usuarios.id))
      .where(inArray(documentos.id, ids as string[])),
    db
      .select({
        documentoId: documentoLinhas.documentoId,
        descricao: documentoLinhas.descricao,
        quantidade: documentoLinhas.quantidade,
        quantidadeEstoque: documentoLinhas.quantidadeEstoque,
        unidade: itensCatalogo.unidade,
        categoriaNome: categorias.nome,
        valorCentavos: documentoLinhas.valorCentavos,
        parcelaDiferencaId: documentoLinhas.parcelaDiferencaId,
      })
      .from(documentoLinhas)
      .innerJoin(categorias, eq(documentoLinhas.categoriaId, categorias.id))
      .leftJoin(itensCatalogo, eq(documentoLinhas.itemId, itensCatalogo.id))
      .where(inArray(documentoLinhas.documentoId, ids as string[]))
      .orderBy(asc(documentoLinhas.ordem)),
    db
      .select({
        id: parcelas.id,
        documentoId: parcelas.documentoId,
        numero: parcelas.numero,
        vencimento: parcelas.vencimento,
        valorCentavos: parcelas.valorCentavos,
        forma: parcelas.forma,
        pagoEm: parcelas.pagoEm,
        rotulo: parcelas.rotulo,
      })
      .from(parcelas)
      .where(inArray(parcelas.documentoId, ids as string[]))
      .orderBy(asc(parcelas.numero)),
  ]);

  const linhasPorDocumento = new Map<string, LinhaDoDocumentoParaDetalhe[]>();
  for (const linha of linhasCarregadas) {
    const lista = linhasPorDocumento.get(linha.documentoId) ?? [];
    lista.push({
      descricao: linha.descricao,
      quantidade: linha.quantidade,
      quantidadeEstoque: linha.quantidadeEstoque,
      unidade: linha.unidade,
      categoriaNome: linha.categoriaNome,
      valorCentavos: linha.valorCentavos,
      ehDiferenca: linha.parcelaDiferencaId !== null,
    });
    linhasPorDocumento.set(linha.documentoId, lista);
  }

  const parcelasPorDocumento = new Map<string, ParcelaDoDocumentoParaDetalhe[]>();
  for (const parcela of parcelasCarregadas) {
    const lista = parcelasPorDocumento.get(parcela.documentoId) ?? [];
    lista.push({
      id: parcela.id,
      numero: parcela.numero,
      vencimento: parcela.vencimento,
      valorCentavos: parcela.valorCentavos,
      forma: parcela.forma as FormaDePagamento,
      pagoEm: parcela.pagoEm,
      rotulo: parcela.rotulo,
    });
    parcelasPorDocumento.set(parcela.documentoId, lista);
  }

  const mapa = new Map<string, DocumentoParaDetalhe>();
  for (const documento of documentosCarregados) {
    const linhas = linhasPorDocumento.get(documento.id) ?? [];
    const parcelasDoDocumento = parcelasPorDocumento.get(documento.id) ?? [];
    mapa.set(documento.id, {
      id: documento.id,
      numero: documento.numero,
      tipo: documento.tipo,
      data: documento.data,
      pessoa: documento.pessoaNome,
      titulo: tituloDoDocumento({
        titulo: documento.titulo,
        linhas: linhas.map((linha) => ({
          nome: linha.descricao,
          quantidade: linha.quantidade,
          quantidadeEstoque: linha.quantidadeEstoque,
          unidade: linha.unidade,
        })),
      }),
      cancelado: documento.canceladoEm !== null,
      canceladoPorNome: documento.canceladoPorNome,
      canceladoEm: documento.canceladoEm ? documento.canceladoEm.toISOString() : null,
      deQuantasParcelas: parcelasDoDocumento.length,
      linhas,
      parcelas: parcelasDoDocumento,
    });
  }

  return mapa;
}

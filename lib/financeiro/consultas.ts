// Leituras do módulo Financeiro. Sem `"use server"` — não são Server Actions, são consultas
// chamadas direto do Server Component da página; `lib/financeiro/acoes.ts` fica só com escrita
// (mesmo molde de `lib/abertura/consultas.ts`/`lib/queimas/consultas.ts`).
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  categorias,
  configuracaoFinanceira,
  contasFixas,
  correcoesDeDocumento,
  documentoLinhas,
  documentos,
  fichaTecnica,
  inscricoes,
  itensCatalogo,
  mensalidades,
  movimentacoesEstoque,
  orcamentos,
  parcelas,
  queimaVendas,
  usosLivres,
  usuarios,
} from "@/db/schema";
import { ehTabelaAusente } from "@/lib/erro/postgres";
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";

import { mesSeguinte, primeiroDiaDoMes } from "./calendario";
import { motivoSemCorrecao, type LinhaDaOriginal, type OrigemSemCorrecao, type ParcelaDaOriginal } from "./correcao";
import type { ItemParaEfeito } from "./efeito-estoque";
import { totalDasLinhas, tituloDoDocumento } from "./documento";
import type { GrupoDePagas, MovimentoParaExtrato } from "./extrato";
import { versaoAtualDoDocumento } from "./gravacao";
import type { DocumentoParaMes, LinhaDeDocumentoParaMes, ParcelaPagaParaMes } from "./mes";
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

// Toda parcela PAGA em `desde` (data civil `YYYY-MM-01`, o 1º dia do mês que o extrato mostra) ou
// depois, com número, tipo, cancelado e o título calculado a partir das linhas — TRÊS consultas
// (parcelas+documentos, documento_linhas, contagem de parcelas), nunca uma consulta por linha
// (T-04.2-11, mesma disciplina do resto do projeto). D-27 (06.5-12): o que foi pago ANTES de
// `desde` não vem linha a linha — chega somado por `somarMovimentosAntesDe`. As duas consultas de
// apoio continuam só sobre os documentos que vieram aqui (a contagem de parcelas de cada um é de
// TODAS as parcelas dele, pagas antes ou não — o "2/3" da linha não muda).
export async function listarMovimentos({ desde }: { desde: string }): Promise<MovimentoParaExtrato[]> {
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
    .where(and(isNotNull(parcelas.pagoEm), gte(parcelas.pagoEm, desde)));

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

// D-27 (06.5-12): as parcelas PAGAS antes de `desde`, de documento NÃO cancelado (cancelado nunca
// entra no saldo — D-25/FNC-10), AGRUPADAS por tipo, valor e taxa congelada, com a contagem. O
// líquido NÃO é calculado aqui: quem aplica a taxa é `saldoAntesDaJanela` (`extrato.ts`), com o
// mesmo `liquidoDaParcela` de cada linha do extrato — a regra da taxa continua num lugar só, nunca
// reescrita em SQL. Agrupar pela taxa (e não somar o valor) é o que mantém o arredondamento da taxa
// parcela a parcela idêntico ao de antes.
export async function somarMovimentosAntesDe(desde: string): Promise<GrupoDePagas[]> {
  const grupos = await db
    .select({
      tipo: documentos.tipo,
      valorCentavos: parcelas.valorCentavos,
      taxaPontosBase: parcelas.taxaPontosBase,
      quantidade: count(),
    })
    .from(parcelas)
    .innerJoin(documentos, eq(parcelas.documentoId, documentos.id))
    .where(and(isNotNull(parcelas.pagoEm), lt(parcelas.pagoEm, desde), isNull(documentos.canceladoEm)))
    .groupBy(documentos.tipo, parcelas.valorCentavos, parcelas.taxaPontosBase);

  return grupos.map((grupo) => ({ ...grupo, quantidade: Number(grupo.quantidade) }));
}

// D-03 / UI-D8 (06.5-12): dos meses pedidos (chaves `YYYY-MM`), os que já têm ao menos um documento
// de conta fixa NÃO cancelado — o mesmo critério do índice parcial `documentos_conta_fixa_mes_ativo_uk`
// (06.5-11): um mês cuja única despesa gerada foi cancelada volta a pedir o aviso, e "Gerar" o cria
// de novo. Uma consulta só, `distinct`, nunca uma por mês.
export async function mesesComContasFixasGeradas(meses: readonly string[]): Promise<string[]> {
  if (meses.length === 0) {
    return [];
  }
  const linhas = await db
    .selectDistinct({ mesReferencia: documentos.mesReferencia })
    .from(documentos)
    .where(
      and(
        isNotNull(documentos.contaFixaId),
        isNull(documentos.canceladoEm),
        inArray(documentos.mesReferencia, meses.map(primeiroDiaDoMes)),
      ),
    );
  return linhas.flatMap((linha) => (linha.mesReferencia ? [linha.mesReferencia.slice(0, 7)] : []));
}

// Existe ao menos uma conta fixa ATIVA? Sem nenhuma, o Caixa não avisa mês nenhum (não há o que
// gerar) — `limit 1`, nunca a lista inteira.
export async function haContaFixaAtiva(): Promise<boolean> {
  const [linha] = await db
    .select({ id: contasFixas.id })
    .from(contasFixas)
    .where(eq(contasFixas.ativa, true))
    .limit(1);
  return linha !== undefined;
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

// Só itens ATIVOS (D-20 — desativado some do seletor) que APARECEM NA VENDA
// (`aparece_na_venda = true`), com a área que vem da categoria de venda — o gestor nunca escolhe área, ela é sempre derivada (briefing §2). Ordem de criação,
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
    .where(and(eq(itensCatalogo.aparecenaVenda, true), eq(itensCatalogo.ativo, true)))
    .orderBy(asc(itensCatalogo.criadoEm));
}

export type ItemDoCatalogoParaCompra = {
  id: string;
  nome: string;
  area: AreaFinanceira;
  unidade: string;
  atalhoCompra: boolean;
};

// Só itens ATIVOS (D-20) que CONTROLAM ESTOQUE (`controla_estoque = true`), com a área da categoria de COMPRA
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
    .where(and(eq(itensCatalogo.controlaEstoque, true), eq(itensCatalogo.ativo, true)))
    .orderBy(asc(itensCatalogo.criadoEm));

  return linhas.map((linha) => ({ ...linha, unidade: linha.unidade ?? "un" }));
}

// TODOS os itens do catálogo — inclusive os desativados (D-20: insumo desativado dentro de ficha
// ativa continua baixando) —, com a ficha técnica embutida — alimenta
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
  forma: FormaDePagamento;
};

// Parcelas ABERTAS de documento NÃO cancelado, com o título calculado e a contagem de parcelas do
// documento — alimenta `ListasCaixa` ("A pagar"/"A receber", FNC-07) e, desde o 06.5-12, os tiles
// (só a parte da janela, `separarPelaJanela`). TRÊS consultas (parcelas +
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
      forma: parcelas.forma,
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
      forma: parcela.forma as FormaDePagamento,
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

// A aprovação de um orçamento (04.5-12-PLAN.md, D-25) — o vínculo mora em
// `orcamentos.documento_id`, único: nunca uma coluna espelho do lado do Financeiro (chave
// circular e segunda verdade que poderiam divergir). "Navegável nos dois sentidos" é satisfeito
// por ser CONSULTÁVEL nos dois sentidos — esta é a metade que parte do documento.
export type OrigemDoDocumento = {
  orcamentoId: string;
  numero: string;
  // A ordem de produção que a aprovação abriu (Fase 06.1, PRD-10 — "navegáveis nos dois
  // sentidos"): `orcamentos.encomenda_id`, o nome histórico do vínculo com `ordens_producao`.
  // `null` quando o orçamento foi aprovado sem ordem.
  ordemId: string | null;
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
  // `null` quando este documento não nasceu de uma aprovação de orçamento (a imensa maioria dos
  // documentos — venda avulsa, despesa).
  origemOrcamento: OrigemDoDocumento | null;
  // Fase 06.5, plano 17 (UI-D10): de onde veio o documento que NÃO se corrige pela Venda/Despesa
  // (Agenda, Queimas, orçamento, conta fixa) — `null` = o “Corrigir” aparece (se não estiver cancelado).
  origemParaCorrecao: OrigemSemCorrecao | null;
  // O vínculo da correção (06.5-17): na original, o número da que a corrigiu (“Corrigida pela venda nº
  // {38}”); na nova, o número da original (“Corrige a venda nº {33}”). `null` = sem vínculo daquele lado.
  corrigidaPorNumero: number | null;
  corrigeNumero: number | null;
};

// Os vínculos de `correcoes_de_documento` em que algum dos ids é a original OU a corrigida, com o número
// (e o tipo) dos dois lados — uma consulta só, para a lista inteira.
//
// LEITURA TOLERANTE, só para a janela do Roteiro 22 (06.5-11): entre o `implantar` (código novo) e o
// `db:migrate` à mão da 0031, a tabela ainda não existe; o Caixa não pode quebrar por isso. Só a SQLSTATE
// 42P01 (tabela ausente) vira “sem vínculo” — qualquer outro erro sobe. Depois da 0031 aplicada, esta
// tolerância nunca dispara.
type VinculoDeCorrecao = {
  originalId: string;
  corrigidoId: string;
  tipo: TipoDeDocumentoParaTexto;
  numeroOriginal: number;
  numeroCorrigido: number;
};

const documentoOriginal = alias(documentos, "documento_original");
const documentoCorrigido = alias(documentos, "documento_corrigido");

async function vinculosDeCorrecao(ids: readonly string[]): Promise<VinculoDeCorrecao[]> {
  if (ids.length === 0) {
    return [];
  }
  const lista = ids as string[];
  try {
    return await db
      .select({
        originalId: correcoesDeDocumento.originalId,
        corrigidoId: correcoesDeDocumento.corrigidoId,
        tipo: documentoOriginal.tipo,
        numeroOriginal: documentoOriginal.numero,
        numeroCorrigido: documentoCorrigido.numero,
      })
      .from(correcoesDeDocumento)
      .innerJoin(documentoOriginal, eq(documentoOriginal.id, correcoesDeDocumento.originalId))
      .innerJoin(documentoCorrigido, eq(documentoCorrigido.id, correcoesDeDocumento.corrigidoId))
      .where(or(inArray(correcoesDeDocumento.originalId, lista), inArray(correcoesDeDocumento.corrigidoId, lista)));
  } catch (erro) {
    if (ehTabelaAusente(erro)) {
      return [];
    }
    throw erro;
  }
}

// As origens da Agenda (inscrição, mensalidade, uso livre) e das Queimas de uma LISTA de documentos, numa
// consulta só (`union all`) — o detalhe do Caixa e a abertura da correção leem a mesma coisa. O orçamento
// e a conta fixa moram no próprio documento/join de quem chama.
async function origensDaAgendaEDasQueimas(
  ids: readonly string[],
): Promise<Map<string, { temAgenda: boolean; temQueima: boolean }>> {
  const mapa = new Map<string, { temAgenda: boolean; temQueima: boolean }>();
  if (ids.length === 0) {
    return mapa;
  }
  const lista = ids as string[];
  const deOnde = (coluna: AnyPgColumn, modulo: "agenda" | "queimas") => ({
    documentoId: sql<string>`${coluna}`.as("documento_id"),
    modulo: sql<"agenda" | "queimas">`${sql.raw(`'${modulo}'`)}`.as("modulo"),
  });
  const linhas = await db
    .select(deOnde(inscricoes.documentoId, "agenda"))
    .from(inscricoes)
    .where(inArray(inscricoes.documentoId, lista))
    .unionAll(
      db.select(deOnde(mensalidades.documentoId, "agenda")).from(mensalidades).where(inArray(mensalidades.documentoId, lista)),
    )
    .unionAll(
      db.select(deOnde(usosLivres.documentoId, "agenda")).from(usosLivres).where(inArray(usosLivres.documentoId, lista)),
    )
    .unionAll(
      db.select(deOnde(queimaVendas.documentoId, "queimas")).from(queimaVendas).where(inArray(queimaVendas.documentoId, lista)),
    );
  for (const linha of linhas) {
    const atual = mapa.get(linha.documentoId) ?? { temAgenda: false, temQueima: false };
    if (linha.modulo === "agenda") {
      atual.temAgenda = true;
    } else {
      atual.temQueima = true;
    }
    mapa.set(linha.documentoId, atual);
  }
  return mapa;
}

// O detalhe do documento ("Ver"): documentos + quem cancelou (join com usuarios) + o orçamento de
// origem (join com `orcamentos`, quando existe), linhas (com a categoria e se é a linha de
// diferença) e parcelas — TRÊS consultas, uma por tabela de lançamento, nunca uma consulta por
// documento. Devolve um MAPA por id (nunca uma segunda consulta ao abrir o detalhe — quem chama
// já recebeu tudo de uma vez).
export async function listarDocumentosParaDetalhe(
  ids: readonly string[],
): Promise<Map<string, DocumentoParaDetalhe>> {
  if (ids.length === 0) {
    return new Map();
  }

  const [documentosCarregados, linhasCarregadas, parcelasCarregadas, origens, vinculos] = await Promise.all([
    db
      .select({
        id: documentos.id,
        numero: documentos.numero,
        tipo: documentos.tipo,
        data: documentos.data,
        pessoaNome: documentos.pessoaNome,
        titulo: documentos.titulo,
        canceladoEm: documentos.canceladoEm,
        contaFixaId: documentos.contaFixaId,
        canceladoPorNome: usuarios.nome,
        origemOrcamentoId: orcamentos.id,
        origemOrcamentoAno: orcamentos.ano,
        origemOrcamentoSequencial: orcamentos.sequencial,
        origemOrdemId: orcamentos.encomendaId,
      })
      .from(documentos)
      .leftJoin(usuarios, eq(documentos.canceladoPor, usuarios.id))
      .leftJoin(orcamentos, eq(orcamentos.documentoId, documentos.id))
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
    // Fase 06.5, plano 17 (UI-D10): as origens que decidem entre o “Corrigir” e a frase no lugar dele.
    origensDaAgendaEDasQueimas(ids),
    // E os vínculos da correção, dos dois lados (leitura tolerante — ver `vinculosDeCorrecao`).
    vinculosDeCorrecao(ids),
  ]);

  const corrigidaPor = new Map(vinculos.map((vinculo) => [vinculo.originalId, vinculo.numeroCorrigido]));
  const corrige = new Map(vinculos.map((vinculo) => [vinculo.corrigidoId, vinculo.numeroOriginal]));

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
      origemOrcamento: documento.origemOrcamentoId
        ? {
            orcamentoId: documento.origemOrcamentoId,
            numero: numeroDeOrcamento(documento.origemOrcamentoAno!, documento.origemOrcamentoSequencial!),
            ordemId: documento.origemOrdemId,
          }
        : null,
      origemParaCorrecao: motivoSemCorrecao({
        temAgenda: origens.get(documento.id)?.temAgenda ?? false,
        temQueima: origens.get(documento.id)?.temQueima ?? false,
        temOrcamento: documento.origemOrcamentoId !== null,
        temContaFixa: documento.contaFixaId !== null,
      }),
      corrigidaPorNumero: corrigidaPor.get(documento.id) ?? null,
      corrigeNumero: corrige.get(documento.id) ?? null,
    });
  }

  return mapa;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// A abertura do “Corrigir” (Fase 06.5, plano 17 — D-18/UI-D9): a página lê a original para preencher a
// Venda/Despesa. Só LEITURA — nada é travado nem gravado ao abrir. A VERSÃO vem de
// `versaoAtualDoDocumento(db, id)` (plano 16): a mesma leitura e o mesmo normalizador que a transação usa
// sob a trava; nenhum outro código calcula versão.
export type DocumentoParaCorrecao = {
  id: string;
  tipo: TipoDeDocumentoParaTexto;
  numero: number;
  data: string;
  pessoaNome: string | null;
  clienteId: string | null;
  fornecedorId: string | null;
  cancelado: boolean;
  // UI-D10: `null` = corrige por aqui.
  origem: OrigemSemCorrecao | null;
  // “ORC-2026-004” quando a origem é um orçamento.
  numeroDoOrcamento: string | null;
  // A original mexeu no estoque (tem movimentação no livro) — a faixa diz que o material volta.
  comEstoque: boolean;
  linhas: LinhaDaOriginal[];
  parcelas: ParcelaDaOriginal[];
  versao: string;
};

export async function obterDocumentoParaCorrecao(id: string): Promise<DocumentoParaCorrecao | null> {
  const [documentosLidos, linhas, parcelasLidas, origens, movimentacoes, versao] = await Promise.all([
    db
      .select({
        tipo: documentos.tipo,
        numero: documentos.numero,
        data: documentos.data,
        pessoaNome: documentos.pessoaNome,
        clienteId: documentos.clienteId,
        fornecedorId: documentos.fornecedorId,
        canceladoEm: documentos.canceladoEm,
        contaFixaId: documentos.contaFixaId,
        orcamentoAno: orcamentos.ano,
        orcamentoSequencial: orcamentos.sequencial,
      })
      .from(documentos)
      .leftJoin(orcamentos, eq(orcamentos.documentoId, documentos.id))
      .where(eq(documentos.id, id))
      .limit(1),
    db
      .select({
        itemId: documentoLinhas.itemId,
        descricao: documentoLinhas.descricao,
        categoriaId: documentoLinhas.categoriaId,
        quantidade: documentoLinhas.quantidade,
        valorCentavos: documentoLinhas.valorCentavos,
        quantidadeEstoque: documentoLinhas.quantidadeEstoque,
        parcelaDiferencaId: documentoLinhas.parcelaDiferencaId,
      })
      .from(documentoLinhas)
      .where(eq(documentoLinhas.documentoId, id))
      .orderBy(asc(documentoLinhas.ordem)),
    db
      .select({
        vencimento: parcelas.vencimento,
        valorCentavos: parcelas.valorCentavos,
        forma: parcelas.forma,
        pagoEm: parcelas.pagoEm,
      })
      .from(parcelas)
      .where(eq(parcelas.documentoId, id))
      .orderBy(asc(parcelas.numero)),
    origensDaAgendaEDasQueimas([id]),
    db
      .select({ total: count() })
      .from(movimentacoesEstoque)
      .where(eq(movimentacoesEstoque.documentoId, id)),
    versaoAtualDoDocumento(db, id),
  ]);

  const documento = documentosLidos[0];
  if (!documento || versao === null) {
    return null;
  }

  return {
    id,
    tipo: documento.tipo,
    numero: documento.numero,
    data: documento.data,
    pessoaNome: documento.pessoaNome,
    clienteId: documento.clienteId,
    fornecedorId: documento.fornecedorId,
    cancelado: documento.canceladoEm !== null,
    origem: motivoSemCorrecao({
      temAgenda: origens.get(id)?.temAgenda ?? false,
      temQueima: origens.get(id)?.temQueima ?? false,
      temOrcamento: documento.orcamentoAno !== null,
      temContaFixa: documento.contaFixaId !== null,
    }),
    numeroDoOrcamento:
      documento.orcamentoAno !== null && documento.orcamentoSequencial !== null
        ? numeroDeOrcamento(documento.orcamentoAno, documento.orcamentoSequencial)
        : null,
    comEstoque: Number(movimentacoes[0]?.total ?? 0) > 0,
    linhas: linhas.map((linha) => ({
      itemId: linha.itemId,
      descricao: linha.descricao,
      categoriaId: linha.categoriaId,
      quantidade: linha.quantidade,
      valorCentavos: linha.valorCentavos,
      quantidadeEstoque: linha.quantidadeEstoque,
      ehDiferenca: linha.parcelaDiferencaId !== null,
    })),
    parcelas: parcelasLidas.map((parcela) => ({
      vencimento: parcela.vencimento,
      valorCentavos: parcela.valorCentavos,
      forma: parcela.forma as FormaDePagamento,
      pagoEm: parcela.pagoEm,
    })),
    versao,
  };
}

// O toast da correção lançada (06.5-17): a nova (`documentoId`) e o número da original que ela corrigiu,
// lidos do banco — nunca da URL. `null` quando o documento não existe ou não é uma correção.
export type CorrecaoParaAviso = {
  tipo: TipoDeDocumentoParaTexto;
  numero: number;
  numeroOriginal: number;
  totalCentavos: number;
};

export async function obterCorrecaoParaAviso(documentoId: string): Promise<CorrecaoParaAviso | null> {
  const vinculo = (await vinculosDeCorrecao([documentoId])).find((linha) => linha.corrigidoId === documentoId);
  if (!vinculo) {
    return null;
  }
  const nova = await obterDocumentoParaAviso(documentoId);
  if (!nova) {
    return null;
  }
  return {
    tipo: vinculo.tipo,
    numero: nova.numero,
    numeroOriginal: vinculo.numeroOriginal,
    totalCentavos: nova.totalCentavos,
  };
}

// A metade INVERSA de `origemOrcamento` acima (04.5-12-PLAN.md, D-25/key_link): dado um
// `documentoId`, devolve o orçamento que o gerou, ou `null`. Consulta pelo índice único
// `orcamentos_documento_id_uk` — nenhuma coluna nova no Financeiro, comentário no schema explica
// o porquê (chave circular e segunda verdade que poderiam divergir).
export async function obterOrigemDoDocumento(documentoId: string): Promise<OrigemDoDocumento | null> {
  const [linha] = await db
    .select({
      id: orcamentos.id,
      ano: orcamentos.ano,
      sequencial: orcamentos.sequencial,
      ordemId: orcamentos.encomendaId,
    })
    .from(orcamentos)
    .where(eq(orcamentos.documentoId, documentoId))
    .limit(1);

  return linha
    ? {
        orcamentoId: linha.id,
        numero: numeroDeOrcamento(linha.ano, linha.sequencial),
        ordemId: linha.ordemId,
      }
    : null;
}

export type ParcelaParaAviso = {
  tipo: TipoDeDocumentoParaTexto;
  valorCentavos: number;
  paga: boolean;
  previstoCentavos: number | null;
  // O valor da linha de diferença QUE ESTA PARCELA criou, se houver — `null` quando não há
  // (pago igual ao previsto, ou linha única ajustada em vez de diferença).
  diferencaCentavos: number | null;
};

// O aviso `pago`/`desfeito` (04.4-08-PLAN.md, Tarefa 3): a página confere aqui se a parcela AINDA
// está paga com previsto guardado antes de oferecer o "Desfazer" — recarregar depois de desfazer
// não oferece desfazer de novo (o `pagoEm` já voltou a nulo). TRÊS leituras pequenas (parcela,
// documento, linha de diferença), nunca uma consulta a mais que o aviso precisa.
export async function obterParcelaParaAviso(id: string): Promise<ParcelaParaAviso | null> {
  const [parcela] = await db
    .select({
      documentoId: parcelas.documentoId,
      valorCentavos: parcelas.valorCentavos,
      pagoEm: parcelas.pagoEm,
      valorPrevistoCentavos: parcelas.valorPrevistoCentavos,
    })
    .from(parcelas)
    .where(eq(parcelas.id, id))
    .limit(1);

  if (!parcela) {
    return null;
  }

  const [documento] = await db
    .select({ tipo: documentos.tipo })
    .from(documentos)
    .where(eq(documentos.id, parcela.documentoId))
    .limit(1);

  if (!documento) {
    return null;
  }

  const [linhaDeDiferenca] = await db
    .select({ valorCentavos: documentoLinhas.valorCentavos })
    .from(documentoLinhas)
    .where(eq(documentoLinhas.parcelaDiferencaId, id))
    .limit(1);

  return {
    tipo: documento.tipo,
    valorCentavos: parcela.valorCentavos,
    paga: parcela.pagoEm !== null,
    previstoCentavos: parcela.valorPrevistoCentavos,
    diferencaCentavos: linhaDeDiferenca ? linhaDeDiferenca.valorCentavos : null,
  };
}

// A tela Mês (04.4-09-PLAN.md, Tarefa 3): documentos NÃO cancelados com DATA no mês (Vendeu/
// Custou/Geral/Fora contam pela data do documento, BRIEFING §5), com a linha e a categoria de
// cada uma — DUAS consultas (documentos, linhas), nunca uma por documento. O intervalo é
// [primeiro dia do mês, primeiro dia do mês seguinte) — nunca `like`/`extract` sobre a coluna
// `date`, que teria de espalhar o índice de `documentos_tipo_data_idx` numa varredura completa.
export async function listarDocumentosDoMes(mes: string): Promise<DocumentoParaMes[]> {
  const inicio = primeiroDiaDoMes(mes);
  const fim = primeiroDiaDoMes(mesSeguinte(mes));

  const documentosDoMes = await db
    .select({ id: documentos.id, tipo: documentos.tipo, data: documentos.data })
    .from(documentos)
    .where(and(gte(documentos.data, inicio), lt(documentos.data, fim), isNull(documentos.canceladoEm)));

  if (documentosDoMes.length === 0) {
    return [];
  }

  const idsDosDocumentos = documentosDoMes.map((documento) => documento.id);
  const linhasCarregadas = await db
    .select({
      documentoId: documentoLinhas.documentoId,
      grupo: categorias.grupo,
      area: categorias.area,
      categoriaNome: categorias.nome,
      valorCentavos: documentoLinhas.valorCentavos,
    })
    .from(documentoLinhas)
    .innerJoin(categorias, eq(documentoLinhas.categoriaId, categorias.id))
    .where(inArray(documentoLinhas.documentoId, idsDosDocumentos));

  const linhasPorDocumento = new Map<string, LinhaDeDocumentoParaMes[]>();
  for (const linha of linhasCarregadas) {
    const lista = linhasPorDocumento.get(linha.documentoId) ?? [];
    lista.push({
      grupo: linha.grupo,
      area: linha.area,
      categoriaNome: linha.categoriaNome,
      valorCentavos: linha.valorCentavos,
    });
    linhasPorDocumento.set(linha.documentoId, lista);
  }

  return documentosDoMes.map((documento) => ({
    data: documento.data,
    tipo: documento.tipo,
    // Já filtrado por `isNull(canceladoEm)` acima — `resumoDoMes` confere de novo por dentro
    // (T-04.4-59), então este campo nunca é `true` aqui, mas o tipo continua exigindo o valor.
    cancelado: false,
    linhas: linhasPorDocumento.get(documento.id) ?? [],
  }));
}

// A tela Mês: parcelas PAGAS no mês (pela DATA DE PAGAMENTO, nunca a do documento) de documento
// NÃO cancelado — alimenta "Dinheiro que se mexeu" e a "Taxa do cartão", as duas réguas que
// `resumoDoMes` nunca mistura com `listarDocumentosDoMes`.
export async function listarParcelasPagasNoMes(mes: string): Promise<ParcelaPagaParaMes[]> {
  const inicio = primeiroDiaDoMes(mes);
  const fim = primeiroDiaDoMes(mesSeguinte(mes));

  const linhas = await db
    .select({
      pagoEm: parcelas.pagoEm,
      tipo: documentos.tipo,
      forma: parcelas.forma,
      valorCentavos: parcelas.valorCentavos,
      taxaPontosBase: parcelas.taxaPontosBase,
    })
    .from(parcelas)
    .innerJoin(documentos, eq(parcelas.documentoId, documentos.id))
    .where(
      and(
        isNotNull(parcelas.pagoEm),
        gte(parcelas.pagoEm, inicio),
        lt(parcelas.pagoEm, fim),
        isNull(documentos.canceladoEm),
      ),
    );

  return linhas.map((linha) => ({
    // `pagoEm` nunca é nulo aqui — a consulta acima só traz parcelas pagas (`isNotNull`).
    pagoEm: linha.pagoEm as string,
    tipo: linha.tipo,
    cancelado: false,
    forma: linha.forma,
    valorCentavos: linha.valorCentavos,
    taxaPontosBase: linha.taxaPontosBase,
  }));
}

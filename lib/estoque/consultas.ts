// Leituras do Estoque — sem diretiva: nada aqui é Server Action (quem chama é Server Component ou
// ação que já autorizou). Molde "consulta principal + agregado casados por `Map`" de
// `lib/precificacao/consultas.ts`/`lib/cadastros/consultas.ts`.
//
// EST-02: NÃO existe coluna de saldo nem view de saldos — o saldo e o valor em estoque são
// `SUM(quantidade_milesimos)` e `SUM(valor_centavos)` sobre `movimentacoes_estoque`, calculados
// AQUI, na hora da leitura. A lista, o banner, o bloco do Início, a contagem e o painel de Venda
// (planos seguintes) leem esta mesma função.
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import { db } from "@/db";
import {
  categorias,
  documentos,
  encomendas,
  fichasPrecificacao,
  itensCatalogo,
  movimentacoesEstoque,
  usuarios,
} from "@/db/schema";
import type { Unidade } from "@/lib/cadastros/catalogo";
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import { calcularPeca } from "@/lib/precificacao/calculo";
import { parametrosVigentes } from "@/lib/precificacao/consultas";
import { quantasCabem } from "@/lib/precificacao/forno";

import type { TipoDoHistorico } from "./abas";
import type { EntradaComPreco } from "./custo";
import type { MovimentacaoParaDescrever, SaidaParaOndeFoi } from "./historico";
import { areaDoItemNoEstoque } from "./saldo";

export type SaldoDoItem = {
  id: string;
  nome: string;
  unidade: Unidade;
  ativo: boolean;
  estoqueMinimoMilesimos: number;
  // Σ quantidade_milesimos — zero quando o item ainda não tem linha no livro.
  saldoMilesimos: number;
  // Σ valor_centavos — zero quando o item ainda não tem linha no livro.
  valorCentavos: number;
  // A área do material NO ESTOQUE: a da categoria de compra, na falta a de venda, por último
  // "geral" (`areaDoItemNoEstoque`, D-12/D-27) — nunca `areaDoItem` do Financeiro.
  area: AreaFinanceira;
  // O nome da categoria de compra (a linha de metadados do cartão e a busca).
  categoriaCompraNome: string | null;
  // Tem ficha de precificação ligada (`fichas_precificacao.item_catalogo_id`) — "peça pronta"
  // (D-29), sem depender de nome de categoria.
  ehPecaPronta: boolean;
  // A última entrada do livro com preço — a mesma leitura de `lerEstados` (gravacao.ts), aqui sem
  // trava e fora de transação. `null` = nunca houve entrada com preço (custo médio "—", D-26).
  ultimaEntradaComPreco: EntradaComPreco | null;
};

// Todo item do catálogo com estoque próprio, com o saldo e o valor somados do livro. Ordem por nome
// (a ordem de alerta — negativo, acabando, resto — é de `ordenarSaldos`, em `saldo.ts`).
//
// Quatro consultas, casadas por `Map` — nunca uma por item: (1) itens com as duas categorias por
// `alias`; depois, em paralelo, (2) as somas do livro, (3) a última entrada de cada item e (4) quais
// itens têm ficha de precificação.
export async function listarSaldos(): Promise<SaldoDoItem[]> {
  const categoriaCompra = alias(categorias, "categoria_compra_do_material");
  const categoriaVenda = alias(categorias, "categoria_venda_do_material");

  const itens = await db
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      ativo: itensCatalogo.ativo,
      estoqueMinimoMilesimos: itensCatalogo.estoqueMinimoMilesimos,
      categoriaCompraNome: categoriaCompra.nome,
      categoriaCompraArea: categoriaCompra.area,
      categoriaVendaArea: categoriaVenda.area,
    })
    .from(itensCatalogo)
    .leftJoin(categoriaCompra, eq(itensCatalogo.categoriaCompraId, categoriaCompra.id))
    .leftJoin(categoriaVenda, eq(itensCatalogo.categoriaVendaId, categoriaVenda.id))
    .where(eq(itensCatalogo.controlaEstoque, true))
    .orderBy(asc(itensCatalogo.nome));

  if (itens.length === 0) {
    return [];
  }

  const ids = itens.map((item) => item.id);

  const [somas, ultimasEntradas, fichas] = await Promise.all([
    db
      .select({
        itemId: movimentacoesEstoque.itemId,
        saldo: sql<string>`sum(${movimentacoesEstoque.quantidadeMilesimos})`,
        valor: sql<string>`sum(${movimentacoesEstoque.valorCentavos})`,
      })
      .from(movimentacoesEstoque)
      .where(inArray(movimentacoesEstoque.itemId, ids))
      .groupBy(movimentacoesEstoque.itemId),
    // A mesma regra de `lerEstados`: a última linha de tipo "entrada" pela ordem do livro
    // (`numero`); com `valor_informado_centavos`, ela é a última entrada com preço.
    db
      .selectDistinctOn([movimentacoesEstoque.itemId], {
        itemId: movimentacoesEstoque.itemId,
        valorInformadoCentavos: movimentacoesEstoque.valorInformadoCentavos,
        quantidadeMilesimos: movimentacoesEstoque.quantidadeMilesimos,
      })
      .from(movimentacoesEstoque)
      .where(and(inArray(movimentacoesEstoque.itemId, ids), eq(movimentacoesEstoque.tipo, "entrada")))
      .orderBy(movimentacoesEstoque.itemId, desc(movimentacoesEstoque.numero)),
    db
      .selectDistinct({ itemId: fichasPrecificacao.itemCatalogoId })
      .from(fichasPrecificacao)
      .where(
        and(
          isNotNull(fichasPrecificacao.itemCatalogoId),
          inArray(fichasPrecificacao.itemCatalogoId, ids),
        ),
      ),
  ]);

  const somaPorItem = new Map(somas.map((soma) => [soma.itemId, soma]));
  const ultimaPorItem = new Map(ultimasEntradas.map((linha) => [linha.itemId, linha]));
  const comFicha = new Set(fichas.map((linha) => linha.itemId));

  // `controla_estoque` exige unidade no banco (check `itens_catalogo_controla_exige_unidade_e_
  // categoria_compra`) — o filtro abaixo só estreita o tipo; nenhuma linha real é descartada.
  return itens.flatMap((item) => {
    if (item.unidade === null) {
      return [];
    }
    const soma = somaPorItem.get(item.id);
    const ultima = ultimaPorItem.get(item.id);
    return [
      {
        id: item.id,
        nome: item.nome,
        unidade: item.unidade,
        ativo: item.ativo,
        estoqueMinimoMilesimos: item.estoqueMinimoMilesimos,
        saldoMilesimos: soma ? Number(soma.saldo) : 0,
        valorCentavos: soma ? Number(soma.valor) : 0,
        area: areaDoItemNoEstoque({
          compra: item.categoriaCompraArea,
          venda: item.categoriaVendaArea,
        }),
        categoriaCompraNome: item.categoriaCompraNome,
        ehPecaPronta: comFicha.has(item.id),
        ultimaEntradaComPreco:
          ultima && ultima.valorInformadoCentavos !== null
            ? { valorCentavos: ultima.valorInformadoCentavos, milesimos: ultima.quantidadeMilesimos }
            : null,
      },
    ];
  });
}

// A mesma `listarSaldos`, memorizada POR REQUISIÇÃO (`cache` do React): a página, a folha e o
// seletor que a leem na mesma renderização fazem UMA consulta só. Fora de uma requisição (teste,
// script) se comporta como a função pura. Nunca guarda nada entre requisições.
export const listarSaldosDaRequisicao = cache(listarSaldos);

// ---------------------------------------------------------------------------------------------
// A folha completa (plano 06-05): as encomendas do vínculo e o custo da peça pronta.
// ---------------------------------------------------------------------------------------------

export type EncomendaParaVinculo = {
  id: string;
  // O que o índice de Encomendas mostra como título do cartão (o nome da encomenda).
  rotulo: string;
  clienteNome: string | null;
};

// As opções de "Qual encomenda?" (D-15): as encomendas EM ANDAMENTO — o mesmo critério de
// `listarEncomendasAtivas` (lib/encomendas/consultas.ts: rascunho ou em produção), na mesma ordem
// (`data_inicio` ascendente), sem itens nem etapas (a folha só precisa do rótulo). A ação confere
// de novo, dentro da transação, que a escolhida continua em andamento (`encomendaEmAndamento`).
export async function listarEncomendasParaVinculo(): Promise<EncomendaParaVinculo[]> {
  return db
    .select({ id: encomendas.id, rotulo: encomendas.nome, clienteNome: encomendas.clienteNome })
    .from(encomendas)
    .where(inArray(encomendas.status, ["rascunho", "em_producao"]))
    .orderBy(asc(encomendas.dataInicio));
}

// EST-21/D-22: o custo por peça de cada peça pronta, pela ficha de precificação LIGADA ao item (a
// exclusiva não tem item). `parametrosVigentes(hoje)` UMA vez; depois, por ficha, `quantasCabem` +
// `calcularPeca({ canal: "direto" }).custoCentavos` — o mesmo caminho e o mesmo número que a
// Precificação mostra (`lib/orcamentos/acoes.ts::precoInicialDaLinha`). Parâmetro faltando, peça
// que não cabe ou divisor inválido → o item fica FORA do mapa: o campo de custo vem vazio e
// obrigatório (D-22), nunca um zero inventado. Lido com a página ("parâmetros de hoje"); se a ficha
// mudar entre abrir a folha e gravar, grava-se o valor mostrado ou digitado — o servidor não
// recalcula por trás da pessoa. `hoje` chega por argumento: este módulo não lê o relógio.
export async function custosDasPecasProntas(
  itemIds: readonly string[],
  hoje: string,
): Promise<Map<string, number>> {
  const custos = new Map<string, number>();
  const unicos = [...new Set(itemIds)];
  if (unicos.length === 0) {
    return custos;
  }

  const fichas = await db
    .select({
      itemId: fichasPrecificacao.itemCatalogoId,
      argilaMiligramas: fichasPrecificacao.argilaMiligramas,
      esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
      horasMilesimos: fichasPrecificacao.horasMilesimos,
      embalagemCentavos: fichasPrecificacao.embalagemCentavos,
      larguraMm: fichasPrecificacao.larguraMm,
      profundidadeMm: fichasPrecificacao.profundidadeMm,
      alturaMm: fichasPrecificacao.alturaMm,
      cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
      cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
    })
    .from(fichasPrecificacao)
    .where(
      and(
        eq(fichasPrecificacao.exclusiva, false),
        inArray(fichasPrecificacao.itemCatalogoId, unicos),
      ),
    );
  if (fichas.length === 0) {
    return custos;
  }

  const parametros = await parametrosVigentes(hoje);
  if (!parametros.ok) {
    return custos;
  }

  for (const ficha of fichas) {
    if (ficha.itemId === null) {
      continue;
    }
    const cabem = quantasCabem(
      { larguraMm: ficha.larguraMm, profundidadeMm: ficha.profundidadeMm, alturaMm: ficha.alturaMm },
      parametros.forno,
      { biscoito: ficha.cabemBiscoitoInformado, esmalte: ficha.cabemEsmalteInformado },
    );
    const resultado = calcularPeca({
      ficha: {
        argilaMiligramas: ficha.argilaMiligramas,
        esmalteMiligramas: ficha.esmalteMiligramas,
        horasMilesimos: ficha.horasMilesimos,
        embalagemCentavos: ficha.embalagemCentavos,
      },
      cabem,
      parametros: parametros.calculo,
      taxaCartaoPontosBase: parametros.taxaCartaoPontosBase,
      canal: "direto",
    });
    if (resultado.ok && resultado.custoCentavos > 0) {
      custos.set(ficha.itemId, resultado.custoCentavos);
    }
  }
  return custos;
}

// ---------------------------------------------------------------------------------------------
// O livro lido (plano 06-07): a aba Histórico e a aba Para onde foi. Leitura pura — nenhuma escrita.
// ---------------------------------------------------------------------------------------------

// Uma linha do Histórico: o que `descreverMovimentacao` (historico.ts) precisa, mais quem registrou,
// quando, e o material. `numero` é a ordem do livro (identity única — nunca empata).
export type LinhaDoHistorico = MovimentacaoParaDescrever & {
  id: string;
  numero: number;
  itemId: string;
  itemNome: string;
  registradoPorNome: string;
  criadoEm: Date;
};

function filtroDoTipo(tipo: TipoDoHistorico): SQL | undefined {
  return tipo === "tudo" ? undefined : eq(movimentacoesEstoque.tipo, tipo);
}

// As `limite` movimentações mais recentes, de todos os materiais, pela ORDEM DE GRAVAÇÃO (`numero`
// decrescente) — nunca `criado_em`, que empata dentro de uma transação (uma venda que baixa dois
// insumos grava as duas linhas no mesmo instante; EST-05 · ordering/adjacency). Lê `limite + 1` para
// saber se há mais sem uma segunda consulta.
//
// UMA consulta: o material (nome, unidade), quem registrou (`registrado_por` é `not null` — o autor
// nunca falta), o documento do Financeiro (número) e a marca `estornada` — a junção com o estorno
// que aponta para a linha; a restrição única `movimentacoes_estoque_estorno_de_uk` garante no máximo
// um, então a junção nunca duplica linha. `tipo` e `limite` chegam já normalizados por
// `lib/estoque/abas.ts` (T-06-28/T-06-29).
export async function listarHistorico({
  tipo,
  limite,
}: {
  tipo: TipoDoHistorico;
  limite: number;
}): Promise<{ linhas: LinhaDoHistorico[]; haMais: boolean }> {
  const estorno = alias(movimentacoesEstoque, "estorno_da_movimentacao");

  const linhas = await db
    .select({
      id: movimentacoesEstoque.id,
      numero: movimentacoesEstoque.numero,
      itemId: movimentacoesEstoque.itemId,
      itemNome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      origem: movimentacoesEstoque.origem,
      tipo: movimentacoesEstoque.tipo,
      motivo: movimentacoesEstoque.motivo,
      destino: movimentacoesEstoque.destino,
      area: movimentacoesEstoque.area,
      quantidadeMilesimos: movimentacoesEstoque.quantidadeMilesimos,
      valorCentavos: movimentacoesEstoque.valorCentavos,
      valorInformadoCentavos: movimentacoesEstoque.valorInformadoCentavos,
      saldoContadoMilesimos: movimentacoesEstoque.saldoContadoMilesimos,
      nota: movimentacoesEstoque.nota,
      estornoDeId: movimentacoesEstoque.estornoDeId,
      documentoNumero: documentos.numero,
      registradoPorNome: usuarios.nome,
      criadoEm: movimentacoesEstoque.criadoEm,
      estornoId: estorno.id,
    })
    .from(movimentacoesEstoque)
    .innerJoin(itensCatalogo, eq(movimentacoesEstoque.itemId, itensCatalogo.id))
    .innerJoin(usuarios, eq(movimentacoesEstoque.registradoPor, usuarios.id))
    .leftJoin(documentos, eq(movimentacoesEstoque.documentoId, documentos.id))
    .leftJoin(estorno, eq(estorno.estornoDeId, movimentacoesEstoque.id))
    .where(filtroDoTipo(tipo))
    .orderBy(desc(movimentacoesEstoque.numero))
    .limit(limite + 1);

  const haMais = linhas.length > limite;
  // Item com movimentação tem unidade (o gatilho da 0023 trava a unidade e `controla_estoque`) — o
  // filtro só estreita o tipo; nenhuma linha real é descartada.
  const doLivro = linhas.slice(0, limite).flatMap((linha) => {
    if (linha.unidade === null) {
      return [];
    }
    return [
      {
        id: linha.id,
        numero: linha.numero,
        itemId: linha.itemId,
        itemNome: linha.itemNome,
        unidade: linha.unidade,
        origem: linha.origem,
        tipo: linha.tipo,
        motivo: linha.motivo,
        destino: linha.destino,
        area: linha.area,
        quantidadeMilesimos: linha.quantidadeMilesimos,
        valorCentavos: linha.valorCentavos,
        valorInformadoCentavos: linha.valorInformadoCentavos,
        saldoContadoMilesimos: linha.saldoContadoMilesimos,
        nota: linha.nota,
        documentoNumero: linha.documentoNumero,
        ehEstorno: linha.estornoDeId !== null,
        estornada: linha.estornoId !== null,
        registradoPorNome: linha.registradoPorNome,
        criadoEm: linha.criadoEm,
      },
    ];
  });

  return { linhas: doLivro, haMais };
}

// Quantas movimentações o livro tem, no tipo pedido — o "{N} movimentações" das pílulas.
export async function contarHistorico({ tipo }: { tipo: TipoDoHistorico }): Promise<number> {
  const [resultado] = await db
    .select({ quantas: count() })
    .from(movimentacoesEstoque)
    .where(filtroDoTipo(tipo));
  return resultado ? Number(resultado.quantas) : 0;
}

// As saídas do período para o "Para onde foi": de origem `manual` ou `venda`, que NÃO são estorno,
// com a marca `estornada` (a mesma junção de `listarHistorico`). Quem decide o que conta como
// consumo é `agregarParaOndeFoi` (historico.ts), por regra testada — este `where` só economiza
// linhas. `desde` é a data civil de início ("AAAA-MM-DD", de `inicioDoPeriodo`): o corte é a
// meia-noite desse dia EM BRASÍLIA, convertida no próprio Postgres (`at time zone`), nunca o fuso do
// banco nem o do processo; `null` = "Tudo". UMA consulta, nunca uma por destino.
export async function saidasParaOndeFoi({
  desde,
}: {
  desde: string | null;
}): Promise<SaidaParaOndeFoi[]> {
  const estorno = alias(movimentacoesEstoque, "estorno_da_saida");

  const condicoes: SQL[] = [
    eq(movimentacoesEstoque.tipo, "saida"),
    inArray(movimentacoesEstoque.origem, ["manual", "venda"]),
    isNull(movimentacoesEstoque.estornoDeId),
  ];
  if (desde !== null) {
    condicoes.push(
      sql`${movimentacoesEstoque.criadoEm} >= (${desde}::date)::timestamp at time zone 'America/Sao_Paulo'`,
    );
  }

  const linhas = await db
    .select({
      origem: movimentacoesEstoque.origem,
      tipo: movimentacoesEstoque.tipo,
      destino: movimentacoesEstoque.destino,
      area: movimentacoesEstoque.area,
      valorCentavos: movimentacoesEstoque.valorCentavos,
      estornoDeId: movimentacoesEstoque.estornoDeId,
      estornoId: estorno.id,
    })
    .from(movimentacoesEstoque)
    .leftJoin(estorno, eq(estorno.estornoDeId, movimentacoesEstoque.id))
    .where(and(...condicoes));

  return linhas.map((linha) => ({
    origem: linha.origem,
    tipo: linha.tipo,
    destino: linha.destino,
    area: linha.area,
    valorCentavos: linha.valorCentavos,
    ehEstorno: linha.estornoDeId !== null,
    estornada: linha.estornoId !== null,
  }));
}

// Módulo puro do Estoque — o PEDIDO de movimentação: o que se quer gravar, antes de ser valorado.
// Só imports de módulos puros (os do próprio Estoque e, desde o plano 06-03, o cálculo
// `lib/financeiro/efeito-estoque.ts`, puro, sem import de banco); nenhuma linha alcança React, Next,
// drizzle-orm, pg ou `@/db` (grep de aceite do plano 06-01). As uniões de origem, tipo e motivo são REDECLARADAS à
// mão, espelhando os enums da migração 0023 (`origem_movimentacao`, `tipo_movimentacao`,
// `motivo_movimentacao`) — nenhum import de `@/db/schema` é permitido aqui.
//
// Um pedido NÃO carrega valor em dinheiro gravado: carrega o `Movimento` (quantidade e, numa
// entrada com preço, quanto se pagou). O valor de cada linha é decidido por `lib/estoque/custo.ts`
// sob a trava de `lib/estoque/gravacao.ts` — nunca aceito do cliente, nunca calculado aqui.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import { efeitoNoEstoque, type ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";

import { movimentoDoEstorno, type Movimento } from "./custo";
import { areaDoDestino, type DestinoDeSaida } from "./destinos";

export type OrigemDaMovimentacao = "venda" | "compra" | "producao" | "manual";
export type TipoDaMovimentacao = "entrada" | "saida" | "ajuste";
export type MotivoDaMovimentacao = "saldo_inicial" | "peca_pronta";

export type PedidoDeMovimentacao = {
  itemId: string;
  origem: OrigemDaMovimentacao;
  tipo: TipoDaMovimentacao;
  movimento: Movimento;
  motivo?: MotivoDaMovimentacao;
  destino?: DestinoDeSaida;
  area?: AreaFinanceira;
  valorInformadoCentavos?: number;
  saldoContadoMilesimos?: number;
  documentoId?: string;
  documentoLinhaId?: string;
  encomendaId?: string;
  nota?: string;
  estornoDeId?: string;
};

// Entrada manual ("Registrar entrada"): entra com preço — "quanto custou ao todo" é o valor
// informado da nota e o preço do custo médio (R2/R3).
//
// `pecaPronta` (D-09/D-29, plano 06-05): a peça pronta entra à mão, com custo, até a Produção
// existir; o motivo `peca_pronta` a distingue no histórico. Quem decide se o item É peça pronta é a
// ação, pela ficha de precificação ligada, dentro da transação — nunca o cliente (T-06-23).
export function pedidoDeEntradaManual(dados: {
  itemId: string;
  milesimos: number;
  custoCentavos: number;
  pecaPronta?: boolean;
}): PedidoDeMovimentacao {
  return {
    itemId: dados.itemId,
    origem: "manual",
    tipo: "entrada",
    movimento: {
      tipo: "entrada_com_preco",
      milesimos: dados.milesimos,
      pagoCentavos: dados.custoCentavos,
    },
    valorInformadoCentavos: dados.custoCentavos,
    ...(dados.pecaPronta ? { motivo: "peca_pronta" as const } : {}),
  };
}

// Saída manual ("Registrar baixa"): o destino é obrigatório, e a ÁREA que paga sai dele (D-14) —
// nunca do cliente. `nota` é o vínculo em texto (turma, "o que aconteceu?" ou o nome CONGELADO da
// encomenda — Pitfall 10: se ela for apagada, o nome fica); `encomendaId` só existe no destino
// encomenda (o `check` `movimentacoes_estoque_encomenda_so_no_destino_encomenda` recusaria).
export function pedidoDeSaidaManual(dados: {
  itemId: string;
  milesimos: number;
  destino: DestinoDeSaida;
  nota?: string | null;
  encomendaId?: string | null;
}): PedidoDeMovimentacao {
  return {
    itemId: dados.itemId,
    origem: "manual",
    tipo: "saida",
    movimento: { tipo: "saida", milesimos: dados.milesimos },
    destino: dados.destino,
    area: areaDoDestino(dados.destino),
    ...(dados.destino === "encomenda" && dados.encomendaId
      ? { encomendaId: dados.encomendaId }
      : {}),
    ...(dados.nota ? { nota: dados.nota } : {}),
  };
}

// Ajuste pelo saldo contado (EST-07): a DIFERENÇA já foi decidida por `planejarAjuste` (saldo.ts)
// contra o saldo lido SOB A TRAVA (`gravarAjuste`) — nunca vem do cliente (T-06-22). Para menos,
// sai ao custo médio (R5); para mais, entra SEM preço, à taxa corrente (R6). O contado vai gravado
// em `saldo_contado_milesimos` com o que foi digitado. Diferença zero não é pedido: é "nada a
// gravar" (EST-08), decidido antes.
export function pedidoDeAjuste(dados: {
  itemId: string;
  diferencaMilesimos: number;
  contadoMilesimos: number;
  nota: string | null;
}): PedidoDeMovimentacao {
  if (dados.diferencaMilesimos === 0) {
    throw new RangeError("pedidoDeAjuste: diferença zero não grava nada (EST-08).");
  }
  const milesimos = Math.abs(dados.diferencaMilesimos);
  return {
    itemId: dados.itemId,
    origem: "manual",
    tipo: "ajuste",
    movimento:
      dados.diferencaMilesimos < 0
        ? { tipo: "saida", milesimos }
        : { tipo: "entrada_sem_preco", milesimos },
    saldoContadoMilesimos: dados.contadoMilesimos,
    ...(dados.nota ? { nota: dados.nota } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Os pedidos do Financeiro (plano 06-03): a venda baixa, a compra dá entrada.
//
// POR LINHA, e não pelo documento inteiro (06-RESEARCH.md §Pergunta 1): `efeitoNoEstoque` é
// chamado UMA vez por linha do documento. O efeito agregado perde duas coisas que o livro precisa:
// (a) a LINHA — e, com ela, a área que pagou (dois produtos de áreas diferentes gastando o mesmo
// insumo viram uma saída só, sem área certa); (b) na compra, o CUSTO por linha — o agregado soma a
// quantidade e fica com o custo da última linha do mesmo item. A função é linear em inteiros, então
// continua sendo o MESMO cálculo (D-03): `tests/unit/financeiro-efeito-estoque.test.ts` prova que
// Σ efeito([linha_i]) por item == efeito(linhas). Nenhum segundo cálculo de ficha × quantidade
// existe no código — este arquivo só traduz a saída de `efeitoNoEstoque` em pedidos.
// ---------------------------------------------------------------------------------------------

// Uma linha de venda JÁ INSERIDA em `documento_linhas` (o `documentoLinhaId` vem do `returning`).
export type LinhaDeVendaGravada = {
  documentoLinhaId: string;
  // `null` numa linha de valor livre — não tira nada do estoque.
  itemId: string | null;
  quantidade: number;
  // A categoria de VENDA da linha: a área da baixa sai dela (D-27).
  categoriaId: string;
};

// Uma linha de compra de material JÁ INSERIDA.
export type LinhaDeCompraGravada = {
  documentoLinhaId: string;
  itemId: string | null;
  // Texto decimal com ponto ("25", "0.001") — o que chegou, na unidade do item.
  quantidadeEstoque: string | null;
  // O valor da linha (o que a nota diz). O custo unitário NUNCA é gravado arredondado: é valor ÷
  // quantidade na hora de mostrar (EST-15/D-19 — 3 un por R$ 10,00 não viram 333 × 3 = R$ 9,99).
  valorCentavos: number;
};

// Saídas da venda, na ordem das linhas e, dentro de uma linha, na ordem do efeito. O `documentoId`
// é acrescentado pela ação (o pedido nasce aqui sem ele). Saldo nunca é consultado: negativo não
// bloqueia venda (D-06).
export function pedidosDaVenda(
  linhas: readonly LinhaDeVendaGravada[],
  itens: readonly ItemParaEfeito[],
  areaPorCategoria: ReadonlyMap<string, AreaFinanceira>,
): PedidoDeMovimentacao[] {
  const pedidos: PedidoDeMovimentacao[] = [];
  for (const linha of linhas) {
    if (!linha.itemId) {
      continue;
    }
    const efeito = efeitoNoEstoque(
      [{ itemId: linha.itemId, quantidade: linha.quantidade }],
      itens,
      "venda",
    );
    if (efeito.length === 0) {
      continue;
    }
    const area = areaPorCategoria.get(linha.categoriaId);
    if (!area) {
      // O `check` `movimentacoes_estoque_venda_exige_area` recusaria de qualquer jeito; falhar aqui
      // dá uma mensagem de log que diz o porquê.
      throw new Error(
        `pedidosDaVenda: a categoria ${linha.categoriaId} da linha ${linha.documentoLinhaId} não tem área conhecida.`,
      );
    }
    for (const entrada of efeito) {
      if (entrada.variacaoMilesimos === 0) {
        continue;
      }
      pedidos.push({
        itemId: entrada.itemId,
        origem: "venda",
        tipo: "saida",
        movimento: { tipo: "saida", milesimos: Math.abs(entrada.variacaoMilesimos) },
        area,
        documentoLinhaId: linha.documentoLinhaId,
      });
    }
  }
  return pedidos;
}

// Entradas da compra, uma por linha. Valor 0 (se um dia o conversor deixar passar) vira entrada SEM
// preço — à taxa corrente (R6) — em vez de fingir que o material custou zero; o valor informado
// continua sendo o da nota, 0.
export function pedidosDaCompra(
  linhas: readonly LinhaDeCompraGravada[],
  itens: readonly ItemParaEfeito[],
): PedidoDeMovimentacao[] {
  const pedidos: PedidoDeMovimentacao[] = [];
  for (const linha of linhas) {
    if (!linha.itemId || !linha.quantidadeEstoque) {
      continue;
    }
    const efeito = efeitoNoEstoque(
      [
        {
          itemId: linha.itemId,
          quantidade: 1,
          quantidadeEstoque: linha.quantidadeEstoque,
          valorCentavos: linha.valorCentavos,
        },
      ],
      itens,
      "compra",
    );
    for (const entrada of efeito) {
      if (entrada.variacaoMilesimos <= 0) {
        continue;
      }
      pedidos.push({
        itemId: entrada.itemId,
        origem: "compra",
        tipo: "entrada",
        movimento:
          linha.valorCentavos > 0
            ? {
                tipo: "entrada_com_preco",
                milesimos: entrada.variacaoMilesimos,
                pagoCentavos: linha.valorCentavos,
              }
            : { tipo: "entrada_sem_preco", milesimos: entrada.variacaoMilesimos },
        valorInformadoCentavos: linha.valorCentavos,
        documentoLinhaId: linha.documentoLinhaId,
      });
    }
  }
  return pedidos;
}

// ---------------------------------------------------------------------------------------------
// O estorno do cancelamento (plano 06-03, D-04).
//
// O estorno ESPELHA o livro, nunca recalcula (Pitfall 4): chamar `efeitoNoEstoque` de novo usaria
// a ficha técnica de HOJE — que pode ter mudado desde a venda — e devolveria ao estoque um insumo
// que a venda nunca tirou. Documento lançado antes do Estoque não tem movimentação: zero originais,
// zero estornos (D-05). O VALOR de cada estorno é decidido em `movimentoDoEstorno`
// (lib/estoque/custo.ts, D-23/D-24 — o único lugar onde essa regra mora).
// ---------------------------------------------------------------------------------------------

// Uma movimentação gravada que ainda não tem estorno (`originaisSemEstorno` em gravacao.ts).
export type MovimentacaoOriginal = {
  id: string;
  itemId: string;
  origem: OrigemDaMovimentacao;
  tipo: TipoDaMovimentacao;
  quantidadeMilesimos: number;
  valorCentavos: number;
  area: AreaFinanceira | null;
  documentoId: string | null;
  documentoLinhaId: string | null;
};

// Um pedido espelho por original, na mesma ordem: tipo oposto, mesma origem, `estornoDeId` = id da
// original, documento/linha/área copiados. Quando o estorno é uma ENTRADA (volta de uma venda), o
// `check` da 0023 exige valor informado — é o absoluto do valor da original.
export function pedidosDoEstorno(originais: readonly MovimentacaoOriginal[]): PedidoDeMovimentacao[] {
  return originais.map((original) => {
    const movimento = movimentoDoEstorno(original);
    const tipo: TipoDaMovimentacao = movimento.tipo === "saida" ? "saida" : "entrada";
    return {
      itemId: original.itemId,
      origem: original.origem,
      tipo,
      movimento,
      ...(tipo === "entrada" ? { valorInformadoCentavos: Math.abs(original.valorCentavos) } : {}),
      estornoDeId: original.id,
      ...(original.area ? { area: original.area } : {}),
      ...(original.documentoId ? { documentoId: original.documentoId } : {}),
      ...(original.documentoLinhaId ? { documentoLinhaId: original.documentoLinhaId } : {}),
    };
  });
}

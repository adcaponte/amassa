// Módulo puro do Estoque — o PEDIDO de movimentação: o que se quer gravar, antes de ser valorado.
// Só imports de módulos puros do próprio Estoque; nenhuma linha alcança React, Next, drizzle-orm, pg
// ou `@/db` (grep de aceite do plano 06-01). As uniões de origem, tipo e motivo são REDECLARADAS à
// mão, espelhando os enums da migração 0023 (`origem_movimentacao`, `tipo_movimentacao`,
// `motivo_movimentacao`) — nenhum import de `@/db/schema` é permitido aqui.
//
// Um pedido NÃO carrega valor em dinheiro gravado: carrega o `Movimento` (quantidade e, numa
// entrada com preço, quanto se pagou). O valor de cada linha é decidido por `lib/estoque/custo.ts`
// sob a trava de `lib/estoque/gravacao.ts` — nunca aceito do cliente, nunca calculado aqui.
import type { AreaFinanceira } from "@/lib/cadastros/categorias";

import type { Movimento } from "./custo";
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
export function pedidoDeEntradaManual(dados: {
  itemId: string;
  milesimos: number;
  custoCentavos: number;
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
  };
}

// Saída manual ("Registrar baixa"): o destino é obrigatório, e a ÁREA que paga sai dele (D-14) —
// nunca do cliente.
export function pedidoDeSaidaManual(dados: {
  itemId: string;
  milesimos: number;
  destino: DestinoDeSaida;
}): PedidoDeMovimentacao {
  return {
    itemId: dados.itemId,
    origem: "manual",
    tipo: "saida",
    movimento: { tipo: "saida", milesimos: dados.milesimos },
    destino: dados.destino,
    area: areaDoDestino(dados.destino),
  };
}

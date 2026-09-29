// Leituras do Estoque — sem diretiva: nada aqui é Server Action (quem chama é Server Component ou
// ação que já autorizou). Molde "consulta principal + agregado casados por `Map`" de
// `lib/precificacao/consultas.ts`/`lib/cadastros/consultas.ts`.
//
// EST-02: NÃO existe coluna de saldo nem view de saldos — o saldo e o valor em estoque são
// `SUM(quantidade_milesimos)` e `SUM(valor_centavos)` sobre `movimentacoes_estoque`, calculados
// AQUI, na hora da leitura. A lista, o banner, o bloco do Início, a contagem e o painel de Venda
// (planos seguintes) leem esta mesma função.
import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { itensCatalogo, movimentacoesEstoque } from "@/db/schema";
import type { Unidade } from "@/lib/cadastros/catalogo";

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
};

// Todo item do catálogo com estoque próprio, com o saldo e o valor somados do livro. Ordem por nome
// (a ordem de alerta — negativo, acabando, resto — é do módulo puro de saldo, num plano seguinte).
export async function listarSaldos(): Promise<SaldoDoItem[]> {
  const itens = await db
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      ativo: itensCatalogo.ativo,
      estoqueMinimoMilesimos: itensCatalogo.estoqueMinimoMilesimos,
    })
    .from(itensCatalogo)
    .where(eq(itensCatalogo.controlaEstoque, true))
    .orderBy(asc(itensCatalogo.nome));

  if (itens.length === 0) {
    return [];
  }

  const somas = await db
    .select({
      itemId: movimentacoesEstoque.itemId,
      saldo: sql<string>`sum(${movimentacoesEstoque.quantidadeMilesimos})`,
      valor: sql<string>`sum(${movimentacoesEstoque.valorCentavos})`,
    })
    .from(movimentacoesEstoque)
    .where(
      inArray(
        movimentacoesEstoque.itemId,
        itens.map((item) => item.id),
      ),
    )
    .groupBy(movimentacoesEstoque.itemId);

  const somaPorItem = new Map(somas.map((soma) => [soma.itemId, soma]));

  // `controla_estoque` exige unidade no banco (check `itens_catalogo_controla_exige_unidade_e_
  // categoria_compra`) — o filtro abaixo só estreita o tipo; nenhuma linha real é descartada.
  return itens.flatMap((item) => {
    if (item.unidade === null) {
      return [];
    }
    const soma = somaPorItem.get(item.id);
    return [
      {
        id: item.id,
        nome: item.nome,
        unidade: item.unidade,
        ativo: item.ativo,
        estoqueMinimoMilesimos: item.estoqueMinimoMilesimos,
        saldoMilesimos: soma ? Number(soma.saldo) : 0,
        valorCentavos: soma ? Number(soma.valor) : 0,
      },
    ];
  });
}

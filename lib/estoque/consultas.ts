// Leituras do Estoque — sem diretiva: nada aqui é Server Action (quem chama é Server Component ou
// ação que já autorizou). Molde "consulta principal + agregado casados por `Map`" de
// `lib/precificacao/consultas.ts`/`lib/cadastros/consultas.ts`.
//
// EST-02: NÃO existe coluna de saldo nem view de saldos — o saldo e o valor em estoque são
// `SUM(quantidade_milesimos)` e `SUM(valor_centavos)` sobre `movimentacoes_estoque`, calculados
// AQUI, na hora da leitura. A lista, o banner, o bloco do Início, a contagem e o painel de Venda
// (planos seguintes) leem esta mesma função.
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { categorias, fichasPrecificacao, itensCatalogo, movimentacoesEstoque } from "@/db/schema";
import type { Unidade } from "@/lib/cadastros/catalogo";
import type { AreaFinanceira } from "@/lib/cadastros/categorias";

import type { EntradaComPreco } from "./custo";
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

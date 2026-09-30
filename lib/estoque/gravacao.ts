// A ÚNICA porta de escrita de `movimentacoes_estoque` (plano 06-01). Nenhum outro arquivo insere
// nesta tabela — grep de aceite: `insert(movimentacoesEstoque)` só aparece aqui.
//
// 🔴 SEM a diretiva `use server`, de propósito (06-RESEARCH.md Pattern 4 / Pitfall 7): toda função exportada de
// um arquivo com a diretiva vira Server Action — chamável pelo navegador — e `npm run
// verificar-acoes` exigiria `exigirUsuario()` na primeira linha de cada uma. Estas funções recebem
// a TRANSAÇÃO de quem chama (a ação do Estoque hoje; a venda, a compra e o cancelamento do
// Financeiro no plano 06-03), por isso só são alcançáveis de dentro do servidor, depois que a ação
// que as chama já autorizou o usuário.
//
// A sequência, sempre dentro de UMA transação:
//   1. TRAVAR os itens afetados — UMA consulta, ids únicos em ordem de id, `for no key update`;
//   2. LER Q (Σ quantidade), V (Σ valor) e a última entrada com preço de cada item — DEPOIS da trava;
//   3. VALORAR cada pedido em sequência com `lib/estoque/custo.ts` (o estado de um item avança pedido
//      a pedido, para duas linhas do mesmo item no mesmo documento);
//   4. INSERIR tudo num `insert ... values` só.
//
// Por que `for no key update` e não `for update` (Pitfall 2): ao inserir uma linha em
// `documento_linhas` com `item_id = X`, a checagem de chave estrangeira segura `FOR KEY SHARE` na
// linha X de `itens_catalogo`. `FOR UPDATE` conflita com `FOR KEY SHARE` — duas vendas do mesmo item
// entrariam em impasse (A insere a linha, B insere a linha, A pede a trava e espera B, B pede e
// espera A). `FOR NO KEY UPDATE` não conflita com `FOR KEY SHARE`, e continua excluindo outra
// `FOR NO KEY UPDATE` — é o que serializa duas decisões sobre o mesmo saldo. A ordem fixa por id
// elimina o impasse entre duas vendas que tocam os mesmos insumos em ordens diferentes. O plano 06-02
// prova as duas coisas com duas conexões de verdade.
//
// Ordem de travas do sistema inteiro (06-RESEARCH.md §Pergunta 5), para nunca haver ciclo:
// DOCUMENTO → ITENS. `cancelarDocumento` trava o documento e depois os itens; `lancarVenda`/
// `lancarDespesa` criam o documento (linha nova, ninguém mais a vê) e depois travam os itens;
// `editarItem` trava só o item. Nenhum caminho trava itens e depois um documento existente.
//
// Por que READ COMMITTED (o padrão do Postgres, que `db/index.ts` não muda) e NÃO `repeatable read`:
// em READ COMMITTED cada comando enxerga o que foi comitado antes de ELE começar — o `SUM` lido
// depois da trava enxerga a gravação de quem segurava a trava antes. Em `repeatable read` o retrato
// seria tirado no primeiro comando da transação, ANTES da trava, e o `SUM` sairia velho.
import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { db } from "@/db";
import {
  categorias,
  fichaTecnica,
  fichasPrecificacao,
  itensCatalogo,
  movimentacoesEstoque,
  ordensProducao,
} from "@/db/schema";
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import type { Unidade } from "@/lib/cadastros/catalogo";
import type { ItemParaEfeito } from "@/lib/financeiro/efeito-estoque";

import { ESTADO_VAZIO, valorarMovimento, type EstadoDoItem } from "./custo";
import {
  conferirSaldoDoCusto,
  modoDoMaterial,
  planejarContagem,
  type ModoDaContagem,
} from "./contagem";
import {
  pedidoDeAjuste,
  pedidoDeContagem,
  type MovimentacaoOriginal,
  type PedidoDeMovimentacao,
} from "./pedidos";
import { planejarAjuste } from "./saldo";

// O tipo da transação do Drizzle, derivado do próprio `db` — mesma técnica de
// `lib/anotacoes/acoes.ts` (nunca importado de `drizzle-orm/node-postgres`).
export type TransacaoDoBanco = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ItemTravado = {
  id: string;
  nome: string;
  unidade: Unidade | null;
  ativo: boolean;
  controlaEstoque: boolean;
};

export type MovimentacaoGravada = {
  id: string;
  numero: number;
  itemId: string;
  quantidadeMilesimos: number;
  valorCentavos: number;
  saldoAntesMilesimos: number;
  saldoDepoisMilesimos: number;
};

function idsUnicosEmOrdem(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

// Trava os itens numa consulta só, em ordem de id, com `for no key update` (ver o cabeçalho).
// Devolve o que a ação precisa para decidir (existe? ativo? tem estoque próprio?) — lido JÁ sob a
// trava. Item ausente do mapa = não existe mais.
export async function travarItens(
  tx: TransacaoDoBanco,
  ids: readonly string[],
): Promise<Map<string, ItemTravado>> {
  const unicos = idsUnicosEmOrdem(ids);
  if (unicos.length === 0) {
    return new Map();
  }
  const linhas = await tx
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      ativo: itensCatalogo.ativo,
      controlaEstoque: itensCatalogo.controlaEstoque,
    })
    .from(itensCatalogo)
    .where(inArray(itensCatalogo.id, unicos))
    .orderBy(asc(itensCatalogo.id))
    .for("no key update");

  return new Map(linhas.map((linha) => [linha.id, linha]));
}

// Q, V e a última entrada com preço de cada item — chamada SÓ depois de `travarItens` na mesma
// transação. `sum()` de `bigint` volta como texto do `pg` (numeric) → `Number(...)`, seguro abaixo
// de 2^53. Item sem nenhuma linha no livro não aparece no mapa: quem lê usa `ESTADO_VAZIO`.
//
// "Última entrada com preço" = a linha de `tipo = 'entrada'` SEM `estorno_de_id` (o estorno de
// venda não conta — WR-02) de maior `numero` (a ordem do livro, nunca `criado_em`). Toda linha de entrada tem `valor_informado_centavos` (check da 0023): é o
// preço pago P daquela entrada, o mesmo que `custo.ts` guarda em `estadoDepois`.
export async function lerEstados(
  tx: TransacaoDoBanco,
  ids: readonly string[],
): Promise<Map<string, EstadoDoItem>> {
  const unicos = idsUnicosEmOrdem(ids);
  const estados = new Map<string, EstadoDoItem>();
  if (unicos.length === 0) {
    return estados;
  }

  const somas = await tx
    .select({
      itemId: movimentacoesEstoque.itemId,
      saldo: sql<string>`sum(${movimentacoesEstoque.quantidadeMilesimos})`,
      valor: sql<string>`sum(${movimentacoesEstoque.valorCentavos})`,
    })
    .from(movimentacoesEstoque)
    .where(inArray(movimentacoesEstoque.itemId, unicos))
    .groupBy(movimentacoesEstoque.itemId);

  const ultimasEntradas = await tx
    .selectDistinctOn([movimentacoesEstoque.itemId], {
      itemId: movimentacoesEstoque.itemId,
      valorInformadoCentavos: movimentacoesEstoque.valorInformadoCentavos,
      quantidadeMilesimos: movimentacoesEstoque.quantidadeMilesimos,
    })
    .from(movimentacoesEstoque)
    .where(
      and(
        inArray(movimentacoesEstoque.itemId, unicos),
        eq(movimentacoesEstoque.tipo, "entrada"),
        // O estorno de venda não conta (WR-02, decidido pelo dono em 29/09/2026) — a mesma regra
        // de `valorarMovimento`, que não o guarda como última entrada com preço.
        isNull(movimentacoesEstoque.estornoDeId),
      ),
    )
    .orderBy(movimentacoesEstoque.itemId, desc(movimentacoesEstoque.numero));

  const ultimaPorItem = new Map(ultimasEntradas.map((linha) => [linha.itemId, linha]));

  for (const soma of somas) {
    const ultima = ultimaPorItem.get(soma.itemId);
    estados.set(soma.itemId, {
      saldoMilesimos: Number(soma.saldo),
      valorCentavos: Number(soma.valor),
      ultimaEntradaComPreco:
        ultima && ultima.valorInformadoCentavos !== null
          ? { valorCentavos: ultima.valorInformadoCentavos, milesimos: ultima.quantidadeMilesimos }
          : null,
    });
  }
  return estados;
}

function conferirTipoDoPedido(pedido: PedidoDeMovimentacao): void {
  const { tipo, movimento } = pedido;
  const coerente =
    tipo === "ajuste" ||
    (tipo === "entrada" && movimento.tipo !== "saida") ||
    (tipo === "saida" && movimento.tipo === "saida");
  if (!coerente) {
    throw new Error(
      `gravarMovimentacoes: pedido de tipo "${tipo}" com movimento "${movimento.tipo}" — incoerente.`,
    );
  }
}

// Trava → lê → valora em sequência → insere, na transação de quem chama. Devolve as linhas gravadas
// na MESMA ordem dos pedidos, com o saldo antes e depois de cada uma (o toast diz o que foi
// GRAVADO, não o que a folha previu).
export async function gravarMovimentacoes(
  tx: TransacaoDoBanco,
  pedidos: readonly PedidoDeMovimentacao[],
  contexto: { registradoPor: string },
): Promise<MovimentacaoGravada[]> {
  if (pedidos.length === 0) {
    return [];
  }

  const ids = pedidos.map((pedido) => pedido.itemId);
  await travarItens(tx, ids);
  const estados = await lerEstados(tx, ids);

  // O id de cada linha nasce aqui (e não no `default` do banco) para casar a linha devolvida pelo
  // `returning` com o pedido que a originou sem depender da ordem de retorno do `insert`.
  const valoradas = pedidos.map((pedido) => {
    conferirTipoDoPedido(pedido);
    const estadoAntes = estados.get(pedido.itemId) ?? ESTADO_VAZIO;
    const valorado = valorarMovimento(estadoAntes, pedido.movimento);
    estados.set(pedido.itemId, valorado.estadoDepois);
    return {
      id: randomUUID(),
      pedido,
      valorado,
      saldoAntesMilesimos: estadoAntes.saldoMilesimos,
    };
  });

  const gravadas = await tx
    .insert(movimentacoesEstoque)
    .values(
      valoradas.map(({ id, pedido, valorado }) => ({
        id,
        itemId: pedido.itemId,
        origem: pedido.origem,
        tipo: pedido.tipo,
        motivo: pedido.motivo ?? null,
        destino: pedido.destino ?? null,
        area: pedido.area ?? null,
        quantidadeMilesimos: valorado.quantidadeMilesimos,
        valorCentavos: valorado.valorCentavos,
        valorInformadoCentavos: pedido.valorInformadoCentavos ?? null,
        saldoContadoMilesimos: pedido.saldoContadoMilesimos ?? null,
        documentoId: pedido.documentoId ?? null,
        documentoLinhaId: pedido.documentoLinhaId ?? null,
        encomendaId: pedido.encomendaId ?? null,
        materialDaOrdem: pedido.materialDaOrdem ?? null,
        nota: pedido.nota ?? null,
        estornoDeId: pedido.estornoDeId ?? null,
        registradoPor: contexto.registradoPor,
      })),
    )
    .returning({ id: movimentacoesEstoque.id, numero: movimentacoesEstoque.numero });

  const numeroPorId = new Map(gravadas.map((linha) => [linha.id, linha.numero]));

  return valoradas.map(({ id, pedido, valorado, saldoAntesMilesimos }) => {
    const numero = numeroPorId.get(id);
    if (numero === undefined) {
      throw new Error("gravarMovimentacoes: uma linha inserida não voltou no returning.");
    }
    return {
      id,
      numero,
      itemId: pedido.itemId,
      quantidadeMilesimos: valorado.quantidadeMilesimos,
      valorCentavos: valorado.valorCentavos,
      saldoAntesMilesimos,
      saldoDepoisMilesimos: valorado.estadoDepois.saldoMilesimos,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Leituras que a venda e a compra do Financeiro fazem COM A `tx`, dentro da transação do documento
// (plano 06-03).
// ---------------------------------------------------------------------------------------------

// Os itens de que `efeitoNoEstoque` precisa para as linhas de um documento: os vendidos/comprados e
// os insumos das fichas deles, no formato de `listarItensParaEfeito` (lib/financeiro/consultas.ts)
// — mas lidos com a `tx` e só os ids que importam, não o catálogo inteiro.
//
// SEM filtrar `ativo` (D-20, 06-RESEARCH.md §Pergunta 6): um insumo desativado dentro da ficha de um
// produto ativo continua sendo baixado. Quem recusa item desativado é a validação da ação, e só para
// o item da LINHA.
//
// A ficha é lida ANTES da trava dos itens (§Pergunta 5): se uma edição de ficha comitar entre esta
// leitura e a trava, a venda fica equivalente a ter acontecido um instante antes dela — consistente,
// porque todo insumo daquela ficha é travado por `gravarMovimentacoes`.
export async function carregarItensParaEfeito(
  tx: TransacaoDoBanco,
  idsVendidos: readonly string[],
): Promise<ItemParaEfeito[]> {
  const vendidos = idsUnicosEmOrdem(idsVendidos);
  if (vendidos.length === 0) {
    return [];
  }

  const fichas = await tx
    .select({
      itemId: fichaTecnica.itemId,
      insumoId: fichaTecnica.insumoId,
      quantidade: fichaTecnica.quantidade,
    })
    .from(fichaTecnica)
    .where(inArray(fichaTecnica.itemId, vendidos));

  const fichaPorItem = new Map<string, { insumoId: string; quantidade: string }[]>();
  for (const linha of fichas) {
    const lista = fichaPorItem.get(linha.itemId) ?? [];
    lista.push({ insumoId: linha.insumoId, quantidade: linha.quantidade });
    fichaPorItem.set(linha.itemId, lista);
  }

  const todos = idsUnicosEmOrdem([...vendidos, ...fichas.map((linha) => linha.insumoId)]);
  const itens = await tx
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      controlaEstoque: itensCatalogo.controlaEstoque,
    })
    .from(itensCatalogo)
    .where(inArray(itensCatalogo.id, todos));

  return itens.map((item) => ({
    id: item.id,
    nome: item.nome,
    unidade: item.unidade,
    controlaEstoque: item.controlaEstoque,
    ficha: fichaPorItem.get(item.id) ?? [],
  }));
}

// A área de cada categoria (a de VENDA da linha, na baixa por venda — D-27). Categoria que não
// existe não aparece no mapa.
export async function areasDasCategorias(
  tx: TransacaoDoBanco,
  ids: readonly string[],
): Promise<Map<string, AreaFinanceira>> {
  const unicos = idsUnicosEmOrdem(ids);
  if (unicos.length === 0) {
    return new Map();
  }
  const linhas = await tx
    .select({ id: categorias.id, area: categorias.area })
    .from(categorias)
    .where(inArray(categorias.id, unicos));
  return new Map(linhas.map((linha) => [linha.id, linha.area]));
}

// As movimentações de um documento que ainda NÃO foram estornadas, na ordem do livro (`numero`) —
// o que `cancelarDocumento` espelha (D-04). Só as originais (`estorno_de_id` nulo) e sem nenhuma
// linha apontando para elas (`not exists`): a segunda proteção contra estorno duplo, ao lado do
// índice único `movimentacoes_estoque_estorno_de_uk`. Chamada DEPOIS da trava do documento: a
// ordem de travas documento → itens nunca inverte.
export async function originaisSemEstorno(
  tx: TransacaoDoBanco,
  documentoId: string,
): Promise<MovimentacaoOriginal[]> {
  return tx
    .select({
      id: movimentacoesEstoque.id,
      itemId: movimentacoesEstoque.itemId,
      origem: movimentacoesEstoque.origem,
      tipo: movimentacoesEstoque.tipo,
      quantidadeMilesimos: movimentacoesEstoque.quantidadeMilesimos,
      valorCentavos: movimentacoesEstoque.valorCentavos,
      area: movimentacoesEstoque.area,
      documentoId: movimentacoesEstoque.documentoId,
      documentoLinhaId: movimentacoesEstoque.documentoLinhaId,
    })
    .from(movimentacoesEstoque)
    .where(
      and(
        eq(movimentacoesEstoque.documentoId, documentoId),
        isNull(movimentacoesEstoque.estornoDeId),
        sql`not exists (select 1 from movimentacoes_estoque as estorno where estorno.estorno_de_id = ${movimentacoesEstoque.id})`,
      ),
    )
    .orderBy(asc(movimentacoesEstoque.numero));
}

// ---------------------------------------------------------------------------------------------
// A folha completa (plano 06-05): o ajuste pelo contado e as leituras que a ação faz COM A `tx`.
// ---------------------------------------------------------------------------------------------

export type ResultadoDoAjuste =
  | { gravou: false; saldoMilesimos: number }
  | { gravou: true; movimentacao: MovimentacaoGravada };

// EST-07/EST-08 — D-18: o ajuste é decidido CONTRA O SALDO DO INSTANTE DA GRAVAÇÃO, nunca contra o
// da prévia. Trava o item, lê o estado DEPOIS da trava e só então `planejarAjuste`: se outra pessoa
// vendeu ou deu baixa entre abrir a folha e gravar, a diferença já sai com isso — o saldo final é
// exatamente o contado (ajuste depois da venda) ou o contado menos a venda (venda depois do ajuste;
// a venda espera a trava). Diferença zero → nada é inserido (EST-08). Senão o pedido vai por
// `gravarMovimentacoes`, a porta única, na mesma `tx`: a trava já está segura (pedir de novo não
// espera) e a segunda leitura devolve o mesmo estado. A prova com duas conexões é do plano 06-02.
export async function gravarAjuste(
  tx: TransacaoDoBanco,
  dados: { itemId: string; contadoMilesimos: number; nota: string | null },
  contexto: { registradoPor: string },
): Promise<ResultadoDoAjuste> {
  await travarItens(tx, [dados.itemId]);
  const estados = await lerEstados(tx, [dados.itemId]);
  const estado = estados.get(dados.itemId) ?? ESTADO_VAZIO;

  const plano = planejarAjuste({
    saldoMilesimos: estado.saldoMilesimos,
    contadoMilesimos: dados.contadoMilesimos,
  });
  if (plano.tipo === "nada") {
    return { gravou: false, saldoMilesimos: estado.saldoMilesimos };
  }

  const pedido = pedidoDeAjuste({
    itemId: dados.itemId,
    diferencaMilesimos: plano.diferencaMilesimos,
    contadoMilesimos: dados.contadoMilesimos,
    nota: dados.nota,
  });
  const [movimentacao] = await gravarMovimentacoes(tx, [pedido], contexto);
  return { gravou: true, movimentacao };
}

// D-29: "peça pronta" = item com ficha de precificação LIGADA (`fichas_precificacao.item_catalogo_id`;
// a exclusiva não tem item, pelo `check` de exclusividade). Lido com a `tx`, dentro da transação da
// entrada — o motivo `peca_pronta` nunca vem do cliente (T-06-23).
export async function itemTemFichaDePrecificacao(
  tx: TransacaoDoBanco,
  itemId: string,
): Promise<boolean> {
  const [linha] = await tx
    .select({ id: fichasPrecificacao.id })
    .from(fichasPrecificacao)
    .where(eq(fichasPrecificacao.itemCatalogoId, itemId))
    .limit(1);
  return linha !== undefined;
}

// A ORDEM DE PRODUÇÃO do vínculo "Consumo em encomenda" (Fase 06.1 — o nome da função é o do
// destino; ver o comentário de `EncomendaParaVinculo`), se ainda está aguardando o sinal ou em
// andamento — `null` se não existe, foi concluída ou cancelada (T-06.1-09).
//
// Trava `for no key update` — a MESMA da Produção (`lib/producao/gravacao.ts::travarOrdem`) — e é
// chamada ANTES de `travarItens`, na ordem de travas do sistema DOCUMENTO → ORDEM → ITENS (revisão
// 06.1, WR-04). Até a revisão ela lia com `for key share` DEPOIS do item: essa trava não conflita
// com a de quem cancela ou conclui a ordem (que muda `status`, coluna que não é chave), então a
// folha lia "ativa" no mesmo instante em que a ordem virava cancelada, e gravava uma baixa ligada a
// uma ordem encerrada. Com a mesma trava, a baixa espera o cancelamento (ou a conclusão) terminar,
// relê o status e recusa; e, como a ordem vem antes do item aqui e na Produção (`darBaixaNaOrdem`,
// `concluirOrdem`), nenhum impasse novo aparece. A trava segura a linha até o fim da transação —
// a chave estrangeira do `insert` no livro pede `for key share`, que a própria transação já cobre.
// Devolve o nome, que a ação congela em `nota` (Pitfall 10).
export async function encomendaEmAndamento(
  tx: TransacaoDoBanco,
  encomendaId: string,
): Promise<{ id: string; nome: string } | null> {
  const [linha] = await tx
    .select({ id: ordensProducao.id, nome: ordensProducao.nome, status: ordensProducao.status })
    .from(ordensProducao)
    .where(eq(ordensProducao.id, encomendaId))
    .for("no key update");
  if (!linha || (linha.status !== "aguardando_sinal" && linha.status !== "ativa")) {
    return null;
  }
  return { id: linha.id, nome: linha.nome };
}

// ---------------------------------------------------------------------------------------------
// A contagem (plano 06-10): material por material, sob a trava, sem rascunho (D-18).
// ---------------------------------------------------------------------------------------------

export type ResultadoDaContagem =
  | {
      recusa: string;
      modo: ModoDaContagem;
      saldoAntesMilesimos: number;
    }
  | {
      recusa: null;
      gravou: boolean;
      modo: ModoDaContagem;
      saldoAntesMilesimos: number;
      saldoDepoisMilesimos: number;
      diferencaMilesimos: number;
    };

// D-17 refinado + D-18: trava o item; DEPOIS da trava lê o estado e se o item já tem movimentação
// `manual` — o MODO é decidido aqui, dentro da transação, nunca pelo cliente (T-06-45: fingir
// "primeira" para gravar uma entrada com custo não funciona, porque quem diz é o livro). Depois
// `planejarContagem` contra o saldo DO INSTANTE (T-06-46): uma venda no meio da contagem fica certa
// nas duas ordens — antes da trava, a diferença já sai com ela; depois, a venda espera a trava.
// "nada" não insere; "recusa" (custo faltando numa primeira contagem que ficou positiva) devolve a
// frase sem inserir. Também recusa (revisão WR-03, `conferirSaldoDoCusto`) a entrada com custo
// cujo saldo do instante difere do que a tela usou para a pessoa precificar — devolve o saldo novo
// para a linha refazer a dica. Senão, `pedidoDeContagem` pela porta única, na mesma `tx`.
export async function gravarContagem(
  tx: TransacaoDoBanco,
  dados: {
    itemId: string;
    contadoMilesimos: number;
    custouCentavos: number | null;
    saldoEsperadoMilesimos: number;
    unidade: Unidade;
  },
  contexto: { registradoPor: string },
): Promise<ResultadoDaContagem> {
  await travarItens(tx, [dados.itemId]);
  // Em sequência, não em paralelo: as duas leituras usam a MESMA conexão da transação.
  const estados = await lerEstados(tx, [dados.itemId]);
  const manual = await tx
    .select({ id: movimentacoesEstoque.id })
    .from(movimentacoesEstoque)
    .where(
      and(eq(movimentacoesEstoque.itemId, dados.itemId), eq(movimentacoesEstoque.origem, "manual")),
    )
    .limit(1);
  const estado = estados.get(dados.itemId) ?? ESTADO_VAZIO;
  const modo = modoDoMaterial({ temManual: manual.length > 0 });

  const plano = planejarContagem({
    modo,
    saldoMilesimos: estado.saldoMilesimos,
    contadoMilesimos: dados.contadoMilesimos,
    custouCentavos: dados.custouCentavos,
  });
  if (plano.tipo === "recusa") {
    return { recusa: plano.erro, modo, saldoAntesMilesimos: estado.saldoMilesimos };
  }
  const saldoMudou = conferirSaldoDoCusto({
    plano,
    saldoEsperadoMilesimos: dados.saldoEsperadoMilesimos,
    unidade: dados.unidade,
  });
  if (saldoMudou !== null) {
    return { recusa: saldoMudou, modo, saldoAntesMilesimos: estado.saldoMilesimos };
  }
  if (plano.tipo === "nada") {
    return {
      recusa: null,
      gravou: false,
      modo,
      saldoAntesMilesimos: estado.saldoMilesimos,
      saldoDepoisMilesimos: estado.saldoMilesimos,
      diferencaMilesimos: 0,
    };
  }

  const pedido = pedidoDeContagem(plano, {
    itemId: dados.itemId,
    contadoMilesimos: dados.contadoMilesimos,
  });
  const [gravada] = await gravarMovimentacoes(tx, [pedido], contexto);
  return {
    recusa: null,
    gravou: true,
    modo,
    saldoAntesMilesimos: gravada.saldoAntesMilesimos,
    saldoDepoisMilesimos: gravada.saldoDepoisMilesimos,
    diferencaMilesimos: gravada.quantidadeMilesimos,
  };
}

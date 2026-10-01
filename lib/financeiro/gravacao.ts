// O escritor da VENDA que roda DENTRO de uma transação (Fase 05, plano 11 — extraído, sem mudar
// comportamento, do miolo de `lancarVenda`). Um escritor só (Don't Hand-Roll, 05-RESEARCH.md
// §Pergunta 2): quem cria venda — a Venda manual (`lib/financeiro/acoes.ts::lancarVenda`), o
// “Recebi agora” da Agenda (`lib/agenda/acoes.ts::receberAgora`) e, no plano 12, o lote de
// mensalidades (`lancarMensalidadesEmLote`) — passa por aqui, para o documento, as linhas, a baixa
// de estoque e as parcelas com a taxa do cartão congelada nascerem sempre do mesmo jeito.
//
// 🔴 SEM a diretiva de Server Action, de propósito (06-RESEARCH.md Pattern 4 / Pitfall 7): toda
// função exportada de um arquivo com a diretiva vira endpoint — chamável pelo navegador — e uma
// função que recebe `tx` e grava venda sem conferir nada não pode ser alcançável de fora. Ela só é
// chamada de dentro do servidor, depois que a ação que a chama já fez `exigirUsuario()` e validou
// TUDO: este arquivo não valida categoria, item, total nem a soma das parcelas — quem chama
// valida; a restrição adiada `conferir_soma_do_documento()` (migração 0015) confere a soma de novo
// no fim da transação.
//
// Ordem de travas (extensão de `lib/estoque/gravacao.ts` e `lib/producao/gravacao.ts`): o documento
// é NOVO (ninguém mais o vê) e só depois, se houver linha de item com estoque, `gravarMovimentacoes`
// trava os ITENS. Quem chama pode ter travado ANTES uma linha própria — a Agenda trava a COBRANÇA
// (`for no key update`) —, mas nunca um documento existente: assim não há ciclo com
// `cancelarDocumento` (DOCUMENTO → ORDEM → ITENS).
import { documentoLinhas, documentos, parcelas } from "@/db/schema";
import {
  areasDasCategorias,
  carregarItensParaEfeito,
  gravarMovimentacoes,
  type TransacaoDoBanco,
} from "@/lib/estoque/gravacao";
import { pedidosDaVenda } from "@/lib/estoque/pedidos";

import type { FormaDePagamento } from "./textos";

export type { TransacaoDoBanco };

// Uma linha já pronta para gravar: o valor é o FINAL (com a parte do desconto, se houver) e a
// descrição/categoria da linha de item já foram lidas do banco por quem chama.
export type LinhaDoPedidoDeVenda =
  | {
      tipo: "item";
      itemId: string;
      descricao: string;
      categoriaId: string;
      quantidade: number;
      valorCentavos: number;
    }
  | {
      tipo: "livre";
      descricao: string;
      categoriaId: string;
      valorCentavos: number;
    };

export type ParcelaDoPedidoDeVenda = {
  vencimento: string;
  valorCentavos: number;
  forma: FormaDePagamento;
  pago: boolean;
};

export type PedidoDeVenda = {
  data: string;
  // SEMPRE gravado: o nome congelado no momento da venda — o Caixa, o extrato, o PDF e o Mês leem
  // `pessoa_nome`, nunca o cadastro do cliente (D-01).
  pessoaNome: string | null;
  // O vínculo com o cliente (D-01): só a Agenda manda nesta fase; a Venda manual continua sem.
  clienteId?: string | null;
  linhas: readonly LinhaDoPedidoDeVenda[];
  parcelas: readonly ParcelaDoPedidoDeVenda[];
};

export type ContextoDaVenda = {
  registradoPor: string;
  // A taxa de Cadastros no momento do lançamento (`obterConfiguracaoFinanceira`), lida por quem
  // chama FORA da transação.
  taxaCartaoPontosBase: number;
};

export async function gravarVenda(
  tx: TransacaoDoBanco,
  pedido: PedidoDeVenda,
  contexto: ContextoDaVenda,
): Promise<{ id: string; numero: number }> {
  const [documento] = await tx
    .insert(documentos)
    .values({
      tipo: "venda",
      data: pedido.data,
      pessoaNome: pedido.pessoaNome,
      clienteId: pedido.clienteId ?? null,
      criadoPor: contexto.registradoPor,
    })
    .returning({ id: documentos.id, numero: documentos.numero });

  const linhasGravadas = await tx
    .insert(documentoLinhas)
    .values(
      pedido.linhas.map((linha, indice) => {
        // O valor gravado é o FINAL (já com a parte do desconto desta linha, se houver) — nunca
        // o subtotal bruto (D-09: "não é linha separada", o desconto mora dentro das linhas).
        if (linha.tipo === "item") {
          return {
            documentoId: documento.id,
            ordem: indice,
            itemId: linha.itemId,
            descricao: linha.descricao,
            categoriaId: linha.categoriaId,
            quantidade: linha.quantidade,
            valorCentavos: linha.valorCentavos,
          };
        }
        return {
          documentoId: documento.id,
          ordem: indice,
          descricao: linha.descricao,
          categoriaId: linha.categoriaId,
          valorCentavos: linha.valorCentavos,
        };
      }),
    )
    .returning({ id: documentoLinhas.id, ordem: documentoLinhas.ordem });

  // A baixa de estoque (Fase 06, D-03), DENTRO desta transação: a venda e o livro comitam
  // juntos ou não comitam — nunca uma venda sem a baixa, nem uma baixa sem a venda. Uma falha
  // aqui cai no `catch` de quem chama e o gestor lê a frase humana (o erro vai só para o log).
  //
  // D-33: a partir daqui ESTA TRANSAÇÃO DEPENDE DA MIGRAÇÃO `0023` (tabela
  // `movimentacoes_estoque`). Publicar este código antes de aplicar a `0023` quebra toda venda.
  //
  // O cálculo é `efeitoNoEstoque`, por linha, dentro de `pedidosDaVenda` — a ação não calcula
  // efeito nenhum. As linhas vêm do `returning`: o `id` de cada uma vira `documento_linha_id`,
  // e é a inserção delas que segura `FOR KEY SHARE` nos itens (por isso a trava de
  // `gravarMovimentacoes` é `no key update`). Nenhuma checagem de saldo (D-06): negativo não
  // bloqueia, não atrasa e não pede confirmação — o Estoque é consequência da venda.
  const idDaLinhaPorOrdem = new Map(linhasGravadas.map((linha) => [linha.ordem, linha.id]));
  const linhasDeItem = pedido.linhas.flatMap((linha, indice) => {
    if (linha.tipo !== "item") {
      return [];
    }
    // Não-nulo: a linha acabou de ser inserida.
    return [
      {
        documentoLinhaId: idDaLinhaPorOrdem.get(indice)!,
        itemId: linha.itemId,
        quantidade: linha.quantidade,
        categoriaId: linha.categoriaId,
      },
    ];
  });
  if (linhasDeItem.length > 0) {
    const itensParaEfeito = await carregarItensParaEfeito(
      tx,
      linhasDeItem.map((linha) => linha.itemId),
    );
    const areaPorCategoria = await areasDasCategorias(
      tx,
      linhasDeItem.map((linha) => linha.categoriaId),
    );
    const pedidos = pedidosDaVenda(linhasDeItem, itensParaEfeito, areaPorCategoria).map(
      (pedidoDeEstoque) => ({ ...pedidoDeEstoque, documentoId: documento.id }),
    );
    await gravarMovimentacoes(tx, pedidos, { registradoPor: contexto.registradoPor });
  }

  await tx.insert(parcelas).values(
    pedido.parcelas.map((parcela, indice) => {
      // Parcela paga no cartão de VENDA congela a taxa da configuração no momento do
      // pagamento (BRIEFING §5) — mudar a taxa em Cadastros depois não reescreve o passado.
      // Só `taxaPontosBase` é gravado aqui, nunca os centavos: o valor líquido de verdade
      // (`taxaEmCentavos`/`liquidoDaParcela`, lib/financeiro/taxa.ts) é calculado sempre que
      // a parcela é LIDA (extrato, Mês) — se ele fosse gravado aqui, mudar a taxa depois
      // reescreveria silenciosamente o passado.
      const pagaNoCartao = parcela.pago && parcela.forma === "cartao";
      return {
        documentoId: documento.id,
        numero: indice + 1,
        vencimento: parcela.vencimento,
        valorCentavos: parcela.valorCentavos,
        forma: parcela.forma,
        pagoEm: parcela.pago ? parcela.vencimento : null,
        pagoPor: parcela.pago ? contexto.registradoPor : null,
        taxaPontosBase: pagaNoCartao ? contexto.taxaCartaoPontosBase : null,
      };
    }),
  );

  return { id: documento.id, numero: documento.numero };
}

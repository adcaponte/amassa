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
// (`for no key update`) —, e o único documento EXISTENTE que alguém trava antes é a original do
// “Corrigir” (`lancarCorrecaoNaTransacao`, abaixo), que segue a ordem de `cancelarDocumento`
// (DOCUMENTO → ORDEM → ITENS) antes de chegar aqui: não há ciclo.
//
// Desde a Fase 06.5 (plano 16) este arquivo também tem o escritor da DESPESA (`gravarDespesa`), o miolo
// do cancelamento (`cancelarDocumentoNaTransacao`), a leitura da versão do documento e o núcleo do
// “Corrigir” — todos sem a diretiva, pelo mesmo motivo.
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import type { db } from "@/db";
import {
  correcoesDeDocumento,
  documentoLinhas,
  documentos,
  fornecedores,
  inscricoes,
  mensalidades,
  orcamentos,
  parcelas,
  queimaVendas,
  usosLivres,
} from "@/db/schema";
import {
  areasDasCategorias,
  carregarItensParaEfeito,
  gravarMovimentacoes,
  originaisSemEstorno,
  type TransacaoDoBanco,
} from "@/lib/estoque/gravacao";
import { pedidosDaCompra, pedidosDaVenda, pedidosDoEstorno } from "@/lib/estoque/pedidos";
import { cancelarOrdemDaVendaCancelada } from "@/lib/producao/gravacao";

import {
  motivoSemCorrecao,
  normalizarParaVersao,
  taxasHerdadasDaCorrecao,
  versaoDoDocumento,
  type LeituraParaVersao,
  type MotivoDaRecusaDaCorrecao,
  type OrigemSemCorrecao,
  type ParcelaPagaDaOriginal,
} from "./correcao";
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
  // Só o “Corrigir” (BL-01, quick 261007-shs): as parcelas JÁ RECEBIDAS da original, lidas do banco por
  // `lancarCorrecaoNaTransacao` sob a trava — a parcela recebida que é “a mesma” herda a taxa congelada
  // dela (`taxasHerdadasDaCorrecao`). Ausente (Agenda, Queimas, lote, Venda comum) = tudo como sempre.
  pagasDaOriginal?: readonly ParcelaPagaDaOriginal[];
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

  // BL-01: na correção, qual parcela paga no cartão herda a taxa congelada da original.
  const herancas = contexto.pagasDaOriginal
    ? taxasHerdadasDaCorrecao(contexto.pagasDaOriginal, pedido.parcelas)
    : null;

  await tx.insert(parcelas).values(
    pedido.parcelas.map((parcela, indice) => {
      // Parcela paga no cartão de VENDA congela a taxa da configuração no momento do
      // pagamento (BRIEFING §5) — mudar a taxa em Cadastros depois não reescreve o passado.
      // Só `taxaPontosBase` é gravado aqui, nunca os centavos: o valor líquido de verdade
      // (`taxaEmCentavos`/`liquidoDaParcela`, lib/financeiro/taxa.ts) é calculado sempre que
      // a parcela é LIDA (extrato, Mês) — se ele fosse gravado aqui, mudar a taxa depois
      // reescreveria silenciosamente o passado. Pela mesma regra, na correção (BL-01, decisão do
      // dono de 07/10/2026) a parcela JÁ RECEBIDA que é a mesma da original grava a taxa com que
      // foi recebida — inclusive `null` —, e só a parcela nova (ou em aberto marcada paga agora)
      // congela a taxa de hoje.
      const pagaNoCartao = parcela.pago && parcela.forma === "cartao";
      const heranca = herancas?.[indice];
      const taxaDaParcela = !pagaNoCartao
        ? null
        : heranca && heranca.herdada
          ? heranca.pontosBase
          : contexto.taxaCartaoPontosBase;
      return {
        documentoId: documento.id,
        numero: indice + 1,
        vencimento: parcela.vencimento,
        valorCentavos: parcela.valorCentavos,
        forma: parcela.forma,
        pagoEm: parcela.pago ? parcela.vencimento : null,
        pagoPor: parcela.pago ? contexto.registradoPor : null,
        taxaPontosBase: taxaDaParcela,
      };
    }),
  );

  return { id: documento.id, numero: documento.numero };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// A DESPESA (Fase 06.5, plano 16 — extraída, sem mudar comportamento, do corpo transacional de
// `lancarDespesa`), no molde de `gravarVenda`: quem chama já fez `exigirUsuario()` e validou categoria,
// itens, total e parcelas; aqui só o que precisa da transação — o fornecedor conferido sob trava, o
// documento, as linhas, a entrada de estoque da compra e as parcelas sem taxa.

// O fornecedor escolhido não existe ou foi desativado: lançada ANTES de qualquer `insert` — a transação
// desfaz, e quem chama traduz em `FRASE_FORNECEDOR_DESATIVADO_NA_DESPESA`.
export class FornecedorIndisponivel extends Error {}

export type LinhaDoPedidoDeDespesa = {
  itemId: string | null;
  descricao: string;
  categoriaId: string;
  quantidadeEstoque: string | null;
  valorCentavos: number;
};

export type PedidoDeDespesa = {
  modo: "compra" | "outra";
  data: string;
  // O texto livre do campo; com fornecedor, é IGNORADO e o nome do cadastro é congelado.
  pessoaNome: string | null;
  fornecedorId: string | null;
  linhas: readonly LinhaDoPedidoDeDespesa[];
  parcelas: readonly ParcelaDoPedidoDeVenda[];
};

export type ContextoDaDespesa = {
  registradoPor: string;
};

export async function gravarDespesa(
  tx: TransacaoDoBanco,
  pedido: PedidoDeDespesa,
  contexto: ContextoDaDespesa,
): Promise<{ id: string; numero: number }> {
  // O fornecedor escolhido na lista (Fase 06.2, plano 10 — D-04), conferido AQUI, dentro da
  // transação e antes de gravar qualquer linha. A trava `for share` conflita com o
  // `for no key update` de `definirFornecedorAtivo`: desativar e lançar ao mesmo tempo serializam
  // — nunca nasce uma despesa ligada a um fornecedor desativado — e não fecham impasse (cada
  // caminho trava uma linha só de `fornecedores`). Inexistente ou desativado → recusa, nada é
  // lançado. Ativo → a despesa grava o id e CONGELA o nome do CADASTRO em `pessoa_nome`
  // (T-06.2-39: o texto que veio do cliente é ignorado); renomear o fornecedor depois não muda
  // esta despesa. Sem fornecedor, tudo como sempre: `pessoa_nome` é o texto livre.
  let pessoaNome = pedido.pessoaNome;
  if (pedido.fornecedorId !== null) {
    const [fornecedor] = await tx
      .select({ nome: fornecedores.nome, ativo: fornecedores.ativo })
      .from(fornecedores)
      .where(eq(fornecedores.id, pedido.fornecedorId))
      .for("share");
    if (!fornecedor || !fornecedor.ativo) {
      throw new FornecedorIndisponivel();
    }
    pessoaNome = fornecedor.nome;
  }

  const [documento] = await tx
    .insert(documentos)
    .values({
      tipo: "despesa",
      data: pedido.data,
      pessoaNome,
      fornecedorId: pedido.fornecedorId,
      criadoPor: contexto.registradoPor,
    })
    .returning({ id: documentos.id, numero: documentos.numero });

  const linhasGravadas = await tx
    .insert(documentoLinhas)
    .values(
      pedido.linhas.map((linha, indice) => ({
        documentoId: documento.id,
        ordem: indice,
        itemId: linha.itemId,
        descricao: linha.descricao,
        categoriaId: linha.categoriaId,
        quantidade: 1,
        quantidadeEstoque: linha.quantidadeEstoque,
        valorCentavos: linha.valorCentavos,
      })),
    )
    .returning({ id: documentoLinhas.id, ordem: documentoLinhas.ordem });

  // A entrada de estoque da compra de material (Fase 06, EST-15), DENTRO desta transação — só
  // no modo "compra"; "outra despesa" não mexe no estoque. Uma entrada por linha, com o valor
  // da linha como `valor_informado_centavos` (o custo unitário é valor ÷ quantidade na hora de
  // mostrar, nunca gravado arredondado — D-19). D-33: esta transação passa a depender da
  // `0023`. O custo do estoque é o da nota LANÇADA: um "Paguei" com outro valor depois não gera
  // correção de custo (D-30, Pitfall 14).
  if (pedido.modo === "compra") {
    const idDaLinhaPorOrdem = new Map(linhasGravadas.map((linha) => [linha.ordem, linha.id]));
    const linhasDeCompra = pedido.linhas.map((linha, indice) => ({
      documentoLinhaId: idDaLinhaPorOrdem.get(indice)!,
      itemId: linha.itemId,
      quantidadeEstoque: linha.quantidadeEstoque,
      valorCentavos: linha.valorCentavos,
    }));
    const itensParaEfeito = await carregarItensParaEfeito(
      tx,
      linhasDeCompra.flatMap((linha) => (linha.itemId ? [linha.itemId] : [])),
    );
    const pedidos = pedidosDaCompra(linhasDeCompra, itensParaEfeito).map((pedidoDeEstoque) => ({
      ...pedidoDeEstoque,
      documentoId: documento.id,
    }));
    await gravarMovimentacoes(tx, pedidos, { registradoPor: contexto.registradoPor });
  }

  // Despesa NUNCA tem taxa — `taxaPontosBase` sempre nulo, mesmo quando a forma é "cartao"
  // (o preço já é o que o fornecedor cobrou; a taxa da maquininha só existe do lado de quem
  // RECEBE, nunca de quem paga).
  await tx.insert(parcelas).values(
    pedido.parcelas.map((parcela, indice) => ({
      documentoId: documento.id,
      numero: indice + 1,
      vencimento: parcela.vencimento,
      valorCentavos: parcela.valorCentavos,
      forma: parcela.forma,
      pagoEm: parcela.pago ? parcela.vencimento : null,
      pagoPor: parcela.pago ? contexto.registradoPor : null,
      taxaPontosBase: null,
    })),
  );

  return { id: documento.id, numero: documento.numero };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// O CANCELAMENTO dentro de uma transação (Fase 06.5, plano 16 — o miolo de `cancelarDocumento`, extraído
// sem mudar o que faz, para o “Corrigir” cancelar pelo MESMO núcleo). O Caixa (04.4-08-PLAN.md):
// cancelar risca sem apagar (FNC-10). Nenhum `delete` — o documento ganha `cancelado_em`/`cancelado_por`.
// `select ... for update` trava a linha do documento para duas pessoas cancelando o MESMO documento ao
// mesmo tempo nunca cancelarem duas vezes. Se quem chama já travou a linha (a correção), a trava é da
// mesma transação e não espera.
export class DocumentoNaoEncontrado extends Error {}
export class DocumentoJaCancelado extends Error {}

export async function cancelarDocumentoNaTransacao(
  tx: TransacaoDoBanco,
  documentoId: string,
  usuarioId: string,
): Promise<{ numero: number }> {
  const [documento] = await tx
    .select({ numero: documentos.numero, canceladoEm: documentos.canceladoEm })
    .from(documentos)
    .where(eq(documentos.id, documentoId))
    .for("update");

  if (!documento) {
    throw new DocumentoNaoEncontrado();
  }
  if (documento.canceladoEm) {
    throw new DocumentoJaCancelado();
  }

  // D-07 (Fase 06.1, plano 06): a ordem de produção ligada a esta venda pelo orçamento. Se ainda
  // aguarda o sinal, é cancelada JUNTO, nesta transação (`cancelada_pela_venda`); se já foi
  // liberada, nada muda nela — o aviso é derivado na leitura e o dono decide. Vem depois da
  // trava do documento e da checagem de "já cancelado" (cancelar a venda de novo nunca mexe de
  // novo na ordem) e ANTES do estorno, que trava os itens: DOCUMENTO → ORDEM → ITENS.
  await cancelarOrdemDaVendaCancelada(tx, documentoId, usuarioId);

  // O estorno do estoque (Fase 06, D-04): UMA movimentação espelho por original, com
  // `estorno_de_id` apontando para ela, o mesmo documento e a mesma origem — nada é apagado.
  // Vem DEPOIS da trava do documento (acima) e da checagem de "já cancelado": a ordem de travas
  // documento → itens nunca inverte, e duas pessoas cancelando ao mesmo tempo produzem um
  // conjunto de estornos só (a segunda cai em `DocumentoJaCancelado`; o índice único
  // `movimentacoes_estoque_estorno_de_uk` segura no banco se algum caminho futuro tentar).
  //
  // Pitfall 4: o estorno espelha o LIVRO — recalcular pela ficha de hoje devolveria o que a
  // venda nunca tirou. O valor é decidido em `lib/estoque/custo.ts` (D-23/D-24). Documento sem
  // movimentação (anterior ao Estoque, "outra despesa", venda só de valor livre) passa com lista
  // vazia e não mexe em saldo nenhum (D-05). D-33: esta transação passa a depender da `0023`.
  const originais = await originaisSemEstorno(tx, documentoId);
  await gravarMovimentacoes(tx, pedidosDoEstorno(originais), { registradoPor: usuarioId });

  await tx
    .update(documentos)
    .set({ canceladoEm: new Date(), canceladoPor: usuarioId })
    .where(eq(documentos.id, documentoId));

  return { numero: documento.numero };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// A VERSÃO do documento (Fase 06.5, plano 16): UMA leitura das entradas da versão — o `cancelado_em`,
// as linhas que NÃO são de diferença (id, quantidade, valor, quantidade de estoque) e as parcelas (id,
// valor, forma, vencimento, pago em) —, com o `db` (a página do plano 17, para mandar a versão à tela)
// ou com a `tx` (a correção, sob a trava). A conta é a de `lib/financeiro/correcao.ts`.
export type LeitorDaVersao = Pick<typeof db, "select"> | Pick<TransacaoDoBanco, "select">;

export async function lerParaVersao(
  leitor: LeitorDaVersao,
  documentoId: string,
): Promise<LeituraParaVersao | null> {
  const consulta = leitor as Pick<TransacaoDoBanco, "select">;
  const [documento] = await consulta
    .select({ canceladoEm: documentos.canceladoEm })
    .from(documentos)
    .where(eq(documentos.id, documentoId));
  if (!documento) {
    return null;
  }
  const linhas = await consulta
    .select({
      id: documentoLinhas.id,
      quantidade: documentoLinhas.quantidade,
      valorCentavos: documentoLinhas.valorCentavos,
      quantidadeEstoque: documentoLinhas.quantidadeEstoque,
    })
    .from(documentoLinhas)
    .where(and(eq(documentoLinhas.documentoId, documentoId), isNull(documentoLinhas.parcelaDiferencaId)))
    .orderBy(asc(documentoLinhas.id));
  const parcelasLidas = await consulta
    .select({
      id: parcelas.id,
      valorCentavos: parcelas.valorCentavos,
      forma: parcelas.forma,
      vencimento: parcelas.vencimento,
      pagoEm: parcelas.pagoEm,
    })
    .from(parcelas)
    .where(eq(parcelas.documentoId, documentoId))
    .orderBy(asc(parcelas.id));
  return { canceladoEm: documento.canceladoEm, linhas, parcelas: parcelasLidas };
}

// `null` = o documento não existe.
export async function versaoAtualDoDocumento(
  leitor: LeitorDaVersao,
  documentoId: string,
): Promise<string | null> {
  const leitura = await lerParaVersao(leitor, documentoId);
  return leitura === null ? null : versaoDoDocumento(normalizarParaVersao(leitura));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// O “CORRIGIR” (Fase 06.5, plano 16 — D-18 com a UI-D9 do dono, 05/10/2026, POL-08): a original continua
// valendo enquanto a corrigida é preenchida, e só é cancelada NESTA transação, junto com o lançamento da
// nova e o vínculo em `correcoes_de_documento`. Qualquer recusa lança `RecusaDaCorrecao` ANTES de
// qualquer escrita — a transação desfaz, nada gravado.
//
// Ordem de travas: DOCUMENTO original (`for update`, primeiro) → ORDEM (no núcleo do cancelamento) →
// ITENS (estorno) → documento NOVO → ITENS (efeito da nova). É a mesma de `cancelarDocumento`; a prova de
// corrida (`scripts/provar-corridas-da-correcao.ts`) denuncia 40P01 se for invertida.
//
// A ordem das leituras e escritas (o quick 261007-shs acrescentou 4b e 6b — BL-01):
// (1) trava da original; (2) cancelada / já corrigida; (3) as origens; (4) a versão relida sob a trava;
// (4b) as parcelas JÁ RECEBIDAS da original, sob a mesma trava (nenhum “Recebi” entra no meio:
// `registrarPagamento` trava o documento antes da parcela); (5) o cancelamento; (6) a nova, com as pagas
// em mãos; (6b) a defesa: as parcelas GRAVADAS da nova relidas e conferidas contra a herança — uma parcela
// recebida com a taxa diferente da original desfaz tudo; (7) o vínculo.
//
// O erro da defesa (6b) não é recusa da tela: é um chamador que esqueceu a herança. A ação cai no
// `console.error` + frase de sempre.
export const ERRO_TAXA_REESCRITA_NA_CORRECAO = "Correção recusada: a taxa de uma parcela já recebida mudaria";
export class RecusaDaCorrecao extends Error {
  constructor(
    readonly motivo: MotivoDaRecusaDaCorrecao,
    readonly detalhe: {
      // O número da original; `null` quando ela não existe (a tela diz “não achei”).
      numeroOriginal: number | null;
      // Em `ja_corrigida`: o número da que a corrigiu.
      numeroNova?: number;
      // Em `origem`: de onde ela veio, e o ano/sequencial do orçamento quando é dele.
      origem?: OrigemSemCorrecao;
      orcamento?: { ano: number; sequencial: number };
    },
  ) {
    super(`Correção recusada: ${motivo}`);
  }
}

export async function lancarCorrecaoNaTransacao(
  tx: TransacaoDoBanco,
  pedido: {
    originalId: string;
    versao: string;
    tipo: "venda" | "despesa";
    usuarioId: string;
    // As pagas da original (4b) chegam aqui: a venda as passa a `gravarVenda`; a despesa as ignora (nunca
    // tem taxa).
    gravarNova: (
      tx: TransacaoDoBanco,
      pagasDaOriginal: readonly ParcelaPagaDaOriginal[],
    ) => Promise<{ id: string; numero: number }>;
  },
): Promise<{ numeroOriginal: number; id: string; numero: number }> {
  // (1) A trava da ORIGINAL, antes de qualquer outra coisa. O que a decisão usa — tipo, número,
  // cancelado, conta fixa — é lido aqui, sob ela; do cliente vêm só o id e a versão.
  const [original] = await tx
    .select({
      tipo: documentos.tipo,
      numero: documentos.numero,
      canceladoEm: documentos.canceladoEm,
      contaFixaId: documentos.contaFixaId,
    })
    .from(documentos)
    .where(eq(documentos.id, pedido.originalId))
    .for("update");
  if (!original) {
    throw new RecusaDaCorrecao("cancelada", { numeroOriginal: null });
  }
  if (original.tipo !== pedido.tipo) {
    throw new RecusaDaCorrecao("mudou", { numeroOriginal: original.numero });
  }

  // (2) Cancelada: corrigida por alguém (o vínculo existe) ou cancelada à mão.
  if (original.canceladoEm) {
    const [vinculo] = await tx
      .select({ numero: documentos.numero })
      .from(correcoesDeDocumento)
      .innerJoin(documentos, eq(documentos.id, correcoesDeDocumento.corrigidoId))
      .where(eq(correcoesDeDocumento.originalId, pedido.originalId));
    if (vinculo) {
      throw new RecusaDaCorrecao("ja_corrigida", { numeroOriginal: original.numero, numeroNova: vinculo.numero });
    }
    throw new RecusaDaCorrecao("cancelada", { numeroOriginal: original.numero });
  }

  // (3) As origens que a Venda/Despesa não recria (UI-D10 + contas fixas). Os vínculos nascem na MESMA
  // transação do documento e não são acrescentados depois — ler sem trava basta. Uma consulta de cada
  // vez: a transação é UMA conexão.
  const [orcamento] = await tx
    .select({ ano: orcamentos.ano, sequencial: orcamentos.sequencial })
    .from(orcamentos)
    .where(eq(orcamentos.documentoId, pedido.originalId))
    .limit(1);
  const [inscricao] = await tx
    .select({ id: inscricoes.id })
    .from(inscricoes)
    .where(eq(inscricoes.documentoId, pedido.originalId))
    .limit(1);
  const [mensalidade] = await tx
    .select({ id: mensalidades.id })
    .from(mensalidades)
    .where(eq(mensalidades.documentoId, pedido.originalId))
    .limit(1);
  const [usoLivre] = await tx
    .select({ id: usosLivres.id })
    .from(usosLivres)
    .where(eq(usosLivres.documentoId, pedido.originalId))
    .limit(1);
  const [queima] = await tx
    .select({ id: queimaVendas.documentoId })
    .from(queimaVendas)
    .where(eq(queimaVendas.documentoId, pedido.originalId))
    .limit(1);
  const origem = motivoSemCorrecao({
    temAgenda: Boolean(inscricao || mensalidade || usoLivre),
    temQueima: Boolean(queima),
    temOrcamento: Boolean(orcamento),
    temContaFixa: original.contaFixaId !== null,
  });
  if (origem !== null) {
    throw new RecusaDaCorrecao("origem", {
      numeroOriginal: original.numero,
      origem,
      orcamento: orcamento ? { ano: orcamento.ano, sequencial: orcamento.sequencial } : undefined,
    });
  }

  // (4) A versão relida AGORA, sob a trava, pela MESMA leitura e conta da página.
  const versaoAgora = await versaoAtualDoDocumento(tx, pedido.originalId);
  if (versaoAgora !== pedido.versao) {
    throw new RecusaDaCorrecao("mudou", { numeroOriginal: original.numero });
  }

  // (4b) BL-01: as parcelas JÁ RECEBIDAS da original, lidas sob a trava, depois da versão conferida.
  const pagasLidas = await tx
    .select({
      numero: parcelas.numero,
      pagoEm: parcelas.pagoEm,
      forma: parcelas.forma,
      valorCentavos: parcelas.valorCentavos,
      taxaPontosBase: parcelas.taxaPontosBase,
    })
    .from(parcelas)
    .where(and(eq(parcelas.documentoId, pedido.originalId), isNotNull(parcelas.pagoEm)))
    .orderBy(asc(parcelas.numero));
  const pagasDaOriginal: ParcelaPagaDaOriginal[] = pagasLidas.flatMap((parcela) =>
    parcela.pagoEm === null ? [] : [{ ...parcela, pagoEm: parcela.pagoEm }],
  );

  // (5) O cancelamento pelo MESMO núcleo de `cancelarDocumento` (ordem da venda, estorno, quem/quando).
  await cancelarDocumentoNaTransacao(tx, pedido.originalId, pedido.usuarioId);

  // (6) A nova, pelo escritor de sempre (`gravarVenda`/`gravarDespesa`), com as pagas em mãos.
  const nova = await pedido.gravarNova(tx, pagasDaOriginal);

  // (6b) A defesa no núcleo, no molde da restrição adiada da soma (duas camadas): relê as parcelas GRAVADAS
  // da nova e confere a herança. Um chamador futuro que esqueça de passar as pagas a `gravarVenda` não
  // reescreve o passado — a transação desfaz tudo. Vale para venda e despesa (a despesa grava `null`, e a
  // original dela também tem `null`).
  const gravadas = await tx
    .select({
      vencimento: parcelas.vencimento,
      valorCentavos: parcelas.valorCentavos,
      forma: parcelas.forma,
      pagoEm: parcelas.pagoEm,
      taxaPontosBase: parcelas.taxaPontosBase,
    })
    .from(parcelas)
    .where(eq(parcelas.documentoId, nova.id))
    .orderBy(asc(parcelas.numero));
  const esperadas = taxasHerdadasDaCorrecao(
    pagasDaOriginal,
    gravadas.map((parcela) => ({
      vencimento: parcela.pagoEm ?? parcela.vencimento,
      valorCentavos: parcela.valorCentavos,
      forma: parcela.forma,
      pago: parcela.pagoEm !== null,
    })),
  );
  gravadas.forEach((parcela, indice) => {
    const esperada = esperadas[indice];
    if (esperada.herdada && parcela.taxaPontosBase !== esperada.pontosBase) {
      throw new Error(ERRO_TAXA_REESCRITA_NA_CORRECAO);
    }
  });

  // (7) O vínculo. `original_id` único: o banco segura uma segunda correção da mesma original mesmo
  // que um caminho futuro esqueça a trava.
  await tx.insert(correcoesDeDocumento).values({
    originalId: pedido.originalId,
    corrigidoId: nova.id,
    criadoPor: pedido.usuarioId,
  });

  return { numeroOriginal: original.numero, id: nova.id, numero: nova.numero };
}

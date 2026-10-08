"use server";

import { z } from "zod";
import { count, desc, eq, inArray } from "drizzle-orm";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categorias, documentoLinhas, documentos, itensCatalogo, parcelas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";
// O ÚNICO ajudante da Agenda que o Financeiro importa (Fase 05, plano 12), como o cancelamento importa
// `lib/producao/gravacao.ts` (hoje por `cancelarDocumentoNaTransacao`): a regra da cobrança fica em `lib/agenda/`, a venda em `gravarVenda`.
import { RecusaDaAgenda, vincularCobranca } from "@/lib/agenda/gravacao";
import { FRASE_LINHA_DA_AGENDA_FALTANDO } from "@/lib/agenda/textos";
// A metade das Queimas do “Lançar na Venda” (Fase 06.4, plano 05), no mesmo molde: a regra do que falta
// cobrar fica em `lib/queimas/`, a venda em `gravarVenda`.
import { RecusaDasQueimas, vincularQueimaNaVenda } from "@/lib/queimas/gravacao";
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { ehOrigemDaAgenda, moduloDaOrigem, textoDaOrigem } from "./abas";
import type { MotivoDaRecusaDaCorrecao } from "./correcao";
import { obterConfiguracaoFinanceira } from "./consultas";
import { repartirDesconto } from "./desconto";
import {
  cancelarDocumentoNaTransacao,
  DocumentoJaCancelado,
  DocumentoNaoEncontrado,
  FornecedorIndisponivel,
  gravarDespesa,
  gravarVenda,
  lancarCorrecaoNaTransacao,
  RecusaDaCorrecao,
  type PedidoDeVenda,
  type TransacaoDoBanco,
} from "./gravacao";
import { TETO_CENTAVOS } from "./dinheiro";
import {
  dataDentroDoIntervaloPermitido,
  esquemaCancelamento,
  esquemaDesfazer,
  esquemaDespesa,
  esquemaId,
  esquemaPagamento,
  esquemaVenda,
  FRASE_VENDA_DESATUALIZADA,
} from "./esquemas";
import { hojeEmBrasilia } from "./formato";
import { conferirParcelas } from "./parcelas";
import { FRASE_DESFAZER_SEM_PREVISTO, planejarDesfazer, planejarPagamento } from "./pagamento";
import {
  FRASE_CONTA_JA_PAGA,
  FRASE_DATA_DE_PAGAMENTO_ANTES_DO_SALDO_INICIAL,
  FRASE_DATA_DE_PAGAMENTO_FUTURA,
  FRASE_DESFAZER_EM_ABERTO,
  FRASE_DESFAZER_LANCAMENTO_CANCELADO,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FORNECEDOR_DESATIVADO_NA_DESPESA,
  FRASE_LANCAMENTO_CANCELADO_SEM_PAGAMENTO,
  FRASE_LANCAMENTO_JA_CANCELADO,
  FRASE_LANCAMENTO_NAO_EXISTE_MAIS,
  fraseCorrecaoRecusada,
  fraseCorrecaoSemRede,
  fraseSemCorrecaoPorOrigem,
  type FormaDePagamento,
  type TipoDeDocumentoParaTexto,
} from "./textos";

// Mesma forma de `lib/abertura/acoes.ts`/`lib/cotacoes/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Detector de SQLSTATE 23503 (foreign_key_violation) vive em `@/lib/erro/postgres`.

// O resultado de `lancarVenda`/`lancarDespesa` (Fase 06.5, plano 16): na recusa de uma CORREÇÃO, o motivo
// vai junto da frase — a tela do plano 17 o põe em `data-motivo` e decide o botão (“Lançar como venda
// nova” só em `cancelada`). `rede` = falha inesperada com a correção (a transação desfez tudo).
export type MotivoDaCorrecaoNaTela = MotivoDaRecusaDaCorrecao | "rede";
// `telaMudou` (quick 261008-pmi, auditoria 08/10): a recusa é de TELA VELHA — a Venda das Queimas viu
// outras vendas ativas da queima; o painel mostra a frase e relê a página.
export type ResultadoDoLancamento<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; motivoDaCorrecao?: MotivoDaCorrecaoNaTela; telaMudou?: true };

// A frase da recusa sob a trava (`RecusaDaCorrecao`), verbatim da UI-SPEC. O número da original e o
// da nova foram lidos pelo servidor sob a trava; o texto do banco nunca vai à tela.
function respostaDaRecusaDaCorrecao(
  recusa: RecusaDaCorrecao,
  tipo: TipoDeDocumentoParaTexto,
): { ok: false; erro: string; motivoDaCorrecao: MotivoDaCorrecaoNaTela } {
  const { detalhe } = recusa;
  if (recusa.motivo === "origem" && detalhe.origem) {
    const orcamento = detalhe.orcamento
      ? numeroDeOrcamento(detalhe.orcamento.ano, detalhe.orcamento.sequencial)
      : null;
    return {
      ok: false,
      erro: fraseSemCorrecaoPorOrigem(tipo, detalhe.origem, orcamento),
      motivoDaCorrecao: "origem",
    };
  }
  const motivo = recusa.motivo === "origem" ? "mudou" : recusa.motivo;
  return {
    ok: false,
    erro: fraseCorrecaoRecusada(motivo, tipo, detalhe.numeroOriginal, detalhe.numeroNova),
    motivoDaCorrecao: recusa.motivo,
  };
}

// A falha inesperada com a correção: a transação desfez tudo, a original continua valendo. O número dela
// é relido FORA da transação só para a frase; se nem isso der, a frase diz “a original”.
async function respostaDaFalhaDaCorrecao(
  tipo: TipoDeDocumentoParaTexto,
  originalId: string,
): Promise<{ ok: false; erro: string; motivoDaCorrecao: MotivoDaCorrecaoNaTela }> {
  let numeroOriginal: number | null = null;
  try {
    const [original] = await db
      .select({ numero: documentos.numero })
      .from(documentos)
      .where(eq(documentos.id, originalId));
    numeroOriginal = original?.numero ?? null;
  } catch {
    numeroOriginal = null;
  }
  return { ok: false, erro: fraseCorrecaoSemRede(tipo, numeroOriginal), motivoDaCorrecao: "rede" };
}

// O que cancelar a original mexe além do que lançar mexe: o Caixa, a Produção (a ordem da venda
// cancelada) — as mesmas revalidações de `cancelarDocumento`.
function revalidarCancelamentoDaCorrecao(): void {
  revalidatePath("/gestao/financeiro");
  revalidatePath(rotaDeGestao("/estoque"));
  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao("/"));
}

// A venda de "valor livre" à vista do traçado (Tarefa 1). `exigirUsuario()` é a PRIMEIRA
// instrução do corpo (verificado por `npm run verificar-acoes`, decidido por árvore sintática).
//
// Duas camadas independentes de defesa da soma (D-chave desta fase): esta função recalcula o
// total a partir das linhas e confere a soma das parcelas ANTES de gravar, devolvendo a frase
// humana "faltam/sobram"; a restrição adiada `conferir_soma_do_documento()` (migração 0015)
// confere de novo no fim da transação — pega defeito do próprio servidor, não só do cliente.
export async function lancarVenda(
  entradaBruta: unknown,
): Promise<
  ResultadoDoLancamento<{ id: string; numero: number; origem: string | null; numeroCorrigido: number | null }>
> {
  const usuario = await exigirUsuario();

  const resultado = esquemaVenda.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  const hoje = hojeEmBrasilia(new Date());
  if (!dataDentroDoIntervaloPermitido(dados.data, hoje)) {
    return { ok: false, erro: "Essa data não é válida." };
  }

  // Desconto (D-09/D-10, Tarefa 3): a MESMA função pura que o cliente usa para mostrar reparte
  // os subtotais aqui de novo — o servidor nunca aceita valores de linha já descontados vindos
  // do cliente, só o texto do desconto (`dados.desconto`) e os subtotais que ele mesmo acabou de
  // recalcular acima.
  const subtotaisCentavos = dados.linhas.map((linha) => linha.valorCentavos);
  let valoresFinaisCentavos = subtotaisCentavos;
  if (dados.desconto) {
    const resultadoDesconto = repartirDesconto(subtotaisCentavos, dados.desconto);
    if (!resultadoDesconto.ok) {
      return { ok: false, erro: resultadoDesconto.erro };
    }
    valoresFinaisCentavos = resultadoDesconto.valoresFinais;
  }

  const totalCentavos = valoresFinaisCentavos.reduce((total, valor) => total + valor, 0);
  if (totalCentavos <= 0 || totalCentavos > TETO_CENTAVOS) {
    return {
      ok: false,
      erro: "O total da venda precisa ser maior que zero e até R$ 10.000.000.",
    };
  }

  const configuracao = await obterConfiguracaoFinanceira();

  // `conferirParcelas` (lib/financeiro/parcelas.ts) é a MESMA função que `BlocoPagamento` chama
  // no cliente para mostrar a mensagem de falta/sobra — chamada de novo aqui porque o servidor
  // nunca confia na soma calculada do lado de lá (T-04.4-38): o botão pode ser habilitado à
  // força, e a frase de recusa precisa ser a mesma nos dois lados.
  const conferencia = conferirParcelas({
    totalCentavos,
    parcelas: dados.parcelas.map((parcela) => ({
      vencimento: parcela.vencimento,
      valorCentavos: parcela.valorCentavos,
      pago: parcela.pago,
    })),
    hoje,
    dataSaldoInicial: configuracao.dataSaldoInicial,
  });
  if (!conferencia.ok) {
    return { ok: false, erro: conferencia.erro };
  }

  // Categoria de linha LIVRE carregada do banco: precisa existir, estar ATIVA e ser do grupo
  // `receita` OU `fora` (D-14/suposição 1 do plano 03: é por aí que um aporte dos sócios entra no
  // caixa sem virar venda de nenhuma área) — a categoria vinda do cliente nunca é confiada sem
  // conferência (T-04.4-05 do threat model).
  const idsDeCategoriasLivres = [
    ...new Set(dados.linhas.filter((linha) => linha.tipo === "livre").map((linha) => linha.categoriaId)),
  ];
  const categoriasCarregadas =
    idsDeCategoriasLivres.length > 0
      ? await db
          .select({ id: categorias.id, ativa: categorias.ativa, grupo: categorias.grupo })
          .from(categorias)
          .where(inArray(categorias.id, idsDeCategoriasLivres))
      : [];
  const categoriaPorId = new Map(categoriasCarregadas.map((categoria) => [categoria.id, categoria]));

  for (const linha of dados.linhas) {
    if (linha.tipo !== "livre") {
      continue;
    }
    const categoria = categoriaPorId.get(linha.categoriaId);
    if (!categoria || !categoria.ativa || (categoria.grupo !== "receita" && categoria.grupo !== "fora")) {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não está mais disponível. Recarregue a página e tente de novo.",
      };
    }
  }

  // Item de linha ITEM carregado do banco: o servidor lê descrição, categoria e existência do
  // item — o cliente manda só o identificador, a quantidade e o texto do "cada" (T-04.4-20).
  // Mudar o preço no catálogo depois de lançar não reescreve a venda já lançada (BRIEFING §5): a
  // linha guarda o valor DIGITADO no momento do lançamento, nunca uma referência ao preço atual.
  const idsDeItens = [
    ...new Set(dados.linhas.filter((linha) => linha.tipo === "item").map((linha) => linha.itemId)),
  ];
  const itensCarregados =
    idsDeItens.length > 0
      ? await db
          .select({
            id: itensCatalogo.id,
            nome: itensCatalogo.nome,
            categoriaVendaId: itensCatalogo.categoriaVendaId,
            aparecenaVenda: itensCatalogo.aparecenaVenda,
            ativo: itensCatalogo.ativo,
          })
          .from(itensCatalogo)
          .where(inArray(itensCatalogo.id, idsDeItens))
      : [];
  const itemPorId = new Map(itensCarregados.map((item) => [item.id, item]));

  for (const linha of dados.linhas) {
    if (linha.tipo !== "item") {
      continue;
    }
    const item = itemPorId.get(linha.itemId);
    // Item desativado (D-20) é recusado com a mesma frase: o seletor já o esconde, e um cliente
    // adulterado não o lança (T-06-15).
    if (!item || !item.ativo || !item.aparecenaVenda || !item.categoriaVendaId) {
      return {
        ok: false,
        erro: "Um dos itens saiu do catálogo — tire a linha e tente de novo.",
      };
    }
  }

  // A original que esta venda corrige (Fase 06.5, plano 16), exclusiva com `origem` pelo esquema.
  const correcao = dados.correcao;

  try {
    // O pedido montado aqui leva só o que já foi validado acima: a descrição e a categoria da
    // linha de item vêm do catálogo (`itemPorId`), e o valor é o FINAL, já descontado. A escrita
    // (documento → linhas → baixa de estoque → parcelas com a taxa congelada) é a de
    // `gravarVenda` (`lib/financeiro/gravacao.ts`), o mesmo escritor que a Agenda usa.
    const pedido: PedidoDeVenda = {
      data: dados.data,
      pessoaNome: dados.pessoa,
      linhas: dados.linhas.map((linha, indice) => {
        const valorCentavos = valoresFinaisCentavos[indice];
        if (linha.tipo === "item") {
          // Não-nulo: já conferido no laço de validação acima.
          const item = itemPorId.get(linha.itemId)!;
          return {
            tipo: "item" as const,
            itemId: item.id,
            descricao: item.nome,
            categoriaId: item.categoriaVendaId!,
            quantidade: linha.quantidade,
            valorCentavos,
          };
        }
        return {
          tipo: "livre" as const,
          descricao: linha.descricao,
          categoriaId: linha.categoriaId,
          valorCentavos,
        };
      }),
      parcelas: dados.parcelas.map((parcela) => ({
        vencimento: parcela.vencimento,
        valorCentavos: parcela.valorCentavos,
        forma: parcela.forma,
        pago: parcela.pago,
      })),
    };

    const origem = dados.origem;
    let numeroCorrigido: number | null = null;
    const { id, numero } = await db.transaction(async (tx) => {
      // O “Corrigir” (Fase 06.5, plano 16 — D-18/UI-D9): a nova é ESTA venda, gravada pelo mesmo
      // `gravarVenda`, mas só depois de `lancarCorrecaoNaTransacao` travar a original, conferir (cancelada,
      // já corrigida, origem, versão) e cancelá-la pelo núcleo de `cancelarDocumento`; o vínculo nasce na
      // mesma transação. Qualquer recusa → `RecusaDaCorrecao`, nada gravado.
      if (correcao) {
        const lancada = await lancarCorrecaoNaTransacao(tx, {
          originalId: correcao.documentoId,
          versao: correcao.versao,
          tipo: "venda",
          usuarioId: usuario.id,
          // BL-01 (quick 261007-shs): as parcelas já recebidas da original vêm do BANCO, lidas por
          // `lancarCorrecaoNaTransacao` sob a trava — nada do navegador entra na taxa. A recebida que é a
          // mesma mantém a taxa com que foi recebida; só a nova (ou em aberto marcada paga agora) usa a de
          // hoje.
          gravarNova: (txDaNova: TransacaoDoBanco, pagasDaOriginal) =>
            gravarVenda(txDaNova, pedido, {
              registradoPor: usuario.id,
              taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
              pagasDaOriginal,
            }),
        });
        numeroCorrigido = lancada.numeroOriginal;
        return { id: lancada.id, numero: lancada.numero };
      }

      if (!origem) {
        return gravarVenda(tx, pedido, {
          registradoPor: usuario.id,
          taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
        });
      }

      // A Venda aberta pelas Queimas (Fase 06.4, plano 05 — QMC-08, D-07). O despacho é pelo MÓDULO da
      // origem (`moduloDaOrigem`); a Agenda, abaixo, segue exatamente o caminho de antes. A ordem de
      // travas é a das Queimas: QUEIMA → (leitura dos vínculos) → documento novo → ITENS → vínculo novo.
      // `vincularQueimaNaVenda` trava a queima e confere, sob a trava, que ainda falta algo; as quantidades
      // do vínculo são as das linhas desta venda com um dos três itens das Queimas, somadas por tamanho, e
      // não podem passar do que falta AGORA — senão `RecusaDasQueimas` com a frase da tela, nada gravado:
      // nenhuma linha de queima → `FRASE_LINHA_DA_QUEIMA_FALTANDO` (o painel recusa antes, no cliente; esta é
      // a defesa contra um pedido forjado); algum tamanho acima do que falta → `fraseAcimaDoQueFaltaNaVenda`.
      // A pessoa NÃO é sobrescrita: a queima externa não tem cliente; vale o que o dono escreveu.
      // Quick 261008-pmi (08/10/2026), auditoria 08/10 — Queimas, aviso 1: a Venda manda as vendas ativas
      // que a página leu (`vendasVistas`), e `vincularQueimaNaVenda` recusa sob a trava se as de agora são
      // outras (`RecusaDasQueimas` com `telaMudou`) — um segundo “Lançar venda” depois de uma resposta
      // perdida nunca grava outra venda das mesmas peças. Sem o retrato (o esquema já recusa), recusa
      // aqui também: a conferência nunca é pulada.
      if (!ehOrigemDaAgenda(origem)) {
        if (dados.vendasVistas === null) {
          throw new RecusaDasQueimas(FRASE_VENDA_DESATUALIZADA);
        }
        const vinculoDaQueima = await vincularQueimaNaVenda(tx, origem.id, dados.vendasVistas);
        const quantidades = vinculoDaQueima.conferir(pedido.linhas);
        const gravadaDaQueima = await gravarVenda(tx, pedido, {
          registradoPor: usuario.id,
          taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
        });
        await vinculoDaQueima.gravar(gravadaDaQueima.id, quantidades, usuario.id);
        return gravadaDaQueima;
      }

      // A Venda aberta pela Agenda (Fase 05, plano 12 — AGE-15, D-01, D-04, Pitfall 8). A ordem de
      // travas é COBRANÇA → documento novo → ITENS: `vincularCobranca` trava a cobrança
      // (`for no key update`) e confere, sob a trava, que ela ainda está livre ANTES de `gravarVenda`
      // — senão lança `RecusaDaAgenda` com a frase da tela e nada é gravado. O servidor SOBRESCREVE a
      // pessoa, o cliente e a descrição da linha de origem (a PRIMEIRA linha com o item do sistema
      // daquela cobrança) pelo que a cobrança diz: o que o navegador mandou nesses campos não vale.
      const vinculo = await vincularCobranca(tx, origem);
      const indiceDaOrigem = pedido.linhas.findIndex(
        (linha) => linha.tipo === "item" && linha.itemId === vinculo.itemDoSistemaId,
      );
      if (indiceDaOrigem < 0) {
        throw new RecusaDaAgenda(FRASE_LINHA_DA_AGENDA_FALTANDO);
      }
      const pedidoDaOrigem: PedidoDeVenda = {
        ...pedido,
        pessoaNome: vinculo.clienteNome,
        clienteId: vinculo.clienteId,
        linhas: pedido.linhas.map((linha, indice) =>
          indice === indiceDaOrigem ? { ...linha, descricao: vinculo.descricao } : linha,
        ),
      };
      const gravada = await gravarVenda(tx, pedidoDaOrigem, {
        registradoPor: usuario.id,
        taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
      });
      // O vínculo cobrança → venda na MESMA transação (uma cobrança nunca vira duas vendas ativas).
      await vinculo.gravar(gravada.id);
      return gravada;
    });

    revalidatePath(rotaDeGestao("/estoque"));
    revalidatePath(rotaDeGestao("/"));
    if (origem && moduloDaOrigem(origem.tipo) === "agenda") {
      revalidatePath(rotaDeGestao("/agenda"));
    }
    if (origem && moduloDaOrigem(origem.tipo) === "queimas") {
      revalidatePath(rotaDeGestao("/queimas"));
      revalidatePath(rotaDeGestao("/queimas/[id]"), "page");
    }
    if (correcao) {
      revalidarCancelamentoDaCorrecao();
    }
    return {
      ok: true,
      dados: { id, numero, origem: origem ? textoDaOrigem(origem) : null, numeroCorrigido },
    };
  } catch (erro) {
    if (erro instanceof RecusaDaCorrecao) {
      return respostaDaRecusaDaCorrecao(erro, "venda");
    }
    if (erro instanceof RecusaDasQueimas && erro.detalhe?.telaMudou) {
      return { ok: false, erro: erro.frase, telaMudou: true };
    }
    if (erro instanceof RecusaDaAgenda || erro instanceof RecusaDasQueimas) {
      return { ok: false, erro: erro.frase };
    }
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao lançar venda:", erro);
    if (correcao) {
      return respostaDaFalhaDaCorrecao("venda", correcao.documentoId);
    }
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// A Despesa (04.4-07-PLAN.md): compra de material · outra despesa. A terceira pílula original,
// "pagar conta que já existe" (um link para `?aba=caixa`, nunca chegava aqui), foi REMOVIDA em
// 26/09/2026 por decisão do dono — pareceu inútil e grande no uso real no celular; quem quer
// pagar uma conta que já existe vai por Caixa → "A pagar" → "Paguei" (ver BRIEFING.md §1).
// `exigirUsuario()` é a PRIMEIRA instrução do corpo, mesma disciplina de `lancarVenda`.
// Compartilha `conferirParcelas`, a checagem de data e o teto de centavos com a Venda; a
// diferença é só a validação de categoria por grupo/estoque e a AUSÊNCIA TOTAL de taxa — despesa
// no cartão nunca congela `taxaPontosBase`, mesmo quando a forma é "cartao" (BRIEFING/must_have
// desta plano).
export async function lancarDespesa(
  entradaBruta: unknown,
): Promise<ResultadoDoLancamento<{ id: string; numero: number; numeroCorrigido: number | null }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDespesa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  const hoje = hojeEmBrasilia(new Date());
  if (!dataDentroDoIntervaloPermitido(dados.data, hoje)) {
    return { ok: false, erro: "Essa data não é válida." };
  }

  const configuracao = await obterConfiguracaoFinanceira();

  type LinhaParaGravar = {
    itemId: string | null;
    descricao: string;
    categoriaId: string;
    quantidadeEstoque: string | null;
    valorCentavos: number;
  };

  let linhasParaGravar: LinhaParaGravar[];

  if (dados.modo === "compra") {
    // Compra: o cliente manda só o `itemId`, a quantidade que chegou e quanto custou ao todo —
    // nome, categoria de compra e "controla estoque" vêm do banco (T-04.4-44/T-04.4-46). Cada
    // material precisa ter estoque próprio no catálogo, senão a compra inteira é recusada.
    const idsDeItens = [...new Set(dados.linhas.map((linha) => linha.itemId))];
    const itensCarregados =
      idsDeItens.length > 0
        ? await db
            .select({
              id: itensCatalogo.id,
              nome: itensCatalogo.nome,
              controlaEstoque: itensCatalogo.controlaEstoque,
              categoriaCompraId: itensCatalogo.categoriaCompraId,
              ativo: itensCatalogo.ativo,
            })
            .from(itensCatalogo)
            .where(inArray(itensCatalogo.id, idsDeItens))
        : [];
    const itemPorId = new Map(itensCarregados.map((item) => [item.id, item]));

    for (const linha of dados.linhas) {
      const item = itemPorId.get(linha.itemId);
      // Item desativado (D-20): mesma frase da Venda — o seletor da Compra já o esconde (T-06-15).
      if (item && !item.ativo) {
        return {
          ok: false,
          erro: "Um dos itens saiu do catálogo — tire a linha e tente de novo.",
        };
      }
      if (!item || !item.controlaEstoque || !item.categoriaCompraId) {
        return {
          ok: false,
          erro: "Esse material não tem estoque próprio no catálogo — ajuste em Cadastros.",
        };
      }
    }

    linhasParaGravar = dados.linhas.map((linha) => {
      // Não-nulo: já conferido no laço de validação acima.
      const item = itemPorId.get(linha.itemId)!;
      return {
        itemId: item.id,
        descricao: item.nome,
        categoriaId: item.categoriaCompraId!,
        quantidadeEstoque: linha.quantidadeEstoque,
        valorCentavos: linha.valorCentavos,
      };
    });
  } else {
    // Outra despesa: categoria carregada do banco — precisa existir, não ser do grupo `receita`
    // (o usuário nunca lança despesa contra uma categoria de venda) e estar ATIVA (T-04.4-44).
    const [categoria] = await db
      .select({
        id: categorias.id,
        nome: categorias.nome,
        ativa: categorias.ativa,
        grupo: categorias.grupo,
      })
      .from(categorias)
      .where(eq(categorias.id, dados.categoriaId))
      .limit(1);

    if (!categoria) {
      return {
        ok: false,
        erro: "Essa categoria não existe mais. Recarregue a página e tente de novo.",
      };
    }
    if (categoria.grupo === "receita") {
      return {
        ok: false,
        erro: "Essa categoria é de receita — escolha uma categoria de despesa.",
      };
    }
    if (!categoria.ativa) {
      return { ok: false, erro: `A categoria ${categoria.nome} foi desativada — escolha outra.` };
    }

    linhasParaGravar = [
      {
        itemId: null,
        descricao: dados.descricao,
        categoriaId: categoria.id,
        quantidadeEstoque: null,
        valorCentavos: dados.valorCentavos,
      },
    ];
  }

  const totalCentavos = linhasParaGravar.reduce((total, linha) => total + linha.valorCentavos, 0);
  if (totalCentavos <= 0 || totalCentavos > TETO_CENTAVOS) {
    return {
      ok: false,
      erro: "O total da despesa precisa ser maior que zero e até R$ 10.000.000.",
    };
  }

  const conferencia = conferirParcelas({
    totalCentavos,
    parcelas: dados.parcelas.map((parcela) => ({
      vencimento: parcela.vencimento,
      valorCentavos: parcela.valorCentavos,
      pago: parcela.pago,
    })),
    hoje,
    dataSaldoInicial: configuracao.dataSaldoInicial,
  });
  if (!conferencia.ok) {
    return { ok: false, erro: conferencia.erro };
  }

  // A original que esta despesa corrige (Fase 06.5, plano 16).
  const correcao = dados.correcao;

  try {
    // A escrita (fornecedor sob trava → documento → linhas → entrada de estoque da compra → parcelas
    // sem taxa) é a de `gravarDespesa` (`lib/financeiro/gravacao.ts`, Fase 06.5 plano 16 — extraída
    // daqui sem mudar nada, para o “Corrigir” lançar a despesa nova pelo mesmo escritor).
    const gravarEstaDespesa = (tx: TransacaoDoBanco) =>
      gravarDespesa(
        tx,
        {
          modo: dados.modo,
          data: dados.data,
          pessoaNome: dados.pessoa,
          fornecedorId: dados.fornecedorId,
          linhas: linhasParaGravar,
          parcelas: dados.parcelas,
        },
        { registradoPor: usuario.id },
      );
    let numeroCorrigido: number | null = null;
    const { id, numero } = await db.transaction(async (tx) => {
      // O “Corrigir” (D-18/UI-D9): a mesma sequência de `lancarVenda` — trava e confere a original, cancela
      // pelo núcleo de `cancelarDocumento`, grava ESTA despesa pelo mesmo escritor e liga as duas.
      if (correcao) {
        const lancada = await lancarCorrecaoNaTransacao(tx, {
          originalId: correcao.documentoId,
          versao: correcao.versao,
          tipo: "despesa",
          usuarioId: usuario.id,
          // A despesa nunca tem taxa (`gravarDespesa` grava `null` sempre): as pagas da original que o núcleo
          // passa são ignoradas de propósito — e o núcleo confere depois que a nova continua com `null`.
          gravarNova: (txDaNova) => gravarEstaDespesa(txDaNova),
        });
        numeroCorrigido = lancada.numeroOriginal;
        return { id: lancada.id, numero: lancada.numero };
      }
      return gravarEstaDespesa(tx);
    });

    if (dados.modo === "compra") {
      revalidatePath(rotaDeGestao("/estoque"));
      revalidatePath(rotaDeGestao("/"));
    }
    if (correcao) {
      revalidarCancelamentoDaCorrecao();
    }
    return { ok: true, dados: { id, numero, numeroCorrigido } };
  } catch (erro) {
    if (erro instanceof RecusaDaCorrecao) {
      return respostaDaRecusaDaCorrecao(erro, "despesa");
    }
    if (erro instanceof FornecedorIndisponivel) {
      return { ok: false, erro: FRASE_FORNECEDOR_DESATIVADO_NA_DESPESA };
    }
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao lançar despesa:", erro);
    if (correcao) {
      return respostaDaFalhaDaCorrecao("despesa", correcao.documentoId);
    }
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

const esquemaAtalho = z.object({
  itemId: esquemaId,
  tipo: z.enum(["venda", "compra"]),
  marcado: z.boolean(),
});

// Grava o estado DESEJADO do atalho (nunca "inverte") — a mesma disciplina convergente de
// `CaixaMarcacao`/`marcarItemResolvido`: duas chamadas com o mesmo valor convergem sempre para o
// mesmo resultado, mesmo com respostas fora de ordem. Recusa atalho de venda em item que não
// aparece na venda, e atalho de compra em item que não controla estoque.
export async function definirAtalhoDoItem(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ marcado: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaAtalho.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { itemId, tipo, marcado } = resultado.data;

  const [item] = await db
    .select({
      aparecenaVenda: itensCatalogo.aparecenaVenda,
      controlaEstoque: itensCatalogo.controlaEstoque,
      ativo: itensCatalogo.ativo,
    })
    .from(itensCatalogo)
    .where(eq(itensCatalogo.id, itemId))
    .limit(1);

  if (!item) {
    return { ok: false, erro: "Esse item não existe mais. Recarregue a página e tente de novo." };
  }
  // Item desativado (D-20) não ganha atalho — o seletor já o esconde.
  if (!item.ativo) {
    return {
      ok: false,
      erro: "Esse item está desativado — reative em Cadastros → Catálogo para marcar atalho.",
    };
  }
  if (tipo === "venda" && !item.aparecenaVenda) {
    return { ok: false, erro: "Esse item não aparece na venda — não dá para marcar atalho." };
  }
  if (tipo === "compra" && !item.controlaEstoque) {
    return { ok: false, erro: "Esse item não controla estoque — não dá para marcar atalho de compra." };
  }

  await db
    .update(itensCatalogo)
    .set(tipo === "venda" ? { atalhoVenda: marcado } : { atalhoCompra: marcado })
    .where(eq(itensCatalogo.id, itemId));

  revalidatePath("/gestao/financeiro");
  return { ok: true, dados: { marcado } };
}

// O Caixa (04.4-08-PLAN.md): cancelar risca sem apagar (FNC-10). Nenhum `delete` — o documento
// ganha `cancelado_em`/`cancelado_por`; a única exclusão física do módulo inteiro é a linha de
// diferença, e só dentro de `desfazerPagamento`. `select ... for update` trava a linha do
// documento (mesma disciplina de `editarCategoria`, lib/cadastros/acoes.ts) para duas pessoas
// cancelando o MESMO documento ao mesmo tempo nunca cancelarem duas vezes. O miolo — trava,
// “já cancelado”, a ordem da venda, o estorno, quem/quando — mora em `cancelarDocumentoNaTransacao`
// (`lib/financeiro/gravacao.ts`, Fase 06.5 plano 16), o MESMO que o “Corrigir” usa.
export async function cancelarDocumento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ documentoId: string; numero: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCancelamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { documentoId } = resultado.data;

  try {
    const { numero } = await db.transaction((tx) =>
      cancelarDocumentoNaTransacao(tx, documentoId, usuario.id),
    );

    revalidatePath("/gestao/financeiro");
    revalidatePath(rotaDeGestao("/estoque"));
    revalidatePath(rotaDeGestao("/producao"));
    revalidatePath(rotaDeGestao("/"));
    return { ok: true, dados: { documentoId, numero } };
  } catch (erro) {
    if (erro instanceof DocumentoNaoEncontrado) {
      return { ok: false, erro: FRASE_LANCAMENTO_NAO_EXISTE_MAIS };
    }
    if (erro instanceof DocumentoJaCancelado) {
      return { ok: false, erro: FRASE_LANCAMENTO_JA_CANCELADO };
    }
    console.error("Falha ao cancelar lançamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Paguei"/"Recebi" (04.4-08-PLAN.md, Tarefa 3): a linha de diferença (D-01/D-02) e o previsto
// guardado para o "Desfazer" (D-03) — `planejarPagamento` (lib/financeiro/pagamento.ts, puro)
// decide o QUE muda; esta ação só EXECUTA dentro de uma transação que trava o documento e depois
// a parcela (`for update`, sempre nessa ordem — mesma ordem de `desfazerPagamento` abaixo, o que
// evita deadlock entre as duas). A restrição adiada do banco (migração 0015) confere de novo, no
// commit, que a soma das parcelas fecha com a soma das linhas.
class ParcelaNaoEncontrada extends Error {}
class ParcelaJaPaga extends Error {}
class DocumentoCancelado extends Error {}

export async function registrarPagamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ parcelaId: string }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaPagamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  const hoje = hojeEmBrasilia(new Date());
  if (dados.pagoEm > hoje) {
    return { ok: false, erro: FRASE_DATA_DE_PAGAMENTO_FUTURA };
  }

  const configuracao = await obterConfiguracaoFinanceira();
  if (configuracao.dataSaldoInicial && dados.pagoEm < configuracao.dataSaldoInicial) {
    return { ok: false, erro: FRASE_DATA_DE_PAGAMENTO_ANTES_DO_SALDO_INICIAL };
  }

  try {
    await db.transaction(async (tx) => {
      // Leitura SEM trava: só para achar o documento da parcela — o id do documento de uma
      // parcela nunca muda, não precisa de lock para isso.
      const [parcelaBruta] = await tx
        .select({ documentoId: parcelas.documentoId })
        .from(parcelas)
        .where(eq(parcelas.id, dados.parcelaId))
        .limit(1);
      if (!parcelaBruta) {
        throw new ParcelaNaoEncontrada();
      }

      // (1) Trava o DOCUMENTO primeiro.
      const [documento] = await tx
        .select({ id: documentos.id, tipo: documentos.tipo, canceladoEm: documentos.canceladoEm })
        .from(documentos)
        .where(eq(documentos.id, parcelaBruta.documentoId))
        .for("update");
      if (!documento) {
        throw new ParcelaNaoEncontrada();
      }
      if (documento.canceladoEm) {
        throw new DocumentoCancelado();
      }

      // (2) Trava a PARCELA depois.
      const [parcela] = await tx
        .select({
          id: parcelas.id,
          numero: parcelas.numero,
          forma: parcelas.forma,
          valorCentavos: parcelas.valorCentavos,
          pagoEm: parcelas.pagoEm,
        })
        .from(parcelas)
        .where(eq(parcelas.id, dados.parcelaId))
        .for("update");
      if (!parcela) {
        throw new ParcelaNaoEncontrada();
      }
      if (parcela.pagoEm) {
        throw new ParcelaJaPaga();
      }

      const [[{ total: quantidadeDeLinhas }], [{ total: quantidadeDeParcelas }]] = await Promise.all([
        tx.select({ total: count() }).from(documentoLinhas).where(eq(documentoLinhas.documentoId, documento.id)),
        tx.select({ total: count() }).from(parcelas).where(eq(parcelas.documentoId, documento.id)),
      ]);

      const plano = planejarPagamento({
        tipoDocumento: documento.tipo,
        quantidadeDeLinhas: Number(quantidadeDeLinhas),
        quantidadeDeParcelas: Number(quantidadeDeParcelas),
        previstoCentavos: parcela.valorCentavos,
        pagoCentavos: dados.valorCentavos,
        formaAnterior: parcela.forma as FormaDePagamento,
        formaNova: dados.forma,
        taxaPontosBaseAtual: configuracao.taxaCartaoPontosBase,
      });

      if (plano.acaoNaLinha === "ajustar") {
        // Só existe UMA linha quando `quantidadeDeLinhas === 1` — a mesma condição que fez
        // `planejarPagamento` escolher "ajustar" em vez de "diferenca".
        const [linhaUnica] = await tx
          .select({ id: documentoLinhas.id })
          .from(documentoLinhas)
          .where(eq(documentoLinhas.documentoId, documento.id))
          .limit(1);
        await tx
          .update(documentoLinhas)
          .set({ valorCentavos: dados.valorCentavos })
          .where(eq(documentoLinhas.id, linhaUnica.id));
      } else if (plano.acaoNaLinha === "diferenca") {
        // A categoria da diferença é achada pela CHAVE do sistema, nunca pelo nome (D-02/D-14) —
        // o dono pode renomear "Juros, multas e descontos" livremente sem quebrar isto.
        const [categoriaDiferenca] = await tx
          .select({ id: categorias.id })
          .from(categorias)
          .where(eq(categorias.chaveDoSistema, "diferenca"))
          .limit(1);
        if (!categoriaDiferenca) {
          throw new Error("Categoria de diferença (chave_do_sistema = 'diferenca') não encontrada.");
        }
        const [ultimaLinha] = await tx
          .select({ ordem: documentoLinhas.ordem })
          .from(documentoLinhas)
          .where(eq(documentoLinhas.documentoId, documento.id))
          .orderBy(desc(documentoLinhas.ordem))
          .limit(1);
        const descricaoDiferenca =
          quantidadeDeParcelas > 1
            ? `Diferença no pagamento da parcela ${parcela.numero} de ${quantidadeDeParcelas}`
            : "Diferença no pagamento";
        await tx.insert(documentoLinhas).values({
          documentoId: documento.id,
          ordem: (ultimaLinha?.ordem ?? -1) + 1,
          descricao: descricaoDiferenca,
          categoriaId: categoriaDiferenca.id,
          quantidade: 1,
          valorCentavos: plano.diferencaCentavos,
          parcelaDiferencaId: parcela.id,
        });
      }

      await tx
        .update(parcelas)
        .set({
          valorCentavos: dados.valorCentavos,
          valorPrevistoCentavos: parcela.valorCentavos,
          formaPrevista: parcela.forma,
          forma: dados.forma,
          pagoEm: dados.pagoEm,
          pagoPor: usuario.id,
          taxaPontosBase: plano.taxaPontosBase,
        })
        .where(eq(parcelas.id, parcela.id));
    });

    revalidatePath("/gestao/financeiro");
    return { ok: true, dados: { parcelaId: dados.parcelaId } };
  } catch (erro) {
    if (erro instanceof ParcelaNaoEncontrada) {
      return { ok: false, erro: FRASE_LANCAMENTO_NAO_EXISTE_MAIS };
    }
    if (erro instanceof DocumentoCancelado) {
      return { ok: false, erro: FRASE_LANCAMENTO_CANCELADO_SEM_PAGAMENTO };
    }
    if (erro instanceof ParcelaJaPaga) {
      return { ok: false, erro: FRASE_CONTA_JA_PAGA };
    }
    console.error("Falha ao registrar pagamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// O inverso exato de `registrarPagamento` (D-03): `planejarDesfazer` (puro) decide o que
// restaurar; esta ação só executa — mesma ordem de trava (documento, depois parcela). A ÚNICA
// exclusão física do módulo Financeiro inteiro é a linha de diferença aqui embaixo, e só quando
// ELA MESMA foi criada pelo pagamento que está sendo desfeito (achada por `parcela_diferenca_id`,
// nunca por nome/ordem).
class ParcelaEmAberto extends Error {}
class SemPrevistoGuardado extends Error {}

export async function desfazerPagamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ parcelaId: string }>> {
  await exigirUsuario();

  const resultado = esquemaDesfazer.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { parcelaId } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [parcelaBruta] = await tx
        .select({ documentoId: parcelas.documentoId })
        .from(parcelas)
        .where(eq(parcelas.id, parcelaId))
        .limit(1);
      if (!parcelaBruta) {
        throw new ParcelaNaoEncontrada();
      }

      // (1) Trava o DOCUMENTO primeiro — mesma ordem de `registrarPagamento`.
      const [documento] = await tx
        .select({ id: documentos.id, canceladoEm: documentos.canceladoEm })
        .from(documentos)
        .where(eq(documentos.id, parcelaBruta.documentoId))
        .for("update");
      if (!documento) {
        throw new ParcelaNaoEncontrada();
      }
      if (documento.canceladoEm) {
        throw new DocumentoCancelado();
      }

      // (2) Trava a PARCELA depois.
      const [parcela] = await tx
        .select({
          id: parcelas.id,
          pagoEm: parcelas.pagoEm,
          valorCentavos: parcelas.valorCentavos,
          valorPrevistoCentavos: parcelas.valorPrevistoCentavos,
          formaPrevista: parcelas.formaPrevista,
        })
        .from(parcelas)
        .where(eq(parcelas.id, parcelaId))
        .for("update");
      if (!parcela) {
        throw new ParcelaNaoEncontrada();
      }
      if (!parcela.pagoEm) {
        throw new ParcelaEmAberto();
      }

      const [linhaDeDiferenca] = await tx
        .select({ id: documentoLinhas.id })
        .from(documentoLinhas)
        .where(eq(documentoLinhas.parcelaDiferencaId, parcela.id))
        .limit(1);

      const [[{ total: quantidadeDeLinhas }], [{ total: quantidadeDeParcelas }]] = await Promise.all([
        tx.select({ total: count() }).from(documentoLinhas).where(eq(documentoLinhas.documentoId, documento.id)),
        tx.select({ total: count() }).from(parcelas).where(eq(parcelas.documentoId, documento.id)),
      ]);

      const plano = planejarDesfazer({
        temLinhaDeDiferenca: linhaDeDiferenca !== undefined,
        quantidadeDeLinhas: Number(quantidadeDeLinhas),
        quantidadeDeParcelas: Number(quantidadeDeParcelas),
        previstoCentavos: parcela.valorPrevistoCentavos,
        pagoCentavos: parcela.valorCentavos,
        formaPrevista: parcela.formaPrevista as FormaDePagamento | null,
      });

      if (!plano.ok) {
        throw new SemPrevistoGuardado(plano.erro);
      }

      if (plano.acaoNaLinha === "diferenca" && linhaDeDiferenca) {
        // A ÚNICA exclusão física de `lib/financeiro/acoes.ts` — SEMPRE filtrada por
        // `parcela_diferenca_id`, nunca por outro critério.
        await tx.delete(documentoLinhas).where(eq(documentoLinhas.id, linhaDeDiferenca.id));
      } else if (plano.acaoNaLinha === "ajustar") {
        const [linhaUnica] = await tx
          .select({ id: documentoLinhas.id })
          .from(documentoLinhas)
          .where(eq(documentoLinhas.documentoId, documento.id))
          .limit(1);
        await tx
          .update(documentoLinhas)
          .set({ valorCentavos: plano.valorParaRestaurarCentavos })
          .where(eq(documentoLinhas.id, linhaUnica.id));
      }

      await tx
        .update(parcelas)
        .set({
          valorCentavos: plano.valorParaRestaurarCentavos,
          forma: plano.formaParaRestaurar,
          pagoEm: null,
          pagoPor: null,
          taxaPontosBase: null,
          valorPrevistoCentavos: null,
          formaPrevista: null,
        })
        .where(eq(parcelas.id, parcela.id));
    });

    revalidatePath("/gestao/financeiro");
    return { ok: true, dados: { parcelaId } };
  } catch (erro) {
    if (erro instanceof ParcelaNaoEncontrada) {
      return { ok: false, erro: FRASE_LANCAMENTO_NAO_EXISTE_MAIS };
    }
    if (erro instanceof DocumentoCancelado) {
      return { ok: false, erro: FRASE_DESFAZER_LANCAMENTO_CANCELADO };
    }
    if (erro instanceof ParcelaEmAberto) {
      return { ok: false, erro: FRASE_DESFAZER_EM_ABERTO };
    }
    if (erro instanceof SemPrevistoGuardado) {
      return { ok: false, erro: erro.message || FRASE_DESFAZER_SEM_PREVISTO };
    }
    console.error("Falha ao desfazer pagamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

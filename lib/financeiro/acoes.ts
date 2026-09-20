"use server";

import { z } from "zod";
import { count, desc, eq, inArray } from "drizzle-orm";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categorias, documentoLinhas, documentos, itensCatalogo, parcelas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";

import { obterConfiguracaoFinanceira } from "./consultas";
import { repartirDesconto } from "./desconto";
import { TETO_CENTAVOS } from "./dinheiro";
import {
  dataDentroDoIntervaloPermitido,
  esquemaCancelamento,
  esquemaDesfazer,
  esquemaDespesa,
  esquemaId,
  esquemaPagamento,
  esquemaVenda,
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
  FRASE_LANCAMENTO_CANCELADO_SEM_PAGAMENTO,
  FRASE_LANCAMENTO_JA_CANCELADO,
  FRASE_LANCAMENTO_NAO_EXISTE_MAIS,
  type FormaDePagamento,
} from "./textos";

// Mesma forma de `lib/abertura/acoes.ts`/`lib/cotacoes/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Detector de SQLSTATE 23503 (foreign_key_violation) vive em `@/lib/erro/postgres`.

// A venda de "valor livre" à vista do traçado (Tarefa 1). `exigirUsuario()` é a PRIMEIRA
// instrução do corpo (verificado por `npm run verificar-acoes`, decidido por árvore sintática).
//
// Duas camadas independentes de defesa da soma (D-chave desta fase): esta função recalcula o
// total a partir das linhas e confere a soma das parcelas ANTES de gravar, devolvendo a frase
// humana "faltam/sobram"; a restrição adiada `conferir_soma_do_documento()` (migração 0015)
// confere de novo no fim da transação — pega defeito do próprio servidor, não só do cliente.
export async function lancarVenda(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; numero: number }>> {
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
    if (!item || !item.aparecenaVenda || !item.categoriaVendaId) {
      return {
        ok: false,
        erro: "Um dos itens saiu do catálogo — tire a linha e tente de novo.",
      };
    }
  }

  try {
    const { id, numero } = await db.transaction(async (tx) => {
      const [documento] = await tx
        .insert(documentos)
        .values({
          tipo: "venda",
          data: dados.data,
          pessoaNome: dados.pessoa,
          criadoPor: usuario.id,
        })
        .returning({ id: documentos.id, numero: documentos.numero });

      await tx.insert(documentoLinhas).values(
        dados.linhas.map((linha, indice) => {
          // O valor gravado é o FINAL (já com a parte do desconto desta linha, se houver) — nunca
          // o subtotal bruto (D-09: "não é linha separada", o desconto mora dentro das linhas).
          const valorCentavos = valoresFinaisCentavos[indice];
          if (linha.tipo === "item") {
            // Não-nulo: já conferido no laço de validação acima.
            const item = itemPorId.get(linha.itemId)!;
            return {
              documentoId: documento.id,
              ordem: indice,
              itemId: item.id,
              descricao: item.nome,
              categoriaId: item.categoriaVendaId!,
              quantidade: linha.quantidade,
              valorCentavos,
            };
          }
          return {
            documentoId: documento.id,
            ordem: indice,
            descricao: linha.descricao,
            categoriaId: linha.categoriaId,
            valorCentavos,
          };
        }),
      );

      await tx.insert(parcelas).values(
        dados.parcelas.map((parcela, indice) => {
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
            pagoPor: parcela.pago ? usuario.id : null,
            taxaPontosBase: pagaNoCartao ? configuracao.taxaCartaoPontosBase : null,
          };
        }),
      );

      return { id: documento.id, numero: documento.numero };
    });

    return { ok: true, dados: { id, numero } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao lançar venda:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// A Despesa (04.4-07-PLAN.md): compra de material · outra despesa (a terceira pílula, "pagar
// conta que já existe", é só um link para `?aba=caixa` — nunca chega aqui). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo, mesma disciplina de `lancarVenda`. Compartilha `conferirParcelas`,
// a checagem de data e o teto de centavos com a Venda; a diferença é só a validação de categoria
// por grupo/estoque e a AUSÊNCIA TOTAL de taxa — despesa no cartão nunca congela
// `taxaPontosBase`, mesmo quando a forma é "cartao" (BRIEFING/must_have desta plano).
export async function lancarDespesa(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; numero: number }>> {
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
            })
            .from(itensCatalogo)
            .where(inArray(itensCatalogo.id, idsDeItens))
        : [];
    const itemPorId = new Map(itensCarregados.map((item) => [item.id, item]));

    for (const linha of dados.linhas) {
      const item = itemPorId.get(linha.itemId);
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

  try {
    const { id, numero } = await db.transaction(async (tx) => {
      const [documento] = await tx
        .insert(documentos)
        .values({
          tipo: "despesa",
          data: dados.data,
          pessoaNome: dados.pessoa,
          criadoPor: usuario.id,
        })
        .returning({ id: documentos.id, numero: documentos.numero });

      await tx.insert(documentoLinhas).values(
        linhasParaGravar.map((linha, indice) => ({
          documentoId: documento.id,
          ordem: indice,
          itemId: linha.itemId,
          descricao: linha.descricao,
          categoriaId: linha.categoriaId,
          quantidade: 1,
          quantidadeEstoque: linha.quantidadeEstoque,
          valorCentavos: linha.valorCentavos,
        })),
      );

      // Despesa NUNCA tem taxa — `taxaPontosBase` sempre nulo, mesmo quando a forma é "cartao"
      // (o preço já é o que o fornecedor cobrou; a taxa da maquininha só existe do lado de quem
      // RECEBE, nunca de quem paga).
      await tx.insert(parcelas).values(
        dados.parcelas.map((parcela, indice) => ({
          documentoId: documento.id,
          numero: indice + 1,
          vencimento: parcela.vencimento,
          valorCentavos: parcela.valorCentavos,
          forma: parcela.forma,
          pagoEm: parcela.pago ? parcela.vencimento : null,
          pagoPor: parcela.pago ? usuario.id : null,
          taxaPontosBase: null,
        })),
      );

      return { id: documento.id, numero: documento.numero };
    });

    return { ok: true, dados: { id, numero } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Uma das categorias escolhidas não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao lançar despesa:", erro);
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
    .select({ aparecenaVenda: itensCatalogo.aparecenaVenda, controlaEstoque: itensCatalogo.controlaEstoque })
    .from(itensCatalogo)
    .where(eq(itensCatalogo.id, itemId))
    .limit(1);

  if (!item) {
    return { ok: false, erro: "Esse item não existe mais. Recarregue a página e tente de novo." };
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

  revalidatePath("/financeiro");
  return { ok: true, dados: { marcado } };
}

// O Caixa (04.4-08-PLAN.md): cancelar risca sem apagar (FNC-10). Nenhum `delete` — o documento
// ganha `cancelado_em`/`cancelado_por`; a única exclusão física do módulo inteiro é a linha de
// diferença, e só dentro de `desfazerPagamento`. `select ... for update` trava a linha do
// documento (mesma disciplina de `editarCategoria`, lib/cadastros/acoes.ts) para duas pessoas
// cancelando o MESMO documento ao mesmo tempo nunca cancelarem duas vezes.
class DocumentoNaoEncontrado extends Error {}
class DocumentoJaCancelado extends Error {}

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
    const numero = await db.transaction(async (tx) => {
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

      await tx
        .update(documentos)
        .set({ canceladoEm: new Date(), canceladoPor: usuario.id })
        .where(eq(documentos.id, documentoId));

      return documento.numero;
    });

    revalidatePath("/financeiro");
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

    revalidatePath("/financeiro");
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

    revalidatePath("/financeiro");
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

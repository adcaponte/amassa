"use server";

import { z } from "zod";
import { eq, inArray } from "drizzle-orm";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categorias, documentoLinhas, documentos, itensCatalogo, parcelas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { obterConfiguracaoFinanceira } from "./consultas";
import { repartirDesconto } from "./desconto";
import { TETO_CENTAVOS } from "./dinheiro";
import { dataDentroDoIntervaloPermitido, esquemaId, esquemaVenda } from "./esquemas";
import { formatarReais, hojeEmBrasilia } from "./formato";
import { FRASE_FALHA_AO_SALVAR } from "./textos";

// Mesma forma de `lib/abertura/acoes.ts`/`lib/cotacoes/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// SQLSTATE 23503 = foreign_key_violation — mesmo helper de `lib/abertura/acoes.ts`/
// `lib/queimas/acoes.ts`: quando a categoria escolhida foi removida entre a montagem do
// formulário e o envio, a chave estrangeira barra a escrita e este erro vira frase humana.
function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "23503";
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

  const totalDasParcelas = dados.parcelas.reduce((total, parcela) => total + parcela.valorCentavos, 0);
  if (totalDasParcelas !== totalCentavos) {
    const diferenca = totalCentavos - totalDasParcelas;
    const verbo = diferenca > 0 ? "Faltam" : "Sobram";
    return {
      ok: false,
      erro: `As parcelas somam ${formatarReais(totalDasParcelas)}. ${verbo} ${formatarReais(Math.abs(diferenca))} para fechar com o total.`,
    };
  }

  for (const parcela of dados.parcelas) {
    if (parcela.pago && parcela.vencimento > hoje) {
      return {
        ok: false,
        erro:
          "Uma parcela que vence depois de hoje não pode estar paga — desmarque e registre no Caixa quando o dinheiro entrar.",
      };
    }
  }

  const configuracao = await obterConfiguracaoFinanceira();
  if (configuracao.dataSaldoInicial) {
    for (const parcela of dados.parcelas) {
      if (parcela.pago && parcela.vencimento < configuracao.dataSaldoInicial) {
        return {
          ok: false,
          erro: "Essa parcela vence antes do saldo inicial do Financeiro — confira a data.",
        };
      }
    }
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

"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import type { Unidade } from "@/lib/cadastros/catalogo";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { esquemaRegistrarMovimentacao, type RegistrarMovimentacaoValidado } from "./esquemas";
import {
  encomendaEmAndamento,
  gravarAjuste,
  gravarMovimentacoes,
  itemTemFichaDePrecificacao,
  travarItens,
  type TransacaoDoBanco,
} from "./gravacao";
import { pedidoDeEntradaManual, pedidoDeSaidaManual, type PedidoDeMovimentacao } from "./pedidos";
import {
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_ENCOMENDA_FORA_DE_ANDAMENTO,
  FRASE_FALHA_AO_REGISTRAR,
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  LIMITE_DO_VINCULO,
  fraseMaterialDesativado,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type MovimentacaoRegistrada = {
  tipo: "entrada" | "saida" | "ajuste";
  nome: string;
  unidade: Unidade;
  // `false` só no ajuste cuja diferença, no servidor, deu zero: nada foi gravado (EST-08).
  gravou: boolean;
  // `true` = "Conferido. O saldo já estava correto." — o ajuste sem diferença (EST-08).
  conferido: boolean;
  // Com sinal, como gravado (0 quando nada foi gravado).
  quantidadeMilesimos: number;
  saldoAntesMilesimos: number;
  saldoDepoisMilesimos: number;
};

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

class MaterialNaoEncontrado extends Error {}
class MaterialDesativado extends Error {
  constructor(readonly nome: string) {
    super(`Material desativado: ${nome}`);
  }
}
class EncomendaForaDeAndamento extends Error {}
class CustoDaPecaProntaZerado extends Error {}

// O nome da encomenda, CONGELADO em `nota` (Pitfall 10): se ela for apagada, `encomenda_id` vira
// nulo (`on delete set null`) e o nome fica. O nome tem até 120 caracteres (check de `encomendas`),
// abaixo dos 160 da `nota` — o corte por pontos de código é só defesa.
function notaDaEncomenda(nome: string): string {
  return [...nome.normalize("NFC").trim()].slice(0, LIMITE_DO_VINCULO).join("");
}

type DadosDeEntradaOuSaida = Exclude<RegistrarMovimentacaoValidado, { tipo: "ajuste" }>;

// O pedido da entrada ou da saída, montado DENTRO da transação: a peça pronta e a encomenda são
// conferidas no banco, com a `tx`, nunca aceitas do cliente (T-06-23, T-06-24).
async function pedidoDaFolha(
  tx: TransacaoDoBanco,
  dados: DadosDeEntradaOuSaida,
): Promise<PedidoDeMovimentacao> {
  if (dados.tipo === "entrada") {
    // D-09/D-29: peça pronta = item com ficha de precificação ligada. Até a Produção existir, ela
    // entra à mão com custo — e custo zero é recusado (EST-21): o custo da ficha nunca é zero, e
    // uma peça pronta de graça derrubaria o custo médio das outras da prateleira. A entrada manual
    // comum continua aceitando R$ 0,00 (doação, amostra — decisão do plano 06-01).
    const pecaPronta = await itemTemFichaDePrecificacao(tx, dados.itemId);
    if (pecaPronta && dados.custoTexto === 0) {
      throw new CustoDaPecaProntaZerado();
    }
    return pedidoDeEntradaManual({
      itemId: dados.itemId,
      milesimos: dados.quantidadeTexto,
      custoCentavos: dados.custoTexto,
      pecaPronta,
    });
  }

  let encomendaId: string | null = null;
  let nota: string | null = dados.turmaTexto ?? dados.oQueAconteceuTexto;
  if (dados.encomendaId) {
    const encomenda = await encomendaEmAndamento(tx, dados.encomendaId);
    if (!encomenda) {
      throw new EncomendaForaDeAndamento();
    }
    encomendaId = encomenda.id;
    nota = notaDaEncomenda(encomenda.nome);
  }
  return pedidoDeSaidaManual({
    itemId: dados.itemId,
    milesimos: dados.quantidadeTexto,
    destino: dados.destino,
    nota,
    encomendaId,
  });
}

// Entrada, saída ou ajuste manual (planos 06-01 e 06-05). `exigirUsuario()` é a PRIMEIRA instrução
// do corpo (T-06-01, T-06-27 — cobrado por árvore sintática em `npm run verificar-acoes`). Do cliente
// chegam só o id do item, o tipo, os textos (quantidade, custo, contado, vínculos), o destino e o id
// da encomenda (T-06-03); a ÁREA sai do destino, o VALOR sai de `lib/estoque/custo.ts` sob a trava,
// a DIFERENÇA do ajuste sai do saldo lido sob a trava (`gravarAjuste`, T-06-22) e o motivo
// `peca_pronta` sai da ficha de precificação (T-06-23) — nunca do cliente.
//
// O Estoque NUNCA lança nada no Caixa (T-06-26): esta ação não cria documento, parcela nem linha
// do Financeiro. Compra de verdade se lança em Financeiro → Despesa → Compra de material, que já dá
// entrada aqui sozinha — senão o dinheiro some do Caixa ou o material entra em dobro.
export async function registrarMovimentacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<MovimentacaoRegistrada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaRegistrarMovimentacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let registrada: MovimentacaoRegistrada;
  try {
    registrada = await db.transaction(async (tx): Promise<MovimentacaoRegistrada> => {
      // Decide sob a trava: o item pode ter sido desativado (ou perdido o estoque próprio) entre
      // abrir a folha e tocar em "Registrar".
      const travados = await travarItens(tx, [dados.itemId]);
      const item = travados.get(dados.itemId);
      if (!item || !item.controlaEstoque || item.unidade === null) {
        throw new MaterialNaoEncontrado();
      }
      if (!item.ativo) {
        throw new MaterialDesativado(item.nome);
      }

      if (dados.tipo === "ajuste") {
        // EST-07/EST-08 contra o saldo do INSTANTE (D-18): a prévia da folha era só prévia.
        const ajuste = await gravarAjuste(
          tx,
          { itemId: dados.itemId, contadoMilesimos: dados.contadoTexto, nota: dados.motivoTexto },
          { registradoPor: usuario.id },
        );
        if (!ajuste.gravou) {
          return {
            tipo: "ajuste",
            nome: item.nome,
            unidade: item.unidade,
            gravou: false,
            conferido: true,
            quantidadeMilesimos: 0,
            saldoAntesMilesimos: ajuste.saldoMilesimos,
            saldoDepoisMilesimos: ajuste.saldoMilesimos,
          };
        }
        return {
          tipo: "ajuste",
          nome: item.nome,
          unidade: item.unidade,
          gravou: true,
          conferido: false,
          quantidadeMilesimos: ajuste.movimentacao.quantidadeMilesimos,
          saldoAntesMilesimos: ajuste.movimentacao.saldoAntesMilesimos,
          saldoDepoisMilesimos: ajuste.movimentacao.saldoDepoisMilesimos,
        };
      }

      const pedido = await pedidoDaFolha(tx, dados);
      const [gravada] = await gravarMovimentacoes(tx, [pedido], { registradoPor: usuario.id });

      return {
        tipo: dados.tipo,
        nome: item.nome,
        unidade: item.unidade,
        gravou: true,
        conferido: false,
        quantidadeMilesimos: gravada.quantidadeMilesimos,
        saldoAntesMilesimos: gravada.saldoAntesMilesimos,
        saldoDepoisMilesimos: gravada.saldoDepoisMilesimos,
      };
    });
  } catch (erro) {
    if (erro instanceof MaterialNaoEncontrado) {
      return { ok: false, erro: FRASE_MATERIAL_NAO_EXISTE_MAIS };
    }
    if (erro instanceof MaterialDesativado) {
      return { ok: false, erro: fraseMaterialDesativado(erro.nome) };
    }
    if (erro instanceof EncomendaForaDeAndamento) {
      return { ok: false, erro: FRASE_ENCOMENDA_FORA_DE_ANDAMENTO };
    }
    if (erro instanceof CustoDaPecaProntaZerado) {
      return { ok: false, erro: FRASE_CUSTO_OBRIGATORIO };
    }
    // T-06-08: o texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de
    // `erro.cause.code` por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao registrar movimentação de estoque (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_REGISTRAR };
  }

  // Fora do `try`: a gravação já está confirmada — uma falha aqui nunca vira "não deu para
  // registrar" de algo que já está no livro (mesma disciplina de `salvarAnotacoes`). O ajuste
  // conferido não gravou nada: não há o que revalidar.
  if (registrada.gravou) {
    revalidatePath(rotaDeGestao("/estoque"));
    revalidatePath(rotaDeGestao("/"));
  }
  return { ok: true, dados: registrada };
}

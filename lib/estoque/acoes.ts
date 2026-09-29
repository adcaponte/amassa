"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import type { Unidade } from "@/lib/cadastros/catalogo";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { esquemaRegistrarMovimentacao } from "./esquemas";
import { gravarMovimentacoes, travarItens } from "./gravacao";
import { pedidoDeEntradaManual, pedidoDeSaidaManual } from "./pedidos";
import {
  FRASE_FALHA_AO_REGISTRAR,
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  fraseMaterialDesativado,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type MovimentacaoRegistrada = {
  tipo: "entrada" | "saida";
  nome: string;
  unidade: Unidade;
  // Com sinal, como gravado.
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

// Entrada ou saída manual (plano 06-01, o traçador). `exigirUsuario()` é a PRIMEIRA instrução do
// corpo (T-06-01, cobrado por árvore sintática em `npm run verificar-acoes`). Do cliente chegam só o
// id do item, o tipo, os textos de quantidade e de custo e o destino (T-06-03); a ÁREA sai do
// destino (`pedidoDeSaidaManual`) e o VALOR sai de `lib/estoque/custo.ts`, sob a trava, dentro de
// `gravarMovimentacoes` — nunca do cliente.
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
    registrada = await db.transaction(async (tx) => {
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

      const pedido =
        dados.tipo === "entrada"
          ? pedidoDeEntradaManual({
              itemId: dados.itemId,
              milesimos: dados.quantidadeTexto,
              custoCentavos: dados.custoTexto,
            })
          : pedidoDeSaidaManual({
              itemId: dados.itemId,
              milesimos: dados.quantidadeTexto,
              destino: dados.destino,
            });

      const [gravada] = await gravarMovimentacoes(tx, [pedido], { registradoPor: usuario.id });

      return {
        tipo: dados.tipo,
        nome: item.nome,
        unidade: item.unidade,
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
    // T-06-08: o texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de
    // `erro.cause.code` por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao registrar movimentação de estoque (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_REGISTRAR };
  }

  // Fora do `try`: a gravação já está confirmada — uma falha aqui nunca vira "não deu para
  // registrar" de algo que já está no livro (mesma disciplina de `salvarAnotacoes`).
  revalidatePath(rotaDeGestao("/estoque"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: registrada };
}

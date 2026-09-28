"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { anotacoesDaCasa, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";

import { esquemaSalvarAnotacoes } from "./esquemas";
import { decidirGravacao } from "./folha";
import { FRASE_ERRO_AO_SALVAR } from "./textos";

// O tipo da transação do Drizzle, derivado do próprio `db` — mesma técnica de
// `lib/orcamentos/numero.ts::TransacaoDoBanco` (nunca importado de `drizzle-orm/node-postgres`,
// que exigiria conhecer o tipo genérico exato usado por `db/index.ts`).
type TransacaoDoBanco = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ResultadoDeSalvarAnotacoes =
  | { ok: true; atualizadoEm: string; salvoPorNome: string | null }
  | {
      ok: false;
      motivo: "mudou-no-servidor";
      textoDoServidor: string;
      salvoPorNome: string | null;
      atualizadoEm: string;
    }
  | { ok: false; motivo: "erro"; erro: string };

// `salvo_por` é anulável — sem `leftJoin` dentro da transação (o `select ... for update` abaixo
// só trava `anotacoes_da_casa`; um `leftJoin` com `usuarios` sob `for update` exigiria nomear a
// tabela travada explicitamente, e não ganha nada aqui: o nome só é usado nesta função, nunca
// devolvido em lista). Uma segunda consulta, pequena e por chave primária.
async function nomeDoUsuario(tx: TransacaoDoBanco, id: string | null): Promise<string | null> {
  if (id === null) {
    return null;
  }
  const [linha] = await tx.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, id));
  return linha?.nome ?? null;
}

// Salva a folha ou avisa — nunca as duas coisas ao mesmo tempo (D-08/GES-10). `exigirUsuario()`
// é a PRIMEIRA instrução do corpo (verificado por `npm run verificar-acoes`). O "manter o meu" do
// editor NÃO é uma segunda ação: é esta mesma função chamada de novo com o `vistoEm` que o
// servidor acabou de devolver no aviso — uma porta, não duas.
export async function salvarAnotacoes(entradaBruta: unknown): Promise<ResultadoDeSalvarAnotacoes> {
  const usuario = await exigirUsuario();

  const resultado = esquemaSalvarAnotacoes.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      motivo: "erro",
      erro: resultado.error.issues[0]?.message ?? "Não deu para validar o texto enviado.",
    };
  }
  const { texto, vistoEm } = resultado.data;

  try {
    return await db.transaction(async (tx) => {
      // Trava a linha única ANTES de decidir — nenhuma escrita concorrente decide por fora
      // (for update). É esta trava, e a comparação DEPOIS dela, que fecha a janela de corrida
      // que D-08 pede: sem ela, duas transações concorrentes poderiam ler o mesmo
      // `atualizado_em` "velho" e concluir as duas que podem gravar.
      const [linhaTravada] = await tx
        .select({
          texto: anotacoesDaCasa.texto,
          salvoPor: anotacoesDaCasa.salvoPor,
          atualizadoEm: anotacoesDaCasa.atualizadoEm,
        })
        .from(anotacoesDaCasa)
        .where(eq(anotacoesDaCasa.linhaUnica, true))
        .for("update"); // trava a linha única da folha — nenhuma gravação concorrente decide por fora (for update)

      if (!linhaTravada) {
        throw new Error(
          "A folha de anotações da casa não existe — confira se a migração 0022 foi aplicada.",
        );
      }

      const atualizadoEmNoServidor = linhaTravada.atualizadoEm.toISOString();
      const decisao = decidirGravacao({ vistoEm, atualizadoEmNoServidor });

      if (decisao === "avisar") {
        const salvoPorNome = await nomeDoUsuario(tx, linhaTravada.salvoPor);
        return {
          ok: false,
          motivo: "mudou-no-servidor",
          textoDoServidor: linhaTravada.texto,
          salvoPorNome,
          atualizadoEm: atualizadoEmNoServidor,
        };
      }

      // Grava: `atualizado_em` fica para o gatilho `tocar_atualizado_em_anotacoes_da_casa`
      // (migração 0022) — nunca gravado à mão aqui (o comentário de `db/schema.ts` explica por
      // quê: gravá-lo à mão faria a detecção de escrita velha comparar um valor que a própria
      // aplicação controla). A marca nova é RELIDA na mesma transação via `returning`.
      const [linhaGravada] = await tx
        .update(anotacoesDaCasa)
        .set({ texto, salvoPor: usuario.id })
        .where(eq(anotacoesDaCasa.linhaUnica, true))
        .returning({ atualizadoEm: anotacoesDaCasa.atualizadoEm });

      return {
        ok: true,
        atualizadoEm: linhaGravada.atualizadoEm.toISOString(),
        salvoPorNome: usuario.nome,
      };
    });
  } catch (erro) {
    // T-04.6-39: o texto de exceção do Postgres nunca chega à tela — só esta frase. O código
    // (`erro.cause.code`, nunca `erro.code` — o driver embrulha o SQLSTATE real) fica só no log
    // do servidor, para quem for investigar depois.
    console.error(
      `Falha ao salvar anotações da casa (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, motivo: "erro", erro: FRASE_ERRO_AO_SALVAR };
  }
}

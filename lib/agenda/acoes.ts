"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { eventos, inscricoes } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { lerDiaParaLancar, type DiaParaLancar } from "./consultas";
import {
  esquemaConferirDia,
  esquemaDefinirPresenca,
  esquemaFecharDia,
  esquemaLancarAvulsa,
} from "./esquemas";
import { RecusaDaAgenda, travarInscricao } from "./gravacao";
import { planejarPresenca, type PresencaPlanejada } from "./presenca";
import {
  FRASE_DATA_CANCELADA,
  FRASE_ESCOLHA_A_DATA,
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_PRESENCA_GENERICA,
  FRASE_LANCAMENTO_NAO_EXISTE,
} from "./textos";

// Mesma forma de `lib/producao/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// O lançamento devolve o erro de CADA campo (embaixo do campo, foco no primeiro) — a folha mostra
// a frase onde ela pertence; `erro` é a primeira, para quem só quer uma.
export type ResultadoDoLancamento<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campos?: Record<string, string> };

function errosPorCampo(problemas: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of problemas) {
    const campo = String(problema.path[0] ?? "");
    if (campo !== "" && !(campo in campos)) {
      campos[campo] = problema.message;
    }
  }
  return campos;
}

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// As telas que mostram a Agenda. NÃO exportado (uma exportação deste arquivo vira endpoint): os
// planos seguintes o ampliam — o Início (`rotaDeGestao("/")`) e o site (`"/"`) quando o que é
// público muda.
function revalidarTelasDaAgenda({ publico }: { publico: boolean }): void {
  revalidatePath(rotaDeGestao("/agenda"));
  if (publico) {
    revalidatePath(rotaDeGestao("/"));
    revalidatePath("/");
  }
}

// "Veio" / "Faltou" / desmarcar (AGE-08, o Valor central). `exigirUsuario()` é a PRIMEIRA
// instrução (T-05-01, cobrado por `npm run verificar-acoes`). Do cliente chegam só o id da
// inscrição e o estado DESEJADO (Pattern 2) — nunca "inverter": toque duplo e dois celulares
// convergem, e o último a gravar vence (AGE-08 · concurrency). Sob a trava `for no key update` da
// inscrição, o servidor recusa data cancelada (T-05-03), decide com o módulo puro e grava a
// presença e o direito a repor NA MESMA instrução (sair de "faltou" limpa o direito).
export async function definirPresenca(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<PresencaPlanejada>> {
  // Nenhuma coluna de "quem marcou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaDefinirPresenca.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let gravada: PresencaPlanejada;
  try {
    gravada = await db.transaction(async (tx): Promise<PresencaPlanejada> => {
      const inscricao = await travarInscricao(tx, dados.inscricaoId);
      if (!inscricao) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (inscricao.eventoCancelado) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      const plano = planejarPresenca(inscricao, dados.presenca);
      await tx
        .update(inscricoes)
        .set({ presenca: plano.presenca, direitoARepor: plano.direitoARepor })
        .where(eq(inscricoes.id, inscricao.id));
      return plano;
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      return { ok: false, erro: erro.frase };
    }
    // T-05-07: o texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de
    // `erro.cause.code` por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao marcar presença (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_PRESENCA_GENERICA };
  }

  // Fora do `try`: a gravação já está confirmada — uma falha aqui nunca vira "não deu para marcar"
  // de algo que já está no banco.
  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: gravada };
}

export type Lancado = { id: string; data: string };

// "Lançar aula" — uma aula ou oficina avulsa (AGE-01, AGE-12). `exigirUsuario()` primeiro
// (T-05-13), Zod no servidor (T-05-14: preço em centavos inteiros pela conversão única), um
// `insert`. NUNCA recusa por dia fechado (D-13: avisa e não bloqueia) nem por haver outro evento no
// mesmo horário (briefing §2.8 — sem aviso de sobreposição entre lançamentos): dois gestores
// lançando ao mesmo tempo criam dois lançamentos independentes.
export async function lancarAvulsa(entradaBruta: unknown): Promise<ResultadoDoLancamento<Lancado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaLancarAvulsa.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let lancado: Lancado;
  try {
    const [linha] = await db
      .insert(eventos)
      .values({
        tipo: "avulsa",
        data: dados.data,
        inicio: dados.inicio,
        fim: dados.fim,
        titulo: dados.titulo,
        vagas: dados.vagas,
        precoCentavos: dados.precoCentavos,
        publico: dados.publico,
        criadoPor: usuario.id,
      })
      .returning({ id: eventos.id, data: eventos.data });
    lancado = linha;
  } catch (erro) {
    console.error(
      `Falha ao lançar a aula (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
  }

  revalidarTelasDaAgenda({ publico: dados.publico });
  return { ok: true, dados: lancado };
}

// "Fechar o dia" — um evento `fechado` com o motivo no título, nunca público (o site mostra só
// "fechado", sem o motivo — T-05-17). Fechar NÃO toca em nada do que já está no dia: nenhuma data
// é cancelada, nenhuma presença ou crédito muda (D-13 — as datas de turma ganham a etiqueta "dia
// fechado" e o gestor cancela com um toque). Revalida o site: o dia passa a aparecer fechado lá.
export async function fecharDia(entradaBruta: unknown): Promise<ResultadoDoLancamento<Lancado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaFecharDia.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let lancado: Lancado;
  try {
    const [linha] = await db
      .insert(eventos)
      .values({
        tipo: "fechado",
        data: dados.data,
        titulo: dados.motivo,
        publico: false,
        criadoPor: usuario.id,
      })
      .returning({ id: eventos.id, data: eventos.data });
    lancado = linha;
  } catch (erro) {
    console.error(
      `Falha ao fechar o dia (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
  }

  revalidarTelasDaAgenda({ publico: true });
  return { ok: true, dados: lancado };
}

// A leitura do aviso D-13 da folha "Lançar na agenda", quando a data muda: só o motivo do fechado
// e quantos lançamentos o dia já tem — nada de quem, nada de horário (o mínimo para avisar).
export async function conferirDiaParaLancar(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<DiaParaLancar>> {
  await exigirUsuario();

  const resultado = esquemaConferirDia.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_ESCOLHA_A_DATA };
  }
  try {
    return { ok: true, dados: await lerDiaParaLancar(resultado.data.data) };
  } catch (erro) {
    console.error("Falha ao conferir o dia para lançar:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
  }
}

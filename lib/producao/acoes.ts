"use server";

import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { ordemEtapas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import type { EtapaProducao } from "./etapas";
import { esquemaTerminarEtapa } from "./esquemas";
import { lerEtapasDaOrdem, RecusaDaProducao, travarOrdem } from "./gravacao";
import { planejarTerminar } from "./transicoes";
import {
  FRASE_FALHA_AO_MARCAR,
  FRASE_JA_MARCADA,
  FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_ULTIMA_ETAPA,
} from "./textos";

// Mesma forma de `lib/estoque/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type EtapaTerminada = { etapa: EtapaProducao; proxima: EtapaProducao };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

const FRASE_DA_RECUSA = {
  "ja-marcada": FRASE_JA_MARCADA,
  "nao-ativa": FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  "ultima-etapa": FRASE_ULTIMA_ETAPA,
} as const;

// "Terminei: {etapa}" (PRD-03). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-01, cobrado por
// `npm run verificar-acoes`). Do cliente chegam só o id da ordem e a etapa que o botão mostrava
// (T-06.1-03): sob a trava da ordem (`for no key update`, Pitfall 5) o servidor lê as etapas,
// decide com o módulo puro contra a etapa ESPERADA e grava `feita_em` = o "hoje" de Brasília,
// decidido AQUI — a data, a etapa atual e a próxima nunca vêm do cliente. Toque duplo e dois
// celulares: o segundo encontra a etapa já mudada e recebe "já tinha sido marcada" sem gravar
// nada (Pitfall 7).
export async function terminarEtapa(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<EtapaTerminada>> {
  // Nenhuma coluna de "quem marcou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaTerminarEtapa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let terminada: EtapaTerminada;
  try {
    terminada = await db.transaction(async (tx): Promise<EtapaTerminada> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const etapas = await lerEtapasDaOrdem(tx, dados.ordemId);
      const plano = planejarTerminar({ ...ordem, etapas }, dados.etapaEsperada, hoje);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(FRASE_DA_RECUSA[plano.motivo]);
      }
      await tx
        .update(ordemEtapas)
        .set({ feitaEm: plano.feitaEm, passaram: null })
        .where(and(eq(ordemEtapas.ordemId, dados.ordemId), eq(ordemEtapas.etapa, plano.etapa)));
      return { etapa: plano.etapa, proxima: plano.proxima };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    // T-06.1-07: o texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de
    // `erro.cause.code` por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao marcar etapa da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR };
  }

  // Fora do `try`: a gravação já está confirmada — uma falha aqui nunca vira "não deu para marcar"
  // de algo que já está no banco.
  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao(`/producao/${dados.ordemId}`));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: terminada };
}

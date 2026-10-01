"use server";

import { revalidatePath } from "next/cache";

import { and, eq, gt, isNotNull, isNull, max, or } from "drizzle-orm";

import { db } from "@/db";
import { clientes, eventos, inscricoes, mensalidades, turmaAlunos, turmas, usosLivres } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { FRASE_CLIENTE_NAO_EXISTE } from "@/lib/clientes/textos";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import {
  creditosDoCliente,
  datasDaTurmaNoMes,
  fechadosEntre,
  lerDiaParaLancar,
  pessoasParaData,
  type DiaParaLancar,
  type PessoasParaData,
} from "./consultas";
import {
  esquemaBuscarPessoas,
  esquemaCancelarData,
  esquemaCancelarReserva,
  esquemaColocarNaData,
  esquemaConferirDia,
  esquemaCorrigirChegada,
  esquemaDefinirDireitoARepor,
  esquemaDefinirPresenca,
  esquemaDesativarTurma,
  esquemaEditarTurma,
  esquemaEntrarNaTurma,
  esquemaFecharDia,
  esquemaLancarAvulsa,
  esquemaLancarTurma,
  esquemaMarcarChegada,
  esquemaMarcarMaisSemanas,
  esquemaReservarUsoLivre,
  esquemaSairDaTurma,
  esquemaTirarBloqueio,
  esquemaTirarDaLista,
  type ModoDeColocar,
} from "./esquemas";
import {
  contarPerdasAoCancelar,
  eventoDaInscricao,
  garantirMensalidadesDoMes,
  inscreverAlunoDaquiParaFrente,
  inscreverAlunosNasDatas,
  marcarDatasDaTurma,
  RecusaDaAgenda,
  temPerdas,
  tirarAlunoDasDatasFuturas,
  tirarDatasFuturasDaTurma,
  travarCliente,
  travarEvento,
  travarEventoParaLeitura,
  travarInscricao,
  travarInscricaoComVenda,
  travarTurma,
  vendaAtivaEmDataFutura,
  type PerdasAoCancelar,
} from "./gravacao";
import { mesDaData, valorProporcional, vencimentoDaMensalidade } from "./mensalidade";
import { planejarPresenca, type PresencaPlanejada } from "./presenca";
import type { EstadoUsoLivre, TipoInscricao } from "./tipos";
import { aPartirDeParaEstender, datasDaTurma, datasEmDiaFechado, type FechadoDoDia } from "./turma";
import {
  FRASE_DATA_CANCELADA,
  FRASE_DIREITO_SO_COM_FALTA,
  FRASE_EXPERIMENTAL_SO_EM_TURMA,
  fraseJaEAlunoDaTurma,
  FRASE_FALHA_AO_MARCAR_DIREITO,
  FRASE_REPOSICAO_SO_EM_AULA,
  fraseSemAulaARepor,
  FRASE_ERRO_CARREGAR_PESSOAS,
  FRASE_ESCOLHA_A_DATA,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_COLOCAR,
  FRASE_FALHA_AO_DESATIVAR_TURMA,
  FRASE_FALHA_AO_ENTRAR_NA_TURMA,
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_AO_MARCAR_SEMANAS,
  FRASE_FALHA_AO_SAIR_DA_TURMA,
  FRASE_FALHA_AO_SALVAR_TURMA,
  FRASE_FALHA_AO_TIRAR_BLOQUEIO,
  FRASE_FALHA_AO_TIRAR_DA_LISTA,
  FRASE_FECHADO_NAO_SE_CANCELA,
  FRASE_JA_REMOVIDO,
  FRASE_FALHA_PRESENCA_GENERICA,
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_TURMA_JA_DESATIVADA,
  fraseDesativarComVendaAtiva,
  fraseInscricaoJaVirouVenda,
  fraseJaEstaNaLista,
  fraseJaEstaNaTurma,
  fraseJaNaoEstaNaTurma,
  FRASE_FALHA_AO_CANCELAR_RESERVA,
  FRASE_FALHA_AO_CORRIGIR_CHEGADA,
  FRASE_FALHA_AO_MARCAR_CHEGADA,
  FRASE_PESSOA_NAO_EXISTE,
  FRASE_RESERVA_JA_COMECOU,
  FRASE_USO_AINDA_NAO_COMECOU,
  FRASE_USO_COM_MATERIAL_BAIXADO,
  FRASE_USO_JA_ENCERRADO,
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
// convergem, e o último a gravar vence (AGE-08 · concurrency). Trava o EVENTO com `for share` ANTES
// da inscrição (plano 08 — a mesma linha que `cancelarData` trava com `for no key update`): cancelar e
// marcar ao mesmo tempo terminam coerentes (AGE-04, T-05-39). Sob a trava `for no key update` da
// inscrição, o servidor recusa data cancelada (T-05-03), decide com o módulo puro e grava a presença e o
// direito a repor NA MESMA instrução (sair de "faltou" limpa o direito).
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
      const eventoId = await eventoDaInscricao(tx, dados.inscricaoId);
      const evento = eventoId === null ? null : await travarEventoParaLeitura(tx, eventoId);
      const inscricao = evento === null ? null : await travarInscricao(tx, dados.inscricaoId);
      if (!evento || !inscricao) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (evento.cancelado) {
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

// "tem direito a repor esta aula" (AGE-09). `exigirUsuario()` primeiro (T-05-36). O cliente manda o
// estado DESEJADO (Pattern 2): marcar duas vezes vale um crédito, desmarcar o tira. Na ordem global
// EVENTO (`for share`, como a presença) → INSCRIÇÃO (`for no key update`):
// - só numa data de TURMA não cancelada (falta em oficina avulsa não gera reposição — BRIEFING §4; data
//   cancelada pelo ateliê nunca conta falta — AGE-04);
// - só para inscrição de `aluno` ou `experimental` com `presenca = 'faltou'` (o check
//   `inscricoes_direito_so_com_falta` recusaria o resto) — senão a frase humana.
// O crédito NÃO é gravado em lugar nenhum: é derivado das linhas (Pattern 3).
export async function definirDireitoARepor(entradaBruta: unknown): Promise<ResultadoDeAcao<{ direito: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaDefinirDireitoARepor.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let gravado: { direito: boolean };
  try {
    gravado = await db.transaction(async (tx) => {
      const eventoId = await eventoDaInscricao(tx, dados.inscricaoId);
      const evento = eventoId === null ? null : await travarEventoParaLeitura(tx, eventoId);
      const inscricao = evento === null ? null : await travarInscricao(tx, dados.inscricaoId);
      if (!evento || !inscricao) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (evento.cancelado) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      // Desmarcar o que não está marcado converge sem conferir mais nada (idempotente).
      if (!dados.direito && !inscricao.direitoARepor) {
        return { direito: false };
      }
      if (
        evento.tipo !== "turma" ||
        (inscricao.tipo !== "aluno" && inscricao.tipo !== "experimental") ||
        inscricao.presenca !== "faltou"
      ) {
        throw new RecusaDaAgenda(FRASE_DIREITO_SO_COM_FALTA);
      }
      await tx.update(inscricoes).set({ direitoARepor: dados.direito }).where(eq(inscricoes.id, inscricao.id));
      return { direito: dados.direito };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao marcar o direito a repor (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR_DIREITO };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: gravado };
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

export type TurmaLancada = {
  turmaId: string;
  // Quantas datas foram marcadas e a primeira delas (a semana para onde a tela vai).
  datas: number;
  primeira: string;
  // As datas marcadas que caem num dia fechado (D-13), para o toast — marcadas mesmo assim.
  emDiaFechado: FechadoDoDia[];
};

// "Lançar turma" (AGE-03, D-03). `exigirUsuario()` primeiro (T-05-28), Zod no servidor (T-05-29:
// semanas 1..52, vencimento 1..28, vagas 1..999). NUMA transação: a turma e as N datas
// (`datasDaTurma` — a primeira ocorrência do dia da semana a partir de "Primeira aula a partir de",
// uma por semana), com horário, vagas e `publico` copiados da turma e `on conflict (turma_id, data)
// do nothing`. NÃO pula nem cancela dia fechado (D-13): lê os fechados do intervalo e devolve as
// datas que caem neles, para o toast avisar. Sem aluno nenhum: os alunos entram pela ficha (plano
// 07) e nenhuma mensalidade nasce aqui.
export async function lancarTurma(entradaBruta: unknown): Promise<ResultadoDoLancamento<TurmaLancada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaLancarTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const datas = datasDaTurma({ diaDaSemana: dados.diaSemana, aPartirDe: dados.aPartirDe, semanas: dados.semanas });

  let lancada: Omit<TurmaLancada, "emDiaFechado">;
  try {
    lancada = await db.transaction(async (tx) => {
      const [turma] = await tx
        .insert(turmas)
        .values({
          nome: dados.nome,
          diaSemana: dados.diaSemana,
          inicio: dados.inicio,
          fim: dados.fim,
          vagas: dados.vagas,
          mensalidadeCentavos: dados.mensalidadeCentavos,
          diaVencimento: dados.diaVencimento,
          publica: dados.publica,
          criadoPor: usuario.id,
        })
        .returning({ id: turmas.id });
      const criadas = await marcarDatasDaTurma(
        tx,
        { id: turma.id, inicio: dados.inicio, fim: dados.fim, vagas: dados.vagas, publica: dados.publica },
        datas,
        usuario.id,
      );
      return { turmaId: turma.id, datas: criadas.length, primeira: datas[0] };
    });
  } catch (erro) {
    console.error(
      `Falha ao lançar a turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
  }

  revalidarTelasDaAgenda({ publico: dados.publica });

  // Fora da transação e do `try` dela: a turma já está gravada — uma falha ao ler os fechados só
  // tira o aviso do toast (a tag "dia fechado" aparece no cartão de qualquer jeito).
  let emDiaFechado: FechadoDoDia[] = [];
  try {
    emDiaFechado = datasEmDiaFechado(datas, await fechadosEntre(datas[0], datas[datas.length - 1]));
  } catch (erro) {
    console.error("Falha ao ler os dias fechados depois de lançar a turma:", erro);
  }
  return { ok: true, dados: { ...lancada, emDiaFechado } };
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
    return { ok: true, dados: await lerDiaParaLancar(resultado.data.data, resultado.data.ate) };
  } catch (erro) {
    console.error("Falha ao conferir o dia para lançar:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
  }
}

export type ResultadoCancelarData =
  // Gravado (ou já estava assim — idempotente): o estado em que a data ficou.
  | { situacao: "gravado"; cancelada: boolean; presencasLimpas: number }
  // Nada gravado: cancelar perderia algo e a pessoa ainda não viu o quê (UI-D13).
  | { situacao: "confirmar"; perdas: PerdasAoCancelar };

// "Cancelar esta data" / "Desfazer cancelamento" (AGE-04, AGE-05 — cancelar nunca apaga). O cliente
// manda o estado DESEJADO (Pattern 2): cancelar o que já está cancelado, ou desfazer o que já foi
// desfeito, devolve sucesso sem gravar — dois celulares e o toque duplo convergem. Sob a trava do
// EVENTO (`for no key update`, a mesma linha que `definirPresenca` lê com a inscrição):
// - fechado → recusa (o fechado se tira, não se cancela);
// - cancelar sem `confirmado` e com algo a perder → devolve as perdas e NÃO grava (a tela confirma);
// - cancelar → `cancelado_em`/`cancelado_por` e, NA MESMA transação, limpa presença e direito a
//   repor de todas as inscrições da data (cancelada pelo ateliê não conta falta para ninguém);
// - desfazer → limpa os dois carimbos; as presenças NÃO voltam.
// Venda e movimentação já geradas nunca são tocadas (AGE-20).
export async function cancelarData(entradaBruta: unknown): Promise<ResultadoDeAcao<ResultadoCancelarData>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCancelarData.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let publico = false;
  let gravado: ResultadoCancelarData;
  try {
    gravado = await db.transaction(async (tx): Promise<ResultadoCancelarData> => {
      const evento = await travarEvento(tx, dados.eventoId);
      if (!evento) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (evento.tipo === "fechado") {
        throw new RecusaDaAgenda(FRASE_FECHADO_NAO_SE_CANCELA);
      }
      publico = evento.publico;
      if (evento.cancelado === dados.cancelada) {
        return { situacao: "gravado", cancelada: evento.cancelado, presencasLimpas: 0 };
      }

      if (!dados.cancelada) {
        await tx
          .update(eventos)
          .set({ canceladoEm: null, canceladoPor: null })
          .where(eq(eventos.id, evento.id));
        return { situacao: "gravado", cancelada: false, presencasLimpas: 0 };
      }

      if (dados.confirmado !== true) {
        const perdas = await contarPerdasAoCancelar(tx, evento.id);
        if (temPerdas(perdas)) {
          return { situacao: "confirmar", perdas };
        }
      }
      await tx
        .update(eventos)
        .set({ canceladoEm: new Date(), canceladoPor: usuario.id })
        .where(eq(eventos.id, evento.id));
      const limpas = await tx
        .update(inscricoes)
        .set({ presenca: null, direitoARepor: false })
        .where(
          and(
            eq(inscricoes.eventoId, evento.id),
            or(isNotNull(inscricoes.presenca), eq(inscricoes.direitoARepor, true)),
          ),
        )
        .returning({ id: inscricoes.id });
      return { situacao: "gravado", cancelada: true, presencasLimpas: limpas.length };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao cancelar a data (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CANCELAR };
  }

  if (gravado.situacao === "gravado") {
    // A data pública sai (ou volta) do site.
    revalidarTelasDaAgenda({ publico });
  }
  return { ok: true, dados: gravado };
}

// "Tirar o bloqueio" (AGE-05): o fechado é o ÚNICO evento que se apaga — e o tipo é conferido NA
// PRÓPRIA instrução de `delete` (T-05-15): um id de data de turma ou de avulsa não apaga nada.
// Nenhuma linha afetada (tirado em outro celular, ou id que não é de fechado) → a frase humana,
// nunca erro técnico. Revalida o site: o dia volta a aparecer aberto lá.
export async function tirarBloqueio(entradaBruta: unknown): Promise<ResultadoDeAcao<{ data: string }>> {
  await exigirUsuario();

  const resultado = esquemaTirarBloqueio.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_JA_REMOVIDO };
  }

  let removido: { data: string } | undefined;
  try {
    [removido] = await db
      .delete(eventos)
      .where(and(eq(eventos.id, resultado.data.eventoId), eq(eventos.tipo, "fechado")))
      .returning({ data: eventos.data });
  } catch (erro) {
    console.error(
      `Falha ao tirar o bloqueio (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_TIRAR_BLOQUEIO };
  }
  if (!removido) {
    return { ok: false, erro: FRASE_JA_REMOVIDO };
  }

  revalidarTelasDaAgenda({ publico: true });
  return { ok: true, dados: removido };
}

// A busca do seletor de pessoa (UI-D5) — ação de LEITURA, chamada pelo navegador a cada busca (espera
// de 300 ms). `exigirUsuario()` primeiro (T-05-23: nome e telefone só para quem entrou — T-05-27),
// Zod no servidor (a busca até 160, o id da data em uuid), e os grupos prontos: quem já está na data
// nunca aparece (AGE-10 · adjacency). Nunca grava nada.
export async function buscarPessoasParaData(entradaBruta: unknown): Promise<ResultadoDeAcao<PessoasParaData>> {
  await exigirUsuario();

  const resultado = esquemaBuscarPessoas.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_ERRO_CARREGAR_PESSOAS };
  }
  try {
    return { ok: true, dados: await pessoasParaData(resultado.data) };
  } catch (erro) {
    console.error("Falha ao buscar pessoas para o seletor:", erro);
    return { ok: false, erro: FRASE_ERRO_CARREGAR_PESSOAS };
  }
}

// `cobradoCentavos`: o valor que foi para "A receber" (oficina, experimental cobrada) — o toast cita.
export type Colocado = { inscricaoId: string; nome: string; modo: ModoDeColocar; cobradoCentavos: number | null };

// "Colocar na lista" (AGE-10, AGE-12; plano 08: reposição). `exigirUsuario()` primeiro (T-05-23), Zod
// (os dois ids e o modo — nenhum valor da oficina vem da tela, T-05-24). Sob a trava do EVENTO (`for no
// key update`, a ordem global: EVENTO → CLIENTE → INSCRIÇÃO):
// - data que não existe mais ou cancelada → a frase, nada gravado;
// - a pessoa já está nesta data (toque duplo, outro celular) → "{nome} já está nesta lista";
// - `oficina` (só na avulsa): a inscrição `cobrar = true` com o PREÇO DO EVENTO NESTE MOMENTO copiado
//   para `valor_centavos` (mudar o evento depois não muda o que cada um deve);
// - `reposicao` (data de turma ou oficina — o protótipo oferece nas duas): trava o CLIENTE (`for no key
//   update`, nunca a exclusiva: as inscrições novas pedem `for key share` nele), recalcula o crédito SOB
//   A TRAVA (`creditosDoCliente` — Pitfall 7: dois celulares usando o último crédito em datas diferentes
//   se serializam aqui, e o segundo lê o saldo já gasto) e, com saldo zero, recusa; senão insere
//   `tipo = 'reposicao'` sem cobrar (o check `inscricoes_reposicao_nao_cobra` também recusa o contrário);
// - `experimental` (só em data de turma — D-07): recusa quem já é aluno ativo da turma; grava
//   `tipo = 'experimental'` com o `cobrar` decidido na hora e, cobrada, o valor digitado (centavos
//   inteiros, validado pelo Zod — T-05-40), que vai para "A receber" como uma inscrição (plano 11).
// `on conflict (evento_id, cliente_id) do nothing` (T-05-26) é a última garantia contra a inscrição dupla.
// NUNCA recusa por lista cheia (AGE-11, briefing §2.8): nenhuma conta de vagas aqui nem no banco.
export async function colocarNaData(entradaBruta: unknown): Promise<ResultadoDeAcao<Colocado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaColocarNaData.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let publico = false;
  let colocado: Colocado;
  try {
    colocado = await db.transaction(async (tx): Promise<Colocado> => {
      const evento = await travarEvento(tx, dados.eventoId);
      if (!evento) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      publico = evento.publico;
      if (evento.cancelado) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }

      if (dados.modo === "oficina") {
        if (evento.tipo !== "avulsa" || evento.precoCentavos === null) {
          throw new RecusaDaAgenda(FRASE_FALHA_AO_COLOCAR);
        }
      } else if (dados.modo === "experimental") {
        if (evento.tipo !== "turma" || evento.turmaId === null) {
          throw new RecusaDaAgenda(FRASE_EXPERIMENTAL_SO_EM_TURMA);
        }
      } else if (evento.tipo !== "turma" && evento.tipo !== "avulsa") {
        throw new RecusaDaAgenda(FRASE_REPOSICAO_SO_EM_AULA);
      }

      // A reposição trava a pessoa (Pitfall 7); a inscrição de oficina e a experimental só a leem.
      const cliente =
        dados.modo !== "reposicao"
          ? ((
              await tx.select({ id: clientes.id, nome: clientes.nome }).from(clientes).where(eq(clientes.id, dados.clienteId))
            )[0] ?? null)
          : await travarCliente(tx, dados.clienteId);
      if (!cliente) {
        throw new RecusaDaAgenda(FRASE_CLIENTE_NAO_EXISTE);
      }

      const [jaNaLista] = await tx
        .select({ id: inscricoes.id })
        .from(inscricoes)
        .where(and(eq(inscricoes.eventoId, evento.id), eq(inscricoes.clienteId, cliente.id)));
      if (jaNaLista) {
        throw new RecusaDaAgenda(fraseJaEstaNaLista(cliente.nome));
      }

      let valores: { tipo: "oficina" | "reposicao" | "experimental"; cobrar: boolean; valorCentavos: number | null };
      if (dados.modo === "reposicao") {
        const creditos = await creditosDoCliente(tx, cliente.id);
        if (creditos.saldo <= 0) {
          throw new RecusaDaAgenda(fraseSemAulaARepor(cliente.nome));
        }
        valores = { tipo: "reposicao", cobrar: false, valorCentavos: null };
      } else if (dados.modo === "experimental") {
        const [aluno] = await tx
          .select({ id: turmaAlunos.id })
          .from(turmaAlunos)
          .where(
            and(
              eq(turmaAlunos.turmaId, evento.turmaId ?? ""),
              eq(turmaAlunos.clienteId, cliente.id),
              isNull(turmaAlunos.saiuEm),
            ),
          );
        if (aluno) {
          throw new RecusaDaAgenda(fraseJaEAlunoDaTurma(cliente.nome));
        }
        valores =
          dados.cobrar === true && dados.valorCentavos !== null
            ? { tipo: "experimental", cobrar: true, valorCentavos: dados.valorCentavos }
            : { tipo: "experimental", cobrar: false, valorCentavos: null };
      } else {
        valores = { tipo: "oficina", cobrar: true, valorCentavos: evento.precoCentavos };
      }

      const [inserida] = await tx
        .insert(inscricoes)
        .values({ eventoId: evento.id, clienteId: cliente.id, ...valores, criadoPor: usuario.id })
        .onConflictDoNothing({ target: [inscricoes.eventoId, inscricoes.clienteId] })
        .returning({ id: inscricoes.id });
      if (!inserida) {
        throw new RecusaDaAgenda(fraseJaEstaNaLista(cliente.nome));
      }
      return { inscricaoId: inserida.id, nome: cliente.nome, modo: dados.modo, cobradoCentavos: valores.valorCentavos };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // A tela estava velha (já na lista, data cancelada, crédito usado em outro celular): ela se
      // atualiza junto com a frase.
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao colocar na lista (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_COLOCAR };
  }

  // As vagas que o site mostra mudaram, se a data é pública.
  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: colocado };
}

export type TiradoDaLista = { nome: string; tipo: TipoInscricao };

// "Tirar da lista" (05-UI-SPEC.md §Confirmações; D-08, UI-D14). `exigirUsuario()` primeiro (T-05-23).
// Sob a trava da INSCRIÇÃO, com a venda ligada lida na mesma instrução (T-05-25):
// - não existe mais → "Isso já tinha sido removido.";
// - data cancelada → a frase (a lista da data cancelada é só de leitura);
// - inscrição de aluno → a frase genérica (o aluno sai da turma pela ficha);
// - ligada a uma venda NÃO cancelada → recusa com a frase da D-08, verbatim: a Agenda nunca devolve
//   dinheiro nem desfaz venda — a devolução é no Caixa;
// - senão apaga a inscrição (a venda cancelada continua no Financeiro, AGE-20). Tirar uma REPOSIÇÃO
//   devolve a aula a repor sozinho: o crédito é derivado das linhas (Pattern 3). O `delete` só vem
//   depois de todas as conferências.
export async function tirarDaLista(entradaBruta: unknown): Promise<ResultadoDeAcao<TiradoDaLista>> {
  await exigirUsuario();

  const resultado = esquemaTirarDaLista.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_JA_REMOVIDO };
  }

  let publico = false;
  let tirado: TiradoDaLista;
  try {
    tirado = await db.transaction(async (tx): Promise<TiradoDaLista> => {
      const inscricao = await travarInscricaoComVenda(tx, resultado.data.inscricaoId);
      if (!inscricao) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
      publico = inscricao.publico;
      if (inscricao.eventoCancelado) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      if (inscricao.tipo === "aluno") {
        throw new RecusaDaAgenda(FRASE_FALHA_AO_TIRAR_DA_LISTA);
      }
      if (inscricao.venda !== null && !inscricao.venda.cancelada) {
        throw new RecusaDaAgenda(fraseInscricaoJaVirouVenda(inscricao.venda.numero));
      }
      await tx.delete(inscricoes).where(eq(inscricoes.id, inscricao.id));
      return { nome: inscricao.nome, tipo: inscricao.tipo };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao tirar da lista (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_TIRAR_DA_LISTA };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: tirado };
}

export type TurmaSalva = { mensalidadeMudou: boolean; datasAtualizadas: number };

// "Salvar turma" (D-03). `exigirUsuario()` primeiro (T-05-28), Zod no servidor. Sob a trava da
// TURMA: recusa a desativada; grava a turma e, nas datas com `data > hoje` e NÃO canceladas, o
// horário, as vagas e o público (hoje e o passado ficam como foram — Assumption A9). O nome não é
// copiado: as datas leem o nome da turma ao vivo. A mensalidade nova vale a partir do próximo mês,
// porque cada mensalidade copia o valor da turma ao nascer — e a guarda do Pitfall 6 (plano 07):
// ANTES de gravar o valor novo, na mesma transação, `garantirMensalidadesDoMes` faz nascer a do mês
// corrente desta turma com o valor ANTIGO, mesmo que ninguém tenha aberto a Agenda no mês.
export async function editarTurma(entradaBruta: unknown): Promise<ResultadoDoLancamento<TurmaSalva>> {
  await exigirUsuario();

  const resultado = esquemaEditarTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let publico = dados.publica;
  let salva: TurmaSalva;
  try {
    salva = await db.transaction(async (tx): Promise<TurmaSalva> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      // Sai do site quem deixou de ser pública: revalida se ela era OU passou a ser.
      publico = turma.publica || dados.publica;
      await garantirMensalidadesDoMes(tx, mesDaData(hoje), turma.id);
      await tx
        .update(turmas)
        .set({
          nome: dados.nome,
          inicio: dados.inicio,
          fim: dados.fim,
          vagas: dados.vagas,
          mensalidadeCentavos: dados.mensalidadeCentavos,
          diaVencimento: dados.diaVencimento,
          publica: dados.publica,
        })
        .where(eq(turmas.id, turma.id));
      const atualizadas = await tx
        .update(eventos)
        .set({ inicio: dados.inicio, fim: dados.fim, vagas: dados.vagas, publico: dados.publica })
        .where(and(eq(eventos.turmaId, turma.id), gt(eventos.data, hoje), isNull(eventos.canceladoEm)))
        .returning({ id: eventos.id });
      return {
        mensalidadeMudou: turma.mensalidadeCentavos !== dados.mensalidadeCentavos,
        datasAtualizadas: atualizadas.length,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao salvar a turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR_TURMA };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: salva };
}

export type SemanasMarcadas = { datas: number; ate: string | null; alunosInscritos: number };

// "Marcar mais N semanas" (D-03, AGE-03 · adjacency/idempotency/concurrency). `exigirUsuario()`
// primeiro, Zod (1..52). Sob a trava da TURMA (a mesma de "entrar na turma", plano 07): começa em
// `aPartirDeParaEstender(última data, hoje)` — o dia seguinte à última data marcada, ou hoje se ela
// já passou; a última nunca é marcada de novo —, grava com `on conflict (turma_id, data) do nothing`
// e, NA MESMA transação, inscreve os alunos ativos nas datas criadas (Pitfall 5). Dois gestores ao
// mesmo tempo: o segundo espera a trava, lê a última data nova e continua depois dela — nenhuma data
// se repete.
export async function marcarMaisSemanas(entradaBruta: unknown): Promise<ResultadoDoLancamento<SemanasMarcadas>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaMarcarMaisSemanas.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let publico = false;
  let marcadas: SemanasMarcadas;
  try {
    marcadas = await db.transaction(async (tx): Promise<SemanasMarcadas> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      publico = turma.publica;
      const [ultima] = await tx
        .select({ data: max(eventos.data) })
        .from(eventos)
        .where(eq(eventos.turmaId, turma.id));
      const datas = datasDaTurma({
        diaDaSemana: turma.diaSemana,
        aPartirDe: aPartirDeParaEstender(ultima?.data ?? null, hoje),
        semanas: dados.semanas,
      });
      const criadas = await marcarDatasDaTurma(tx, turma, datas, usuario.id);
      const alunosInscritos = await inscreverAlunosNasDatas(
        tx,
        turma.id,
        criadas.map((criada) => criada.id),
        usuario.id,
      );
      return {
        datas: criadas.length,
        ate: criadas.length > 0 ? criadas[criadas.length - 1].data : null,
        alunosInscritos,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao marcar mais semanas (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR_SEMANAS };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: marcadas };
}

export type TurmaDesativada = { datasTiradas: number };

// "Desativar turma" (D-03) — NUNCA apaga a turma (`revoke delete` em `turmas`), o que já aconteceu
// nem as mensalidades nascidas (T-05-31). `exigirUsuario()` primeiro. Sob a trava da TURMA:
// - não existe / já desativada → a frase;
// - alguma inscrição de data futura ligada a venda NÃO cancelada → recusa com a data e o número da
//   venda (D-08: a venda só se desfaz no Caixa);
// - tira as datas com `data > hoje` e as inscrições delas (Assumption A14 — não as cancela, para a
//   semana não encher de datas riscadas; as reposições voltam a ser crédito por derivação) e grava
//   `ativa = false`, `desativada_em`, `desativada_por`. Hoje e o passado ficam.
export async function desativarTurma(entradaBruta: unknown): Promise<ResultadoDeAcao<TurmaDesativada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDesativarTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const hoje = hojeEmBrasilia(new Date());

  let publico = false;
  let desativada: TurmaDesativada;
  try {
    desativada = await db.transaction(async (tx): Promise<TurmaDesativada> => {
      const turma = await travarTurma(tx, resultado.data.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      publico = turma.publica;
      const venda = await vendaAtivaEmDataFutura(tx, turma.id, hoje);
      if (venda !== null) {
        throw new RecusaDaAgenda(fraseDesativarComVendaAtiva(formatarDiaMes(venda.data), venda.numero));
      }
      const datasTiradas = await tirarDatasFuturasDaTurma(tx, turma.id, hoje);
      await tx
        .update(turmas)
        .set({ ativa: false, desativadaEm: new Date(), desativadaPor: usuario.id })
        .where(eq(turmas.id, turma.id));
      return { datasTiradas };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // A frase fica no diálogo; a folha se atualiza ao fechá-lo (molde de "Tirar da lista").
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao desativar a turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_DESATIVAR_TURMA };
  }

  // As datas futuras saem do site.
  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: desativada };
}

// O que "entrar na turma" decidiu sobre a mensalidade do mês da entrada (o toast diz qual):
// - `proporcional`: entrou no meio — {restantes} de {noMes} aulas, o valor já arredondado;
// - `cheia`: entrou antes da primeira aula do mês (ou no dia dela);
// - `nenhuma`: não sobra aula da turma no mês — a mensalidade começa no mês seguinte (D-02);
// - `ja-existia`: a mensalidade deste mês já tinha nascido (voltou no mesmo mês em que saiu) — a chave
//   única não deixa nascer a segunda, e a que existia continua como estava.
export type EntradaNaTurma = {
  nome: string;
  // "AAAA-MM" — o mês da entrada.
  mes: string;
  mensalidade:
    | { caso: "proporcional"; valorCentavos: number; restantes: number; noMes: number }
    | { caso: "cheia"; valorCentavos: number }
    | { caso: "nenhuma" }
    | { caso: "ja-existia" };
};

// Entrar na turma pela ficha (AGE-07). `exigirUsuario()` primeiro (T-05-32), Zod com só os dois ids
// (T-05-33). NUMA transação, na ordem global de travas TURMA → CLIENTE:
// - trava a TURMA (a mesma de "Marcar mais semanas" — Pitfall 5: entrar e estender ao mesmo tempo
//   terminam com a pessoa em todas as datas novas) e recusa turma inexistente ou desativada;
// - trava o CLIENTE (`for no key update`);
// - grava o vínculo com `entrou_em = hoje`; o índice parcial `turma_alunos_ativo_uk` não deixa nascer o
//   segundo vínculo ativo (dois toques, duas abas) — nada inserido → "{nome} já está nesta turma";
// - inscreve a pessoa como `aluno` nas datas de hoje em diante, não canceladas;
// - lê as datas NÃO canceladas da turma no mês e decide a mensalidade pelo módulo puro
//   (`valorProporcional` — inteiros, meio para cima); se houver, grava com
//   `on conflict (turma_id, cliente_id, mes) do nothing`, com o vencimento no dia da turma.
// O valor, as datas e o vencimento são todos lidos aqui, sob a trava — nada vem da tela.
export async function entrarNaTurma(entradaBruta: unknown): Promise<ResultadoDeAcao<EntradaNaTurma>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaEntrarNaTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());
  const mes = mesDaData(hoje);

  let publico = false;
  let entrada: EntradaNaTurma;
  try {
    entrada = await db.transaction(async (tx): Promise<EntradaNaTurma> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (!turma.ativa) {
        throw new RecusaDaAgenda(FRASE_TURMA_JA_DESATIVADA);
      }
      publico = turma.publica;
      const cliente = await travarCliente(tx, dados.clienteId);
      if (!cliente) {
        throw new RecusaDaAgenda(FRASE_CLIENTE_NAO_EXISTE);
      }

      const [vinculo] = await tx
        .insert(turmaAlunos)
        .values({ turmaId: turma.id, clienteId: cliente.id, entrouEm: hoje })
        .onConflictDoNothing()
        .returning({ id: turmaAlunos.id });
      if (!vinculo) {
        throw new RecusaDaAgenda(fraseJaEstaNaTurma(cliente.nome));
      }

      await inscreverAlunoDaquiParaFrente(tx, {
        turmaId: turma.id,
        clienteId: cliente.id,
        hoje,
        criadoPor: usuario.id,
      });

      const valor = valorProporcional({
        valorCentavos: turma.mensalidadeCentavos,
        datasDoMes: await datasDaTurmaNoMes(tx, turma.id, mes),
        entrouEm: hoje,
      });
      if (valor.tipo === "nenhuma") {
        return { nome: cliente.nome, mes, mensalidade: { caso: "nenhuma" } };
      }
      const [criada] = await tx
        .insert(mensalidades)
        .values({
          turmaId: turma.id,
          clienteId: cliente.id,
          mes: `${mes}-01`,
          valorCentavos: valor.valorCentavos,
          aulasRestantes: valor.tipo === "proporcional" ? valor.restantes : null,
          aulasNoMes: valor.tipo === "proporcional" ? valor.noMes : null,
          vencimento: vencimentoDaMensalidade(turma.diaVencimento, mes),
        })
        .onConflictDoNothing({ target: [mensalidades.turmaId, mensalidades.clienteId, mensalidades.mes] })
        .returning({ id: mensalidades.id });
      if (!criada) {
        return { nome: cliente.nome, mes, mensalidade: { caso: "ja-existia" } };
      }
      return {
        nome: cliente.nome,
        mes,
        mensalidade:
          valor.tipo === "proporcional"
            ? {
                caso: "proporcional",
                valorCentavos: valor.valorCentavos,
                restantes: valor.restantes,
                noMes: valor.noMes,
              }
            : { caso: "cheia", valorCentavos: valor.valorCentavos },
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // A tela estava velha (já na turma, turma desativada): ela se atualiza junto com a frase.
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao entrar na turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_ENTRAR_NA_TURMA };
  }

  // As vagas da turma no site mudam (D-12, plano 15).
  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: entrada };
}

export type SaidaDaTurma = { nome: string; aulasTiradas: number };

// Sair da turma pela ficha (AGE-07), depois da confirmação. `exigirUsuario()` primeiro. Sob as travas
// TURMA → CLIENTE: grava `saiu_em = hoje` no vínculo ativo (NUNCA apaga o vínculo — `revoke delete`)
// e tira a pessoa só das inscrições `aluno` sem presença nas datas depois de hoje
// (`tirarAlunoDasDatasFuturas`). O passado, a aula de hoje, as reposições marcadas e a mensalidade já
// nascida ficam. Vínculo ativo inexistente → "{nome} já não está nesta turma". Turma desativada não
// recusa: sair dela não tira nada que não devesse.
export async function sairDaTurma(entradaBruta: unknown): Promise<ResultadoDeAcao<SaidaDaTurma>> {
  await exigirUsuario();

  const resultado = esquemaSairDaTurma.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let publico = false;
  let saida: SaidaDaTurma;
  try {
    saida = await db.transaction(async (tx): Promise<SaidaDaTurma> => {
      const turma = await travarTurma(tx, dados.turmaId);
      if (!turma) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      publico = turma.publica;
      const cliente = await travarCliente(tx, dados.clienteId);
      if (!cliente) {
        throw new RecusaDaAgenda(FRASE_CLIENTE_NAO_EXISTE);
      }
      const saiu = await tx
        .update(turmaAlunos)
        .set({ saiuEm: hoje })
        .where(
          and(eq(turmaAlunos.turmaId, turma.id), eq(turmaAlunos.clienteId, cliente.id), isNull(turmaAlunos.saiuEm)),
        )
        .returning({ id: turmaAlunos.id });
      if (saiu.length === 0) {
        throw new RecusaDaAgenda(fraseJaNaoEstaNaTurma(cliente.nome));
      }
      const aulasTiradas = await tirarAlunoDasDatasFuturas(tx, { turmaId: turma.id, clienteId: cliente.id, hoje });
      return { nome: cliente.nome, aulasTiradas };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao sair da turma (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SAIR_DA_TURMA };
  }

  revalidarTelasDaAgenda({ publico });
  return { ok: true, dados: saida };
}

// ── O uso livre do espaço (plano 09 — AGE-13, AGE-05, AGE-01) ───────────────────────────────────────
// Toda transição é uma instrução CONDICIONADA AO ESTADO na própria escrita (`… where id = $1 and estado
// = 'reservado'`) ou decidida sob a trava `for no key update` do uso (`travarUsoLivre`): dois gestores
// nunca removem uma reserva que acabou de começar nem encerram duas vezes (T-05-43, T-05-44). O uso livre
// nunca vai ao site — só a rota da Agenda é revalidada.

export type UsoLivreReservado = { id: string; data: string };

// "Reservar uso livre" (AGE-01, AGE-13). `exigirUsuario()` primeiro (T-05-41), Zod no servidor (quem,
// data, "HH:MM", horas 1..12, pessoas 1..50 — nenhum preço vem da tela, T-05-42). Um `insert` em
// `reservado`. Pessoa apagada em outro celular → a chave estrangeira recusa (23503, lido em
// `erro.cause.code`) e a frase humana volta. NUNCA recusa por dia fechado (D-13: avisa e não bloqueia)
// nem por haver outro lançamento no mesmo horário.
export async function reservarUsoLivre(entradaBruta: unknown): Promise<ResultadoDoLancamento<UsoLivreReservado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaReservarUsoLivre.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let reservado: UsoLivreReservado;
  try {
    const [linha] = await db
      .insert(usosLivres)
      .values({
        clienteId: dados.clienteId,
        data: dados.data,
        chegadaPrevista: dados.chegadaPrevista,
        horasPrevistas: dados.horasPrevistas,
        pessoas: dados.pessoas,
        estado: "reservado",
        criadoPor: usuario.id,
      })
      .returning({ id: usosLivres.id, data: usosLivres.data });
    reservado = linha;
  } catch (erro) {
    if (codigoDoErroPostgres(erro) === "23503") {
      return { ok: false, erro: FRASE_PESSOA_NAO_EXISTE, campos: { clienteId: FRASE_PESSOA_NAO_EXISTE } };
    }
    console.error(
      `Falha ao reservar o uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: reservado };
}

// O estado de agora de um uso, depois de uma escrita condicionada que não pegou nenhuma linha — para
// dizer POR QUÊ (não existe, já começou, já foi encerrado) sem nunca gravar nada.
async function estadoAtualDoUso(usoLivreId: string): Promise<{ estado: EstadoUsoLivre; chegada: string | null } | null> {
  const [linha] = await db
    .select({ estado: usosLivres.estado, chegada: usosLivres.chegada })
    .from(usosLivres)
    .where(eq(usosLivres.id, usoLivreId));
  return linha ?? null;
}

// "HH:MM:SS" do `pg` → "HH:MM" (Pitfall 9).
function horaCurta(hora: string): string {
  return hora.slice(0, 5);
}

export type ChegadaMarcada = { chegada: string; jaEstavaMarcada: boolean };

// "Chegou" (AGE-13 — é isso que vira registro de uso). `exigirUsuario()` primeiro. UMA instrução
// condicionada: `estado = 'no_espaco'` e `chegada` só onde o estado ainda é `reservado`. Nenhuma linha
// afetada: o uso não existe mais (cancelado em outro celular) → a frase; ou JÁ começou (toque duplo,
// outro celular) → sucesso com a hora que já estava gravada, sem mudá-la (AGE-13 · idempotency).
export async function marcarChegada(entradaBruta: unknown): Promise<ResultadoDeAcao<ChegadaMarcada>> {
  await exigirUsuario();

  const resultado = esquemaMarcarChegada.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let marcada: ChegadaMarcada;
  try {
    const [linha] = await db
      .update(usosLivres)
      .set({ estado: "no_espaco", chegada: dados.chegada })
      .where(and(eq(usosLivres.id, dados.usoLivreId), eq(usosLivres.estado, "reservado")))
      .returning({ chegada: usosLivres.chegada });
    if (linha?.chegada) {
      marcada = { chegada: horaCurta(linha.chegada), jaEstavaMarcada: false };
    } else {
      const atual = await estadoAtualDoUso(dados.usoLivreId);
      if (!atual || atual.chegada === null) {
        return { ok: false, erro: FRASE_LANCAMENTO_NAO_EXISTE };
      }
      marcada = { chegada: horaCurta(atual.chegada), jaEstavaMarcada: true };
    }
  } catch (erro) {
    console.error(
      `Falha ao marcar a chegada (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR_CHEGADA };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: marcada };
}

// "Chegou às" corrigido com a pessoa no espaço (editável até encerrar — 05-UI-SPEC.md §"Rótulos").
// `exigirUsuario()` primeiro; a instrução só pega o uso `no_espaco`. Encerrado em outro celular → a
// frase do "já encerrado"; ainda reservado → "marque “Chegou” primeiro".
export async function corrigirChegada(entradaBruta: unknown): Promise<ResultadoDeAcao<{ chegada: string }>> {
  await exigirUsuario();

  const resultado = esquemaCorrigirChegada.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .update(usosLivres)
      .set({ chegada: dados.chegada })
      .where(and(eq(usosLivres.id, dados.usoLivreId), eq(usosLivres.estado, "no_espaco")))
      .returning({ chegada: usosLivres.chegada });
    if (!linha?.chegada) {
      const atual = await estadoAtualDoUso(dados.usoLivreId);
      return {
        ok: false,
        erro:
          atual === null
            ? FRASE_LANCAMENTO_NAO_EXISTE
            : atual.estado === "encerrado"
              ? FRASE_USO_JA_ENCERRADO
              : FRASE_USO_AINDA_NAO_COMECOU,
      };
    }
    revalidarTelasDaAgenda({ publico: false });
    return { ok: true, dados: { chegada: horaCurta(linha.chegada) } };
  } catch (erro) {
    console.error(
      `Falha ao corrigir a chegada (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CORRIGIR_CHEGADA };
  }
}

// "Cancelar reserva" (AGE-05), depois da confirmação. `exigirUsuario()` primeiro. Só a reserva NÃO
// INICIADA sai, e o estado é conferido NA PRÓPRIA instrução de `delete` (T-05-43): se outro gestor
// marcou "Chegou" um instante antes, nada é apagado e a frase diz que ela já começou. Nenhuma linha e
// o uso não existe → "Isso já tinha sido removido." (idempotente). Uso com baixa no Estoque (a chave
// estrangeira `movimentacoes_estoque.uso_livre_id`, 23503 em `erro.cause.code`) → a frase humana — a
// última defesa (AGE-20). Uso no espaço ou encerrado nunca se apaga.
export async function cancelarReserva(entradaBruta: unknown): Promise<ResultadoDeAcao<{ data: string }>> {
  await exigirUsuario();

  const resultado = esquemaCancelarReserva.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_JA_REMOVIDO };
  }
  const { usoLivreId } = resultado.data;

  let removido: { data: string } | undefined;
  try {
    [removido] = await db
      .delete(usosLivres)
      .where(and(eq(usosLivres.id, usoLivreId), eq(usosLivres.estado, "reservado")))
      .returning({ data: usosLivres.data });
    if (!removido) {
      const atual = await estadoAtualDoUso(usoLivreId);
      return { ok: false, erro: atual === null ? FRASE_JA_REMOVIDO : FRASE_RESERVA_JA_COMECOU };
    }
  } catch (erro) {
    if (codigoDoErroPostgres(erro) === "23503") {
      return { ok: false, erro: FRASE_USO_COM_MATERIAL_BAIXADO };
    }
    console.error(
      `Falha ao cancelar a reserva (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CANCELAR_RESERVA };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: removido };
}

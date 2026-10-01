"use server";

import { revalidatePath } from "next/cache";

import { and, eq, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import { clientes, eventos, inscricoes, turmas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { FRASE_CLIENTE_NAO_EXISTE } from "@/lib/clientes/textos";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import {
  fechadosEntre,
  lerDiaParaLancar,
  pessoasParaData,
  type DiaParaLancar,
  type PessoasParaData,
} from "./consultas";
import {
  esquemaBuscarPessoas,
  esquemaCancelarData,
  esquemaColocarNaData,
  esquemaConferirDia,
  esquemaDefinirPresenca,
  esquemaFecharDia,
  esquemaLancarAvulsa,
  esquemaLancarTurma,
  esquemaTirarBloqueio,
  esquemaTirarDaLista,
} from "./esquemas";
import {
  contarPerdasAoCancelar,
  marcarDatasDaTurma,
  RecusaDaAgenda,
  temPerdas,
  travarEvento,
  travarInscricao,
  travarInscricaoComVenda,
  type PerdasAoCancelar,
} from "./gravacao";
import { planejarPresenca, type PresencaPlanejada } from "./presenca";
import { datasDaTurma, datasEmDiaFechado, type FechadoDoDia } from "./turma";
import {
  FRASE_DATA_CANCELADA,
  FRASE_ERRO_CARREGAR_PESSOAS,
  FRASE_ESCOLHA_A_DATA,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_COLOCAR,
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_AO_TIRAR_BLOQUEIO,
  FRASE_FALHA_AO_TIRAR_DA_LISTA,
  FRASE_FECHADO_NAO_SE_CANCELA,
  FRASE_JA_REMOVIDO,
  FRASE_FALHA_PRESENCA_GENERICA,
  FRASE_LANCAMENTO_NAO_EXISTE,
  fraseInscricaoJaVirouVenda,
  fraseJaEstaNaLista,
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

export type Colocado = { inscricaoId: string; nome: string };

// "Colocar na lista" numa aula ou oficina avulsa (AGE-10, AGE-12). `exigirUsuario()` primeiro
// (T-05-23), Zod (só os dois ids — nenhum valor vem da tela, T-05-24). Sob a trava do EVENTO (`for no
// key update`, a ordem global: EVENTO → CLIENTE → INSCRIÇÃO):
// - data que não existe mais ou cancelada → a frase, nada gravado;
// - data de turma → recusa com a frase genérica: o "Colocar alguém" da turma (experimental e
//   reposição) chega no plano 08, que amplia esta ação;
// - insere a inscrição `oficina`, `cobrar = true`, com o PREÇO DO EVENTO NESTE MOMENTO copiado para
//   `valor_centavos` (cada inscrição paga à parte; mudar o evento depois não muda o que cada um deve).
//   `on conflict (evento_id, cliente_id) do nothing` (T-05-26): dois gestores colocando a mesma pessoa
//   terminam com UMA inscrição, e o segundo ouve "{nome} já está nesta lista — a tela foi atualizada.".
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
      if (evento.tipo !== "avulsa" || evento.precoCentavos === null) {
        throw new RecusaDaAgenda(FRASE_FALHA_AO_COLOCAR);
      }

      const [cliente] = await tx
        .select({ nome: clientes.nome })
        .from(clientes)
        .where(eq(clientes.id, dados.clienteId));
      if (!cliente) {
        throw new RecusaDaAgenda(FRASE_CLIENTE_NAO_EXISTE);
      }

      const [inserida] = await tx
        .insert(inscricoes)
        .values({
          eventoId: evento.id,
          clienteId: dados.clienteId,
          tipo: "oficina",
          cobrar: true,
          valorCentavos: evento.precoCentavos,
          criadoPor: usuario.id,
        })
        .onConflictDoNothing({ target: [inscricoes.eventoId, inscricoes.clienteId] })
        .returning({ id: inscricoes.id });
      if (!inserida) {
        throw new RecusaDaAgenda(fraseJaEstaNaLista(cliente.nome));
      }
      return { inscricaoId: inserida.id, nome: cliente.nome };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // A tela estava velha (já na lista, data cancelada): ela se atualiza junto com a frase.
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

export type TiradoDaLista = { nome: string };

// "Tirar da lista" de uma oficina (05-UI-SPEC.md §Confirmações; D-08, UI-D14). `exigirUsuario()`
// primeiro (T-05-23). Sob a trava da INSCRIÇÃO, com a venda ligada lida na mesma instrução (T-05-25):
// - não existe mais → "Isso já tinha sido removido.";
// - data cancelada → a frase (a lista da data cancelada é só de leitura);
// - não é inscrição de oficina → a frase genérica (reposição e experimental chegam no plano 08; o
//   aluno sai da turma pela ficha);
// - ligada a uma venda NÃO cancelada → recusa com a frase da D-08, verbatim: a Agenda nunca devolve
//   dinheiro nem desfaz venda — a devolução é no Caixa;
// - sem venda, ou com a venda cancelada → apaga a inscrição (a venda cancelada continua no
//   Financeiro, AGE-20). O `delete` só vem depois de todas as conferências.
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
      if (inscricao.tipo !== "oficina") {
        throw new RecusaDaAgenda(FRASE_FALHA_AO_TIRAR_DA_LISTA);
      }
      if (inscricao.venda !== null && !inscricao.venda.cancelada) {
        throw new RecusaDaAgenda(fraseInscricaoJaVirouVenda(inscricao.venda.numero));
      }
      await tx.delete(inscricoes).where(eq(inscricoes.id, inscricao.id));
      return { nome: inscricao.nome };
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

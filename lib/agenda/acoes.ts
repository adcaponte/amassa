"use server";

import { revalidatePath } from "next/cache";

import { and, asc, eq, gt, isNotNull, isNull, max, or } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  eventos,
  inscricoes,
  itensCatalogo,
  mensalidades,
  turmaAlunos,
  turmas,
  usosLivres,
  usosLivresMaterial,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { FRASE_CLIENTE_NAO_EXISTE } from "@/lib/clientes/textos";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { FRASE_MATERIAL_NAO_EXISTE_MAIS } from "@/lib/estoque/textos";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { gravarVenda } from "@/lib/financeiro/gravacao";
import { conferirParcelas } from "@/lib/financeiro/parcelas";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import {
  creditosDoCliente,
  datasDaTurmaNoMes,
  fechadosEntre,
  lerDiaParaLancar,
  itensDoSistemaParaVenda,
  obterItensDoSistema,
  pessoasParaData,
  type DiaParaLancar,
  type PessoasParaData,
} from "./consultas";
import {
  esquemaAcrescentarMaterial,
  esquemaBuscarPessoas,
  esquemaCancelarData,
  esquemaCancelarReserva,
  esquemaColocarNaData,
  esquemaConferirDia,
  esquemaCorrigirChegada,
  esquemaDefinirCobrancaDoMaterial,
  esquemaDefinirDireitoARepor,
  esquemaDefinirDispensa,
  esquemaDefinirPresenca,
  esquemaDesativarTurma,
  esquemaEditarTurma,
  esquemaEncerrarUsoLivre,
  esquemaEntrarNaTurma,
  esquemaFecharDia,
  esquemaLancarAvulsa,
  esquemaLancarTurma,
  esquemaMarcarChegada,
  esquemaMarcarMaisSemanas,
  esquemaLoteDeMensalidades,
  esquemaReceberAgora,
  esquemaReservarUsoLivre,
  esquemaSairDaTurma,
  esquemaTirarBloqueio,
  esquemaTirarDaLista,
  esquemaTirarMaterial,
  type FormaDeReceber,
  type ModoDeColocar,
} from "./esquemas";
import {
  baixarMaterialDoUso,
  contarPerdasAoCancelar,
  eventoDaInscricao,
  garantirMensalidadesDoMes,
  gravarDispensa,
  inscreverAlunoDaquiParaFrente,
  inscreverAlunosNasDatas,
  marcarDatasDaTurma,
  RecusaDaAgenda,
  temPerdas,
  tirarAlunoDasDatasFuturas,
  travarDatasFuturasDaTurma,
  apagarDatasDaTurma,
  contarPerdasAoDesativar,
  perdasCobertas,
  travarCliente,
  travarEvento,
  travarEventoParaLeitura,
  travarInscricao,
  travarInscricaoComVenda,
  travarTurma,
  travarUsoLivre,
  travarCobranca,
  travarMensalidades,
  vincularVenda,
  vendaAtivaEmDataFutura,
  type MaterialBaixado,
  type PerdasAoCancelar,
  type PerdasAoDesativar,
  type TransacaoDoBanco,
} from "./gravacao";
import { mesDaData, valorProporcional, vencimentoDaMensalidade } from "./mensalidade";
import { planejarPresenca, type PresencaPlanejada } from "./presenca";
import { chaveDoEnvio, umaVezPorEnvio } from "./envios";
import { linhasDaVenda, podeDispensar, situacaoDaCobranca } from "./receber";
import { horasCheias, proximoEstado, valorDoUsoLivre } from "./uso-livre";
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
  FRASE_ALUNO_SAI_PELA_FICHA,
  FRASE_OFICINA_SO_EM_AULA_AVULSA,
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
  FRASE_FALHA_AO_ENCERRAR,
  FRASE_SAIDA_ANTES_DA_CHEGADA,
  FRASE_SEM_PRECO_DA_HORA,
  FRASE_FALHA_AO_CORRIGIR_CHEGADA,
  FRASE_FALHA_AO_MARCAR_CHEGADA,
  FRASE_PESSOA_NAO_EXISTE,
  FRASE_RESERVA_JA_COMECOU,
  FRASE_USO_AINDA_NAO_COMECOU,
  FRASE_USO_COM_MATERIAL_BAIXADO,
  FRASE_USO_JA_ENCERRADO,
  FRASE_FALHA_AO_ACRESCENTAR_MATERIAL,
  FRASE_FALHA_AO_MUDAR_COBRANCA,
  FRASE_FALHA_AO_TIRAR_MATERIAL,
  FRASE_MATERIAL_SEM_PRECO,
  fraseMaterialDesativadoNoUso,
  SUFIXO_MATERIAL_DESATIVADO,
  FRASE_COBRANCA_DISPENSADA,
  FRASE_COBRANCA_SUMIU,
  FRASE_FALHA_AO_LANCAR_LOTE,
  FRASE_FALHA_AO_RECEBER,
  FRASE_FALHA_AO_DISPENSAR,
  fraseJaLancado,
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
      // WR-02 (revisão B): a tela estava velha (data cancelada, inscrição tirada em outro celular) — ela
      // se atualiza junto com a frase, como em `definirDireitoARepor`.
      revalidarTelasDaAgenda({ publico: false });
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
  // WR-06 (revisão B): a resposta perdida no celular não vira um segundo lançamento — `lib/agenda/envios.ts`.
  return umaVezPorEnvio(chaveDoEnvio(usuario.id, "lancarAvulsa", entradaBruta, dados), async () => {
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
  });
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
  // WR-06 (revisão B): a resposta perdida no celular não vira um segundo lançamento — `lib/agenda/envios.ts`.
  return umaVezPorEnvio(chaveDoEnvio(usuario.id, "lancarTurma", entradaBruta, dados), async () => {
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
  });
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
  // WR-06 (revisão B): a resposta perdida no celular não vira um segundo lançamento — `lib/agenda/envios.ts`.
  return umaVezPorEnvio(chaveDoEnvio(usuario.id, "fecharDia", entradaBruta, dados), async () => {
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
  });
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

      // WR-03 (revisão B): conta SEMPRE, sob a trava do evento. A confirmação manda o que MOSTROU; se
      // agora se perde mais do que isso (outro celular marcou presença com o diálogo aberto), nada é
      // gravado e a tela recebe os números de agora — nunca um "sim" que apaga mais do que disse.
      const perdas = await contarPerdasAoCancelar(tx, evento.id);
      const vistas = dados.confirmado;
      const cobertas =
        vistas !== undefined &&
        perdas.presencas <= vistas.presencas &&
        perdas.inscricoesAReceber <= vistas.inscricoesAReceber;
      if (temPerdas(perdas) && !cobertas) {
        return { situacao: "confirmar", perdas };
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
          throw new RecusaDaAgenda(FRASE_OFICINA_SO_EM_AULA_AVULSA);
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
// Sob a trava da INSCRIÇÃO, com a venda ligada RELIDA depois da trava (T-05-25; CR-01 da revisão):
// - não existe mais → "Isso já tinha sido removido.";
// - data cancelada → a frase (a lista da data cancelada é só de leitura);
// - inscrição de aluno → a frase que diz onde ele sai (pela ficha, "Sair da turma" — IN-02 da revisão A);
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
        throw new RecusaDaAgenda(FRASE_ALUNO_SAI_PELA_FICHA);
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
// TURMA: recusa a desativada; grava a turma e, nas datas com `data > hoje` (inclusive as canceladas — WR-02), o
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
      // WR-02 (revisão da Fase 5): as datas futuras CANCELADAS também acompanham a turma. Antes elas
      // ficavam com o horário, as vagas e o `publico` de quando foram canceladas, e "Desfazer
      // cancelamento" trazia de volta o velho — uma turma que virou privada reaparecia no site. A trava
      // de cada data (a mesma de `cancelarData`) serializa os dois. A contagem do toast segue sendo a
      // das datas de pé.
      const atualizadas = await tx
        .update(eventos)
        .set({ inicio: dados.inicio, fim: dados.fim, vagas: dados.vagas, publico: dados.publica })
        .where(and(eq(eventos.turmaId, turma.id), gt(eventos.data, hoje)))
        .returning({ id: eventos.id, canceladoEm: eventos.canceladoEm });
      return {
        mensalidadeMudou: turma.mensalidadeCentavos !== dados.mensalidadeCentavos,
        datasAtualizadas: atualizadas.filter((data) => data.canceladoEm === null).length,
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

export type TurmaDesativada =
  | { situacao: "desativada"; datasTiradas: number }
  // WR-04: nada gravado — o que sai agora passou do que a confirmação mostrou; a tela mostra estes números.
  | { situacao: "confirmar"; perdas: PerdasAoDesativar };

// "Desativar turma" (D-03) — NUNCA apaga a turma (`revoke delete` em `turmas`), o que já aconteceu
// nem as mensalidades nascidas (T-05-31). `exigirUsuario()` primeiro. Sob a trava da TURMA:
// - não existe / já desativada → a frase;
// - alguma inscrição de data futura ligada a venda NÃO cancelada → recusa com a data e o número da
//   venda (D-08: a venda só se desfaz no Caixa);
// - tira as datas com `data > hoje` e as inscrições delas (Assumption A14 — não as cancela, para a
//   semana não encher de datas riscadas; as reposições voltam a ser crédito por derivação) e grava
//   `ativa = false`, `desativada_em`, `desativada_por`. Hoje e o passado ficam.
// - WR-04 (revisão): com as datas e as inscrições delas TRAVADAS (`travarDatasFuturasDaTurma`, que também
//   reconfere a venda ativa — WR-01), reconta o que sai; se passou do que a confirmação mostrou
//   (`confirmado`), não grava e devolve os números de agora (molde de `cancelarData`).
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
      const travadas = await travarDatasFuturasDaTurma(tx, turma.id, hoje);
      const perdas = await contarPerdasAoDesativar(tx, turma.id, hoje);
      if (!perdasCobertas(perdas, resultado.data.confirmado ?? null)) {
        return { situacao: "confirmar", perdas };
      }
      const datasTiradas = await apagarDatasDaTurma(tx, turma.id, hoje, travadas);
      await tx
        .update(turmas)
        .set({ ativa: false, desativadaEm: new Date(), desativadaPor: usuario.id })
        .where(eq(turmas.id, turma.id));
      return { situacao: "desativada", datasTiradas };
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
  if (desativada.situacao === "desativada") {
    revalidarTelasDaAgenda({ publico });
  }
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
  // WR-06 (revisão B): a resposta perdida no celular não vira um segundo lançamento — `lib/agenda/envios.ts`.
  return umaVezPorEnvio(chaveDoEnvio(usuario.id, "reservarUsoLivre", entradaBruta, dados), async () => {
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
  });
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
      // IN-04 da revisão A: encerrado em outro celular não é "chegada marcada" — a frase diz o que houve.
      if (atual.estado === "encerrado") {
        revalidarTelasDaAgenda({ publico: false });
        return { ok: false, erro: FRASE_USO_JA_ENCERRADO };
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

export type UsoEncerrado = {
  horasCheias: number;
  valorCentavos: number;
  precoHoraCentavos: number;
  // Plano 10: Σ do material cobrado (já dentro do valor) e quantas linhas saíram do Estoque.
  materialCobradoCentavos: number;
  materiaisBaixados: number;
};

// "Encerrar e cobrar" (AGE-13, AGE-14, AGE-17). `exigirUsuario()` primeiro (T-05-41, T-05-46); Zod
// ("HH:MM", saída depois da chegada). NUMA transação, sob a trava do USO (`travarUsoLivre`, `for no key
// update` — T-05-44, T-05-48: dois gestores encerrando o mesmo uso se serializam aqui e o segundo lê
// `encerrado`, então as saídas do material nunca são gravadas duas vezes):
// - o uso tem de estar `no_espaco` — encerrado → "Este uso livre já foi encerrado…" (a tela atualiza);
// - o preço da hora é lido AGORA, pela CHAVE do item "Uso livre (hora)" (`obterItensDoSistema(tx)` —
//   D-04, D-17), e sem preço nada é cobrado com valor inventado: a frase diz onde cadastrar;
// - `horas_cheias = teto(minutos ÷ 60)` pelo módulo puro;
// - o MATERIAL (plano 10, D-06/D-14): as linhas do uso são lidas sob a mesma trava e
//   `baixarMaterialDoUso` grava UMA saída por linha — cobrada ou inclusa — pela porta única do livro
//   (ordem USO LIVRE → ITENS), congela o preço de venda de agora no cobrado e devolve o valor dele;
// - `valor = horas cheias × pessoas × preço da hora + Σ material cobrado` (pessoas multiplica UMA vez),
//   e o preço da hora fica CONGELADO em `preco_hora_centavos` (T-05-42);
// - o `update` ainda confere `estado = 'no_espaco'` na própria instrução, e cada linha de material
//   ganha a sua `movimentacao_id` (única — uma linha vira no máximo uma saída).
// Se qualquer passo falhar, NADA é gravado — nem o encerramento, nem a baixa.
export async function encerrarUsoLivre(entradaBruta: unknown): Promise<ResultadoDoLancamento<UsoEncerrado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaEncerrarUsoLivre.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let encerrado: UsoEncerrado;
  try {
    encerrado = await db.transaction(async (tx): Promise<UsoEncerrado> => {
      const uso = await travarUsoLivre(tx, dados.usoLivreId);
      if (!uso) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (proximoEstado(uso.estado, "encerrar") === null) {
        throw new RecusaDaAgenda(uso.estado === "encerrado" ? FRASE_USO_JA_ENCERRADO : FRASE_USO_AINDA_NAO_COMECOU);
      }
      const precoHoraCentavos = (await obterItensDoSistema(tx)).usoLivreHora.precoVendaCentavos;
      if (precoHoraCentavos === null) {
        throw new RecusaDaAgenda(FRASE_SEM_PRECO_DA_HORA);
      }
      let horas: number;
      try {
        horas = horasCheias(dados.chegada, dados.saida);
      } catch {
        throw new RecusaDaAgenda(FRASE_SAIDA_ANTES_DA_CHEGADA);
      }

      // O material, sob a trava do uso (acrescentar, mudar a cobrança e tirar travam o mesmo uso).
      const materiais = await tx
        .select({
          id: usosLivresMaterial.id,
          itemId: usosLivresMaterial.itemId,
          quantidadeMilesimos: usosLivresMaterial.quantidadeMilesimos,
          cobrar: usosLivresMaterial.cobrar,
        })
        .from(usosLivresMaterial)
        .where(and(eq(usosLivresMaterial.usoLivreId, uso.id), isNull(usosLivresMaterial.movimentacaoId)))
        .orderBy(asc(usosLivresMaterial.criadoEm), asc(usosLivresMaterial.id));
      let baixados: MaterialBaixado[] = [];
      if (materiais.length > 0) {
        const [pessoa] = await tx
          .select({ nome: clientes.nome })
          .from(clientes)
          .where(eq(clientes.id, uso.clienteId));
        baixados = await baixarMaterialDoUso(
          tx,
          { id: uso.id, data: uso.data, nome: pessoa?.nome ?? "" },
          materiais,
          usuario.id,
        );
      }
      const materialCobradoCentavos = baixados.reduce((soma, linha) => soma + (linha.valorCentavos ?? 0), 0);

      const valorCentavos = valorDoUsoLivre({
        horas,
        pessoas: uso.pessoas,
        precoHoraCentavos,
        materialCobradoCentavos,
      });
      const [gravado] = await tx
        .update(usosLivres)
        .set({
          estado: "encerrado",
          chegada: dados.chegada,
          saida: dados.saida,
          horasCheias: horas,
          precoHoraCentavos,
          valorCentavos,
        })
        .where(and(eq(usosLivres.id, uso.id), eq(usosLivres.estado, "no_espaco")))
        .returning({ id: usosLivres.id });
      if (!gravado) {
        throw new RecusaDaAgenda(FRASE_USO_JA_ENCERRADO);
      }
      for (const linha of baixados) {
        const [ligada] = await tx
          .update(usosLivresMaterial)
          .set({
            movimentacaoId: linha.movimentacaoId,
            precoUnitarioCentavos: linha.precoUnitarioCentavos,
            valorCentavos: linha.valorCentavos,
            atualizadoEm: new Date(),
          })
          .where(and(eq(usosLivresMaterial.id, linha.id), isNull(usosLivresMaterial.movimentacaoId)))
          .returning({ id: usosLivresMaterial.id });
        if (!ligada) {
          // Impossível sob a trava do uso; se acontecer, a transação inteira volta (nada baixado).
          throw new Error(`encerrarUsoLivre: a linha de material ${linha.id} não pôde ser ligada à baixa.`);
        }
      }
      return {
        horasCheias: horas,
        valorCentavos,
        precoHoraCentavos,
        materialCobradoCentavos,
        materiaisBaixados: baixados.length,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // O estado mudou em outro celular (ou faltava o preço, ou um material mudou no Estoque): a tela
      // relê o servidor.
      revalidarTelasDaAgenda({ publico: false });
      return erro.frase === FRASE_SAIDA_ANTES_DA_CHEGADA
        ? { ok: false, erro: erro.frase, campos: { saida: erro.frase } }
        : { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao encerrar o uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_ENCERRAR };
  }

  revalidarTelasDaAgenda({ publico: false });
  if (encerrado.materiaisBaixados > 0) {
    revalidatePath(rotaDeGestao("/estoque"));
  }
  return { ok: true, dados: encerrado };
}

// ── O material do uso livre (plano 10 — AGE-14, D-06, D-14) ─────────────────────────────────────────
// As três ações só REGISTRAM a lista: nada sai do Estoque antes de encerrar. Todas travam o USO
// (`for no key update`) e só mexem num uso `no_espaco` — a mesma trava do encerramento, então nenhuma
// linha muda nem some enquanto a baixa está sendo gravada (T-05-48).

// Trava o uso e recusa o que não está mais (ou ainda não está) no espaço.
async function travarUsoNoEspaco(tx: TransacaoDoBanco, usoLivreId: string): Promise<void> {
  const uso = await travarUsoLivre(tx, usoLivreId);
  if (!uso) {
    throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
  }
  if (uso.estado !== "no_espaco") {
    throw new RecusaDaAgenda(uso.estado === "encerrado" ? FRASE_USO_JA_ENCERRADO : FRASE_USO_AINDA_NAO_COMECOU);
  }
}

// O item de estoque da linha, conferido: existe com estoque próprio, está ativo e — para cobrar — tem
// preço de venda (D-14). Lido sem trava: aqui só a LISTA muda; o encerramento confere tudo de novo sob a
// trava dos itens.
async function conferirItemDoMaterial(tx: TransacaoDoBanco, itemId: string, cobrar: boolean): Promise<void> {
  const [item] = await tx
    .select({
      nome: itensCatalogo.nome,
      ativo: itensCatalogo.ativo,
      controlaEstoque: itensCatalogo.controlaEstoque,
      unidade: itensCatalogo.unidade,
      precoVendaCentavos: itensCatalogo.precoVendaCentavos,
    })
    .from(itensCatalogo)
    .where(eq(itensCatalogo.id, itemId));
  if (!item || !item.controlaEstoque || item.unidade === null) {
    throw new RecusaDaAgenda(FRASE_MATERIAL_NAO_EXISTE_MAIS);
  }
  if (!item.ativo) {
    throw new RecusaDaAgenda(fraseMaterialDesativadoNoUso(item.nome));
  }
  if (cobrar && item.precoVendaCentavos === null) {
    throw new RecusaDaAgenda(FRASE_MATERIAL_SEM_PRECO);
  }
}

// O campo onde cada recusa do material mora na tela (embaixo do campo; o resto, no topo do bloco).
function campoDaRecusaDoMaterial(frase: string): Record<string, string> | undefined {
  if (frase === FRASE_MATERIAL_SEM_PRECO) {
    return { cobrar: frase };
  }
  if (frase === FRASE_MATERIAL_NAO_EXISTE_MAIS || frase.endsWith(SUFIXO_MATERIAL_DESATIVADO)) {
    return { itemId: frase };
  }
  return undefined;
}

// "+ Material" (AGE-14): uma linha nova no "Material usado" — o mesmo item em duas linhas é permitido e
// vira duas saídas ao encerrar. Do cliente chegam o uso, o item, o TEXTO da quantidade e se cobra;
// preço, valor e custo nunca (T-05-47).
export async function acrescentarMaterial(entradaBruta: unknown): Promise<ResultadoDoLancamento<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAcrescentarMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let criado: { id: string };
  try {
    criado = await db.transaction(async (tx) => {
      await travarUsoNoEspaco(tx, dados.usoLivreId);
      await conferirItemDoMaterial(tx, dados.itemId, dados.cobrar);
      const [linha] = await tx
        .insert(usosLivresMaterial)
        .values({
          usoLivreId: dados.usoLivreId,
          itemId: dados.itemId,
          quantidadeMilesimos: dados.quantidade,
          cobrar: dados.cobrar,
        })
        .returning({ id: usosLivresMaterial.id });
      if (!linha) {
        throw new Error("acrescentarMaterial: a linha inserida não voltou.");
      }
      return linha;
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      const campos = campoDaRecusaDoMaterial(erro.frase);
      return campos ? { ok: false, erro: erro.frase, campos } : { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao acrescentar material ao uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_ACRESCENTAR_MATERIAL };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: criado };
}

// "Cobrar · Incluso" numa linha já acrescentada (D-14): grava o estado DESEJADO, sem toast — toque duplo
// e dois celulares convergem. "Cobrar" só com preço de venda, como ao acrescentar.
export async function definirCobrancaDoMaterial(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ cobrar: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaDefinirCobrancaDoMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ usoLivreId: usosLivresMaterial.usoLivreId, itemId: usosLivresMaterial.itemId })
        .from(usosLivresMaterial)
        .where(eq(usosLivresMaterial.id, dados.materialId));
      if (!linha) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
      await travarUsoNoEspaco(tx, linha.usoLivreId);
      if (dados.cobrar) {
        await conferirItemDoMaterial(tx, linha.itemId, true);
      }
      const [gravada] = await tx
        .update(usosLivresMaterial)
        .set({ cobrar: dados.cobrar, atualizadoEm: new Date() })
        .where(and(eq(usosLivresMaterial.id, dados.materialId), isNull(usosLivresMaterial.movimentacaoId)))
        .returning({ id: usosLivresMaterial.id });
      if (!gravada) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao mudar a cobrança do material (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MUDAR_COBRANCA };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: { cobrar: dados.cobrar } };
}

// "Tirar o material" (só antes de encerrar — AGE-20): apaga a linha SEM baixa de um uso `no_espaco`,
// condição conferida na própria instrução (`movimentacao_id is null`) sob a trava do uso. A linha já
// baixada nunca se apaga — a movimentação do livro é para sempre (a FK sem `on delete` e o `unique`
// também a protegem), e a Agenda nunca estorna nem apaga uma movimentação de estoque.
export async function tirarMaterial(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaTirarMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ usoLivreId: usosLivresMaterial.usoLivreId })
        .from(usosLivresMaterial)
        .where(eq(usosLivresMaterial.id, dados.materialId));
      if (!linha) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
      await travarUsoNoEspaco(tx, linha.usoLivreId);
      const [apagada] = await tx
        .delete(usosLivresMaterial)
        .where(
          and(
            eq(usosLivresMaterial.id, dados.materialId),
            eq(usosLivresMaterial.usoLivreId, linha.usoLivreId),
            isNull(usosLivresMaterial.movimentacaoId),
          ),
        )
        .returning({ id: usosLivresMaterial.id });
      if (!apagada) {
        throw new RecusaDaAgenda(FRASE_USO_JA_ENCERRADO);
      }
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao tirar o material do uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_TIRAR_MATERIAL };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: { id: dados.materialId } };
}

// ── “Recebi agora” (plano 11 — AGE-15, D-01, D-04, D-14, UI-D4) ─────────────────────────────────────────

export type RecebidoAgora = { documentoId: string; numero: number; forma: FormaDeReceber };

// “Recebi agora”: a cobrança vira a Venda JÁ PAGA hoje, na forma tocada, e entra no Caixa do dia. A Agenda
// não guarda dinheiro (§5): a venda é do Financeiro, gravada pelo MESMO escritor da Venda manual
// (`gravarVenda`, `lib/financeiro/gravacao.ts`); a Agenda grava só o vínculo `documento_id`.
// `exigirUsuario()` é a PRIMEIRA instrução (T-05-51). Do navegador chegam só o tipo e o id da cobrança e
// a forma (T-05-53) — linhas, valor, descrição, categoria e cliente vêm do banco, sob a trava. A taxa e
// os itens do sistema são lidos FORA da transação (como `lancarVenda`). Na transação, a ordem é COBRANÇA
// (`for no key update`) → documento NOVO → ITENS (dentro de `gravarVenda`, só se houver linha com estoque
// — nenhuma das três da Agenda tem): livre = sem venda ou com venda cancelada (D-08), e não dispensada;
// senão a frase da corrida (Pitfall 8, T-05-54). O vínculo é gravado na MESMA transação da venda.
export async function receberAgora(entradaBruta: unknown): Promise<ResultadoDeAcao<RecebidoAgora>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaReceberAgora.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let venda: { id: string; numero: number };
  try {
    const [configuracao, itens] = await Promise.all([obterConfiguracaoFinanceira(), obterItensDoSistema()]);
    const itensParaVenda = itensDoSistemaParaVenda(itens);

    venda = await db.transaction(async (tx) => {
      const cobranca = await travarCobranca(tx, dados.cobranca);
      if (!cobranca) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }
      const situacao = situacaoDaCobranca(cobranca);
      // CR-01: venda ativa recusa SEMPRE (a situação vem da linha travada); o número só escolhe a frase.
      if (situacao === "lancado" || situacao === "pago") {
        throw new RecusaDaAgenda(
          cobranca.numeroDaVenda !== null ? fraseJaLancado(cobranca.numeroDaVenda) : FRASE_COBRANCA_SUMIU,
        );
      }
      if (situacao === "dispensada") {
        throw new RecusaDaAgenda(FRASE_COBRANCA_DISPENSADA);
      }
      if (cobranca.tipo === "inscricao" && cobranca.dataCancelada) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      // Cobrança de R$ 0 nunca aparece em “A receber” e nunca vira venda (AGE-15 · boundary).
      if (cobranca.valorCentavos <= 0) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }

      // As linhas do BANCO (D-04/D-14): o item do sistema com a descrição da cobrança e, no uso livre, o
      // material cobrado como linha LIVRE na categoria do “Uso livre (hora)” (Pitfall 3).
      const linhas = linhasDaVenda(cobranca, itensParaVenda);
      const totalCentavos = linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
      const parcela = { vencimento: hoje, valorCentavos: totalCentavos, forma: dados.forma, pago: true };
      // A mesma conferência da Venda manual (soma, data do saldo inicial) — com a frase dela.
      const conferencia = conferirParcelas({
        totalCentavos,
        parcelas: [parcela],
        hoje,
        dataSaldoInicial: configuracao.dataSaldoInicial,
      });
      if (!conferencia.ok) {
        throw new RecusaDaAgenda(conferencia.erro);
      }

      // D-01: `pessoa_nome` = o nome do cliente congelado agora, e o vínculo `cliente_id`. A taxa do
      // cartão é congelada por `gravarVenda` na parcela paga no cartão — a regra que o Financeiro já aplica.
      const gravada = await gravarVenda(
        tx,
        { data: hoje, pessoaNome: cobranca.nome, clienteId: cobranca.clienteId, linhas, parcelas: [parcela] },
        { registradoPor: usuario.id, taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase },
      );
      await vincularVenda(tx, dados.cobranca, gravada.id);
      return gravada;
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao registrar o “Recebi agora” (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_RECEBER };
  }

  revalidarTelasDaAgenda({ publico: false });
  revalidatePath(rotaDeGestao("/financeiro"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: { documentoId: venda.id, numero: venda.numero, forma: dados.forma } };
}

// ── O lote de mensalidades (plano 12 — AGE-16, Assumption A6, D-08, D-09) ───────────────────────────────

export type LoteLancado = { lancadas: number; jaLancadas: number };

// “Lançar estas {N} na Venda”: UMA venda POR MENSALIDADE (aluno em duas turmas = duas vendas, cada uma
// no dia da sua turma), cada uma com UMA parcela EM ABERTO vencendo no vencimento da mensalidade — o lote
// nunca cria venda paga nem marca recebimento (§5: “pago” só existe quando o Caixa marca “Recebi”). O
// \`pix\` é só o valor INICIAL da parcela em aberto, como na aprovação do orçamento: o Caixa troca a forma
// quando o dinheiro cai. Molde de \`gerarContasDoMes\`: \`exigirUsuario()\` é a PRIMEIRA instrução
// (T-05-57); do navegador chegam só os ids (Zod, até 500 — T-05-61); hoje, a taxa e os itens do sistema
// são lidos FORA da transação; numa transação só, as mensalidades pedidas são travadas em ordem de id
// (\`for no key update\` — dois lotes ao mesmo tempo nunca se travam em ordem inversa), as que já viraram
// venda ativa ou foram dispensadas são PULADAS e CONTADAS (a corrida com outro celular, com o “Recebi
// agora” ou com o “Lançar na Venda” — T-05-59), e para cada livre \`gravarVenda\` + o vínculo. Id que não é
// de mensalidade não é lido (T-05-60). Qualquer recusa ou falha desfaz TUDO: nada fica pela metade.
export async function lancarMensalidadesEmLote(entradaBruta: unknown): Promise<ResultadoDeAcao<LoteLancado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaLoteDeMensalidades.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const ids = [...new Set(resultado.data.ids)].sort();
  const hoje = hojeEmBrasilia(new Date());

  let lote: LoteLancado;
  try {
    const [configuracao, itens] = await Promise.all([obterConfiguracaoFinanceira(), obterItensDoSistema()]);
    const itensParaVenda = itensDoSistemaParaVenda(itens);

    lote = await db.transaction(async (tx) => {
      const travadas = await travarMensalidades(tx, ids);
      let lancadas = 0;
      let jaLancadas = 0;
      for (const mensalidade of travadas) {
        if (mensalidade.tipo !== "mensalidade") {
          continue;
        }
        const situacao = situacaoDaCobranca(mensalidade);
        if (situacao !== "a_receber" && situacao !== "venda_cancelada") {
          jaLancadas += 1;
          continue;
        }
        if (mensalidade.valorCentavos <= 0) {
          continue;
        }

        // D-04: uma linha do item “Mensalidade”, com a descrição da cobrança e o valor da mensalidade.
        const linhas = linhasDaVenda(mensalidade, itensParaVenda);
        const totalCentavos = linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
        const parcela = {
          vencimento: mensalidade.vencimento,
          valorCentavos: totalCentavos,
          forma: "pix" as const,
          pago: false,
        };
        // A mesma conferência da Venda manual. Uma recusa para o lote INTEIRO, com a frase dela.
        const conferencia = conferirParcelas({
          totalCentavos,
          parcelas: [parcela],
          hoje,
          dataSaldoInicial: configuracao.dataSaldoInicial,
        });
        if (!conferencia.ok) {
          throw new RecusaDaAgenda(conferencia.erro);
        }

        const gravada = await gravarVenda(
          tx,
          { data: hoje, pessoaNome: mensalidade.nome, clienteId: mensalidade.clienteId, linhas, parcelas: [parcela] },
          { registradoPor: usuario.id, taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase },
        );
        await vincularVenda(tx, { tipo: "mensalidade", id: mensalidade.id }, gravada.id);
        lancadas += 1;
      }
      return { lancadas, jaLancadas };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao lançar o lote de mensalidades (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR_LOTE };
  }

  revalidarTelasDaAgenda({ publico: false });
  revalidatePath(rotaDeGestao("/financeiro"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: lote };
}

// ── Dispensar uma cobrança (plano 13 — D-09, UI-D15, T-05-62..65) ──────────────────────────────────────

export type DispensaDefinida = { dispensada: boolean };

// “Dispensar a cobrança” e o “Desfazer” (da sanfona “Dispensadas” e do toast): o ESTADO DESEJADO
// (`dispensada: true | false` — dois toques e dois celulares convergem; já no estado pedido = sucesso sem
// gravar). `exigirUsuario()` é a PRIMEIRA instrução (T-05-62). Sob a MESMA trava do “Recebi agora”, do
// “Lançar na Venda” e do lote (`travarCobranca`, `for no key update` na cobrança — T-05-63): dispensar e
// lançar ao mesmo tempo nunca terminam com uma cobrança dispensada E vendida. Só mensalidade e inscrição
// LIVRES (a receber, ou com a venda cancelada no Caixa — D-08) se dispensam; com venda ATIVA, a recusa
// diz o número da venda. Grava `dispensada_em`, `dispensada_por` (quem — T-05-64) e o motivo (Zod até
// 200 — T-05-65), ou os limpa ao desfazer. NUNCA apaga a linha (D-09): só `gravarDispensa`, um `update`.
export async function definirDispensa(entradaBruta: unknown): Promise<ResultadoDoLancamento<DispensaDefinida>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDefinirDispensa.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const referencia = { tipo: dados.tipo, id: dados.id };

  try {
    await db.transaction(async (tx) => {
      const cobranca = await travarCobranca(tx, referencia);
      if (!cobranca) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }
      const situacao = situacaoDaCobranca(cobranca);

      if (!dados.dispensada) {
        // Desfazer: só a dispensada volta; o resto já está no estado pedido.
        if (situacao === "dispensada") {
          await gravarDispensa(tx, referencia, null);
        }
        return;
      }

      if (situacao === "dispensada") {
        return;
      }
      if (situacao === "lancado" || situacao === "pago") {
        throw new RecusaDaAgenda(
          cobranca.numeroDaVenda !== null ? fraseJaLancado(cobranca.numeroDaVenda) : FRASE_COBRANCA_SUMIU,
        );
      }
      if (cobranca.tipo === "inscricao" && cobranca.dataCancelada) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      if (cobranca.valorCentavos <= 0 || !podeDispensar({ tipo: cobranca.tipo, situacao })) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }
      await gravarDispensa(tx, referencia, { em: new Date(), por: usuario.id, motivo: dados.motivo });
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao ${dados.dispensada ? "dispensar" : "desfazer a dispensa de"} uma cobrança (SQLSTATE: ${
        codigoDoErroPostgres(erro) ?? "desconhecido"
      }):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_DISPENSAR };
  }

  revalidarTelasDaAgenda({ publico: false });
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: { dispensada: dados.dispensada } };
}

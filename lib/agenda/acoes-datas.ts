"use server";

// Ações da Agenda — as DATAS: presença e direito a repor, aula avulsa, dia fechado, cancelar data,
// tirar bloqueio, colocar alguém e tirar da lista (D-24/P10, plano 06.5-27 — saíram de `acoes.ts`,
// que agora é o índice).

import { and, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { clientes, eventos, inscricoes, turmaAlunos } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { FRASE_CLIENTE_NAO_EXISTE } from "@/lib/clientes/textos";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";

import {
  creditosDoCliente,
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
  esquemaDefinirDireitoARepor,
  esquemaDefinirPresenca,
  esquemaFecharDia,
  esquemaLancarAvulsa,
  esquemaTirarBloqueio,
  esquemaTirarDaLista,
  type ModoDeColocar,
} from "./esquemas";
import {
  contarPerdasAoCancelar,
  eventoDaInscricao,
  RecusaDaAgenda,
  temPerdas,
  travarCliente,
  travarEvento,
  travarEventoParaLeitura,
  travarInscricao,
  travarInscricaoComVenda,
  type PerdasAoCancelar,
} from "./gravacao";
import { planejarPresenca, type PresencaPlanejada } from "./presenca";
import { chaveDoEnvio, umaVezPorEnvio } from "./envios";
import type { TipoInscricao } from "./tipos";
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
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_AO_TIRAR_BLOQUEIO,
  FRASE_FALHA_AO_TIRAR_DA_LISTA,
  FRASE_ALUNO_SAI_PELA_FICHA,
  FRASE_OFICINA_SO_EM_AULA_AVULSA,
  FRASE_FECHADO_NAO_SE_CANCELA,
  FRASE_JA_REMOVIDO,
  FRASE_FALHA_PRESENCA_GENERICA,
  FRASE_LANCAMENTO_NAO_EXISTE,
  fraseInscricaoJaVirouVenda,
  fraseJaEstaNaLista,
} from "./textos";

import {
  errosPorCampo,
  primeiraMensagemDeErro,
  type ResultadoDeAcao,
  type ResultadoDoLancamento,
} from "./acoes-comum";
import { revalidarTelasDaAgenda } from "./acoes-servidor";

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

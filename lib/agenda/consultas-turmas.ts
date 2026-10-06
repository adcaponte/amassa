// Leituras da Agenda — as TURMAS: a turma aberta na folha, as perdas ao desativar, as datas do mês e
// as turmas de cada pessoa (D-24/P10, plano 06.5-27 — saíram de `consultas.ts`, que agora é o índice).
// Sem diretiva, como o antigo `consultas.ts`: leituras chamadas só por Server Components e pelas
// ações, depois de `exigirUsuario()` (ver o comentário de topo do índice `consultas.ts`).

import {
  and,
  asc,
  count,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  documentos,
  eventos,
  inscricoes,
  mensalidades,
  turmaAlunos,
  turmas,
} from "@/db/schema";
import type { TurmaDaSubLinha } from "@/lib/clientes/lista";
import { ultimoDiaDoMes } from "@/lib/financeiro/calendario";

import {
  contarPerdasAoDesativar,
  type PerdasAoDesativar,
  type TransacaoDoBanco,
} from "./gravacao";
import { NOMES_CURTOS_DOS_DIAS, ORDEM_DOS_DIAS_NA_TELA } from "./turma";

import { hhmm, type LeitorDeConsulta } from "./consultas-comum";
import { saldosDeReposicao } from "./consultas-pessoas";

export type { PerdasAoDesativar };

// O que a confirmação de "Desativar turma" mostra antes (a regra de exclusão do projeto).
export async function perdasAoDesativar(turmaId: string, hoje: string): Promise<PerdasAoDesativar> {
  return contarPerdasAoDesativar(db, turmaId, hoje);
}

// `aRepor`: as aulas a repor do aluno agora (0 sem nenhuma) — a tag "{n} a repor" da folha da turma.
export type AlunoDaTurma = { clienteId: string; nome: string; aRepor: number };

// A turma aberta na folha (`?turma={id}`, D-03).
export type TurmaCarregada = {
  id: string;
  nome: string;
  diaSemana: number;
  inicio: string;
  fim: string;
  vagas: number;
  mensalidadeCentavos: number;
  diaVencimento: number;
  publica: boolean;
  ativa: boolean;
  // "dd/mm" lido como data civil de Brasília — só na turma desativada.
  desativadaEm: string | null;
  // A última data marcada (passada ou futura) e quantas datas NÃO canceladas vêm depois de hoje.
  ultimaData: string | null;
  datasFuturas: number;
  // Os alunos ativos (`turma_alunos` sem `saiu_em`), em ordem de nome.
  alunos: AlunoDaTurma[];
  perdasAoDesativar: PerdasAoDesativar;
};

const ORDEM_DOS_NOMES = new Intl.Collator("pt-BR", { sensitivity: "base" });

// A turma da folha, com o que ela mostra — `null` se não existe (link velho). "Daqui para frente" é
// `data > hoje`, a mesma régua de editar e desativar (Assumption A9).
export async function obterTurma(id: string, hoje: string): Promise<TurmaCarregada | null> {
  const [turma] = await db
    .select({
      id: turmas.id,
      nome: turmas.nome,
      diaSemana: turmas.diaSemana,
      inicio: turmas.inicio,
      fim: turmas.fim,
      vagas: turmas.vagas,
      mensalidadeCentavos: turmas.mensalidadeCentavos,
      diaVencimento: turmas.diaVencimento,
      publica: turmas.publica,
      ativa: turmas.ativa,
      desativadaEm: sql<string | null>`to_char(${turmas.desativadaEm} at time zone 'America/Sao_Paulo', 'DD/MM')`,
    })
    .from(turmas)
    .where(eq(turmas.id, id));
  if (!turma) {
    return null;
  }

  const [[ultima], [futuras], alunos, perdas] = await Promise.all([
    db.select({ data: max(eventos.data) }).from(eventos).where(eq(eventos.turmaId, id)),
    db
      .select({ total: count() })
      .from(eventos)
      .where(and(eq(eventos.turmaId, id), gt(eventos.data, hoje), isNull(eventos.canceladoEm))),
    db
      .select({ clienteId: turmaAlunos.clienteId, nome: clientes.nome })
      .from(turmaAlunos)
      .innerJoin(clientes, eq(clientes.id, turmaAlunos.clienteId))
      .where(and(eq(turmaAlunos.turmaId, id), isNull(turmaAlunos.saiuEm))),
    perdasAoDesativar(id, hoje),
  ]);
  const saldos = await saldosDeReposicao(alunos.map((aluno) => aluno.clienteId));

  return {
    ...turma,
    inicio: hhmm(turma.inicio) ?? turma.inicio,
    fim: hhmm(turma.fim) ?? turma.fim,
    ultimaData: ultima?.data ?? null,
    datasFuturas: Number(futuras?.total ?? 0),
    alunos: [...alunos]
      .sort((a, b) => ORDEM_DOS_NOMES.compare(a.nome, b.nome))
      .map((aluno) => ({ ...aluno, aRepor: saldos[aluno.clienteId] ?? 0 })),
    perdasAoDesativar: perdas,
  };
}

// As datas NÃO canceladas da turma no mês `mes` ("AAAA-MM"), em ordem — o que o proporcional da
// entrada divide (AGE-07, Assumption A7). Chamada pela ação "entrar na turma" DENTRO da transação,
// sob a trava da turma (o leitor é a transação); o plano 08 a usa para o valor da aula (D-07).
export async function datasDaTurmaNoMes(leitor: LeitorDeConsulta, turmaId: string, mes: string): Promise<string[]> {
  const linhas = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({ data: eventos.data })
    .from(eventos)
    .where(
      and(
        eq(eventos.turmaId, turmaId),
        isNull(eventos.canceladoEm),
        gte(eventos.data, `${mes}-01`),
        lte(eventos.data, `${mes}-${String(ultimoDiaDoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)))).padStart(2, "0")}`),
      ),
    )
    .orderBy(asc(eventos.data));
  return linhas.map((linha) => linha.data);
}

// Uma turma ATIVA na ficha da pessoa ("Turmas fixas" — 05-UI-SPEC.md §"Ficha da pessoa — linhas de
// leitura"), com o que a caixa e a confirmação de sair precisam saber desta pessoa.
export type TurmaDaPessoa = {
  id: string;
  nome: string;
  diaSemana: number;
  inicio: string;
  mensalidadeCentavos: number;
  diaVencimento: number;
  // A pessoa é aluna ativa desta turma (`turma_alunos` sem `saiu_em`): a caixa vem marcada.
  marcada: boolean;
  // As aulas de que ela sai se sair hoje: inscrições `aluno` sem presença em datas NÃO canceladas
  // depois de hoje.
  aulasFuturas: number;
  // A mensalidade do mês corrente desta turma existe e continua em "A receber" (sem dispensa e sem
  // venda ativa) — a confirmação de sair só fala dela nesse caso.
  mensalidadeDoMesAReceber: boolean;
};

function ordemDoDiaNaTela(dia: number): number {
  return (ORDEM_DOS_DIAS_NA_TELA as readonly number[]).indexOf(dia);
}

// Segunda → domingo, depois o horário, depois o nome.
function compararTurmas(
  a: { diaSemana: number; inicio: string; nome: string },
  b: { diaSemana: number; inicio: string; nome: string },
): number {
  return (
    ordemDoDiaNaTela(a.diaSemana) - ordemDoDiaNaTela(b.diaSemana) ||
    (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0) ||
    ORDEM_DOS_NOMES.compare(a.nome, b.nome)
  );
}

// Todas as turmas ATIVAS do sistema (turma desativada não aparece — UI E13·partial), com a caixa de
// cada uma marcada quando a pessoa é aluna dela.
export async function turmasDaPessoa(clienteId: string, hoje: string): Promise<TurmaDaPessoa[]> {
  const mes = `${hoje.slice(0, 7)}-01`;
  const [ativas, vinculos, futuras, aReceber] = await Promise.all([
    db
      .select({
        id: turmas.id,
        nome: turmas.nome,
        diaSemana: turmas.diaSemana,
        inicio: turmas.inicio,
        mensalidadeCentavos: turmas.mensalidadeCentavos,
        diaVencimento: turmas.diaVencimento,
      })
      .from(turmas)
      .where(eq(turmas.ativa, true)),
    db
      .select({ turmaId: turmaAlunos.turmaId })
      .from(turmaAlunos)
      .where(and(eq(turmaAlunos.clienteId, clienteId), isNull(turmaAlunos.saiuEm))),
    db
      .select({ turmaId: eventos.turmaId, total: count() })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .where(
        and(
          eq(inscricoes.clienteId, clienteId),
          eq(inscricoes.tipo, "aluno"),
          isNull(inscricoes.presenca),
          gt(eventos.data, hoje),
          isNull(eventos.canceladoEm),
        ),
      )
      .groupBy(eventos.turmaId),
    db
      .select({ turmaId: mensalidades.turmaId })
      .from(mensalidades)
      .leftJoin(documentos, eq(documentos.id, mensalidades.documentoId))
      .where(
        and(
          eq(mensalidades.clienteId, clienteId),
          eq(mensalidades.mes, mes),
          isNull(mensalidades.dispensadaEm),
          or(isNull(mensalidades.documentoId), isNotNull(documentos.canceladoEm)),
        ),
      ),
  ]);

  const marcadas = new Set(vinculos.map((linha) => linha.turmaId));
  const aulasPorTurma = new Map(futuras.map((linha) => [linha.turmaId, Number(linha.total)] as const));
  const comMensalidade = new Set(aReceber.map((linha) => linha.turmaId));

  return ativas
    .map((turma) => ({
      ...turma,
      inicio: hhmm(turma.inicio) ?? turma.inicio,
      marcada: marcadas.has(turma.id),
      aulasFuturas: aulasPorTurma.get(turma.id) ?? 0,
      mensalidadeDoMesAReceber: comMensalidade.has(turma.id),
    }))
    .sort(compararTurmas);
}

// As turmas ATIVAS de cada pessoa da lista, para a sub-linha "{turma} ({dia abreviado})" (05-UI-SPEC.md
// §"Aba Pessoas"; `subLinhaDaPessoa`). Uma consulta só para a página inteira; quem não tem turma não
// aparece no objeto.
export async function turmasPorCliente(clienteIds: readonly string[]): Promise<Record<string, TurmaDaSubLinha[]>> {
  if (clienteIds.length === 0) {
    return {};
  }
  const linhas = await db
    .select({
      clienteId: turmaAlunos.clienteId,
      nome: turmas.nome,
      diaSemana: turmas.diaSemana,
      inicio: turmas.inicio,
    })
    .from(turmaAlunos)
    .innerJoin(turmas, eq(turmas.id, turmaAlunos.turmaId))
    .where(and(inArray(turmaAlunos.clienteId, [...clienteIds]), isNull(turmaAlunos.saiuEm), eq(turmas.ativa, true)));

  const porCliente: Record<string, { nome: string; diaSemana: number; inicio: string }[]> = {};
  for (const linha of linhas) {
    (porCliente[linha.clienteId] ??= []).push(linha);
  }
  const resultado: Record<string, TurmaDaSubLinha[]> = {};
  for (const [clienteId, turmasDoCliente] of Object.entries(porCliente)) {
    resultado[clienteId] = [...turmasDoCliente]
      .sort(compararTurmas)
      .map((turma) => ({ nome: turma.nome, dia: NOMES_CURTOS_DOS_DIAS[turma.diaSemana] }));
  }
  return resultado;
}

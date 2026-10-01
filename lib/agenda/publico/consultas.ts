// A ÚNICA leitura de banco que o site público alcança (AGE-18, SIT-02). É a exceção nomeada da cerca
// `tests/unit/site-isolamento.test.ts`: o grafo de `app/page.tsx` pode chegar a `@/db` só através
// deste arquivo. Por isso ele é pequeno e tem três regras que não se dobram:
//
// 1. SEM a diretiva de Server Action, sem `next/headers`, sem sessão — quem chama é o Server
//    Component da raiz (ISR) e a aba "No site" da gestão; nenhum navegador chama isto.
// 2. Só seleciona o que o visitante pode ver: tipo, data, horário, título, vagas, preço, os dados de
//    horário e mensalidade da turma, CONTAGENS (inscritos por data, alunos ativos por turma) e as
//    DATAS dos dias fechados. Nunca a tabela de pessoas, nunca contato, presença, uso livre, nem o
//    título de um dia fechado (que é o motivo dele). A defesa é não selecionar (T-05-69).
// 3. Nenhum parâmetro vem do visitante: só o "hoje" calculado no servidor (T-05-72).
import { and, count, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { eventos, inscricoes, turmaAlunos, turmas } from "@/db/schema";

import { minutosDe, horaDe } from "../horario";
import { fimDaJanela, type DadosDaAgendaPublica } from "./agenda";

function horaCurta(hora: string | null): string {
  return horaDe(minutosDe(hora ?? "00:00"));
}

export async function lerAgendaPublica(hoje: string): Promise<DadosDaAgendaPublica> {
  const fim = fimDaJanela(hoje);

  const contagem = db
    .select({ eventoId: inscricoes.eventoId, inscritos: count().as("inscritos") })
    .from(inscricoes)
    .groupBy(inscricoes.eventoId)
    .as("contagem_publica");

  const ativos = db
    .select({ turmaId: turmaAlunos.turmaId, alunos: count().as("alunos") })
    .from(turmaAlunos)
    .where(isNull(turmaAlunos.saiuEm))
    .groupBy(turmaAlunos.turmaId)
    .as("ativos_publicos");

  const [linhasDeEventos, linhasDeTurmas, linhasFechadas] = await Promise.all([
    db
      .select({
        tipo: eventos.tipo,
        data: eventos.data,
        inicio: eventos.inicio,
        fim: eventos.fim,
        titulo: eventos.titulo,
        vagas: eventos.vagas,
        precoCentavos: eventos.precoCentavos,
        turmaId: eventos.turmaId,
        inscritos: contagem.inscritos,
      })
      .from(eventos)
      .leftJoin(contagem, eq(contagem.eventoId, eventos.id))
      .where(
        and(
          eq(eventos.publico, true),
          isNull(eventos.canceladoEm),
          inArray(eventos.tipo, ["turma", "avulsa"]),
          gte(eventos.data, hoje),
          lte(eventos.data, fim),
        ),
      ),
    db
      .select({
        id: turmas.id,
        nome: turmas.nome,
        diaSemana: turmas.diaSemana,
        inicio: turmas.inicio,
        fim: turmas.fim,
        vagas: turmas.vagas,
        mensalidadeCentavos: turmas.mensalidadeCentavos,
        alunos: ativos.alunos,
      })
      .from(turmas)
      .leftJoin(ativos, eq(ativos.turmaId, turmas.id))
      .where(eq(turmas.ativa, true)),
    // Só a DATA — o título do dia fechado é o motivo e não sai daqui.
    db
      .selectDistinct({ data: eventos.data })
      .from(eventos)
      .where(and(sql`${eventos.tipo} = 'fechado'`, gte(eventos.data, hoje), lte(eventos.data, fim))),
  ]);

  return {
    eventos: linhasDeEventos.map((linha) => ({
      tipo: linha.tipo === "turma" ? "turma" : "avulsa",
      data: linha.data,
      inicio: horaCurta(linha.inicio),
      fim: horaCurta(linha.fim),
      titulo: linha.titulo,
      vagas: linha.vagas ?? 0,
      precoCentavos: linha.precoCentavos,
      turmaId: linha.turmaId,
      publico: true,
      cancelado: false,
      inscritos: Number(linha.inscritos ?? 0),
    })),
    turmas: linhasDeTurmas.map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      diaSemana: linha.diaSemana,
      inicio: horaCurta(linha.inicio),
      fim: horaCurta(linha.fim),
      vagas: linha.vagas,
      mensalidadeCentavos: linha.mensalidadeCentavos,
      ativa: true,
      alunosAtivos: Number(linha.alunos ?? 0),
    })),
    fechados: linhasFechadas.map((linha) => linha.data),
  };
}

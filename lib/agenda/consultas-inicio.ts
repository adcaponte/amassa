// Leituras da Agenda — o INÍCIO e os NÚMEROS: a agenda de hoje do Início e os dados da aba Números
// (D-24/P10, plano 06.5-27 — saíram de `consultas.ts`, que agora é o índice).
// Sem diretiva, como o antigo `consultas.ts`: leituras chamadas só por Server Components e pelas
// ações, depois de `exigirUsuario()` (ver o comentário de topo do índice `consultas.ts`).

import { and, asc, count, eq, gte, isNotNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { eventos, inscricoes, turmas, usosLivres } from "@/db/schema";

import { pessoasAgoraNoEspaco, presencaPendenteAgora } from "./espaco";
import { horaDe, minutosDe } from "./horario";
import { mesDaData } from "./mensalidade";
import { garantirMensalidadesDoMesNaRequisicao } from "./mensalidades-da-requisicao";
import type { DadosDosNumeros } from "./numeros";
import { ordenarNoDia, segundaDaSemana } from "./semana";
import type { EstadoUsoLivre } from "./tipos";

import { creditosPorCliente } from "./consultas-pessoas";
import { usoLivreDaSemana, usosLivresEntre } from "./consultas-uso-livre";

// ——— O bloco “Agenda de hoje” do Início (D-05, D-18, GES-09; plano 14) ———

// Até 6 linhas no Início (UI-D19); o resto vira “e mais {N}”.
export const LINHAS_DA_AGENDA_DE_HOJE = 6;

// Uma linha do dia no Início. A folha que ela abre: `?evento=` (turma, avulsa, fechado) ou `?uso=`.
export type LinhaDeHoje =
  | {
      tipo: "turma" | "avulsa";
      id: string;
      data: string;
      inicio: string;
      fim: string;
      // A turma: o nome dela; a avulsa: o título.
      titulo: string;
      vagas: number;
      inscritos: number;
      cancelado: boolean;
      // Já passou do início, a data não foi cancelada e alguém está sem marcação.
      marcarPresenca: boolean;
    }
  | { tipo: "fechado"; id: string; data: string; inicio: null; fim: null; titulo: string }
  | {
      tipo: "uso_livre";
      id: string;
      data: string;
      inicio: string;
      fim: string;
      // O nome da pessoa.
      titulo: string;
      pessoas: number;
      estado: EstadoUsoLivre;
    };

export type AgendaDeHoje = {
  // A segunda da semana de hoje — o `?semana=` dos links.
  segunda: string;
  // Fechado primeiro, depois por início (`ordenarNoDia`), até `LINHAS_DA_AGENDA_DE_HOJE`.
  linhas: LinhaDeHoje[];
  // Quantas ficaram de fora (o “e mais {N}”).
  restantes: number;
  // “Agora no espaço” (D-05, D-18): contagem, sem fração.
  agoraNoEspaco: number;
};

// O que acontece hoje no ateliê, para o Início. D-02 lista o Início entre as telas que fazem nascer a
// mensalidade do mês: a escrita idempotente vem ANTES de ler (a página já chamou `exigirUsuario()`). As
// regras são dos puros — `pessoasAgoraNoEspaco`/`presencaPendenteAgora` (`espaco.ts`) e `ordenarNoDia`
// (`semana.ts`); aqui só se lê e se monta.
export async function agendaDeHoje(hoje: string, agora: { data: string; minutos: number }): Promise<AgendaDeHoje> {
  await garantirMensalidadesDoMesNaRequisicao(mesDaData(hoje));
  const usos = usosLivresEntre(hoje, hoje);
  const contagem = db
    .select({
      eventoId: inscricoes.eventoId,
      inscritos: count().as("inscritos"),
      semMarcacao: sql<number>`count(*) filter (where ${inscricoes.presenca} is null)`.as("sem_marcacao"),
      faltaram: sql<number>`count(*) filter (where ${inscricoes.presenca} = 'faltou')`.as("faltaram"),
    })
    .from(inscricoes)
    .groupBy(inscricoes.eventoId)
    .as("contagem");
  const linhasDoBanco = await db
    .select({
      id: eventos.id,
      tipo: eventos.tipo,
      data: eventos.data,
      inicio: eventos.inicio,
      fim: eventos.fim,
      titulo: eventos.titulo,
      nomeDaTurma: turmas.nome,
      vagas: eventos.vagas,
      inscritos: contagem.inscritos,
      semMarcacao: contagem.semMarcacao,
      faltaram: contagem.faltaram,
      canceladoEm: eventos.canceladoEm,
    })
    .from(eventos)
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .leftJoin(contagem, eq(contagem.eventoId, eventos.id))
    .where(eq(eventos.data, hoje))
    .orderBy(asc(eventos.criadoEm), asc(eventos.id));
  const usosDeHoje = await usos;

  const dosEventos: LinhaDeHoje[] = linhasDoBanco.map((linha) => {
    if (linha.tipo === "fechado" || linha.inicio === null || linha.fim === null) {
      return { tipo: "fechado", id: linha.id, data: linha.data, inicio: null, fim: null, titulo: linha.titulo ?? "" };
    }
    const cancelado = linha.canceladoEm !== null;
    return {
      tipo: linha.tipo,
      id: linha.id,
      data: linha.data,
      inicio: horaDe(minutosDe(linha.inicio)),
      fim: horaDe(minutosDe(linha.fim)),
      titulo: linha.nomeDaTurma ?? linha.titulo ?? "",
      vagas: linha.vagas ?? 0,
      inscritos: Number(linha.inscritos ?? 0),
      cancelado,
      marcarPresenca: presencaPendenteAgora(
        { inicio: linha.inicio, cancelada: cancelado, semMarcacao: Number(linha.semMarcacao ?? 0) },
        agora.minutos,
      ),
    };
  });
  const dosUsos: LinhaDeHoje[] = usosDeHoje.map((uso) => {
    const naSemana = usoLivreDaSemana(uso, hoje);
    return {
      tipo: "uso_livre",
      id: uso.id,
      data: uso.data,
      inicio: naSemana.inicio,
      fim: naSemana.fim,
      titulo: uso.nome,
      pessoas: uso.pessoas,
      estado: uso.estado,
    };
  });

  const agoraNoEspaco = pessoasAgoraNoEspaco({
    usosLivres: usosDeHoje,
    aulas: linhasDoBanco.flatMap((linha) =>
      linha.tipo === "fechado" || linha.inicio === null || linha.fim === null
        ? []
        : [
            {
              data: linha.data,
              inicio: linha.inicio,
              fim: linha.fim,
              cancelada: linha.canceladoEm !== null,
              inscritos: Number(linha.inscritos ?? 0),
              faltaram: Number(linha.faltaram ?? 0),
            },
          ],
    ),
    agora: { data: hoje, minutos: agora.minutos },
  });

  const ordenadas = ordenarNoDia([...dosEventos, ...dosUsos]);
  return {
    segunda: segundaDaSemana(hoje),
    linhas: ordenadas.slice(0, LINHAS_DA_AGENDA_DE_HOJE),
    restantes: Math.max(0, ordenadas.length - LINHAS_DA_AGENDA_DE_HOJE),
    agoraNoEspaco,
  };
}

// ——— A aba Números (AGE-19; plano 14) ———

// As linhas que o puro `numerosDoMes` lê, do dia 1 do mês até hoje (o recorte final, e a conta toda, são
// dele). Uma consulta por indicador: os usos livres do período; as inscrições COM marcação em datas do
// período, com o horário da data; e o saldo de reposição de hoje de quem tem os dois lados da conta
// (`creditosPorCliente` — o saldo não tem mês). Só leitura; a página já chamou `exigirUsuario()`.
export async function dadosDosNumeros(mes: string, hoje: string): Promise<DadosDosNumeros> {
  const primeiro = `${mes}-01`;
  const [usos, marcadas, comCredito] = await Promise.all([
    db
      .select({
        data: usosLivres.data,
        clienteId: usosLivres.clienteId,
        estado: usosLivres.estado,
        pessoas: usosLivres.pessoas,
        horasCheias: usosLivres.horasCheias,
      })
      .from(usosLivres)
      .where(and(gte(usosLivres.data, primeiro), lte(usosLivres.data, hoje))),
    db
      .select({
        data: eventos.data,
        clienteId: inscricoes.clienteId,
        presenca: inscricoes.presenca,
        inicio: eventos.inicio,
        fim: eventos.fim,
        canceladoEm: eventos.canceladoEm,
      })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .where(
        and(
          gte(eventos.data, primeiro),
          lte(eventos.data, hoje),
          ne(eventos.tipo, "fechado"),
          isNotNull(inscricoes.presenca),
          isNotNull(eventos.inicio),
          isNotNull(eventos.fim),
        ),
      ),
    db
      .selectDistinct({ clienteId: inscricoes.clienteId })
      .from(inscricoes)
      .where(or(and(eq(inscricoes.presenca, "faltou"), eq(inscricoes.direitoARepor, true)), eq(inscricoes.tipo, "reposicao"))),
  ]);
  const creditos = await creditosPorCliente(comCredito.map((linha) => linha.clienteId));
  return {
    usosLivres: usos,
    inscricoes: marcadas.map((linha) => ({
      data: linha.data,
      clienteId: linha.clienteId,
      presenca: linha.presenca,
      inicio: linha.inicio ?? "00:00",
      fim: linha.fim ?? "00:00",
      cancelada: linha.canceladoEm !== null,
    })),
    saldosDeReposicao: Object.values(creditos).map((credito) => credito.saldo),
  };
}

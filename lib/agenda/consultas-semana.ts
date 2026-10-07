// Leituras da Agenda — a SEMANA, o MÊS e a FOLHA DO EVENTO: a grade da semana, os dias fechados, o
// evento aberto com os inscritos, o dia para lançar e os lançamentos do mês (D-24/P10, plano 06.5-27 —
// saíram de `consultas.ts`, que agora é o índice).
// Sem diretiva, como o antigo `consultas.ts`: leituras chamadas só por Server Components e pelas
// ações, depois de `exigirUsuario()` (ver o comentário de topo do índice `consultas.ts`).

import { and, asc, count, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  documentos,
  eventos,
  inscricoes,
  turmas,
  usosLivres,
} from "@/db/schema";
import { somarDias } from "@/lib/producao/calendario";

import {
  contarPerdasAoCancelar,
  type PerdasAoCancelar,
  type VendaDaInscricao,
} from "./gravacao";
import { minutosDe } from "./horario";
import { mesDaData, valorDaAula } from "./mensalidade";
import { ordenarInscritos, precisaMarcarPresenca } from "./presenca";
import { gradeDoMes, type TipoDoPonto } from "./semana";
import type { Presenca, TipoEvento, TipoInscricao } from "./tipos";
import type { FechadoDoDia } from "./turma";

import { hhmm } from "./consultas-comum";
import { saldosDeReposicao } from "./consultas-pessoas";
import { datasDaTurmaNoMes } from "./consultas-turmas";
import {
  usoLivreDaSemana,
  type UsoLivreDaSemana,
  usosLivresEntre,
} from "./consultas-uso-livre";
import {
  aReceberPorEvento,
  saiDeAReceberAoCancelar,
  situacaoDaMensalidadeDoMes,
  type SituacaoDePagamento,
  situacoesDasInscricoes,
  situacoesDosUsos,
} from "./consultas-receber";

// Um cartão da semana.
export type EventoDaSemana = {
  id: string;
  tipo: TipoEvento;
  data: string;
  inicio: string | null;
  fim: string | null;
  // Turma: o nome da turma; avulsa: o título; fechado: o motivo.
  titulo: string;
  vagas: number | null;
  inscritos: number;
  cancelado: boolean;
  // A turma da data (só no tipo `turma`) — o "Abrir a turma" da folha (D-03).
  turmaId: string | null;
  // Data de turma num dia fechado (D-13): o motivo do fechado — a tag "dia fechado" do cartão e a
  // caixa do topo da folha. `null` fora do tipo `turma` ou quando o dia está aberto.
  diaFechadoMotivo: string | null;
  // AGE-08: data anterior a hoje, não cancelada, com alguém sem marcação — a tag "marcar presença" do
  // cartão e do sub-título da folha (`precisaMarcarPresenca`).
  marcarPresenca: boolean;
  // (Plano 13) Quantas inscrições cobradas desta data estão em “A receber” — a tag “{n} a receber” do
  // cartão (0 = sem tag; data cancelada = 0, porque ela sai de “A receber”).
  aReceber: number;
};

// O motivo do fechado de cada dia (o primeiro lançado, se houver mais de um), entre os eventos lidos.
function motivosDosFechados(linhas: readonly { tipo: TipoEvento; data: string; titulo: string | null }[]): Map<string, string> {
  const motivos = new Map<string, string>();
  for (const linha of linhas) {
    if (linha.tipo === "fechado" && !motivos.has(linha.data)) {
      motivos.set(linha.data, linha.titulo ?? "");
    }
  }
  return motivos;
}

// O que ocupa a semana: os eventos e os usos livres, juntos na ordem do módulo puro.
export type ItemDaSemana = EventoDaSemana | UsoLivreDaSemana;

// Os eventos E os usos livres da semana que começa em `segunda` (segunda a domingo), com a contagem de
// inscritos — a ordem do dia é do módulo puro (`agruparPorDia`), não do banco.
export async function lerSemana(segunda: string, hoje: string): Promise<ItemDaSemana[]> {
  const domingo = somarDias(segunda, 6);
  const usos = usosLivresEntre(segunda, domingo);
  const contagem = db
    .select({
      eventoId: inscricoes.eventoId,
      inscritos: count().as("inscritos"),
      semMarcacao: sql<number>`count(*) filter (where ${inscricoes.presenca} is null)`.as("sem_marcacao"),
    })
    .from(inscricoes)
    .groupBy(inscricoes.eventoId)
    .as("contagem");

  const linhas = await db
    .select({
      id: eventos.id,
      tipo: eventos.tipo,
      data: eventos.data,
      inicio: eventos.inicio,
      fim: eventos.fim,
      titulo: eventos.titulo,
      nomeDaTurma: turmas.nome,
      turmaId: eventos.turmaId,
      vagas: eventos.vagas,
      inscritos: contagem.inscritos,
      semMarcacao: contagem.semMarcacao,
      canceladoEm: eventos.canceladoEm,
    })
    .from(eventos)
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .leftJoin(contagem, eq(contagem.eventoId, eventos.id))
    .where(and(gte(eventos.data, segunda), lte(eventos.data, domingo)))
    .orderBy(asc(eventos.data), asc(eventos.criadoEm), asc(eventos.id));

  const motivos = motivosDosFechados(linhas);
  const usosDaSemana = await usos;
  // As tags de pagamento do cartão (plano 13): “{n} a receber” das datas de pé e a situação dos usos
  // encerrados — as duas pela MESMA derivação de “A receber” (`situacaoDaCobranca`).
  const [aReceberDasDatas, pagamentoDosUsos] = await Promise.all([
    aReceberPorEvento(linhas.filter((linha) => linha.tipo !== "fechado" && linha.canceladoEm === null).map((linha) => linha.id)),
    situacoesDosUsos(usosDaSemana.filter((uso) => uso.estado === "encerrado").map((uso) => uso.id)),
  ]);
  const doEspaco = usosDaSemana.map((uso) => ({
    ...usoLivreDaSemana(uso, hoje),
    pagamento: pagamentoDosUsos[uso.id] ?? null,
  }));
  const dosEventos: EventoDaSemana[] = linhas.map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    data: linha.data,
    inicio: hhmm(linha.inicio),
    fim: hhmm(linha.fim),
    titulo: linha.nomeDaTurma ?? linha.titulo ?? "",
    vagas: linha.vagas,
    inscritos: Number(linha.inscritos ?? 0),
    cancelado: linha.canceladoEm !== null,
    turmaId: linha.turmaId,
    diaFechadoMotivo: linha.tipo === "turma" ? (motivos.get(linha.data) ?? null) : null,
    marcarPresenca: pedePresenca(linha, Number(linha.inscritos ?? 0), Number(linha.semMarcacao ?? 0), hoje),
    aReceber: aReceberDasDatas[linha.id] ?? 0,
  }));
  return [...dosEventos, ...doEspaco];
}

// A regra é do módulo puro; aqui só se monta, a partir das duas contagens, a lista que ela lê.
function pedePresenca(
  evento: { tipo: TipoEvento; data: string; canceladoEm: Date | null },
  inscritos: number,
  semMarcacao: number,
  hoje: string,
): boolean {
  if (evento.tipo === "fechado") {
    return false;
  }
  const lista = Array.from({ length: inscritos }, (_, indice) => ({
    presenca: indice < semMarcacao ? null : ("veio" as const),
  }));
  return precisaMarcarPresenca({ data: evento.data, cancelada: evento.canceladoEm !== null, inscritos: lista }, hoje);
}

// Os dias fechados entre `de` e `ate` (inclusive), na ordem do calendário — o aviso D-13 da turma e
// o toast de "Lançar turma". Um dia com dois fechados aparece duas vezes; o puro
// `datasEmDiaFechado` fica com o primeiro.
export async function fechadosEntre(de: string, ate: string): Promise<FechadoDoDia[]> {
  const linhas = await db
    .select({ data: eventos.data, motivo: eventos.titulo })
    .from(eventos)
    .where(and(eq(eventos.tipo, "fechado"), gte(eventos.data, de), lte(eventos.data, ate)))
    .orderBy(asc(eventos.data), asc(eventos.criadoEm), asc(eventos.id));
  return linhas.map((linha) => ({ data: linha.data, motivo: linha.motivo ?? "" }));
}

export type InscritoCarregado = {
  id: string;
  clienteId: string;
  nome: string;
  tipo: TipoInscricao;
  presenca: Presenca | null;
  direitoARepor: boolean;
  // A cobrança desta inscrição: oficina sempre cobra, com o valor copiado do evento ao colocar.
  cobrar: boolean;
  valorCentavos: number | null;
  // A venda ligada (D-08): ativa, a linha troca o "tirar da lista" pela frase da UI-D14.
  venda: VendaDaInscricao | null;
  // As aulas a repor da PESSOA agora (o saldo derivado, AGE-09) — a confirmação de tirar uma reposição
  // diz com quantas ela fica.
  aRepor: number;
  // (Plano 13) A situação do pagamento que a linha mostra (05-UI-SPEC.md §“Folha do evento”, Pessoa —
  // tags): aluno → a da mensalidade do mês da data; oficina e experimental cobrada → a da inscrição;
  // experimental gratuita e reposição → nula (a gratuita tem a tag própria; reposição não paga de novo).
  // Nula também quando não há cobrança (mensalidade ainda não nascida, valor zero) ou, numa data
  // cancelada, quando ela saiu de “A receber”.
  pagamento: SituacaoDePagamento | null;
};

export type { VendaDaInscricao };

// A venda de uma inscrição como a folha a lê: o número e se o Caixa a cancelou — `null` sem venda.
export function vendaDaInscricao(numero: number | null, canceladoEm: Date | null): VendaDaInscricao | null {
  return numero === null ? null : { numero, cancelada: canceladoEm !== null };
}

export type EventoCarregado = EventoDaSemana & {
  precoCentavos: number | null;
  publico: boolean;
  inscricoes: InscritoCarregado[];
  // O que "Cancelar esta data" perderia agora — decide se a folha pede confirmação (UI-D13). O
  // servidor confere de novo sob a trava ao cancelar.
  perdasAoCancelar: PerdasAoCancelar;
  // Data de turma: o valor sugerido de uma aula experimental cobrada (D-07) — calculado AQUI, no
  // servidor, pelo módulo puro. `null` fora da turma ou quando não há aula no mês para dividir.
  sugestaoDaAula: SugestaoDaAula | null;
};

// "sugestão: mensalidade de {R$} ÷ {n} aulas em {mês}" — a mensalidade de AGORA da turma dividida pelas
// aulas NÃO canceladas dela no mês da data, arredondada ao centavo (`valorDaAula`).
export type SugestaoDaAula = {
  valorCentavos: number;
  mensalidadeCentavos: number;
  aulas: number;
  // "AAAA-MM" — o mês da data.
  mes: string;
};

export type { PerdasAoCancelar };

export async function perdasAoCancelar(eventoId: string): Promise<PerdasAoCancelar> {
  return contarPerdasAoCancelar(db, eventoId);
}

// O evento aberto na folha (`?evento={id}`), com os inscritos na ordem da folha — `null` se ele
// não existe (link velho, removido em outro celular).
export async function obterEvento(id: string, hoje: string): Promise<EventoCarregado | null> {
  const [evento] = await db
    .select({
      id: eventos.id,
      tipo: eventos.tipo,
      data: eventos.data,
      inicio: eventos.inicio,
      fim: eventos.fim,
      titulo: eventos.titulo,
      nomeDaTurma: turmas.nome,
      turmaId: eventos.turmaId,
      vagas: eventos.vagas,
      precoCentavos: eventos.precoCentavos,
      publico: eventos.publico,
      canceladoEm: eventos.canceladoEm,
      mensalidadeCentavos: turmas.mensalidadeCentavos,
    })
    .from(eventos)
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .where(eq(eventos.id, id));
  if (!evento) {
    return null;
  }

  const [linhas, perdas, fechadosDoDia, sugestaoDaAula] = await Promise.all([
    db
      .select({
        id: inscricoes.id,
        clienteId: inscricoes.clienteId,
        nome: clientes.nome,
        tipo: inscricoes.tipo,
        presenca: inscricoes.presenca,
        direitoARepor: inscricoes.direitoARepor,
        cobrar: inscricoes.cobrar,
        valorCentavos: inscricoes.valorCentavos,
        vendaNumero: documentos.numero,
        vendaCanceladaEm: documentos.canceladoEm,
      })
      .from(inscricoes)
      .innerJoin(clientes, eq(clientes.id, inscricoes.clienteId))
      .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
      .where(eq(inscricoes.eventoId, id)),
    perdasAoCancelar(id),
    evento.tipo === "turma" ? fechadosEntre(evento.data, evento.data) : Promise.resolve([]),
    evento.tipo === "turma" && evento.turmaId !== null && evento.mensalidadeCentavos !== null
      ? sugerirValorDaAula(evento.turmaId, evento.mensalidadeCentavos, mesDaData(evento.data))
      : Promise.resolve(null),
  ]);
  const [saldos, dasInscricoes, dasMensalidades] = await Promise.all([
    saldosDeReposicao(linhas.map((linha) => linha.clienteId)),
    situacoesDasInscricoes(id),
    evento.tipo === "turma" && evento.turmaId !== null
      ? situacaoDaMensalidadeDoMes(evento.turmaId, `${mesDaData(evento.data)}-01`)
      : Promise.resolve({} as Record<string, SituacaoDePagamento>),
  ]);
  const cancelado = evento.canceladoEm !== null;
  const inscritos = linhas.map(({ vendaNumero, vendaCanceladaEm, ...linha }) => {
    const pagamento =
      linha.tipo === "aluno"
        ? (dasMensalidades[linha.clienteId] ?? null)
        : linha.cobrar
          ? (dasInscricoes[linha.id] ?? null)
          : null;
    return {
      ...linha,
      venda: vendaDaInscricao(vendaNumero, vendaCanceladaEm),
      aRepor: saldos[linha.clienteId] ?? 0,
      // A inscrição de uma data cancelada sai de “A receber” (`itensAReceber`): sem tag de quem deve.
      pagamento:
        cancelado && linha.tipo !== "aluno" && pagamento !== null && saiDeAReceberAoCancelar(pagamento.situacao)
          ? null
          : pagamento,
    };
  });

  return {
    id: evento.id,
    tipo: evento.tipo,
    data: evento.data,
    inicio: hhmm(evento.inicio),
    fim: hhmm(evento.fim),
    titulo: evento.nomeDaTurma ?? evento.titulo ?? "",
    vagas: evento.vagas,
    inscritos: inscritos.length,
    cancelado: evento.canceladoEm !== null,
    turmaId: evento.turmaId,
    diaFechadoMotivo: fechadosDoDia[0]?.motivo ?? null,
    marcarPresenca:
      evento.tipo !== "fechado" &&
      precisaMarcarPresenca({ data: evento.data, cancelada: evento.canceladoEm !== null, inscritos }, hoje),
    aReceber: cancelado
      ? 0
      : inscritos.filter(
          (inscrito) =>
            inscrito.tipo !== "aluno" &&
            inscrito.pagamento !== null &&
            (inscrito.pagamento.situacao === "a_receber" || inscrito.pagamento.situacao === "venda_cancelada"),
        ).length,
    precoCentavos: evento.precoCentavos,
    publico: evento.publico,
    inscricoes: ordenarInscritos(inscritos),
    perdasAoCancelar: perdas,
    sugestaoDaAula,
  };
}

// Quantas aulas NÃO canceladas a turma tem no mês `mes` ("AAAA-MM") — o divisor do valor da aula (D-07).
export async function aulasDaTurmaNoMes(turmaId: string, mes: string): Promise<number> {
  return (await datasDaTurmaNoMes(db, turmaId, mes)).length;
}

async function sugerirValorDaAula(turmaId: string, mensalidadeCentavos: number, mes: string): Promise<SugestaoDaAula | null> {
  const aulas = await aulasDaTurmaNoMes(turmaId, mes);
  const valorCentavos = valorDaAula(mensalidadeCentavos, aulas);
  return valorCentavos === null ? null : { valorCentavos, mensalidadeCentavos, aulas, mes };
}

// O que a folha "Lançar na agenda" precisa saber do dia escolhido para o aviso da D-13 — e só isso:
// o motivo do fechado (se o dia está fechado) e quantos lançamentos NÃO cancelados, fora o próprio
// fechado, já estão nele — os eventos não cancelados E os usos livres ainda não encerrados (plano 09:
// fechar um dia que só tem uma reserva avisa "1 lançamento"). Nunca recusa nada: é aviso (D-13 —
// "avisa e não bloqueia").
export type DiaParaLancar = {
  fechadoMotivo: string | null;
  lancamentos: number;
  // Com `ate` (a turma): os dias fechados de `data` a `ate`; sem, vazio.
  fechados: FechadoDoDia[];
};

export async function lerDiaParaLancar(data: string, ate?: string): Promise<DiaParaLancar> {
  const linhas = await db
    .select({ tipo: eventos.tipo, titulo: eventos.titulo })
    .from(eventos)
    .where(and(eq(eventos.data, data), isNull(eventos.canceladoEm)))
    .orderBy(asc(eventos.criadoEm), asc(eventos.id));

  const [usos] = await db
    .select({ quantos: count() })
    .from(usosLivres)
    .where(and(eq(usosLivres.data, data), ne(usosLivres.estado, "encerrado")));

  const fechado = linhas.find((linha) => linha.tipo === "fechado");
  return {
    fechadoMotivo: fechado ? (fechado.titulo ?? "") : null,
    lancamentos: linhas.filter((linha) => linha.tipo !== "fechado").length + Number(usos?.quantos ?? 0),
    fechados: ate === undefined ? [] : await fechadosEntre(data, ate),
  };
}

// Um lançamento na grade do mês: o dia e o tipo — o resto (título, horário) não aparece na célula.
export type LancamentoDoMes = { data: string; tipo: TipoDoPonto };

// Os eventos NÃO cancelados e os usos livres (todos os estados — plano 09) entre a primeira e a última
// célula da grade do mês (as células de fora do mês também têm pontos), por dia e início (o do uso
// livre é a chegada) — cancelado não tem ponto (herdado).
export async function lerMes(mes: string): Promise<LancamentoDoMes[]> {
  const grade = gradeDoMes(mes);
  const primeiraCelula = grade[0].data;
  const ultimaCelula = grade[grade.length - 1].data;
  const [doCalendario, doEspaco] = await Promise.all([
    db
      .select({ data: eventos.data, tipo: eventos.tipo, inicio: eventos.inicio })
      .from(eventos)
      .where(
        and(gte(eventos.data, primeiraCelula), lte(eventos.data, ultimaCelula), isNull(eventos.canceladoEm)),
      )
      .orderBy(asc(eventos.data), asc(eventos.inicio), asc(eventos.id)),
    db
      .select({ data: usosLivres.data, chegadaPrevista: usosLivres.chegadaPrevista, chegada: usosLivres.chegada })
      .from(usosLivres)
      .where(and(gte(usosLivres.data, primeiraCelula), lte(usosLivres.data, ultimaCelula)))
      .orderBy(asc(usosLivres.data), asc(usosLivres.chegadaPrevista), asc(usosLivres.id)),
  ]);
  const juntos = [
    ...doCalendario.map((linha) => ({
      data: linha.data,
      tipo: linha.tipo as TipoDoPonto,
      minutos: linha.inicio === null ? -1 : minutosDe(linha.inicio),
    })),
    ...doEspaco.map((linha) => ({
      data: linha.data,
      tipo: "uso_livre" as TipoDoPonto,
      minutos: minutosDe(linha.chegada ?? linha.chegadaPrevista),
    })),
  ];
  // Por dia e início; no mesmo início, a ordem de chegada aqui (eventos antes dos usos) — sort estável.
  return juntos
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.minutos - b.minutos))
    .map(({ data, tipo }) => ({ data, tipo }));
}

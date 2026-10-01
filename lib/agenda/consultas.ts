// As leituras da Agenda (Fase 5). SEM a diretiva de Server Action (Pattern 4): são chamadas só por
// Server Components (a página), que já chamaram `exigirUsuario()` antes — uma exportação de
// arquivo com a diretiva viraria endpoint chamável pelo navegador.
//
// O `pg` devolve as colunas `time` com segundos ("19:00:00", Pitfall 9): tudo sai daqui já em
// "HH:MM", pelo módulo puro `horario.ts`.
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, max, ne, notExists, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  documentos,
  eventos,
  inscricoes,
  itensCatalogo,
  mensalidades,
  turmaAlunos,
  turmas,
  usosLivres,
  usosLivresMaterial,
  usuarios,
} from "@/db/schema";
import type { Unidade } from "@/lib/cadastros/catalogo";
import type { TurmaDaSubLinha } from "@/lib/clientes/lista";
import { listarClientes } from "@/lib/clientes/consultas";
import { ultimoDiaDoMes } from "@/lib/financeiro/calendario";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { formatarDiaMes, somarDias } from "@/lib/producao/calendario";

import {
  contarPerdasAoCancelar,
  lerCobranca,
  lerCobrancas,
  contarPerdasAoDesativar,
  type PerdasAoCancelar,
  type ReferenciaDaCobranca,
  type PerdasAoDesativar,
  type TransacaoDoBanco,
  type VendaDaInscricao,
} from "./gravacao";
import { horaDe, minutosDe } from "./horario";
import { mesDaData, valorDaAula } from "./mensalidade";
import { ordenarInscritos, precisaMarcarPresenca } from "./presenca";
import {
  dataDeVencimento,
  descricaoDaLinha,
  itensAReceber,
  linhasDaVenda,
  loteDeMensalidades,
  DISPENSADAS_POR_VEZ,
  ordenarDispensadas,
  podeDispensar,
  situacaoDaCobranca,
  subLinhaDaCobranca,
  totalAReceber,
  type ItensDoSistema as ItensDoSistemaParaVenda,
  type CobrancaDaAgenda,
  type LinhaDaVendaDaAgenda,
  type LoteDeMensalidades,
  type SituacaoDaCobranca,
  type TipoDeCobranca,
} from "./receber";
import { creditosDeReposicao, type CreditosDeReposicao } from "./reposicao";
import { gradeDoMes, type TipoDoPonto } from "./semana";
import { gruposDoSeletor, LIMITE_DO_SELETOR, type GrupoDoSeletor, type PessoaComSaldo } from "./seletor";
import { FRASE_ITENS_DA_AGENDA_SUMIRAM, rotuloDoGrupoDoSeletor } from "./textos";
import type { EstadoUsoLivre, Presenca, TipoEvento, TipoInscricao } from "./tipos";
import { NOMES_CURTOS_DOS_DIAS, ORDEM_DOS_DIAS_NA_TELA, type FechadoDoDia } from "./turma";
import { precisaEncerrar, saidaPrevista } from "./uso-livre";

function hhmm(hora: string | null): string | null {
  return hora === null ? null : horaDe(minutosDe(hora));
}

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

// Um uso livre do espaço na semana (plano 09 — 05-UI-SPEC.md §"Cartão de evento"): a hora de chegada
// (a real, depois de "Chegou"; antes, a prevista), "Uso livre · {nome}", "{n} pessoa(s)" e a sub-linha
// com o fim (o previsto; encerrado, a saída real). `encerrar` é a D-18: dia passado ainda no espaço.
export type UsoLivreDaSemana = {
  id: string;
  tipo: "uso_livre";
  data: string;
  inicio: string;
  fim: string;
  // O nome da pessoa — o cartão escreve "Uso livre · {nome}"; desempata o mesmo horário.
  titulo: string;
  pessoas: number;
  estado: EstadoUsoLivre;
  encerrar: boolean;
  // (Plano 13) A situação do pagamento do uso ENCERRADO (“a receber” / “lançado na Venda” / “pago” /
  // “venda nº {N} cancelada”), derivada do Financeiro; nula antes de encerrar.
  pagamento: SituacaoDePagamento | null;
};

// O que ocupa a semana: os eventos e os usos livres, juntos na ordem do módulo puro.
export type ItemDaSemana = EventoDaSemana | UsoLivreDaSemana;

type LinhaDoUsoLivre = {
  id: string;
  data: string;
  nome: string;
  chegadaPrevista: string;
  horasPrevistas: number;
  pessoas: number;
  estado: EstadoUsoLivre;
  chegada: string | null;
  saida: string | null;
};

const COLUNAS_DO_USO_LIVRE = {
  id: usosLivres.id,
  data: usosLivres.data,
  nome: clientes.nome,
  chegadaPrevista: usosLivres.chegadaPrevista,
  horasPrevistas: usosLivres.horasPrevistas,
  pessoas: usosLivres.pessoas,
  estado: usosLivres.estado,
  chegada: usosLivres.chegada,
  saida: usosLivres.saida,
};

function usoLivreDaSemana(linha: LinhaDoUsoLivre, hoje: string): UsoLivreDaSemana {
  const chegou = linha.chegada ?? linha.chegadaPrevista;
  return {
    id: linha.id,
    tipo: "uso_livre",
    data: linha.data,
    inicio: horaDe(minutosDe(chegou)),
    fim:
      linha.estado === "encerrado" && linha.saida !== null
        ? horaDe(minutosDe(linha.saida))
        : saidaPrevista(chegou, linha.horasPrevistas),
    titulo: linha.nome,
    pessoas: linha.pessoas,
    estado: linha.estado,
    encerrar: precisaEncerrar({ data: linha.data, estado: linha.estado }, hoje),
    pagamento: null,
  };
}

// Os usos livres entre `de` e `ate` (inclusive), com o nome da pessoa — todos os estados: a reserva, o
// uso no espaço e o encerrado ficam na agenda (só a reserva cancelada sai, e ela é apagada).
async function usosLivresEntre(de: string, ate: string): Promise<LinhaDoUsoLivre[]> {
  return db
    .select(COLUNAS_DO_USO_LIVRE)
    .from(usosLivres)
    .innerJoin(clientes, eq(clientes.id, usosLivres.clienteId))
    .where(and(gte(usosLivres.data, de), lte(usosLivres.data, ate)))
    .orderBy(asc(usosLivres.data), asc(usosLivres.criadoEm), asc(usosLivres.id));
}

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

// Os três itens do Catálogo que a Agenda usa para cobrar (D-04, D-17, AGE-17) — achados SÓ pela
// `chave_do_sistema`, nunca pelo nome, que o dono edita em Cadastros. O preço vem daqui (o da hora
// do uso livre) ou da turma/evento: nenhum valor no código. Usada pelos planos de cobrança
// (05-09, 05-11, 05-12).
export type ItemDoSistema = {
  id: string;
  nome: string;
  precoVendaCentavos: number | null;
  categoriaVendaId: string | null;
};

export type ItensDoSistema = {
  mensalidade: ItemDoSistema;
  inscricaoOficina: ItemDoSistema;
  usoLivreHora: ItemDoSistema;
};

const CHAVES_DOS_ITENS_DO_SISTEMA = ["mensalidade", "inscricao_oficina", "uso_livre_hora"] as const;

// O leitor é o `db` por padrão; `encerrarUsoLivre` passa a TRANSAÇÃO, para ler o preço da hora junto da
// trava do uso e congelá-lo (plano 09).
export async function obterItensDoSistema(leitor: LeitorDeConsulta = db): Promise<ItensDoSistema> {
  const linhas = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({
      chaveDoSistema: itensCatalogo.chaveDoSistema,
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      precoVendaCentavos: itensCatalogo.precoVendaCentavos,
      categoriaVendaId: itensCatalogo.categoriaVendaId,
    })
    .from(itensCatalogo)
    .where(inArray(itensCatalogo.chaveDoSistema, [...CHAVES_DOS_ITENS_DO_SISTEMA]));

  const porChave = new Map(
    linhas.map(({ chaveDoSistema, ...item }) => [chaveDoSistema, item] as const),
  );
  const mensalidade = porChave.get("mensalidade");
  const inscricaoOficina = porChave.get("inscricao_oficina");
  const usoLivreHora = porChave.get("uso_livre_hora");
  if (!mensalidade || !inscricaoOficina || !usoLivreHora) {
    console.error(FRASE_ITENS_DA_AGENDA_SUMIRAM, {
      encontrados: linhas.map((linha) => linha.chaveDoSistema),
    });
    throw new Error(FRASE_ITENS_DA_AGENDA_SUMIRAM);
  }
  return { mensalidade, inscricaoOficina, usoLivreHora };
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

// Uma linha de "Últimas vindas" da ficha da pessoa: uma inscrição numa data (com a presença) ou um uso
// livre ENCERRADO (com a tag de pagamento — plano 13, a lacuna do 05-09: o protótipo, `folhaPessoa`, lista
// os dois juntos).
export type VindaDaPessoa =
  | {
      tipo: "inscricao";
      // A chave da linha na lista.
      id: string;
      data: string;
      // Turma: o nome da turma; avulsa: o título.
      titulo: string;
      presenca: Presenca | null;
      // A falta deu direito a repor — a tag "repõe" ao lado de "faltou".
      direitoARepor: boolean;
    }
  | {
      tipo: "uso_livre";
      id: string;
      data: string;
      // As horas cheias cobradas (“Uso livre {h} h”).
      horas: number;
      // A situação do pagamento do uso, derivada do Financeiro (D-08).
      pagamento: SituacaoDePagamento | null;
    };

const TETO_DE_VINDAS = 8;

// As últimas vindas da pessoa (05-UI-SPEC.md §"Ficha da pessoa — linhas de leitura": até 8, as mais
// recentes primeiro): as inscrições dela em datas NÃO canceladas de hoje para trás — data futura ainda não
// é vinda — e os usos livres ENCERRADOS dela até hoje (“Uso livre {h} h” + a tag de pagamento; o protótipo,
// `folhaPessoa`: `e.tipo==='livre' && e.estado==='encerrado'`). Juntos, pela data e depois pela hora
// (a do começo da aula; a da chegada do uso), mais recentes primeiro. É dado da Agenda, não do cadastro:
// por isso mora aqui, e não em `lib/clientes`.
export async function ultimasVindas(clienteId: string, hoje: string): Promise<VindaDaPessoa[]> {
  const [inscritas, usos] = await Promise.all([
    db
      .select({
        id: inscricoes.id,
        data: eventos.data,
        inicio: eventos.inicio,
        titulo: eventos.titulo,
        nomeDaTurma: turmas.nome,
        presenca: inscricoes.presenca,
        direitoARepor: inscricoes.direitoARepor,
      })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
      .where(and(eq(inscricoes.clienteId, clienteId), isNull(eventos.canceladoEm), lte(eventos.data, hoje)))
      .orderBy(desc(eventos.data), desc(eventos.inicio), asc(inscricoes.id))
      .limit(TETO_DE_VINDAS),
    db
      .select({
        id: usosLivres.id,
        data: usosLivres.data,
        chegada: usosLivres.chegada,
        horas: usosLivres.horasCheias,
      })
      .from(usosLivres)
      .where(
        and(eq(usosLivres.clienteId, clienteId), eq(usosLivres.estado, "encerrado"), lte(usosLivres.data, hoje)),
      )
      .orderBy(desc(usosLivres.data), desc(usosLivres.chegada), asc(usosLivres.id))
      .limit(TETO_DE_VINDAS),
  ]);
  const pagamentos = await situacoesDosUsos(usos.map((uso) => uso.id));

  type Ordenavel = { vinda: VindaDaPessoa; hora: string };
  const todas: Ordenavel[] = [
    ...inscritas.map((linha) => ({
      vinda: {
        tipo: "inscricao" as const,
        id: linha.id,
        data: linha.data,
        titulo: linha.nomeDaTurma ?? linha.titulo ?? "",
        presenca: linha.presenca,
        direitoARepor: linha.direitoARepor,
      },
      hora: hhmm(linha.inicio) ?? "",
    })),
    ...usos.map((linha) => ({
      vinda: {
        tipo: "uso_livre" as const,
        id: linha.id,
        data: linha.data,
        horas: linha.horas ?? 0,
        pagamento: pagamentos[linha.id] ?? null,
      },
      hora: hhmm(linha.chegada) ?? "",
    })),
  ];
  todas.sort((a, b) => {
    const porData = b.vinda.data.localeCompare(a.vinda.data);
    if (porData !== 0) {
      return porData;
    }
    const porHora = b.hora.localeCompare(a.hora);
    if (porHora !== 0) {
      return porHora;
    }
    return a.vinda.id < b.vinda.id ? -1 : a.vinda.id > b.vinda.id ? 1 : 0;
  });
  return todas.slice(0, TETO_DE_VINDAS).map((item) => item.vinda);
}

// ── O crédito de reposição (AGE-09, Pattern 3) ────────────────────────────────────────────────────
// As DUAS contagens, lidas das linhas de `inscricoes` em datas NÃO canceladas: as faltas com direito
// (`presenca = 'faltou'` e `direito_a_repor`) e as reposições (`tipo = 'reposicao'`). Nenhum contador
// gravado à parte — a conta é do módulo puro `creditosDeReposicao`. Tirar uma reposição, cancelar a data
// dela ou desativar a turma (que apaga as datas futuras) devolve o crédito sozinho; cancelar a data da
// falta o tira (data cancelada pelo ateliê nunca conta falta — AGE-04).
const FALTAS_COM_DIREITO = sql<number>`count(*) filter (where ${inscricoes.presenca} = 'faltou' and ${inscricoes.direitoARepor})`;
const REPOSICOES_USADAS = sql<number>`count(*) filter (where ${inscricoes.tipo} = 'reposicao')`;

// O saldo de reposição de cada `clientes.id` da consulta de fora, como subconsulta correlacionada —
// filtra o seletor (quem tem e quem não tem aula a repor) sem trazer a lista inteira para a memória.
const SALDO_DE_REPOSICAO_DO_CLIENTE = sql`(
  select count(*) filter (where i.presenca = 'faltou' and i.direito_a_repor)
       - count(*) filter (where i.tipo = 'reposicao')
    from inscricoes i
    join eventos e on e.id = i.evento_id
   where i.cliente_id = ${clientes.id}
     and e.cancelado_em is null
)`;

// O crédito de UMA pessoa. A ação de colocar como reposição a chama DENTRO da transação, depois de
// travar o cliente (Pitfall 7): o leitor é a transação, e o que ela lê já inclui a reposição de quem
// segurava a trava antes (READ COMMITTED).
export async function creditosDoCliente(leitor: LeitorDeConsulta, clienteId: string): Promise<CreditosDeReposicao> {
  const [linha] = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({ faltasComDireito: FALTAS_COM_DIREITO, reposicoesUsadas: REPOSICOES_USADAS })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .where(and(eq(inscricoes.clienteId, clienteId), isNull(eventos.canceladoEm)));
  return creditosDeReposicao({
    faltasComDireito: Number(linha?.faltasComDireito ?? 0),
    reposicoesUsadas: Number(linha?.reposicoesUsadas ?? 0),
  });
}

// O crédito de várias pessoas numa consulta só (a lista de Pessoas, a folha da turma, a folha da data,
// o seletor). Quem não tem nenhuma das duas contagens não aparece no objeto (saldo 0).
export async function creditosPorCliente(clienteIds: readonly string[]): Promise<Record<string, CreditosDeReposicao>> {
  const unicos = [...new Set(clienteIds)];
  if (unicos.length === 0) {
    return {};
  }
  const linhas = await db
    .select({
      clienteId: inscricoes.clienteId,
      faltasComDireito: FALTAS_COM_DIREITO,
      reposicoesUsadas: REPOSICOES_USADAS,
    })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .where(
      and(
        inArray(inscricoes.clienteId, unicos),
        isNull(eventos.canceladoEm),
        or(and(eq(inscricoes.presenca, "faltou"), eq(inscricoes.direitoARepor, true)), eq(inscricoes.tipo, "reposicao")),
      ),
    )
    .groupBy(inscricoes.clienteId);
  const resultado: Record<string, CreditosDeReposicao> = {};
  for (const linha of linhas) {
    resultado[linha.clienteId] = creditosDeReposicao({
      faltasComDireito: Number(linha.faltasComDireito),
      reposicoesUsadas: Number(linha.reposicoesUsadas),
    });
  }
  return resultado;
}

// Só o saldo de quem tem aula a repor (saldo > 0) — o que as tags "{n} a repor" mostram.
export async function saldosDeReposicao(clienteIds: readonly string[]): Promise<Record<string, number>> {
  const creditos = await creditosPorCliente(clienteIds);
  const saldos: Record<string, number> = {};
  for (const [clienteId, credito] of Object.entries(creditos)) {
    if (credito.saldo > 0) {
      saldos[clienteId] = credito.saldo;
    }
  }
  return saldos;
}

// O que o seletor de pessoa mostra (UI-D5): os grupos já cortados no teto (`gruposDoSeletor`) e, com a
// busca vazia, se existe alguém cadastrado (o vazio "Ninguém cadastrado ainda…" é diferente do
// "Digite para buscar."). O grupo "Tem aula a repor" vem calculado AQUI, no servidor — o cliente nunca
// decide quem tem crédito.
export type PessoasParaData = {
  grupos: GrupoDoSeletor[];
  ninguemCadastrado: boolean;
};

// A busca reaproveita `listarClientes` (o mesmo cadastro, D-01: sem acento, por pedaço do nome, o
// termo como parâmetro) e, numa data, tira quem JÁ está inscrito nela (`not exists` — AGE-10 ·
// adjacency). Pede um a mais do que o teto, só para saber se há mais. Sem `eventoId` (o "Quem" do uso
// livre, plano 09), ninguém é tirado e o grupo é "Pessoas". Busca vazia não lista ninguém: "Digite
// para buscar.".
export async function pessoasParaData({
  eventoId,
  busca,
}: {
  eventoId?: string;
  busca: string;
}): Promise<PessoasParaData> {
  let tipoDoEvento: TipoEvento | null = null;
  if (eventoId !== undefined) {
    const [evento] = await db.select({ tipo: eventos.tipo }).from(eventos).where(eq(eventos.id, eventoId));
    tipoDoEvento = evento?.tipo ?? null;
  }

  const foraDaData =
    eventoId === undefined
      ? undefined
      : notExists(
          db
            .select({ um: sql`1` })
            .from(inscricoes)
            .where(and(eq(inscricoes.eventoId, eventoId), eq(inscricoes.clienteId, clientes.id))),
        );
  // Grupo 1 só numa data de turma ou oficina (05-UI-SPEC.md §"Seletor de pessoa").
  const comReposicao = tipoDoEvento === "turma" || tipoDoEvento === "avulsa";

  // "Tem aula a repor" (AGE-10): quem tem saldo > 0, fora da lista desta data, pela mesma busca do
  // cadastro. Aparece também com a busca vazia — é a lista que o gestor procura ao abrir a data.
  let aRepor: PessoaComSaldo[] = [];
  if (comReposicao) {
    const { clientes: comSaldo } = await listarClientes({
      busca,
      quantos: LIMITE_DO_SELETOR + 1,
      restricao: and(foraDaData, sql`${SALDO_DE_REPOSICAO_DO_CLIENTE} > 0`),
    });
    const creditos = await creditosPorCliente(comSaldo.map((pessoa) => pessoa.id));
    aRepor = comSaldo.map((cliente) => ({ cliente, saldo: creditos[cliente.id]?.saldo ?? 0 }));
  }

  if (busca === "") {
    const [alguem] = await db.select({ id: clientes.id }).from(clientes).limit(1);
    return {
      grupos: gruposDoSeletor({ aRepor, demais: [], rotuloDemais: rotuloDoGrupoDoSeletor(tipoDoEvento) }),
      ninguemCadastrado: alguem === undefined,
    };
  }

  // O grupo do contexto é QUALQUER pessoa fora da data — inclusive quem tem aula a repor (BRIEFING §4,
  // protótipo l.309): escolhida aqui, ela segue o caminho normal da data, paga ou experimental.
  const { clientes: achados } = await listarClientes({
    busca,
    quantos: LIMITE_DO_SELETOR + 1,
    restricao: foraDaData,
  });
  return {
    grupos: gruposDoSeletor({ aRepor, demais: achados, rotuloDemais: rotuloDoGrupoDoSeletor(tipoDoEvento) }),
    ninguemCadastrado: false,
  };
}

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

type LeitorDeConsulta = Pick<typeof db, "select"> | Pick<TransacaoDoBanco, "select">;

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

// O uso livre aberto na folha (`?uso={id}`, plano 09) — `null` se ele não existe (reserva cancelada em
// outro celular, link velho). Traz o que o cartão já sabe, as horas de parede em "HH:MM", o que foi
// CONGELADO no encerramento (horas cheias, preço da hora, valor) e o preço da hora de AGORA, achado pela
// chave do item "Uso livre (hora)" (D-04, D-17 — renomear o item em Cadastros não muda nada). O preço
// de agora só serve à conta que a folha mostra antes de encerrar; quem grava é `encerrarUsoLivre`, que o
// lê de novo sob a trava.
export type UsoLivreCarregado = UsoLivreDaSemana & {
  clienteId: string;
  chegadaPrevista: string;
  horasPrevistas: number;
  chegada: string | null;
  saida: string | null;
  // A saída prevista: chegada (a real, quando houver) + horas previstas.
  saidaPrevista: string;
  horasCheias: number | null;
  precoHoraCongeladoCentavos: number | null;
  valorCentavos: number | null;
  precoHoraAtualCentavos: number | null;
  // O material do uso (plano 10 — AGE-14), na ordem em que foi acrescentado.
  materiais: MaterialDoUso[];
  // O preço de venda de AGORA de cada item ativo com estoque próprio que TEM preço (D-14: "Cobrar" só
  // para eles) — só para a linha de acrescentar, antes de encerrar; vazio no uso encerrado.
  precosDeVenda: Record<string, number>;
  // A cobrança do uso ENCERRADO (plano 11 — AGE-15): a situação derivada do Financeiro, o número da venda
  // ligada, o topo do “Recebi agora” e a taxa do cartão de agora. Nula antes de encerrar.
  cobranca: CobrancaDoUsoLivre | null;
};

export type CobrancaDoUsoLivre = {
  situacao: SituacaoDaCobranca;
  numeroDaVenda: number | null;
  descricao: string;
  taxaCartaoPontosBase: number;
};

export async function obterUsoLivre(id: string, hoje: string): Promise<UsoLivreCarregado | null> {
  const [[linha], itens, materiais] = await Promise.all([
    db
      .select({
        ...COLUNAS_DO_USO_LIVRE,
        clienteId: usosLivres.clienteId,
        horasCheias: usosLivres.horasCheias,
        precoHoraCentavos: usosLivres.precoHoraCentavos,
        valorCentavos: usosLivres.valorCentavos,
      })
      .from(usosLivres)
      .innerJoin(clientes, eq(clientes.id, usosLivres.clienteId))
      .where(eq(usosLivres.id, id)),
    obterItensDoSistema(),
    materiaisDoUso(id),
  ]);
  if (!linha) {
    return null;
  }
  const naSemana = usoLivreDaSemana(linha, hoje);
  const encerrado = linha.estado === "encerrado";
  const [precosDeVenda, cobranca] = await Promise.all([
    encerrado ? Promise.resolve({}) : precosDeVendaDoEstoque(),
    encerrado ? cobrancaDoUsoLivre(id) : Promise.resolve(null),
  ]);
  return {
    ...naSemana,
    pagamento: cobranca === null ? null : { situacao: cobranca.situacao, numeroDaVenda: cobranca.numeroDaVenda },
    clienteId: linha.clienteId,
    chegadaPrevista: hhmm(linha.chegadaPrevista) ?? naSemana.inicio,
    horasPrevistas: linha.horasPrevistas,
    chegada: hhmm(linha.chegada),
    saida: hhmm(linha.saida),
    saidaPrevista: saidaPrevista(linha.chegada ?? linha.chegadaPrevista, linha.horasPrevistas),
    horasCheias: linha.horasCheias,
    precoHoraCongeladoCentavos: linha.precoHoraCentavos,
    valorCentavos: linha.valorCentavos,
    precoHoraAtualCentavos: itens.usoLivreHora.precoVendaCentavos,
    materiais,
    precosDeVenda,
    cobranca,
  };
}

// Uma linha do "Material usado" (AGE-14): o item com o nome e a unidade de agora, a quantidade em
// milésimos, se cobra, o preço de venda de AGORA (a prévia da conta antes de encerrar) e o que foi
// CONGELADO no encerramento (preço unitário e valor — só no cobrado, D-14). `baixado` = já saiu do
// Estoque (`movimentacao_id`): nunca mais se tira nem se muda.
export type MaterialDoUso = {
  id: string;
  itemId: string;
  nome: string;
  unidade: Unidade;
  quantidadeMilesimos: number;
  cobrar: boolean;
  precoVendaAtualCentavos: number | null;
  precoUnitarioCentavos: number | null;
  valorCentavos: number | null;
  baixado: boolean;
};

// O material de um uso livre, na ordem em que foi acrescentado (`criado_em`, depois o id). O item de
// estoque tem sempre unidade (o check do Catálogo exige unidade em quem controla estoque); a falta dela
// cai em "un" só para a tela não quebrar.
export async function materiaisDoUso(usoLivreId: string, leitor: LeitorDeConsulta = db): Promise<MaterialDoUso[]> {
  const linhas = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({
      id: usosLivresMaterial.id,
      itemId: usosLivresMaterial.itemId,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      quantidadeMilesimos: usosLivresMaterial.quantidadeMilesimos,
      cobrar: usosLivresMaterial.cobrar,
      precoVendaAtualCentavos: itensCatalogo.precoVendaCentavos,
      precoUnitarioCentavos: usosLivresMaterial.precoUnitarioCentavos,
      valorCentavos: usosLivresMaterial.valorCentavos,
      movimentacaoId: usosLivresMaterial.movimentacaoId,
    })
    .from(usosLivresMaterial)
    .innerJoin(itensCatalogo, eq(itensCatalogo.id, usosLivresMaterial.itemId))
    .where(eq(usosLivresMaterial.usoLivreId, usoLivreId))
    .orderBy(asc(usosLivresMaterial.criadoEm), asc(usosLivresMaterial.id));
  return linhas.map(({ movimentacaoId, unidade, ...linha }) => ({
    ...linha,
    unidade: unidade ?? "un",
    baixado: movimentacaoId !== null,
  }));
}

// O preço de venda de agora dos itens ativos com estoque próprio que têm preço — o que decide, na tela,
// se a linha de acrescentar mostra "Cobrar" (D-14). O servidor confere de novo ao acrescentar e congela
// ao encerrar; isto é só a tela.
export async function precosDeVendaDoEstoque(): Promise<Record<string, number>> {
  const linhas = await db
    .select({ id: itensCatalogo.id, preco: itensCatalogo.precoVendaCentavos })
    .from(itensCatalogo)
    .where(
      and(
        eq(itensCatalogo.controlaEstoque, true),
        eq(itensCatalogo.ativo, true),
        isNotNull(itensCatalogo.precoVendaCentavos),
      ),
    );
  const precos: Record<string, number> = {};
  for (const linha of linhas) {
    if (linha.preco !== null) {
      precos[linha.id] = linha.preco;
    }
  }
  return precos;
}

// O preço da hora do uso livre agora (a dica da folha "Lançar na agenda") — pela chave, nunca pelo nome.
export async function precoDaHoraDoUsoLivre(): Promise<number | null> {
  return (await obterItensDoSistema()).usoLivreHora.precoVendaCentavos;
}

// ── “A receber” (plano 11 — AGE-15; 05-UI-SPEC.md §“Aba A receber”) ─────────────────────────────────────

// Uma linha de “A receber”, pronta para a tela: tudo o que ela mostra e a referência da cobrança — o
// “Recebi agora” manda só `{ tipo, id }` e a forma; o resto o servidor relê sob a trava.
export type LinhaAReceber = {
  tipo: TipoDeCobranca;
  id: string;
  nome: string;
  valorCentavos: number;
  subLinha: string;
  situacao: "a_receber" | "venda_cancelada";
  // O número da venda cancelada (a tag “venda nº {N} cancelada”, D-08); nulo sem venda.
  numeroDaVenda: number | null;
  // A descrição D-04 (o `aria-label` de “Dispensar a cobrança”) e se a linha tem esse link (D-09: só
  // mensalidade e inscrição livres — `podeDispensar`, módulo puro).
  descricao: string;
  podeDispensar: boolean;
};

export type AReceberCarregado = {
  linhas: LinhaAReceber[];
  totalCentavos: number;
  // A taxa do cartão de agora (Cadastros → Taxas) — a linha “a maquininha fica com {x}%” da folha.
  taxaCartaoPontosBase: number;
  // A sanfona do lote (plano 12 — AGE-16): as mensalidades livres, por turma e nome, e o total exato.
  lote: LoteDeMensalidades;
  // “Dispensadas ({N})” no fim (plano 13 — D-09, UI-D15): 20 por vez.
  dispensadas: DispensadasCarregadas;
  quantasDispensadas: number;
};

// O que falta receber: as cobranças sem venda ativa e não dispensadas, pela regra do módulo puro (valor
// > 0, data não cancelada, ordem por vencimento). Quem chama já garantiu as mensalidades do mês (D-02).
export async function lerAReceber({
  quantasDispensadas = DISPENSADAS_POR_VEZ,
}: { quantasDispensadas?: number } = {}): Promise<AReceberCarregado> {
  const [cobrancas, configuracao, dispensadas] = await Promise.all([
    lerCobrancas(db, { soLivres: true }),
    obterConfiguracaoFinanceira(),
    lerDispensadas({ quantas: quantasDispensadas }),
  ]);
  const itens = itensAReceber(cobrancas);
  return {
    linhas: itens.map((item) => ({
      tipo: item.tipo,
      id: item.id,
      nome: item.nome,
      valorCentavos: item.valorCentavos,
      subLinha: subLinhaDaCobranca(item),
      situacao: item.situacao,
      numeroDaVenda: item.situacao === "venda_cancelada" ? item.numeroDaVenda : null,
      descricao: descricaoDaLinha(item),
      podeDispensar: podeDispensar(item),
    })),
    totalCentavos: totalAReceber(itens),
    taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
    lote: loteDeMensalidades(itens),
    dispensadas,
    quantasDispensadas,
  };
}

// O “ · {N}” da aba (UI E15·zero-one-many) — a mesma regra da lista.
export async function quantosAReceber(): Promise<number> {
  return itensAReceber(await lerCobrancas(db, { soLivres: true })).length;
}

// A cobrança do uso livre encerrado, para o rodapé da folha (“Recebi agora” enquanto a receber).
async function cobrancaDoUsoLivre(usoLivreId: string): Promise<CobrancaDoUsoLivre | null> {
  const [cobranca, configuracao] = await Promise.all([
    lerCobranca(db, { tipo: "uso_livre", id: usoLivreId }),
    obterConfiguracaoFinanceira(),
  ]);
  if (cobranca === null || cobranca.tipo !== "uso_livre") {
    return null;
  }
  return {
    situacao: situacaoDaCobranca(cobranca),
    numeroDaVenda: cobranca.numeroDaVenda,
    descricao: subLinhaDaCobranca(cobranca),
    taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase,
  };
}

// ── “Lançar na Venda” (plano 12 — AGE-15, mecanismo B da pesquisa, UI-D26) ──────────────────────────────

// Os três itens do sistema como a venda os usa: id e categoria de venda. Item com chave nunca perde a
// categoria (aparece na Venda — check e gatilho da 0026); a falta dela é o mesmo defeito de “sumiram”.
// Movido de `acoes.ts` (plano 11) para servir também a `cobrancaParaVenda` e ao lote.
export function itensDoSistemaParaVenda(itens: ItensDoSistema): ItensDoSistemaParaVenda {
  const paraVenda = (item: { id: string; categoriaVendaId: string | null }) => {
    if (item.categoriaVendaId === null) {
      throw new Error(FRASE_ITENS_DA_AGENDA_SUMIRAM);
    }
    return { id: item.id, categoriaId: item.categoriaVendaId };
  };
  return {
    mensalidade: paraVenda(itens.mensalidade),
    inscricaoOficina: paraVenda(itens.inscricaoOficina),
    usoLivreHora: paraVenda(itens.usoLivreHora),
  };
}

// O que a Venda do Financeiro precisa para abrir preenchida a partir de uma cobrança da Agenda. Lido no
// SERVIDOR pela página (`?aba=venda&origem=`): o navegador nunca manda descrição, cliente nem o valor-base
// da cobrança — e, ao lançar, `lancarVenda` relê tudo sob a trava (`vincularCobranca`).
export type CobrancaParaVenda =
  | {
      situacao: "livre";
      clienteId: string;
      clienteNome: string;
      // D-04: a descrição da linha de origem (a faixa “Da Agenda · {descrição} · {nome}”).
      descricao: string;
      // O “Vence em” do à vista em aberto: o vencimento da mensalidade; a data do evento ou do uso.
      vencimento: string;
      // As linhas da venda (`linhasDaVenda`): a primeira é a linha de origem (o item do sistema).
      linhas: LinhaDaVendaDaAgenda[];
      itemDoSistemaId: string;
    }
  | { situacao: "ja_lancada"; numero: number }
  | { situacao: "nao_achada" };

export async function cobrancaParaVenda(origem: ReferenciaDaCobranca): Promise<CobrancaParaVenda> {
  const [cobranca, itens] = await Promise.all([lerCobranca(db, origem), obterItensDoSistema()]);
  if (cobranca === null) {
    return { situacao: "nao_achada" };
  }
  const situacao = situacaoDaCobranca(cobranca);
  if ((situacao === "lancado" || situacao === "pago") && cobranca.numeroDaVenda !== null) {
    return { situacao: "ja_lancada", numero: cobranca.numeroDaVenda };
  }
  if (
    situacao === "dispensada" ||
    cobranca.valorCentavos <= 0 ||
    (cobranca.tipo === "inscricao" && cobranca.dataCancelada)
  ) {
    return { situacao: "nao_achada" };
  }
  const paraVenda = itensDoSistemaParaVenda(itens);
  const itemDoSistema =
    cobranca.tipo === "mensalidade"
      ? paraVenda.mensalidade
      : cobranca.tipo === "inscricao"
        ? paraVenda.inscricaoOficina
        : paraVenda.usoLivreHora;
  return {
    situacao: "livre",
    clienteId: cobranca.clienteId,
    clienteNome: cobranca.nome,
    descricao: descricaoDaLinha(cobranca),
    vencimento: dataDeVencimento(cobranca),
    // `linhasDaVenda` começa SEMPRE pela linha do item do sistema (a linha de origem).
    linhas: linhasDaVenda(cobranca, paraVenda),
    itemDoSistemaId: itemDoSistema.id,
  };
}

// ── “Dispensadas” (plano 13 — D-09, UI-D15; 05-UI-SPEC.md §“Aba A receber”, item 4) ─────────────────────

// Uma linha de “Dispensadas”: “{nome} · {descrição}” + “dispensada por {quem} em {dd/mm}” + “ · {motivo}”,
// e a referência que o “Desfazer” manda (`{ tipo, id }` + o estado desejado).
export type DispensadaCarregada = {
  tipo: "mensalidade" | "inscricao";
  id: string;
  nome: string;
  // A descrição D-04 da cobrança (“Mensalidade · {turma} · {mês}”, “{oficina} · {dd/mm}”…).
  descricao: string;
  // O nome de quem dispensou (o usuário de `dispensada_por`).
  quem: string;
  // ISO — a ordem; e o dia em Brasília, já como “dd/mm”.
  dispensadaEm: string;
  diaMes: string;
  motivo: string | null;
};

export type DispensadasCarregadas = {
  linhas: DispensadaCarregada[];
  // O N de “Dispensadas ({N})” — todas, não só as que a página carregou.
  total: number;
};

// As cobranças dispensadas que ainda podem voltar para “A receber” — sem venda ATIVA (a dispensa nunca
// convive com uma; o filtro é defesa) e, na inscrição, com a data de pé —, as mais recentes primeiro, até
// `quantas` (20 por vez). Duas leituras limitadas (mensalidades e inscrições) e a mistura pelo módulo puro.
export async function lerDispensadas({ quantas }: { quantas: number }): Promise<DispensadasCarregadas> {
  const semVendaAtivaDaMensalidade = and(
    isNotNull(mensalidades.dispensadaEm),
    or(isNull(mensalidades.documentoId), isNotNull(documentos.canceladoEm)),
  );
  const semVendaAtivaDaInscricao = and(
    eq(inscricoes.cobrar, true),
    isNotNull(inscricoes.dispensadaEm),
    isNull(eventos.canceladoEm),
    or(isNull(inscricoes.documentoId), isNotNull(documentos.canceladoEm)),
  );

  const [doMes, inscritas, [contaDoMes], [contaInscritas]] = await Promise.all([
    db
      .select({
        id: mensalidades.id,
        nome: clientes.nome,
        turma: turmas.nome,
        mes: mensalidades.mes,
        quem: usuarios.nome,
        dispensadaEm: mensalidades.dispensadaEm,
        motivo: mensalidades.motivoDispensa,
      })
      .from(mensalidades)
      .innerJoin(clientes, eq(clientes.id, mensalidades.clienteId))
      .innerJoin(turmas, eq(turmas.id, mensalidades.turmaId))
      .innerJoin(usuarios, eq(usuarios.id, mensalidades.dispensadaPor))
      .leftJoin(documentos, eq(documentos.id, mensalidades.documentoId))
      .where(semVendaAtivaDaMensalidade)
      .orderBy(desc(mensalidades.dispensadaEm), asc(mensalidades.id))
      .limit(quantas),
    db
      .select({
        id: inscricoes.id,
        nome: clientes.nome,
        tipo: inscricoes.tipo,
        tituloDoEvento: eventos.titulo,
        nomeDaTurma: turmas.nome,
        data: eventos.data,
        quem: usuarios.nome,
        dispensadaEm: inscricoes.dispensadaEm,
        motivo: inscricoes.motivoDispensa,
      })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .innerJoin(clientes, eq(clientes.id, inscricoes.clienteId))
      .innerJoin(usuarios, eq(usuarios.id, inscricoes.dispensadaPor))
      .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
      .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
      .where(semVendaAtivaDaInscricao)
      .orderBy(desc(inscricoes.dispensadaEm), asc(inscricoes.id))
      .limit(quantas),
    db
      .select({ quantas: count() })
      .from(mensalidades)
      .leftJoin(documentos, eq(documentos.id, mensalidades.documentoId))
      .where(semVendaAtivaDaMensalidade),
    db
      .select({ quantas: count() })
      .from(inscricoes)
      .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
      .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
      .where(semVendaAtivaDaInscricao),
  ]);

  const linhas: DispensadaCarregada[] = [];
  for (const linha of doMes) {
    if (linha.dispensadaEm === null) {
      continue;
    }
    linhas.push({
      tipo: "mensalidade",
      id: linha.id,
      nome: linha.nome,
      descricao: descricaoDaLinha({ tipo: "mensalidade", turma: linha.turma, mes: linha.mes }),
      quem: linha.quem,
      dispensadaEm: linha.dispensadaEm.toISOString(),
      diaMes: formatarDiaMes(hojeEmBrasilia(linha.dispensadaEm)),
      motivo: linha.motivo,
    });
  }
  for (const linha of inscritas) {
    if (linha.dispensadaEm === null) {
      continue;
    }
    const experimental = linha.tipo === "experimental";
    linhas.push({
      tipo: "inscricao",
      id: linha.id,
      nome: linha.nome,
      descricao: descricaoDaLinha({
        tipo: "inscricao",
        experimental,
        // O mesmo título de `lerInscricoesCobradas`: a experimental leva o nome da turma.
        titulo: experimental
          ? (linha.nomeDaTurma ?? linha.tituloDoEvento ?? "")
          : (linha.tituloDoEvento ?? linha.nomeDaTurma ?? ""),
        data: linha.data,
      }),
      quem: linha.quem,
      dispensadaEm: linha.dispensadaEm.toISOString(),
      diaMes: formatarDiaMes(hojeEmBrasilia(linha.dispensadaEm)),
      motivo: linha.motivo,
    });
  }

  return {
    linhas: ordenarDispensadas(linhas).slice(0, quantas),
    total: Number(contaDoMes?.quantas ?? 0) + Number(contaInscritas?.quantas ?? 0),
  };
}

// ── O pagamento onde o gestor olha (plano 13 — D-02, D-08, D-09; 05-UI-SPEC.md §Color, tags de pagamento) ──
//
// Todas as leituras abaixo passam pela MESMA derivação de “A receber” — `lerCobrancas` (a venda ligada e as
// parcelas em aberto) + `situacaoDaCobranca` / `itensAReceber` (módulo puro). Nada é gravado na Agenda: a
// venda cancelada no Caixa muda a tag sozinha (D-08), e a dispensa vira a tag neutra “dispensada” (D-09).

export type SituacaoDePagamento = { situacao: SituacaoDaCobranca; numeroDaVenda: number | null };

function situacaoDePagamento(cobranca: CobrancaDaAgenda): SituacaoDePagamento {
  return { situacao: situacaoDaCobranca(cobranca), numeroDaVenda: cobranca.numeroDaVenda };
}

// Numa data cancelada, a inscrição a receber (ou de venda cancelada) sai de “A receber” — a tag não a cobra.
function saiDeAReceberAoCancelar(situacao: SituacaoDaCobranca): boolean {
  return situacao === "a_receber" || situacao === "venda_cancelada";
}

// A situação de cada inscrição COBRADA (oficina, experimental cobrada) da data, pelo id da inscrição.
// Valor zero não cobra nada: sem tag.
export async function situacoesDasInscricoes(eventoId: string): Promise<Record<string, SituacaoDePagamento>> {
  const cobrancas = await lerCobrancas(db, { tipos: ["inscricao"], eventoIds: [eventoId] });
  const situacoes: Record<string, SituacaoDePagamento> = {};
  for (const cobranca of cobrancas) {
    if (cobranca.valorCentavos > 0) {
      situacoes[cobranca.id] = situacaoDePagamento(cobranca);
    }
  }
  return situacoes;
}

// A situação da mensalidade de `mes` (“AAAA-MM-01”) de cada aluno da turma, pelo id do cliente — a tag do
// aluno na data de turma. Aluno sem a mensalidade desse mês (mês que ainda não nasceu): sem tag.
export async function situacaoDaMensalidadeDoMes(
  turmaId: string,
  mes: string,
): Promise<Record<string, SituacaoDePagamento>> {
  const cobrancas = await lerCobrancas(db, { tipos: ["mensalidade"], turmaId, mes });
  const situacoes: Record<string, SituacaoDePagamento> = {};
  for (const cobranca of cobrancas) {
    if (cobranca.valorCentavos > 0) {
      situacoes[cobranca.clienteId] = situacaoDePagamento(cobranca);
    }
  }
  return situacoes;
}

// Quantas inscrições cobradas de cada data estão em “A receber” — o “{n} a receber” do cartão. Quem chama
// passa só as datas de pé (a cancelada não deve nada).
export async function aReceberPorEvento(eventoIds: readonly string[]): Promise<Record<string, number>> {
  if (eventoIds.length === 0) {
    return {};
  }
  const [cobrancas, inscritas] = await Promise.all([
    lerCobrancas(db, { tipos: ["inscricao"], soLivres: true, eventoIds }),
    db
      .select({ id: inscricoes.id, eventoId: inscricoes.eventoId })
      .from(inscricoes)
      .where(and(inArray(inscricoes.eventoId, [...eventoIds]), eq(inscricoes.cobrar, true))),
  ]);
  const eventoDaInscricao = new Map(inscritas.map((linha) => [linha.id, linha.eventoId]));
  const porEvento: Record<string, number> = {};
  for (const item of itensAReceber(cobrancas)) {
    const eventoId = eventoDaInscricao.get(item.id);
    if (eventoId !== undefined) {
      porEvento[eventoId] = (porEvento[eventoId] ?? 0) + 1;
    }
  }
  return porEvento;
}

// A situação do pagamento de cada uso livre ENCERRADO pedido, pelo id do uso — a tag do cartão.
export async function situacoesDosUsos(usoIds: readonly string[]): Promise<Record<string, SituacaoDePagamento>> {
  if (usoIds.length === 0) {
    return {};
  }
  const cobrancas = await lerCobrancas(db, { tipos: ["uso_livre"], usoIds });
  const situacoes: Record<string, SituacaoDePagamento> = {};
  for (const cobranca of cobrancas) {
    situacoes[cobranca.id] = situacaoDePagamento(cobranca);
  }
  return situacoes;
}

// O quadro “A RECEBER” da ficha: a soma do que a pessoa deve AGORA — as cobranças livres (a receber, ou
// com a venda cancelada no Caixa), não dispensadas, com valor, e (inscrição) de data de pé. É a MESMA regra
// da lista de “A receber” (`itensAReceber`), recortada pela pessoa. Quem chama já garantiu as mensalidades
// do mês (D-02).
export async function cobrancasDaPessoa(clienteId: string): Promise<number> {
  return totalAReceber(itensAReceber(await lerCobrancas(db, { soLivres: true, clienteIds: [clienteId] })));
}

// A tag “{n} a receber” de cada pessoa da lista de Pessoas (só quem deve aparece no resultado).
export async function aReceberPorCliente(clienteIds: readonly string[]): Promise<Record<string, number>> {
  if (clienteIds.length === 0) {
    return {};
  }
  const porCliente: Record<string, number> = {};
  for (const item of itensAReceber(await lerCobrancas(db, { soLivres: true, clienteIds }))) {
    porCliente[item.clienteId] = (porCliente[item.clienteId] ?? 0) + 1;
  }
  return porCliente;
}

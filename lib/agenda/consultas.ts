// As leituras da Agenda (Fase 5). SEM a diretiva de Server Action (Pattern 4): são chamadas só por
// Server Components (a página), que já chamaram `exigirUsuario()` antes — uma exportação de
// arquivo com a diretiva viraria endpoint chamável pelo navegador.
//
// O `pg` devolve as colunas `time` com segundos ("19:00:00", Pitfall 9): tudo sai daqui já em
// "HH:MM", pelo módulo puro `horario.ts`.
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, max, notExists, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes, documentos, eventos, inscricoes, itensCatalogo, mensalidades, turmaAlunos, turmas } from "@/db/schema";
import type { TurmaDaSubLinha } from "@/lib/clientes/lista";
import { listarClientes } from "@/lib/clientes/consultas";
import { ultimoDiaDoMes } from "@/lib/financeiro/calendario";
import { somarDias } from "@/lib/producao/calendario";

import {
  contarPerdasAoCancelar,
  contarPerdasAoDesativar,
  type PerdasAoCancelar,
  type PerdasAoDesativar,
  type TransacaoDoBanco,
  type VendaDaInscricao,
} from "./gravacao";
import { horaDe, minutosDe } from "./horario";
import { ordenarInscritos } from "./presenca";
import { gradeDoMes } from "./semana";
import { gruposDoSeletor, LIMITE_DO_SELETOR, type GrupoDoSeletor } from "./seletor";
import { FRASE_ITENS_DA_AGENDA_SUMIRAM, rotuloDoGrupoDoSeletor } from "./textos";
import type { Presenca, TipoEvento, TipoInscricao } from "./tipos";
import { NOMES_CURTOS_DOS_DIAS, ORDEM_DOS_DIAS_NA_TELA, type FechadoDoDia } from "./turma";

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

// Os eventos da semana que começa em `segunda` (segunda a domingo), com a contagem de inscritos —
// a ordem do dia é do módulo puro (`agruparPorDia`), não do banco.
export async function lerSemana(segunda: string): Promise<EventoDaSemana[]> {
  const domingo = somarDias(segunda, 6);
  const contagem = db
    .select({ eventoId: inscricoes.eventoId, inscritos: count().as("inscritos") })
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
      canceladoEm: eventos.canceladoEm,
    })
    .from(eventos)
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .leftJoin(contagem, eq(contagem.eventoId, eventos.id))
    .where(and(gte(eventos.data, segunda), lte(eventos.data, domingo)))
    .orderBy(asc(eventos.data), asc(eventos.criadoEm), asc(eventos.id));

  const motivos = motivosDosFechados(linhas);
  return linhas.map((linha) => ({
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
  }));
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
};

export type { PerdasAoCancelar };

export async function perdasAoCancelar(eventoId: string): Promise<PerdasAoCancelar> {
  return contarPerdasAoCancelar(db, eventoId);
}

// O evento aberto na folha (`?evento={id}`), com os inscritos na ordem da folha — `null` se ele
// não existe (link velho, removido em outro celular).
export async function obterEvento(id: string): Promise<EventoCarregado | null> {
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
    })
    .from(eventos)
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .where(eq(eventos.id, id));
  if (!evento) {
    return null;
  }

  const [linhas, perdas, fechadosDoDia] = await Promise.all([
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
  ]);
  const inscritos = linhas.map(({ vendaNumero, vendaCanceladaEm, ...linha }) => ({
    ...linha,
    venda: vendaDaInscricao(vendaNumero, vendaCanceladaEm),
  }));

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
    precoCentavos: evento.precoCentavos,
    publico: evento.publico,
    inscricoes: ordenarInscritos(inscritos),
    perdasAoCancelar: perdas,
  };
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

export async function obterItensDoSistema(): Promise<ItensDoSistema> {
  const linhas = await db
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
// fechado, já estão nele. Nunca recusa nada: é aviso (D-13 — "avisa e não bloqueia"). Os usos
// livres entram nesta conta no plano 09.
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

  const fechado = linhas.find((linha) => linha.tipo === "fechado");
  return {
    fechadoMotivo: fechado ? (fechado.titulo ?? "") : null,
    lancamentos: linhas.filter((linha) => linha.tipo !== "fechado").length,
    fechados: ate === undefined ? [] : await fechadosEntre(data, ate),
  };
}

// Um lançamento na grade do mês: o dia e o tipo — o resto (título, horário) não aparece na célula.
export type LancamentoDoMes = { data: string; tipo: TipoEvento };

// Os eventos NÃO cancelados entre a primeira e a última célula da grade do mês (as células de fora
// do mês também têm pontos), por dia e início — cancelado não tem ponto (herdado). Os usos livres
// entram aqui no plano 09.
export async function lerMes(mes: string): Promise<LancamentoDoMes[]> {
  const grade = gradeDoMes(mes);
  const primeiraCelula = grade[0].data;
  const ultimaCelula = grade[grade.length - 1].data;
  return db
    .select({ data: eventos.data, tipo: eventos.tipo })
    .from(eventos)
    .where(
      and(gte(eventos.data, primeiraCelula), lte(eventos.data, ultimaCelula), isNull(eventos.canceladoEm)),
    )
    .orderBy(asc(eventos.data), asc(eventos.inicio), asc(eventos.id));
}

// Uma linha de "Últimas vindas" da ficha da pessoa.
export type VindaDaPessoa = {
  inscricaoId: string;
  data: string;
  // Turma: o nome da turma; avulsa: o título.
  titulo: string;
  presenca: Presenca | null;
};

const TETO_DE_VINDAS = 8;

// As últimas vindas da pessoa (05-UI-SPEC.md §"Ficha da pessoa — linhas de leitura": até 8, as mais
// recentes primeiro): as inscrições dela em datas NÃO canceladas de hoje para trás — data futura
// ainda não é vinda. É dado da Agenda, não do cadastro: por isso mora aqui, e não em `lib/clientes`.
// Os usos livres ("Uso livre {h} h") entram aqui no plano 09.
export async function ultimasVindas(clienteId: string, hoje: string): Promise<VindaDaPessoa[]> {
  const linhas = await db
    .select({
      inscricaoId: inscricoes.id,
      data: eventos.data,
      titulo: eventos.titulo,
      nomeDaTurma: turmas.nome,
      presenca: inscricoes.presenca,
    })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .where(and(eq(inscricoes.clienteId, clienteId), isNull(eventos.canceladoEm), lte(eventos.data, hoje)))
    .orderBy(desc(eventos.data), desc(eventos.inicio), asc(inscricoes.id))
    .limit(TETO_DE_VINDAS);

  return linhas.map((linha) => ({
    inscricaoId: linha.inscricaoId,
    data: linha.data,
    titulo: linha.nomeDaTurma ?? linha.titulo ?? "",
    presenca: linha.presenca,
  }));
}

// O que o seletor de pessoa mostra (UI-D5): os grupos já cortados no teto (`gruposDoSeletor`) e, com a
// busca vazia, se existe alguém cadastrado (o vazio "Ninguém cadastrado ainda…" é diferente do
// "Digite para buscar."). O grupo "Tem aula a repor" entra no plano 08.
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

  if (busca === "") {
    const [alguem] = await db.select({ id: clientes.id }).from(clientes).limit(1);
    return { grupos: [], ninguemCadastrado: alguem === undefined };
  }

  const restricao =
    eventoId === undefined
      ? undefined
      : notExists(
          db
            .select({ um: sql`1` })
            .from(inscricoes)
            .where(and(eq(inscricoes.eventoId, eventoId), eq(inscricoes.clienteId, clientes.id))),
        );
  const { clientes: achados } = await listarClientes({ busca, quantos: LIMITE_DO_SELETOR + 1, restricao });
  return {
    grupos: gruposDoSeletor({ aRepor: [], demais: achados, rotuloDemais: rotuloDoGrupoDoSeletor(tipoDoEvento) }),
    ninguemCadastrado: false,
  };
}

export type { PerdasAoDesativar };

// O que a confirmação de "Desativar turma" mostra antes (a regra de exclusão do projeto).
export async function perdasAoDesativar(turmaId: string, hoje: string): Promise<PerdasAoDesativar> {
  return contarPerdasAoDesativar(db, turmaId, hoje);
}

export type AlunoDaTurma = { clienteId: string; nome: string };

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

  return {
    ...turma,
    inicio: hhmm(turma.inicio) ?? turma.inicio,
    fim: hhmm(turma.fim) ?? turma.fim,
    ultimaData: ultima?.data ?? null,
    datasFuturas: Number(futuras?.total ?? 0),
    alunos: [...alunos].sort((a, b) => ORDEM_DOS_NOMES.compare(a.nome, b.nome)),
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

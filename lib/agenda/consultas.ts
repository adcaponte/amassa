// As leituras da Agenda (Fase 5). SEM a diretiva de Server Action (Pattern 4): são chamadas só por
// Server Components (a página), que já chamaram `exigirUsuario()` antes — uma exportação de
// arquivo com a diretiva viraria endpoint chamável pelo navegador.
//
// O `pg` devolve as colunas `time` com segundos ("19:00:00", Pitfall 9): tudo sai daqui já em
// "HH:MM", pelo módulo puro `horario.ts`.
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes, eventos, inscricoes, itensCatalogo, turmas } from "@/db/schema";
import { listarClientes } from "@/lib/clientes/consultas";
import { somarDias } from "@/lib/producao/calendario";

import { contarPerdasAoCancelar, type PerdasAoCancelar } from "./gravacao";
import { horaDe, minutosDe } from "./horario";
import { ordenarInscritos } from "./presenca";
import { gradeDoMes } from "./semana";
import { gruposDoSeletor, LIMITE_DO_SELETOR, type GrupoDoSeletor } from "./seletor";
import { FRASE_ITENS_DA_AGENDA_SUMIRAM, rotuloDoGrupoDoSeletor } from "./textos";
import type { Presenca, TipoEvento, TipoInscricao } from "./tipos";

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
};

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
      vagas: eventos.vagas,
      inscritos: contagem.inscritos,
      canceladoEm: eventos.canceladoEm,
    })
    .from(eventos)
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .leftJoin(contagem, eq(contagem.eventoId, eventos.id))
    .where(and(gte(eventos.data, segunda), lte(eventos.data, domingo)))
    .orderBy(asc(eventos.data), asc(eventos.id));

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
  }));
}

export type InscritoCarregado = {
  id: string;
  clienteId: string;
  nome: string;
  tipo: TipoInscricao;
  presenca: Presenca | null;
  direitoARepor: boolean;
};

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

  const [linhas, perdas] = await Promise.all([
    db
      .select({
        id: inscricoes.id,
        clienteId: inscricoes.clienteId,
        nome: clientes.nome,
        tipo: inscricoes.tipo,
        presenca: inscricoes.presenca,
        direitoARepor: inscricoes.direitoARepor,
      })
      .from(inscricoes)
      .innerJoin(clientes, eq(clientes.id, inscricoes.clienteId))
      .where(eq(inscricoes.eventoId, id)),
    perdasAoCancelar(id),
  ]);

  return {
    id: evento.id,
    tipo: evento.tipo,
    data: evento.data,
    inicio: hhmm(evento.inicio),
    fim: hhmm(evento.fim),
    titulo: evento.nomeDaTurma ?? evento.titulo ?? "",
    vagas: evento.vagas,
    inscritos: linhas.length,
    cancelado: evento.canceladoEm !== null,
    precoCentavos: evento.precoCentavos,
    publico: evento.publico,
    inscricoes: ordenarInscritos(linhas),
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
};

export async function lerDiaParaLancar(data: string): Promise<DiaParaLancar> {
  const linhas = await db
    .select({ tipo: eventos.tipo, titulo: eventos.titulo })
    .from(eventos)
    .where(and(eq(eventos.data, data), isNull(eventos.canceladoEm)))
    .orderBy(asc(eventos.criadoEm), asc(eventos.id));

  const fechado = linhas.find((linha) => linha.tipo === "fechado");
  return {
    fechadoMotivo: fechado ? (fechado.titulo ?? "") : null,
    lancamentos: linhas.filter((linha) => linha.tipo !== "fechado").length,
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

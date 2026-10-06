// Leituras da Agenda — as PESSOAS: as últimas vindas, os créditos de reposição e quem pode ser
// colocado numa data (D-24/P10, plano 06.5-27 — saíram de `consultas.ts`, que agora é o índice).
// Sem diretiva, como o antigo `consultas.ts`: leituras chamadas só por Server Components e pelas
// ações, depois de `exigirUsuario()` (ver o comentário de topo do índice `consultas.ts`).

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { clientes, eventos, inscricoes, turmas, usosLivres } from "@/db/schema";
import { listarClientes } from "@/lib/clientes/consultas";

import type { TransacaoDoBanco } from "./gravacao";
import { creditosDeReposicao, type CreditosDeReposicao } from "./reposicao";
import {
  gruposDoSeletor,
  LIMITE_DO_SELETOR,
  type GrupoDoSeletor,
  type PessoaComSaldo,
} from "./seletor";
import { rotuloDoGrupoDoSeletor } from "./textos";
import type { Presenca, TipoEvento } from "./tipos";

import { hhmm, type LeitorDeConsulta } from "./consultas-comum";
import { type SituacaoDePagamento, situacoesDosUsos } from "./consultas-receber";

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

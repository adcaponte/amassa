// Auxiliar de teste da Agenda (Fase 5): semeia pessoas, oficinas e inscrições e LÊ a presença direto
// do banco de teste, pelo cliente `pg` — mesmo molde de `tests/e2e/apoio/semear-producao.ts`. Nomes
// sempre inventados, com prefixo `[e2e]` — nenhum dado real no repositório (o repositório é público).
//
// Datas civis vêm como texto `YYYY-MM-DD` de quem chama (o dia de Brasília, por `hojeNoAtelie()` /
// `somarDiasAoHoje()` de `semear-financeiro.ts`) — nunca `current_date` do Postgres, que roda em UTC,
// nem o dia UTC do relógio do teste.
import { Client } from "pg";

import type { Presenca, TipoInscricao } from "@/lib/agenda/tipos";

async function comCliente<T>(operacao: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  try {
    return await operacao(cliente);
  } finally {
    await cliente.end();
  }
}

export async function semearCliente(dados: { nome: string; telefone?: string | null }): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      "insert into clientes (nome, telefone) values ($1, $2) returning id",
      [dados.nome, dados.telefone ?? null],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`semearCliente: falha ao inserir "${dados.nome}".`);
    }
    return id;
  });
}

export type OficinaParaSemear = {
  titulo: string;
  data: string;
  inicio: string;
  fim: string;
  vagas: number;
  precoCentavos: number;
  publico?: boolean;
};

// Uma aula ou oficina AVULSA (tipo `avulsa`): título e preço obrigatórios (check
// `eventos_avulsa_com_titulo_e_preco`).
export async function semearOficina(dados: OficinaParaSemear): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into eventos (tipo, data, inicio, fim, titulo, vagas, preco_centavos, publico)
       values ('avulsa', $1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [
        dados.data,
        dados.inicio,
        dados.fim,
        dados.titulo,
        dados.vagas,
        dados.precoCentavos,
        dados.publico ?? false,
      ],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`semearOficina: falha ao inserir "${dados.titulo}".`);
    }
    return id;
  });
}

export type InscricaoParaSemear = {
  eventoId: string;
  clienteId: string;
  tipo: TipoInscricao;
  // A inscrição de oficina sempre cobra (check `inscricoes_oficina_cobra`): sem valor informado,
  // ela leva o valor zero.
  cobrar?: boolean;
  valorCentavos?: number | null;
};

export async function semearInscricao(dados: InscricaoParaSemear): Promise<string> {
  const cobrar = dados.cobrar ?? dados.tipo === "oficina";
  const valor = cobrar ? (dados.valorCentavos ?? 0) : null;
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into inscricoes (evento_id, cliente_id, tipo, cobrar, valor_centavos)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [dados.eventoId, dados.clienteId, dados.tipo, cobrar, valor],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("semearInscricao: falha ao inserir a inscrição.");
    }
    return id;
  });
}

// A presença gravada no banco — `null` = nada marcado.
export async function presencaNoBanco(inscricaoId: string): Promise<Presenca | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ presenca: Presenca | null }>(
      "select presenca from inscricoes where id = $1",
      [inscricaoId],
    );
    if (rows.length === 0) {
      throw new Error(`presencaNoBanco: a inscrição ${inscricaoId} não existe.`);
    }
    return rows[0].presenca;
  });
}

// Um dia FECHADO (tipo `fechado`): o motivo é o título; nunca público, sem horário (check
// `eventos_fechado_sem_aula`).
export async function semearFechado(dados: { data: string; motivo: string }): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into eventos (tipo, data, titulo, publico)
       values ('fechado', $1, $2, false)
       returning id`,
      [dados.data, dados.motivo],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error(`semearFechado: falha ao inserir "${dados.motivo}".`);
    }
    return id;
  });
}

export type TurmaParaSemear = {
  nome: string;
  // 0 = domingo … 6 = sábado (o `getDay()` do protótipo).
  diaSemana: number;
  inicio: string;
  fim: string;
  vagas: number;
  mensalidadeCentavos: number;
  diaVencimento: number;
  // As datas (`YYYY-MM-DD`) que viram `eventos` tipo `turma` — uma por item, com o horário e as
  // vagas da turma. Quem chama escolhe datas coerentes com `diaSemana`; o banco não confere.
  datas: readonly string[];
  publica?: boolean;
};

// Uma turma ATIVA e as suas datas (a folha da turma só chega no plano 06 — até lá, os casos que
// precisam de data de turma semeiam por aqui). Devolve os ids na ordem de `datas`.
export async function semearTurmaComDatas(
  dados: TurmaParaSemear,
): Promise<{ turmaId: string; eventoIds: string[] }> {
  return comCliente(async (cliente) => {
    const publica = dados.publica ?? false;
    const { rows } = await cliente.query<{ id: string }>(
      `insert into turmas (nome, dia_semana, inicio, fim, vagas, mensalidade_centavos, dia_vencimento, publica)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        dados.nome,
        dados.diaSemana,
        dados.inicio,
        dados.fim,
        dados.vagas,
        dados.mensalidadeCentavos,
        dados.diaVencimento,
        publica,
      ],
    );
    const turmaId = rows[0]?.id;
    if (!turmaId) {
      throw new Error(`semearTurmaComDatas: falha ao inserir "${dados.nome}".`);
    }
    const eventoIds: string[] = [];
    for (const data of dados.datas) {
      const resultado = await cliente.query<{ id: string }>(
        `insert into eventos (tipo, data, inicio, fim, turma_id, vagas, publico)
         values ('turma', $1, $2, $3, $4, $5, $6)
         returning id`,
        [data, dados.inicio, dados.fim, turmaId, dados.vagas, publica],
      );
      const id = resultado.rows[0]?.id;
      if (!id) {
        throw new Error(`semearTurmaComDatas: falha ao inserir a data ${data}.`);
      }
      eventoIds.push(id);
    }
    return { turmaId, eventoIds };
  });
}

export type EventoNoBanco = {
  id: string;
  tipo: string;
  data: string;
  inicio: string | null;
  fim: string | null;
  titulo: string | null;
  vagas: number | null;
  precoCentavos: number | null;
  publico: boolean;
  canceladoEm: Date | null;
  canceladoPor: string | null;
};

const COLUNAS_DO_EVENTO = `id, tipo::text as tipo, to_char(data, 'YYYY-MM-DD') as data,
  to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim, titulo, vagas,
  preco_centavos as "precoCentavos", publico, cancelado_em as "canceladoEm",
  cancelado_por as "canceladoPor"`;

// A linha do evento como está no banco — `null` se ela não existe (removida).
export async function eventoNoBanco(id: string): Promise<EventoNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<EventoNoBanco>(
      `select ${COLUNAS_DO_EVENTO} from eventos where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

// Os eventos com um título exato (o sufixo único do teste) — para contar quantos foram gravados.
export async function eventosComTitulo(titulo: string): Promise<EventoNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<EventoNoBanco>(
      `select ${COLUNAS_DO_EVENTO} from eventos where titulo = $1 order by criado_em, id`,
      [titulo],
    );
    return rows;
  });
}

// A presença e o direito a repor de uma inscrição, lidos juntos.
export async function inscricaoNoBanco(
  inscricaoId: string,
): Promise<{ presenca: Presenca | null; direitoARepor: boolean } | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ presenca: Presenca | null; direitoARepor: boolean }>(
      `select presenca, direito_a_repor as "direitoARepor" from inscricoes where id = $1`,
      [inscricaoId],
    );
    return rows[0] ?? null;
  });
}

// Marca a presença direto no banco (o caminho pela tela já é provado pelo traçador).
export async function marcarPresencaNoBanco(inscricaoId: string, presenca: Presenca | null): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update inscricoes set presenca = $2 where id = $1", [inscricaoId, presenca]),
  );
}

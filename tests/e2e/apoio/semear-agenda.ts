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

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

// Os cadastros de pessoa com o MESMO nome normalizado (D-16: sem acento, sem maiúscula, espaços
// colapsados) — para provar que o aviso de homônimo não gravou nada e que o toque duplo criou um só.
export async function clientesComNome(nome: string): Promise<{ id: string; nome: string; telefone: string | null }[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string; nome: string; telefone: string | null }>(
      `select id, nome, telefone from clientes
        where nome_normalizado(nome) = nome_normalizado($1)
        order by criado_em, id`,
      [nome],
    );
    return rows;
  });
}

export type InscricaoDoEvento = {
  id: string;
  clienteId: string;
  tipo: TipoInscricao;
  cobrar: boolean;
  valorCentavos: number | null;
  documentoId: string | null;
};

// As inscrições de uma data, como estão no banco — para provar o que "Colocar na lista" gravou.
export async function inscricoesDoEvento(eventoId: string): Promise<InscricaoDoEvento[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<InscricaoDoEvento>(
      `select id, cliente_id as "clienteId", tipo::text as tipo, cobrar, valor_centavos as "valorCentavos",
              documento_id as "documentoId"
         from inscricoes where evento_id = $1 order by criado_em, id`,
      [eventoId],
    );
    return rows;
  });
}

async function idDoGestorDeTeste(cliente: Client, quem: string): Promise<string> {
  const email = process.env.E2E_EMAIL_TESTE;
  if (!email) {
    throw new Error(`${quem}: a variável E2E_EMAIL_TESTE não está definida.`);
  }
  const { rows } = await cliente.query<{ id: string }>(
    "select id from usuarios where lower(email) = lower($1) limit 1",
    [email],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error(`${quem}: nenhum usuário com o e-mail "${email}".`);
  }
  return id;
}

// Uma VENDA (documento + linha + parcela paga, a soma fechando — a restrição adiada
// `conferir_soma_do_documento()` confere no `commit`) ligada à inscrição: o retrato de uma inscrição
// que já virou venda no Caixa (D-08), sem passar pela tela de cobrança (plano 11). A linha usa a
// categoria do item do sistema "Inscrição em oficina". Devolve o id e o número do documento.
export async function ligarVendaAInscricao(dados: {
  inscricaoId: string;
  valorCentavos: number;
  descricao: string;
  data: string;
}): Promise<{ documentoId: string; numero: number }> {
  return comCliente(async (cliente) => {
    const criadoPor = await idDoGestorDeTeste(cliente, "ligarVendaAInscricao");
    const categoria = await cliente.query<{ categoriaId: string }>(
      `select categoria_venda_id as "categoriaId" from itens_catalogo where chave_do_sistema = 'inscricao_oficina'`,
    );
    const categoriaId = categoria.rows[0]?.categoriaId;
    if (!categoriaId) {
      throw new Error("ligarVendaAInscricao: o item do sistema “Inscrição em oficina” não tem categoria de venda.");
    }

    await cliente.query("begin");
    try {
      const { rows } = await cliente.query<{ id: string; numero: number }>(
        `insert into documentos (tipo, data, pessoa_nome, criado_por)
         values ('venda'::tipo_documento, $1, $2, $3)
         returning id, numero`,
        [dados.data, dados.descricao, criadoPor],
      );
      const documento = rows[0];
      await cliente.query(
        `insert into documento_linhas (documento_id, ordem, descricao, categoria_id, quantidade, valor_centavos)
         values ($1, 0, $2, $3, 1, $4)`,
        [documento.id, dados.descricao, categoriaId, dados.valorCentavos],
      );
      await cliente.query(
        `insert into parcelas (documento_id, numero, vencimento, valor_centavos, forma, pago_em, pago_por)
         values ($1, 1, $2, $3, 'dinheiro'::forma_pagamento, $2, $4)`,
        [documento.id, dados.data, dados.valorCentavos, criadoPor],
      );
      await cliente.query("update inscricoes set documento_id = $1 where id = $2", [documento.id, dados.inscricaoId]);
      await cliente.query("commit");
      return { documentoId: documento.id, numero: Number(documento.numero) };
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    }
  });
}

// O Caixa cancelou a venda (carimbo de cancelamento, como `cancelarDocumento` grava) — o retrato do
// D-08 sem passar pela tela do Financeiro.
export async function cancelarDocumentoNoBanco(documentoId: string): Promise<void> {
  await comCliente(async (cliente) => {
    const canceladoPor = await idDoGestorDeTeste(cliente, "cancelarDocumentoNoBanco");
    await cliente.query("update documentos set cancelado_em = now(), cancelado_por = $2 where id = $1", [
      documentoId,
      canceladoPor,
    ]);
  });
}

// Um aluno ATIVO da turma (`turma_alunos` sem `saiu_em`) — o retrato de quem entrou pela ficha
// (plano 07), sem passar pela tela. NÃO o inscreve em data nenhuma: quem inscreve nas datas é a
// ação que está sendo provada (ex.: "Marcar mais semanas", Pitfall 5).
export async function semearAluno(dados: { turmaId: string; clienteId: string; entrouEm: string }): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      "insert into turma_alunos (turma_id, cliente_id, entrou_em) values ($1, $2, $3) returning id",
      [dados.turmaId, dados.clienteId, dados.entrouEm],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("semearAluno: falha ao inserir o aluno.");
    }
    return id;
  });
}

export type DataDaTurmaNoBanco = { id: string; data: string; inicio: string; fim: string; vagas: number; publico: boolean };

// As datas de uma turma como estão no banco, em ordem de calendário — para provar quantas foram
// marcadas, que nenhuma se repetiu e o que a edição mudou.
export async function datasDaTurmaNoBanco(turmaId: string): Promise<DataDaTurmaNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<DataDaTurmaNoBanco>(
      `select id, to_char(data, 'YYYY-MM-DD') as data, to_char(inicio, 'HH24:MI') as inicio,
              to_char(fim, 'HH24:MI') as fim, vagas, publico
         from eventos where turma_id = $1 order by data, id`,
      [turmaId],
    );
    return rows;
  });
}

export type TurmaNoBanco = {
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
  desativadaEm: Date | null;
};

// As turmas com um nome exato (o sufixo único do teste).
export async function turmasComNome(nome: string): Promise<TurmaNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<TurmaNoBanco>(
      `select id, nome, dia_semana as "diaSemana", to_char(inicio, 'HH24:MI') as inicio,
              to_char(fim, 'HH24:MI') as fim, vagas, mensalidade_centavos as "mensalidadeCentavos",
              dia_vencimento as "diaVencimento", publica, ativa, desativada_em as "desativadaEm"
         from turmas where nome = $1 order by criado_em, id`,
      [nome],
    );
    return rows;
  });
}

export type MensalidadeParaSemear = {
  turmaId: string;
  clienteId: string;
  // "AAAA-MM-01" — o mês da mensalidade.
  mes: string;
  valorCentavos: number;
  vencimento: string;
};

// Uma mensalidade já nascida (sem venda) — o retrato de um mês anterior, sem passar pela tela.
export async function semearMensalidade(dados: MensalidadeParaSemear): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [dados.turmaId, dados.clienteId, dados.mes, dados.valorCentavos, dados.vencimento],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("semearMensalidade: falha ao inserir a mensalidade.");
    }
    return id;
  });
}

export type MensalidadeNoBanco = {
  id: string;
  turmaId: string;
  mes: string;
  valorCentavos: number;
  aulasRestantes: number | null;
  aulasNoMes: number | null;
  vencimento: string;
};

// As mensalidades de uma pessoa, em ordem de mês — para provar quantas nasceram, com que valor e
// vencimento, e que nenhuma se repetiu.
export async function mensalidadesNoBanco(clienteId: string): Promise<MensalidadeNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<MensalidadeNoBanco>(
      `select id, turma_id as "turmaId", to_char(mes, 'YYYY-MM-DD') as mes, valor_centavos as "valorCentavos",
              aulas_restantes as "aulasRestantes", aulas_no_mes as "aulasNoMes",
              to_char(vencimento, 'YYYY-MM-DD') as vencimento
         from mensalidades where cliente_id = $1 order by mes, turma_id, id`,
      [clienteId],
    );
    return rows;
  });
}

export type InscricaoNaTurma = { id: string; data: string; tipo: TipoInscricao; presenca: Presenca | null };

// As inscrições de uma pessoa nas datas de uma turma, em ordem de data.
export async function inscricoesDaPessoaNaTurma(clienteId: string, turmaId: string): Promise<InscricaoNaTurma[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<InscricaoNaTurma>(
      `select i.id, to_char(e.data, 'YYYY-MM-DD') as data, i.tipo::text as tipo, i.presenca::text as presenca
         from inscricoes i join eventos e on e.id = i.evento_id
        where i.cliente_id = $1 and e.turma_id = $2
        order by e.data, i.id`,
      [clienteId, turmaId],
    );
    return rows;
  });
}

export type VinculoNoBanco = { id: string; entrouEm: string; saiuEm: string | null };

// Os vínculos (`turma_alunos`) de uma pessoa com uma turma — sair grava `saiu_em`, nunca apaga.
export async function vinculosNoBanco(clienteId: string, turmaId: string): Promise<VinculoNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<VinculoNoBanco>(
      `select id, to_char(entrou_em, 'YYYY-MM-DD') as "entrouEm", to_char(saiu_em, 'YYYY-MM-DD') as "saiuEm"
         from turma_alunos where cliente_id = $1 and turma_id = $2 order by criado_em, id`,
      [clienteId, turmaId],
    );
    return rows;
  });
}

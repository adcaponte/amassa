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

// ── Plano 08: a reposição ─────────────────────────────────────────────────────────────────────────

// Uma falta com direito a repor, direto no banco (o caminho pela tela é provado pelo caso (a) de
// `agenda reposicao`): é o que gera 1 aula a repor.
export async function marcarFaltaComDireitoNoBanco(inscricaoId: string): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update inscricoes set presenca = 'faltou', direito_a_repor = true where id = $1", [inscricaoId]),
  );
}

// O saldo de aulas a repor de uma pessoa, contado no banco pela regra do BRIEFING §4 (faltas com
// direito − reposições, só em datas não canceladas) — escrito à parte da consulta do app, para o teste
// não conferir o app com ele mesmo. Pode dar negativo: quem afirma decide.
export async function saldoDeReposicaoNoBanco(clienteId: string): Promise<number> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ saldo: string }>(
      `select (select count(*) from inscricoes i join eventos e on e.id = i.evento_id
                where i.cliente_id = $1 and e.cancelado_em is null
                  and i.presenca = 'faltou' and i.direito_a_repor)
            - (select count(*) from inscricoes i join eventos e on e.id = i.evento_id
                where i.cliente_id = $1 and e.cancelado_em is null and i.tipo = 'reposicao') as saldo`,
      [clienteId],
    );
    return Number(rows[0]?.saldo ?? 0);
  });
}

// Cancela uma data direto no banco SEM limpar as presenças — prova que a conta do crédito ignora a
// data cancelada por si (o `cancelarData` da tela ainda limpa, por cima).
export async function cancelarDataNoBanco(eventoId: string): Promise<void> {
  await comCliente(async (cliente) => {
    // O check `eventos_cancelado_por` exige os dois carimbos juntos.
    const gestor = await idDoGestorDeTeste(cliente, "cancelarDataNoBanco");
    await cliente.query("update eventos set cancelado_em = now(), cancelado_por = $2 where id = $1", [eventoId, gestor]);
  });
}

export type InscricaoCompleta = {
  id: string;
  clienteId: string;
  tipo: TipoInscricao;
  presenca: Presenca | null;
  direitoARepor: boolean;
  cobrar: boolean;
  valorCentavos: number | null;
};

// As inscrições de uma pessoa numa data — `[]` se ela não está na lista.
export async function inscricoesDaPessoaNaData(eventoId: string, clienteId: string): Promise<InscricaoCompleta[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<InscricaoCompleta>(
      `select id, cliente_id as "clienteId", tipo::text as tipo, presenca, direito_a_repor as "direitoARepor",
              cobrar, valor_centavos as "valorCentavos"
         from inscricoes where evento_id = $1 and cliente_id = $2`,
      [eventoId, clienteId],
    );
    return rows;
  });
}

// ── O uso livre (plano 09) ─────────────────────────────────────────────────────────────────────────

export type UsoLivreParaSemear = {
  clienteId: string;
  data: string;
  chegadaPrevista: string;
  horasPrevistas?: number;
  pessoas?: number;
  // Sem estado: `reservado`. `no_espaco` exige a `chegada` (check `usos_livres_chegada_por_estado`).
  estado?: "reservado" | "no_espaco";
  chegada?: string;
};

// Um uso livre direto no banco — reservado ou já no espaço (para o caso de "ontem esquecido", D-18).
export async function semearUsoLivre(dados: UsoLivreParaSemear): Promise<string> {
  const estado = dados.estado ?? "reservado";
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into usos_livres (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [
        dados.clienteId,
        dados.data,
        dados.chegadaPrevista,
        dados.horasPrevistas ?? 2,
        dados.pessoas ?? 1,
        estado,
        estado === "reservado" ? null : (dados.chegada ?? dados.chegadaPrevista),
      ],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("semearUsoLivre: falha ao inserir.");
    }
    return id;
  });
}

export type UsoLivreNoBanco = {
  estado: "reservado" | "no_espaco" | "encerrado";
  data: string;
  chegada: string | null;
  saida: string | null;
  pessoas: number;
  horasPrevistas: number;
  horasCheias: number | null;
  precoHoraCentavos: number | null;
  valorCentavos: number | null;
};

// O uso livre como está no banco — `null` se ele não existe (reserva cancelada).
export async function usoLivreNoBanco(id: string): Promise<UsoLivreNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<UsoLivreNoBanco>(
      `select estado::text as estado, to_char(data, 'YYYY-MM-DD') as data,
              to_char(chegada, 'HH24:MI') as chegada, to_char(saida, 'HH24:MI') as saida, pessoas,
              horas_previstas as "horasPrevistas", horas_cheias as "horasCheias",
              preco_hora_centavos as "precoHoraCentavos", valor_centavos as "valorCentavos"
         from usos_livres where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

// Os usos livres de uma pessoa (o caso que reserva pela tela acha o seu pela pessoa).
export async function usosLivresDaPessoa(clienteId: string): Promise<(UsoLivreNoBanco & { id: string })[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<UsoLivreNoBanco & { id: string }>(
      `select id, estado::text as estado, to_char(data, 'YYYY-MM-DD') as data,
              to_char(chegada, 'HH24:MI') as chegada, to_char(saida, 'HH24:MI') as saida, pessoas,
              horas_previstas as "horasPrevistas", horas_cheias as "horasCheias",
              preco_hora_centavos as "precoHoraCentavos", valor_centavos as "valorCentavos"
         from usos_livres where cliente_id = $1 order by criado_em`,
      [clienteId],
    );
    return rows;
  });
}

// O preço da hora do uso livre é UM só no banco (o item "Uso livre (hora)", chave `uso_livre_hora`), e os
// projetos desktop e celular rodam ao mesmo tempo — o mesmo `pg_advisory_lock` de
// `cadastros-itens-da-agenda.spec.ts`. Quem escreve o preço (ou o nome) do item, ou depende do "sem
// preço", segura a trava do começo ao fim e DEVOLVE o preço ao nulo e o nome ao original antes de soltar
// (outros casos dependem do "sem preço").
export const TRAVA_DO_PRECO_DA_HORA = 5_020_017;

export type TravaDoItemDaHora = {
  definirPreco: (centavos: number | null) => Promise<void>;
  renomear: (nome: string) => Promise<void>;
  soltar: () => Promise<void>;
};

export async function travarItemDaHora(): Promise<TravaDoItemDaHora> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_TESTE });
  await cliente.connect();
  await cliente.query("select pg_advisory_lock($1)", [TRAVA_DO_PRECO_DA_HORA]);
  const { rows } = await cliente.query<{ nome: string }>(
    "select nome from itens_catalogo where chave_do_sistema = 'uso_livre_hora'",
  );
  const nomeOriginal = rows[0]?.nome ?? "Uso livre (hora)";
  return {
    definirPreco: async (centavos) => {
      await cliente.query(
        "update itens_catalogo set preco_venda_centavos = $1 where chave_do_sistema = 'uso_livre_hora'",
        [centavos],
      );
    },
    renomear: async (nome) => {
      await cliente.query("update itens_catalogo set nome = $1 where chave_do_sistema = 'uso_livre_hora'", [nome]);
    },
    soltar: async () => {
      try {
        await cliente.query(
          "update itens_catalogo set preco_venda_centavos = null, nome = $1 where chave_do_sistema = 'uso_livre_hora'",
          [nomeOriginal],
        );
        await cliente.query("select pg_advisory_unlock($1)", [TRAVA_DO_PRECO_DA_HORA]);
      } finally {
        await cliente.end();
      }
    },
  };
}

// Atalho para quem só precisa do preço: `definirPrecoDaHora(centavos | null)` SEM trava — use só dentro
// de um caso que já segura `travarItemDaHora()`.
export async function definirPrecoDaHora(centavos: number | null): Promise<void> {
  await comCliente(async (cliente) => {
    await cliente.query(
      "update itens_catalogo set preco_venda_centavos = $1 where chave_do_sistema = 'uso_livre_hora'",
      [centavos],
    );
  });
}

// ── O material do uso livre (plano 10 — AGE-14, D-06, D-14) ─────────────────────────────────────────

// Um item de estoque para o uso livre: controla estoque, não aparece na venda, com ou sem preço de venda
// (D-14: "Cobrar" só com preço) e, se pedido, um saldo de partida com custo — UMA entrada manual válida
// (os `check`s da 0023: sem destino, sem área, com valor informado) para o custo médio do momento ser
// conhecido. É a mesma exceção de `semearMovimentacoesEmMassa`: a saída que se prova é a da tela.
export async function semearMaterialDoUso(dados: {
  nome: string;
  unidade: "un" | "g" | "kg" | "ml" | "l" | "m";
  precoVendaCentavos: number | null;
  saldo?: { milesimos: number; custoCentavos: number };
}): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into itens_catalogo
         (nome, preco_venda_centavos, aparece_na_venda, atalho_venda, controla_estoque, unidade,
          categoria_compra_id, atalho_compra)
       values ($1, $2, false, false, true, $3,
               (select id from categorias where nome = 'Argila, esmalte e insumos' limit 1), false)
       returning id`,
      [dados.nome, dados.precoVendaCentavos, dados.unidade],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("semearMaterialDoUso: falha ao inserir o item.");
    }
    if (dados.saldo) {
      await cliente.query(
        `insert into movimentacoes_estoque
           (item_id, origem, tipo, quantidade_milesimos, valor_centavos, valor_informado_centavos, registrado_por)
         values ($1, 'manual', 'entrada', $2, $3, $3,
                 (select id from usuarios where lower(email) = lower($4)))`,
        [id, dados.saldo.milesimos, dados.saldo.custoCentavos, process.env.E2E_EMAIL_TESTE ?? ""],
      );
    }
    return id;
  });
}

export async function definirPrecoDeVendaDoItem(itemId: string, centavos: number | null): Promise<void> {
  await comCliente((cliente) =>
    cliente.query("update itens_catalogo set preco_venda_centavos = $1 where id = $2", [centavos, itemId]),
  );
}

// Uma linha de material já no uso (sem baixa) — o atalho para montar o cenário; a tela acrescenta igual.
export async function semearMaterialNoUso(dados: {
  usoLivreId: string;
  itemId: string;
  quantidadeMilesimos: number;
  cobrar: boolean;
}): Promise<string> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into usos_livres_material (uso_livre_id, item_id, quantidade_milesimos, cobrar)
       values ($1, $2, $3, $4) returning id`,
      [dados.usoLivreId, dados.itemId, dados.quantidadeMilesimos, dados.cobrar],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("semearMaterialNoUso: falha ao inserir.");
    }
    return id;
  });
}

export type MaterialDoUsoNoBanco = {
  id: string;
  itemId: string;
  quantidadeMilesimos: number;
  cobrar: boolean;
  precoUnitarioCentavos: number | null;
  valorCentavos: number | null;
  movimentacaoId: string | null;
};

// As linhas de material de um uso, na ordem em que entraram.
export async function materiaisDoUsoNoBanco(usoLivreId: string): Promise<MaterialDoUsoNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<
      Omit<MaterialDoUsoNoBanco, "quantidadeMilesimos"> & { quantidadeMilesimos: string }
    >(
      `select id, item_id as "itemId", quantidade_milesimos as "quantidadeMilesimos", cobrar,
              preco_unitario_centavos as "precoUnitarioCentavos", valor_centavos as "valorCentavos",
              movimentacao_id as "movimentacaoId"
         from usos_livres_material where uso_livre_id = $1 order by criado_em, id`,
      [usoLivreId],
    );
    return rows.map((linha) => ({ ...linha, quantidadeMilesimos: Number(linha.quantidadeMilesimos) }));
  });
}

export type SaidaDoUsoNoBanco = {
  id: string;
  itemId: string;
  origem: string;
  tipo: string;
  destino: string | null;
  area: string | null;
  quantidadeMilesimos: number;
  valorCentavos: number;
  nota: string | null;
};

// As movimentações do livro ligadas a um uso livre (`uso_livre_id`), na ordem do livro.
export async function saidasDoUsoNoBanco(usoLivreId: string): Promise<SaidaDoUsoNoBanco[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{
      id: string;
      itemId: string;
      origem: string;
      tipo: string;
      destino: string | null;
      area: string | null;
      quantidade: string;
      valor: string;
      nota: string | null;
    }>(
      `select id, item_id as "itemId", origem::text as origem, tipo::text as tipo, destino::text as destino,
              area::text as area, quantidade_milesimos as quantidade, valor_centavos as valor, nota
         from movimentacoes_estoque where uso_livre_id = $1 order by numero`,
      [usoLivreId],
    );
    return rows.map(({ quantidade, valor, ...linha }) => ({
      ...linha,
      quantidadeMilesimos: Number(quantidade),
      valorCentavos: Number(valor),
    }));
  });
}

// ── A receber e o “Recebi agora” (plano 11 — AGE-15, D-01, D-08, D-14) ─────────────────────────────────

// Um uso livre JÁ ENCERRADO, direto no banco, com a conta congelada (horas × pessoas × preço da hora +
// material cobrado) e o material com o preço congelado — o retrato do fim do fluxo dos planos 09-10, sem
// passar pela tela (a baixa do Estoque não é o que este caso prova: ela é do plano 10).
export async function semearUsoLivreEncerrado(dados: {
  clienteId: string;
  data: string;
  horas: number;
  pessoas: number;
  precoHoraCentavos: number;
  materiais?: readonly {
    itemId: string;
    quantidadeMilesimos: number;
    cobrar: boolean;
    precoUnitarioCentavos?: number;
  }[];
}): Promise<{ usoLivreId: string; valorCentavos: number }> {
  const materiais = (dados.materiais ?? []).map((material) => {
    const preco = material.cobrar ? (material.precoUnitarioCentavos ?? 0) : null;
    // O mesmo arredondamento de `valorDoMaterial` (meio para cima, ao centavo).
    const valor = preco === null ? null : Math.floor((2 * material.quantidadeMilesimos * preco + 1000) / 2000);
    return { ...material, preco, valor };
  });
  const valorCentavos =
    dados.horas * dados.pessoas * dados.precoHoraCentavos +
    materiais.reduce((soma, material) => soma + (material.valor ?? 0), 0);
  const saida = `${String(10 + dados.horas).padStart(2, "0")}:00`;
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into usos_livres
         (cliente_id, data, chegada_prevista, horas_previstas, pessoas, estado, chegada, saida, horas_cheias,
          preco_hora_centavos, valor_centavos)
       values ($1, $2, '10:00', $3, $4, 'encerrado', '10:00', $5, $3, $6, $7)
       returning id`,
      [dados.clienteId, dados.data, dados.horas, dados.pessoas, saida, dados.precoHoraCentavos, valorCentavos],
    );
    const usoLivreId = rows[0]?.id;
    if (!usoLivreId) {
      throw new Error("semearUsoLivreEncerrado: falha ao inserir.");
    }
    for (const material of materiais) {
      await cliente.query(
        `insert into usos_livres_material
           (uso_livre_id, item_id, quantidade_milesimos, cobrar, preco_unitario_centavos, valor_centavos)
         values ($1, $2, $3, $4, $5, $6)`,
        [usoLivreId, material.itemId, material.quantidadeMilesimos, material.cobrar, material.preco, material.valor],
      );
    }
    return { usoLivreId, valorCentavos };
  });
}

// Um item do sistema (D-17), pela chave: o id e a categoria de venda.
export async function itemDoSistemaNoBanco(
  chave: "mensalidade" | "inscricao_oficina" | "uso_livre_hora",
): Promise<{ id: string; categoriaVendaId: string }> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ id: string; categoriaVendaId: string }>(
      `select id, categoria_venda_id as "categoriaVendaId" from itens_catalogo where chave_do_sistema = $1`,
      [chave],
    );
    const item = rows[0];
    if (!item) {
      throw new Error(`itemDoSistemaNoBanco: o item “${chave}” não existe.`);
    }
    return item;
  });
}

export type VendaDaCobrancaNoBanco = {
  documentoId: string;
  numero: number;
  data: string;
  pessoaNome: string | null;
  clienteId: string | null;
  cancelado: boolean;
  linhas: { itemId: string | null; descricao: string; categoriaId: string; quantidade: number; valorCentavos: number }[];
  parcelas: {
    vencimento: string;
    valorCentavos: number;
    forma: string;
    pagoEm: string | null;
    taxaPontosBase: number | null;
  }[];
  // Movimentações do Estoque ligadas a esta venda (nenhuma: os itens do sistema não controlam estoque e o
  // material entra como linha livre — Pitfall 3).
  movimentacoes: number;
};

const TABELA_DA_COBRANCA = { mensalidade: "mensalidades", inscricao: "inscricoes", uso_livre: "usos_livres" } as const;

// A venda ligada a uma cobrança (o `documento_id` dela), com as linhas e as parcelas — `null` sem venda.
export async function vendaDaCobranca(
  tipo: keyof typeof TABELA_DA_COBRANCA,
  id: string,
): Promise<VendaDaCobrancaNoBanco | null> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{
      documentoId: string;
      numero: string;
      data: string;
      pessoaNome: string | null;
      clienteId: string | null;
      cancelado: boolean;
    }>(
      `select d.id as "documentoId", d.numero, to_char(d.data, 'YYYY-MM-DD') as data, d.pessoa_nome as "pessoaNome",
              d.cliente_id as "clienteId", d.cancelado_em is not null as cancelado
         from ${TABELA_DA_COBRANCA[tipo]} c join documentos d on d.id = c.documento_id
        where c.id = $1`,
      [id],
    );
    const documento = rows[0];
    if (!documento) {
      return null;
    }
    const linhas = await cliente.query<VendaDaCobrancaNoBanco["linhas"][number]>(
      `select item_id as "itemId", descricao, categoria_id as "categoriaId", quantidade, valor_centavos as "valorCentavos"
         from documento_linhas where documento_id = $1 order by ordem`,
      [documento.documentoId],
    );
    const parcelasDaVenda = await cliente.query<VendaDaCobrancaNoBanco["parcelas"][number]>(
      `select to_char(vencimento, 'YYYY-MM-DD') as vencimento, valor_centavos as "valorCentavos", forma::text as forma,
              to_char(pago_em, 'YYYY-MM-DD') as "pagoEm", taxa_pontos_base as "taxaPontosBase"
         from parcelas where documento_id = $1 order by numero`,
      [documento.documentoId],
    );
    const movimentacoes = await cliente.query<{ quantas: string }>(
      "select count(*) as quantas from movimentacoes_estoque where documento_id = $1",
      [documento.documentoId],
    );
    return {
      ...documento,
      numero: Number(documento.numero),
      linhas: linhas.rows,
      parcelas: parcelasDaVenda.rows,
      movimentacoes: Number(movimentacoes.rows[0]?.quantas ?? 0),
    };
  });
}

// Quantas vendas têm o vínculo com esta pessoa (D-01) — a prova de “uma cobrança, uma venda”.
export async function vendasDoCliente(clienteId: string): Promise<{ numero: number; cancelado: boolean }[]> {
  return comCliente(async (cliente) => {
    const { rows } = await cliente.query<{ numero: string; cancelado: boolean }>(
      `select numero, cancelado_em is not null as cancelado from documentos
        where cliente_id = $1 and tipo = 'venda' order by numero`,
      [clienteId],
    );
    return rows.map((linha) => ({ numero: Number(linha.numero), cancelado: linha.cancelado }));
  });
}

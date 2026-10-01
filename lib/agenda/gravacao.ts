// A escrita da Agenda que roda DENTRO de uma transação (Fase 5, plano 01).
//
// SEM a diretiva de Server Action, de propósito (05-RESEARCH.md Pattern 4; molde de
// `lib/producao/gravacao.ts`): toda função exportada de um arquivo com a diretiva vira endpoint —
// chamável pelo navegador — e `npm run verificar-acoes` exigiria `exigirUsuario()` na primeira
// linha de cada uma. Estas funções recebem a TRANSAÇÃO de quem chama (as ações de
// `lib/agenda/acoes.ts`), por isso só são alcançáveis de dentro do servidor, depois que a ação que
// as chama já autorizou o usuário.
//
// Por que `for no key update`, e NUNCA a trava exclusiva de linha: `clientes`, `eventos`,
// `usos_livres` e `mensalidades` são alvo de chave estrangeira de inserts concorrentes (uma
// inscrição nova pede `for key share` no evento e no cliente), e a trava exclusiva conflitaria com
// eles e fecharia impasses. `for no key update` não conflita com `for key share` e continua
// excluindo outra `for no key update` — é o que serializa duas decisões sobre a mesma linha (dois
// celulares, toque duplo). Molde: `lib/estoque/gravacao.ts` e `lib/producao/gravacao.ts`.
//
// ORDEM GLOBAL DE TRAVAS DA AGENDA, para nunca haver ciclo:
//   TURMA → EVENTO → CLIENTE → INSCRIÇÃO / MENSALIDADE / USO LIVRE → (documento novo) → ITENS
// Cada ação pula os elos que não usa. A Agenda nunca trava um documento EXISTENTE (só cria o seu,
// que ninguém mais vê), então não fecha ciclo com `cancelarDocumento` do Financeiro
// (DOCUMENTO → ORDEM → ITENS).
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { db } from "@/db";
import { clientes, documentos, eventos, inscricoes, turmas } from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";

import type { Presenca, TipoEvento, TipoInscricao } from "./tipos";

export type { TransacaoDoBanco };

// Uma recusa decidida SOB A TRAVA, com a frase que a tela mostra. Lançada de dentro da transação —
// nada foi gravado — e traduzida pela ação em `{ ok: false, erro: frase }`.
export class RecusaDaAgenda extends Error {
  constructor(readonly frase: string) {
    super(frase);
    this.name = "RecusaDaAgenda";
  }
}

export type InscricaoTravada = {
  id: string;
  eventoId: string;
  clienteId: string;
  tipo: TipoInscricao;
  presenca: Presenca | null;
  direitoARepor: boolean;
  // Do evento, lidos junto: a data e se ela foi cancelada.
  data: string;
  eventoCancelado: boolean;
};

// Trava a linha da INSCRIÇÃO até o fim da transação (`for no key update ... of inscricoes` — o
// evento é só lido, nunca travado aqui) e devolve o que a decisão precisa — `null` se ela não
// existe (tirada da lista em outro celular). Tudo o que se lê depois reflete a gravação de quem
// segurava a trava antes (READ COMMITTED).
export async function travarInscricao(
  tx: TransacaoDoBanco,
  inscricaoId: string,
): Promise<InscricaoTravada | null> {
  const [linha] = await tx
    .select({
      id: inscricoes.id,
      eventoId: inscricoes.eventoId,
      clienteId: inscricoes.clienteId,
      tipo: inscricoes.tipo,
      presenca: inscricoes.presenca,
      direitoARepor: inscricoes.direitoARepor,
      data: eventos.data,
      canceladoEm: eventos.canceladoEm,
    })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .where(eq(inscricoes.id, inscricaoId))
    .for("no key update", { of: inscricoes });
  if (!linha) {
    return null;
  }
  const { canceladoEm, ...resto } = linha;
  return { ...resto, eventoCancelado: canceladoEm !== null };
}

export type EventoTravado = {
  id: string;
  tipo: TipoEvento;
  data: string;
  publico: boolean;
  // O preço por pessoa da avulsa (nulo no fechado e na data de turma) — lido SOB A TRAVA: é o que a
  // inscrição copia ao nascer (T-05-24).
  precoCentavos: number | null;
  cancelado: boolean;
};

// Trava a linha do EVENTO até o fim da transação (`for no key update` — não conflita com o
// `for key share` de uma inscrição nova, mas serializa duas decisões sobre o mesmo evento: cancelar
// em dois celulares, cancelar e desfazer). É o elo EVENTO da ordem global de travas; quem trava
// evento e depois inscrição segue a ordem. `null` se ele não existe (removido em outro celular).
export async function travarEvento(tx: TransacaoDoBanco, eventoId: string): Promise<EventoTravado | null> {
  const [linha] = await tx
    .select({
      id: eventos.id,
      tipo: eventos.tipo,
      data: eventos.data,
      publico: eventos.publico,
      precoCentavos: eventos.precoCentavos,
      canceladoEm: eventos.canceladoEm,
    })
    .from(eventos)
    .where(eq(eventos.id, eventoId))
    .for("no key update");
  if (!linha) {
    return null;
  }
  const { canceladoEm, ...resto } = linha;
  return { ...resto, cancelado: canceladoEm !== null };
}

// O que se perde ao cancelar uma data (UI-D13): as presenças já marcadas (o cancelamento as limpa —
// protótipo 352) e as inscrições cobradas que ainda estão em "A receber" (cobrar, não dispensadas,
// sem venda ATIVA — venda cancelada devolve o item a "A receber", D-08). Venda e movimentação já
// geradas nunca se apagam (AGE-20): quem já pagou continua no Financeiro.
export type PerdasAoCancelar = { presencas: number; inscricoesAReceber: number };

type LeitorDoBanco = Pick<typeof db, "select"> | Pick<TransacaoDoBanco, "select">;

export async function contarPerdasAoCancelar(
  leitor: LeitorDoBanco,
  eventoId: string,
): Promise<PerdasAoCancelar> {
  const [presencas] = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({ total: count() })
    .from(inscricoes)
    .where(and(eq(inscricoes.eventoId, eventoId), isNotNull(inscricoes.presenca)));
  const [aReceber] = await (leitor as Pick<TransacaoDoBanco, "select">)
    .select({ total: count() })
    .from(inscricoes)
    .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
    .where(
      and(
        eq(inscricoes.eventoId, eventoId),
        eq(inscricoes.cobrar, true),
        isNull(inscricoes.dispensadaEm),
        or(isNull(inscricoes.documentoId), isNotNull(documentos.canceladoEm)),
      ),
    );
  return {
    presencas: Number(presencas?.total ?? 0),
    inscricoesAReceber: Number(aReceber?.total ?? 0),
  };
}

export function temPerdas(perdas: PerdasAoCancelar): boolean {
  return perdas.presencas > 0 || perdas.inscricoesAReceber > 0;
}

// A venda ligada a uma inscrição, como a Agenda a enxerga (D-08): o número e se o Caixa a cancelou.
// Venda cancelada conta como livre — a cobrança volta a "A receber" por derivação, sem gravar nada.
export type VendaDaInscricao = { numero: number; cancelada: boolean };

export type InscricaoComVenda = {
  id: string;
  eventoId: string;
  clienteId: string;
  nome: string;
  tipo: TipoInscricao;
  // Do evento, lidos junto: se a data foi cancelada e se ela é pública (o site muda as vagas).
  eventoCancelado: boolean;
  publico: boolean;
  venda: VendaDaInscricao | null;
};

// Trava a linha da INSCRIÇÃO (`for no key update ... of inscricoes`) e lê, na mesma instrução, o nome
// da pessoa, o evento e a venda ligada — `documentos.numero` e `documentos.cancelado_em` são LIDOS,
// nunca travados (a Agenda nunca trava um documento existente: ver a ordem global de travas no
// topo). Um cancelamento no Caixa que confirme depois desta leitura não muda a decisão de quem já
// leu — e a recusa da D-08 é a direção segura (nunca apaga uma inscrição que é venda ativa). `null`
// se a inscrição não existe (tirada em outro celular).
export async function travarInscricaoComVenda(
  tx: TransacaoDoBanco,
  inscricaoId: string,
): Promise<InscricaoComVenda | null> {
  const [linha] = await tx
    .select({
      id: inscricoes.id,
      eventoId: inscricoes.eventoId,
      clienteId: inscricoes.clienteId,
      nome: clientes.nome,
      tipo: inscricoes.tipo,
      eventoCanceladoEm: eventos.canceladoEm,
      publico: eventos.publico,
      vendaNumero: documentos.numero,
      vendaCanceladaEm: documentos.canceladoEm,
    })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .innerJoin(clientes, eq(clientes.id, inscricoes.clienteId))
    .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
    .where(eq(inscricoes.id, inscricaoId))
    .for("no key update", { of: inscricoes });
  if (!linha) {
    return null;
  }
  const { eventoCanceladoEm, vendaNumero, vendaCanceladaEm, ...resto } = linha;
  return {
    ...resto,
    eventoCancelado: eventoCanceladoEm !== null,
    venda: vendaNumero === null ? null : { numero: vendaNumero, cancelada: vendaCanceladaEm !== null },
  };
}

// O que uma data de turma copia da turma ao nascer: horário, vagas e `publico` (o nome NÃO — as
// datas leem o nome da turma ao vivo, por isso `titulo` fica nulo).
export type TurmaParaMarcar = {
  id: string;
  inicio: string;
  fim: string;
  vagas: number;
  publica: boolean;
};

// Grava as datas de uma turma (AGE-03). A garantia contra data repetida é a chave
// `eventos_turma_data_uk` + `on conflict (turma_id, data) do nothing` (T-05-30) — NUNCA uma leitura
// prévia de "já existe?": dois toques, duas abas ou dois gestores estendendo ao mesmo tempo terminam
// com cada data uma vez, e a que já existia simplesmente não volta no `returning`. Devolve só as
// datas CRIADAS agora, em ordem de calendário. Nunca pula dia fechado (D-13).
export async function marcarDatasDaTurma(
  tx: TransacaoDoBanco,
  turma: TurmaParaMarcar,
  datas: readonly string[],
  criadoPor: string,
): Promise<{ id: string; data: string }[]> {
  if (datas.length === 0) {
    return [];
  }
  const criadas = await tx
    .insert(eventos)
    .values(
      datas.map((data) => ({
        tipo: "turma" as const,
        data,
        inicio: turma.inicio,
        fim: turma.fim,
        turmaId: turma.id,
        vagas: turma.vagas,
        publico: turma.publica,
        criadoPor,
      })),
    )
    .onConflictDoNothing({ target: [eventos.turmaId, eventos.data] })
    .returning({ id: eventos.id, data: eventos.data });
  return criadas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export type TurmaTravada = {
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
};

// Trava a linha da TURMA até o fim da transação (`for no key update` — o primeiro elo da ordem
// global de travas). Editar, "Marcar mais semanas", desativar e (plano 07) entrar na turma travam a
// MESMA linha primeiro: estender e entrar ao mesmo tempo nunca deixam o aluno fora de uma data nova,
// e estender e desativar nunca se cruzam. `null` se ela não existe.
export async function travarTurma(tx: TransacaoDoBanco, turmaId: string): Promise<TurmaTravada | null> {
  const [linha] = await tx
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
    })
    .from(turmas)
    .where(eq(turmas.id, turmaId))
    .for("no key update");
  return linha ?? null;
}

// Inscreve todo aluno ATIVO da turma (`turma_alunos` sem `saiu_em`) como `aluno` nas datas dadas
// (Pitfall 5: "Marcar mais semanas" nunca cria datas vazias), na MESMA transação de quem as criou.
// `on conflict (evento_id, cliente_id) do nothing`: quem já está na data (uma experimental, por
// exemplo — Assumption A13) fica como está. O aluno paga pela mensalidade, nunca pela data
// (`cobrar` falso). Usado aqui e por "entrar na turma" (plano 07). Devolve quantas inscrições nasceram.
export async function inscreverAlunosNasDatas(
  tx: TransacaoDoBanco,
  turmaId: string,
  eventoIds: readonly string[],
  criadoPor: string,
): Promise<number> {
  if (eventoIds.length === 0) {
    return 0;
  }
  const ids = sql.join(
    eventoIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const resultado = await tx.execute(sql`
    insert into inscricoes (evento_id, cliente_id, tipo, criado_por)
    select e.id, ta.cliente_id, 'aluno'::tipo_inscricao, ${criadoPor}::uuid
      from turma_alunos ta
      join eventos e on e.turma_id = ta.turma_id
     where ta.turma_id = ${turmaId}::uuid
       and ta.saiu_em is null
       and e.id in (${ids})
    on conflict (evento_id, cliente_id) do nothing
  `);
  return resultado.rowCount ?? 0;
}

// A primeira inscrição de uma data FUTURA da turma (`data > hoje`) ligada a uma venda NÃO cancelada
// — a desativação recusa por ela (D-08: a Agenda nunca some com uma venda ativa). Lê o documento,
// nunca o trava (a ordem global de travas, no topo). `null` quando não há nenhuma.
export async function vendaAtivaEmDataFutura(
  tx: TransacaoDoBanco,
  turmaId: string,
  hoje: string,
): Promise<{ data: string; numero: number } | null> {
  const [linha] = await tx
    .select({ data: eventos.data, numero: documentos.numero })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .innerJoin(documentos, eq(documentos.id, inscricoes.documentoId))
    .where(and(eq(eventos.turmaId, turmaId), gt(eventos.data, hoje), isNull(documentos.canceladoEm)))
    .orderBy(asc(eventos.data), asc(documentos.numero))
    .limit(1);
  return linha ? { data: linha.data, numero: Number(linha.numero) } : null;
}

// O que "Desativar turma" tira (a confirmação diz antes — CLAUDE.md §Exclusão): as datas com
// `data > hoje` (Assumption A14: saem, não são canceladas) e, entre as inscrições delas, as
// reposições — que voltam a ser crédito, porque o crédito é derivado das linhas.
export type PerdasAoDesativar = { datas: number; reposicoes: number };

export async function contarPerdasAoDesativar(
  leitor: LeitorDoBanco,
  turmaId: string,
  hoje: string,
): Promise<PerdasAoDesativar> {
  const seletor = leitor as Pick<TransacaoDoBanco, "select">;
  const [datas] = await seletor
    .select({ total: count() })
    .from(eventos)
    .where(and(eq(eventos.turmaId, turmaId), gt(eventos.data, hoje)));
  const [reposicoes] = await seletor
    .select({ total: count() })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .where(and(eq(eventos.turmaId, turmaId), gt(eventos.data, hoje), eq(inscricoes.tipo, "reposicao")));
  return { datas: Number(datas?.total ?? 0), reposicoes: Number(reposicoes?.total ?? 0) };
}

// Tira da agenda as datas FUTURAS da turma (`data > hoje`) e as inscrições delas. Trava as datas
// primeiro (`for update` — vão ser apagadas; a ordem TURMA → EVENTO → INSCRIÇÃO): quem estava
// colocando alguém numa delas termina antes, e a inscrição dele sai junto; quem chega depois acha a
// data apagada. Hoje e o passado ficam como estão. Devolve quantas datas saíram.
export async function tirarDatasFuturasDaTurma(
  tx: TransacaoDoBanco,
  turmaId: string,
  hoje: string,
): Promise<number> {
  const futuras = await tx
    .select({ id: eventos.id })
    .from(eventos)
    .where(and(eq(eventos.turmaId, turmaId), gt(eventos.data, hoje)))
    .for("update");
  if (futuras.length === 0) {
    return 0;
  }
  const ids = futuras.map((linha) => linha.id);
  await tx.delete(inscricoes).where(inArray(inscricoes.eventoId, ids));
  await tx.delete(eventos).where(and(inArray(eventos.id, ids), eq(eventos.turmaId, turmaId), gt(eventos.data, hoje)));
  return ids.length;
}

export type ClienteTravado = { id: string; nome: string };

// Trava a linha do CLIENTE até o fim da transação — o elo CLIENTE da ordem global de travas. `for no
// key update`, NUNCA a exclusiva: toda inscrição, mensalidade ou vínculo novo daquela pessoa pede
// `for key share` nesta linha (a chave estrangeira), e a exclusiva conflitaria com eles. Serializa
// duas decisões sobre a mesma pessoa (entrar e sair em dois celulares). `null` se ela não existe.
export async function travarCliente(tx: TransacaoDoBanco, clienteId: string): Promise<ClienteTravado | null> {
  const [linha] = await tx
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .for("no key update");
  return linha ?? null;
}

// Inscreve UMA pessoa como `aluno` em todas as datas da turma de HOJE em diante (`data >= hoje`, a
// aula de hoje conta — protótipo 331) e NÃO canceladas — "entrar na turma" (AGE-07). Roda sob a trava
// da TURMA, a mesma de "Marcar mais semanas": as datas que outro gestor criar depois de soltar a
// trava também recebem esta pessoa (`inscreverAlunosNasDatas` lê `turma_alunos`, que já a tem).
// `on conflict (evento_id, cliente_id) do nothing`: quem já está numa dessas datas (uma
// experimental — Assumption A13) fica como está. O aluno nunca paga pela data (`cobrar` falso).
export async function inscreverAlunoDaquiParaFrente(
  tx: TransacaoDoBanco,
  dados: { turmaId: string; clienteId: string; hoje: string; criadoPor: string },
): Promise<number> {
  const resultado = await tx.execute(sql`
    insert into inscricoes (evento_id, cliente_id, tipo, criado_por)
    select e.id, ${dados.clienteId}::uuid, 'aluno'::tipo_inscricao, ${dados.criadoPor}::uuid
      from eventos e
     where e.turma_id = ${dados.turmaId}::uuid
       and e.data >= ${dados.hoje}::date
       and e.cancelado_em is null
    on conflict (evento_id, cliente_id) do nothing
  `);
  return resultado.rowCount ?? 0;
}

// "Sair da turma" (AGE-07): tira a pessoa só das datas DEPOIS de hoje (`data > hoje`) e só das
// inscrições `tipo = 'aluno'` ainda sem presença. Fica tudo o que já existia de outra natureza: o
// passado e a aula de hoje, as reposições e experimentais marcadas (como no protótipo), e uma falta
// avisada antes (presença já marcada numa data futura — com o direito a repor, ela é crédito). A
// mensalidade já nascida não muda. Devolve quantas inscrições saíram.
export async function tirarAlunoDasDatasFuturas(
  tx: TransacaoDoBanco,
  dados: { turmaId: string; clienteId: string; hoje: string },
): Promise<number> {
  const resultado = await tx.execute(sql`
    delete from inscricoes i
     using eventos e
     where e.id = i.evento_id
       and e.turma_id = ${dados.turmaId}::uuid
       and e.data > ${dados.hoje}::date
       and i.cliente_id = ${dados.clienteId}::uuid
       and i.tipo = 'aluno'
       and i.presenca is null
  `);
  return resultado.rowCount ?? 0;
}

// Quem executa a instrução da D-02: o `db` (o carregamento da página) ou a transação de quem chama
// (`editarTurma`).
type ExecutorDoBanco = Pick<typeof db, "execute"> | Pick<TransacaoDoBanco, "execute">;

// D-02 — a mensalidade do mês nasce ao ABRIR a tela, sem rotina no dia 1 (AGE-16), numa instrução só:
// para cada vínculo ativo no dia 1 do mês de turma ATIVA, `insert … select … on conflict (turma_id,
// cliente_id, mes) do nothing`, com o valor da turma NESTE momento e o vencimento no dia da turma
// naquele mês (`dia_vencimento` vai até 28: `make_date` nunca cai num dia que o mês não tem).
//
// POR QUE UMA ESCRITA NO CARREGAMENTO (05-RESEARCH.md, Pergunta 8, opção A — aceita de propósito): ela
// é idempotente por construção e só materializa um fato determinístico do mês. Rodar duas vezes, em
// dois celulares, num prefetch ou num GET forjado dá o MESMO banco — a chave única
// `mensalidades_turma_cliente_mes_uk` garante, nunca uma leitura prévia de "já existe?". Nada de
// revalidar rota aqui: o Next proíbe isso no render, e a mesma requisição já lê depois de escrever.
//
// "Vínculo ativo no dia 1" = entrou ANTES do dia 1 (`entrou_em < dia 1`) e não tinha saído antes dele
// (`saiu_em` nulo ou `>= dia 1`): quem já estava na turma no dia 1 e saiu depois também tem a do mês
// (o resultado não pode depender de alguém ter aberto a Agenda no dia 1). Quem entrou DURANTE o mês —
// inclusive NO dia 1 — não é tocado: a ação "entrar na turma" já decidiu a mensalidade do mês da
// entrada (cheia, proporcional ou nenhuma, quando não sobra aula) na mesma transação.
//
// `turmaId` restringe a uma turma: `editarTurma` a chama DENTRO da sua transação e ANTES de gravar o
// valor novo (Pitfall 6) — a mensalidade do mês corrente nasce com o valor antigo e não muda.
export async function garantirMensalidadesDoMes(
  executor: ExecutorDoBanco,
  // "AAAA-MM".
  mes: string,
  turmaId?: string,
): Promise<number> {
  const primeiroDia = `${mes}-01`;
  const resultado = await executor.execute(sql`
    insert into mensalidades (turma_id, cliente_id, mes, valor_centavos, vencimento)
    select t.id, a.cliente_id, ${primeiroDia}::date, t.mensalidade_centavos,
           make_date(extract(year from ${primeiroDia}::date)::int, extract(month from ${primeiroDia}::date)::int, t.dia_vencimento)
      from turma_alunos a
      join turmas t on t.id = a.turma_id
     where t.ativa
       and a.entrou_em < ${primeiroDia}::date
       and (a.saiu_em is null or a.saiu_em >= ${primeiroDia}::date)
       ${turmaId === undefined ? sql`` : sql`and t.id = ${turmaId}::uuid`}
    on conflict (turma_id, cliente_id, mes) do nothing
  `);
  return resultado.rowCount ?? 0;
}

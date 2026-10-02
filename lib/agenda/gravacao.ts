// A escrita da Agenda que roda DENTRO de uma transação (Fase 5, plano 01).
//
// SEM a diretiva de Server Action, de propósito (05-RESEARCH.md Pattern 4; molde de
// `lib/producao/gravacao.ts`): toda função exportada de um arquivo com a diretiva vira endpoint —
// chamável pelo navegador — e `npm run verificar-acoes` exigiria `exigirUsuario()` na primeira
// linha de cada uma. Estas funções recebem a TRANSAÇÃO de quem chama (as ações de
// `lib/agenda/acoes.ts`), por isso só são alcançáveis de dentro do servidor, depois que a ação que
// as chama já autorizou o usuário.
//
// (Plano 08) Marcar presença e o direito a repor travam o EVENTO com `for share` ANTES da inscrição
// (`travarEventoParaLeitura`); a reposição trava EVENTO → CLIENTE e só então recalcula o crédito
// (Pitfall 7). Nenhum dos dois inverte a ordem abaixo.
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
import {
  clientes,
  documentos,
  eventos,
  inscricoes,
  itensCatalogo,
  mensalidades,
  parcelas,
  turmas,
  usosLivres,
  usosLivresMaterial,
} from "@/db/schema";
import { gravarMovimentacoes, travarItens, type TransacaoDoBanco } from "@/lib/estoque/gravacao";
import { pedidoDeSaidaManual } from "@/lib/estoque/pedidos";
import { FRASE_MATERIAL_NAO_EXISTE_MAIS } from "@/lib/estoque/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";

import {
  FRASE_ORIGEM_NAO_ACHADA,
  fraseDesativarComVendaAtiva,
  fraseMaterialDesativadoNoUso,
  fraseMaterialPerdeuPreco,
  fraseOrigemJaLancada,
} from "./textos";
import {
  descricaoDaLinha,
  situacaoDaCobranca,
  type CobrancaDaAgenda,
  type MaterialDoUsoNaCobranca,
  type TipoDeCobranca,
  type VendaLigada,
} from "./receber";
import type { EstadoUsoLivre, Presenca, TipoEvento, TipoInscricao } from "./tipos";
import { valorDoMaterial } from "./uso-livre";

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
  // A turma da data (só no tipo `turma`): a experimental confere se a pessoa já é aluna dela (D-07).
  turmaId: string | null;
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
      turmaId: eventos.turmaId,
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

export type EventoLidoSobTrava = { id: string; tipo: TipoEvento; cancelado: boolean };

// Trava a linha do EVENTO para LEITURA (`for share`) até o fim da transação — o elo EVENTO de quem só
// precisa que a data não mude de estado enquanto decide: marcar presença e o direito a repor (AGE-04,
// T-05-39). `for share` convive com outro `for share` (dois celulares marcando a mesma turma não se
// esperam) e com o `for key share` das inscrições novas, mas EXCLUI o `for no key update` de
// `cancelarData`: cancelar e marcar ao mesmo tempo terminam coerentes — se o cancelamento vem antes, a
// marcação lê `cancelado` e recusa; se vem depois, ele espera a marcação e a limpa. `null` se o evento
// não existe.
export async function travarEventoParaLeitura(tx: TransacaoDoBanco, eventoId: string): Promise<EventoLidoSobTrava | null> {
  const [linha] = await tx
    .select({ id: eventos.id, tipo: eventos.tipo, canceladoEm: eventos.canceladoEm })
    .from(eventos)
    .where(eq(eventos.id, eventoId))
    .for("share");
  if (!linha) {
    return null;
  }
  return { id: linha.id, tipo: linha.tipo, cancelado: linha.canceladoEm !== null };
}

// O evento de uma inscrição, lido SEM trava — só para saber QUAL evento travar primeiro (a ordem
// EVENTO → INSCRIÇÃO). `evento_id` nunca muda numa inscrição; se ela sumir entre esta leitura e a trava,
// `travarInscricao` devolve `null`. `null` se ela não existe.
export async function eventoDaInscricao(tx: TransacaoDoBanco, inscricaoId: string): Promise<string | null> {
  const [linha] = await tx
    .select({ eventoId: inscricoes.eventoId })
    .from(inscricoes)
    .where(eq(inscricoes.id, inscricaoId));
  return linha?.eventoId ?? null;
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
  // A inscrição cobra (oficina, experimental cobrada) — o toast de "tirar da lista" e de "A receber".
  cobrar: boolean;
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
//
// CR-01: TRAVA e RELÊ (`travarEReler`). Se um "Recebi agora" ou "Lançar na Venda" ligou esta inscrição a
// uma venda enquanto esperávamos a trava, a instrução que esperou devolveria a venda NULA (o LEFT JOIN
// em `documentos` vem do retrato antigo) e "Tirar da lista" apagaria uma venda ativa. A releitura vê a
// venda confirmada.
export async function travarInscricaoComVenda(
  tx: TransacaoDoBanco,
  inscricaoId: string,
): Promise<InscricaoComVenda | null> {
  const [linha] = await travarEReler(
    tx
      .select({
        id: inscricoes.id,
        eventoId: inscricoes.eventoId,
        clienteId: inscricoes.clienteId,
        nome: clientes.nome,
        tipo: inscricoes.tipo,
        cobrar: inscricoes.cobrar,
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
      .for("no key update", { of: inscricoes }),
  );
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
//
// WR-01 (revisão da Fase 5): "Recebi agora" e "Lançar na Venda" numa experimental cobrada destas datas
// travam só a INSCRIÇÃO — nunca a turma nem o evento —, então a conferência de venda ativa feita sob a
// trava da turma não basta: a venda pode nascer entre ela e o `delete`, que esperaria a trava da
// inscrição e a apagaria mesmo assim (D-08 quebrada, venda órfã). Por isso as inscrições também são
// TRAVADAS (`for update`, em ordem de id) e a venda ativa é conferida DE NOVO numa instrução nova, depois
// dessa trava — quem estava lançando já confirmou e aparece; quem chega depois espera o fim desta
// transação e não acha mais a inscrição. Venda ativa achada → `RecusaDaAgenda`, nada apagado.
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
  await tx
    .select({ id: inscricoes.id })
    .from(inscricoes)
    .where(inArray(inscricoes.eventoId, ids))
    .orderBy(asc(inscricoes.id))
    .for("update");
  const venda = await vendaAtivaEmDataFutura(tx, turmaId, hoje);
  if (venda !== null) {
    throw new RecusaDaAgenda(fraseDesativarComVendaAtiva(formatarDiaMes(venda.data), venda.numero));
  }
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
// "Sem aula, sem mensalidade" (decisão do dono, 02/10/2026, ao corrigir o WR-03 da revisão): só nasce a
// mensalidade de um mês em que a turma tem PELO MENOS UMA data NÃO cancelada — a mesma regra de "entrar
// na turma", que não cria nenhuma quando não sobra aula no mês (`valorProporcional` → "nenhuma"). Turma
// lançada "a partir de" um mês futuro, ou cujas semanas marcadas acabaram, não cobra o mês vazio. Uma
// mensalidade que já nasceu nunca é apagada por isso (cancelar as datas depois não a desfaz).
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
       and exists (
             select 1
               from eventos e
              where e.turma_id = t.id
                and e.cancelado_em is null
                and e.data >= ${primeiroDia}::date
                and e.data < (${primeiroDia}::date + interval '1 month')::date
           )
       ${turmaId === undefined ? sql`` : sql`and t.id = ${turmaId}::uuid`}
    on conflict (turma_id, cliente_id, mes) do nothing
  `);
  return resultado.rowCount ?? 0;
}

export type UsoLivreTravado = {
  id: string;
  clienteId: string;
  data: string;
  chegadaPrevista: string;
  horasPrevistas: number;
  pessoas: number;
  estado: EstadoUsoLivre;
  // "HH:MM:SS" do `pg` (Pitfall 9) — nulo enquanto reservado.
  chegada: string | null;
};

// Trava a linha do USO LIVRE até o fim da transação (`for no key update` — o elo USO LIVRE da ordem
// global; nunca a exclusiva: a baixa do Estoque do plano 10 pede `for key share` nesta linha pela
// chave estrangeira `movimentacoes_estoque.uso_livre_id`). Serializa duas decisões sobre o mesmo uso:
// dois encerramentos, "Chegou" e "Cancelar reserva" em dois celulares (T-05-43, T-05-44). `null` se ele
// não existe (reserva cancelada em outro celular).
export async function travarUsoLivre(tx: TransacaoDoBanco, usoLivreId: string): Promise<UsoLivreTravado | null> {
  const [linha] = await tx
    .select({
      id: usosLivres.id,
      clienteId: usosLivres.clienteId,
      data: usosLivres.data,
      chegadaPrevista: usosLivres.chegadaPrevista,
      horasPrevistas: usosLivres.horasPrevistas,
      pessoas: usosLivres.pessoas,
      estado: usosLivres.estado,
      chegada: usosLivres.chegada,
    })
    .from(usosLivres)
    .where(eq(usosLivres.id, usoLivreId))
    .for("no key update");
  return linha ?? null;
}

// ── A baixa do material do uso livre (plano 10 — AGE-14, D-06, D-14) ────────────────────────────────

// Uma linha de `usos_livres_material` ainda sem baixa, lida pela ação SOB a trava do uso.
export type MaterialParaBaixar = {
  id: string;
  itemId: string;
  quantidadeMilesimos: number;
  cobrar: boolean;
};

// O que a ação grava de volta em cada linha: a saída do livro e, no cobrado, o preço de venda daquele
// momento e o valor (D-14 — congelados; mudar o preço depois não muda nada).
export type MaterialBaixado = {
  id: string;
  movimentacaoId: string;
  precoUnitarioCentavos: number | null;
  valorCentavos: number | null;
};

// A nota congelada da saída: "{nome} · {dd/mm}" — o histórico do Estoque a mostra como vínculo
// ("Uso livre do espaço · paga por Espaço · {nome} · {dd/mm} · {R$}"). O check
// `movimentacoes_estoque_nota_comprimento` aceita até 160 caracteres e o nome da pessoa pode ter 160:
// o NOME é cortado (em pontos de código, como o `length()` do Postgres conta) para a data caber sempre.
const LIMITE_DA_NOTA = 160;
function notaDoUsoLivre(nome: string, diaMes: string): string {
  const sufixo = ` · ${diaMes}`;
  const nomeLimpo = [...nome.normalize("NFC").trim()].slice(0, LIMITE_DA_NOTA - [...sufixo].length).join("").trim();
  return `${nomeLimpo}${sufixo}`;
}

// A baixa do material ao ENCERRAR, dentro da transação de `encerrarUsoLivre`, DEPOIS de travar o uso
// (ordem USO LIVRE → ITENS — a mesma "registro → itens" do sistema; nenhuma trava de documento). UMA
// saída por linha, inclusive as "incluso" (D-06: o Estoque passa a dizer quanto o uso livre consome),
// pela porta única do livro — `pedidoDeSaidaManual` (destino `uso_livre`, área Espaço por
// `areaDoDestino`, o vínculo `usoLivreId`) e `gravarMovimentacoes` (custo médio do momento, sob a trava
// dos ITENS). A Agenda nunca escreve em `movimentacoes_estoque` direto. Saldo insuficiente segue a regra
// da saída manual da Fase 6 (negativo é permitido, D-06 da 06) — nenhuma regra nova aqui.
//
// Recusa (RecusaDaAgenda, nada gravado — a transação inteira volta): item que sumiu ou perdeu o estoque
// próprio, item desativado no meio, e item COBRADO que perdeu o preço de venda (D-14). O mesmo material
// em duas linhas vira duas saídas (Pitfall 4). Sem material, nada é gravado.
export async function baixarMaterialDoUso(
  tx: TransacaoDoBanco,
  uso: { id: string; data: string; nome: string },
  materiais: readonly MaterialParaBaixar[],
  registradoPor: string,
): Promise<MaterialBaixado[]> {
  if (materiais.length === 0) {
    return [];
  }
  const ids = materiais.map((material) => material.itemId);
  // ITENS travados (a mesma trava que `gravarMovimentacoes` pede de novo, já segura): o "ativo" e o
  // preço lidos aqui valem até o fim da transação.
  const travados = await travarItens(tx, ids);
  const precos = new Map(
    (
      await tx
        .select({ id: itensCatalogo.id, preco: itensCatalogo.precoVendaCentavos })
        .from(itensCatalogo)
        .where(inArray(itensCatalogo.id, [...new Set(ids)]))
    ).map((linha) => [linha.id, linha.preco]),
  );

  for (const material of materiais) {
    const item = travados.get(material.itemId);
    if (!item || !item.controlaEstoque || item.unidade === null) {
      throw new RecusaDaAgenda(FRASE_MATERIAL_NAO_EXISTE_MAIS);
    }
    if (!item.ativo) {
      throw new RecusaDaAgenda(fraseMaterialDesativadoNoUso(item.nome));
    }
    if (material.cobrar && (precos.get(material.itemId) ?? null) === null) {
      throw new RecusaDaAgenda(fraseMaterialPerdeuPreco(item.nome));
    }
  }

  const nota = notaDoUsoLivre(uso.nome, formatarDiaMes(uso.data));
  const pedidos = materiais.map((material) =>
    pedidoDeSaidaManual({
      itemId: material.itemId,
      milesimos: material.quantidadeMilesimos,
      destino: "uso_livre",
      usoLivreId: uso.id,
      nota,
    }),
  );
  const gravadas = await gravarMovimentacoes(tx, pedidos, { registradoPor });

  return materiais.map((material, indice) => {
    const gravada = gravadas[indice];
    if (!gravada) {
      throw new Error("baixarMaterialDoUso: uma saída não voltou de gravarMovimentacoes.");
    }
    const preco = material.cobrar ? (precos.get(material.itemId) ?? null) : null;
    return {
      id: material.id,
      movimentacaoId: gravada.id,
      precoUnitarioCentavos: preco,
      valorCentavos: preco === null ? null : valorDoMaterial(material.quantidadeMilesimos, preco),
    };
  });
}

// ── A cobrança da Agenda e a venda dela (plano 11 — AGE-15, D-01, D-08) ────────────────────────────────
//
// Três tabelas cobram: `mensalidades`, `inscricoes` (cobradas — oficina e experimental cobrada) e
// `usos_livres` (encerrados). Nenhuma guarda dinheiro recebido: o vínculo `documento_id` aponta a venda do
// Financeiro, e “pago” é derivado das parcelas dela (`situacaoDaCobranca`, módulo puro). A mesma leitura
// serve à lista de “A receber” (sem trava, pelo `db`) e ao “Recebi agora” (`travarCobranca`, sob a trava da
// cobrança): os campos que a venda usa — valor, descrição, cliente — vêm SEMPRE daqui, nunca do navegador.

export type ReferenciaDaCobranca = { tipo: TipoDeCobranca; id: string };

type LeitorDeCobrancas = Pick<TransacaoDoBanco, "select">;

type FiltroDeCobrancas = {
  // Só uma cobrança (o “Recebi agora”).
  id?: string;
  // Só estas mensalidades (o lote — plano 12), travadas em ordem de id.
  ids?: readonly string[];
  // Só as que podem estar em “A receber”: sem venda ATIVA e não dispensadas — o resto da regra é do puro.
  soLivres?: boolean;
  // `for no key update` na linha da cobrança (a venda ligada é LIDA, nunca travada).
  travar?: boolean;
  // (Plano 13 — as tags de pagamento fora de “A receber”, só leitura.) Só destas pessoas (as três tabelas).
  clienteIds?: readonly string[];
  // Só as inscrições destas datas (a folha e o cartão do evento).
  eventoIds?: readonly string[];
  // Só as mensalidades desta turma e deste mês (“AAAA-MM-01”) — a tag do aluno na data de turma.
  turmaId?: string;
  mes?: string;
  // Só estes usos livres (o cartão da semana).
  usoIds?: readonly string[];
};

// CR-01 (revisão da Fase 5): TRAVA numa instrução e RELÊ noutra. Sob READ COMMITTED, quem esperou a
// trava de uma linha que outra transação ATUALIZOU relê só a linha travada (EvalPlanQual) — as tabelas
// do LEFT JOIN que não estão travadas (`documentos`) voltam do retrato ANTIGO, e o lado anulável vem
// NULO. Na corrida de dois "Recebi agora" (ou "Recebi agora" × "Lançar na Venda" × lote) o segundo via o
// `documento_id` novo com `numero` nulo e passava pela guarda: duas vendas ativas para uma cobrança. A
// segunda instrução tira um retrato NOVO com a trava já garantida — `documento_id` não muda mais (a linha
// é desta transação até o fim) e o número e o `cancelado_em` da venda vêm do que está confirmado AGORA.
// Repetir a trava na releitura não espera nada: ela já é desta transação. (Uma `QueryPromise` do Drizzle
// executa de novo a cada `await`.)
async function travarEReler<T>(consultaTravada: PromiseLike<T>): Promise<T> {
  await consultaTravada;
  return await consultaTravada;
}

function vendaLigada(linha: {
  documentoId: string | null;
  numeroDaVenda: number | null;
  vendaCanceladaEm: Date | null;
  dispensadaEm?: Date | null;
}): VendaLigada {
  return {
    documentoId: linha.documentoId,
    numeroDaVenda: linha.numeroDaVenda,
    canceladoEm: linha.vendaCanceladaEm === null ? null : linha.vendaCanceladaEm.toISOString(),
    // Preenchido depois por `contarParcelasEmAberto` (só as vendas ativas têm o que contar).
    parcelasEmAberto: 0,
    dispensadaEm: linha.dispensadaEm ? linha.dispensadaEm.toISOString() : null,
  };
}

async function lerMensalidadesCobradas(leitor: LeitorDeCobrancas, filtro: FiltroDeCobrancas): Promise<CobrancaDaAgenda[]> {
  const consulta = leitor
    .select({
      id: mensalidades.id,
      clienteId: mensalidades.clienteId,
      nome: clientes.nome,
      valorCentavos: mensalidades.valorCentavos,
      turma: turmas.nome,
      mes: mensalidades.mes,
      vencimento: mensalidades.vencimento,
      aulasRestantes: mensalidades.aulasRestantes,
      documentoId: mensalidades.documentoId,
      numeroDaVenda: documentos.numero,
      vendaCanceladaEm: documentos.canceladoEm,
      dispensadaEm: mensalidades.dispensadaEm,
    })
    .from(mensalidades)
    .innerJoin(clientes, eq(clientes.id, mensalidades.clienteId))
    .innerJoin(turmas, eq(turmas.id, mensalidades.turmaId))
    .leftJoin(documentos, eq(documentos.id, mensalidades.documentoId))
    .where(
      and(
        filtro.id === undefined ? undefined : eq(mensalidades.id, filtro.id),
        filtro.ids === undefined ? undefined : inArray(mensalidades.id, [...filtro.ids]),
        filtro.clienteIds === undefined ? undefined : inArray(mensalidades.clienteId, [...filtro.clienteIds]),
        filtro.turmaId === undefined ? undefined : eq(mensalidades.turmaId, filtro.turmaId),
        filtro.mes === undefined ? undefined : eq(mensalidades.mes, filtro.mes),
        filtro.soLivres
          ? and(or(isNull(mensalidades.documentoId), isNotNull(documentos.canceladoEm)), isNull(mensalidades.dispensadaEm))
          : undefined,
      ),
    )
    // Em ordem de id: o lote trava as mensalidades nesta ordem, e dois lotes ao mesmo tempo nunca se
    // travam em ordem inversa (plano 12).
    .orderBy(asc(mensalidades.id));
  const linhas = filtro.travar
    ? await travarEReler(consulta.for("no key update", { of: mensalidades }))
    : await consulta;
  return linhas.map((linha) => ({
    tipo: "mensalidade" as const,
    id: linha.id,
    clienteId: linha.clienteId,
    nome: linha.nome,
    valorCentavos: linha.valorCentavos,
    turma: linha.turma,
    mes: linha.mes,
    vencimento: linha.vencimento,
    proporcional: linha.aulasRestantes !== null,
    ...vendaLigada(linha),
  }));
}

async function lerInscricoesCobradas(leitor: LeitorDeCobrancas, filtro: FiltroDeCobrancas): Promise<CobrancaDaAgenda[]> {
  const consulta = leitor
    .select({
      id: inscricoes.id,
      clienteId: inscricoes.clienteId,
      nome: clientes.nome,
      valorCentavos: inscricoes.valorCentavos,
      tipo: inscricoes.tipo,
      tituloDoEvento: eventos.titulo,
      nomeDaTurma: turmas.nome,
      data: eventos.data,
      eventoCanceladoEm: eventos.canceladoEm,
      documentoId: inscricoes.documentoId,
      numeroDaVenda: documentos.numero,
      vendaCanceladaEm: documentos.canceladoEm,
      dispensadaEm: inscricoes.dispensadaEm,
    })
    .from(inscricoes)
    .innerJoin(eventos, eq(eventos.id, inscricoes.eventoId))
    .innerJoin(clientes, eq(clientes.id, inscricoes.clienteId))
    .leftJoin(turmas, eq(turmas.id, eventos.turmaId))
    .leftJoin(documentos, eq(documentos.id, inscricoes.documentoId))
    .where(
      and(
        // Só a inscrição que COBRA: oficina e experimental cobrada. Aluno paga pela mensalidade;
        // reposição e experimental gratuita nunca cobram (checks da 0026).
        eq(inscricoes.cobrar, true),
        filtro.id === undefined ? undefined : eq(inscricoes.id, filtro.id),
        filtro.clienteIds === undefined ? undefined : inArray(inscricoes.clienteId, [...filtro.clienteIds]),
        filtro.eventoIds === undefined ? undefined : inArray(inscricoes.eventoId, [...filtro.eventoIds]),
        filtro.soLivres
          ? and(
              or(isNull(inscricoes.documentoId), isNotNull(documentos.canceladoEm)),
              isNull(inscricoes.dispensadaEm),
              isNull(eventos.canceladoEm),
            )
          : undefined,
      ),
    );
  const linhas = filtro.travar
    ? await travarEReler(consulta.for("no key update", { of: inscricoes }))
    : await consulta;
  return linhas.map((linha) => {
    const experimental = linha.tipo === "experimental";
    // A experimental é numa data de turma (o título é o nome da turma, lido ao vivo — a data de turma
    // não guarda título); a oficina tem o título do evento.
    const titulo = experimental
      ? (linha.nomeDaTurma ?? linha.tituloDoEvento ?? "")
      : (linha.tituloDoEvento ?? linha.nomeDaTurma ?? "");
    return {
      tipo: "inscricao" as const,
      id: linha.id,
      clienteId: linha.clienteId,
      nome: linha.nome,
      // Não-nulo na inscrição que cobra (check `inscricoes_cobrar_com_valor`).
      valorCentavos: linha.valorCentavos ?? 0,
      experimental,
      titulo,
      data: linha.data,
      dataCancelada: linha.eventoCanceladoEm !== null,
      ...vendaLigada(linha),
    };
  });
}

async function lerUsosLivresCobrados(leitor: LeitorDeCobrancas, filtro: FiltroDeCobrancas): Promise<CobrancaDaAgenda[]> {
  const consulta = leitor
    .select({
      id: usosLivres.id,
      clienteId: usosLivres.clienteId,
      nome: clientes.nome,
      valorCentavos: usosLivres.valorCentavos,
      horas: usosLivres.horasCheias,
      pessoas: usosLivres.pessoas,
      precoHoraCentavos: usosLivres.precoHoraCentavos,
      data: usosLivres.data,
      documentoId: usosLivres.documentoId,
      numeroDaVenda: documentos.numero,
      vendaCanceladaEm: documentos.canceladoEm,
    })
    .from(usosLivres)
    .innerJoin(clientes, eq(clientes.id, usosLivres.clienteId))
    .leftJoin(documentos, eq(documentos.id, usosLivres.documentoId))
    .where(
      and(
        // Só o uso ENCERRADO cobra (o valor nasce no encerramento — check `usos_livres_encerrado_completo`).
        eq(usosLivres.estado, "encerrado"),
        filtro.id === undefined ? undefined : eq(usosLivres.id, filtro.id),
        filtro.clienteIds === undefined ? undefined : inArray(usosLivres.clienteId, [...filtro.clienteIds]),
        filtro.usoIds === undefined ? undefined : inArray(usosLivres.id, [...filtro.usoIds]),
        filtro.soLivres ? or(isNull(usosLivres.documentoId), isNotNull(documentos.canceladoEm)) : undefined,
      ),
    );
  const linhas = filtro.travar
    ? await travarEReler(consulta.for("no key update", { of: usosLivres }))
    : await consulta;
  if (linhas.length === 0) {
    return [];
  }

  // O material de cada uso, na ordem em que foi acrescentado — o cobrado vira linha LIVRE da venda (D-14),
  // com o valor CONGELADO no encerramento. Lido depois da trava do uso (encerrado, a lista não muda mais).
  const materiais = await leitor
    .select({
      usoLivreId: usosLivresMaterial.usoLivreId,
      nome: itensCatalogo.nome,
      unidade: itensCatalogo.unidade,
      quantidadeMilesimos: usosLivresMaterial.quantidadeMilesimos,
      cobrar: usosLivresMaterial.cobrar,
      valorCentavos: usosLivresMaterial.valorCentavos,
    })
    .from(usosLivresMaterial)
    .innerJoin(itensCatalogo, eq(itensCatalogo.id, usosLivresMaterial.itemId))
    .where(inArray(usosLivresMaterial.usoLivreId, linhas.map((linha) => linha.id)))
    .orderBy(asc(usosLivresMaterial.criadoEm), asc(usosLivresMaterial.id));
  const materiaisPorUso = new Map<string, MaterialDoUsoNaCobranca[]>();
  for (const { usoLivreId, unidade, ...material } of materiais) {
    const doUso = materiaisPorUso.get(usoLivreId) ?? [];
    doUso.push({ ...material, unidade: unidade ?? "un" });
    materiaisPorUso.set(usoLivreId, doUso);
  }

  return linhas.map((linha) => ({
    tipo: "uso_livre" as const,
    id: linha.id,
    clienteId: linha.clienteId,
    nome: linha.nome,
    // Não-nulos no encerrado (check `usos_livres_encerrado_completo`).
    valorCentavos: linha.valorCentavos ?? 0,
    horas: linha.horas ?? 0,
    pessoas: linha.pessoas,
    precoHoraCentavos: linha.precoHoraCentavos ?? 0,
    data: linha.data,
    materiais: materiaisPorUso.get(linha.id) ?? [],
    ...vendaLigada({ ...linha, dispensadaEm: null }),
  }));
}

// Quantas parcelas em aberto tem cada venda ATIVA ligada — `lancado` (alguma) ou `pago` (nenhuma). Uma
// consulta só, pelo índice `parcelas_documento_idx`; venda cancelada ou ausente não precisa contar.
async function contarParcelasEmAberto(
  leitor: LeitorDeCobrancas,
  cobrancas: CobrancaDaAgenda[],
): Promise<CobrancaDaAgenda[]> {
  const ativas = [
    ...new Set(
      cobrancas.flatMap((cobranca) =>
        cobranca.documentoId !== null && cobranca.canceladoEm === null ? [cobranca.documentoId] : [],
      ),
    ),
  ];
  if (ativas.length === 0) {
    return cobrancas;
  }
  const contagens = await leitor
    .select({ documentoId: parcelas.documentoId, emAberto: count() })
    .from(parcelas)
    .where(and(inArray(parcelas.documentoId, ativas), isNull(parcelas.pagoEm)))
    .groupBy(parcelas.documentoId);
  const porDocumento = new Map(contagens.map((linha) => [linha.documentoId, Number(linha.emAberto)]));
  return cobrancas.map((cobranca) =>
    cobranca.documentoId === null
      ? cobranca
      : { ...cobranca, parcelasEmAberto: porDocumento.get(cobranca.documentoId) ?? 0 },
  );
}

// As cobranças da Agenda, das três tabelas — `soLivres` para “A receber” (sem venda ativa, não
// dispensadas). Sem trava: a lista é leitura; quem decide é o “Recebi agora”, sob a trava. `tipos` (plano
// 13) diz quais tabelas ler; os outros filtros recortam cada uma (as tags de pagamento — só leitura).
export async function lerCobrancas(
  leitor: LeitorDeCobrancas,
  filtro: Omit<FiltroDeCobrancas, "id" | "ids" | "travar"> & { tipos?: readonly TipoDeCobranca[] } = {},
): Promise<CobrancaDaAgenda[]> {
  const { tipos, ...doFiltro } = filtro;
  const ler = (tipo: TipoDeCobranca) => tipos === undefined || tipos.includes(tipo);
  const doMes = ler("mensalidade") ? await lerMensalidadesCobradas(leitor, doFiltro) : [];
  const inscritas = ler("inscricao") ? await lerInscricoesCobradas(leitor, doFiltro) : [];
  const usos = ler("uso_livre") ? await lerUsosLivresCobrados(leitor, doFiltro) : [];
  return contarParcelasEmAberto(leitor, [...doMes, ...inscritas, ...usos]);
}

// Trava a linha da COBRANÇA (`for no key update` — o elo MENSALIDADE / INSCRIÇÃO / USO LIVRE da ordem
// global) e devolve tudo o que a venda precisa, lido sob a trava: dois “Recebi agora” na mesma cobrança
// (toque duplo, dois celulares) se enfileiram aqui, e o segundo lê o `documento_id` que o primeiro gravou
// E a venda por trás dele: o número e o `cancelado_em` vêm da RELEITURA feita depois da trava
// (`travarEReler`, CR-01), nunca da instrução que esperou. A venda ligada é LIDA, nunca travada: a Agenda
// não trava documento existente, então não fecha ciclo com `cancelarDocumento` (DOCUMENTO → ORDEM → ITENS).
// `null` se a cobrança não existe (ou não cobra).
export async function travarCobranca(
  tx: TransacaoDoBanco,
  cobranca: ReferenciaDaCobranca,
): Promise<CobrancaDaAgenda | null> {
  return cobrancaPorReferencia(tx, cobranca, true);
}

// A mesma leitura, sem trava — a folha do uso livre encerrado (e a ficha, no plano 13) mostram a situação.
export async function lerCobranca(
  leitor: LeitorDeCobrancas,
  cobranca: ReferenciaDaCobranca,
): Promise<CobrancaDaAgenda | null> {
  return cobrancaPorReferencia(leitor, cobranca, false);
}

async function cobrancaPorReferencia(
  leitor: LeitorDeCobrancas,
  cobranca: ReferenciaDaCobranca,
  travar: boolean,
): Promise<CobrancaDaAgenda | null> {
  const filtro = { id: cobranca.id, travar };
  const linhas =
    cobranca.tipo === "mensalidade"
      ? await lerMensalidadesCobradas(leitor, filtro)
      : cobranca.tipo === "inscricao"
        ? await lerInscricoesCobradas(leitor, filtro)
        : await lerUsosLivresCobrados(leitor, filtro);
  const [lida] = await contarParcelasEmAberto(leitor, linhas);
  return lida ?? null;
}

// O vínculo cobrança → venda, NA MESMA transação da venda e sob a trava da cobrança (Pitfall 8): uma
// cobrança nunca vira duas vendas ativas. Uma venda cancelada antes é sobrescrita — ela continua no
// Caixa, cancelada, e a cobrança passa a apontar a nova (D-08).
export async function vincularVenda(
  tx: TransacaoDoBanco,
  cobranca: ReferenciaDaCobranca,
  documentoId: string,
): Promise<void> {
  const valores = { documentoId, atualizadoEm: new Date() };
  if (cobranca.tipo === "mensalidade") {
    await tx.update(mensalidades).set(valores).where(eq(mensalidades.id, cobranca.id));
  } else if (cobranca.tipo === "inscricao") {
    await tx.update(inscricoes).set(valores).where(eq(inscricoes.id, cobranca.id));
  } else {
    await tx.update(usosLivres).set(valores).where(eq(usosLivres.id, cobranca.id));
  }
}

// ── “Lançar na Venda” (plano 12 — AGE-15, D-01, D-04, D-08, Pitfall 8) ──────────────────────────────────

// O item do sistema de cada tipo de cobrança, pela CHAVE (D-17) — o mesmo que `linhasDaVenda` usa: a
// inscrição (oficina ou experimental cobrada) vai no item “Inscrição em oficina”.
const CHAVE_DO_ITEM_DA_COBRANCA = {
  mensalidade: "mensalidade",
  inscricao: "inscricao_oficina",
  uso_livre: "uso_livre_hora",
} as const satisfies Record<TipoDeCobranca, string>;

export type CobrancaVinculada = {
  // D-01: o cliente da cobrança e o nome dele AGORA — `lancarVenda` sobrescreve `pessoa_nome`/`cliente_id`.
  clienteId: string;
  clienteNome: string;
  // D-04: a descrição da linha de origem, derivada da cobrança — nunca a que o navegador mandou.
  descricao: string;
  // A linha de origem da venda é a PRIMEIRA linha com este item.
  itemDoSistemaId: string;
  // Grava o vínculo cobrança → venda; chamado DEPOIS de `gravarVenda`, na mesma transação.
  gravar: (documentoId: string) => Promise<void>;
};

// A metade da Agenda do “Lançar na Venda” — chamada por `lancarVenda` (lib/financeiro/acoes.ts) DENTRO da
// transação e ANTES de `gravarVenda` (a ordem de travas: COBRANÇA → documento novo → ITENS). Trava a
// cobrança (`for no key update`) e confere, sob a trava, que ela está livre: sem venda ou com a venda
// cancelada (D-08), não dispensada, com valor e — na inscrição — com a data de pé. Senão lança
// `RecusaDaAgenda` com a frase da tela (nada foi gravado). Dois “Lançar na Venda”, ou um deles com o
// “Recebi agora” ou com o lote, se enfileiram aqui: o segundo lê o `documento_id` do primeiro.
export async function vincularCobranca(
  tx: TransacaoDoBanco,
  origem: ReferenciaDaCobranca,
): Promise<CobrancaVinculada> {
  const cobranca = await travarCobranca(tx, origem);
  if (!cobranca) {
    throw new RecusaDaAgenda(FRASE_ORIGEM_NAO_ACHADA);
  }
  const situacao = situacaoDaCobranca(cobranca);
  // A guarda decide pela situação (derivada do `documento_id` da linha TRAVADA), nunca pela presença do
  // número — CR-01: venda ativa recusa sempre; o número só escolhe a frase.
  if (situacao === "lancado" || situacao === "pago") {
    throw new RecusaDaAgenda(
      cobranca.numeroDaVenda !== null ? fraseOrigemJaLancada(cobranca.numeroDaVenda) : FRASE_ORIGEM_NAO_ACHADA,
    );
  }
  if (
    situacao === "dispensada" ||
    cobranca.valorCentavos <= 0 ||
    (cobranca.tipo === "inscricao" && cobranca.dataCancelada)
  ) {
    throw new RecusaDaAgenda(FRASE_ORIGEM_NAO_ACHADA);
  }

  const [item] = await tx
    .select({ id: itensCatalogo.id })
    .from(itensCatalogo)
    .where(eq(itensCatalogo.chaveDoSistema, CHAVE_DO_ITEM_DA_COBRANCA[cobranca.tipo]));
  if (!item) {
    // Defeito (o item do sistema não se apaga — 0026): cai na falha genérica de quem chama.
    throw new Error(`vincularCobranca: o item do sistema “${CHAVE_DO_ITEM_DA_COBRANCA[cobranca.tipo]}” sumiu.`);
  }

  return {
    clienteId: cobranca.clienteId,
    clienteNome: cobranca.nome,
    descricao: descricaoDaLinha(cobranca),
    itemDoSistemaId: item.id,
    gravar: (documentoId) => vincularVenda(tx, origem, documentoId),
  };
}

// ── O lote de mensalidades (plano 12 — AGE-16) ───────────────────────────────────────────────────────────

// Trava as MENSALIDADES pedidas (`for no key update ... of mensalidades`, em ordem de id — dois lotes ao
// mesmo tempo nunca se travam em ordem inversa) e devolve cada uma lida sob a trava, com a venda ligada e
// as parcelas em aberto. Id que não é de mensalidade não volta (T-05-60): o lote só lê `mensalidades`.
export async function travarMensalidades(
  tx: TransacaoDoBanco,
  ids: readonly string[],
): Promise<CobrancaDaAgenda[]> {
  if (ids.length === 0) {
    return [];
  }
  return contarParcelasEmAberto(tx, await lerMensalidadesCobradas(tx, { ids, travar: true }));
}

// ── Dispensar uma cobrança (plano 13 — D-09) ─────────────────────────────────────────────────────────────

// Grava (ou limpa, ao desfazer) o carimbo da dispensa — `dispensada_em`, `dispensada_por` e o motivo — na
// linha da cobrança, SOB A TRAVA que quem chama já tomou com `travarCobranca` (a mesma do “Recebi agora”,
// do “Lançar na Venda” e do lote: dispensar e lançar ao mesmo tempo nunca terminam dispensada E vendida).
// NUNCA apaga a linha (D-09; `mensalidades` nem tem permissão de `delete`): só um `update`.
export async function gravarDispensa(
  tx: TransacaoDoBanco,
  cobranca: { tipo: "mensalidade" | "inscricao"; id: string },
  dispensa: { em: Date; por: string; motivo: string | null } | null,
): Promise<void> {
  const valores = {
    dispensadaEm: dispensa?.em ?? null,
    dispensadaPor: dispensa?.por ?? null,
    motivoDispensa: dispensa?.motivo ?? null,
    atualizadoEm: new Date(),
  };
  if (cobranca.tipo === "mensalidade") {
    await tx.update(mensalidades).set(valores).where(eq(mensalidades.id, cobranca.id));
  } else {
    await tx.update(inscricoes).set(valores).where(eq(inscricoes.id, cobranca.id));
  }
}

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
import { and, count, eq, isNotNull, isNull, or } from "drizzle-orm";

import type { db } from "@/db";
import { clientes, documentos, eventos, inscricoes } from "@/db/schema";
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

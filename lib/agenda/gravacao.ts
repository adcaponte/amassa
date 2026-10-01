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
import { eq } from "drizzle-orm";

import { eventos, inscricoes } from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";

import type { Presenca, TipoInscricao } from "./tipos";

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

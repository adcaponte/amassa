// A escrita das Queimas que roda DENTRO de uma transação (Fase 06.4 — contagem e vendas das
// externas).
//
// SEM a diretiva de Server Action, de propósito (molde `lib/agenda/gravacao.ts`): toda função
// exportada de um arquivo com a diretiva vira endpoint — chamável pelo navegador — e `npm run
// verificar-acoes` exigiria `exigirUsuario()` na primeira linha de cada uma. Estas funções recebem a
// TRANSAÇÃO de quem chama (as ações de `lib/queimas/acoes.ts`), por isso só são alcançáveis de dentro
// do servidor, depois que a ação que as chama já autorizou o usuário.
//
// A TRAVA É A DA LINHA DA QUEIMA (`for no key update of queimas`), nunca a da contagem: a contagem
// pode ainda não existir; a queima existe sempre — e a exclusão da queima (que leva a contagem e os
// vínculos, por cascade) espera essa mesma trava. `for no key update`, e não a trava exclusiva, pelo
// mesmo motivo da Agenda: a queima é alvo de chave estrangeira (`queima_contagens.queima_id`), e um
// insert concorrente pede `for key share`, que não conflita com `for no key update`.
//
// ORDEM DE TRAVAS DAS QUEIMAS, para nunca haver ciclo:
//   QUEIMA → (leitura dos vínculos) → (documento novo) → ITENS → (vínculo novo)
// Salvar a contagem (plano 01), apagá-la (plano 02), "Recebi agora" (plano 04) e "Lançar na Venda"
// (plano 05) passam TODOS por `travarContagem`. Nenhum escritor de `queima_contagens` ou de
// `queima_vendas` pode pular essa trava: o piso da D-07 só existe por causa dela.
//
// CR-01: a trava é tomada numa instrução e a leitura é REFEITA noutra (`travarEReler`); as vendas
// ligadas são lidas DEPOIS da trava, noutra instrução — sob READ COMMITTED, a instrução que esperou a
// trava traria as tabelas não travadas do retrato antigo.
//
// D-07 — o piso: a soma lançada em vendas ATIVAS nunca passa das externas contadas, por tamanho. Não é
// check do banco (é entre tabelas) — mora aqui, em `gravarContagem`, sob a trava da queima, com as
// regras puras de `lib/queimas/contagem.ts`. Subir as externas é sempre livre.
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import { documentos, parcelas, queimaContagens, queimaVendas, queimas } from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";

import {
  abaixoDoLancado,
  chaveDoTamanho,
  externasDaContagem,
  lancadoAtivo,
  type Contagem,
  type VendaLigada,
} from "./contagem";
import { fraseAbaixoDoLancado, FRASE_QUEIMA_DESFEITA_NADA_CONTADO, type TipoDeQueima } from "./textos";

export type { TransacaoDoBanco };

// Uma recusa decidida SOB A TRAVA, com a frase que a tela mostra. Lançada de dentro da transação —
// nada foi gravado — e traduzida pela ação em `{ ok: false, erro: frase }` (molde `RecusaDaAgenda`).
export class RecusaDasQueimas extends Error {
  constructor(readonly frase: string) {
    super(frase);
    this.name = "RecusaDasQueimas";
  }
}

// CR-01 (revisão da Fase 5, copiado de `lib/agenda/gravacao.ts`): TRAVA numa instrução e RELÊ noutra.
// Sob READ COMMITTED, quem esperou a trava de uma linha que outra transação ATUALIZOU relê só a linha
// travada (EvalPlanQual) — as tabelas do LEFT JOIN que não estão travadas (aqui, `queima_contagens`)
// voltam do retrato ANTIGO. A segunda instrução tira um retrato NOVO com a trava já garantida. Repetir a
// trava na releitura não espera nada: ela já é desta transação. (Uma `QueryPromise` do Drizzle executa
// de novo a cada `await`.)
async function travarEReler<T>(consultaTravada: PromiseLike<T>): Promise<T> {
  await consultaTravada;
  return await consultaTravada;
}

export type QueimaTravada = {
  id: string;
  fornoId: string;
  tipo: TipoDeQueima;
  ocorridaEm: string;
  // `null` = sem contagem (estado válido e permanente).
  contagem: Contagem | null;
  // As vendas ligadas, relidas DEPOIS da trava — ativas e canceladas, em ordem de número. A base única
  // de "o que falta cobrar" (planos 02, 04 e 05).
  vendas: VendaLigada[];
};

// Trava a linha da QUEIMA e devolve, relidos depois da trava, a contagem (ou `null`) e as vendas
// ligadas. `null` se a queima não existe (desfeita em outro celular, ou pelo "Desfazer").
export async function travarContagem(
  tx: TransacaoDoBanco,
  queimaId: string,
): Promise<QueimaTravada | null> {
  const [linha] = await travarEReler(
    tx
      .select({
        id: queimas.id,
        fornoId: queimas.fornoId,
        tipo: queimas.tipo,
        ocorridaEm: queimas.ocorridaEm,
        contagemDe: queimaContagens.queimaId,
        internasP: queimaContagens.internasP,
        internasM: queimaContagens.internasM,
        internasG: queimaContagens.internasG,
        externasP: queimaContagens.externasP,
        externasM: queimaContagens.externasM,
        externasG: queimaContagens.externasG,
        saiuCheio: queimaContagens.saiuCheio,
      })
      .from(queimas)
      .leftJoin(queimaContagens, eq(queimaContagens.queimaId, queimas.id))
      .where(eq(queimas.id, queimaId))
      .for("no key update", { of: queimas }),
  );
  if (!linha) {
    return null;
  }

  const contagem: Contagem | null =
    linha.contagemDe === null
      ? null
      : {
          internasP: linha.internasP ?? 0,
          internasM: linha.internasM ?? 0,
          internasG: linha.internasG ?? 0,
          externasP: linha.externasP ?? 0,
          externasM: linha.externasM ?? 0,
          externasG: linha.externasG ?? 0,
          saiuCheio: linha.saiuCheio ?? true,
        };

  // Depois da trava, noutra instrução (CR-01): as vendas ligadas e a situação de cada uma — LIDAS,
  // nunca travadas (as Queimas não travam documento existente, como a Agenda).
  const ligadas = await tx
    .select({
      documentoId: queimaVendas.documentoId,
      numero: documentos.numero,
      canceladoEm: documentos.canceladoEm,
      quantidadeP: queimaVendas.quantidadeP,
      quantidadeM: queimaVendas.quantidadeM,
      quantidadeG: queimaVendas.quantidadeG,
    })
    .from(queimaVendas)
    .innerJoin(documentos, eq(documentos.id, queimaVendas.documentoId))
    .where(eq(queimaVendas.queimaId, queimaId))
    .orderBy(asc(documentos.numero));

  const emAbertoPorVenda = new Map<string, number>();
  if (ligadas.length > 0) {
    const contagens = await tx
      .select({ documentoId: parcelas.documentoId, emAberto: count() })
      .from(parcelas)
      .where(
        and(
          inArray(
            parcelas.documentoId,
            ligadas.map((venda) => venda.documentoId),
          ),
          isNull(parcelas.pagoEm),
        ),
      )
      .groupBy(parcelas.documentoId);
    for (const linhaDeParcela of contagens) {
      emAbertoPorVenda.set(linhaDeParcela.documentoId, Number(linhaDeParcela.emAberto));
    }
  }

  const vendas: VendaLigada[] = ligadas.map((venda) => ({
    documentoId: venda.documentoId,
    numero: venda.numero,
    cancelada: venda.canceladoEm !== null,
    paga: (emAbertoPorVenda.get(venda.documentoId) ?? 0) === 0,
    quantidades: { p: venda.quantidadeP, m: venda.quantidadeM, g: venda.quantidadeG },
  }));

  return {
    id: linha.id,
    fornoId: linha.fornoId,
    tipo: linha.tipo,
    ocorridaEm: linha.ocorridaEm.toISOString(),
    contagem,
    vendas,
  };
}

// Grava (cria ou corrige) a contagem de uma queima, sob a trava da queima. Recusa (nada gravado):
// queima que sumiu → `FRASE_QUEIMA_DESFEITA_NADA_CONTADO`; externas abaixo do já lançado em vendas
// ativas (D-07) → a frase do piso, com o lançado naquele tamanho e as vendas ativas que o têm.
// `criada` = a trava não achou contagem (a tela diz "salva" × "corrigida").
export async function gravarContagem(
  tx: TransacaoDoBanco,
  queimaId: string,
  contagem: Contagem,
  contadoPor: string,
): Promise<{ criada: boolean }> {
  const travada = await travarContagem(tx, queimaId);
  if (travada === null) {
    throw new RecusaDasQueimas(FRASE_QUEIMA_DESFEITA_NADA_CONTADO);
  }

  const lancado = lancadoAtivo(travada.vendas);
  const tamanho = abaixoDoLancado(externasDaContagem(contagem), lancado);
  if (tamanho !== null) {
    const chave = chaveDoTamanho(tamanho);
    const numerosDasVendas = travada.vendas
      .filter((venda) => !venda.cancelada && venda.quantidades[chave] > 0)
      .map((venda) => venda.numero);
    throw new RecusaDasQueimas(fraseAbaixoDoLancado(tamanho, lancado[chave], numerosDasVendas));
  }

  const numeros = {
    internasP: contagem.internasP,
    internasM: contagem.internasM,
    internasG: contagem.internasG,
    externasP: contagem.externasP,
    externasM: contagem.externasM,
    externasG: contagem.externasG,
    saiuCheio: contagem.saiuCheio,
    contadoPor,
  };
  // Uma linha por queima: a PK é `queima_id`, e salvar de novo corrige a mesma linha (o gatilho
  // `tocar_atualizado_em_queima_contagens` atualiza `atualizado_em`).
  await tx
    .insert(queimaContagens)
    .values({ queimaId, ...numeros })
    .onConflictDoUpdate({ target: queimaContagens.queimaId, set: numeros });

  return { criada: travada.contagem === null };
}

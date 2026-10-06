// Auxiliares de servidor das ações dos Orçamentos usados por mais de um arquivo de ações (D-24/P10,
// plano 06.5-27 — saíram de `acoes.ts`). SEM diretiva — exportado daqui não vira endpoint — e
// importado SÓ pelos arquivos "use server"; o índice `acoes.ts` nunca o reexporta.

import { eq } from "drizzle-orm";

import { orcamentos } from "@/db/schema";

import type { TransacaoDoBanco } from "./numero";
import { FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR } from "./textos";

import {
  OrcamentoNaoEhRascunho,
  OrcamentoNaoEncontrado,
  TransicaoDeStatusInvalida,
} from "./acoes-comum";

type StatusOrcamento = (typeof orcamentos.status.enumValues)[number];

// Regra comum às três transições guardadas (marcarComoEnviado/recusarOrcamento/
// voltarParaRascunho — `duplicarOrcamento` aceita qualquer status, nunca chama isto): recusa com
// frase em português quando o status atual não está entre os permitidos, e a frase do caso
// "aprovado" SEMPRE diz que refazer é Duplicar, não importa qual transição foi tentada (D-07).
export function garantirTransicaoValida(
  statusAtual: StatusOrcamento,
  permitido: StatusOrcamento[],
  mensagemGenerica: string,
): void {
  if (permitido.includes(statusAtual)) {
    return;
  }
  if (statusAtual === "aprovado") {
    throw new TransicaoDeStatusInvalida(FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR);
  }
  throw new TransicaoDeStatusInvalida(mensagemGenerica);
}

// Regra comum às quatro ações de edição (Tarefa 2): trava o orçamento (`select ... for update`) e
// recusa quando o status não é rascunho — a linha travada é a garantia real (T-04.5-28), o
// invariante de banco `(status='rascunho') = (snapshot is null)` (plano 01) é a rede, não a
// porta. Escrita UMA VEZ, chamada pelas quatro ações abaixo, sempre como a primeira coisa que
// cada uma faz dentro da própria transação.
export async function travarOrcamentoRascunho(tx: TransacaoDoBanco, orcamentoId: string): Promise<void> {
  const [linha] = await tx
    .select({ status: orcamentos.status })
    .from(orcamentos)
    .where(eq(orcamentos.id, orcamentoId))
    .for("update"); // trava a linha do orçamento inteira a transação — nenhuma edição concorrente decide o status por fora (for update)

  if (!linha) {
    throw new OrcamentoNaoEncontrado();
  }
  if (linha.status !== "rascunho") {
    throw new OrcamentoNaoEhRascunho();
  }
}

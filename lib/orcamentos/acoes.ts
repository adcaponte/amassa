"use server";

import { db } from "@/db";
import { orcamentos } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { somarDias } from "@/lib/financeiro/calendario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";

import { esquemaNovoOrcamento } from "./esquemas";
import { proximoSequencialDeOrcamento } from "./numero";
import { FRASE_FALHA_AO_CRIAR } from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts` — cada módulo redeclara, não há tipo compartilhado
// entre módulos (D-15 do projeto).
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

const VALIDADE_PADRAO_EM_DIAS = 10;
const PRAZO_PADRAO_DE_ENTREGA_EM_DIAS = 45;

// "Novo orçamento" (D-05/D-06/D-21) — grava o rascunho e devolve o número JÁ ATRIBUÍDO: o
// formulário nunca mostra um estado intermediário "sem número ainda" (04.5-UI-SPEC.md, seção
// "Numeração"). `exigirUsuario()` é a PRIMEIRA instrução do corpo (verificado por
// `npm run verificar-acoes`, decidido por árvore sintática).
//
// O sequencial sai de `proximoSequencialDeOrcamento`, DENTRO desta transação — se qualquer coisa
// abaixo falhar, o Postgres desfaz o incremento do contador junto (D-06): o número nunca chega a
// ser de um orçamento de verdade, então não é reaproveitado, é simplesmente nunca usado.
export async function criarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ano: number; sequencial: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaNovoOrcamento.safeParse(entradaBruta ?? {});
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

  // O ano do sequencial é o ano de HOJE em Brasília, calculado na borda — nunca lido de dentro de
  // um módulo puro (D-14) nem de `current_date` do Postgres (que estaria em UTC).
  const hoje = hojeEmBrasilia(new Date());
  const ano = Number(hoje.slice(0, 4));
  const entregaPrevista = somarDias(hoje, PRAZO_PADRAO_DE_ENTREGA_EM_DIAS);

  try {
    const { id, sequencial } = await db.transaction(async (tx) => {
      const sequencialDaTransacao = await proximoSequencialDeOrcamento(tx, ano);

      const [orcamento] = await tx
        .insert(orcamentos)
        .values({
          ano,
          sequencial: sequencialDaTransacao,
          status: "rascunho",
          data: hoje,
          validadeDias: VALIDADE_PADRAO_EM_DIAS,
          entregaPrevista,
          plano: "sinal",
          sinalPercentual: 50,
          criadoPor: usuario.id,
        })
        .returning({ id: orcamentos.id });

      return { id: orcamento.id, sequencial: sequencialDaTransacao };
    });

    return { ok: true, dados: { id, ano, sequencial } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
    }
    throw erro;
  }
}

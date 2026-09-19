"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { configuracaoFinanceira } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { esquemaTaxa } from "./esquemas";
import { FRASE_FALHA_AO_SALVAR } from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts`/`lib/abertura/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// A taxa do cartão é a configuração global de linha única (`configuracao_financeira`, a mesma
// tabela de `obterConfiguracaoFinanceira`, lib/financeiro/consultas.ts) — `insert ... on
// conflict` sobre a restrição de linha única, NUNCA `select` seguido de `insert`/`update` (mesmo
// molde de `definirDataDeInauguracao`, lib/abertura/acoes.ts): duas pessoas salvando a taxa ao
// mesmo tempo terminam com uma linha só, com o último valor recebido — não há janela onde as
// duas decidam "a linha não existe" e tentem inserir. `exigirUsuario()` é a PRIMEIRA instrução
// do corpo (verificado por `npm run verificar-acoes`, decidido por árvore sintática).
export async function definirTaxaDoCartao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ pontosBase: number }>> {
  await exigirUsuario();

  const resultado = esquemaTaxa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { pontosBase } = resultado.data;

  try {
    await db
      .insert(configuracaoFinanceira)
      .values({ linhaUnica: true, taxaCartaoPontosBase: pontosBase })
      .onConflictDoUpdate({
        target: configuracaoFinanceira.linhaUnica,
        set: { taxaCartaoPontosBase: pontosBase },
      });

    revalidatePath("/cadastros");
    return { ok: true, dados: { pontosBase } };
  } catch (erro) {
    console.error("Falha ao gravar a taxa do cartão:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

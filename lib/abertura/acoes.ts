"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { aberturaItens } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { esquemaItemDeAbertura } from "./esquemas";
import { FRASE_FALHA_AO_SALVAR } from "./textos";

// Mesma forma de `lib/queimas/acoes.ts`/`lib/encomendas/acoes.ts` (D-15) — cada módulo
// redeclara hoje, não há local compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Único caminho de criação de item da Abertura do Espaço (a fatia deste plano cobre só
// criação — edição e remoção são dos planos seguintes). `exigirUsuario()` é a PRIMEIRA
// instrução do corpo (T-04.2-01, verificado por `npm run verificar-acoes`, decidido por árvore
// sintática). Sem transação: uma inserção de uma linha só.
export async function criarItemDeAbertura(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaItemDeAbertura.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(aberturaItens)
      .values({
        nome: dados.nome,
        categoria: dados.categoria,
        valorCentavos: dados.valorEmCentavos,
        formaPagamento: dados.formaPagamento,
        parcelas: dados.parcelas,
        primeiraParcelaEm: dados.primeiraParcelaEm,
        entregaPrevistaEm: dados.entregaPrevistaEm,
      })
      .returning({ id: aberturaItens.id });

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    // Erro de banco (restrição violada, conexão perdida etc.) nunca engolido — registrado e
    // devolvido como `{ ok: false }` para o formulário mostrar o banner de falha, permanecendo
    // aberto com os campos preenchidos.
    console.error("Falha ao gravar item de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

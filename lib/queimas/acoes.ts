"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { fornos } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { esquemaForno } from "./esquemas";

// Mesma forma de `lib/encomendas/acoes.ts` (D-15) — cada módulo redeclara hoje, não há local
// compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// D-02: único caminho de criação de forno — o botão "Novo forno" do estado vazio/índice, sem
// tela de cadastro dedicada. `exigirUsuario()` é a PRIMEIRA instrução do corpo (T-04-01,
// verificado por `npm run verificar-acoes`, decidido por árvore sintática, nunca por regex).
// Sem transação: é uma inserção de uma linha só.
export async function criarForno(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaForno.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(fornos)
      .values({
        nome: dados.nome,
        descricao: dados.descricao,
        limite: dados.limite,
      })
      .returning({ id: fornos.id });

    revalidatePath("/queimas");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    // Erro de banco (restrição violada, conexão perdida etc.) nunca engolido — registrado e
    // devolvido como `{ ok: false }` para o formulário mostrar o banner de falha, permanecendo
    // aberto com os campos preenchidos (mesma forma de `criarEncomenda`).
    console.error("Falha ao gravar forno:", erro);
    return { ok: false, erro: "Não deu para salvar. Verifique a internet e tente de novo." };
  }
}

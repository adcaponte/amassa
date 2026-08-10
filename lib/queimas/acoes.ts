"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { fornos, queimas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { esquemaForno, esquemaId, esquemaQueima } from "./esquemas";
import { FRASE_FALHA_AO_REGISTRAR_QUEIMA } from "./textos";

// Mesma forma de `lib/encomendas/acoes.ts` (D-15) — cada módulo redeclara hoje, não há local
// compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// SQLSTATE 23503 = foreign_key_violation — o `pg`/`drizzle-orm` propaga o código original do
// Postgres no erro lançado. Nenhuma outra classe de erro usa este código, então checar por ele é
// seguro (nunca um `instanceof` genérico que capturaria também erro de conexão).
function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "23503";
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

// D-04: a queima é gravada no INSTANTE do toque — "Desfazer" apaga a linha depois (nunca o
// inverso). `exigirUsuario()` é a PRIMEIRA instrução do corpo (T-04-01); `registradoPor` vem
// SEMPRE de `usuarioAtual.id`, nunca de `entradaBruta` (T-04-02) — `esquemaQueima` nem tem esse
// campo. Sem transação: uma inserção de uma linha só, `ocorridaEm` fica no `defaultNow()` do
// banco.
export async function registrarQueima(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ocorridaEm: string }>> {
  const usuarioAtual = await exigirUsuario();

  const resultado = esquemaQueima.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(queimas)
      .values({
        fornoId: dados.fornoId,
        tipo: dados.tipo,
        registradoPor: usuarioAtual.id,
      })
      .returning({ id: queimas.id, ocorridaEm: queimas.ocorridaEm });

    revalidatePath("/queimas");
    return { ok: true, dados: { id: linha.id, ocorridaEm: linha.ocorridaEm.toISOString() } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: "Esse forno não existe mais. Recarregue a página." };
    }
    console.error("Falha ao registrar queima:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_REGISTRAR_QUEIMA };
  }
}

// Única Server Action de exclusão de queima do sistema — o "Desfazer" do toast (sem confirmação,
// arrependimento de segundos atrás) e a exclusão confirmada do histórico (plano 04-03, com
// `AlertDialog`) chamam esta mesma ação; a diferença entre elas é só QUEM confirma
// (`02-MODELO-DE-DADOS.md` §3, "O que muda em relação ao protótipo"). Idempotente por
// construção: a segunda chamada sobre um `id` já apagado encontra zero linhas e devolve o erro
// humano, nunca lança.
export async function excluirQueima(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

  const [linha] = await db
    .delete(queimas)
    .where(eq(queimas.id, resultado.data))
    .returning({ id: queimas.id });

  if (!linha) {
    return { ok: false, erro: "Essa queima não existe mais." };
  }

  revalidatePath("/queimas");
  return { ok: true, dados: { id: linha.id } };
}

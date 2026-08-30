"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { aberturaItens, aberturaTarefas, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import {
  esquemaAtualizacaoDeItem,
  esquemaAtualizacaoDeTarefa,
  esquemaId,
  esquemaItemDeAbertura,
  esquemaMarcacaoDeItem,
  esquemaMarcacaoDeTarefa,
  esquemaTarefaDeAbertura,
} from "./esquemas";
import {
  FRASE_FALHA_AO_SALVAR,
  FRASE_ITEM_NAO_EXISTE_MAIS,
  FRASE_TAREFA_NAO_EXISTE_MAIS,
} from "./textos";

// Mesma forma de `lib/queimas/acoes.ts`/`lib/encomendas/acoes.ts` (D-15) — cada módulo
// redeclara hoje, não há local compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// Usado só dentro da transação de `removerItemDeAbertura` para distinguir "a linha já não
// existia mais" de qualquer outro erro de banco (T-04.2-14) — o `catch` externo traduz para a
// frase humana certa em vez de cair no genérico `FRASE_FALHA_AO_SALVAR`.
class ItemDeAberturaNaoEncontrado extends Error {}

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// SQLSTATE 23503 = foreign_key_violation — o `pg`/`drizzle-orm` propaga o código original do
// Postgres no erro lançado. Mesmo helper de `lib/queimas/acoes.ts` (T-04.2-08): quando o item
// vinculado foi removido entre a montagem do formulário e o salvamento, a chave estrangeira
// barra a escrita e este erro vira frase humana, nunca erro cru.
function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "23503";
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

// Único caminho de criação de tarefa da Abertura do Espaço (a fatia deste plano cobre só
// criação — editar, remover e marcar como feita são do plano 04.2-03). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo (T-04.2-09, verificado por `npm run verificar-acoes`).
export async function criarTarefaDeAbertura(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaTarefaDeAbertura.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  // T-04.2-07: a chave estrangeira de `responsavel_id` garante que o identificador EXISTE; ela
  // não garante que ele é um gestor ATIVO — "ninguém ainda" é estado válido (D-11), mas um
  // identificador de gestor DESATIVADO enviado pelo cliente (deliberadamente ou por uma corrida
  // entre a montagem do formulário e o envio) não é. É o SERVIDOR que decide isso, nunca o campo
  // do formulário, que só oferece gestores ativos no momento em que a página carregou.
  if (dados.responsavelId !== null) {
    const [gestorAtivo] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.id, dados.responsavelId), eq(usuarios.ativo, true)))
      .limit(1);

    if (!gestorAtivo) {
      return {
        ok: false,
        erro: "Esse gestor não está mais ativo. Escolha outro ou deixe em «Ninguém ainda».",
      };
    }
  }

  try {
    const [linha] = await db
      .insert(aberturaTarefas)
      .values({
        descricao: dados.descricao,
        grupo: dados.grupo,
        prazoEm: dados.prazoEm,
        responsavelId: dados.responsavelId,
        itemId: dados.itemId,
      })
      .returning({ id: aberturaTarefas.id });

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "O item ligado a esta tarefa não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao gravar tarefa de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// A marcação otimista (Tarefa 1, 04.2-03-PLAN.md, T-04.2-13): recebe o ESTADO DESEJADO, grava
// valor ABSOLUTO — nunca um incremento nem uma inversão. Duas chamadas com o mesmo valor
// (de duas abas, ou de uma resposta que chega fora de ordem) convergem sempre para o mesmo
// resultado, sem violar restrição nenhuma. `exigirUsuario()` é a PRIMEIRA instrução do corpo
// (T-04.2-12). Sem transação: um `update` de uma linha só, sem leitura prévia — não há condição
// de corrida a proteger (o valor gravado não depende do valor anterior).
export async function marcarItemResolvido(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; resolvido: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaMarcacaoDeItem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db
      .update(aberturaItens)
      .set({ resolvido: dados.resolvido })
      .where(eq(aberturaItens.id, dados.id));

    revalidatePath("/abertura");
    return { ok: true, dados: { id: dados.id, resolvido: dados.resolvido } };
  } catch (erro) {
    console.error("Falha ao marcar item de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

export async function marcarTarefaConcluida(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; concluida: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaMarcacaoDeTarefa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db
      .update(aberturaTarefas)
      .set({ concluida: dados.concluida })
      .where(eq(aberturaTarefas.id, dados.id));

    revalidatePath("/abertura");
    return { ok: true, dados: { id: dados.id, concluida: dados.concluida } };
  } catch (erro) {
    console.error("Falha ao marcar tarefa de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// D-18/ABE-11 (Tarefa 2): editar é `update` da linha EXISTENTE, sempre — nunca um caminho que
// apaga e insere de novo. A linha do item é o alvo de `abertura_tarefas.item_id`; recriá-la
// soltaria TODAS as tarefas ligadas, que é exatamente o custo que D-18 existe para evitar.
// `exigirUsuario()` é a PRIMEIRA instrução do corpo (T-04.2-15). Sem transação: um `update` de
// uma linha só. `update` que não afeta nenhuma linha (a linha foi removida por outra pessoa no
// meio) devolve frase humana, nunca falha silenciosa.
export async function atualizarItemDeAbertura(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDeItem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .update(aberturaItens)
      .set({
        nome: dados.nome,
        categoria: dados.categoria,
        valorCentavos: dados.valorEmCentavos,
        formaPagamento: dados.formaPagamento,
        parcelas: dados.parcelas,
        primeiraParcelaEm: dados.primeiraParcelaEm,
        entregaPrevistaEm: dados.entregaPrevistaEm,
      })
      .where(eq(aberturaItens.id, dados.id))
      .returning({ id: aberturaItens.id });

    if (!linha) {
      return { ok: false, erro: FRASE_ITEM_NAO_EXISTE_MAIS };
    }

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao atualizar item de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Mesma disciplina de `criarTarefaDeAbertura`: a chave estrangeira de `responsavel_id` garante
// que o identificador EXISTE, não que o gestor continua ATIVO — quem decide isso é o servidor,
// nunca o campo do formulário (T-04.2-07). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function atualizarTarefaDeAbertura(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDeTarefa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  if (dados.responsavelId !== null) {
    const [gestorAtivo] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.id, dados.responsavelId), eq(usuarios.ativo, true)))
      .limit(1);

    if (!gestorAtivo) {
      return {
        ok: false,
        erro: "Esse gestor não está mais ativo. Escolha outro ou deixe em «Ninguém ainda».",
      };
    }
  }

  try {
    const [linha] = await db
      .update(aberturaTarefas)
      .set({
        descricao: dados.descricao,
        grupo: dados.grupo,
        prazoEm: dados.prazoEm,
        responsavelId: dados.responsavelId,
        itemId: dados.itemId,
      })
      .where(eq(aberturaTarefas.id, dados.id))
      .returning({ id: aberturaTarefas.id });

    if (!linha) {
      return { ok: false, erro: FRASE_TAREFA_NAO_EXISTE_MAIS };
    }

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "O item ligado a esta tarefa não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao atualizar tarefa de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// D-14/ABE-10 (Tarefa 3): remove o item numa TRANSAÇÃO — conta as tarefas com `item_id = id`
// ANTES de apagar a linha, porque depois do `delete` a restrição `on delete set null` já as
// soltou e não haveria mais o que contar (mesmo cuidado de `excluirEncomenda`,
// `lib/encomendas/acoes.ts`). A contagem devolvida é a que o `toast` final mostra — a fonte de
// verdade, se divergir da que a tela já exibia antes de confirmar.
//
// A ação NÃO toca em `abertura_tarefas`: quem solta as tarefas é a restrição `on delete set
// null` da coluna `item_id` (migração 0010), nunca um `update` escrito aqui — dois lugares
// dizendo a mesma coisa é como nascem duas versões da verdade, e um deles pode ser esquecido
// numa mudança futura. `exigirUsuario()` é a PRIMEIRA instrução do corpo (T-04.2-14).
export async function removerItemDeAbertura(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ tarefasSoltas: number }>> {
  await exigirUsuario();

  const resultadoId = esquemaId.safeParse(idBruto);
  if (!resultadoId.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultadoId) };
  }
  const id = resultadoId.data;

  try {
    const tarefasSoltas = await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ id: aberturaItens.id })
        .from(aberturaItens)
        .where(eq(aberturaItens.id, id))
        .limit(1);

      if (!linha) {
        throw new ItemDeAberturaNaoEncontrado();
      }

      const [{ contagem }] = await tx
        .select({ contagem: count() })
        .from(aberturaTarefas)
        .where(eq(aberturaTarefas.itemId, id));

      await tx.delete(aberturaItens).where(eq(aberturaItens.id, id));

      return contagem;
    });

    revalidatePath("/abertura");
    return { ok: true, dados: { tarefasSoltas } };
  } catch (erro) {
    if (erro instanceof ItemDeAberturaNaoEncontrado) {
      return { ok: false, erro: FRASE_ITEM_NAO_EXISTE_MAIS };
    }
    console.error("Falha ao remover item de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Remover uma tarefa nunca solta nem apaga nada além dela mesma — `exigirUsuario()` é a
// PRIMEIRA instrução do corpo. Sem transação: um `delete` de uma linha só.
export async function removerTarefaDeAbertura(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultadoId = esquemaId.safeParse(idBruto);
  if (!resultadoId.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultadoId) };
  }
  const id = resultadoId.data;

  try {
    const [linha] = await db
      .delete(aberturaTarefas)
      .where(eq(aberturaTarefas.id, id))
      .returning({ id: aberturaTarefas.id });

    if (!linha) {
      return { ok: false, erro: FRASE_TAREFA_NAO_EXISTE_MAIS };
    }

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao remover tarefa de abertura:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

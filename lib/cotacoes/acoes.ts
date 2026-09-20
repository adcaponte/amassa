"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { cotacaoCategorias, cotacoes } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { esquemaId } from "@/lib/abertura/esquemas";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";

import {
  esquemaAtualizacaoDeCotacao,
  esquemaCategoriaDeCotacao,
  esquemaCotacao,
  esquemaRenomearCategoria,
} from "./esquemas";
import {
  FRASE_CATEGORIA_NAO_EXISTE_MAIS,
  FRASE_COTACAO_NAO_EXISTE_MAIS,
  FRASE_FALHA_AO_SALVAR,
} from "./textos";

// Mesma forma de `lib/abertura/acoes.ts`/`lib/queimas/acoes.ts` (D-15) — cada módulo redeclara
// hoje, não há local compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Detector de SQLSTATE 23503 (foreign_key_violation) vive em `@/lib/erro/postgres`.

// Usado só dentro da transação de `removerCategoriaDeCotacao` para distinguir "a categoria já
// não existia mais" de qualquer outro erro de banco — mesmo molde de `ItemDeAberturaNaoEncontrado`
// em `lib/abertura/acoes.ts`.
class CategoriaDeCotacaoNaoEncontrada extends Error {}

// Único caminho de criação de categoria (D-14, <10s). `exigirUsuario()` é a PRIMEIRA instrução
// do corpo (D-22, portão de máquina em `npm run verificar-acoes`). Sem transação: uma inserção de
// uma linha só, com identificador gerado pelo BANCO — duas pessoas criando categorias ao mesmo
// tempo terminam com as duas, sem colisão (must_have de backstop deste plano).
export async function criarCategoriaDeCotacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaCategoriaDeCotacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(cotacaoCategorias)
      .values({ nome: dados.nome })
      .returning({ id: cotacaoCategorias.id });

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao gravar categoria de cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Único caminho de criação de cotação nesta fatia. `exigirUsuario()` é a PRIMEIRA instrução do
// corpo. Devolve o identificador da cotação E o da categoria — quem chama precisa do segundo
// para navegar de volta para `/abertura?aba=cotacoes&categoria=<id>` depois de gravar (D-23:
// navegação completa).
export async function criarCotacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; categoriaId: string }>> {
  await exigirUsuario();

  const resultado = esquemaCotacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(cotacoes)
      .values({
        categoriaId: dados.categoriaId,
        empresa: dados.empresa,
        produto: dados.produto,
        precoCentavos: dados.preco,
        situacao: dados.situacao,
        diferenciais: dados.diferenciais,
        assistencia: dados.assistencia,
        pagamento: dados.pagamento,
        contato: dados.contato,
        observacoes: dados.observacoes,
        alertas: dados.alertas,
      })
      .returning({ id: cotacoes.id, categoriaId: cotacoes.categoriaId });

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id, categoriaId: linha.categoriaId } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return {
        ok: false,
        erro: "Essa categoria não existe mais. Recarregue a página e tente de novo.",
      };
    }
    console.error("Falha ao gravar cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Tarefa 1 (04.3-03, "editar no lugar"). `exigirUsuario()` é a PRIMEIRA instrução do corpo
// (T-04.3-09, portão de máquina em `npm run verificar-acoes`). Atualiza a linha EXISTENTE,
// sempre — nunca um caminho que apaga e insere de novo: recriar a linha trocaria o identificador
// que a URL do detalhe e a marcação de comparação usam, e perderia a ordem de cadastro que é a
// ordem padrão da lista. `categoriaId` chega no formato validado (faz parte da base, por
// composição) mas nunca entra no `UPDATE` — mover uma cotação de categoria não é comportamento
// desta fase, e escrevê-lo aqui criaria um caminho não pedido para isso. Zero linhas afetadas
// significa que a cotação foi removida por outra pessoa entre abrir o formulário e salvar (D-17:
// nenhum filtro por usuário — qualquer gestor pode ter feito essa remoção).
export async function atualizarCotacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; categoriaId: string }>> {
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDeCotacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .update(cotacoes)
      .set({
        empresa: dados.empresa,
        produto: dados.produto,
        precoCentavos: dados.preco,
        situacao: dados.situacao,
        diferenciais: dados.diferenciais,
        assistencia: dados.assistencia,
        pagamento: dados.pagamento,
        contato: dados.contato,
        observacoes: dados.observacoes,
        alertas: dados.alertas,
      })
      .where(eq(cotacoes.id, dados.id))
      .returning({ id: cotacoes.id, categoriaId: cotacoes.categoriaId });

    if (!linha) {
      return { ok: false, erro: FRASE_COTACAO_NAO_EXISTE_MAIS };
    }

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id, categoriaId: linha.categoriaId } };
  } catch (erro) {
    console.error("Falha ao atualizar cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// D-14 ("renomear funciona"). `exigirUsuario()` é a PRIMEIRA instrução do corpo. Atualiza a
// linha existente — nunca apaga e recria (T-04.3-09). Zero linhas afetadas significa que a
// categoria foi removida por outra pessoa entre abrir o diálogo e salvar.
export async function renomearCategoriaDeCotacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaRenomearCategoria.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .update(cotacaoCategorias)
      .set({ nome: dados.nome })
      .where(eq(cotacaoCategorias.id, dados.id))
      .returning({ id: cotacaoCategorias.id });

    if (!linha) {
      return { ok: false, erro: FRASE_CATEGORIA_NAO_EXISTE_MAIS };
    }

    revalidatePath("/abertura");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao renomear categoria de cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// D-15 ("remover categoria pede confirmação dizendo quantas cotações se perdem"). `exigirUsuario()`
// é a PRIMEIRA instrução do corpo (T-04.3-09). Dentro de uma TRANSAÇÃO: conta as cotações da
// categoria ANTES de apagar a linha — a contagem devolvida é a FONTE DE VERDADE FINAL, porque a
// que a tela mostrou antes de confirmar pode ter mudado se outra pessoa mexeu no meio (mesmo
// cuidado de `removerItemDeAbertura`, `lib/abertura/acoes.ts`).
//
// A ação NÃO apaga cotação nenhuma por código: quem as apaga é a cascata `on delete cascade`
// declarada na migração `0012` (`cotacoes.categoria_id`). Dois lugares dizendo a mesma coisa é
// como nascem duas versões da verdade, e um deles é esquecido na primeira mudança (T-04.3-10).
export async function removerCategoriaDeCotacao(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ cotacoesRemovidas: number }>> {
  await exigirUsuario();

  const resultadoId = esquemaId.safeParse(idBruto);
  if (!resultadoId.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultadoId) };
  }
  const id = resultadoId.data;

  try {
    const cotacoesRemovidas = await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ id: cotacaoCategorias.id })
        .from(cotacaoCategorias)
        .where(eq(cotacaoCategorias.id, id))
        .limit(1);

      if (!linha) {
        throw new CategoriaDeCotacaoNaoEncontrada();
      }

      const [{ contagem }] = await tx
        .select({ contagem: count() })
        .from(cotacoes)
        .where(eq(cotacoes.categoriaId, id));

      await tx.delete(cotacaoCategorias).where(eq(cotacaoCategorias.id, id));

      return contagem;
    });

    revalidatePath("/abertura");
    return { ok: true, dados: { cotacoesRemovidas } };
  } catch (erro) {
    if (erro instanceof CategoriaDeCotacaoNaoEncontrada) {
      return { ok: false, erro: FRASE_CATEGORIA_NAO_EXISTE_MAIS };
    }
    console.error("Falha ao remover categoria de cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Tarefa 2 (04.3-03, D-15 "remover cotação pede confirmação nomeando a empresa").
// `exigirUsuario()` é a PRIMEIRA instrução do corpo. Sem transação — é uma linha só, e nada
// depende do valor anterior (ao contrário de `removerCategoriaDeCotacao`, que precisa contar
// linhas dependentes antes de apagar). Devolve o identificador da CATEGORIA, para quem chamou
// saber para onde navegar (D-23: navegação completa para a aba da categoria). Remoção de uma
// linha que já não existia (removida por outra pessoa entre abrir a confirmação e clicar
// "Excluir") devolve frase humana, nunca falha silenciosa.
export async function removerCotacao(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ categoriaId: string }>> {
  await exigirUsuario();

  const resultadoId = esquemaId.safeParse(idBruto);
  if (!resultadoId.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultadoId) };
  }
  const id = resultadoId.data;

  try {
    const [linha] = await db
      .delete(cotacoes)
      .where(eq(cotacoes.id, id))
      .returning({ categoriaId: cotacoes.categoriaId });

    if (!linha) {
      return { ok: false, erro: FRASE_COTACAO_NAO_EXISTE_MAIS };
    }

    revalidatePath("/abertura");
    return { ok: true, dados: { categoriaId: linha.categoriaId } };
  } catch (erro) {
    console.error("Falha ao remover cotação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

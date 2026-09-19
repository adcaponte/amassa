"use server";

import { revalidatePath } from "next/cache";
import { count, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { categorias, configuracaoFinanceira, contasFixas, documentoLinhas, itensCatalogo } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { podeMudarGrupoEArea } from "./categorias";
import { esquemaAtivacao, esquemaCategoria, esquemaEdicaoDeCategoria, esquemaTaxa } from "./esquemas";
import {
  FRASE_CATEGORIA_COM_USO,
  FRASE_CATEGORIA_NAO_EXISTE_MAIS,
  FRASE_FALHA_AO_SALVAR,
  FRASE_NOME_REPETIDO,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts`/`lib/abertura/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// `drizzle-orm/node-postgres` embrulha todo erro de query num `DrizzleQueryError`, que NÃO tem
// `code` própria — o erro de verdade do `pg` (com o SQLSTATE) mora em `.cause` (achado real,
// confirmado pela primeira execução do e2e "cadastros base": o padrão `"code" in erro` copiado
// de `ehViolacaoDeChaveEstrangeira` de outros módulos nunca bate, porque olha o embrulho, não a
// causa). Esta função olha os dois lugares — funciona tanto se um dia o driver parar de
// embrulhar quanto hoje, que embrulha.
function codigoDoErroPostgres(erro: unknown): string | undefined {
  if (typeof erro !== "object" || erro === null) {
    return undefined;
  }
  if ("code" in erro && typeof erro.code === "string") {
    return erro.code;
  }
  if ("cause" in erro && typeof erro.cause === "object" && erro.cause !== null && "code" in erro.cause) {
    const codigoDaCausa = (erro.cause as { code?: unknown }).code;
    return typeof codigoDaCausa === "string" ? codigoDaCausa : undefined;
  }
  return undefined;
}

// SQLSTATE 23505 = unique_violation — o índice único `categorias_nome_normalizado_idx`
// (db/schema.ts) é quem decide, não o cliente (must_have deste plano: duas pessoas criando a
// MESMA categoria ao mesmo tempo terminam com uma e uma frase para a outra).
function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return codigoDoErroPostgres(erro) === "23505";
}

// SQLSTATE P0001 = raise_exception — o SQLSTATE padrão de `raise exception` em PL/pgSQL. O
// gatilho `travar_grupo_e_area_da_categoria` (migração 0015) usa isso como segunda camada de
// defesa: se uma corrida real criar um lançamento entre a conferência desta ação e o `UPDATE`,
// o próprio banco recusa, e este erro vira a mesma frase de uso (nunca o texto cru do banco).
function ehErroDoGatilhoDeTravamento(erro: unknown): boolean {
  return codigoDoErroPostgres(erro) === "P0001";
}

class CategoriaNaoEncontrada extends Error {}
class CategoriaComUsoNaoPodeMudar extends Error {}

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

// Único caminho de criação de categoria (FNC-12). `exigirUsuario()` é a PRIMEIRA instrução do
// corpo. Sem transação: uma inserção de uma linha só, com identificador gerado pelo BANCO — duas
// pessoas criando categorias ao mesmo tempo terminam com as duas (must_have de backstop deste
// plano); duas criando a MESMA terminam com uma e uma frase para a outra, decidido pelo índice
// único `categorias_nome_normalizado_idx`, nunca pelo cliente.
export async function criarCategoria(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaCategoria.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(categorias)
      .values({ nome: dados.nome, grupo: dados.grupo, area: dados.area })
      .returning({ id: categorias.id });

    revalidatePath("/cadastros");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) {
      return { ok: false, erro: FRASE_NOME_REPETIDO };
    }
    console.error("Falha ao gravar categoria:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Editar SEMPRE atualiza a linha existente (nunca apaga e recria — não existe caminho de apagar
// categoria, FNC-12). O nome muda sempre; grupo e área só mudam enquanto a categoria não tem uso
// nenhum (`podeMudarGrupoEArea`, lib/cadastros/categorias.ts) — verificado dentro de uma
// TRANSAÇÃO, com `select ... for update` na própria linha, para duas edições concorrentes da
// MESMA categoria não lerem o mesmo "uso zero" ao mesmo tempo. `exigirUsuario()` é a PRIMEIRA
// instrução do corpo.
export async function editarCategoria(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaEdicaoDeCategoria.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [categoriaAtual] = await tx
        .select({
          grupo: categorias.grupo,
          area: categorias.area,
          chaveDoSistema: categorias.chaveDoSistema,
        })
        .from(categorias)
        .where(eq(categorias.id, dados.id))
        .for("update");

      if (!categoriaAtual) {
        throw new CategoriaNaoEncontrada();
      }

      const grupoOuAreaMudou =
        categoriaAtual.grupo !== dados.grupo || categoriaAtual.area !== dados.area;

      // O uso só precisa ser contado quando grupo/área de fato mudam — uma edição só de nome
      // nunca é recusada por uso, então poupa as três consultas abaixo.
      if (grupoOuAreaMudou) {
        const [[{ lancamentos }], [{ itens }], [{ total: contasFixasQtd }]] = await Promise.all([
          tx
            .select({ lancamentos: count() })
            .from(documentoLinhas)
            .where(eq(documentoLinhas.categoriaId, dados.id)),
          tx
            .select({ itens: count() })
            .from(itensCatalogo)
            .where(
              or(
                eq(itensCatalogo.categoriaVendaId, dados.id),
                eq(itensCatalogo.categoriaCompraId, dados.id),
              ),
            ),
          tx.select({ total: count() }).from(contasFixas).where(eq(contasFixas.categoriaId, dados.id)),
        ]);

        const podeMudar = podeMudarGrupoEArea({
          lancamentos: Number(lancamentos),
          itens: Number(itens),
          contasFixas: Number(contasFixasQtd),
          chaveDoSistema: categoriaAtual.chaveDoSistema,
        });

        if (!podeMudar) {
          throw new CategoriaComUsoNaoPodeMudar();
        }
      }

      await tx
        .update(categorias)
        .set({ nome: dados.nome, grupo: dados.grupo, area: dados.area })
        .where(eq(categorias.id, dados.id));
    });

    revalidatePath("/cadastros");
    return { ok: true, dados: { id: dados.id } };
  } catch (erro) {
    if (erro instanceof CategoriaNaoEncontrada) {
      return { ok: false, erro: FRASE_CATEGORIA_NAO_EXISTE_MAIS };
    }
    if (erro instanceof CategoriaComUsoNaoPodeMudar) {
      return { ok: false, erro: FRASE_CATEGORIA_COM_USO };
    }
    if (ehViolacaoDeUnicidade(erro)) {
      return { ok: false, erro: FRASE_NOME_REPETIDO };
    }
    if (ehErroDoGatilhoDeTravamento(erro)) {
      return { ok: false, erro: FRASE_CATEGORIA_COM_USO };
    }
    console.error("Falha ao editar categoria:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Categoria nunca se apaga — desativar/reativar é a ÚNICA forma de remoção (FNC-12). Recebe o
// estado DESEJADO, nunca "inverte" (mesma disciplina de `marcarItemResolvido`,
// lib/abertura/acoes.ts): duas chamadas com o mesmo valor convergem sempre, o que torna a ação
// segura sob concorrência sem precisar de transação — um `update` de uma linha só, sem leitura
// prévia. `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function definirCategoriaAtiva(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ativa: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaAtivacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id, ativa } = resultado.data;

  try {
    const [linha] = await db
      .update(categorias)
      .set({ ativa })
      .where(eq(categorias.id, id))
      .returning({ id: categorias.id });

    if (!linha) {
      return { ok: false, erro: FRASE_CATEGORIA_NAO_EXISTE_MAIS };
    }

    revalidatePath("/cadastros");
    return { ok: true, dados: { id, ativa } };
  } catch (erro) {
    console.error("Falha ao (des)ativar categoria:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

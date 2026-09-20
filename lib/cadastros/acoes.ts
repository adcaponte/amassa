"use server";

import { revalidatePath } from "next/cache";
import { count, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  categorias,
  configuracaoFinanceira,
  contasFixas,
  documentoLinhas,
  documentos,
  fichaTecnica,
  itensCatalogo,
  parcelas,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { primeiroDiaDoMes } from "@/lib/financeiro/calendario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

import { podeDeixarDeTerEstoque, type InsumoDisponivel } from "./catalogo";
import { podeMudarGrupoEArea } from "./categorias";
import { mesPermitidoParaGeracao, tituloDaContaFixa, vencimentoNoMes } from "./contas-fixas";
import {
  esquemaAtivacao,
  esquemaAtivacaoDeContaFixa,
  esquemaCategoria,
  esquemaContaFixa,
  esquemaEdicaoDeCategoria,
  esquemaEdicaoDeItem,
  esquemaGeracao,
  esquemaItem,
  esquemaTaxa,
  esquemaValorDaContaFixa,
} from "./esquemas";
import {
  FRASE_CATEGORIA_COM_USO,
  FRASE_CATEGORIA_DE_COMPRA_INVALIDA,
  FRASE_CATEGORIA_DE_VENDA_INVALIDA,
  FRASE_CATEGORIA_NAO_EXISTE_MAIS,
  FRASE_CATEGORIA_DA_CONTA_FIXA_INVALIDA,
  FRASE_CONTA_FIXA_NAO_EXISTE_MAIS,
  FRASE_FALHA_AO_SALVAR,
  FRASE_ITEM_NAO_EXISTE_MAIS,
  FRASE_MES_DE_GERACAO_INVALIDO,
  FRASE_NOME_REPETIDO,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts`/`lib/abertura/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Leitor de SQLSTATE (que enxerga tanto `erro.code` quanto `erro.cause.code`, embrulhado pelo
// `drizzle-orm/node-postgres`) vive em `@/lib/erro/postgres`, compartilhado com todos os módulos.
// `ehViolacaoDeUnicidade` e `ehErroDoGatilhoDeTravamento` abaixo ficam locais de propósito: cada
// um tem um único consumidor neste arquivo e o nome/comentário carrega contexto específico de
// Cadastros — só o leitor de SQLSTATE em si é código genérico o bastante para compartilhar.

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
class ItemNaoEncontrado extends Error {}
class CategoriaDeVendaInvalida extends Error {}
class CategoriaDeCompraInvalida extends Error {}
class ItemEhInsumoDeOutro extends Error {}

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

// Todos os itens do catálogo (id, nome, controlaEstoque) — o universo candidato a insumo que
// `validarItem` (lib/cadastros/catalogo.ts) precisa para dizer QUAL insumo não tem estoque
// próprio. Carregado ANTES do parse porque `esquemaItem`/`esquemaEdicaoDeItem` são fábricas que
// fecham sobre esse mapa (mesma regra do diálogo — key_links do plano).
async function carregarInsumosDisponiveis(): Promise<Map<string, InsumoDisponivel>> {
  const itens = await db
    .select({
      id: itensCatalogo.id,
      nome: itensCatalogo.nome,
      controlaEstoque: itensCatalogo.controlaEstoque,
    })
    .from(itensCatalogo);

  return new Map(itens.map((item) => [item.id, item]));
}

// Categoria de venda: precisa existir, ser do grupo `receita` e estar ATIVA — exceto quando é a
// MESMA categoria que o item já tinha (`categoriaVendaIdAtual`), caso em que uma categoria
// desativada continua válida (04.4-UI-SPEC.md: "item cuja categoria foi desativada continua...
// editável, com o nome da categoria — a categoria desativada aparece como a opção atual").
function categoriaDeVendaValida(
  categoria: { grupo: string; ativa: boolean } | undefined,
  categoriaVendaId: string,
  categoriaVendaIdAtual: string | null,
): boolean {
  if (!categoria || categoria.grupo !== "receita") {
    return false;
  }
  return categoria.ativa || categoriaVendaId === categoriaVendaIdAtual;
}

// Categoria de compra: existir, ser do grupo `custo` OU `geral`, e a mesma regra de ATIVA acima.
function categoriaDeCompraValida(
  categoria: { grupo: string; ativa: boolean } | undefined,
  categoriaCompraId: string,
  categoriaCompraIdAtual: string | null,
): boolean {
  if (!categoria || (categoria.grupo !== "custo" && categoria.grupo !== "geral")) {
    return false;
  }
  return categoria.ativa || categoriaCompraId === categoriaCompraIdAtual;
}

// Único caminho de criação de item do catálogo (FNC-13). `exigirUsuario()` é a PRIMEIRA instrução
// do corpo. `criarItem` nunca precisa checar `podeDeixarDeTerEstoque` (o item ainda não existe,
// não pode ser insumo de ninguém) nem "categoria mantida" (não há categoria anterior).
export async function criarItem(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const insumosDisponiveis = await carregarInsumosDisponiveis();
  const resultado = esquemaItem(insumosDisponiveis).safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const idsDeCategorias = [dados.categoriaVendaId, dados.categoriaCompraId].filter(
      (id): id is string => id !== null,
    );
    const categoriasCarregadas =
      idsDeCategorias.length > 0
        ? await db
            .select({ id: categorias.id, ativa: categorias.ativa, grupo: categorias.grupo })
            .from(categorias)
            .where(inArray(categorias.id, idsDeCategorias))
        : [];
    const categoriaPorId = new Map(categoriasCarregadas.map((categoria) => [categoria.id, categoria]));

    if (
      dados.categoriaVendaId &&
      !categoriaDeVendaValida(categoriaPorId.get(dados.categoriaVendaId), dados.categoriaVendaId, null)
    ) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_VENDA_INVALIDA };
    }
    if (
      dados.categoriaCompraId &&
      !categoriaDeCompraValida(categoriaPorId.get(dados.categoriaCompraId), dados.categoriaCompraId, null)
    ) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_COMPRA_INVALIDA };
    }

    const idDoItem = await db.transaction(async (tx) => {
      const [linha] = await tx
        .insert(itensCatalogo)
        .values({
          nome: dados.nome,
          categoriaVendaId: dados.categoriaVendaId,
          precoVendaCentavos: dados.precoVendaCentavos,
          aparecenaVenda: dados.aparecenaVenda,
          atalhoVenda: dados.atalhoVenda,
          controlaEstoque: dados.controlaEstoque,
          atalhoCompra: dados.atalhoCompra,
          unidade: dados.unidade,
          categoriaCompraId: dados.categoriaCompraId,
        })
        .returning({ id: itensCatalogo.id });

      if (dados.ficha.length > 0) {
        await tx.insert(fichaTecnica).values(
          dados.ficha.map((linhaDeFicha) => ({
            itemId: linha.id,
            insumoId: linhaDeFicha.insumoId,
            quantidade: String(linhaDeFicha.quantidade),
          })),
        );
      }

      return linha.id;
    });

    revalidatePath("/cadastros");
    revalidatePath("/financeiro");
    return { ok: true, dados: { id: idDoItem } };
  } catch (erro) {
    console.error("Falha ao gravar item do catálogo:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Editar SEMPRE atualiza a linha existente e troca a ficha técnica INTEIRA dentro da MESMA
// transação (apaga as linhas do item, insere as novas) — `ficha_tecnica` é a única tabela do
// catálogo com `delete` liberado, justamente por isso (key_links do plano). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function editarItem(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  // Pré-checagem de `podeDeixarDeTerEstoque` ANTES do Zod: um item que só existe como insumo
  // (sem `aparecenaVenda`) também viola `itens_catalogo_aparece_ou_controla` ao perder
  // `controlaEstoque` — as duas frases seriam verdade ao mesmo tempo, mas "esse item é insumo de
  // {nome}" é mais acionável que "marque venda ou estoque", então esta checagem tem prioridade
  // (mesma ordem que o diálogo aplica do lado do cliente). Lida os campos brutos com cuidado —
  // `entradaBruta` ainda não passou pelo Zod aqui.
  if (
    typeof entradaBruta === "object" &&
    entradaBruta !== null &&
    "id" in entradaBruta &&
    typeof entradaBruta.id === "string" &&
    "controlaEstoque" in entradaBruta &&
    entradaBruta.controlaEstoque === false
  ) {
    const [itemAtualParaChecagemRapida] = await db
      .select({ controlaEstoque: itensCatalogo.controlaEstoque })
      .from(itensCatalogo)
      .where(eq(itensCatalogo.id, entradaBruta.id))
      .limit(1);

    if (itemAtualParaChecagemRapida?.controlaEstoque) {
      const usos = await db
        .select({ itemNome: itensCatalogo.nome, insumoId: fichaTecnica.insumoId })
        .from(fichaTecnica)
        .innerJoin(itensCatalogo, eq(fichaTecnica.itemId, itensCatalogo.id))
        .where(eq(fichaTecnica.insumoId, entradaBruta.id));

      const podeDeixar = podeDeixarDeTerEstoque(entradaBruta.id, usos);
      if (!podeDeixar.ok) {
        return { ok: false, erro: podeDeixar.erro };
      }
    }
  }

  const insumosDisponiveis = await carregarInsumosDisponiveis();
  const resultado = esquemaEdicaoDeItem(insumosDisponiveis).safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [itemAtual] = await tx
        .select({
          categoriaVendaId: itensCatalogo.categoriaVendaId,
          categoriaCompraId: itensCatalogo.categoriaCompraId,
          controlaEstoque: itensCatalogo.controlaEstoque,
        })
        .from(itensCatalogo)
        .where(eq(itensCatalogo.id, dados.id))
        .for("update");

      if (!itemAtual) {
        throw new ItemNaoEncontrado();
      }

      const idsDeCategorias = [dados.categoriaVendaId, dados.categoriaCompraId].filter(
        (id): id is string => id !== null,
      );
      const categoriasCarregadas =
        idsDeCategorias.length > 0
          ? await tx
              .select({ id: categorias.id, ativa: categorias.ativa, grupo: categorias.grupo })
              .from(categorias)
              .where(inArray(categorias.id, idsDeCategorias))
          : [];
      const categoriaPorId = new Map(
        categoriasCarregadas.map((categoria) => [categoria.id, categoria]),
      );

      if (
        dados.categoriaVendaId &&
        !categoriaDeVendaValida(
          categoriaPorId.get(dados.categoriaVendaId),
          dados.categoriaVendaId,
          itemAtual.categoriaVendaId,
        )
      ) {
        throw new CategoriaDeVendaInvalida();
      }
      if (
        dados.categoriaCompraId &&
        !categoriaDeCompraValida(
          categoriaPorId.get(dados.categoriaCompraId),
          dados.categoriaCompraId,
          itemAtual.categoriaCompraId,
        )
      ) {
        throw new CategoriaDeCompraInvalida();
      }

      // Deixar de ter estoque próprio: recusa se algum OUTRO item usa este como insumo
      // (podeDeixarDeTerEstoque, lib/cadastros/catalogo.ts) — a MESMA regra pura, com o retrato
      // de uso carregado agora, dentro da transação.
      if (itemAtual.controlaEstoque && !dados.controlaEstoque) {
        const usos = await tx
          .select({ itemNome: itensCatalogo.nome, insumoId: fichaTecnica.insumoId })
          .from(fichaTecnica)
          .innerJoin(itensCatalogo, eq(fichaTecnica.itemId, itensCatalogo.id))
          .where(eq(fichaTecnica.insumoId, dados.id));

        const podeDeixar = podeDeixarDeTerEstoque(dados.id, usos);
        if (!podeDeixar.ok) {
          throw new ItemEhInsumoDeOutro(podeDeixar.erro);
        }
      }

      await tx
        .update(itensCatalogo)
        .set({
          nome: dados.nome,
          categoriaVendaId: dados.categoriaVendaId,
          precoVendaCentavos: dados.precoVendaCentavos,
          aparecenaVenda: dados.aparecenaVenda,
          atalhoVenda: dados.atalhoVenda,
          controlaEstoque: dados.controlaEstoque,
          atalhoCompra: dados.atalhoCompra,
          unidade: dados.unidade,
          categoriaCompraId: dados.categoriaCompraId,
        })
        .where(eq(itensCatalogo.id, dados.id));

      await tx.delete(fichaTecnica).where(eq(fichaTecnica.itemId, dados.id));
      if (dados.ficha.length > 0) {
        await tx.insert(fichaTecnica).values(
          dados.ficha.map((linhaDeFicha) => ({
            itemId: dados.id,
            insumoId: linhaDeFicha.insumoId,
            quantidade: String(linhaDeFicha.quantidade),
          })),
        );
      }
    });

    revalidatePath("/cadastros");
    revalidatePath("/financeiro");
    return { ok: true, dados: { id: dados.id } };
  } catch (erro) {
    if (erro instanceof ItemNaoEncontrado) {
      return { ok: false, erro: FRASE_ITEM_NAO_EXISTE_MAIS };
    }
    if (erro instanceof CategoriaDeVendaInvalida) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_VENDA_INVALIDA };
    }
    if (erro instanceof CategoriaDeCompraInvalida) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_COMPRA_INVALIDA };
    }
    if (erro instanceof ItemEhInsumoDeOutro) {
      return { ok: false, erro: erro.message };
    }
    console.error("Falha ao editar item do catálogo:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// ---------------------------------------------------------------------------------------------
// Contas fixas (04.4-10-PLAN.md, D-13)
// ---------------------------------------------------------------------------------------------

// Categoria de conta fixa: existir, ser do grupo `geral`, `custo` ou `fora` (must_have do plano),
// e estar ATIVA. Contas fixas não têm "categoria mantida mesmo desativada" como o Catálogo — a
// tela só oferece categorias ativas no `<select>` (`listarCategoriasParaContaFixa`), então a
// única forma de chegar aqui com uma categoria inválida é forçar o formulário.
function categoriaDaContaFixaValida(categoria: { grupo: string; ativa: boolean } | undefined): boolean {
  if (!categoria || !categoria.ativa) {
    return false;
  }
  return categoria.grupo === "geral" || categoria.grupo === "custo" || categoria.grupo === "fora";
}

// Único caminho de criação de conta fixa (FNC-14, D-13). `exigirUsuario()` é a PRIMEIRA instrução
// do corpo.
export async function criarContaFixa(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaContaFixa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  const [categoria] = await db
    .select({ grupo: categorias.grupo, ativa: categorias.ativa })
    .from(categorias)
    .where(eq(categorias.id, dados.categoriaId))
    .limit(1);

  if (!categoriaDaContaFixaValida(categoria)) {
    return { ok: false, erro: FRASE_CATEGORIA_DA_CONTA_FIXA_INVALIDA };
  }

  try {
    const [linha] = await db
      .insert(contasFixas)
      .values({
        nome: dados.nome,
        categoriaId: dados.categoriaId,
        valorEsperadoCentavos: dados.valorTexto,
        diaVencimento: dados.diaVencimento,
      })
      .returning({ id: contasFixas.id });

    revalidatePath("/cadastros");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao gravar conta fixa:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Mudar o valor esperado vale só para as PRÓXIMAS gerações (must_have do plano) — um `update` de
// uma linha só, sem transação: as despesas já geradas guardam o próprio `valor_centavos` na
// linha do documento, nunca uma referência ao valor atual da conta fixa (mesmo desenho de
// "mudar o preço do item não reescreve a venda já lançada", lib/cadastros/acoes.ts::editarItem).
export async function atualizarValorDaContaFixa(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; valorCentavos: number }>> {
  await exigirUsuario();

  const resultado = esquemaValorDaContaFixa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id, valorTexto } = resultado.data;

  try {
    const [linha] = await db
      .update(contasFixas)
      .set({ valorEsperadoCentavos: valorTexto })
      .where(eq(contasFixas.id, id))
      .returning({ id: contasFixas.id });

    if (!linha) {
      return { ok: false, erro: FRASE_CONTA_FIXA_NAO_EXISTE_MAIS };
    }

    revalidatePath("/cadastros");
    return { ok: true, dados: { id, valorCentavos: valorTexto } };
  } catch (erro) {
    console.error("Falha ao atualizar o valor da conta fixa:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Conta fixa nunca se apaga — desativar/reativar é a ÚNICA forma de remoção (D-13). Recebe o
// estado DESEJADO, nunca "inverte" (mesma disciplina de `definirCategoriaAtiva` acima): duas
// chamadas com o mesmo valor convergem sempre. Uma conta fixa desativada não entra em "Gerar as
// contas de {mês}" (`gerarContasDoMes` abaixo só lê `ativa = true`).
export async function definirContaFixaAtiva(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ativa: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaAtivacaoDeContaFixa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id, ativa } = resultado.data;

  try {
    const [linha] = await db
      .update(contasFixas)
      .set({ ativa })
      .where(eq(contasFixas.id, id))
      .returning({ id: contasFixas.id });

    if (!linha) {
      return { ok: false, erro: FRASE_CONTA_FIXA_NAO_EXISTE_MAIS };
    }

    revalidatePath("/cadastros");
    return { ok: true, dados: { id, ativa } };
  } catch (erro) {
    console.error("Falha ao (des)ativar conta fixa:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Gerar as contas de {mês}" (04.4-10-PLAN.md, Tarefa 2): para cada conta fixa ATIVA, insere um
// `documentos` de despesa com `on conflict (conta_fixa_id, mes_referencia) do nothing` — é o
// BANCO, não uma leitura prévia de "já existe?", que garante a idempotência (T-04.4-61), inclusive
// sob dois gestores gerando o MESMO mês ao mesmo tempo. `exigirUsuario()` é a PRIMEIRA instrução
// do corpo.
export async function gerarContasDoMes(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ criadas: number; mes: string }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaGeracao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { mes } = resultado.data;

  // T-04.4-72: o servidor só aceita um mês dentro da faixa (o mês corrente até onze meses à
  // frente, `mesPermitidoParaGeracao`) — o seletor nunca oferece outro, mas um envio forçado (DOM
  // adulterado) é recusado aqui, nunca confiado.
  const hoje = hojeEmBrasilia(new Date());
  if (!mesPermitidoParaGeracao(hoje, mes)) {
    return { ok: false, erro: FRASE_MES_DE_GERACAO_INVALIDO };
  }

  try {
    const criadas = await db.transaction(async (tx) => {
      const contasAtivas = await tx
        .select({
          id: contasFixas.id,
          nome: contasFixas.nome,
          categoriaId: contasFixas.categoriaId,
          valorEsperadoCentavos: contasFixas.valorEsperadoCentavos,
          diaVencimento: contasFixas.diaVencimento,
        })
        .from(contasFixas)
        .where(eq(contasFixas.ativa, true));

      const mesReferencia = primeiroDiaDoMes(mes);
      let total = 0;

      for (const conta of contasAtivas) {
        const vencimento = vencimentoNoMes(conta.diaVencimento, mes);

        const [documentoCriado] = await tx
          .insert(documentos)
          .values({
            tipo: "despesa",
            data: vencimento,
            titulo: tituloDaContaFixa(conta.nome, mes),
            contaFixaId: conta.id,
            mesReferencia,
            criadoPor: usuario.id,
          })
          .onConflictDoNothing({ target: [documentos.contaFixaId, documentos.mesReferencia] })
          .returning({ id: documentos.id });

        // Sem linha devolvida: o `on conflict` ignorou a inserção — essa conta já tinha sido
        // gerada para este mês. Nenhuma linha nem parcela é criada para ela de novo.
        if (!documentoCriado) {
          continue;
        }

        await tx.insert(documentoLinhas).values({
          documentoId: documentoCriado.id,
          ordem: 0,
          categoriaId: conta.categoriaId,
          descricao: conta.nome,
          quantidade: 1,
          valorCentavos: conta.valorEsperadoCentavos,
        });

        await tx.insert(parcelas).values({
          documentoId: documentoCriado.id,
          numero: 1,
          vencimento,
          valorCentavos: conta.valorEsperadoCentavos,
          forma: "pix",
        });

        total += 1;
      }

      return total;
    });

    revalidatePath("/financeiro");
    revalidatePath("/cadastros");
    return { ok: true, dados: { criadas, mes } };
  } catch (erro) {
    console.error("Falha ao gerar as contas do mês:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

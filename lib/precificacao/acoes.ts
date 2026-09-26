"use server";

import { and, desc, eq, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categorias, fichasPrecificacao, itensCatalogo, parametrosPrecificacao } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

import {
  esquemaCalculoDaHora,
  esquemaEdicaoDeFicha,
  esquemaFicha,
  esquemaSeloDeParametro,
  esquemaValorDeParametro,
} from "./esquemas";
import { calcularHora } from "./hora";
import type { ChaveDeParametro } from "./parametros";
import {
  FRASE_CATEGORIA_DE_VENDA_INVALIDA,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FICHA_NAO_EXISTE_MAIS,
  FRASE_INFORME_AS_HORAS,
  FRASE_PARAMETRO_NAO_EXISTE_MAIS,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts`/`lib/cadastros/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// A gravação por HISTÓRICO (D-15), o único caminho de escrita de VALOR de parâmetro do sistema:
// `insert ... on conflict (chave, vigente_desde) do update` sobre a restrição única da tabela.
// Duas edições da MESMA chave no MESMO dia caem no `on conflict` e atualizam a linha de hoje — a
// vigência não muda, então o gatilho `recusar_mudanca_de_valor_do_parametro` (migração 0018)
// deixa passar; uma edição num dia novo insere a linha seguinte, e a anterior nunca é tocada.
// Chamada por `definirParametro` e por `usarHoraCalculada` (a hora é só mais uma chave).
async function gravarValorDeParametro({
  chave,
  valorInteiro,
  criadoPor,
  hoje,
}: {
  chave: ChaveDeParametro;
  valorInteiro: number;
  criadoPor: string;
  hoje: string;
}): Promise<void> {
  await db
    .insert(parametrosPrecificacao)
    .values({ chave, valorInteiro, vigenteDesde: hoje, criadoPor })
    .onConflictDoUpdate({
      target: [parametrosPrecificacao.chave, parametrosPrecificacao.vigenteDesde],
      set: { valorInteiro },
    });
}

// Mudar o valor de um parâmetro (D-15). `exigirUsuario()` é a PRIMEIRA instrução do corpo
// (verificado por `npm run verificar-acoes`, decidido por árvore sintática).
export async function definirParametro(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ chave: ChaveDeParametro }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaValorDeParametro.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { chave, valorInteiro } = resultado.data;

  try {
    await gravarValorDeParametro({
      chave,
      valorInteiro,
      criadoPor: usuario.id,
      hoje: hojeEmBrasilia(new Date()),
    });
    return { ok: true, dados: { chave } };
  } catch (erro) {
    console.error("Falha ao gravar parâmetro:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// O selo estimado ↔ medido — a ÚNICA atualização DIRETA de `parametros_precificacao` do módulo
// inteiro (D-15: o gatilho do banco recusa qualquer outra coluna). Atualiza a linha VIGENTE hoje
// para aquela chave (achada por leitura, nunca por `vigente_desde = hoje`: o valor pode ter sido
// definido num dia anterior). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function marcarParametroComoMedido(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ chave: ChaveDeParametro; medido: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaSeloDeParametro.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { chave, medido } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    const [vigente] = await db
      .select({ vigenteDesde: parametrosPrecificacao.vigenteDesde })
      .from(parametrosPrecificacao)
      .where(and(eq(parametrosPrecificacao.chave, chave), lte(parametrosPrecificacao.vigenteDesde, hoje)))
      .orderBy(desc(parametrosPrecificacao.vigenteDesde))
      .limit(1);

    if (!vigente) {
      return { ok: false, erro: FRASE_PARAMETRO_NAO_EXISTE_MAIS };
    }

    await db
      .update(parametrosPrecificacao)
      .set({ medido })
      .where(
        and(
          eq(parametrosPrecificacao.chave, chave),
          eq(parametrosPrecificacao.vigenteDesde, vigente.vigenteDesde),
        ),
      );

    return { ok: true, dados: { chave, medido } };
  } catch (erro) {
    console.error("Falha ao marcar parâmetro como medido:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Calcular minha hora" → "Usar esta hora" (ORC-04): valida os três campos, chama a mesma conta
// pura que o diálogo mostra ao vivo, e — sem horas informadas — devolve a MESMA frase que o
// diálogo já mostrava antes do envio; com horas, grava a chave `trabalho_hora` pelo caminho comum
// de histórico (D-15). O selo da hora nasce sempre "estimado" (`gravarValorDeParametro` nunca
// grava `medido`, e a coluna nasce com o padrão `false` do banco). `exigirUsuario()` é a PRIMEIRA
// instrução do corpo.
export async function usarHoraCalculada(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ horaCentavos: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCalculoDaHora.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { retiradaCentavos, casaCentavos, horasMilesimos } = resultado.data;

  const horaCentavos = calcularHora({ retiradaCentavos, casaCentavos, horasMilesimos });
  if (horaCentavos === null) {
    return { ok: false, erro: FRASE_INFORME_AS_HORAS };
  }

  try {
    await gravarValorDeParametro({
      chave: "trabalho_hora",
      valorInteiro: horaCentavos,
      criadoPor: usuario.id,
      hoje: hojeEmBrasilia(new Date()),
    });
    return { ok: true, dados: { horaCentavos } };
  } catch (erro) {
    console.error("Falha ao gravar a hora calculada:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// ---------------------------------------------------------------------------------------------
// Ficha de peça (04.5-04-PLAN.md — D-18/D-19)
// ---------------------------------------------------------------------------------------------

class CategoriaDeVendaInvalida extends Error {}
class FichaNaoEncontrada extends Error {}

// Categoria de venda: existir, estar ATIVA, e ser do grupo `receita` — a MESMA regra de
// `lib/cadastros/acoes.ts::categoriaDeVendaValida`, redeclarada aqui (cada módulo tem sua própria
// cópia, D-15 do projeto). Pura: recebe o retrato JÁ carregado do banco, nunca confia no que o
// cliente diz sobre a categoria (T-04.5-19).
function categoriaDeVendaEhValida(categoria: { grupo: string; ativa: boolean } | undefined): boolean {
  return !!categoria && categoria.ativa && categoria.grupo === "receita";
}

// Cria a ficha e, se não for exclusiva, o item de catálogo que a representa — na MESMA transação
// (key_links do plano: se o item falhar, a ficha não nasce meio ligada). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function criarFicha(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaFicha.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const idDaFicha = await db.transaction(async (tx) => {
      const camposComuns = {
        nome: dados.nome,
        argilaMiligramas: dados.argilaMiligramas,
        esmalteMiligramas: dados.esmalteMiligramas,
        horasMilesimos: dados.horasMilesimos,
        larguraMm: dados.larguraMm,
        profundidadeMm: dados.profundidadeMm,
        alturaMm: dados.alturaMm,
        embalagemCentavos: dados.embalagemCentavos,
        cabemBiscoitoInformado: dados.cabemBiscoitoInformado,
        cabemEsmalteInformado: dados.cabemEsmalteInformado,
        precoMercadoCentavos: dados.precoMercadoCentavos,
        criadoPor: usuario.id,
      };

      if (dados.exclusiva) {
        // Ficha exclusiva: sem item de catálogo, o preço praticado mora nela mesma.
        const [ficha] = await tx
          .insert(fichasPrecificacao)
          .values({
            ...camposComuns,
            precoPraticadoCentavos: dados.precoPraticadoCentavos,
            exclusiva: true,
            itemCatalogoId: null,
          })
          .returning({ id: fichasPrecificacao.id });
        return ficha.id;
      }

      // Não-nulo: `validarFicha` (chamada pelo `superRefine` de `esquemaFicha`) já recusou uma
      // ficha não-exclusiva sem categoria de venda antes de chegar aqui.
      const categoriaVendaId = dados.categoriaVendaId!;

      const [categoria] = await tx
        .select({ ativa: categorias.ativa, grupo: categorias.grupo })
        .from(categorias)
        .where(eq(categorias.id, categoriaVendaId))
        .limit(1);
      if (!categoriaDeVendaEhValida(categoria)) {
        throw new CategoriaDeVendaInvalida();
      }

      // Sempre cria um item NOVO — "vincular a um item existente" (mencionado no BRIEFING) fica
      // para quando uma tela oferecer esse seletor; o diálogo desta fase (04.5-04-PLAN.md,
      // Tarefa 3) não tem um, então esse caminho nunca é exercitado. Ver SUMMARY, "Decidido sem o
      // dono".
      const [item] = await tx
        .insert(itensCatalogo)
        .values({
          nome: dados.nome,
          categoriaVendaId,
          precoVendaCentavos: dados.precoPraticadoCentavos,
          aparecenaVenda: true,
        })
        .returning({ id: itensCatalogo.id });

      // Ficha de linha (D-18): o preço praticado É o do item — a coluna da ficha fica NULA, nunca
      // um segundo valor a sincronizar.
      const [ficha] = await tx
        .insert(fichasPrecificacao)
        .values({
          ...camposComuns,
          precoPraticadoCentavos: null,
          exclusiva: false,
          itemCatalogoId: item.id,
        })
        .returning({ id: fichasPrecificacao.id });
      return ficha.id;
    });

    revalidatePath("/financeiro");
    revalidatePath("/cadastros");
    return { ok: true, dados: { id: idDaFicha } };
  } catch (erro) {
    if (erro instanceof CategoriaDeVendaInvalida) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_VENDA_INVALIDA };
    }
    console.error("Falha ao gravar ficha de precificação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Edita a ficha, incluindo as duas transições de D-18/D-19: desmarcar "exclusiva" promove a peça a
// de linha (cria ou usa o item); marcar "exclusiva" numa ficha de linha desliga o item — que
// CONTINUA existindo, porque pode haver venda já lançada nele (comentário pedido pelo plano).
// `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function editarFicha(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaEdicaoDeFicha.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [fichaAtual] = await tx
        .select({ itemCatalogoId: fichasPrecificacao.itemCatalogoId })
        .from(fichasPrecificacao)
        .where(eq(fichasPrecificacao.id, dados.id))
        .for("update");

      if (!fichaAtual) {
        throw new FichaNaoEncontrada();
      }

      const camposComuns = {
        nome: dados.nome,
        argilaMiligramas: dados.argilaMiligramas,
        esmalteMiligramas: dados.esmalteMiligramas,
        horasMilesimos: dados.horasMilesimos,
        larguraMm: dados.larguraMm,
        profundidadeMm: dados.profundidadeMm,
        alturaMm: dados.alturaMm,
        embalagemCentavos: dados.embalagemCentavos,
        cabemBiscoitoInformado: dados.cabemBiscoitoInformado,
        cabemEsmalteInformado: dados.cabemEsmalteInformado,
        precoMercadoCentavos: dados.precoMercadoCentavos,
      };

      if (dados.exclusiva) {
        // Marcar exclusiva desliga o item do catálogo — ele CONTINUA existindo (pode haver venda
        // já lançada nele), só deixa de estar vinculado a esta ficha. O campo de preço do
        // formulário já trazia o preço do item (D-18, `obterFichaParaEdicao` resolve o "preço
        // efetivo"), então `dados.precoPraticadoCentavos` é o valor certo para a ficha guardar.
        await tx
          .update(fichasPrecificacao)
          .set({
            ...camposComuns,
            precoPraticadoCentavos: dados.precoPraticadoCentavos,
            exclusiva: true,
            itemCatalogoId: null,
          })
          .where(eq(fichasPrecificacao.id, dados.id));
        return;
      }

      // Não-nulo: `validarFicha` já recusou uma ficha não-exclusiva sem categoria antes daqui.
      const categoriaVendaId = dados.categoriaVendaId!;

      const [categoria] = await tx
        .select({ ativa: categorias.ativa, grupo: categorias.grupo })
        .from(categorias)
        .where(eq(categorias.id, categoriaVendaId))
        .limit(1);
      if (!categoriaDeVendaEhValida(categoria)) {
        throw new CategoriaDeVendaInvalida();
      }

      let itemCatalogoId = fichaAtual.itemCatalogoId;
      if (itemCatalogoId) {
        // Já era de linha: atualiza o item existente — nome e preço mudam nele, NUNCA na ficha.
        await tx
          .update(itensCatalogo)
          .set({
            nome: dados.nome,
            categoriaVendaId,
            precoVendaCentavos: dados.precoPraticadoCentavos,
          })
          .where(eq(itensCatalogo.id, itemCatalogoId));
      } else {
        // Promoção de exclusiva → de linha: o item nasce agora, com o preço que a ficha tinha.
        const [item] = await tx
          .insert(itensCatalogo)
          .values({
            nome: dados.nome,
            categoriaVendaId,
            precoVendaCentavos: dados.precoPraticadoCentavos,
            aparecenaVenda: true,
          })
          .returning({ id: itensCatalogo.id });
        itemCatalogoId = item.id;
      }

      // Ficha de linha (D-18): o preço praticado É o do item — a coluna da ficha fica NULA.
      await tx
        .update(fichasPrecificacao)
        .set({
          ...camposComuns,
          precoPraticadoCentavos: null,
          exclusiva: false,
          itemCatalogoId,
        })
        .where(eq(fichasPrecificacao.id, dados.id));
    });

    revalidatePath("/financeiro");
    revalidatePath("/cadastros");
    return { ok: true, dados: { id: dados.id } };
  } catch (erro) {
    if (erro instanceof CategoriaDeVendaInvalida) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_VENDA_INVALIDA };
    }
    if (erro instanceof FichaNaoEncontrada) {
      return { ok: false, erro: FRASE_FICHA_NAO_EXISTE_MAIS };
    }
    console.error("Falha ao editar ficha de precificação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

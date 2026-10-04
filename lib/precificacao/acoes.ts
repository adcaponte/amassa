"use server";

import { and, desc, eq, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { fichasPrecificacao, itensCatalogo, parametrosPrecificacao } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { esquemaId } from "@/lib/financeiro/esquemas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

import {
  contarOrcamentosDaFicha,
  contarOrdensDaFicha,
  ordensDaCasaAbertasDaFicha,
} from "./consultas";
import {
  esquemaCalculoDaHora,
  esquemaEdicaoDeFicha,
  esquemaFicha,
  esquemaSeloDeParametro,
  esquemaValorDeParametro,
} from "./esquemas";
import {
  CategoriaDeVendaInvalida,
  FichaNaoEncontrada,
  conferirCategoriaDeVenda,
  promoverFichaParaLinha,
} from "./gravacao";
import { calcularHora } from "./hora";
import type { ChaveDeParametro, ChaveForaDoCalculo } from "./parametros";
import {
  FRASE_CATEGORIA_DE_VENDA_INVALIDA,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FICHA_NAO_EXISTE_MAIS,
  FRASE_INFORME_AS_HORAS,
  FRASE_PARAMETRO_NAO_EXISTE_MAIS,
  FRASE_REGUA_AUSENTE,
  FRASE_REGUA_MAIOR_QUE_ZERO,
  FRASE_REGUA_P_MENOR_QUE_M,
  fraseFichaEmUsoCompleta,
  fraseFichaNaProducaoDaCasa,
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

// A régua P · M · G das Queimas (Fase 06.4, D-03): as duas chaves dependem uma da outra.
const OUTRA_CHAVE_DA_REGUA: Record<ChaveForaDoCalculo, ChaveForaDoCalculo> = {
  queima_regua_p_ate: "queima_regua_m_ate",
  queima_regua_m_ate: "queima_regua_p_ate",
};

function ehChaveDaRegua(chave: ChaveDeParametro): chave is ChaveForaDoCalculo {
  return chave === "queima_regua_p_ate" || chave === "queima_regua_m_ate";
}

// A regra cruzada da régua, no servidor (T-06.4-17): a medida > 0 e P < M, contra o valor VIGENTE
// hoje da outra chave. `null` = pode gravar; senão, a frase da recusa. Sem trava própria: duas
// pessoas mudando P e M no mesmo segundo é risco aceito (T-06.4-18) — a próxima edição recusa.
async function recusaDaRegua(
  chave: ChaveForaDoCalculo,
  valorInteiro: number,
  hoje: string,
): Promise<string | null> {
  if (valorInteiro <= 0) {
    return FRASE_REGUA_MAIOR_QUE_ZERO;
  }
  const outra = OUTRA_CHAVE_DA_REGUA[chave];
  const [vigente] = await db
    .select({ valorInteiro: parametrosPrecificacao.valorInteiro })
    .from(parametrosPrecificacao)
    .where(and(eq(parametrosPrecificacao.chave, outra), lte(parametrosPrecificacao.vigenteDesde, hoje)))
    .orderBy(desc(parametrosPrecificacao.vigenteDesde))
    .limit(1);
  if (!vigente) {
    return FRASE_REGUA_AUSENTE;
  }
  const pAte = chave === "queima_regua_p_ate" ? valorInteiro : vigente.valorInteiro;
  const mAte = chave === "queima_regua_m_ate" ? valorInteiro : vigente.valorInteiro;
  return pAte >= mAte ? FRASE_REGUA_P_MENOR_QUE_M : null;
}

// Mudar o valor de um parâmetro (D-15). `exigirUsuario()` é a PRIMEIRA instrução do corpo
// (verificado por `npm run verificar-acoes`, decidido por árvore sintática). Nenhuma gravação de
// parâmetro toca `queima_contagens`: mudar a régua nunca muda contagem já feita.
export async function definirParametro(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ chave: ChaveDeParametro }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaValorDeParametro.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { chave, valorInteiro } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    if (ehChaveDaRegua(chave)) {
      const recusa = await recusaDaRegua(chave, valorInteiro, hoje);
      if (recusa !== null) {
        return { ok: false, erro: recusa };
      }
    }
    await gravarValorDeParametro({
      chave,
      valorInteiro,
      criadoPor: usuario.id,
      hoje,
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

// `CategoriaDeVendaInvalida`, `FichaNaoEncontrada` e a regra da categoria de venda (existir, estar
// ATIVA, ser do grupo `receita` — T-04.5-19) moram em `./gravacao`, junto da promoção a peça de
// linha que `editarFicha` e a conclusão da ordem usam (D-12, Fase 06.1).

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

      await conferirCategoriaDeVenda(tx, categoriaVendaId);

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

    revalidatePath("/gestao/financeiro");
    revalidatePath("/gestao/cadastros");
    return { ok: true, dados: { id: idDaFicha } };
  } catch (erro) {
    if (erro instanceof CategoriaDeVendaInvalida) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_VENDA_INVALIDA };
    }
    console.error("Falha ao gravar ficha de precificação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Revisão 06.1, WR-01 (opção (a) do dono, 30/09/2026): a recusa de marcar "exclusiva" uma ficha que
// uma ordem da produção da casa ainda aberta usa — com os nomes das ordens, para a frase.
class FichaNaProducaoDaCasa extends Error {
  constructor(public readonly nomesDasOrdens: readonly string[]) {
    super("ficha na produção da casa");
  }
}

// Edita a ficha, incluindo as duas transições de D-18/D-19: desmarcar "exclusiva" promove a peça a
// de linha (cria ou usa o item); marcar "exclusiva" numa ficha de linha desliga o item — que
// CONTINUA existindo, porque pode haver venda já lançada nele (comentário pedido pelo plano) —, e
// é recusado enquanto uma ordem da produção da casa aberta usar a ficha (WR-01, 30/09/2026).
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
        .select({
          itemCatalogoId: fichasPrecificacao.itemCatalogoId,
          exclusiva: fichasPrecificacao.exclusiva,
        })
        .from(fichasPrecificacao)
        .where(eq(fichasPrecificacao.id, dados.id))
        .for("update");

      if (!fichaAtual) {
        throw new FichaNaoEncontrada();
      }

      // Revisão 06.1, WR-01 — opção (a), escolhida pelo dono na Parte 0 (30/09/2026): a ficha de
      // LINHA que uma ordem da produção da casa ainda aberta usa não vira exclusiva. Marcar
      // exclusiva tira o item da ficha, e na Entrega "Guardar no estoque" recusaria toda vez. Lido
      // SOB a trava da ficha (`for update` acima): `criarOrdem` lê a ficha com `for key share` (e o
      // `insert` da peça também a pede, pela chave estrangeira), então uma ordem da casa nova ou
      // entra antes — e aparece aqui — ou espera esta gravação e vê a ficha já exclusiva.
      if (dados.exclusiva && !fichaAtual.exclusiva) {
        const ordensDaCasa = await ordensDaCasaAbertasDaFicha(tx, dados.id);
        if (ordensDaCasa.length > 0) {
          throw new FichaNaProducaoDaCasa(ordensDaCasa);
        }
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

      // Os campos da ficha (o nome novo incluído) primeiro; depois a promoção a peça de linha —
      // `promoverFichaParaLinha` (lib/precificacao/gravacao.ts, a MESMA que a conclusão da ordem
      // usa, D-12) confere a categoria de venda, cria o item (ou atualiza o que a ficha já tem, com
      // o nome novo) e grava `exclusiva = false`, o item e o preço praticado NULO (D-18).
      await tx
        .update(fichasPrecificacao)
        .set(camposComuns)
        .where(eq(fichasPrecificacao.id, dados.id));

      // Não-nulo: `validarFicha` já recusou uma ficha não-exclusiva sem categoria antes daqui.
      await promoverFichaParaLinha(tx, {
        fichaId: dados.id,
        categoriaVendaId: dados.categoriaVendaId!,
        precoCentavos: dados.precoPraticadoCentavos,
      });
    });

    revalidatePath("/gestao/financeiro");
    revalidatePath("/gestao/cadastros");
    return { ok: true, dados: { id: dados.id } };
  } catch (erro) {
    if (erro instanceof CategoriaDeVendaInvalida) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_VENDA_INVALIDA };
    }
    if (erro instanceof FichaNaoEncontrada) {
      return { ok: false, erro: FRASE_FICHA_NAO_EXISTE_MAIS };
    }
    if (erro instanceof FichaNaProducaoDaCasa) {
      return { ok: false, erro: fraseFichaNaProducaoDaCasa(erro.nomesDasOrdens) };
    }
    console.error("Falha ao editar ficha de precificação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// ---------------------------------------------------------------------------------------------
// Apagar ficha (04.5-05-PLAN.md — D-20): nunca apaga o item do Catálogo (pode ter venda lançada,
// e `itens_catalogo` não tem privilégio de exclusão nesta plataforma), e recusa quando a ficha
// está em uso.
// ---------------------------------------------------------------------------------------------

class FichaEmUso extends Error {
  constructor(
    public readonly quantidadeDeOrcamentos: number,
    public readonly quantidadeDeOrdens: number,
  ) {
    super("ficha em uso");
  }
}

const esquemaApagarFicha = z.object({ id: esquemaId });

// `exigirUsuario()` é a PRIMEIRA instrução do corpo. Trava a linha (`for update`), CONTA os
// orçamentos e as ORDENS DE PRODUÇÃO que a usam DENTRO da mesma transação
// (`contarOrcamentosDaFicha`/`contarOrdensDaFicha`, lib/precificacao/consultas.ts — as ordens desde
// a Fase 06.1, Pitfall 11: a chave estrangeira de `ordem_pecas.ficha_id` recusaria com um 23503
// cru) e só então apaga — contar antes e apagar depois, fora de uma transação, é a
// corrida clássica: alguém acrescenta a peça a um orçamento entre a contagem e a exclusão
// (T-04.5-24). Nunca toca `itens_catalogo` — a ficha some, o item (quando existir) continua.
export async function apagarFicha(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaApagarFicha.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [ficha] = await tx
        .select({ id: fichasPrecificacao.id })
        .from(fichasPrecificacao)
        .where(eq(fichasPrecificacao.id, id))
        .for("update");

      if (!ficha) {
        throw new FichaNaoEncontrada();
      }

      const quantidadeDeOrcamentos = await contarOrcamentosDaFicha(tx, id);
      const quantidadeDeOrdens = await contarOrdensDaFicha(tx, id);
      if (quantidadeDeOrcamentos > 0 || quantidadeDeOrdens > 0) {
        throw new FichaEmUso(quantidadeDeOrcamentos, quantidadeDeOrdens);
      }

      await tx.delete(fichasPrecificacao).where(eq(fichasPrecificacao.id, id));
    });

    revalidatePath("/gestao/financeiro");
    return { ok: true, dados: { id } };
  } catch (erro) {
    if (erro instanceof FichaNaoEncontrada) {
      return { ok: false, erro: FRASE_FICHA_NAO_EXISTE_MAIS };
    }
    if (erro instanceof FichaEmUso) {
      return {
        ok: false,
        erro: fraseFichaEmUsoCompleta(erro.quantidadeDeOrcamentos, erro.quantidadeDeOrdens),
      };
    }
    console.error("Falha ao apagar ficha de precificação:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

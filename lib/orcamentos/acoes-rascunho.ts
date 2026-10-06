"use server";

// Ações dos Orçamentos — o RASCUNHO: criar, cabeçalho, linhas, custos de projeto, plano de pagamento
// e observações (D-24/P10, plano 06.5-27 — saíram de `acoes.ts`, que agora é o índice).

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  fichasPrecificacao,
  itensCatalogo,
  orcamentoLinhas,
  orcamentoProjeto,
  orcamentos,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { somarDias } from "@/lib/financeiro/calendario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";
import { arredondarBonito, calcularPeca } from "@/lib/precificacao/calculo";
import { parametrosVigentes } from "@/lib/precificacao/consultas";
import { quantasCabem } from "@/lib/precificacao/forno";

import {
  esquemaAcrescentarLinha,
  esquemaCabecalhoDoOrcamento,
  esquemaCustoDeProjeto,
  esquemaLinhaDeOrcamento,
  esquemaNovoOrcamento,
  esquemaObservacoes,
  esquemaPlanoDePagamento,
  esquemaRemoverCustoDeProjeto,
  esquemaRemoverLinha,
} from "./esquemas";
import { proximoSequencialDeOrcamento } from "./numero";
import { FRASE_FALHA_AO_CRIAR_NOVO, FRASE_FALHA_AO_SALVAR } from "./textos";

import {
  CustoDeProjetoNaoEncontrado,
  FichaNaoEncontradaParaLinha,
  LinhaNaoEncontrada,
  primeiraMensagemDeErro,
  primeiroErroConhecido,
  type ResultadoDeAcao,
} from "./acoes-comum";
import { travarOrcamentoRascunho } from "./acoes-servidor";

const VALIDADE_PADRAO_EM_DIAS = 10;

const PRAZO_PADRAO_DE_ENTREGA_EM_DIAS = 45;

// "Novo orçamento" (D-05/D-06/D-21) — grava o rascunho e devolve o número JÁ ATRIBUÍDO: o
// formulário nunca mostra um estado intermediário "sem número ainda" (04.5-UI-SPEC.md, seção
// "Numeração"). `exigirUsuario()` é a PRIMEIRA instrução do corpo (verificado por
// `npm run verificar-acoes`, decidido por árvore sintática).
//
// O sequencial sai de `proximoSequencialDeOrcamento`, DENTRO desta transação — se qualquer coisa
// abaixo falhar, o Postgres desfaz o incremento do contador junto (D-06): o número nunca chega a
// ser de um orçamento de verdade, então não é reaproveitado, é simplesmente nunca usado.
export async function criarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ano: number; sequencial: number }>> {
  const usuario = await exigirUsuario();

  // D-15 (06.5-14): o rascunho só nasce com o primeiro campo preenchido (Cliente ou Título), já
  // gravado junto — nunca um "Sem título" vazio esquecido na lista.
  const resultado = esquemaNovoOrcamento.safeParse(entradaBruta ?? {});
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { clienteNome, titulo } = resultado.data;

  // O ano do sequencial é o ano de HOJE em Brasília, calculado na borda — nunca lido de dentro de
  // um módulo puro (D-14) nem de `current_date` do Postgres (que estaria em UTC).
  const hoje = hojeEmBrasilia(new Date());
  const ano = Number(hoje.slice(0, 4));
  const entregaPrevista = somarDias(hoje, PRAZO_PADRAO_DE_ENTREGA_EM_DIAS);

  try {
    const { id, sequencial } = await db.transaction(async (tx) => {
      const sequencialDaTransacao = await proximoSequencialDeOrcamento(tx, ano);

      const [orcamento] = await tx
        .insert(orcamentos)
        .values({
          ano,
          sequencial: sequencialDaTransacao,
          status: "rascunho",
          clienteNome,
          titulo,
          data: hoje,
          validadeDias: VALIDADE_PADRAO_EM_DIAS,
          entregaPrevista,
          plano: "sinal",
          sinalPercentual: 50,
          criadoPor: usuario.id,
        })
        .returning({ id: orcamentos.id });

      return { id: orcamento.id, sequencial: sequencialDaTransacao };
    });

    return { ok: true, dados: { id, ano, sequencial } };
  } catch (erro) {
    // Só a tela do orçamento novo chama esta ação (06.5-14): a frase diz que o texto ficou lá.
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_FALHA_AO_CRIAR_NOVO };
    }
    throw erro;
  }
}

// "Para quem e para quando" — os quatro campos do cabeçalho, só enquanto rascunho.
// `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function atualizarCabecalhoDoOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaCabecalhoDoOrcamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id, clienteNome, titulo, entregaPrevista, validadeDias } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, id);

      await tx
        .update(orcamentos)
        .set({ clienteNome, titulo, entregaPrevista, validadeDias })
        .where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao atualizar cabeçalho do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// O preço inicial de uma linha nova (D-23/protótipo "Sugestão para começar"): o praticado da
// ficha (o do item, quando de linha; o dela mesma, quando exclusiva) — ou, sem preço praticado
// ainda, o mínimo de hoje, arredondado (`arredondarBonito`, a MESMA regra que "Atualizar preços"
// usa). Se os parâmetros de hoje não calculam para esta peça (não cabe, divisor inválido — D-11/
// D-12), entra com zero: a linha nasce com o farol vermelho, e o dono ajusta o preço na hora —
// nunca uma exceção que impediria adicionar a peça ao orçamento.
async function precoInicialDaLinha(
  ficha: {
    exclusiva: boolean;
    precoPraticadoCentavos: number | null;
    itemPrecoVendaCentavos: number | null;
    argilaMiligramas: number;
    esmalteMiligramas: number;
    horasMilesimos: number;
    larguraMm: number;
    profundidadeMm: number;
    alturaMm: number;
    embalagemCentavos: number;
    cabemBiscoitoInformado: number | null;
    cabemEsmalteInformado: number | null;
  },
  hoje: string,
): Promise<number> {
  const precoEfetivo = ficha.exclusiva ? ficha.precoPraticadoCentavos : ficha.itemPrecoVendaCentavos;
  if (precoEfetivo !== null) {
    return precoEfetivo;
  }

  const parametros = await parametrosVigentes(hoje);
  if (!parametros.ok) {
    return 0;
  }

  const cabem = quantasCabem(
    { larguraMm: ficha.larguraMm, profundidadeMm: ficha.profundidadeMm, alturaMm: ficha.alturaMm },
    parametros.forno,
    { biscoito: ficha.cabemBiscoitoInformado, esmalte: ficha.cabemEsmalteInformado },
  );
  const resultado = calcularPeca({
    ficha: {
      argilaMiligramas: ficha.argilaMiligramas,
      esmalteMiligramas: ficha.esmalteMiligramas,
      horasMilesimos: ficha.horasMilesimos,
      embalagemCentavos: ficha.embalagemCentavos,
    },
    cabem,
    parametros: parametros.calculo,
    taxaCartaoPontosBase: parametros.taxaCartaoPontosBase,
    canal: "direto",
  });
  if (!resultado.ok) {
    return 0;
  }
  return arredondarBonito(resultado.minimoCentavos);
}

// "+ Peça da lista" / "+ Peça exclusiva deste pedido" (must_have): a ficha é carregada do banco
// DENTRO da transação — nome, custo e mínimo NUNCA vêm do cliente, só o id escolhido
// (T-04.5-29). Quantidade sempre nasce 1; o preço é resolvido por `precoInicialDaLinha`.
// `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function acrescentarLinha(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAcrescentarLinha.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, fichaId } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    const idDaLinha = await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const [ficha] = await tx
        .select({
          exclusiva: fichasPrecificacao.exclusiva,
          precoPraticadoCentavos: fichasPrecificacao.precoPraticadoCentavos,
          itemPrecoVendaCentavos: itensCatalogo.precoVendaCentavos,
          argilaMiligramas: fichasPrecificacao.argilaMiligramas,
          esmalteMiligramas: fichasPrecificacao.esmalteMiligramas,
          horasMilesimos: fichasPrecificacao.horasMilesimos,
          larguraMm: fichasPrecificacao.larguraMm,
          profundidadeMm: fichasPrecificacao.profundidadeMm,
          alturaMm: fichasPrecificacao.alturaMm,
          embalagemCentavos: fichasPrecificacao.embalagemCentavos,
          cabemBiscoitoInformado: fichasPrecificacao.cabemBiscoitoInformado,
          cabemEsmalteInformado: fichasPrecificacao.cabemEsmalteInformado,
        })
        .from(fichasPrecificacao)
        .leftJoin(itensCatalogo, eq(fichasPrecificacao.itemCatalogoId, itensCatalogo.id))
        .where(eq(fichasPrecificacao.id, fichaId));

      if (!ficha) {
        throw new FichaNaoEncontradaParaLinha();
      }

      const precoUnitarioCentavos = await precoInicialDaLinha(ficha, hoje);

      // `ordem = max(ordem) + 1`, com as linhas existentes TRAVADAS — duas adições concorrentes
      // ao MESMO orçamento nunca disputam o mesmo número (unique(orcamento_id, ordem)).
      const linhasExistentes = await tx
        .select({ ordem: orcamentoLinhas.ordem })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, orcamentoId))
        .for("update"); // trava as linhas do orçamento antes de calcular a próxima ordem (for update)
      const proximaOrdem = linhasExistentes.reduce((maior, l) => Math.max(maior, l.ordem), -1) + 1;

      const [linha] = await tx
        .insert(orcamentoLinhas)
        .values({
          orcamentoId,
          fichaId,
          quantidade: 1,
          precoUnitarioCentavos,
          ordem: proximaOrdem,
        })
        .returning({ id: orcamentoLinhas.id });

      return linha.id;
    });

    return { ok: true, dados: { id: idDaLinha } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao acrescentar linha ao orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "quantas"/"cada"/Cor/Personalização de uma linha já existente. A ficha nunca muda de linha —
// só quantidade, preço, cor e personalização. `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function atualizarLinha(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaLinhaDeOrcamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, id, quantidade, precoCentavos, cor, personalizacao } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const [linha] = await tx
        .select({ id: orcamentoLinhas.id })
        .from(orcamentoLinhas)
        .where(and(eq(orcamentoLinhas.id, id), eq(orcamentoLinhas.orcamentoId, orcamentoId)))
        .for("update"); // trava a própria linha antes de gravar — nenhuma edição concorrente na mesma linha (for update)

      if (!linha) {
        throw new LinhaNaoEncontrada();
      }

      await tx
        .update(orcamentoLinhas)
        .set({ quantidade, precoUnitarioCentavos: precoCentavos, cor, personalizacao })
        .where(eq(orcamentoLinhas.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao atualizar linha do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "tirar": reordena as linhas seguintes DENTRO da mesma transação, para não abrir buraco na
// sequência de ordem (unique(orcamento_id, ordem)). `exigirUsuario()` é a PRIMEIRA instrução do
// corpo.
export async function removerLinha(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaRemoverLinha.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const linhasDoOrcamento = await tx
        .select({ id: orcamentoLinhas.id, ordem: orcamentoLinhas.ordem })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, orcamentoId))
        .orderBy(orcamentoLinhas.ordem)
        .for("update"); // trava todas as linhas do orçamento antes de apagar e reordenar (for update)

      const linhaAlvo = linhasDoOrcamento.find((linha) => linha.id === id);
      if (!linhaAlvo) {
        throw new LinhaNaoEncontrada();
      }

      await tx.delete(orcamentoLinhas).where(eq(orcamentoLinhas.id, id));

      const seguintes = linhasDoOrcamento.filter((linha) => linha.ordem > linhaAlvo.ordem);
      for (const linha of seguintes) {
        await tx
          .update(orcamentoLinhas)
          .set({ ordem: linha.ordem - 1 })
          .where(eq(orcamentoLinhas.id, linha.id));
      }
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao remover linha do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// ---------------------------------------------------------------------------------------------
// "Custos do projeto e frete" / "Total e pagamento" (04.5-07-PLAN.md, Tarefa 2)
// ---------------------------------------------------------------------------------------------

// "+ Custo do projeto": nasce como uma linha nova, com `ordem = max(ordem) + 1` entre as linhas
// TRAVADAS (mesma disciplina de `acrescentarLinha` — duas adições concorrentes nunca disputam o
// mesmo número). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function acrescentarCustoDeProjeto(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaCustoDeProjeto.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, descricao, valorCentavos } = resultado.data;

  try {
    const idDaLinha = await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const linhasExistentes = await tx
        .select({ ordem: orcamentoProjeto.ordem })
        .from(orcamentoProjeto)
        .where(eq(orcamentoProjeto.orcamentoId, orcamentoId))
        .for("update"); // trava as linhas de projeto antes de calcular a próxima ordem (for update)
      const proximaOrdem = linhasExistentes.reduce((maior, l) => Math.max(maior, l.ordem), -1) + 1;

      const [linha] = await tx
        .insert(orcamentoProjeto)
        .values({ orcamentoId, descricao, valorCentavos, ordem: proximaOrdem })
        .returning({ id: orcamentoProjeto.id });

      return linha.id;
    });

    return { ok: true, dados: { id: idDaLinha } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao acrescentar custo de projeto:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Editar "O quê"/"Valor" de um custo de projeto já existente — a MESMA validação de
// `acrescentarCustoDeProjeto` (`esquemaCustoDeProjeto`, agora com `id` presente).
// `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function atualizarCustoDeProjeto(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaCustoDeProjeto.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, id, descricao, valorCentavos } = resultado.data;

  if (!id) {
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const [linha] = await tx
        .select({ id: orcamentoProjeto.id })
        .from(orcamentoProjeto)
        .where(and(eq(orcamentoProjeto.id, id), eq(orcamentoProjeto.orcamentoId, orcamentoId)))
        .for("update"); // trava a própria linha antes de gravar — nenhuma edição concorrente na mesma linha (for update)

      if (!linha) {
        throw new CustoDeProjetoNaoEncontrado();
      }

      await tx
        .update(orcamentoProjeto)
        .set({ descricao, valorCentavos })
        .where(eq(orcamentoProjeto.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao atualizar custo de projeto:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "tirar" um custo de projeto: reordena as linhas seguintes DENTRO da mesma transação, sem abrir
// buraco na sequência de ordem (mesma disciplina de `removerLinha`). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function removerCustoDeProjeto(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaRemoverCustoDeProjeto.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const linhasDoOrcamento = await tx
        .select({ id: orcamentoProjeto.id, ordem: orcamentoProjeto.ordem })
        .from(orcamentoProjeto)
        .where(eq(orcamentoProjeto.orcamentoId, orcamentoId))
        .orderBy(orcamentoProjeto.ordem)
        .for("update"); // trava todas as linhas de projeto antes de apagar e reordenar (for update)

      const linhaAlvo = linhasDoOrcamento.find((linha) => linha.id === id);
      if (!linhaAlvo) {
        throw new CustoDeProjetoNaoEncontrado();
      }

      await tx.delete(orcamentoProjeto).where(eq(orcamentoProjeto.id, id));

      const seguintes = linhasDoOrcamento.filter((linha) => linha.ordem > linhaAlvo.ordem);
      for (const linha of seguintes) {
        await tx
          .update(orcamentoProjeto)
          .set({ ordem: linha.ordem - 1 })
          .where(eq(orcamentoProjeto.id, linha.id));
      }
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao remover custo de projeto:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Como o cliente paga"/"Sinal (%)"/"Frete" — os três sempre juntos (o schema explica o porquê).
// `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function definirPlanoDePagamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaPlanoDePagamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, plano, sinalPercentual, freteCentavos } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      await tx
        .update(orcamentos)
        .set(
          sinalPercentual === null
            ? { plano, freteCentavos }
            : { plano, freteCentavos, sinalPercentual },
        )
        .where(eq(orcamentos.id, orcamentoId));
    });

    return { ok: true, dados: { id: orcamentoId } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao definir plano de pagamento do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Observações para o cliente": até 300 caracteres, campo isolado (esquemas.ts explica por que é
// uma ação separada de `definirPlanoDePagamento`). `exigirUsuario()` é a PRIMEIRA instrução do
// corpo.
export async function definirObservacoes(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaObservacoes.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, observacoes } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      await tx.update(orcamentos).set({ observacoes }).where(eq(orcamentos.id, orcamentoId));
    });

    return { ok: true, dados: { id: orcamentoId } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao gravar observações do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  fichasPrecificacao,
  itensCatalogo,
  orcamentoFotos,
  orcamentoLinhas,
  orcamentoProjeto,
  orcamentoRevisoes,
  orcamentos,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { somarDias } from "@/lib/financeiro/calendario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";
import { caminhoDaFoto, diretorioDeFotos } from "@/lib/orcamentos/caminho-fotos";
import { tratarFotoDeOrcamento, validarTipoRealDaFoto } from "@/lib/orcamentos/fotos";
import { arredondarBonito, calcularPeca } from "@/lib/precificacao/calculo";
import { parametrosVigentes } from "@/lib/precificacao/consultas";
import { quantasCabem } from "@/lib/precificacao/forno";

import {
  esquemaAcrescentarLinha,
  esquemaAnexarFoto,
  esquemaAtualizacaoDePrecos,
  esquemaCabecalhoDoOrcamento,
  esquemaCustoDeProjeto,
  esquemaDuplicarOrcamento,
  esquemaLegendaDaFoto,
  esquemaLinhaDeOrcamento,
  esquemaMarcarComoEnviado,
  esquemaNovoOrcamento,
  esquemaObservacoes,
  esquemaPlanoDePagamento,
  esquemaRecusarOrcamento,
  esquemaRemoverCustoDeProjeto,
  esquemaRemoverFoto,
  esquemaRemoverLinha,
  esquemaVoltarParaRascunho,
} from "./esquemas";
import { proximoSequencialDeOrcamento, type TransacaoDoBanco } from "./numero";
import { montarSnapshot, type LinhaParaMontarSnapshot } from "./snapshot";
import {
  FRASE_CUSTO_DE_PROJETO_NAO_EXISTE_MAIS,
  FRASE_FALHA_AO_CRIAR,
  FRASE_FALHA_AO_ENVIAR_FOTO,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FALTA_CLIENTE_E_PECA,
  FRASE_FICHA_NAO_ENCONTRADA_PARA_LINHA,
  FRASE_FOTO_NAO_EXISTE_MAIS,
  FRASE_LIMITE_DE_FOTOS,
  FRASE_LINHA_NAO_EXISTE_MAIS,
  FRASE_LISTA_DE_PRECOS_DIVERGENTE,
  FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR,
  FRASE_ORCAMENTO_JA_E_RASCUNHO,
  FRASE_ORCAMENTO_NAO_E_RASCUNHO,
  FRASE_ORCAMENTO_NAO_ENVIADO_PARA_RECUSAR,
  FRASE_ORCAMENTO_NAO_EXISTE_MAIS,
  FRASE_PARAMETROS_INDISPONIVEIS_PARA_CONGELAR,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts` — cada módulo redeclara, não há tipo compartilhado
// entre módulos (D-15 do projeto).
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

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

  const resultado = esquemaNovoOrcamento.safeParse(entradaBruta ?? {});
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

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
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
    }
    throw erro;
  }
}

// ---------------------------------------------------------------------------------------------
// Editar o orçamento (04.5-06-PLAN.md, Tarefa 2) — a guarda de rascunho
// ---------------------------------------------------------------------------------------------

class OrcamentoNaoEncontrado extends Error {}
class OrcamentoNaoEhRascunho extends Error {}
class LinhaNaoEncontrada extends Error {}
class FichaNaoEncontradaParaLinha extends Error {}
class CustoDeProjetoNaoEncontrado extends Error {}
// Fotos de referência (04.5-10-PLAN.md, Tarefa 3).
class FotoNaoEncontrada extends Error {}
class LimiteDeFotosAtingido extends Error {}

// As quatro transições do ciclo de vida (04.5-08-PLAN.md, Tarefa 2) — erros próprios, para nunca
// confundir "não é rascunho" (as ações de EDIÇÃO acima) com "esta transição específica não é
// permitida a partir do status atual" (mensagens diferentes por transição, ver `textos.ts`).
class TransicaoDeStatusInvalida extends Error {
  constructor(public mensagem: string) {
    super(mensagem);
  }
}
class FaltaClienteOuPeca extends Error {}
class ParametrosIndisponiveis extends Error {}
// "Atualizar preços" (04.5-09-PLAN.md, Tarefa 2): a lista de preços enviada não cobre exatamente
// as linhas do orçamento — sinal de tela desatualizada, nunca uma trava de negócio.
class ListaDePrecosDivergente extends Error {}

type StatusOrcamento = (typeof orcamentos.status.enumValues)[number];

// Regra comum às três transições guardadas (marcarComoEnviado/recusarOrcamento/
// voltarParaRascunho — `duplicarOrcamento` aceita qualquer status, nunca chama isto): recusa com
// frase em português quando o status atual não está entre os permitidos, e a frase do caso
// "aprovado" SEMPRE diz que refazer é Duplicar, não importa qual transição foi tentada (D-07).
function garantirTransicaoValida(
  statusAtual: StatusOrcamento,
  permitido: StatusOrcamento[],
  mensagemGenerica: string,
): void {
  if (permitido.includes(statusAtual)) {
    return;
  }
  if (statusAtual === "aprovado") {
    throw new TransicaoDeStatusInvalida(FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR);
  }
  throw new TransicaoDeStatusInvalida(mensagemGenerica);
}

// Regra comum às quatro ações de edição (Tarefa 2): trava o orçamento (`select ... for update`) e
// recusa quando o status não é rascunho — a linha travada é a garantia real (T-04.5-28), o
// invariante de banco `(status='rascunho') = (snapshot is null)` (plano 01) é a rede, não a
// porta. Escrita UMA VEZ, chamada pelas quatro ações abaixo, sempre como a primeira coisa que
// cada uma faz dentro da própria transação.
async function travarOrcamentoRascunho(tx: TransacaoDoBanco, orcamentoId: string): Promise<void> {
  const [linha] = await tx
    .select({ status: orcamentos.status })
    .from(orcamentos)
    .where(eq(orcamentos.id, orcamentoId))
    .for("update"); // trava a linha do orçamento inteira a transação — nenhuma edição concorrente decide o status por fora (for update)

  if (!linha) {
    throw new OrcamentoNaoEncontrado();
  }
  if (linha.status !== "rascunho") {
    throw new OrcamentoNaoEhRascunho();
  }
}

function primeiroErroConhecido(erro: unknown): string | null {
  if (erro instanceof OrcamentoNaoEncontrado) return FRASE_ORCAMENTO_NAO_EXISTE_MAIS;
  if (erro instanceof OrcamentoNaoEhRascunho) return FRASE_ORCAMENTO_NAO_E_RASCUNHO;
  if (erro instanceof LinhaNaoEncontrada) return FRASE_LINHA_NAO_EXISTE_MAIS;
  if (erro instanceof FichaNaoEncontradaParaLinha) return FRASE_FICHA_NAO_ENCONTRADA_PARA_LINHA;
  if (erro instanceof CustoDeProjetoNaoEncontrado) return FRASE_CUSTO_DE_PROJETO_NAO_EXISTE_MAIS;
  if (erro instanceof TransicaoDeStatusInvalida) return erro.mensagem;
  if (erro instanceof FaltaClienteOuPeca) return FRASE_FALTA_CLIENTE_E_PECA;
  if (erro instanceof ParametrosIndisponiveis) return FRASE_PARAMETROS_INDISPONIVEIS_PARA_CONGELAR;
  if (erro instanceof ListaDePrecosDivergente) return FRASE_LISTA_DE_PRECOS_DIVERGENTE;
  if (erro instanceof FotoNaoEncontrada) return FRASE_FOTO_NAO_EXISTE_MAIS;
  if (erro instanceof LimiteDeFotosAtingido) return FRASE_LIMITE_DE_FOTOS;
  return null;
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

// ---------------------------------------------------------------------------------------------
// O ciclo de vida do orçamento (04.5-08-PLAN.md, Tarefa 2) — congelar, recusar, reabrir, duplicar
// ---------------------------------------------------------------------------------------------

// "Marcar como enviado" (D-21) — a promessa central da fase: grava, na MESMA instrução, `status`,
// `snapshot`, `congeladoEm` e `data`, para o invariante de banco `(status='rascunho') = (snapshot
// is null)` nunca ficar violado no meio. `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function marcarComoEnviado(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaMarcarComoEnviado.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({ status: orcamentos.status, clienteNome: orcamentos.clienteNome })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["rascunho"], FRASE_ORCAMENTO_NAO_E_RASCUNHO);

      const linhas = await tx
        .select({
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
          fichaNome: fichasPrecificacao.nome,
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
        .from(orcamentoLinhas)
        .innerJoin(fichasPrecificacao, eq(orcamentoLinhas.fichaId, fichasPrecificacao.id))
        .where(eq(orcamentoLinhas.orcamentoId, id));

      if (!orcamento.clienteNome?.trim() || linhas.length === 0) {
        throw new FaltaClienteOuPeca();
      }

      const parametros = await parametrosVigentes(hoje);
      if (!parametros.ok) {
        throw new ParametrosIndisponiveis();
      }

      // Cada linha, calculada com os parâmetros de HOJE (canal "direto" — a mesma leitura que o
      // rascunho já mostrava um instante antes de enviar) — uma peça que não calcula (D-11/D-12)
      // entra com zero em todos os campos de dinheiro/forno, nunca interrompe o congelamento
      // inteiro (a mesma tolerância que o rascunho já tinha para essa peça).
      const linhasParaSnapshot: LinhaParaMontarSnapshot[] = linhas.map((linha) => {
        const cabem = quantasCabem(
          { larguraMm: linha.larguraMm, profundidadeMm: linha.profundidadeMm, alturaMm: linha.alturaMm },
          parametros.forno,
          { biscoito: linha.cabemBiscoitoInformado, esmalte: linha.cabemEsmalteInformado },
        );
        const resultadoDaLinha = calcularPeca({
          ficha: {
            argilaMiligramas: linha.argilaMiligramas,
            esmalteMiligramas: linha.esmalteMiligramas,
            horasMilesimos: linha.horasMilesimos,
            embalagemCentavos: linha.embalagemCentavos,
          },
          cabem,
          parametros: parametros.calculo,
          taxaCartaoPontosBase: parametros.taxaCartaoPontosBase,
          canal: "direto",
        });

        return {
          nome: linha.fichaNome,
          custoCentavos: resultadoDaLinha.ok ? resultadoDaLinha.custoCentavos : 0,
          minimoCentavos: resultadoDaLinha.ok ? resultadoDaLinha.minimoCentavos : 0,
          zeroCentavos: resultadoDaLinha.ok ? resultadoDaLinha.zeroCentavos : 0,
          horasMilesimos: linha.horasMilesimos,
          quantasCabemBiscoito: resultadoDaLinha.ok ? cabem.biscoito : 0,
          quantasCabemEsmalte: resultadoDaLinha.ok ? cabem.esmalte : 0,
        };
      });

      const snapshot = montarSnapshot({
        linhas: linhasParaSnapshot,
        impostoETaxaPontosBase: parametros.calculo.impostoPontosBase + parametros.taxaCartaoPontosBase,
        parametrosEstimados: Object.values(parametros.porChave).filter((p) => !p.medido).length,
        congeladoEm: new Date().toISOString(),
      });

      await tx
        .update(orcamentos)
        .set({ status: "enviado", snapshot, congeladoEm: new Date(), data: hoje })
        .where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao marcar orçamento como enviado:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Recusou" — marca como recusado SEM tocar em snapshot/congeladoEm (o número, a revisão e o
// congelamento ficam, D-06). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function recusarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaRecusarOrcamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({ status: orcamentos.status })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["enviado"], FRASE_ORCAMENTO_NAO_ENVIADO_PARA_RECUSAR);

      await tx.update(orcamentos).set({ status: "recusado" }).where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao recusar orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Voltar para rascunho" — descongela: `status`, `snapshot` e `congeladoEm` gravam juntos na
// MESMA instrução (o invariante de banco nunca fica violado no meio). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function voltarParaRascunho(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaVoltarParaRascunho.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({ status: orcamentos.status })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(orcamento.status, ["enviado", "recusado"], FRASE_ORCAMENTO_JA_E_RASCUNHO);

      await tx
        .update(orcamentos)
        .set({ status: "rascunho", snapshot: null, congeladoEm: null })
        .where(eq(orcamentos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao voltar orçamento para rascunho:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Duplicar" (D-07) — aceita QUALQUER status (a única das quatro sem `garantirTransicaoValida`):
// pede um sequencial NOVO ao contador (D-06, dentro da mesma transação que copia tudo) e cria um
// rascunho com as mesmas peças, quantidades, preços, cor, personalização, custos de projeto e
// frete — sem snapshot, sem revisão herdada, sem vínculo de venda/encomenda e sem fotos (a coluna
// nasce com o padrão da tabela em todos os quatro casos, nunca copiada). `exigirUsuario()` é a
// PRIMEIRA instrução do corpo.
export async function duplicarOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ano: number; sequencial: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDuplicarOrcamento.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { id } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    const { novoId, ano, sequencial } = await db.transaction(async (tx) => {
      const [original] = await tx
        .select({
          clienteNome: orcamentos.clienteNome,
          titulo: orcamentos.titulo,
          entregaPrevista: orcamentos.entregaPrevista,
          validadeDias: orcamentos.validadeDias,
          plano: orcamentos.plano,
          sinalPercentual: orcamentos.sinalPercentual,
          freteCentavos: orcamentos.freteCentavos,
          observacoes: orcamentos.observacoes,
        })
        .from(orcamentos)
        .where(eq(orcamentos.id, id))
        .for("update"); // trava o original enquanto lê — nenhuma edição concorrente decide o que foi copiado (for update)

      if (!original) {
        throw new OrcamentoNaoEncontrado();
      }

      const linhasOriginais = await tx
        .select({
          fichaId: orcamentoLinhas.fichaId,
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
          cor: orcamentoLinhas.cor,
          personalizacao: orcamentoLinhas.personalizacao,
          ordem: orcamentoLinhas.ordem,
        })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, id))
        .orderBy(asc(orcamentoLinhas.ordem));

      const custosOriginais = await tx
        .select({
          descricao: orcamentoProjeto.descricao,
          valorCentavos: orcamentoProjeto.valorCentavos,
          ordem: orcamentoProjeto.ordem,
        })
        .from(orcamentoProjeto)
        .where(eq(orcamentoProjeto.orcamentoId, id))
        .orderBy(asc(orcamentoProjeto.ordem));

      const anoNovo = Number(hoje.slice(0, 4));
      const sequencialNovo = await proximoSequencialDeOrcamento(tx, anoNovo);

      const [novo] = await tx
        .insert(orcamentos)
        .values({
          ano: anoNovo,
          sequencial: sequencialNovo,
          status: "rascunho",
          clienteNome: original.clienteNome,
          titulo: original.titulo,
          data: hoje,
          validadeDias: original.validadeDias,
          entregaPrevista: original.entregaPrevista,
          plano: original.plano,
          sinalPercentual: original.sinalPercentual,
          freteCentavos: original.freteCentavos,
          observacoes: original.observacoes,
          criadoPor: usuario.id,
        })
        .returning({ id: orcamentos.id });

      if (linhasOriginais.length > 0) {
        await tx.insert(orcamentoLinhas).values(
          linhasOriginais.map((linha) => ({
            orcamentoId: novo.id,
            fichaId: linha.fichaId,
            quantidade: linha.quantidade,
            precoUnitarioCentavos: linha.precoUnitarioCentavos,
            cor: linha.cor,
            personalizacao: linha.personalizacao,
            ordem: linha.ordem,
          })),
        );
      }

      if (custosOriginais.length > 0) {
        await tx.insert(orcamentoProjeto).values(
          custosOriginais.map((custo) => ({
            orcamentoId: novo.id,
            descricao: custo.descricao,
            valorCentavos: custo.valorCentavos,
            ordem: custo.ordem,
          })),
        );
      }

      return { novoId: novo.id, ano: anoNovo, sequencial: sequencialNovo };
    });

    return { ok: true, dados: { id: novoId, ano, sequencial } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
    }
    console.error("Falha ao duplicar orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
  }
}

// ---------------------------------------------------------------------------------------------
// "Atualizar preços" (04.5-09-PLAN.md, Tarefa 2) — compara o mínimo CONGELADO com o de HOJE e
// guarda a revisão anterior antes de reabrir (D-23)
// ---------------------------------------------------------------------------------------------

// O "total de então" que a revisão guarda é peças + projeto + frete — a MESMA fórmula de
// `lib/orcamentos/contas.ts::contasDoOrcamento`, só que somada direto no banco (aqui só o número
// final interessa, não o resultado por peça que aquele módulo também devolve). Separada de
// `atualizarPrecos` de propósito: é a ÚNICA parte desta ação que lê o que um custo de projeto e o
// frete valem agora, para gravar um total histórico — nunca os altera (a ação em si nunca toca em
// nenhum dos dois, T-04.5-42/T-04.5-44).
async function somaDoQueNaoEhPeca(tx: TransacaoDoBanco, orcamentoId: string): Promise<number> {
  const custos = await tx
    .select({ valor: orcamentoProjeto.valorCentavos })
    .from(orcamentoProjeto)
    .where(eq(orcamentoProjeto.orcamentoId, orcamentoId));
  const somaDosCustos = custos.reduce((soma, custo) => soma + custo.valor, 0);

  const [cabecalho] = await tx
    .select({ valor: orcamentos.freteCentavos })
    .from(orcamentos)
    .where(eq(orcamentos.id, orcamentoId));

  return somaDosCustos + (cabecalho?.valor ?? 0);
}

// "Atualizar preços" — dois caminhos, na MESMA transação, com a linha do orçamento e as linhas de
// peça travadas antes de decidir:
// - CONGELADO (enviado ou recusado — "expirado" é só "enviado" com validade vencida, D-22): (1)
//   guarda a revisão ATUAL em `orcamento_revisoes` (revisão, `enviado_em` = `congelado_em` de
//   então, total de então, snapshot de então) ANTES de tocar em qualquer outra coisa — a ordem
//   importa (T-04.5-43): se algo falhar depois, a transação inteira desfaz, e a revisão nunca
//   chega a existir pela metade; (2) grava os preços novos nas linhas; (3) sobe `revisao` em 1;
//   (4) volta a rascunho com `snapshot`/`congeladoEm` zerados e a data de hoje — a validade
//   renova a partir dela.
// - RASCUNHO: só grava os preços novos. Nenhuma revisão, nenhuma mudança de status ou de data.
// Em nenhum dos dois esta ação toca custos de projeto, frete ou o número do orçamento, e ela
// nunca chama o contador de sequencial (D-06). Aprovado é recusado com a frase que manda usar
// Duplicar (D-07), a mesma guarda comum das demais transições. `exigirUsuario()` é a PRIMEIRA
// instrução do corpo.
export async function atualizarPrecos(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDePrecos.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, linhas } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    await db.transaction(async (tx) => {
      const [orcamento] = await tx
        .select({
          status: orcamentos.status,
          revisao: orcamentos.revisao,
          congeladoEm: orcamentos.congeladoEm,
          snapshot: orcamentos.snapshot,
        })
        .from(orcamentos)
        .where(eq(orcamentos.id, orcamentoId))
        .for("update"); // trava a linha do orçamento inteira a transação (for update)

      if (!orcamento) {
        throw new OrcamentoNaoEncontrado();
      }
      garantirTransicaoValida(
        orcamento.status,
        ["rascunho", "enviado", "recusado"],
        FRASE_ORCAMENTO_APROVADO_USE_DUPLICAR,
      );

      const linhasDoOrcamento = await tx
        .select({
          id: orcamentoLinhas.id,
          quantidade: orcamentoLinhas.quantidade,
          precoUnitarioCentavos: orcamentoLinhas.precoUnitarioCentavos,
        })
        .from(orcamentoLinhas)
        .where(eq(orcamentoLinhas.orcamentoId, orcamentoId))
        .for("update"); // trava as linhas do orçamento antes de gravar os preços novos (for update)

      // A lista enviada precisa cobrir EXATAMENTE as linhas do orçamento — nem mais, nem menos
      // (T-04.5-42): divergir é sinal de que a tela ficou desatualizada, nunca um preço para uma
      // linha de outro orçamento.
      const idsDoOrcamento = new Set(linhasDoOrcamento.map((linha) => linha.id));
      const idsEnviados = new Set(linhas.map((linha) => linha.linhaId));
      const listaBate =
        idsDoOrcamento.size === idsEnviados.size &&
        [...idsDoOrcamento].every((id) => idsEnviados.has(id));
      if (!listaBate) {
        throw new ListaDePrecosDivergente();
      }

      if (orcamento.status !== "rascunho") {
        const pecasCentavos = linhasDoOrcamento.reduce(
          (soma, linha) => soma + linha.quantidade * linha.precoUnitarioCentavos,
          0,
        );
        const totalDeEntao = pecasCentavos + (await somaDoQueNaoEhPeca(tx, orcamentoId));

        await tx.insert(orcamentoRevisoes).values({
          orcamentoId,
          revisao: orcamento.revisao,
          enviadoEm: orcamento.congeladoEm,
          totalCentavos: totalDeEntao,
          snapshot: orcamento.snapshot,
        });
      }

      for (const linha of linhas) {
        await tx
          .update(orcamentoLinhas)
          .set({ precoUnitarioCentavos: linha.precoCentavos })
          .where(and(eq(orcamentoLinhas.id, linha.linhaId), eq(orcamentoLinhas.orcamentoId, orcamentoId)));
      }

      if (orcamento.status !== "rascunho") {
        await tx
          .update(orcamentos)
          .set({
            revisao: orcamento.revisao + 1,
            status: "rascunho",
            snapshot: null,
            congeladoEm: null,
            data: hoje,
          })
          .where(eq(orcamentos.id, orcamentoId));
      }
    });

    return { ok: true, dados: { id: orcamentoId } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao atualizar preços do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// ---------------------------------------------------------------------------------------------
// Fotos de referência (04.5-10-PLAN.md, Tarefa 3) — a primeira vez que o projeto guarda um
// arquivo enviado por alguém. `exigirUsuario()` é a PRIMEIRA instrução de cada uma das três.
// ---------------------------------------------------------------------------------------------

export type FotoAnexada = { id: string; legenda: string | null };

// "+ Foto de referência": recebe `FormData` (nunca JSON — é um arquivo), nesta ordem exata
// (T-04.5-46/49/53):
//   1. valida o tipo REAL e o tamanho, ANTES de qualquer processamento e ANTES de tocar disco;
//   2. trata a foto (reduz, converte, limpa) — fora da transação: processamento de imagem não
//      deve segurar a trava de linha do banco por mais tempo que o necessário;
//   3. dentro de `db.transaction`: trava o orçamento, confere que é rascunho, conta as fotos e
//      recusa a quarta, calcula a ordem livre, gera o nome do arquivo e insere a linha;
//   4. só DEPOIS de a linha existir, grava o arquivo em disco — AINDA DENTRO da transação: se a
//      escrita falhar, o `throw` propaga e o Postgres desfaz a linha junto ("a transação é
//      revertida" é literal aqui, não um `catch` manual). O inverso (gravar o arquivo primeiro)
//      deixaria um arquivo órfão no disco toda vez que a transação revertesse por outro motivo
//      (ex.: o orçamento deixou de ser rascunho entre a trava e aqui).
export async function anexarFotoDeOrcamento(formData: FormData): Promise<ResultadoDeAcao<FotoAnexada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaAnexarFoto.safeParse({ orcamentoId: formData.get("orcamentoId") });
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId } = resultado.data;

  const arquivoEnviado = formData.get("arquivo");
  if (!(arquivoEnviado instanceof File)) {
    return { ok: false, erro: FRASE_FALHA_AO_ENVIAR_FOTO };
  }

  const bytesRecebidos = Buffer.from(await arquivoEnviado.arrayBuffer());

  // 1. Tipo real e tamanho — antes de qualquer processamento e antes de tocar disco.
  const validacao = await validarTipoRealDaFoto(bytesRecebidos);
  if (!validacao.ok) {
    return { ok: false, erro: validacao.erro };
  }

  // 2. Reduz, converte, limpa — o BUFFER ORIGINAL nunca é gravado em lugar nenhum; só o
  // resultado deste tratamento chega ao disco (D-26).
  let tratada;
  try {
    tratada = await tratarFotoDeOrcamento(bytesRecebidos);
  } catch (erro) {
    console.error("Falha ao processar foto de orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_ENVIAR_FOTO };
  }

  try {
    const idDaFoto = await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const fotosExistentes = await tx
        .select({ ordem: orcamentoFotos.ordem })
        .from(orcamentoFotos)
        .where(eq(orcamentoFotos.orcamentoId, orcamentoId))
        .for("update"); // trava as fotos do orçamento antes de contar e calcular a ordem (for update)

      if (fotosExistentes.length >= 3) {
        throw new LimiteDeFotosAtingido();
      }
      const proximaOrdem = fotosExistentes.reduce((maior, f) => Math.max(maior, f.ordem), -1) + 1;

      // Nome gerado pelo SERVIDOR — nunca o nome que veio do celular (acento, espaço, caminho
      // embutido). `caminhoDaFoto()` (plano 03) recusaria qualquer formato diferente deste.
      const arquivoGerado = `${randomUUID()}.jpg`;

      const [foto] = await tx
        .insert(orcamentoFotos)
        .values({
          orcamentoId,
          ordem: proximaOrdem,
          arquivo: arquivoGerado,
          legenda: null,
          bytes: tratada.bytes,
          larguraPx: tratada.larguraPx,
          alturaPx: tratada.alturaPx,
          anexadoPor: usuario.id,
        })
        .returning({ id: orcamentoFotos.id });

      // 4. Só DEPOIS de a linha existir: grava o arquivo, ainda dentro da transação (ver
      // comentário no topo desta função para o motivo da ordem).
      await fs.mkdir(diretorioDeFotos(), { recursive: true });
      await fs.writeFile(caminhoDaFoto(arquivoGerado), tratada.buffer);

      return foto.id;
    });

    return { ok: true, dados: { id: idDaFoto, legenda: null } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao anexar foto ao orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_ENVIAR_FOTO };
  }
}

// A legenda de uma foto já existente — só a legenda, com a mesma guarda de rascunho das demais
// edições. `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function definirLegendaDaFoto(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaLegendaDaFoto.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, id, legenda } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const [foto] = await tx
        .select({ id: orcamentoFotos.id })
        .from(orcamentoFotos)
        .where(and(eq(orcamentoFotos.id, id), eq(orcamentoFotos.orcamentoId, orcamentoId)))
        .for("update"); // trava a própria foto antes de gravar (for update)

      if (!foto) {
        throw new FotoNaoEncontrada();
      }

      await tx
        .update(orcamentoFotos)
        .set({ legenda, atualizadoEm: new Date() })
        .where(eq(orcamentoFotos.id, id));
    });

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao definir legenda da foto:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "tirar": reordena as fotos seguintes DENTRO da mesma transação (mesma disciplina de
// `removerLinha`), e só DEPOIS de a linha sumir do banco apaga o arquivo do disco — ordem
// INVERSA de `anexarFotoDeOrcamento` (T-04.5-53): a referência no banco é o que importa para o
// dono, então ela sai primeiro; um arquivo já ausente (ex.: remoção repetida por duas abas)
// nunca pode impedir a remoção da referência, que já aconteceu. `exigirUsuario()` é a PRIMEIRA
// instrução do corpo.
export async function removerFotoDeOrcamento(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaRemoverFoto.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { orcamentoId, id } = resultado.data;

  try {
    const arquivoParaApagar = await db.transaction(async (tx) => {
      await travarOrcamentoRascunho(tx, orcamentoId);

      const fotosDoOrcamento = await tx
        .select({ id: orcamentoFotos.id, ordem: orcamentoFotos.ordem, arquivo: orcamentoFotos.arquivo })
        .from(orcamentoFotos)
        .where(eq(orcamentoFotos.orcamentoId, orcamentoId))
        .orderBy(asc(orcamentoFotos.ordem))
        .for("update"); // trava todas as fotos do orçamento antes de apagar e reordenar (for update)

      const alvo = fotosDoOrcamento.find((foto) => foto.id === id);
      if (!alvo) {
        throw new FotoNaoEncontrada();
      }

      await tx.delete(orcamentoFotos).where(eq(orcamentoFotos.id, id));

      const seguintes = fotosDoOrcamento.filter((foto) => foto.ordem > alvo.ordem);
      for (const foto of seguintes) {
        await tx
          .update(orcamentoFotos)
          .set({ ordem: foto.ordem - 1 })
          .where(eq(orcamentoFotos.id, foto.id));
      }

      return alvo.arquivo;
    });

    // Arquivo apagado FORA da transação, só depois do commit da linha — "arquivo não existe"
    // (ENOENT) é ignorado de propósito (comentário acima explica o motivo).
    try {
      await fs.unlink(caminhoDaFoto(arquivoParaApagar));
    } catch (erroDeDisco) {
      if ((erroDeDisco as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Falha ao apagar arquivo de foto do disco:", erroDeDisco);
      }
    }

    return { ok: true, dados: { id } };
  } catch (erro) {
    const mensagemConhecida = primeiroErroConhecido(erro);
    if (mensagemConhecida) {
      return { ok: false, erro: mensagemConhecida };
    }
    console.error("Falha ao remover foto do orçamento:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

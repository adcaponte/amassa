"use server";

// Ações da Agenda — a COBRANÇA: receber agora, mensalidades em lote e dispensa (D-24/P10, plano
// 06.5-27 — saíram de `acoes.ts`, que agora é o índice).

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { obterConfiguracaoFinanceira } from "@/lib/financeiro/consultas";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { gravarVenda } from "@/lib/financeiro/gravacao";
import { conferirParcelas } from "@/lib/financeiro/parcelas";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { itensDoSistemaParaVenda, obterItensDoSistema } from "./consultas";
import {
  esquemaDefinirDispensa,
  esquemaLoteDeMensalidades,
  esquemaReceberAgora,
  type FormaDeReceber,
} from "./esquemas";
import {
  gravarDispensa,
  RecusaDaAgenda,
  travarCobranca,
  travarMensalidades,
  vincularVenda,
} from "./gravacao";
import { linhasDaVenda, podeDispensar, situacaoDaCobranca } from "./receber";
import {
  FRASE_DATA_CANCELADA,
  FRASE_COBRANCA_DISPENSADA,
  FRASE_COBRANCA_SUMIU,
  FRASE_USO_LIVRE_SEM_VENDA_CANCELADA,
  FRASE_FALHA_AO_LANCAR_LOTE,
  FRASE_FALHA_AO_RECEBER,
  FRASE_FALHA_AO_DISPENSAR,
  fraseJaLancado,
} from "./textos";

import {
  errosPorCampo,
  primeiraMensagemDeErro,
  type ResultadoDeAcao,
  type ResultadoDoLancamento,
} from "./acoes-comum";
import { revalidarTelasDaAgenda } from "./acoes-servidor";

// ── “Recebi agora” (plano 11 — AGE-15, D-01, D-04, D-14, UI-D4) ─────────────────────────────────────────

export type RecebidoAgora = { documentoId: string; numero: number; forma: FormaDeReceber };

// “Recebi agora”: a cobrança vira a Venda JÁ PAGA hoje, na forma tocada, e entra no Caixa do dia. A Agenda
// não guarda dinheiro (§5): a venda é do Financeiro, gravada pelo MESMO escritor da Venda manual
// (`gravarVenda`, `lib/financeiro/gravacao.ts`); a Agenda grava só o vínculo `documento_id`.
// `exigirUsuario()` é a PRIMEIRA instrução (T-05-51). Do navegador chegam só o tipo e o id da cobrança e
// a forma (T-05-53) — linhas, valor, descrição, categoria e cliente vêm do banco, sob a trava. A taxa e
// os itens do sistema são lidos FORA da transação (como `lancarVenda`). Na transação, a ordem é COBRANÇA
// (`for no key update`) → documento NOVO → ITENS (dentro de `gravarVenda`, só se houver linha com estoque
// — nenhuma das três da Agenda tem): livre = sem venda ou com venda cancelada (D-08), e não dispensada;
// senão a frase da corrida (Pitfall 8, T-05-54). O vínculo é gravado na MESMA transação da venda.
export async function receberAgora(entradaBruta: unknown): Promise<ResultadoDeAcao<RecebidoAgora>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaReceberAgora.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let venda: { id: string; numero: number };
  try {
    const [configuracao, itens] = await Promise.all([obterConfiguracaoFinanceira(), obterItensDoSistema()]);
    const itensParaVenda = itensDoSistemaParaVenda(itens);

    venda = await db.transaction(async (tx) => {
      const cobranca = await travarCobranca(tx, dados.cobranca);
      if (!cobranca) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }
      const situacao = situacaoDaCobranca(cobranca);
      // CR-01: venda ativa recusa SEMPRE (a situação vem da linha travada); o número só escolhe a frase.
      if (situacao === "lancado" || situacao === "pago") {
        throw new RecusaDaAgenda(
          cobranca.numeroDaVenda !== null ? fraseJaLancado(cobranca.numeroDaVenda) : FRASE_COBRANCA_SUMIU,
        );
      }
      if (situacao === "dispensada") {
        throw new RecusaDaAgenda(FRASE_COBRANCA_DISPENSADA);
      }
      if (cobranca.tipo === "inscricao" && cobranca.dataCancelada) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      // Cobrança de R$ 0 nunca aparece em “A receber” e nunca vira venda (AGE-15 · boundary).
      if (cobranca.valorCentavos <= 0) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }

      // As linhas do BANCO (D-04/D-14): o item do sistema com a descrição da cobrança e, no uso livre, o
      // material cobrado como linha LIVRE na categoria do “Uso livre (hora)” (Pitfall 3).
      const linhas = linhasDaVenda(cobranca, itensParaVenda);
      const totalCentavos = linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
      const parcela = { vencimento: hoje, valorCentavos: totalCentavos, forma: dados.forma, pago: true };
      // A mesma conferência da Venda manual (soma, data do saldo inicial) — com a frase dela.
      const conferencia = conferirParcelas({
        totalCentavos,
        parcelas: [parcela],
        hoje,
        dataSaldoInicial: configuracao.dataSaldoInicial,
      });
      if (!conferencia.ok) {
        throw new RecusaDaAgenda(conferencia.erro);
      }

      // D-01: `pessoa_nome` = o nome do cliente congelado agora, e o vínculo `cliente_id`. A taxa do
      // cartão é congelada por `gravarVenda` na parcela paga no cartão — a regra que o Financeiro já aplica.
      const gravada = await gravarVenda(
        tx,
        { data: hoje, pessoaNome: cobranca.nome, clienteId: cobranca.clienteId, linhas, parcelas: [parcela] },
        { registradoPor: usuario.id, taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase },
      );
      await vincularVenda(tx, dados.cobranca, gravada.id);
      return gravada;
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao registrar o “Recebi agora” (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_RECEBER };
  }

  revalidarTelasDaAgenda({ publico: false });
  revalidatePath(rotaDeGestao("/financeiro"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: { documentoId: venda.id, numero: venda.numero, forma: dados.forma } };
}

// ── O lote de mensalidades (plano 12 — AGE-16, Assumption A6, D-08, D-09) ───────────────────────────────

export type LoteLancado = { lancadas: number; jaLancadas: number };

// “Lançar estas {N} na Venda”: UMA venda POR MENSALIDADE (aluno em duas turmas = duas vendas, cada uma
// no dia da sua turma), cada uma com UMA parcela EM ABERTO vencendo no vencimento da mensalidade — o lote
// nunca cria venda paga nem marca recebimento (§5: “pago” só existe quando o Caixa marca “Recebi”). O
// \`pix\` é só o valor INICIAL da parcela em aberto, como na aprovação do orçamento: o Caixa troca a forma
// quando o dinheiro cai. Molde de \`gerarContasDoMes\`: \`exigirUsuario()\` é a PRIMEIRA instrução
// (T-05-57); do navegador chegam só os ids (Zod, até 500 — T-05-61); hoje, a taxa e os itens do sistema
// são lidos FORA da transação; numa transação só, as mensalidades pedidas são travadas em ordem de id
// (\`for no key update\` — dois lotes ao mesmo tempo nunca se travam em ordem inversa), as que já viraram
// venda ativa ou foram dispensadas são PULADAS e CONTADAS (a corrida com outro celular, com o “Recebi
// agora” ou com o “Lançar na Venda” — T-05-59), e para cada livre \`gravarVenda\` + o vínculo. Id que não é
// de mensalidade não é lido (T-05-60). Qualquer recusa ou falha desfaz TUDO: nada fica pela metade.
export async function lancarMensalidadesEmLote(entradaBruta: unknown): Promise<ResultadoDeAcao<LoteLancado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaLoteDeMensalidades.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const ids = [...new Set(resultado.data.ids)].sort();
  const hoje = hojeEmBrasilia(new Date());

  let lote: LoteLancado;
  try {
    const [configuracao, itens] = await Promise.all([obterConfiguracaoFinanceira(), obterItensDoSistema()]);
    const itensParaVenda = itensDoSistemaParaVenda(itens);

    lote = await db.transaction(async (tx) => {
      const travadas = await travarMensalidades(tx, ids);
      let lancadas = 0;
      let jaLancadas = 0;
      for (const mensalidade of travadas) {
        if (mensalidade.tipo !== "mensalidade") {
          continue;
        }
        const situacao = situacaoDaCobranca(mensalidade);
        if (situacao !== "a_receber" && situacao !== "venda_cancelada") {
          jaLancadas += 1;
          continue;
        }
        if (mensalidade.valorCentavos <= 0) {
          continue;
        }

        // D-04: uma linha do item “Mensalidade”, com a descrição da cobrança e o valor da mensalidade.
        const linhas = linhasDaVenda(mensalidade, itensParaVenda);
        const totalCentavos = linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
        const parcela = {
          vencimento: mensalidade.vencimento,
          valorCentavos: totalCentavos,
          forma: "pix" as const,
          pago: false,
        };
        // A mesma conferência da Venda manual. Uma recusa para o lote INTEIRO, com a frase dela.
        const conferencia = conferirParcelas({
          totalCentavos,
          parcelas: [parcela],
          hoje,
          dataSaldoInicial: configuracao.dataSaldoInicial,
        });
        if (!conferencia.ok) {
          throw new RecusaDaAgenda(conferencia.erro);
        }

        const gravada = await gravarVenda(
          tx,
          { data: hoje, pessoaNome: mensalidade.nome, clienteId: mensalidade.clienteId, linhas, parcelas: [parcela] },
          { registradoPor: usuario.id, taxaCartaoPontosBase: configuracao.taxaCartaoPontosBase },
        );
        await vincularVenda(tx, { tipo: "mensalidade", id: mensalidade.id }, gravada.id);
        lancadas += 1;
      }
      return { lancadas, jaLancadas };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao lançar o lote de mensalidades (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LANCAR_LOTE };
  }

  revalidarTelasDaAgenda({ publico: false });
  revalidatePath(rotaDeGestao("/financeiro"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: lote };
}

// ── Dispensar uma cobrança (plano 13 — D-09, UI-D15, T-05-62..65) ──────────────────────────────────────

export type DispensaDefinida = { dispensada: boolean };

// “Dispensar a cobrança” e o “Desfazer” (da sanfona “Dispensadas” e do toast): o ESTADO DESEJADO
// (`dispensada: true | false` — dois toques e dois celulares convergem; já no estado pedido = sucesso sem
// gravar). `exigirUsuario()` é a PRIMEIRA instrução (T-05-62). Sob a MESMA trava do “Recebi agora”, do
// “Lançar na Venda” e do lote (`travarCobranca`, `for no key update` na cobrança — T-05-63): dispensar e
// lançar ao mesmo tempo nunca terminam com uma cobrança dispensada E vendida. Mensalidade e inscrição
// LIVRES (a receber, ou com a venda cancelada no Caixa — D-08) se dispensam; o USO LIVRE só com a venda
// cancelada (decisão do dono no chat, 02/10/2026; 0027) — sem venda, a recusa diz o que fazer no lugar;
// com venda ATIVA, a recusa diz o número da venda. O “Desfazer” do uso livre limpa as três colunas e ele
// volta a “A receber” com a etiqueta da venda cancelada. Grava `dispensada_em`, `dispensada_por` (quem — T-05-64) e o motivo (Zod até
// 200 — T-05-65), ou os limpa ao desfazer. NUNCA apaga a linha (D-09): só `gravarDispensa`, um `update`.
export async function definirDispensa(entradaBruta: unknown): Promise<ResultadoDoLancamento<DispensaDefinida>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDefinirDispensa.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  const referencia = { tipo: dados.tipo, id: dados.id };

  try {
    await db.transaction(async (tx) => {
      const cobranca = await travarCobranca(tx, referencia);
      if (!cobranca) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }
      const situacao = situacaoDaCobranca(cobranca);

      if (!dados.dispensada) {
        // Desfazer: só a dispensada volta; o resto já está no estado pedido.
        if (situacao === "dispensada") {
          await gravarDispensa(tx, referencia, null);
        }
        return;
      }

      if (situacao === "dispensada") {
        return;
      }
      if (situacao === "lancado" || situacao === "pago") {
        throw new RecusaDaAgenda(
          cobranca.numeroDaVenda !== null ? fraseJaLancado(cobranca.numeroDaVenda) : FRASE_COBRANCA_SUMIU,
        );
      }
      if (cobranca.tipo === "inscricao" && cobranca.dataCancelada) {
        throw new RecusaDaAgenda(FRASE_DATA_CANCELADA);
      }
      // O uso livre sem venda não se dispensa: “Recebi agora” ou “Lançar na Venda” (decisão do dono no
      // chat, 02/10/2026). Só com a venda cancelada no Caixa — lida AQUI, sob a trava.
      if (cobranca.tipo === "uso_livre" && situacao === "a_receber") {
        throw new RecusaDaAgenda(FRASE_USO_LIVRE_SEM_VENDA_CANCELADA);
      }
      if (cobranca.valorCentavos <= 0 || !podeDispensar({ tipo: cobranca.tipo, situacao })) {
        throw new RecusaDaAgenda(FRASE_COBRANCA_SUMIU);
      }
      await gravarDispensa(tx, referencia, { em: new Date(), por: usuario.id, motivo: dados.motivo });
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao ${dados.dispensada ? "dispensar" : "desfazer a dispensa de"} uma cobrança (SQLSTATE: ${
        codigoDoErroPostgres(erro) ?? "desconhecido"
      }):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_DISPENSAR };
  }

  revalidarTelasDaAgenda({ publico: false });
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: { dispensada: dados.dispensada } };
}

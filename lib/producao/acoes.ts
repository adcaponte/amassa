"use server";

import { revalidatePath } from "next/cache";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  categorias,
  fichasPrecificacao,
  itensCatalogo,
  ordemEtapas,
  ordemPecas,
  ordensProducao,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import type { Unidade } from "@/lib/cadastros/catalogo";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { gravarMovimentacoes, travarItens } from "@/lib/estoque/gravacao";
import { pedidoDeEntradaDaProducao, pedidoDeSaidaManual } from "@/lib/estoque/pedidos";
import { FRASE_MATERIAL_NAO_EXISTE_MAIS } from "@/lib/estoque/textos";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import {
  CategoriaDeVendaInvalida,
  FichaNaoEncontrada,
  promoverFichaParaLinha,
} from "@/lib/precificacao/gravacao";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import {
  derivarPeca,
  destinoSugerido,
  distribuirExtras,
  resumoDaConclusao,
  type DestinoDasExtras,
} from "./conclusao";
import {
  dadosDaConclusao,
  lerPecasParaConcluir,
  listarCatalogoDaNovaOrdem,
  listarConcluidasECanceladas,
  type CatalogoDaNovaOrdem,
  type OrdemEncerrada,
} from "./consultas";
import { etapasIniciais, type EtapaProducao, type TipoOrdem } from "./etapas";
import {
  esquemaAjustarDiasPrevistos,
  esquemaCancelarOrdem,
  esquemaConcluirOrdem,
  esquemaDarBaixaNaOrdem,
  esquemaDefinirAMais,
  esquemaDesfazerEtapa,
  esquemaLiberarOrdem,
  esquemaRegistrarParcial,
  esquemaTerminarEtapa,
  validarNovaOrdem,
  type ErrosDaNovaOrdem,
  type NovaOrdemValidada,
} from "./esquemas";
import {
  lerEtapasDaOrdem,
  RecusaDaProducao,
  travarOrdem,
  type TransacaoDoBanco,
} from "./gravacao";
import {
  planejarAjusteDePrevisto,
  planejarCancelamento,
  planejarDesfazer,
  planejarLiberacao,
  planejarParcial,
  planejarTerminar,
  totalDeFeitas,
} from "./transicoes";
import {
  FRASE_A_MAIS_SO_ENCOMENDA,
  FRASE_CASA_PRECISA_DO_CATALOGO,
  FRASE_ENCOMENDA_SEM_ITEM,
  FRASE_ERRO_CARREGAR_CATALOGO,
  FRASE_FALHA_AO_CRIAR,
  FRASE_PECA_SAIU_DO_CATALOGO,
  FRASE_AJUSTE_NAO_FUTURA,
  FRASE_AJUSTE_NO_LIMITE,
  FRASE_FALHA_AO_AJUSTAR,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_DAR_BAIXA,
  FRASE_FALHA_AO_DESFAZER,
  FRASE_FALHA_AO_LIBERAR,
  FRASE_FALHA_AO_SALVAR_A_MAIS,
  FRASE_FALHA_AO_SALVAR_PARCIAL,
  FRASE_FALHA_AO_MARCAR,
  FRASE_JA_DESFEITA,
  FRASE_JA_ENCERRADA,
  FRASE_JA_LIBERADA,
  FRASE_JA_MARCADA,
  FRASE_NADA_A_DESFAZER,
  FRASE_ORDEM_CANCELADA_ATUALIZADA,
  FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  FRASE_ORDEM_NAO_EXISTE,
  FRASE_PARCIAL_ETAPA_MUDOU,
  FRASE_PARCIAL_NAO_INTEIRO,
  FRASE_PARCIAL_ULTIMA_ETAPA,
  FRASE_PECA_NAO_EXISTE,
  FRASE_ULTIMA_ETAPA,
  FRASE_ERRO_CARREGAR_MAIS,
  FRASE_CONCLUSAO_ETAPA_MUDOU,
  FRASE_CONCLUSAO_JA_CONCLUIDA,
  FRASE_CUSTO_DE_CADA_PECA_VAZIO,
  FRASE_CATEGORIA_DE_VENDA_INVALIDA,
  FRASE_FALHA_AO_CONCLUIR,
  FRASE_PECAS_DA_ORDEM_MUDARAM,
  FRASE_SEM_CATEGORIA_PRODUCAO_DA_CASA,
  FRASE_SEM_FICHA_NAO_ENTRA_NO_ESTOQUE,
  NOME_CATEGORIA_PRODUCAO_DA_CASA,
  fraseItemDesativadoNaConclusao,
  fraseMaterialDesativadoNaBaixa,
  textoParcialInvalido,
} from "./textos";

// Mesma forma de `lib/estoque/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type EtapaTerminada = { etapa: EtapaProducao; proxima: EtapaProducao };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

const FRASE_DA_RECUSA = {
  "ja-marcada": FRASE_JA_MARCADA,
  "nao-ativa": FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  "ultima-etapa": FRASE_ULTIMA_ETAPA,
} as const;

// "Terminei: {etapa}" (PRD-03). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-01, cobrado por
// `npm run verificar-acoes`). Do cliente chegam só o id da ordem e a etapa que o botão mostrava
// (T-06.1-03): sob a trava da ordem (`for no key update`, Pitfall 5) o servidor lê as etapas,
// decide com o módulo puro contra a etapa ESPERADA e grava `feita_em` = o "hoje" de Brasília,
// decidido AQUI — a data, a etapa atual e a próxima nunca vêm do cliente. Toque duplo e dois
// celulares: o segundo encontra a etapa já mudada e recebe "já tinha sido marcada" sem gravar
// nada (Pitfall 7).
export async function terminarEtapa(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<EtapaTerminada>> {
  // Nenhuma coluna de "quem marcou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaTerminarEtapa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let terminada: EtapaTerminada;
  try {
    terminada = await db.transaction(async (tx): Promise<EtapaTerminada> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const etapas = await lerEtapasDaOrdem(tx, dados.ordemId);
      const plano = planejarTerminar({ ...ordem, etapas }, dados.etapaEsperada, hoje);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(FRASE_DA_RECUSA[plano.motivo]);
      }
      await tx
        .update(ordemEtapas)
        .set({ feitaEm: plano.feitaEm, passaram: null })
        .where(and(eq(ordemEtapas.ordemId, dados.ordemId), eq(ordemEtapas.etapa, plano.etapa)));
      return { etapa: plano.etapa, proxima: plano.proxima };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    // T-06.1-07: o texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de
    // `erro.cause.code` por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao marcar etapa da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR };
  }

  // Fora do `try`: a gravação já está confirmada — uma falha aqui nunca vira "não deu para marcar"
  // de algo que já está no banco.
  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao(`/producao/${dados.ordemId}`));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: terminada };
}

export type OrdemLiberada = { inicio: string };

const FRASE_DA_RECUSA_DE_LIBERAR = {
  "ja-liberada": FRASE_JA_LIBERADA,
  cancelada: FRASE_ORDEM_CANCELADA_ATUALIZADA,
} as const;

// "Sinal recebido — começar" / "Começar assim mesmo" (PRD-11). `exigirUsuario()` é a PRIMEIRA
// instrução (T-06.1-14, cobrado por `npm run verificar-acoes`). Do cliente chega só o id da ordem:
// sob a trava da ordem (`for no key update`), o servidor decide com o módulo puro que ela ainda
// aguarda o sinal e grava `status = 'ativa'` e `inicio` = o "hoje" de Brasília, decidido AQUI. O
// segundo toque (outro celular, toque duplo) encontra a ordem já ativa e recebe "já foi liberada"
// sem gravar nada — o início não muda (T-06.1-12). A liberação é sempre manual: receber o sinal no
// Caixa não chega aqui (briefing §3), e esta ação só lê a ordem — nunca parcela nem documento.
export async function liberarOrdem(entradaBruta: unknown): Promise<ResultadoDeAcao<OrdemLiberada>> {
  // Nenhuma coluna de "quem liberou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaLiberarOrdem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { ordemId } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  let liberada: OrdemLiberada;
  try {
    liberada = await db.transaction(async (tx): Promise<OrdemLiberada> => {
      const ordem = await travarOrdem(tx, ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const plano = planejarLiberacao(ordem, hoje);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(FRASE_DA_RECUSA_DE_LIBERAR[plano.motivo]);
      }
      await tx
        .update(ordensProducao)
        .set({ status: "ativa", inicio: plano.inicio })
        .where(eq(ordensProducao.id, ordemId));
      return { inicio: plano.inicio };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao liberar ordem da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_LIBERAR };
  }

  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao(`/producao/${ordemId}`));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: liberada };
}

export type AMaisDefinido = { aMais: number };

// "Fazer a mais, de segurança" (PRD-08). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-18,
// cobrado por `npm run verificar-acoes`). Do cliente chegam os ids da ordem e da peça e o TEXTO do
// campo — o Zod o converte em inteiro 0..100.000 (T-06.1-16). Sob a trava da ordem: só encomenda
// (D-15 — na casa todas as boas vão para o estoque) e só aguardando o sinal ou ativa (concluída ou
// cancelada vale pelo que aconteceu); a peça precisa ser DESTA ordem (o `where` casa os dois ids).
// Grava SÓ `ordem_pecas.a_mais`: nenhuma linha de orçamento, de venda ou parcela muda — o cliente
// nunca vê nem paga as a mais (briefing §2.7, T-06.1-17).
export async function definirAMais(entradaBruta: unknown): Promise<ResultadoDeAcao<AMaisDefinido>> {
  // Nenhuma coluna de "quem mudou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaDefinirAMais.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { ordemId, pecaId, aMais } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const ordem = await travarOrdem(tx, ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      if (ordem.tipo !== "encomenda") {
        throw new RecusaDaProducao(FRASE_A_MAIS_SO_ENCOMENDA);
      }
      if (ordem.status !== "aguardando_sinal" && ordem.status !== "ativa") {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO);
      }
      const gravadas = await tx
        .update(ordemPecas)
        .set({ aMais })
        .where(and(eq(ordemPecas.id, pecaId), eq(ordemPecas.ordemId, ordemId)))
        .returning({ id: ordemPecas.id });
      if (gravadas.length !== 1) {
        throw new RecusaDaProducao(FRASE_PECA_NAO_EXISTE);
      }
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao salvar peças a mais (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR_A_MAIS };
  }

  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao(`/producao/${ordemId}`));
  return { ok: true, dados: { aMais } };
}

// ---------------------------------------------------------------------------------------------
// A trilha na mão (plano 05): desfazer a última, ajustar os dias previstos e o parcial. As três
// decidem SOB A TRAVA DA ORDEM, contra o que a pessoa viu na tela — é isso, e não o botão
// desabilitado, que impede dois celulares de gravarem por cima um do outro.
// ---------------------------------------------------------------------------------------------

// A soma do pedido e das a mais de cada peça da ordem — o total do parcial. Lida pela transação
// (sob a trava) ou pelo `db` (só para escrever a frase de recusa com o número certo).
async function lerTotalDeFeitas(executor: TransacaoDoBanco | typeof db, ordemId: string) {
  const pecas = await executor
    .select({ quantidade: ordemPecas.quantidade, aMais: ordemPecas.aMais })
    .from(ordemPecas)
    .where(eq(ordemPecas.ordemId, ordemId));
  return totalDeFeitas(pecas);
}

function revalidarOrdem(ordemId: string) {
  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao(`/producao/${ordemId}`));
  revalidatePath(rotaDeGestao("/"));
}

export type EtapaDesfeita = { etapa: EtapaProducao };

const FRASE_DA_RECUSA_DE_DESFAZER = {
  "nao-ativa": FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  "nada-a-desfazer": FRASE_NADA_A_DESFAZER,
  "ja-desfeita": FRASE_JA_DESFEITA,
} as const;

// "Desfazer a última" (PRD-03, UI-D4 — a tela já pediu confirmação dizendo a data que se perde).
// `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-21, cobrado por `npm run verificar-acoes`). Do
// cliente chegam só o id e a etapa que a confirmação mostrava: sob a trava da ordem, o módulo puro
// só aceita a ÚLTIMA feita (T-06.1-19); a ação grava `feita_em = null` nela e apaga os parciais da
// ordem (a desfeita volta a ser a atual sem o parcial de antes; a que era atual volta a ser futura
// sem parcial — Pitfall 8). Toque duplo e outro celular: "já tinha sido desfeita", nada gravado.
export async function desfazerEtapa(entradaBruta: unknown): Promise<ResultadoDeAcao<EtapaDesfeita>> {
  // Nenhuma coluna de "quem desfez" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaDesfazerEtapa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let desfeita: EtapaDesfeita;
  try {
    desfeita = await db.transaction(async (tx): Promise<EtapaDesfeita> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const etapas = await lerEtapasDaOrdem(tx, dados.ordemId);
      const plano = planejarDesfazer({ ...ordem, etapas }, dados.etapaEsperada);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(FRASE_DA_RECUSA_DE_DESFAZER[plano.motivo]);
      }
      await tx
        .update(ordemEtapas)
        .set({ passaram: null })
        .where(eq(ordemEtapas.ordemId, dados.ordemId));
      await tx
        .update(ordemEtapas)
        .set({ feitaEm: null })
        .where(and(eq(ordemEtapas.ordemId, dados.ordemId), eq(ordemEtapas.etapa, plano.etapa)));
      return { etapa: plano.etapa };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao desfazer etapa da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_DESFAZER };
  }

  revalidarOrdem(dados.ordemId);
  return { ok: true, dados: desfeita };
}

export type PrevistoAjustado = { etapa: EtapaProducao; diasPrevistos: number };

const FRASE_DA_RECUSA_DE_AJUSTE = {
  "nao-ativa": FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  "nao-futura": FRASE_AJUSTE_NAO_FUTURA,
  limite: FRASE_AJUSTE_NO_LIMITE,
  "delta-invalido": FRASE_FALHA_AO_AJUSTAR,
} as const;

// "−"/"+" nos dias previstos (PRD-12). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-21). Do
// cliente chegam o id, a etapa e o ±1 — nunca o número final: sob a trava da ordem, o módulo puro
// confere que a etapa ainda é FUTURA (T-06.1-19) e que o resultado fica em 1..365 (T-06.1-20, com o
// check `ordem_etapas_dias_previstos_faixa` por trás). Grava só `dias_previstos`.
export async function ajustarDiasPrevistos(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<PrevistoAjustado>> {
  // Nenhuma coluna de "quem ajustou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaAjustarDiasPrevistos.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let ajustado: PrevistoAjustado;
  try {
    ajustado = await db.transaction(async (tx): Promise<PrevistoAjustado> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const etapas = await lerEtapasDaOrdem(tx, dados.ordemId);
      const plano = planejarAjusteDePrevisto({ ...ordem, etapas }, dados.etapa, dados.delta);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(FRASE_DA_RECUSA_DE_AJUSTE[plano.motivo]);
      }
      await tx
        .update(ordemEtapas)
        .set({ diasPrevistos: plano.diasPrevistos })
        .where(and(eq(ordemEtapas.ordemId, dados.ordemId), eq(ordemEtapas.etapa, plano.etapa)));
      return { etapa: plano.etapa, diasPrevistos: plano.diasPrevistos };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao ajustar dias previstos (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_AJUSTAR };
  }

  revalidarOrdem(dados.ordemId);
  return { ok: true, dados: ajustado };
}

export type ParcialRegistrado = { passaram: number | null; total: number };

const FRASE_DA_RECUSA_DO_PARCIAL = {
  "nao-ativa": FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO,
  "etapa-mudou": FRASE_PARCIAL_ETAPA_MUDOU,
  "ultima-etapa": FRASE_PARCIAL_ULTIMA_ETAPA,
} as const;

// "Já passaram [ ] de {total}" (PRD-06). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-21). Do
// cliente chegam o id, a etapa que a tela mostrava e o TEXTO do campo (o Zod o converte em inteiro
// ≥ 0 ou `null`). Sob a trava da ordem: o total de feitas (pedido + a mais) é lido das peças e o
// módulo puro decide contra a etapa esperada — a etapa mudou noutro celular, recusa e a tela
// recarrega. Grava só `passaram` da etapa atual: o parcial NUNCA move a ordem.
export async function registrarParcial(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<ParcialRegistrado>> {
  // Nenhuma coluna de "quem registrou" nesta fase — a sessão só precisa existir.
  await exigirUsuario();

  const resultado = esquemaRegistrarParcial.safeParse(entradaBruta);
  if (!resultado.success) {
    const questao = resultado.error.issues[0];
    const ids = esquemaDesfazerEtapa.safeParse(entradaBruta);
    // Texto que não é inteiro: a frase certa leva o total ("Diga um número de 0 a 30.") — lido
    // aqui, sem trava (só serve para escrever a frase; nada é gravado).
    if (questao?.path[0] === "passaramTexto" && ids.success) {
      try {
        const total = await lerTotalDeFeitas(db, ids.data.ordemId);
        return { ok: false, erro: textoParcialInvalido(total) };
      } catch {
        return { ok: false, erro: FRASE_PARCIAL_NAO_INTEIRO };
      }
    }
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let registrado: ParcialRegistrado;
  try {
    registrado = await db.transaction(async (tx): Promise<ParcialRegistrado> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const etapas = await lerEtapasDaOrdem(tx, dados.ordemId);
      const total = await lerTotalDeFeitas(tx, dados.ordemId);
      const plano = planejarParcial({ ...ordem, etapas }, dados.etapaEsperada, dados.passaram, total);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(
          plano.motivo === "fora-da-faixa"
            ? textoParcialInvalido(total)
            : FRASE_DA_RECUSA_DO_PARCIAL[plano.motivo],
        );
      }
      await tx
        .update(ordemEtapas)
        .set({ passaram: plano.passaram })
        .where(
          and(eq(ordemEtapas.ordemId, dados.ordemId), eq(ordemEtapas.etapa, dados.etapaEsperada)),
        );
      return { passaram: plano.passaram, total };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao salvar o parcial (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR_PARCIAL };
  }

  revalidarOrdem(dados.ordemId);
  return { ok: true, dados: registrado };
}

// ---------------------------------------------------------------------------------------------
// Cancelar a ordem (plano 06, PRD-18)
// ---------------------------------------------------------------------------------------------

// "Cancelar ordem" (PRD-18 — a tela já pediu confirmação dizendo quantas baixas ficam e o que
// acontece com a venda). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-26, cobrado por `npm run
// verificar-acoes`). Do cliente chega só o id: sob a trava da ordem (`for no key update`), o módulo
// puro só aceita aguardando ou ativa, e a ação grava `status = 'cancelada'`, `cancelada_em = now()` e
// `cancelada_por` = quem cancelou — e NADA MAIS (T-06.1-24): nenhuma escrita na venda, nas parcelas
// nem no livro do Estoque. O sinal continua no Caixa (o dono decide lá) e o material baixado não
// volta sozinho (briefing §6). O segundo toque (outro celular) recebe "já foi concluída ou
// cancelada" sem gravar nada. Nenhuma trava de documento aqui: a Produção nunca trava documento
// (ordem de travas DOCUMENTO → ORDEM → ITENS, `lib/producao/gravacao.ts`).
export async function cancelarOrdem(entradaBruta: unknown): Promise<ResultadoDeAcao<{ ordemId: string }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCancelarOrdem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { ordemId } = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const ordem = await travarOrdem(tx, ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      const plano = planejarCancelamento(ordem);
      if (plano.tipo === "recusa") {
        throw new RecusaDaProducao(FRASE_JA_ENCERRADA);
      }
      await tx
        .update(ordensProducao)
        .set({ status: "cancelada", canceladaEm: sql`now()`, canceladaPor: usuario.id })
        .where(eq(ordensProducao.id, ordemId));
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao cancelar ordem da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CANCELAR };
  }

  revalidarOrdem(ordemId);
  return { ok: true, dados: { ordemId } };
}

// ---------------------------------------------------------------------------------------------
// "Nova ordem" (plano 07, PRD-09, D-04/D-05/D-11/D-13)
// ---------------------------------------------------------------------------------------------

// A lista do seletor de peça, carregada AO ABRIR a folha. `exigirUsuario()` é a PRIMEIRA instrução
// (T-06.1-29). Só leitura: `id` e `nome` de fichas e itens.
export async function carregarCatalogoDaNovaOrdem(): Promise<ResultadoDeAcao<CatalogoDaNovaOrdem>> {
  await exigirUsuario();

  try {
    return { ok: true, dados: await listarCatalogoDaNovaOrdem() };
  } catch (erro) {
    console.error(
      `Falha ao carregar o catálogo da Nova ordem (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_ERRO_CARREGAR_CATALOGO };
  }
}

// A recusa de `criarOrdem` pode trazer, além da frase geral, a frase de cada campo — a folha as
// mostra embaixo de cada um (UI-SPEC §Erros) e põe o foco no primeiro.
export type ResultadoDeCriarOrdem =
  | { ok: true; dados: { id: string } }
  | { ok: false; erro: string; campos?: ErrosDaNovaOrdem };

// Uma recusa da conferência no banco, presa à peça em que aconteceu.
class RecusaDaPeca extends Error {
  constructor(
    readonly campo: string,
    readonly frase: string,
  ) {
    super(frase);
    this.name = "RecusaDaPeca";
  }
}

// "Criar ordem" (PRD-09). `exigirUsuario()` é a PRIMEIRA instrução (T-06.1-29, cobrado por `npm run
// verificar-acoes`). O Zod valida a forma no servidor (T-06.1-28) e a entrega prometida é conferida
// contra o HOJE de Brasília, decidido aqui (UI-D15). Depois, dentro da transação, as fichas e os
// itens citados são lidos do BANCO e a regra D-05/D-13 é conferida de novo (T-06.1-27) — o seletor
// da tela é só conveniência: na casa, a ficha precisa ser de LINHA (não exclusiva, com item) e o
// item precisa controlar estoque e estar ativo; ficha ou item que não existe mais é recusado com
// frase. A descrição de cada peça é CONGELADA (nome da ficha, nome do item ou o texto livre); a
// `ficha_id` continua a referência viva. A ordem nasce `ativa`, com `inicio` = hoje e as etapas do
// caminho com os previstos do D-10; as peças na ordem recebida (`posicao`). Nenhuma escrita em
// venda, linha de venda ou parcela (T-06.1-30): a ordem de boca não cria venda nesta fase. O
// `numero` vem da identity do banco — duas pessoas criando ao mesmo tempo nunca colidem.
export async function criarOrdem(entradaBruta: unknown): Promise<ResultadoDeCriarOrdem> {
  const usuario = await exigirUsuario();

  const hoje = hojeEmBrasilia(new Date());
  const validacao = validarNovaOrdem(entradaBruta, hoje);
  if (!validacao.ok) {
    const [primeira] = Object.values(validacao.erros);
    return {
      ok: false,
      erro: primeira ?? "Não deu para validar os dados enviados.",
      campos: validacao.erros,
    };
  }
  const dados = validacao.dados;

  let id: string;
  try {
    id = await db.transaction(async (tx): Promise<string> => {
      const descricoes = await conferirPecas(tx, dados);

      const [ordem] = await tx
        .insert(ordensProducao)
        .values({
          tipo: dados.tipo,
          caminho: dados.caminho,
          status: "ativa",
          inicio: hoje,
          nome: dados.nome,
          clienteNome: dados.clienteNome,
          entregaPrometida: dados.entregaPrometida,
          criadoPor: usuario.id,
        })
        .returning({ id: ordensProducao.id });

      await tx.insert(ordemEtapas).values(
        etapasIniciais(dados.caminho).map((etapa) => ({
          ordemId: ordem.id,
          etapa: etapa.etapa,
          posicao: etapa.posicao,
          diasPrevistos: etapa.diasPrevistos,
        })),
      );

      await tx.insert(ordemPecas).values(
        dados.pecas.map((peca, posicao) => ({
          ordemId: ordem.id,
          posicao,
          fichaId: peca.origem === "ficha" ? peca.fichaId : null,
          itemCatalogoId: peca.origem === "item" ? peca.itemCatalogoId : null,
          descricao: descricoes[posicao],
          quantidade: peca.quantidade,
        })),
      );

      return ordem.id;
    });
  } catch (erro) {
    if (erro instanceof RecusaDaPeca) {
      return { ok: false, erro: erro.frase, campos: { [erro.campo]: erro.frase } };
    }
    console.error(
      `Falha ao criar ordem da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CRIAR };
  }

  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: { id } };
}

// D-05/D-13 conferidas no BANCO, peça a peça, e a descrição congelada de cada uma (na mesma ordem
// das peças). Lança `RecusaDaPeca` presa à peça — nada foi gravado ainda.
async function conferirPecas(
  tx: TransacaoDoBanco,
  dados: NovaOrdemValidada,
): Promise<string[]> {
  const fichaIds = [
    ...new Set(dados.pecas.flatMap((peca) => (peca.origem === "ficha" ? [peca.fichaId] : []))),
  ];
  const itemIds = [
    ...new Set(
      dados.pecas.flatMap((peca) => (peca.origem === "item" ? [peca.itemCatalogoId] : [])),
    ),
  ];

  const fichas = new Map(
    (fichaIds.length === 0
      ? []
      : await tx
          .select({
            id: fichasPrecificacao.id,
            nome: fichasPrecificacao.nome,
            exclusiva: fichasPrecificacao.exclusiva,
            itemCatalogoId: fichasPrecificacao.itemCatalogoId,
          })
          .from(fichasPrecificacao)
          .where(inArray(fichasPrecificacao.id, fichaIds))
    ).map((ficha) => [ficha.id, ficha]),
  );
  const itens = new Map(
    (itemIds.length === 0
      ? []
      : await tx
          .select({
            id: itensCatalogo.id,
            nome: itensCatalogo.nome,
            controlaEstoque: itensCatalogo.controlaEstoque,
            ativo: itensCatalogo.ativo,
          })
          .from(itensCatalogo)
          .where(inArray(itensCatalogo.id, itemIds))
    ).map((item) => [item.id, item]),
  );

  const ehCasa = dados.tipo === "casa";
  return dados.pecas.map((peca, indice) => {
    const campo = `peca-${indice}`;
    if (peca.origem === "livre") {
      // O esquema já recusa texto livre na casa; conferido de novo aqui por defesa.
      if (ehCasa) {
        throw new RecusaDaPeca(campo, FRASE_CASA_PRECISA_DO_CATALOGO);
      }
      return peca.descricao;
    }
    if (peca.origem === "ficha") {
      const ficha = fichas.get(peca.fichaId);
      if (!ficha) {
        throw new RecusaDaPeca(campo, FRASE_PECA_SAIU_DO_CATALOGO);
      }
      if (ehCasa && (ficha.exclusiva || ficha.itemCatalogoId === null)) {
        throw new RecusaDaPeca(campo, FRASE_CASA_PRECISA_DO_CATALOGO);
      }
      return ficha.nome;
    }
    if (!ehCasa) {
      throw new RecusaDaPeca(campo, FRASE_ENCOMENDA_SEM_ITEM);
    }
    const item = itens.get(peca.itemCatalogoId);
    if (!item) {
      throw new RecusaDaPeca(campo, FRASE_PECA_SAIU_DO_CATALOGO);
    }
    if (!item.controlaEstoque || !item.ativo) {
      throw new RecusaDaPeca(campo, FRASE_CASA_PRECISA_DO_CATALOGO);
    }
    return item.nome;
  });
}

// "Mostrar mais 50" das Concluídas e canceladas (plano 08, UI-D8). Do cliente chega SÓ o
// deslocamento — inteiro ≥ 0 (T-06.1-31); quantas vêm por vez é teto fixo do servidor
// (`CONCLUIDAS_POR_VEZ`). Só leitura: nenhuma escrita, nenhum `revalidatePath`.
const esquemaCarregarMaisConcluidas = z.object({
  deslocamento: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

export async function carregarMaisConcluidas(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<OrdemEncerrada[]>> {
  await exigirUsuario();

  const resultado = esquemaCarregarMaisConcluidas.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_ERRO_CARREGAR_MAIS };
  }

  try {
    return { ok: true, dados: await listarConcluidasECanceladas(resultado.data) };
  } catch (erro) {
    console.error(
      `Falha ao carregar mais concluídas (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_ERRO_CARREGAR_MAIS };
  }
}

// ---------------------------------------------------------------------------------------------
// "Dar baixa" pela ordem (plano 10, PRD-14, critério 5 do ROADMAP).
// ---------------------------------------------------------------------------------------------

export type BaixaDaOrdemRegistrada = {
  nome: string;
  unidade: Unidade;
  // Com sinal, como gravado (a saída é negativa).
  quantidadeMilesimos: number;
  saldoDepoisMilesimos: number;
};

// A baixa de material feita pela própria ordem. `exigirUsuario()` é a PRIMEIRA instrução
// (T-06.1-39, cobrado por `npm run verificar-acoes`). Do cliente chegam só os ids, o texto da
// quantidade e qual material previsto ela cobre (T-06.1-36).
//
// A Produção NUNCA grava no livro por conta própria: o pedido é o MESMO `pedidoDeSaidaManual` da
// folha do Estoque (destino "consumo em encomenda" → área `pecas` por `areaDoDestino`), e quem grava
// é `gravarMovimentacoes`, a porta única — o valor em R$ sai do custo médio lido sob a trava do
// item, nunca daqui.
//
// Ordem de travas DOCUMENTO → ORDEM → ITENS (`lib/producao/gravacao.ts`, Pitfall 5): a ORDEM
// primeiro, com `for no key update` (aguardando ou ativa — senão a frase de estado mudado), e só
// depois o ITEM (`travarItens`, e de novo dentro de `gravarMovimentacoes`, na mesma transação). A
// folha do Estoque trava o item e depois LÊ a ordem com `for key share`, que não conflita com
// `for no key update`: baixa e conclusão nunca entram em impasse (T-06.1-37).
export async function darBaixaNaOrdem(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<BaixaDaOrdemRegistrada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaDarBaixaNaOrdem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let registrada: BaixaDaOrdemRegistrada;
  try {
    registrada = await db.transaction(async (tx): Promise<BaixaDaOrdemRegistrada> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_EXISTE);
      }
      if (ordem.status !== "aguardando_sinal" && ordem.status !== "ativa") {
        throw new RecusaDaProducao(FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO);
      }

      // Decide sob a trava do item (T-06.1-38): ele pode ter sido desativado — ou perdido o
      // estoque próprio — entre abrir a folha e tocar em "Dar baixa".
      const travados = await travarItens(tx, [dados.itemId]);
      const item = travados.get(dados.itemId);
      if (!item || !item.controlaEstoque || item.unidade === null) {
        throw new RecusaDaProducao(FRASE_MATERIAL_NAO_EXISTE_MAIS);
      }
      if (!item.ativo) {
        throw new RecusaDaProducao(fraseMaterialDesativadoNaBaixa(item.nome));
      }

      const pedido = pedidoDeSaidaManual({
        itemId: item.id,
        milesimos: dados.milesimos,
        destino: "encomenda",
        encomendaId: ordem.id,
        // O nome da ordem CONGELADO (Pitfall 10 da Fase 06): o histórico do Estoque lê dali.
        nota: ordem.nome,
        materialDaOrdem: dados.material,
      });
      const [gravada] = await gravarMovimentacoes(tx, [pedido], { registradoPor: usuario.id });
      return {
        nome: item.nome,
        unidade: item.unidade,
        quantidadeMilesimos: gravada.quantidadeMilesimos,
        saldoDepoisMilesimos: gravada.saldoDepoisMilesimos,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaProducao) {
      return { ok: false, erro: erro.frase };
    }
    // O texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de `erro.cause.code`
    // por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao dar baixa de material na ordem (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_DAR_BAIXA };
  }

  // Fora do `try`: a gravação já está confirmada.
  revalidatePath(rotaDeGestao(`/producao/${dados.ordemId}`));
  revalidatePath(rotaDeGestao("/estoque"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: registrada };
}

// ---------------------------------------------------------------------------------------------
// Concluir a ordem (plano 11, PRD-15/PRD-16/PRD-18, critério 6 do ROADMAP; D-12/D-13/D-14/D-15).
// ---------------------------------------------------------------------------------------------

export type OrdemConcluida = {
  tipo: TipoOrdem;
  // Quantas peças entraram no Estoque como pronta entrega (a soma de `para_estoque`).
  pecasNoEstoque: number;
  // Os nomes dos itens que passaram a controlar estoque nesta conclusão (D-13).
  itensLigados: string[];
};

// A recusa da conclusão pode trazer a frase de cada campo (embaixo do campo, a folha aberta) e
// dizer que o ESTADO mudou (já concluída, etapa desfeita noutro celular) — aí a tela recarrega.
export type ResultadoDeConcluirOrdem =
  | { ok: true; dados: OrdemConcluida }
  | { ok: false; erro: string; campos?: Record<string, string>; recarregar?: boolean };

class RecusaDaConclusao extends Error {
  constructor(
    readonly frase: string,
    readonly opcoes: { campos?: Record<string, string>; recarregar?: boolean } = {},
  ) {
    super(frase);
    this.name = "RecusaDaConclusao";
  }
}

// A chave do campo de cada peça na folha: `perdidas-{id}`, `destino-{id}`, `custo-{id}` e, no
// passo "Transformar em peça de linha" (D-12), `categoria-{id}` e `preco-{id}`.
type CampoDaPeca = "perdidas" | "destino" | "custo" | "categoria" | "preco";
function campoDaPeca(tipo: CampoDaPeca, pecaId: string): string {
  return `${tipo}-${pecaId}`;
}

// A recusa do Zod presa ao campo da peça, quando dá para saber qual (o id vem do que chegou).
function camposDaRecusaDoEsquema(
  entradaBruta: unknown,
  questao: { path: PropertyKey[]; message: string } | undefined,
): Record<string, string> | undefined {
  if (!questao || questao.path[0] !== "pecas" || typeof questao.path[1] !== "number") {
    return undefined;
  }
  const pecas = (entradaBruta as { pecas?: unknown } | null)?.pecas;
  const peca = Array.isArray(pecas) ? (pecas[questao.path[1]] as { pecaId?: unknown }) : undefined;
  if (!peca || typeof peca.pecaId !== "string") {
    return undefined;
  }
  const tipo: CampoDaPeca =
    questao.path[2] === "custoTexto"
      ? "custo"
      : questao.path[2] === "destino"
        ? "destino"
        : questao.path[2] === "promocao"
          ? questao.path[3] === "categoriaVendaId"
            ? "categoria"
            : "preco"
          : "perdidas";
  return { [campoDaPeca(tipo, peca.pecaId)]: questao.message };
}

// "Entreguei" (encomenda) / "Guardar no estoque" (casa) → "Concluir ordem". `exigirUsuario()` é a
// PRIMEIRA instrução (T-06.1-44, cobrado por `npm run verificar-acoes`).
//
// Do cliente chegam, por peça, SÓ o texto das perdidas, o destino das extras e o custo digitado
// (T-06.1-42). O custo pela ficha é lido FORA da transação (`dadosDaConclusao` →
// `custosDasFichas`, a mesma conta do Estoque — parâmetros vigentes, `quantasCabem` e o cálculo
// da peça no canal direto), como `aprovarOrcamento` lê a configuração; o digitado só vale quando a
// ficha não dá custo (T-06.1-41, D-14).
//
// Dentro da transação, na ordem de travas DOCUMENTO → ORDEM → ITENS (`lib/producao/gravacao.ts`,
// Pitfall 5): trava a ORDEM (`for no key update`) e confere, sob a trava, que ela está ATIVA com a
// etapa atual `entrega` — a segunda conclusão (toque duplo, outro celular) recebe "já foi
// concluída" e NADA entra duas vezes no Estoque (T-06.1-40). Relê as peças, refaz as contas pelo
// módulo puro (`derivarPeca`, briefing §7) e decide o destino; promove a ficha EXCLUSIVA cuja extra
// vai ao Estoque a peça de linha (D-12, plano 12 — `promoverFichaParaLinha`, a mesma de
// `editarFicha`, com a categoria e o preço que a folha mandou); trava os ITENS; liga o estoque do
// item que ainda não controla (D-13: `un` quando não tem unidade, categoria de compra "Produção da
// casa" — ANTES de `gravarMovimentacoes`, que recusaria item sem estoque próprio); grava as
// entradas pela porta única (`pedidoDeEntradaDaProducao` + `gravarMovimentacoes`); e grava, por
// peça, perdidas, destino, para o estoque e sem destino SEPARADOS (PRD-17), a etapa `entrega` feita
// hoje e a ordem `concluida`. NENHUMA escrita em parcela nem em documento (PRD-18, T-06.1-43): o
// saldo a receber continua no Caixa.
export async function concluirOrdem(entradaBruta: unknown): Promise<ResultadoDeConcluirOrdem> {
  const usuario = await exigirUsuario();

  const resultado = esquemaConcluirOrdem.safeParse(entradaBruta);
  if (!resultado.success) {
    const questao = resultado.error.issues[0];
    return {
      ok: false,
      erro: questao?.message ?? FRASE_FALHA_AO_CONCLUIR,
      campos: camposDaRecusaDoEsquema(entradaBruta, questao),
    };
  }
  const dados = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  // FORA da transação: o custo de cada peça pela ficha, com os parâmetros de hoje.
  let custoPorFicha: Map<string, number>;
  try {
    const lidas = await dadosDaConclusao(dados.ordemId, hoje);
    custoPorFicha = new Map(
      lidas.pecas.flatMap((peca) =>
        peca.fichaId !== null && peca.custoPelaFichaCentavos !== null
          ? [[peca.fichaId, peca.custoPelaFichaCentavos] as const]
          : [],
      ),
    );
  } catch (erro) {
    console.error(
      `Falha ao ler o custo das fichas para concluir (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CONCLUIR };
  }

  let concluida: OrdemConcluida;
  try {
    concluida = await db.transaction(async (tx): Promise<OrdemConcluida> => {
      const ordem = await travarOrdem(tx, dados.ordemId);
      if (!ordem) {
        throw new RecusaDaConclusao(FRASE_ORDEM_NAO_EXISTE, { recarregar: true });
      }
      if (ordem.status === "concluida") {
        throw new RecusaDaConclusao(FRASE_CONCLUSAO_JA_CONCLUIDA, { recarregar: true });
      }
      if (ordem.status === "cancelada") {
        throw new RecusaDaConclusao(FRASE_JA_ENCERRADA, { recarregar: true });
      }
      if (ordem.status !== "ativa") {
        throw new RecusaDaConclusao(FRASE_ORDEM_NAO_ESTA_EM_ANDAMENTO, { recarregar: true });
      }
      const etapas = await lerEtapasDaOrdem(tx, dados.ordemId);
      const atual = etapas.find((etapa) => etapa.feitaEm === null);
      if (!atual || atual.etapa !== "entrega") {
        throw new RecusaDaConclusao(FRASE_CONCLUSAO_ETAPA_MUDOU, { recarregar: true });
      }

      // Cada peça da ordem exatamente uma vez — nem a mais, nem a menos, nem repetida.
      const pecas = await lerPecasParaConcluir(tx, dados.ordemId);
      const enviadas = new Map(dados.pecas.map((peca) => [peca.pecaId, peca]));
      if (
        enviadas.size !== dados.pecas.length ||
        enviadas.size !== pecas.length ||
        pecas.some((peca) => !enviadas.has(peca.id))
      ) {
        throw new RecusaDaConclusao(FRASE_PECAS_DA_ORDEM_MUDARAM, { recarregar: true });
      }

      const campos: Record<string, string> = {};
      const decididas = pecas.flatMap((peca) => {
        const enviada = enviadas.get(peca.id);
        if (!enviada) {
          return [];
        }
        const derivada = derivarPeca({
          tipo: ordem.tipo,
          pedido: peca.quantidade,
          aMais: peca.aMais,
          perdidas: enviada.perdidas,
        });
        if (!derivada.ok) {
          campos[campoDaPeca("perdidas", peca.id)] = derivada.frase;
          return [];
        }

        const temFicha = peca.fichaId !== null;
        const exclusiva = peca.exclusiva === true;
        // Casa: tudo para o Estoque, sem escolha (D-15). Encomenda sem extras: nada a decidir.
        const destino: DestinoDasExtras | null =
          ordem.tipo === "casa"
            ? "estoque"
            : derivada.extrasBoas === 0
              ? null
              : (enviada.destino ?? destinoSugerido({ tipo: ordem.tipo, exclusiva, temFicha }));
        // D-12: a extra boa de peça EXCLUSIVA que vai para o Estoque vira peça de linha — com a
        // categoria e o preço que a folha mandou (`promocao`), pela MESMA promoção da Precificação.
        let promocao: { fichaId: string; categoriaVendaId: string; precoCentavos: number } | null =
          null;
        if (ordem.tipo === "encomenda" && destino === "estoque") {
          if (!temFicha) {
            campos[campoDaPeca("destino", peca.id)] = FRASE_SEM_FICHA_NAO_ENTRA_NO_ESTOQUE;
            return [];
          }
          if (exclusiva && peca.fichaId !== null) {
            if (enviada.promocao === null) {
              // A folha não mostrou o passo: ela viu a ficha como de linha, e sob a trava ela é
              // exclusiva (mudou na Precificação enquanto a folha estava aberta). A tela recarrega
              // e mostra o passo.
              throw new RecusaDaConclusao(FRASE_PECAS_DA_ORDEM_MUDARAM, { recarregar: true });
            }
            promocao = { fichaId: peca.fichaId, ...enviada.promocao };
          }
        }
        const distribuicao = distribuirExtras(derivada, destino ?? "sem_destino", ordem.tipo);

        let custoUnitario: number | null = null;
        if (distribuicao.paraEstoque > 0) {
          if (peca.item === null && promocao === null) {
            campos[campoDaPeca("destino", peca.id)] = FRASE_SEM_FICHA_NAO_ENTRA_NO_ESTOQUE;
            return [];
          }
          custoUnitario =
            (peca.fichaId !== null ? custoPorFicha.get(peca.fichaId) : undefined) ??
            enviada.custoCentavos;
          if (custoUnitario === null) {
            campos[campoDaPeca("custo", peca.id)] = FRASE_CUSTO_DE_CADA_PECA_VAZIO;
            return [];
          }
        }
        return [
          {
            peca,
            derivada,
            distribuicao,
            custoUnitario,
            promocao: distribuicao.paraEstoque > 0 ? promocao : null,
            itemId: peca.item?.id ?? null,
          },
        ];
      });
      const [primeira] = Object.values(campos);
      if (primeira !== undefined) {
        throw new RecusaDaConclusao(primeira, { campos });
      }

      // D-12: as fichas EXCLUSIVAS que mandam extras ao Estoque viram peça de linha AQUI — depois
      // da trava da ordem e antes da trava dos itens (ordem → ficha → itens: `editarFicha` trava
      // a ficha e depois o item, a mesma direção; nenhum caminho trava um item e depois uma ficha).
      // O item nasce aparecendo na Venda e SEM estoque próprio (como `editarFicha` o cria); o passo
      // D-13 logo abaixo o liga, na mesma transação.
      for (const decidida of decididas) {
        if (decidida.promocao === null) {
          continue;
        }
        try {
          decidida.itemId = await promoverFichaParaLinha(tx, decidida.promocao);
        } catch (erro) {
          if (erro instanceof CategoriaDeVendaInvalida) {
            throw new RecusaDaConclusao(FRASE_CATEGORIA_DE_VENDA_INVALIDA, {
              campos: { [campoDaPeca("categoria", decidida.peca.id)]: FRASE_CATEGORIA_DE_VENDA_INVALIDA },
            });
          }
          if (erro instanceof FichaNaoEncontrada) {
            throw new RecusaDaConclusao(FRASE_PECAS_DA_ORDEM_MUDARAM, { recarregar: true });
          }
          throw erro;
        }
      }

      // Os ITENS, depois da ordem (e da ficha promovida). Sob a trava do item: existe, está ativo,
      // e — se ainda não controla estoque — é ligado AQUI (D-13), antes de `gravarMovimentacoes`.
      const paraEstoque = decididas.filter((decidida) => decidida.distribuicao.paraEstoque > 0);
      const itemIds = [
        ...new Set(paraEstoque.flatMap((decidida) => (decidida.itemId ? [decidida.itemId] : []))),
      ];
      const travados = await travarItens(tx, itemIds);
      const itensLigados: string[] = [];
      let categoriaProducaoDaCasa: string | null = null;
      for (const itemId of itemIds) {
        const item = travados.get(itemId);
        if (!item) {
          throw new RecusaDaConclusao(FRASE_PECAS_DA_ORDEM_MUDARAM, { recarregar: true });
        }
        if (!item.ativo) {
          throw new RecusaDaConclusao(fraseItemDesativadoNaConclusao(item.nome));
        }
        if (item.controlaEstoque) {
          continue;
        }
        if (categoriaProducaoDaCasa === null) {
          const [categoria] = await tx
            .select({ id: categorias.id })
            .from(categorias)
            .where(
              sql`lower(trim(${categorias.nome})) = lower(trim(${NOME_CATEGORIA_PRODUCAO_DA_CASA}))`,
            )
            .limit(1);
          if (!categoria) {
            console.error(
              `Conclusão da ordem ${dados.ordemId}: a categoria de compra "${NOME_CATEGORIA_PRODUCAO_DA_CASA}" (semente da 0023) não existe — o estoque do item ${item.id} não pôde ser ligado.`,
            );
            throw new RecusaDaConclusao(FRASE_SEM_CATEGORIA_PRODUCAO_DA_CASA);
          }
          categoriaProducaoDaCasa = categoria.id;
        }
        await tx
          .update(itensCatalogo)
          .set({
            controlaEstoque: true,
            unidade: sql`coalesce(${itensCatalogo.unidade}, 'un')`,
            categoriaCompraId: categoriaProducaoDaCasa,
          })
          .where(eq(itensCatalogo.id, item.id));
        itensLigados.push(item.nome);
      }

      // As entradas, pela porta única do Estoque. 1 peça = 1 unidade do item (milésimos × 1000);
      // o custo total = custo de cada peça × quantidade (inteiros em centavos).
      const pedidos = paraEstoque.flatMap((decidida) =>
        decidida.itemId && decidida.custoUnitario !== null
          ? [
              pedidoDeEntradaDaProducao({
                itemId: decidida.itemId,
                milesimos: decidida.distribuicao.paraEstoque * 1000,
                custoCentavos: decidida.custoUnitario * decidida.distribuicao.paraEstoque,
                ordemId: ordem.id,
                // O nome da ordem CONGELADO: o histórico do Estoque mostra "Da Produção · {nome}".
                nota: ordem.nome,
              }),
            ]
          : [],
      );
      await gravarMovimentacoes(tx, pedidos, { registradoPor: usuario.id });

      for (const decidida of decididas) {
        await tx
          .update(ordemPecas)
          .set({
            perdidas: decidida.derivada.perdidas,
            destinoExtras:
              decidida.distribuicao.paraEstoque > 0
                ? "estoque"
                : decidida.distribuicao.semDestino > 0
                  ? "sem_destino"
                  : null,
            paraEstoque: decidida.distribuicao.paraEstoque,
            semDestino: decidida.distribuicao.semDestino,
          })
          .where(and(eq(ordemPecas.id, decidida.peca.id), eq(ordemPecas.ordemId, ordem.id)));
      }

      await tx
        .update(ordemEtapas)
        .set({ feitaEm: hoje, passaram: null })
        .where(and(eq(ordemEtapas.ordemId, ordem.id), eq(ordemEtapas.etapa, "entrega")));

      const resumo = resumoDaConclusao(
        decididas.map((decidida) => ({
          faltam: decidida.derivada.faltam,
          paraEstoque: decidida.distribuicao.paraEstoque,
          semDestino: decidida.distribuicao.semDestino,
        })),
      );
      await tx
        .update(ordensProducao)
        .set({ status: "concluida", concluidaEm: hoje, entregaParcial: resumo.entregaParcial })
        .where(eq(ordensProducao.id, ordem.id));

      return { tipo: ordem.tipo, pecasNoEstoque: resumo.paraEstoque, itensLigados };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaConclusao) {
      return { ok: false, erro: erro.frase, ...erro.opcoes };
    }
    // O texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de `erro.cause.code`
    // por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao concluir ordem da produção (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CONCLUIR };
  }

  // Fora do `try`: a gravação já está confirmada.
  revalidatePath(rotaDeGestao("/producao"));
  revalidatePath(rotaDeGestao(`/producao/${dados.ordemId}`));
  revalidatePath(rotaDeGestao("/estoque"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: concluida };
}

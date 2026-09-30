"use server";

import { revalidatePath } from "next/cache";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  fichasPrecificacao,
  itensCatalogo,
  ordemEtapas,
  ordemPecas,
  ordensProducao,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { listarCatalogoDaNovaOrdem, type CatalogoDaNovaOrdem } from "./consultas";
import { etapasIniciais, type EtapaProducao } from "./etapas";
import {
  esquemaAjustarDiasPrevistos,
  esquemaCancelarOrdem,
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

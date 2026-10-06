"use server";

// Ações da Agenda — o USO LIVRE: reservar, chegada, cancelar, encerrar e o material do uso
// (D-24/P10, plano 06.5-27 — saíram de `acoes.ts`, que agora é o índice).

import { revalidatePath } from "next/cache";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { clientes, itensCatalogo, usosLivres, usosLivresMaterial } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { FRASE_MATERIAL_NAO_EXISTE_MAIS } from "@/lib/estoque/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { obterItensDoSistema } from "./consultas";
import {
  esquemaAcrescentarMaterial,
  esquemaCancelarReserva,
  esquemaCorrigirChegada,
  esquemaDefinirCobrancaDoMaterial,
  esquemaEncerrarUsoLivre,
  esquemaMarcarChegada,
  esquemaReservarUsoLivre,
  esquemaTirarMaterial,
} from "./esquemas";
import {
  baixarMaterialDoUso,
  RecusaDaAgenda,
  travarUsoLivre,
  type MaterialBaixado,
  type TransacaoDoBanco,
} from "./gravacao";
import { chaveDoEnvio, umaVezPorEnvio } from "./envios";
import { horasCheias, proximoEstado, valorDoUsoLivre } from "./uso-livre";
import type { EstadoUsoLivre } from "./tipos";
import {
  FRASE_FALHA_AO_LANCAR,
  FRASE_JA_REMOVIDO,
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_FALHA_AO_CANCELAR_RESERVA,
  FRASE_FALHA_AO_ENCERRAR,
  FRASE_SAIDA_ANTES_DA_CHEGADA,
  FRASE_SEM_PRECO_DA_HORA,
  FRASE_FALHA_AO_CORRIGIR_CHEGADA,
  FRASE_FALHA_AO_MARCAR_CHEGADA,
  FRASE_PESSOA_NAO_EXISTE,
  FRASE_RESERVA_JA_COMECOU,
  FRASE_USO_AINDA_NAO_COMECOU,
  FRASE_USO_COM_MATERIAL_BAIXADO,
  FRASE_USO_JA_ENCERRADO,
  FRASE_FALHA_AO_ACRESCENTAR_MATERIAL,
  FRASE_FALHA_AO_MUDAR_COBRANCA,
  FRASE_FALHA_AO_TIRAR_MATERIAL,
  FRASE_MATERIAL_SEM_PRECO,
  fraseMaterialDesativadoNoUso,
  SUFIXO_MATERIAL_DESATIVADO,
} from "./textos";

import {
  errosPorCampo,
  primeiraMensagemDeErro,
  type ResultadoDeAcao,
  type ResultadoDoLancamento,
} from "./acoes-comum";
import { revalidarTelasDaAgenda } from "./acoes-servidor";

// ── O uso livre do espaço (plano 09 — AGE-13, AGE-05, AGE-01) ───────────────────────────────────────
// Toda transição é uma instrução CONDICIONADA AO ESTADO na própria escrita (`… where id = $1 and estado
// = 'reservado'`) ou decidida sob a trava `for no key update` do uso (`travarUsoLivre`): dois gestores
// nunca removem uma reserva que acabou de começar nem encerram duas vezes (T-05-43, T-05-44). O uso livre
// nunca vai ao site — só a rota da Agenda é revalidada.

export type UsoLivreReservado = { id: string; data: string };

// "Reservar uso livre" (AGE-01, AGE-13). `exigirUsuario()` primeiro (T-05-41), Zod no servidor (quem,
// data, "HH:MM", horas 1..12, pessoas 1..50 — nenhum preço vem da tela, T-05-42). Um `insert` em
// `reservado`. Pessoa apagada em outro celular → a chave estrangeira recusa (23503, lido em
// `erro.cause.code`) e a frase humana volta. NUNCA recusa por dia fechado (D-13: avisa e não bloqueia)
// nem por haver outro lançamento no mesmo horário.
export async function reservarUsoLivre(entradaBruta: unknown): Promise<ResultadoDoLancamento<UsoLivreReservado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaReservarUsoLivre.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;
  // WR-06 (revisão B): a resposta perdida no celular não vira um segundo lançamento — `lib/agenda/envios.ts`.
  return umaVezPorEnvio(chaveDoEnvio(usuario.id, "reservarUsoLivre", entradaBruta, dados), async () => {
    let reservado: UsoLivreReservado;
    try {
      const [linha] = await db
        .insert(usosLivres)
        .values({
          clienteId: dados.clienteId,
          data: dados.data,
          chegadaPrevista: dados.chegadaPrevista,
          horasPrevistas: dados.horasPrevistas,
          pessoas: dados.pessoas,
          estado: "reservado",
          criadoPor: usuario.id,
        })
        .returning({ id: usosLivres.id, data: usosLivres.data });
      reservado = linha;
    } catch (erro) {
      if (codigoDoErroPostgres(erro) === "23503") {
        return { ok: false, erro: FRASE_PESSOA_NAO_EXISTE, campos: { clienteId: FRASE_PESSOA_NAO_EXISTE } };
      }
      console.error(
        `Falha ao reservar o uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
        erro,
      );
      return { ok: false, erro: FRASE_FALHA_AO_LANCAR };
    }

    revalidarTelasDaAgenda({ publico: false });
    return { ok: true, dados: reservado };
  });
}

// O estado de agora de um uso, depois de uma escrita condicionada que não pegou nenhuma linha — para
// dizer POR QUÊ (não existe, já começou, já foi encerrado) sem nunca gravar nada.
async function estadoAtualDoUso(usoLivreId: string): Promise<{ estado: EstadoUsoLivre; chegada: string | null } | null> {
  const [linha] = await db
    .select({ estado: usosLivres.estado, chegada: usosLivres.chegada })
    .from(usosLivres)
    .where(eq(usosLivres.id, usoLivreId));
  return linha ?? null;
}

// "HH:MM:SS" do `pg` → "HH:MM" (Pitfall 9).
function horaCurta(hora: string): string {
  return hora.slice(0, 5);
}

export type ChegadaMarcada = { chegada: string; jaEstavaMarcada: boolean };

// "Chegou" (AGE-13 — é isso que vira registro de uso). `exigirUsuario()` primeiro. UMA instrução
// condicionada: `estado = 'no_espaco'` e `chegada` só onde o estado ainda é `reservado`. Nenhuma linha
// afetada: o uso não existe mais (cancelado em outro celular) → a frase; ou JÁ começou (toque duplo,
// outro celular) → sucesso com a hora que já estava gravada, sem mudá-la (AGE-13 · idempotency).
export async function marcarChegada(entradaBruta: unknown): Promise<ResultadoDeAcao<ChegadaMarcada>> {
  await exigirUsuario();

  const resultado = esquemaMarcarChegada.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let marcada: ChegadaMarcada;
  try {
    const [linha] = await db
      .update(usosLivres)
      .set({ estado: "no_espaco", chegada: dados.chegada })
      .where(and(eq(usosLivres.id, dados.usoLivreId), eq(usosLivres.estado, "reservado")))
      .returning({ chegada: usosLivres.chegada });
    if (linha?.chegada) {
      marcada = { chegada: horaCurta(linha.chegada), jaEstavaMarcada: false };
    } else {
      const atual = await estadoAtualDoUso(dados.usoLivreId);
      if (!atual || atual.chegada === null) {
        return { ok: false, erro: FRASE_LANCAMENTO_NAO_EXISTE };
      }
      // IN-04 da revisão A: encerrado em outro celular não é "chegada marcada" — a frase diz o que houve.
      if (atual.estado === "encerrado") {
        revalidarTelasDaAgenda({ publico: false });
        return { ok: false, erro: FRASE_USO_JA_ENCERRADO };
      }
      marcada = { chegada: horaCurta(atual.chegada), jaEstavaMarcada: true };
    }
  } catch (erro) {
    console.error(
      `Falha ao marcar a chegada (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR_CHEGADA };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: marcada };
}

// "Chegou às" corrigido com a pessoa no espaço (editável até encerrar — 05-UI-SPEC.md §"Rótulos").
// `exigirUsuario()` primeiro; a instrução só pega o uso `no_espaco`. Encerrado em outro celular → a
// frase do "já encerrado"; ainda reservado → "marque “Chegou” primeiro".
export async function corrigirChegada(entradaBruta: unknown): Promise<ResultadoDeAcao<{ chegada: string }>> {
  await exigirUsuario();

  const resultado = esquemaCorrigirChegada.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .update(usosLivres)
      .set({ chegada: dados.chegada })
      .where(and(eq(usosLivres.id, dados.usoLivreId), eq(usosLivres.estado, "no_espaco")))
      .returning({ chegada: usosLivres.chegada });
    if (!linha?.chegada) {
      const atual = await estadoAtualDoUso(dados.usoLivreId);
      return {
        ok: false,
        erro:
          atual === null
            ? FRASE_LANCAMENTO_NAO_EXISTE
            : atual.estado === "encerrado"
              ? FRASE_USO_JA_ENCERRADO
              : FRASE_USO_AINDA_NAO_COMECOU,
      };
    }
    revalidarTelasDaAgenda({ publico: false });
    return { ok: true, dados: { chegada: horaCurta(linha.chegada) } };
  } catch (erro) {
    console.error(
      `Falha ao corrigir a chegada (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CORRIGIR_CHEGADA };
  }
}

// "Cancelar reserva" (AGE-05), depois da confirmação. `exigirUsuario()` primeiro. Só a reserva NÃO
// INICIADA sai, e o estado é conferido NA PRÓPRIA instrução de `delete` (T-05-43): se outro gestor
// marcou "Chegou" um instante antes, nada é apagado e a frase diz que ela já começou. Nenhuma linha e
// o uso não existe → "Isso já tinha sido removido." (idempotente). Uso com baixa no Estoque (a chave
// estrangeira `movimentacoes_estoque.uso_livre_id`, 23503 em `erro.cause.code`) → a frase humana — a
// última defesa (AGE-20). Uso no espaço ou encerrado nunca se apaga.
export async function cancelarReserva(entradaBruta: unknown): Promise<ResultadoDeAcao<{ data: string }>> {
  await exigirUsuario();

  const resultado = esquemaCancelarReserva.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_JA_REMOVIDO };
  }
  const { usoLivreId } = resultado.data;

  let removido: { data: string } | undefined;
  try {
    [removido] = await db
      .delete(usosLivres)
      .where(and(eq(usosLivres.id, usoLivreId), eq(usosLivres.estado, "reservado")))
      .returning({ data: usosLivres.data });
    if (!removido) {
      const atual = await estadoAtualDoUso(usoLivreId);
      return { ok: false, erro: atual === null ? FRASE_JA_REMOVIDO : FRASE_RESERVA_JA_COMECOU };
    }
  } catch (erro) {
    if (codigoDoErroPostgres(erro) === "23503") {
      return { ok: false, erro: FRASE_USO_COM_MATERIAL_BAIXADO };
    }
    console.error(
      `Falha ao cancelar a reserva (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CANCELAR_RESERVA };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: removido };
}

export type UsoEncerrado = {
  horasCheias: number;
  valorCentavos: number;
  precoHoraCentavos: number;
  // Plano 10: Σ do material cobrado (já dentro do valor) e quantas linhas saíram do Estoque.
  materialCobradoCentavos: number;
  materiaisBaixados: number;
};

// "Encerrar e cobrar" (AGE-13, AGE-14, AGE-17). `exigirUsuario()` primeiro (T-05-41, T-05-46); Zod
// ("HH:MM", saída depois da chegada). NUMA transação, sob a trava do USO (`travarUsoLivre`, `for no key
// update` — T-05-44, T-05-48: dois gestores encerrando o mesmo uso se serializam aqui e o segundo lê
// `encerrado`, então as saídas do material nunca são gravadas duas vezes):
// - o uso tem de estar `no_espaco` — encerrado → "Este uso livre já foi encerrado…" (a tela atualiza);
// - o preço da hora é lido AGORA, pela CHAVE do item "Uso livre (hora)" (`obterItensDoSistema(tx)` —
//   D-04, D-17), e sem preço nada é cobrado com valor inventado: a frase diz onde cadastrar;
// - `horas_cheias = teto(minutos ÷ 60)` pelo módulo puro;
// - o MATERIAL (plano 10, D-06/D-14): as linhas do uso são lidas sob a mesma trava e
//   `baixarMaterialDoUso` grava UMA saída por linha — cobrada ou inclusa — pela porta única do livro
//   (ordem USO LIVRE → ITENS), congela o preço de venda de agora no cobrado e devolve o valor dele;
// - `valor = horas cheias × pessoas × preço da hora + Σ material cobrado` (pessoas multiplica UMA vez),
//   e o preço da hora fica CONGELADO em `preco_hora_centavos` (T-05-42);
// - o `update` ainda confere `estado = 'no_espaco'` na própria instrução, e cada linha de material
//   ganha a sua `movimentacao_id` (única — uma linha vira no máximo uma saída).
// Se qualquer passo falhar, NADA é gravado — nem o encerramento, nem a baixa.
export async function encerrarUsoLivre(entradaBruta: unknown): Promise<ResultadoDoLancamento<UsoEncerrado>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaEncerrarUsoLivre.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let encerrado: UsoEncerrado;
  try {
    encerrado = await db.transaction(async (tx): Promise<UsoEncerrado> => {
      const uso = await travarUsoLivre(tx, dados.usoLivreId);
      if (!uso) {
        throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
      }
      if (proximoEstado(uso.estado, "encerrar") === null) {
        throw new RecusaDaAgenda(uso.estado === "encerrado" ? FRASE_USO_JA_ENCERRADO : FRASE_USO_AINDA_NAO_COMECOU);
      }
      const precoHoraCentavos = (await obterItensDoSistema(tx)).usoLivreHora.precoVendaCentavos;
      if (precoHoraCentavos === null) {
        throw new RecusaDaAgenda(FRASE_SEM_PRECO_DA_HORA);
      }
      let horas: number;
      try {
        horas = horasCheias(dados.chegada, dados.saida);
      } catch {
        throw new RecusaDaAgenda(FRASE_SAIDA_ANTES_DA_CHEGADA);
      }

      // O material, sob a trava do uso (acrescentar, mudar a cobrança e tirar travam o mesmo uso).
      const materiais = await tx
        .select({
          id: usosLivresMaterial.id,
          itemId: usosLivresMaterial.itemId,
          quantidadeMilesimos: usosLivresMaterial.quantidadeMilesimos,
          cobrar: usosLivresMaterial.cobrar,
        })
        .from(usosLivresMaterial)
        .where(and(eq(usosLivresMaterial.usoLivreId, uso.id), isNull(usosLivresMaterial.movimentacaoId)))
        .orderBy(asc(usosLivresMaterial.criadoEm), asc(usosLivresMaterial.id));
      let baixados: MaterialBaixado[] = [];
      if (materiais.length > 0) {
        const [pessoa] = await tx
          .select({ nome: clientes.nome })
          .from(clientes)
          .where(eq(clientes.id, uso.clienteId));
        baixados = await baixarMaterialDoUso(
          tx,
          { id: uso.id, data: uso.data, nome: pessoa?.nome ?? "" },
          materiais,
          usuario.id,
        );
      }
      const materialCobradoCentavos = baixados.reduce((soma, linha) => soma + (linha.valorCentavos ?? 0), 0);

      const valorCentavos = valorDoUsoLivre({
        horas,
        pessoas: uso.pessoas,
        precoHoraCentavos,
        materialCobradoCentavos,
      });
      const [gravado] = await tx
        .update(usosLivres)
        .set({
          estado: "encerrado",
          chegada: dados.chegada,
          saida: dados.saida,
          horasCheias: horas,
          precoHoraCentavos,
          valorCentavos,
        })
        .where(and(eq(usosLivres.id, uso.id), eq(usosLivres.estado, "no_espaco")))
        .returning({ id: usosLivres.id });
      if (!gravado) {
        throw new RecusaDaAgenda(FRASE_USO_JA_ENCERRADO);
      }
      for (const linha of baixados) {
        const [ligada] = await tx
          .update(usosLivresMaterial)
          .set({
            movimentacaoId: linha.movimentacaoId,
            precoUnitarioCentavos: linha.precoUnitarioCentavos,
            valorCentavos: linha.valorCentavos,
            atualizadoEm: new Date(),
          })
          .where(and(eq(usosLivresMaterial.id, linha.id), isNull(usosLivresMaterial.movimentacaoId)))
          .returning({ id: usosLivresMaterial.id });
        if (!ligada) {
          // Impossível sob a trava do uso; se acontecer, a transação inteira volta (nada baixado).
          throw new Error(`encerrarUsoLivre: a linha de material ${linha.id} não pôde ser ligada à baixa.`);
        }
      }
      return {
        horasCheias: horas,
        valorCentavos,
        precoHoraCentavos,
        materialCobradoCentavos,
        materiaisBaixados: baixados.length,
      };
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      // O estado mudou em outro celular (ou faltava o preço, ou um material mudou no Estoque): a tela
      // relê o servidor.
      revalidarTelasDaAgenda({ publico: false });
      return erro.frase === FRASE_SAIDA_ANTES_DA_CHEGADA
        ? { ok: false, erro: erro.frase, campos: { saida: erro.frase } }
        : { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao encerrar o uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_ENCERRAR };
  }

  revalidarTelasDaAgenda({ publico: false });
  if (encerrado.materiaisBaixados > 0) {
    revalidatePath(rotaDeGestao("/estoque"));
  }
  return { ok: true, dados: encerrado };
}

// ── O material do uso livre (plano 10 — AGE-14, D-06, D-14) ─────────────────────────────────────────
// As três ações só REGISTRAM a lista: nada sai do Estoque antes de encerrar. Todas travam o USO
// (`for no key update`) e só mexem num uso `no_espaco` — a mesma trava do encerramento, então nenhuma
// linha muda nem some enquanto a baixa está sendo gravada (T-05-48).

// Trava o uso e recusa o que não está mais (ou ainda não está) no espaço.
async function travarUsoNoEspaco(tx: TransacaoDoBanco, usoLivreId: string): Promise<void> {
  const uso = await travarUsoLivre(tx, usoLivreId);
  if (!uso) {
    throw new RecusaDaAgenda(FRASE_LANCAMENTO_NAO_EXISTE);
  }
  if (uso.estado !== "no_espaco") {
    throw new RecusaDaAgenda(uso.estado === "encerrado" ? FRASE_USO_JA_ENCERRADO : FRASE_USO_AINDA_NAO_COMECOU);
  }
}

// O item de estoque da linha, conferido: existe com estoque próprio, está ativo e — para cobrar — tem
// preço de venda (D-14). Lido sem trava: aqui só a LISTA muda; o encerramento confere tudo de novo sob a
// trava dos itens.
async function conferirItemDoMaterial(tx: TransacaoDoBanco, itemId: string, cobrar: boolean): Promise<void> {
  const [item] = await tx
    .select({
      nome: itensCatalogo.nome,
      ativo: itensCatalogo.ativo,
      controlaEstoque: itensCatalogo.controlaEstoque,
      unidade: itensCatalogo.unidade,
      precoVendaCentavos: itensCatalogo.precoVendaCentavos,
    })
    .from(itensCatalogo)
    .where(eq(itensCatalogo.id, itemId));
  if (!item || !item.controlaEstoque || item.unidade === null) {
    throw new RecusaDaAgenda(FRASE_MATERIAL_NAO_EXISTE_MAIS);
  }
  if (!item.ativo) {
    throw new RecusaDaAgenda(fraseMaterialDesativadoNoUso(item.nome));
  }
  if (cobrar && item.precoVendaCentavos === null) {
    throw new RecusaDaAgenda(FRASE_MATERIAL_SEM_PRECO);
  }
}

// O campo onde cada recusa do material mora na tela (embaixo do campo; o resto, no topo do bloco).
function campoDaRecusaDoMaterial(frase: string): Record<string, string> | undefined {
  if (frase === FRASE_MATERIAL_SEM_PRECO) {
    return { cobrar: frase };
  }
  if (frase === FRASE_MATERIAL_NAO_EXISTE_MAIS || frase.endsWith(SUFIXO_MATERIAL_DESATIVADO)) {
    return { itemId: frase };
  }
  return undefined;
}

// "+ Material" (AGE-14): uma linha nova no "Material usado" — o mesmo item em duas linhas é permitido e
// vira duas saídas ao encerrar. Do cliente chegam o uso, o item, o TEXTO da quantidade e se cobra;
// preço, valor e custo nunca (T-05-47).
export async function acrescentarMaterial(entradaBruta: unknown): Promise<ResultadoDoLancamento<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAcrescentarMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return {
      ok: false,
      erro: primeiraMensagemDeErro(resultado),
      campos: errosPorCampo(resultado.error.issues),
    };
  }
  const dados = resultado.data;

  let criado: { id: string };
  try {
    criado = await db.transaction(async (tx) => {
      await travarUsoNoEspaco(tx, dados.usoLivreId);
      await conferirItemDoMaterial(tx, dados.itemId, dados.cobrar);
      const [linha] = await tx
        .insert(usosLivresMaterial)
        .values({
          usoLivreId: dados.usoLivreId,
          itemId: dados.itemId,
          quantidadeMilesimos: dados.quantidade,
          cobrar: dados.cobrar,
        })
        .returning({ id: usosLivresMaterial.id });
      if (!linha) {
        throw new Error("acrescentarMaterial: a linha inserida não voltou.");
      }
      return linha;
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      const campos = campoDaRecusaDoMaterial(erro.frase);
      return campos ? { ok: false, erro: erro.frase, campos } : { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao acrescentar material ao uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_ACRESCENTAR_MATERIAL };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: criado };
}

// "Cobrar · Incluso" numa linha já acrescentada (D-14): grava o estado DESEJADO, sem toast — toque duplo
// e dois celulares convergem. "Cobrar" só com preço de venda, como ao acrescentar.
export async function definirCobrancaDoMaterial(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ cobrar: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaDefinirCobrancaDoMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ usoLivreId: usosLivresMaterial.usoLivreId, itemId: usosLivresMaterial.itemId })
        .from(usosLivresMaterial)
        .where(eq(usosLivresMaterial.id, dados.materialId));
      if (!linha) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
      await travarUsoNoEspaco(tx, linha.usoLivreId);
      if (dados.cobrar) {
        await conferirItemDoMaterial(tx, linha.itemId, true);
      }
      const [gravada] = await tx
        .update(usosLivresMaterial)
        .set({ cobrar: dados.cobrar, atualizadoEm: new Date() })
        .where(and(eq(usosLivresMaterial.id, dados.materialId), isNull(usosLivresMaterial.movimentacaoId)))
        .returning({ id: usosLivresMaterial.id });
      if (!gravada) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao mudar a cobrança do material (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_MUDAR_COBRANCA };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: { cobrar: dados.cobrar } };
}

// "Tirar o material" (só antes de encerrar — AGE-20): apaga a linha SEM baixa de um uso `no_espaco`,
// condição conferida na própria instrução (`movimentacao_id is null`) sob a trava do uso. A linha já
// baixada nunca se apaga — a movimentação do livro é para sempre (a FK sem `on delete` e o `unique`
// também a protegem), e a Agenda nunca estorna nem apaga uma movimentação de estoque.
export async function tirarMaterial(entradaBruta: unknown): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaTirarMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ usoLivreId: usosLivresMaterial.usoLivreId })
        .from(usosLivresMaterial)
        .where(eq(usosLivresMaterial.id, dados.materialId));
      if (!linha) {
        throw new RecusaDaAgenda(FRASE_JA_REMOVIDO);
      }
      await travarUsoNoEspaco(tx, linha.usoLivreId);
      const [apagada] = await tx
        .delete(usosLivresMaterial)
        .where(
          and(
            eq(usosLivresMaterial.id, dados.materialId),
            eq(usosLivresMaterial.usoLivreId, linha.usoLivreId),
            isNull(usosLivresMaterial.movimentacaoId),
          ),
        )
        .returning({ id: usosLivresMaterial.id });
      if (!apagada) {
        throw new RecusaDaAgenda(FRASE_USO_JA_ENCERRADO);
      }
    });
  } catch (erro) {
    if (erro instanceof RecusaDaAgenda) {
      revalidarTelasDaAgenda({ publico: false });
      return { ok: false, erro: erro.frase };
    }
    console.error(
      `Falha ao tirar o material do uso livre (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_TIRAR_MATERIAL };
  }

  revalidarTelasDaAgenda({ publico: false });
  return { ok: true, dados: { id: dados.materialId } };
}

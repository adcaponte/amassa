"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { encomendaEtapas, encomendaItens, encomendas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { calcularCronograma } from "./cronograma";
import {
  esquemaAjusteDeEtapa,
  esquemaEncomenda,
  esquemaEtapas,
  esquemaId,
  esquemaItem,
  esquemaReordenacao,
} from "./esquemas";

// A primeira escrita de produto do sistema. `db.transaction` cobre as três tabelas — meia
// encomenda gravada é pior que nenhuma (T-03-04). `esquemaEncomenda` (lib/encomendas/esquemas.ts)
// é o ponto único de validação que D-15 exige: o ajuste rápido do plano 03 importa de lá, nunca
// reimplementa a regra.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Entrada de objeto tipado (não `FormData`) — o mesmo formato das outras seis ações desta fase
// (D-15/03-03). Até o plano 06, `formulario-encomenda.tsx` era Server Component com
// `<form action={criarEncomenda.bind(null, null)}>`, no formato que `useActionState` exige; a
// partir do plano 06 o formulário é Client Component com `react-hook-form`, chama esta ação
// direto de um `onSubmit` e lê o retorno com `await` comum — o formato de dois argumentos
// deixou de fazer falta. As 6 etapas agora chegam sempre do formulário (Tarefa 3 do plano 06),
// nunca mais de um padrão calculado aqui dentro.
export async function criarEncomenda(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  // PRIMEIRA instrução do corpo — regra do CLAUDE.md, verificada por `npm run verificar-acoes`
  // (T-03-01).
  const usuarioAtual = await exigirUsuario();

  const resultado = esquemaEncomenda.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let idDaEncomenda: string;

  try {
    idDaEncomenda = await db.transaction(async (tx) => {
      const [linhaEncomenda] = await tx
        .insert(encomendas)
        .values({
          nome: dados.nome,
          clienteNome: dados.clienteNome ?? null,
          dataInicio: dados.dataInicio,
          criadoPor: usuarioAtual.id,
        })
        .returning({ id: encomendas.id });

      await tx.insert(encomendaItens).values(
        dados.itens.map((item, indice) => ({
          encomendaId: linhaEncomenda.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          ordem: indice,
        })),
      );

      await tx.insert(encomendaEtapas).values(
        dados.etapas.map((etapa, indice) => ({
          encomendaId: linhaEncomenda.id,
          etapa: etapa.etapa,
          dias: etapa.dias,
          ordem: indice,
        })),
      );

      return linhaEncomenda.id;
    });
  } catch (erro) {
    // Erro de banco (restrição violada, conexão perdida, etc.) — nunca engolido, mesmo
    // estreitamento por instanceof do estilo de `lib/auth/acoes.ts`: registrado e devolvido como
    // `{ ok: false }` para o cliente mostrar o banner de falha (03-UI-SPEC.md "Formulário —
    // Erro") — o formulário continua aberto e o que foi digitado não se perde.
    console.error("Falha ao gravar encomenda:", erro);
    return { ok: false, erro: "Não deu para salvar. Verifique a internet e tente de novo." };
  }

  revalidatePath("/encomendas");
  return { ok: true, dados: { id: idDaEncomenda } };
}

// Erro de controle interno: aborta uma transação quando a linha alvo já não existe (outra
// pessoa excluiu ou o `id` nunca existiu) — nunca escapa deste arquivo, sempre traduzido para
// `{ ok: false, erro }` humano antes de sair de qualquer ação (T-03-17).
class EncomendaNaoEncontrada extends Error {}

const MENSAGEM_ENCOMENDA_NAO_EXISTE =
  "Essa encomenda não existe mais. Talvez alguém tenha excluído.";

// `id` opcional: presente para um item que já existe no banco (edição), ausente para um item
// novo — é o que `atualizarEncomenda` usa para reconciliar em vez de apagar e recriar tudo a
// cada salvamento. Estende `esquemaItem` (nunca reimplementa `descricao`/`quantidade`).
const esquemaItemComId = esquemaItem.extend({ id: esquemaId.optional() });

// Estende `esquemaEncomenda` (D-15: mesmo esquema, mesmas regras de nome/cliente/data/etapas) só
// acrescentando `id` da encomenda alvo e trocando `itens` pela variante com `id` opcional acima.
const esquemaAtualizacaoDeEncomenda = esquemaEncomenda.extend({
  id: esquemaId,
  itens: z
    .array(esquemaItemComId)
    .min(1, "A encomenda precisa de ao menos 1 item.")
    .max(50, "No máximo 50 itens por encomenda."),
});

// Segunda escrita transacional do projeto: atualiza a encomenda, reconcilia os itens (apaga o
// que sumiu, insere o que é novo, atualiza o que ficou, renumerando `ordem` para 0..n-1 sem
// buraco — ENC-05/ordering) e grava os `dias` das 6 etapas, tudo dentro de UMA transação —
// nenhuma escrita parcial (T-03-04). Passa por `esquemaEncomenda`/`esquemaEtapas` (via
// `esquemaAtualizacaoDeEncomenda`), o mesmo esquema que `criarEncomenda` e, no plano 03,
// `ajustarEtapaEncomenda` usam — D-15 estruturado, não comentado.
export async function atualizarEncomenda(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  // PRIMEIRA instrução do corpo — regra de CLAUDE.md, verificada por `npm run verificar-acoes`.
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDeEncomenda.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [linhaAtualizada] = await tx
        .update(encomendas)
        .set({
          nome: dados.nome,
          clienteNome: dados.clienteNome,
          dataInicio: dados.dataInicio,
        })
        .where(eq(encomendas.id, dados.id))
        .returning({ id: encomendas.id });

      if (!linhaAtualizada) {
        // Lançar aqui reverte a transação inteira — nenhuma escrita parcial numa encomenda
        // que não existe mais.
        throw new EncomendaNaoEncontrada();
      }

      const itensExistentes = await tx
        .select({ id: encomendaItens.id })
        .from(encomendaItens)
        .where(eq(encomendaItens.encomendaId, dados.id));

      const idsExistentes = new Set(itensExistentes.map((item) => item.id));
      const idsQueFicam = new Set(dados.itens.flatMap((item) => (item.id ? [item.id] : [])));
      const idsParaApagar = [...idsExistentes].filter((id) => !idsQueFicam.has(id));

      if (idsParaApagar.length > 0) {
        await tx.delete(encomendaItens).where(inArray(encomendaItens.id, idsParaApagar));
      }

      // `indice` vira a nova `ordem` de cada item, na sequência em que chegaram — a mesma
      // sequência que `reordenarItemEncomenda` (plano 03, Tarefa 3) já deixou correta antes de
      // "Salvar" ser tocado. 0..n-1 sem buraco, sempre.
      for (const [indice, item] of dados.itens.entries()) {
        if (item.id && idsExistentes.has(item.id)) {
          await tx
            .update(encomendaItens)
            .set({ descricao: item.descricao, quantidade: item.quantidade, ordem: indice })
            .where(eq(encomendaItens.id, item.id));
        } else {
          await tx.insert(encomendaItens).values({
            encomendaId: dados.id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            ordem: indice,
          });
        }
      }

      for (const etapa of dados.etapas) {
        await tx
          .update(encomendaEtapas)
          .set({ dias: etapa.dias })
          .where(
            and(
              eq(encomendaEtapas.encomendaId, dados.id),
              eq(encomendaEtapas.etapa, etapa.etapa),
            ),
          );
      }
    });
  } catch (erro) {
    if (erro instanceof EncomendaNaoEncontrada) {
      return { ok: false, erro: MENSAGEM_ENCOMENDA_NAO_EXISTE };
    }
    console.error("Falha ao atualizar encomenda:", erro);
    throw erro;
  }

  revalidatePath("/encomendas");
  revalidatePath("/encomendas/[id]", "page");
  return { ok: true, dados: { id: dados.id } };
}

// Cliente desistiu → `cancelada` (D-08): sai do Gantt, vai para o histórico, continua
// consultável — nunca reaberta nesta fase (03-UI-SPEC.md "Cancelar vs. Excluir"). Idempotente
// por construção: um `update` que já está em `cancelada` só grava o mesmo valor de novo.
export async function cancelarEncomenda(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ nome: string }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

  const [linha] = await db
    .update(encomendas)
    .set({ status: "cancelada" })
    .where(eq(encomendas.id, resultado.data))
    .returning({ nome: encomendas.nome });

  if (!linha) {
    return { ok: false, erro: MENSAGEM_ENCOMENDA_NAO_EXISTE };
  }

  revalidatePath("/encomendas");
  revalidatePath("/encomendas/[id]", "page");
  return { ok: true, dados: { nome: linha.nome } };
}

// `concluida` só muda por aqui, só quando chamada — nunca deduzida de `hoje > dataDeConclusao`
// (D-05, proibição do plano). Devolve a data de conclusão prevista para a interface avisar
// quando ela ainda não chegou (03-UI-SPEC.md "Aviso ao concluir antes da data prevista"),
// calculada por `calcularCronograma` sobre as 6 etapas já gravadas — nenhum novo cálculo aqui.
export async function concluirEncomenda(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ nome: string; dataDeConclusao: string | null }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const id = resultado.data;

  const [linha] = await db
    .update(encomendas)
    .set({ status: "concluida" })
    .where(eq(encomendas.id, id))
    .returning({ nome: encomendas.nome, dataInicio: encomendas.dataInicio });

  if (!linha) {
    return { ok: false, erro: MENSAGEM_ENCOMENDA_NAO_EXISTE };
  }

  const etapasDaEncomenda = await db
    .select({ etapa: encomendaEtapas.etapa, dias: encomendaEtapas.dias })
    .from(encomendaEtapas)
    .where(eq(encomendaEtapas.encomendaId, id));

  const cronograma = calcularCronograma(linha.dataInicio, etapasDaEncomenda);

  revalidatePath("/encomendas");
  revalidatePath("/encomendas/[id]", "page");
  return { ok: true, dados: { nome: linha.nome, dataDeConclusao: cronograma.dataDeConclusao } };
}

// Excluir é para engano — "criei duplicado", "digitei tudo errado" (D-08). A contagem de itens
// vem do banco DENTRO da mesma transação que apaga, nunca de um `props` do cliente que pode
// estar velho entre abrir o diálogo e confirmar (D-09) — é o texto que
// `confirmar-excluir.tsx` (plano 05) vai nomear antes do usuário confirmar.
export async function excluirEncomenda(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ nome: string; itensApagados: number }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const id = resultado.data;

  try {
    const dadosDeExclusao = await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ nome: encomendas.nome })
        .from(encomendas)
        .where(eq(encomendas.id, id))
        .limit(1);

      if (!linha) {
        throw new EncomendaNaoEncontrada();
      }

      const itensDaEncomenda = await tx
        .select({ id: encomendaItens.id })
        .from(encomendaItens)
        .where(eq(encomendaItens.encomendaId, id));

      // `on delete cascade` do schema leva itens e etapas junto — a contagem precisa ser lida
      // ANTES desse delete, não recalculada depois (não haveria mais o que contar).
      await tx.delete(encomendas).where(eq(encomendas.id, id));

      return { nome: linha.nome, itensApagados: itensDaEncomenda.length };
    });

    revalidatePath("/encomendas");
    revalidatePath("/encomendas/[id]", "page");
    return { ok: true, dados: dadosDeExclusao };
  } catch (erro) {
    if (erro instanceof EncomendaNaoEncontrada) {
      return { ok: false, erro: MENSAGEM_ENCOMENDA_NAO_EXISTE };
    }
    console.error("Falha ao excluir encomenda:", erro);
    throw erro;
  }
}

const MENSAGEM_ITEM_NAO_EXISTE = "Esse item não existe mais. Talvez alguém tenha excluído.";

// Segundo caminho de escrita de duração (D-15/PD-02) — implementa a corrida resolvida no
// servidor: nenhum valor absoluto vem do cliente, só um delta relativo ou um interruptor.
// `select … for update` dentro da transação trava as 6 linhas; o novo valor nasce do que a
// trava acabou de ler, nunca do número que estava na tela (T-03-15). O array resultante passa
// pelo MESMO `esquemaEtapas` de `criarEncomenda`/`atualizarEncomenda` — se a regra de marco
// mudar um dia, os dois caminhos mudam juntos (D-15).
export async function ajustarEtapaEncomenda(entradaBruta: unknown): Promise<
  ResultadoDeAcao<{ dias: number; duracaoTotalEmDias: number; dataDeConclusao: string | null }>
> {
  await exigirUsuario();

  const resultado = esquemaAjusteDeEtapa.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const entrada = resultado.data;

  try {
    const resposta = await db.transaction(async (tx) => {
      const [linhaDeEncomenda] = await tx
        .select({ dataInicio: encomendas.dataInicio })
        .from(encomendas)
        .where(eq(encomendas.id, entrada.encomendaId))
        .limit(1);

      if (!linhaDeEncomenda) {
        throw new EncomendaNaoEncontrada();
      }

      // "for update" trava as 6 linhas — é a serialização que impede duas chamadas
      // simultâneas na mesma etapa de se perderem uma na outra (PD-02, T-03-15).
      const etapasAtuais = await tx
        .select({
          id: encomendaEtapas.id,
          etapa: encomendaEtapas.etapa,
          dias: encomendaEtapas.dias,
        })
        .from(encomendaEtapas)
        .where(eq(encomendaEtapas.encomendaId, entrada.encomendaId))
        .for("update");

      const etapaAlvo = etapasAtuais.find((etapa) => etapa.etapa === entrada.etapa);
      if (!etapaAlvo) {
        throw new EncomendaNaoEncontrada();
      }

      // O novo valor nasce do que a trava acabou de ler, nunca de um número vindo do cliente —
      // é isso que transforma "a última escrita ganha" em "as duas escritas somam".
      const novoValor =
        "delta" in entrada ? Math.max(0, etapaAlvo.dias + entrada.delta) : entrada.ligado ? 1 : 0;

      const etapasComNovoValor = etapasAtuais.map((etapa) => ({
        etapa: etapa.etapa,
        dias: etapa.etapa === entrada.etapa ? novoValor : etapa.dias,
      }));

      const validacao = esquemaEtapas.safeParse(etapasComNovoValor);
      if (!validacao.success) {
        throw new Error(primeiraMensagemDeErro(validacao));
      }

      await tx
        .update(encomendaEtapas)
        .set({ dias: novoValor })
        .where(eq(encomendaEtapas.id, etapaAlvo.id));

      // Cálculo DEPOIS da escrita confirmada, nunca antes — o rodapé da trilha só recalcula
      // quando a resposta confirmar (03-UI-SPEC.md "Comportamento de salvamento — não é
      // otimista").
      const cronograma = calcularCronograma(linhaDeEncomenda.dataInicio, validacao.data);

      return {
        dias: novoValor,
        duracaoTotalEmDias: cronograma.duracaoTotalEmDias,
        dataDeConclusao: cronograma.dataDeConclusao,
      };
    });

    revalidatePath("/encomendas");
    revalidatePath("/encomendas/[id]", "page");
    return { ok: true, dados: resposta };
  } catch (erro) {
    if (erro instanceof EncomendaNaoEncontrada) {
      return { ok: false, erro: MENSAGEM_ENCOMENDA_NAO_EXISTE };
    }
    console.error("Falha ao ajustar etapa:", erro);
    throw erro;
  }
}

// Reordenação por setas (D-16) — nunca arrastar-e-soltar. Mesma disciplina de trava de
// `ajustarEtapaEncomenda`: "for update" nas linhas da encomenda antes de trocar `ordem`, para
// duas reordenações quase simultâneas na mesma encomenda serializarem em vez de se atropelarem.
export async function reordenarItemEncomenda(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<null>> {
  await exigirUsuario();

  const resultado = esquemaReordenacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const entrada = resultado.data;

  try {
    await db.transaction(async (tx) => {
      const [itemAlvo] = await tx
        .select({ id: encomendaItens.id, encomendaId: encomendaItens.encomendaId })
        .from(encomendaItens)
        .where(eq(encomendaItens.id, entrada.itemId))
        .limit(1);

      if (!itemAlvo) {
        throw new EncomendaNaoEncontrada();
      }

      // "for update" nas linhas da encomenda inteira, não só no item alvo — a troca de
      // `ordem` toca o vizinho também.
      const itensDaEncomenda = await tx
        .select({ id: encomendaItens.id, ordem: encomendaItens.ordem })
        .from(encomendaItens)
        .where(eq(encomendaItens.encomendaId, itemAlvo.encomendaId))
        .orderBy(asc(encomendaItens.ordem))
        .for("update");

      const indiceAlvo = itensDaEncomenda.findIndex((item) => item.id === entrada.itemId);
      const indiceVizinho = entrada.direcao === "cima" ? indiceAlvo - 1 : indiceAlvo + 1;

      if (indiceVizinho < 0 || indiceVizinho >= itensDaEncomenda.length) {
        // Sem vizinho na direção pedida — a interface já desabilita a seta; chegando assim
        // mesmo, não escreve nada e não erra (um clique inofensivo não vira aviso de falha).
        return;
      }

      const listaReordenada = [...itensDaEncomenda];
      const [itemMovido] = listaReordenada.splice(indiceAlvo, 1);
      listaReordenada.splice(indiceVizinho, 0, itemMovido);

      // Renumera TODOS para 0..n-1 — por segurança, não só os dois trocados (garante a
      // sequência sem buraco mesmo partindo de um estado já inconsistente).
      for (const [indice, item] of listaReordenada.entries()) {
        if (item.ordem !== indice) {
          await tx
            .update(encomendaItens)
            .set({ ordem: indice })
            .where(eq(encomendaItens.id, item.id));
        }
      }
    });
  } catch (erro) {
    if (erro instanceof EncomendaNaoEncontrada) {
      return { ok: false, erro: MENSAGEM_ITEM_NAO_EXISTE };
    }
    console.error("Falha ao reordenar item:", erro);
    throw erro;
  }

  revalidatePath("/encomendas");
  revalidatePath("/encomendas/[id]", "page");
  return { ok: true, dados: null };
}

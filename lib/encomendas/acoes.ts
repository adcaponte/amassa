"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { encomendaEtapas, encomendaItens, encomendas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

import { DIAS_PADRAO, calcularCronograma } from "./cronograma";
import { esquemaEncomenda, esquemaId, esquemaItem } from "./esquemas";

// A primeira escrita de produto do sistema. `db.transaction` cobre as três tabelas — meia
// encomenda gravada é pior que nenhuma (T-03-04). `esquemaEncomenda` (lib/encomendas/esquemas.ts)
// é o ponto único de validação que D-15 exige: o ajuste rápido do plano 03 importa de lá, nunca
// reimplementa a regra.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// Assinatura de dois argumentos (estado anterior + FormData) — o formato que `useActionState`
// exige, pronta para o dia em que o formulário precisar mostrar o erro sem recarregar a página
// (plano 06). Hoje `formulario-encomenda.tsx` chama via `criarEncomenda.bind(null, null)`, o
// que permite manter o componente um Server Component sem precisar do hook agora.
export async function criarEncomenda(
  _estadoAnterior: unknown,
  dadosDoFormulario: FormData,
): Promise<ResultadoDeAcao<{ id: string }>> {
  // PRIMEIRA instrução do corpo — sem nenhuma linha antes, nem para ler o FormData. Regra do
  // CLAUDE.md, verificada por `npm run verificar-acoes` (T-03-01).
  const usuarioAtual = await exigirUsuario();

  const clienteNomeBruto = dadosDoFormulario.get("clienteNome");

  // As 6 etapas não aparecem no formulário desta fatia (03-UI-SPEC.md "Formulário — Modal /
  // Folha": entram com os padrões pelo servidor; o plano 06 traz os campos). Construídas aqui,
  // na ordem fixa de `DIAS_PADRAO`, e validadas pelo mesmo `esquemaEncomenda` que o ajuste
  // rápido do plano 03 vai usar para as suas — nunca uma segunda cópia da regra.
  const etapasComPadrao = DIAS_PADRAO.map((duracao) => ({
    etapa: duracao.etapa,
    dias: duracao.dias,
  }));

  const resultado = esquemaEncomenda.safeParse({
    nome: dadosDoFormulario.get("nome"),
    clienteNome:
      typeof clienteNomeBruto === "string" && clienteNomeBruto.trim() !== ""
        ? clienteNomeBruto
        : undefined,
    dataInicio: dadosDoFormulario.get("dataInicio"),
    itens: [
      {
        descricao: dadosDoFormulario.get("itemDescricao"),
        quantidade: Number(dadosDoFormulario.get("itemQuantidade")),
      },
    ],
    etapas: etapasComPadrao,
  });

  if (!resultado.success) {
    return {
      ok: false,
      erro: resultado.error.issues[0]?.message ?? "Não deu para validar os dados do formulário.",
    };
  }

  const dados = resultado.data;

  try {
    await db.transaction(async (tx) => {
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
    });
  } catch (erro) {
    // Erro de banco (restrição violada, conexão perdida, etc.) — nunca engolido, mesmo
    // estreitamento por instanceof do estilo de `lib/auth/acoes.ts`: registrado e relançado
    // para o Next.js mostrar a tela de erro, não uma resposta silenciosa de "deu certo".
    console.error("Falha ao gravar encomenda:", erro);
    throw erro;
  }

  // Fora do `try`: `redirect()` lança um erro de controle de fluxo do próprio Next.js, que
  // precisaria continuar subindo — mantê-lo fora evita confundi-lo com um erro de banco.
  revalidatePath("/encomendas");
  redirect("/encomendas");
}

// Erro de controle interno: aborta uma transação quando a linha alvo já não existe (outra
// pessoa excluiu ou o `id` nunca existiu) — nunca escapa deste arquivo, sempre traduzido para
// `{ ok: false, erro }` humano antes de sair de qualquer ação (T-03-17).
class EncomendaNaoEncontrada extends Error {}

const MENSAGEM_ENCOMENDA_NAO_EXISTE =
  "Essa encomenda não existe mais. Talvez alguém tenha excluído.";

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

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

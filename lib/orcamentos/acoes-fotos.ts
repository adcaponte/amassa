"use server";

// Ações dos Orçamentos — as FOTOS de referência: anexar, legenda e remover (D-24/P10, plano 06.5-27 —
// saíram de `acoes.ts`, que agora é o índice).

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { orcamentoFotos } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { caminhoDaFoto, diretorioDeFotos } from "@/lib/orcamentos/caminho-fotos";
import { tratarFotoDeOrcamento, validarTipoRealDaFoto } from "@/lib/orcamentos/fotos";

import { esquemaAnexarFoto, esquemaLegendaDaFoto, esquemaRemoverFoto } from "./esquemas";
import { FRASE_FALHA_AO_ENVIAR_FOTO, FRASE_FALHA_AO_SALVAR } from "./textos";

import {
  FotoNaoEncontrada,
  LimiteDeFotosAtingido,
  primeiraMensagemDeErro,
  primeiroErroConhecido,
  type ResultadoDeAcao,
} from "./acoes-comum";
import { travarOrcamentoRascunho } from "./acoes-servidor";

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

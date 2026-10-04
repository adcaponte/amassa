"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { fornos, manutencoes, queimas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres, ehViolacaoDeChaveEstrangeira } from "@/lib/erro/postgres";

import {
  esquemaApagarContagem,
  esquemaAtualizacaoDeForno,
  esquemaContagem,
  esquemaForno,
  esquemaId,
  esquemaManutencao,
  esquemaQueima,
} from "./esquemas";
import { totalDaContagem } from "./contagem";
import { apagarContagemNaTransacao, gravarContagem, RecusaDasQueimas } from "./gravacao";
import {
  FRASE_FALHA_AO_APAGAR_CONTAGEM,
  FRASE_FALHA_AO_REGISTRAR_QUEIMA,
  FRASE_FALHA_AO_SALVAR_CONTAGEM,
  FRASE_QUEIMA_DESFEITA_NADA_CONTADO,
} from "./textos";

// Mesma forma de `lib/encomendas/acoes.ts` (D-15) — cada módulo redeclara hoje, não há local
// compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// Detector de SQLSTATE 23503 (foreign_key_violation) vive em `@/lib/erro/postgres`.

// D-02: único caminho de criação de forno — o botão "Novo forno" do estado vazio/índice, sem
// tela de cadastro dedicada. `exigirUsuario()` é a PRIMEIRA instrução do corpo (T-04-01,
// verificado por `npm run verificar-acoes`, decidido por árvore sintática, nunca por regex).
// Sem transação: é uma inserção de uma linha só.
export async function criarForno(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaForno.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(fornos)
      .values({
        nome: dados.nome,
        descricao: dados.descricao,
        limite: dados.limite,
      })
      .returning({ id: fornos.id });

    revalidatePath("/gestao/queimas");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    // Erro de banco (restrição violada, conexão perdida etc.) nunca engolido — registrado e
    // devolvido como `{ ok: false }` para o formulário mostrar o banner de falha, permanecendo
    // aberto com os campos preenchidos (mesma forma de `criarEncomenda`).
    console.error("Falha ao gravar forno:", erro);
    return { ok: false, erro: "Não deu para salvar. Verifique a internet e tente de novo." };
  }
}

// D-04: a queima é gravada no INSTANTE do toque — "Desfazer" apaga a linha depois (nunca o
// inverso). `exigirUsuario()` é a PRIMEIRA instrução do corpo (T-04-01); `registradoPor` vem
// SEMPRE de `usuarioAtual.id`, nunca de `entradaBruta` (T-04-02) — `esquemaQueima` nem tem esse
// campo. Sem transação: uma inserção de uma linha só, `ocorridaEm` fica no `defaultNow()` do
// banco.
export async function registrarQueima(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; ocorridaEm: string }>> {
  const usuarioAtual = await exigirUsuario();

  const resultado = esquemaQueima.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .insert(queimas)
      .values({
        fornoId: dados.fornoId,
        tipo: dados.tipo,
        registradoPor: usuarioAtual.id,
      })
      .returning({ id: queimas.id, ocorridaEm: queimas.ocorridaEm });

    revalidatePath("/gestao/queimas");
    return { ok: true, dados: { id: linha.id, ocorridaEm: linha.ocorridaEm.toISOString() } };
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: "Esse forno não existe mais. Recarregue a página." };
    }
    console.error("Falha ao registrar queima:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_REGISTRAR_QUEIMA };
  }
}

// Única Server Action de exclusão de queima do sistema — o "Desfazer" do toast (sem confirmação,
// arrependimento de segundos atrás) e a exclusão confirmada do histórico (plano 04-03, com
// `AlertDialog`) chamam esta mesma ação; a diferença entre elas é só QUEM confirma
// (`02-MODELO-DE-DADOS.md` §3, "O que muda em relação ao protótipo"). Idempotente por
// construção: a segunda chamada sobre um `id` já apagado encontra zero linhas e devolve o erro
// humano, nunca lança.
export async function excluirQueima(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

  const [linha] = await db
    .delete(queimas)
    .where(eq(queimas.id, resultado.data))
    .returning({ id: queimas.id });

  if (!linha) {
    return { ok: false, erro: "Essa queima não existe mais." };
  }

  // `/queimas/[id]` também revalida (04-PATTERNS.md, "revalidatePath after every write") — a
  // exclusão confirmada do histórico (plano 04-03) acontece nesta rota e permanece nela depois
  // do sucesso, sem navegar; o "Desfazer" do toast (plano 04-01) continua em `/queimas`, coberto
  // pela primeira chamada.
  revalidatePath("/gestao/queimas");
  revalidatePath("/gestao/queimas/[id]", "page");
  return { ok: true, dados: { id: linha.id } };
}

// Erro de controle interno: aborta a transação de `registrarManutencao` quando o forno já não
// existe (outra pessoa desativou/apagou manualmente no banco entre a tela abrir e o toque) —
// nunca escapa deste arquivo, sempre traduzido para `{ ok: false, erro }` humano (mesmo molde de
// `EncomendaNaoEncontrada`, `lib/encomendas/acoes.ts`).
class FornoNaoEncontrado extends Error {}

const MENSAGEM_FORNO_NAO_EXISTE = "Esse forno não existe mais. Recarregue a página.";

// D-02: editar nome/descrição/limite acontece na página do próprio forno, com o mesmo esquema
// que `criarForno` usa (`esquemaAtualizacaoDeForno` estende `esquemaForno`, nunca reimplementa a
// regra — T-04-04). Sem transação: um `update` de uma linha só.
export async function atualizarForno(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaAtualizacaoDeForno.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const [linha] = await db
      .update(fornos)
      .set({ nome: dados.nome, descricao: dados.descricao, limite: dados.limite })
      .where(eq(fornos.id, dados.id))
      .returning({ id: fornos.id });

    if (!linha) {
      return { ok: false, erro: MENSAGEM_FORNO_NAO_EXISTE };
    }

    revalidatePath("/gestao/queimas");
    revalidatePath("/gestao/queimas/[id]", "page");
    return { ok: true, dados: { id: linha.id } };
  } catch (erro) {
    console.error("Falha ao atualizar forno:", erro);
    return { ok: false, erro: "Não deu para salvar. Verifique a internet e tente de novo." };
  }
}

// FOR-07 — a regra central do módulo: o contador zera POR CONSEQUÊNCIA DO CORTE DE DATA, nunca
// por exclusão. Esta ação NUNCA contém um `db.delete`/`db.update` sobre `queimas`, em nenhum
// ramo — só um `insert` em `manutencoes` (T-04-16, prohibition deste plano). Dentro de uma
// `db.transaction`: (1) `select ... for update` na linha do forno serializa duas manutenções
// concorrentes — a segunda espera a primeira terminar antes de contar, nunca lê o mesmo N que a
// primeira leu (T-04-15); (2) conta as queimas do forno posteriores à última manutenção — a
// MESMA regra de corte que `lib/queimas/contador.ts#medirForno` aplica no cliente, agora em SQL;
// (3) grava a linha com essa contagem. `queimasAcumuladas` nunca vem de `entradaBruta` —
// `esquemaManutencao` nem declara esse campo.
export async function registrarManutencao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ id: string; queimasAcumuladas: number }>> {
  const usuarioAtual = await exigirUsuario();

  const resultado = esquemaManutencao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  try {
    const linhaDeManutencao = await db.transaction(async (tx) => {
      // `for update` serializa duas manutenções concorrentes no MESMO forno — a segunda espera
      // a primeira terminar antes de contar, nunca lê o N que a primeira já leu (T-04-15).
      const [linhaDeForno] = await tx
        .select({ id: fornos.id })
        .from(fornos)
        .where(eq(fornos.id, dados.fornoId))
        .for("update");

      if (!linhaDeForno) {
        throw new FornoNaoEncontrado();
      }

      // A manutenção mais recente é o corte de data — mesma regra de `medirForno`
      // (`lib/queimas/contador.ts`), agora em SQL: sem manutenção anterior, `ultimaManutencao`
      // é `undefined` e a contagem abaixo cai no ramo "conta todas".
      const [ultimaManutencao] = await tx
        .select({ ocorridaEm: manutencoes.ocorridaEm })
        .from(manutencoes)
        .where(eq(manutencoes.fornoId, dados.fornoId))
        .orderBy(desc(manutencoes.ocorridaEm))
        .limit(1);

      const condicaoDeContagem = ultimaManutencao
        ? and(eq(queimas.fornoId, dados.fornoId), gt(queimas.ocorridaEm, ultimaManutencao.ocorridaEm))
        : eq(queimas.fornoId, dados.fornoId);

      const [{ total }] = await tx.select({ total: count() }).from(queimas).where(condicaoDeContagem);

      // Único `insert` desta ação — nenhum `delete`/`update` sobre `queimas` em nenhum ramo
      // (T-04-16, prohibition do plano). O contador zera porque o corte de data se moveu, não
      // porque alguma linha de queima sumiu.
      const [linha] = await tx
        .insert(manutencoes)
        .values({
          fornoId: dados.fornoId,
          responsavel: dados.responsavel,
          observacoes: dados.observacoes,
          queimasAcumuladas: total,
          registradoPor: usuarioAtual.id,
        })
        .returning({ id: manutencoes.id, queimasAcumuladas: manutencoes.queimasAcumuladas });

      return linha;
    });

    revalidatePath("/gestao/queimas");
    revalidatePath("/gestao/queimas/[id]", "page");
    return {
      ok: true,
      dados: { id: linhaDeManutencao.id, queimasAcumuladas: linhaDeManutencao.queimasAcumuladas },
    };
  } catch (erro) {
    if (erro instanceof FornoNaoEncontrado) {
      return { ok: false, erro: MENSAGEM_FORNO_NAO_EXISTE };
    }
    console.error("Falha ao registrar manutenção:", erro);
    return { ok: false, erro: "Não deu para salvar. Verifique a internet e tente de novo." };
  }
}

// D-05/D-06/FOR-11: desativar ocupa o lugar da exclusão de forno, que não existe em lugar nenhum
// da aplicação — nem esta ação nem qualquer outra apaga uma linha de `fornos`. `where` filtra
// PELO VALOR OPOSTO de `ativo`: a transição inválida (desativar o que já está desativado) casa
// zero linhas e `returning()` vem vazio, virando mensagem em português — nunca um sucesso mudo
// sobre um estado que já era esse (T-04-17).
export async function desativarForno(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

  const [linha] = await db
    .update(fornos)
    .set({ ativo: false })
    .where(and(eq(fornos.id, resultado.data), eq(fornos.ativo, true)))
    .returning({ id: fornos.id });

  if (!linha) {
    return {
      ok: false,
      erro: "Esse forno já está desativado, ou não existe mais. Recarregue a página.",
    };
  }

  revalidatePath("/gestao/queimas");
  revalidatePath("/gestao/queimas/[id]", "page");
  return { ok: true, dados: { id: linha.id } };
}

// D-06: o mesmo lugar que desativa oferece reativar — o contador volta exatamente de onde
// parou, porque `registrarManutencao`/`registrarQueima`/`excluirQueima` nunca leem `ativo` (a
// reativação não recalcula nada, só destranca `RegistrarQueima` de novo).
export async function reativarForno(
  idBruto: unknown,
): Promise<ResultadoDeAcao<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaId.safeParse(idBruto);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }

  const [linha] = await db
    .update(fornos)
    .set({ ativo: true })
    .where(and(eq(fornos.id, resultado.data), eq(fornos.ativo, false)))
    .returning({ id: fornos.id });

  if (!linha) {
    return {
      ok: false,
      erro: "Esse forno já está ativo, ou não existe mais. Recarregue a página.",
    };
  }

  revalidatePath("/gestao/queimas");
  revalidatePath("/gestao/queimas/[id]", "page");
  return { ok: true, dados: { id: linha.id } };
}

// Fase 06.4 — a contagem opcional (QMC-01/QMC-03/QMC-11). A folha "O que queimou?" abre DEPOIS da
// resposta de `registrarQueima` (que não muda) e chama esta ação ao tocar "Salvar". `exigirUsuario()`
// é a PRIMEIRA instrução (T-06.4-01); `contado_por` vem da sessão, nunca do navegador; o Zod
// (`esquemaContagem`) recusa número fora de 0..10000 e total 0; a gravação é `gravarContagem`
// (`lib/queimas/gravacao.ts`, sem a diretiva de Server Action), sob a trava da linha da QUEIMA, com o
// piso da D-07 (externas nunca abaixo do já lançado em vendas ativas). A queima desfeita entre a folha
// abrir e o "Salvar" (o "Desfazer" do aviso — Pitfall 1) vira frase humana, nunca erro cru.
export async function salvarContagem(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ total: number; criada: boolean }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaContagem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { queimaId, ...contagem } = resultado.data;

  try {
    const { criada } = await db.transaction((tx) =>
      gravarContagem(tx, queimaId, contagem, usuario.id),
    );

    revalidatePath("/gestao/queimas");
    revalidatePath("/gestao/queimas/[id]", "page");
    return { ok: true, dados: { total: totalDaContagem(contagem), criada } };
  } catch (erro) {
    if (erro instanceof RecusaDasQueimas) {
      return { ok: false, erro: erro.frase };
    }
    // A queima sumiu depois da trava? Não pode (a trava a segura) — mas uma FK violada por qualquer
    // caminho é a mesma situação para quem está na folha.
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_QUEIMA_DESFEITA_NADA_CONTADO };
    }
    console.error("Falha ao salvar a contagem da queima:", codigoDoErroPostgres(erro), erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR_CONTAGEM };
  }
}

// Fase 06.4, plano 02 (UI-D6, QMC-11) — "Salvar" com tudo zero numa contagem EXISTENTE, depois da
// confirmação: apaga a linha de `queima_contagens` e a queima volta para "Sem contagem". A queima
// continua. `exigirUsuario()` é a PRIMEIRA instrução (T-06.4-10); o Zod valida o id; a decisão é relida
// sob a trava da queima (`apagarContagemNaTransacao`, T-06.4-11) — com peça lançada em venda ativa, a
// recusa da D-07 (T-06.4-46). Idempotente: sem contagem a apagar devolve `ok` (o estado pedido já vale).
export async function apagarContagem(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ apagou: boolean }>> {
  const usuario = await exigirUsuario();
  void usuario;

  const resultado = esquemaApagarContagem.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { queimaId } = resultado.data;

  try {
    const { apagou } = await db.transaction((tx) => apagarContagemNaTransacao(tx, queimaId));

    revalidatePath("/gestao/queimas");
    revalidatePath("/gestao/queimas/[id]", "page");
    return { ok: true, dados: { apagou } };
  } catch (erro) {
    if (erro instanceof RecusaDasQueimas) {
      return { ok: false, erro: erro.frase };
    }
    if (ehViolacaoDeChaveEstrangeira(erro)) {
      return { ok: false, erro: FRASE_QUEIMA_DESFEITA_NADA_CONTADO };
    }
    console.error("Falha ao apagar a contagem da queima:", codigoDoErroPostgres(erro), erro);
    return { ok: false, erro: FRASE_FALHA_AO_APAGAR_CONTAGEM };
  }
}

"use server";

// As ações dos Lembretes (Fase 06.3). Toda ação exportada começa por `exigirUsuario()` na primeira
// linha (T-06.3-01, cobrado por `npm run verificar-acoes`) e valida a entrada com o Zod de
// `./esquemas` — o MESMO que espelha os checks da 0029. A tela nunca decide autoria nem momentos:
// quem criou é o usuário da sessão; as datas são do banco.
//
// "Quem" é etiqueta (BRIEFING §2), mas uma etiqueta para uma pessoa DESATIVADA não é aceita: a
// chave estrangeira garante que o id existe; a conferência de `ativo` é do servidor (molde
// `lib/abertura/acoes.ts`), nunca do campo, que só oferece as pessoas ativas no momento em que a
// página carregou.
//
// Este arquivo só exporta funções async e tipos (uma exportação vira endpoint): frases em
// `./textos`, esquemas em `./esquemas`, leituras em `./consultas`.
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { lembretes, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { obterLembreteDaTela, type LembreteDaTela } from "./consultas";
import {
  esquemaCriarLembrete,
  esquemaMarcarFeito,
  type CampoDoLembrete,
} from "./esquemas";
import {
  FRASE_ESCREVA_O_LEMBRETE,
  FRASE_FALHA_AO_GUARDAR,
  FRASE_FALHA_AO_MARCAR,
  FRASE_LEMBRETE_NAO_EXISTE,
  FRASE_PESSOA_INVALIDA,
} from "./textos";

// O envelope das ações: a frase e, quando ela é de um campo, qual — a tela a mostra embaixo dele.
// `naoExiste`: o lembrete sumiu do banco (outra pessoa o excluiu) — a tela tira a linha e avisa.
export type ResultadoDoLembrete<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campo?: CampoDoLembrete; naoExiste?: true };

// NÃO exportada.
const LEMBRETE_NAO_EXISTE = {
  ok: false,
  erro: FRASE_LEMBRETE_NAO_EXISTE,
  naoExiste: true,
} as const;

const CAMPOS_DO_LEMBRETE: readonly CampoDoLembrete[] = ["texto", "paraQuando", "quem"];

type ProblemaDeValidacao = { path: PropertyKey[]; message: string };

// NÃO exportada (uma exportação deste arquivo vira endpoint). Um problema fora dos campos da tela
// (o `id` adulterado, por exemplo) recebe a frase genérica de quem chamou — nunca a mensagem crua
// do Zod.
function recusaDeValidacao(
  problemas: readonly ProblemaDeValidacao[],
  fraseGenerica: string = FRASE_FALHA_AO_GUARDAR,
): {
  ok: false;
  erro: string;
  campo?: CampoDoLembrete;
} {
  const primeiro = problemas[0];
  const caminho = primeiro?.path[0];
  const campo = (CAMPOS_DO_LEMBRETE as readonly PropertyKey[]).includes(caminho as PropertyKey)
    ? (caminho as CampoDoLembrete)
    : undefined;
  if (!campo) {
    return { ok: false, erro: fraseGenerica };
  }
  return { ok: false, erro: primeiro?.message ?? fraseGenerica, campo };
}

// A pessoa ATIVA com esse id (o nome vai para a linha devolvida), ou `null`. NÃO exportada.
async function pessoaAtiva(id: string): Promise<{ id: string; nome: string } | null> {
  const [pessoa] = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.ativo, true)))
    .limit(1);
  return pessoa ?? null;
}

// Depois de mexer num lembrete: o Início (o bloco "Anotações e lembretes") e "ver todos".
// NÃO exportada.
function revalidarTelasDosLembretes() {
  revalidatePath(rotaDeGestao("/"));
  revalidatePath(rotaDeGestao("/lembretes"));
}

// Criar um lembrete (LMB-03). Devolve a linha inteira: a lista a põe no estado local na hora, sem
// esperar o redesenho do servidor (que às vezes não chega à tela — debug da Abertura).
export async function criarLembrete(entrada: unknown): Promise<ResultadoDoLembrete<LembreteDaTela>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCriarLembrete.safeParse(entrada);
  if (!resultado.success) {
    return recusaDeValidacao(resultado.error.issues);
  }
  const dados = resultado.data;

  try {
    let quemNome: string | null = null;
    if (dados.quem !== null) {
      const pessoa = await pessoaAtiva(dados.quem);
      if (!pessoa) {
        return { ok: false, erro: FRASE_PESSOA_INVALIDA, campo: "quem" };
      }
      quemNome = pessoa.nome;
    }

    const [criado] = await db
      .insert(lembretes)
      .values({
        texto: dados.texto,
        paraQuando: dados.paraQuando,
        quem: dados.quem,
        criadoPor: usuario.id,
      })
      .returning({
        id: lembretes.id,
        texto: lembretes.texto,
        paraQuando: lembretes.paraQuando,
        quem: lembretes.quem,
        criadoEm: lembretes.criadoEm,
      });

    revalidarTelasDosLembretes();
    return {
      ok: true,
      dados: {
        id: criado.id,
        texto: criado.texto,
        paraQuando: criado.paraQuando,
        quem: criado.quem,
        quemNome,
        criadoEm: criado.criadoEm.toISOString(),
        criadoPorNome: usuario.nome,
        feitoEm: null,
        feitoPorNome: null,
      },
    };
  } catch (erro) {
    const codigo = codigoDoErroPostgres(erro);
    // 23503: a pessoa deixou de existir entre a conferência e o insert.
    if (codigo === "23503") {
      return { ok: false, erro: FRASE_PESSOA_INVALIDA, campo: "quem" };
    }
    // 23514: o check `lembretes_texto_comprimento` — só um envio que contornou o Zod chega aqui.
    if (codigo === "23514") {
      return { ok: false, erro: FRASE_ESCREVA_O_LEMBRETE, campo: "texto" };
    }
    console.error("Falha ao guardar o lembrete:", codigo, erro);
    return { ok: false, erro: FRASE_FALHA_AO_GUARDAR };
  }
}

// Marcar feito ou reabrir (LMB-06). `feito` é o estado DESEJADO, nunca "inverter": dois toques, ou
// duas pessoas, convergem. `feito: true` só grava se o lembrete ainda está aberto (`feito_em is
// null`) — vale o PRIMEIRO; quem chega depois recebe a linha como está (o feito do outro), sem erro.
// O momento é o `now()` do Postgres e o autor é a sessão (T-06.3-16): o esquema só aceita
// `{ id, feito }`. Devolve a linha atual; o lembrete que sumiu do banco vira `naoExiste`.
export async function marcarFeito(
  entrada: unknown,
): Promise<ResultadoDoLembrete<LembreteDaTela>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaMarcarFeito.safeParse(entrada);
  if (!resultado.success) {
    return recusaDeValidacao(resultado.error.issues, FRASE_FALHA_AO_MARCAR);
  }
  const { id, feito } = resultado.data;

  try {
    if (feito) {
      await db
        .update(lembretes)
        .set({ feitoEm: sql`now()`, feitoPor: usuario.id })
        .where(and(eq(lembretes.id, id), isNull(lembretes.feitoEm)));
    } else {
      await db
        .update(lembretes)
        .set({ feitoEm: null, feitoPor: null })
        .where(eq(lembretes.id, id));
    }

    const linha = await obterLembreteDaTela(id);
    if (!linha) {
      return LEMBRETE_NAO_EXISTE;
    }
    revalidarTelasDosLembretes();
    return { ok: true, dados: linha };
  } catch (erro) {
    const codigo = codigoDoErroPostgres(erro);
    console.error("Falha ao marcar o lembrete:", codigo, erro);
    return { ok: false, erro: FRASE_FALHA_AO_MARCAR };
  }
}

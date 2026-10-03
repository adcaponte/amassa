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
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { lembretes, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import type { LembreteDaTela } from "./consultas";
import { esquemaCriarLembrete, type CampoDoLembrete } from "./esquemas";
import {
  FRASE_ESCREVA_O_LEMBRETE,
  FRASE_FALHA_AO_GUARDAR,
  FRASE_PESSOA_INVALIDA,
} from "./textos";

// O envelope das ações: a frase e, quando ela é de um campo, qual — a tela a mostra embaixo dele.
export type ResultadoDoLembrete<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campo?: CampoDoLembrete };

const CAMPOS_DO_LEMBRETE: readonly CampoDoLembrete[] = ["texto", "paraQuando", "quem"];

type ProblemaDeValidacao = { path: PropertyKey[]; message: string };

// NÃO exportada (uma exportação deste arquivo vira endpoint).
function recusaDeValidacao(problemas: readonly ProblemaDeValidacao[]): {
  ok: false;
  erro: string;
  campo?: CampoDoLembrete;
} {
  const primeiro = problemas[0];
  const caminho = primeiro?.path[0];
  const campo = (CAMPOS_DO_LEMBRETE as readonly PropertyKey[]).includes(caminho as PropertyKey)
    ? (caminho as CampoDoLembrete)
    : undefined;
  return { ok: false, erro: primeiro?.message ?? FRASE_FALHA_AO_GUARDAR, ...(campo ? { campo } : {}) };
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

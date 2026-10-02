"use server";

// As ações do cadastro de pessoas (D-01) — o ÚNICO lugar do sistema onde um cliente nasce
// (o único `insert` na tabela do sistema inteiro: "sem cadastro paralelo"). Cadastros → Clientes, a Agenda → Pessoas e o
// seletor de pessoa (plano 05) chamam estas duas ações pelo mesmo formulário.
//
// D-01 (escolha do dono): `clientes` vive AO LADO de `documentos.pessoa_nome`, que continua sendo
// preenchido — nada aqui liga, à força, a Venda manual, o Orçamento ou a Produção a um cliente.
//
// Nada se apaga nem se desativa: não existe ação de apagar cliente (vendas, presenças e mensalidades
// apontam para ele), e o banco também nega (`revoke delete on clientes`, provado no plano 02).
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { buscarHomonimos, type ClienteDaLista } from "./consultas";
import { esquemaCliente, esquemaEdicaoDeCliente } from "./esquemas";
import { FRASE_CLIENTE_NAO_EXISTE, FRASE_FALHA_AO_SALVAR } from "./textos";

export type Homonimo = ClienteDaLista;

// O envelope do cadastro: além do `erro` (a primeira frase) e do erro de CADA campo (embaixo do
// campo), pode voltar `homonimos` — aí `erro` é `null`: nada deu errado, só há uma pergunta (D-16).
export type ResultadoDoCadastro<T> =
  | { ok: true; dados: T }
  | {
      ok: false;
      erro: string | null;
      campos?: Partial<Record<"nome" | "telefone", string>>;
      homonimos?: Homonimo[];
    };

type ProblemaDeValidacao = { path: PropertyKey[]; message: string };

function recusaDeValidacao(problemas: readonly ProblemaDeValidacao[]): {
  ok: false;
  erro: string;
  campos: Partial<Record<"nome" | "telefone", string>>;
} {
  const campos: Partial<Record<"nome" | "telefone", string>> = {};
  for (const problema of problemas) {
    const campo = problema.path[0];
    if ((campo === "nome" || campo === "telefone") && campos[campo] === undefined) {
      campos[campo] = problema.message;
    }
  }
  return { ok: false, erro: problemas[0]?.message ?? FRASE_FALHA_AO_SALVAR, campos };
}

// As telas que mostram o cadastro. NÃO exportado (uma exportação deste arquivo vira endpoint).
function revalidarTelasDoCadastro(): void {
  revalidatePath(rotaDeGestao("/cadastros"));
  revalidatePath(rotaDeGestao("/agenda"));
}

// Cadastrar uma pessoa. `exigirUsuario()` é a PRIMEIRA instrução (T-05-18, `verificar-acoes`). Sem
// `confirmarHomonimo`, procura o mesmo nome normalizado e, havendo, devolve os homônimos SEM gravar —
// quem decide é o gestor ("Usar … que já existe" ou "Criar outra pessoa"). Dois gestores cadastrando
// a mesma pessoa ao mesmo tempo podem criar dois registros: é permitido (D-16), e quem cadastrar
// depois é avisado.
export async function criarCliente(entrada: unknown): Promise<ResultadoDoCadastro<ClienteDaLista>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCliente.safeParse(entrada);
  if (!resultado.success) {
    return recusaDeValidacao(resultado.error.issues);
  }
  const { nome, telefone, confirmarHomonimo } = resultado.data;

  try {
    if (confirmarHomonimo !== true) {
      const homonimos = await buscarHomonimos(nome);
      if (homonimos.length > 0) {
        return { ok: false, erro: null, homonimos };
      }
    }

    const [criado] = await db
      .insert(clientes)
      .values({ nome, telefone, criadoPor: usuario.id })
      .returning({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone });

    revalidarTelasDoCadastro();
    return { ok: true, dados: criado };
  } catch (erro) {
    console.error("Falha ao cadastrar a pessoa:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// Editar nome e telefone (Cadastros e a ficha da pessoa — UI-D24). `exigirUsuario()` primeiro. Trava
// a linha (`for no key update` — não bloqueia quem só aponta para o cliente, como uma inscrição
// nova) e atualiza. O aviso de homônimo só aparece quando o NOME muda para o de outro cadastro:
// corrigir o telefone de quem já tem homônimo não pergunta de novo. Com o aviso, a tela oferece
// "Salvar mesmo assim" (`confirmarHomonimo: true`).
export async function editarCliente(
  entrada: unknown,
): Promise<ResultadoDoCadastro<ClienteDaLista>> {
  await exigirUsuario();

  const resultado = esquemaEdicaoDeCliente.safeParse(entrada);
  if (!resultado.success) {
    return recusaDeValidacao(resultado.error.issues);
  }
  const { id, nome, telefone, confirmarHomonimo } = resultado.data;

  try {
    const resposta = await db.transaction(async (tx): Promise<ResultadoDoCadastro<ClienteDaLista>> => {
      const [atual] = await tx
        .select({
          id: clientes.id,
          mesmoNome: sql<boolean>`nome_normalizado(${clientes.nome}) = nome_normalizado(${nome})`,
        })
        .from(clientes)
        .where(eq(clientes.id, id))
        .for("no key update");
      if (!atual) {
        return { ok: false, erro: FRASE_CLIENTE_NAO_EXISTE };
      }

      if (confirmarHomonimo !== true && !atual.mesmoNome) {
        const homonimos = await buscarHomonimos(nome, id, tx);
        if (homonimos.length > 0) {
          return { ok: false, erro: null, homonimos };
        }
      }

      const [editado] = await tx
        .update(clientes)
        .set({ nome, telefone })
        .where(eq(clientes.id, id))
        .returning({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone });
      return { ok: true, dados: editado };
    });

    if (resposta.ok) {
      revalidarTelasDoCadastro();
    }
    return resposta;
  } catch (erro) {
    console.error("Falha ao editar a pessoa:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

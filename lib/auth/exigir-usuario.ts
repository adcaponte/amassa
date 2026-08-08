// A ÚNICA porta de autorização do sistema. `02-MODELO-DE-DADOS.md` §0 é explícito que este
// projeto não tem RLS por trás para salvar um esquecimento — `exigirUsuario()` ocupa esse
// lugar. Toda Server Action que toca o banco começa por ela na primeira linha (regra de
// `.claude/CLAUDE.md`); o plano 05 transforma essa regra num portão de máquina, não só de
// convenção.
//
// A conferência de `ativo` acontece AQUI, no banco, a cada chamada — nunca no token. O
// token dura 30 dias (`lib/auth/auth.config.ts`); conferir só nele faria "desativar
// alguém" significar "daqui a um mês" (T-02a-19).
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { usuarios } from "@/db/schema";

type LinhaDeUsuario = typeof usuarios.$inferSelect;

export type UsuarioAutorizado = {
  id: string;
  nome: string;
  email: string;
  papel: LinhaDeUsuario["papel"];
};

export type ResultadoDeAutorizacao =
  | { autorizado: true; usuario: UsuarioAutorizado }
  | { autorizado: false; motivo: "usuario-nao-encontrado" | "usuario-inativo" };

// Função pura: recebe o registro de usuário lido do banco (ou nada, quando não há sessão ou
// o e-mail da sessão não corresponde a ninguém) e decide. É o que `tests/unit/exigir-usuario.test.ts`
// exercita sem banco e sem sessão. O objeto devolvido na aceitação nunca inclui
// `senhaHash` — mesmo que `registro` (o parâmetro) inclua, como uma linha real do banco
// inclui.
export function avaliarAutorizacao(registro: LinhaDeUsuario | undefined): ResultadoDeAutorizacao {
  if (!registro) {
    return { autorizado: false, motivo: "usuario-nao-encontrado" };
  }

  if (!registro.ativo) {
    return { autorizado: false, motivo: "usuario-inativo" };
  }

  return {
    autorizado: true,
    usuario: {
      id: registro.id,
      nome: registro.nome,
      email: registro.email,
      papel: registro.papel,
    },
  };
}

// A casca: lê a sessão pelo Auth.js, busca a linha atual de `usuarios` pelo e-mail do
// token (o mesmo índice funcional `lower(email)` que o login usa), passa pela função pura
// acima e, na recusa, redireciona para `/login` com um marcador de sessão encerrada — a
// mesma frase serve para sessão vencida e para conta desativada (T-02a-21): dizer "sua
// conta foi desativada" para quem só ficou fora 31 dias seria confuso, e para quem está
// sondando seria informação de graça.
//
// `@/lib/auth/auth` é importado de forma DINÂMICA aqui dentro, não no topo do arquivo:
// `lib/auth/auth.ts` importa `next-auth`, que por sua vez alcança `next/server` de um jeito
// que só o bundler do próprio Next.js resolve. Um import estático no topo do arquivo
// quebraria QUALQUER teste que importe `avaliarAutorizacao` daqui, mesmo sem nunca chamar
// `exigirUsuario()` — esta função sempre roda dentro do Next.js de verdade, nunca do
// Vitest, então o custo do import dinâmico é irrelevante em produção.
export async function exigirUsuario(): Promise<UsuarioAutorizado> {
  const { auth } = await import("@/lib/auth/auth");

  const sessao = await auth();
  const email = sessao?.user?.email;

  let registro: LinhaDeUsuario | undefined;
  if (email) {
    const linhas = await db
      .select()
      .from(usuarios)
      .where(eq(sql`lower(${usuarios.email})`, email.toLowerCase()))
      .limit(1);
    registro = linhas[0];
  }

  const resultado = avaliarAutorizacao(registro);
  if (!resultado.autorizado) {
    redirect("/login?sessao=encerrada");
  }

  return resultado.usuario;
}

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
import { cache } from "react";
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
// acima e, na recusa, redireciona para `/gestao/login` (Fase 04.6, D-03/D-21) com um marcador
// de sessão encerrada — a mesma frase serve para sessão vencida e para conta desativada
// (T-02a-21): dizer "sua conta foi desativada" para quem só ficou fora 31 dias seria confuso, e
// para quem está sondando seria informação de graça.
//
// `@/lib/auth/auth` é importado de forma DINÂMICA aqui dentro, não no topo do arquivo:
// `lib/auth/auth.ts` importa `next-auth`, que por sua vez alcança `next/server` de um jeito
// que só o bundler do próprio Next.js resolve. Um import estático no topo do arquivo
// quebraria QUALQUER teste que importe `avaliarAutorizacao` daqui, mesmo sem nunca chamar
// `exigirUsuario()` — esta função sempre roda dentro do Next.js de verdade, nunca do
// Vitest, então o custo do import dinâmico é irrelevante em produção.
//
// Fase 06.5 (D-21): embrulhada em `cache` do React — UMA leitura de sessão e UMA consulta de usuário
// por requisição. Uma página monta várias seções em paralelo (cada uma com o seu `exigirUsuario()`
// de defesa em profundidade), e cada chamada relia a sessão e o banco. O `cache` vale só DENTRO de
// uma renderização do servidor: nunca guarda nada entre requisições (T-06.5-59), e fora de uma
// renderização (Route Handler, Server Action fora do render, teste) só repassa a chamada. Na recusa
// o `cache` relança o MESMO erro do `redirect()` — o `ehFaltaDeSessao` abaixo continua valendo
// (medido em `tests/unit/exigir-usuario.test.ts`). O nome e a assinatura não mudam: o portão
// `scripts/verificar-acoes.mjs` procura `exigirUsuario()` na primeira linha de toda ação.
export const exigirUsuario = cache(async (): Promise<UsuarioAutorizado> => {
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
    redirect("/gestao/login?sessao=encerrada");
  }

  return resultado.usuario;
});

// 06.2-WR-01 (quick 261005-2yu, 05/10/2026): quem envolve `exigirUsuario()` num `try` (os Route
// Handlers dos anexos, que respondem JSON em vez de deixar o redirect seguir) precisa separar a
// FALTA DE SESSÃO de uma FALHA DO SERVIDOR. Só a primeira é "Sua sessão terminou": é o erro que o
// `redirect()` acima lança — um objeto com `digest` no formato
// `NEXT_REDIRECT;{replace|push};{url};{status};` (Next 16, `client/components/redirect-error.js`;
// não importamos o caminho interno `next/dist/...` de propósito). Qualquer outro erro — o banco fora,
// `auth()` lançando — é falha do servidor e nunca pode se passar por decisão de autorização.
export function ehFaltaDeSessao(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null || !("digest" in erro)) {
    return false;
  }
  const digest = (erro as { digest: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;");
}

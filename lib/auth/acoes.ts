"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { ErroBloqueado, signIn, signOut } from "@/lib/auth/auth";
import { credenciaisEntradaSchema } from "@/lib/auth/entrada-credenciais";
import { rotaDeGestao } from "@/lib/rotas/gestao";

// Único ponto que valida a entrada do formulário e chama o Auth.js. Este arquivo NÃO toca o
// banco — quem consulta a tabela `usuarios` é a função de checagem de credenciais do provedor,
// dentro de `lib/auth/auth.ts`. Não confundir com o portão de autorização `exigirUsuario()`
// do plano 05: aqui é entrada (quem é você), lá é autorização de rota (o que você pode fazer).
// O schema vem de lib/auth/entrada-credenciais.ts — o mesmo usado pelo `authorize()` do
// provedor, para as duas validações não divergirem silenciosamente (WR-03 da revisão de 02a-08).

export async function entrar(dadosFormulario: FormData) {
  const resultado = credenciaisEntradaSchema.safeParse({
    email: dadosFormulario.get("email"),
    senha: dadosFormulario.get("senha"),
  });

  if (!resultado.success) {
    // Formato inválido usa a mesma mensagem única — o formulário nunca diz qual campo está
    // errado por um motivo relacionado a credenciais. Literal `/gestao/login` (Fase 04.6,
    // D-03/D-21) — não `rotaDeGestao("/login")`: o argumento reproduziria o caminho antigo por
    // extenso, exatamente o que `tests/unit/redirecionamentos-antigos.test.ts` e a varredura
    // mecânica desta fase existem para não deixar sobrar.
    redirect("/gestao/login?erro=credenciais");
  }

  const emailNormalizado = resultado.data.email.trim().toLowerCase();

  try {
    await signIn("credentials", {
      email: emailNormalizado,
      senha: resultado.data.senha,
      // Fase 04.6 (D-03/D-21): a plataforma desceu para `/gestao` — `rotaDeGestao("/")`
      // devolve exatamente o prefixo `/gestao`, nunca `/gestao/` com barra sobrando.
      redirectTo: rotaDeGestao("/"),
    });
  } catch (erro) {
    // Bloqueio não é credencial inválida — tem mensagem própria, com os minutos restantes.
    // Checado antes do `AuthError` genérico porque `ErroBloqueado` também é um `AuthError`.
    if (erro instanceof ErroBloqueado) {
      const minutos = Math.max(1, Math.ceil(erro.segundosParaLiberar / 60));
      redirect(`/gestao/login?erro=bloqueado&minutos=${minutos}`);
    }
    if (erro instanceof AuthError) {
      redirect("/gestao/login?erro=credenciais");
    }
    // O próprio `signIn` bem-sucedido lança um erro de redirecionamento do Next.js — não é
    // um `AuthError`, e precisa continuar subindo para o Next.js tratar.
    throw erro;
  }
}

// Encerra a sessão de verdade (AUTH-06): não é o botão de voltar do navegador que decide,
// é o próprio Auth.js invalidando o cookie. Este arquivo NÃO toca o banco — a mesma regra
// de `entrar()` acima. Não confundir com `exigirUsuario()` (autorização de rota); esta
// função é só saída.
export async function sair() {
  await signOut({ redirectTo: "/gestao/login" });
}

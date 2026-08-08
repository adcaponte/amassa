"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "next-auth";

import { ErroBloqueado, signIn } from "@/lib/auth/auth";

// Único ponto que valida a entrada do formulário e chama o Auth.js. Este arquivo NÃO toca o
// banco — quem consulta a tabela `usuarios` é a função de checagem de credenciais do provedor,
// dentro de `lib/auth/auth.ts`. Não confundir com o portão de autorização `exigirUsuario()`
// do plano 05: aqui é entrada (quem é você), lá é autorização de rota (o que você pode fazer).
const credenciaisSchema = z.object({
  email: z.email(),
  senha: z.string().min(1),
});

export async function entrar(dadosFormulario: FormData) {
  const resultado = credenciaisSchema.safeParse({
    email: dadosFormulario.get("email"),
    senha: dadosFormulario.get("senha"),
  });

  if (!resultado.success) {
    // Formato inválido usa a mesma mensagem única — o formulário nunca diz qual campo está
    // errado por um motivo relacionado a credenciais.
    redirect("/login?erro=credenciais");
  }

  const emailNormalizado = resultado.data.email.trim().toLowerCase();

  try {
    await signIn("credentials", {
      email: emailNormalizado,
      senha: resultado.data.senha,
      redirectTo: "/",
    });
  } catch (erro) {
    // Bloqueio não é credencial inválida — tem mensagem própria, com os minutos restantes.
    // Checado antes do `AuthError` genérico porque `ErroBloqueado` também é um `AuthError`.
    if (erro instanceof ErroBloqueado) {
      const minutos = Math.max(1, Math.ceil(erro.segundosParaLiberar / 60));
      redirect(`/login?erro=bloqueado&minutos=${minutos}`);
    }
    if (erro instanceof AuthError) {
      redirect("/login?erro=credenciais");
    }
    // O próprio `signIn` bem-sucedido lança um erro de redirecionamento do Next.js — não é
    // um `AuthError`, e precisa continuar subindo para o Next.js tratar.
    throw erro;
  }
}

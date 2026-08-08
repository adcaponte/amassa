"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/lib/auth/auth";

// Mensagem e validação aqui são provisórias — o texto definitivo, a regra de mensagem
// única para e-mail inexistente/senha errada e o limite de tentativas são do plano 03.
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
    redirect("/login?erro=1");
  }

  try {
    await signIn("credentials", {
      email: resultado.data.email.toLowerCase(),
      senha: resultado.data.senha,
      redirectTo: "/",
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      redirect("/login?erro=1");
    }
    // O próprio `signIn` bem-sucedido lança um erro de redirecionamento do Next.js — não é
    // um `AuthError`, e precisa continuar subindo para o Next.js tratar.
    throw erro;
  }
}

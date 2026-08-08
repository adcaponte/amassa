import { FRASE_NO_AR } from "@/app/frase-no-ar";
import { MENSAGEM_CREDENCIAIS_INVALIDAS } from "@/lib/auth/credenciais";
import { entrar } from "@/lib/auth/acoes";

import { BotaoEntrar } from "./botao-entrar";

// Tela mínima, sem componente de biblioteca (D-03 do 02a-CONTEXT.md — o design system é da
// Fase 2b). A frase e o nome AMASSA continuam visíveis sem sessão aqui, já que a raiz deixou
// de ser pública (prova pública do critério INFRA-02 da Fase 1).
function mensagemDeErro(
  erro: string | undefined,
  minutos: string | undefined,
  sessao: string | undefined,
): string | null {
  if (erro === "bloqueado") {
    // Mensagem distinta da de credenciais inválidas — bloqueio não é senha errada, e esconder
    // o bloqueio faria a pessoa certa achar que esqueceu a própria senha (T-02a-12).
    const quantidade = minutos ?? "alguns";
    return `Muitas tentativas com este e-mail. Tente novamente em ${quantidade} minuto(s).`;
  }
  if (erro === "credenciais") {
    // Mesma constante usada em lib/auth/credenciais.ts — senha errada e e-mail sem conta
    // mostram exatamente o mesmo texto (T-02a-13).
    return MENSAGEM_CREDENCIAIS_INVALIDAS;
  }
  if (sessao === "encerrada") {
    // Mesma frase para sessão vencida (30 dias) e conta desativada (`ativo = false`) — as
    // duas passam por `exigirUsuario()` (lib/auth/exigir-usuario.ts). Distinguir os dois
    // motivos aqui confundiria quem só ficou fora 31 dias, e daria informação de graça para
    // quem está sondando contas alheias (T-02a-21).
    return "Sua sessão foi encerrada. Entre novamente.";
  }
  return null;
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; minutos?: string; sessao?: string }>;
}) {
  const { erro, minutos, sessao } = await searchParams;
  const mensagem = mensagemDeErro(erro, minutos, sessao);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F6F3F0] px-6 text-center text-[#1D2221]">
      <h1 className="text-4xl font-semibold">AMASSA</h1>
      <p className="mt-2 mb-8 text-lg">{FRASE_NO_AR}</p>

      <form action={entrar} className="flex w-full max-w-sm flex-col gap-4 text-left">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">E-mail</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="min-h-[44px] rounded-md border border-[#D8D2CB] bg-white px-4 text-base text-[#1D2221]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Senha</span>
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
            className="min-h-[44px] rounded-md border border-[#D8D2CB] bg-white px-4 text-base text-[#1D2221]"
          />
        </label>

        {mensagem && (
          <p role="alert" aria-live="assertive" className="text-sm text-red-700">
            {mensagem}
          </p>
        )}

        <BotaoEntrar />
      </form>
    </main>
  );
}

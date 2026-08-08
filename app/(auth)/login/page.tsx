import { FRASE_NO_AR } from "@/app/frase-no-ar";

import { entrar } from "./acoes";

// Tela mínima, sem componente de biblioteca (D-03 do 02a-CONTEXT.md — o design system é da
// Fase 2b). A frase e o nome AMASSA continuam visíveis sem sessão aqui, já que a raiz deixou
// de ser pública (prova pública do critério INFRA-02 da Fase 1).
export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

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

        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {/* Texto provisório — a mensagem definitiva e a regra de mensagem única são do
            plano 03. */}
            E-mail ou senha inválidos.
          </p>
        )}

        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-[#1D2221] px-4 text-base font-medium text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}

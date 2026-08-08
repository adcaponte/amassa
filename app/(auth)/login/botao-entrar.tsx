"use client";

import { useFormStatus } from "react-dom";

// Componente cliente minúsculo só para o estado de carregamento do botão — o resto da tela
// continua Server Component. Uma tela parada durante a espera é defeito, não detalhe
// (PROJECT.md, "Estados"). Sem componente de biblioteca (D-03 do 02a-CONTEXT.md).
export function BotaoEntrar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[44px] rounded-md bg-[#1D2221] px-4 text-base font-medium text-white disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

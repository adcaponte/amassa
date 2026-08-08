"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

// Componente cliente minúsculo só para o estado de carregamento do botão — o resto da tela
// continua Server Component. Uma tela parada durante a espera é defeito, não detalhe
// (PROJECT.md, "Estados"). Reestilizado com o `Button` do shadcn (D-14) — a mecânica
// (useFormStatus, disabled, aria-busy, os dois rótulos) não muda. É este botão que a prova
// de UI-01 mede: variant="default" resolve para --color-acento via --color-primary.
export function BotaoEntrar() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="default"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[44px] w-full text-base font-medium"
    >
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

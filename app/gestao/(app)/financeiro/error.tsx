"use client";

import { useEffect } from "react";

import { FRASE_ERRO_CORPO, FRASE_ERRO_TITULO } from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/financeiro` — "use client" é exigência do App Router. Mesmo padrão de
// `app/(app)/abertura/error.tsx`/`app/(app)/queimas/error.tsx`: nenhuma propriedade de `error`
// (mensagem, pilha, `digest`) é renderizada na tela, só sai no console via `console.error`.
export default function ErroFinanceiro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErro
      titulo={FRASE_ERRO_TITULO}
      corpo={FRASE_ERRO_CORPO}
      acao={
        <Button type="button" variant="default" onClick={() => reset()}>
          Tentar de novo
        </Button>
      }
    />
  );
}

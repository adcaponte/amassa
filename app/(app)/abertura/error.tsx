"use client";

import { useEffect } from "react";

import { FRASE_ERRO_CORPO, FRASE_ERRO_TITULO } from "@/lib/abertura/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro do índice de Abertura do Espaço — "use client" é exigência do App Router
// para qualquer error.tsx. Mesmo padrão de app/(app)/queimas/error.tsx e
// app/(app)/encomendas/error.tsx: nenhuma propriedade de `error` (mensagem, pilha, `digest`) é
// renderizada na tela, só sai no console via `console.error`.
export default function ErroAbertura({
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

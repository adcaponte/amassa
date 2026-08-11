"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { FRASE_ERRO_CORPO_FORNO, FRASE_ERRO_TITULO } from "@/lib/queimas/textos";

// Boundary de erro do detalhe do forno — "use client" é exigência do App Router para qualquer
// error.tsx. Mesmo padrão de `app/(app)/queimas/error.tsx` (um único botão, "Tentar de novo"):
// nenhuma propriedade de `error` (mensagem, pilha, `digest`) é renderizada na tela, só sai no
// console via `console.error`.
export default function ErroDetalheDoForno({
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
      corpo={FRASE_ERRO_CORPO_FORNO}
      acao={
        <Button type="button" variant="default" onClick={() => reset()}>
          Tentar de novo
        </Button>
      }
    />
  );
}

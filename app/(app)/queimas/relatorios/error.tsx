"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { FRASE_ERRO_CORPO_RELATORIOS, FRASE_ERRO_TITULO } from "@/lib/queimas/textos";

// Boundary de erro da rota de relatórios — "use client" é exigência do App Router para qualquer
// error.tsx. Mesmo padrão de `app/(app)/queimas/error.tsx`: nenhuma propriedade de `error`
// (mensagem, pilha, `digest`) é renderizada na tela, só sai no console via `console.error`. As
// estatísticas nunca renderizam meio-preenchidas (E9/error) — a tela inteira vira este estado.
export default function ErroRelatoriosDeQueimas({
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
      corpo={FRASE_ERRO_CORPO_RELATORIOS}
      acao={
        <Button type="button" variant="default" onClick={() => reset()}>
          Tentar de novo
        </Button>
      }
    />
  );
}

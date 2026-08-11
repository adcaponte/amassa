"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import {
  FRASE_ERRO_CORPO_GENERICO,
  FRASE_ERRO_TITULO,
  ROTULO_TENTAR_DE_NOVO,
} from "@/lib/erro/textos";

// Boundary de erro do grupo protegido — "use client" é exigência do Next.js App Router para
// qualquer error.tsx. Vive DENTRO de app/(app)/layout.tsx (a casca inteira é o layout que
// envolve `children`, e este arquivo substitui só o `children` quando algo quebra), então a
// barra lateral (desktop) e a barra inferior (celular) continuam renderizadas e clicáveis
// quando esta tela aparece — é o que dá saída ao usuário sem recarregar a aplicação inteira.
//
// Copy fixa e em linguagem humana: nenhuma propriedade do objeto `error` (mensagem, pilha de
// chamadas, digest que o Next.js anexa) é renderizada na tela — só sai no console via
// `console.error`, para quem estiver com as ferramentas de desenvolvedor abertas.
export default function ErroApp({
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
      corpo={FRASE_ERRO_CORPO_GENERICO}
      acao={
        <Button
          type="button"
          variant="default"
          className="min-h-[44px]"
          onClick={() => reset()}
        >
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}

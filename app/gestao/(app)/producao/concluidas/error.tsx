"use client";

import { useEffect } from "react";

import {
  FRASE_ERRO_CARREGAR_CONCLUIDAS,
  ROTULO_TENTAR_DE_NOVO,
  TITULO_ERRO,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/producao/concluidas` — "use client" é exigência do App Router. Mesmo
// padrão de `app/gestao/(app)/producao/error.tsx`: nenhuma propriedade de `error` (mensagem, pilha,
// `digest`) é renderizada na tela, só sai no console. A frase é a da UI-SPEC para "Carregar
// Concluídas e canceladas".
export default function ErroConcluidas({
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
      titulo={TITULO_ERRO}
      corpo={FRASE_ERRO_CARREGAR_CONCLUIDAS}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => reset()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}

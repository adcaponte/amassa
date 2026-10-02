"use client";

import { useEffect } from "react";

import { FRASE_ERRO_CARREGAR_AGENDA, ROTULO_TENTAR_DE_NOVO, TITULO_ERRO } from "@/lib/agenda/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/agenda` — "use client" é exigência do App Router. Molde de
// `app/gestao/(app)/producao/error.tsx`: nenhuma propriedade de `error` (mensagem, pilha, `digest`)
// é renderizada na tela, só sai no console. A frase é a da UI-SPEC para "Carregar a Agenda".
export default function ErroAgenda({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, e não `reset` (revisão 06.1, WR-102): no Next 16.3.5 o `reset` só redesenha o mesmo
  // payload com erro; o `retry` busca de novo o que falhou no servidor.
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErro
      titulo={TITULO_ERRO}
      corpo={FRASE_ERRO_CARREGAR_AGENDA}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => retry()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}

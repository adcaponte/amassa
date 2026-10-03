"use client";

import { useEffect } from "react";

import { FRASE_ERRO_TITULO } from "@/lib/erro/textos";
import { FRASE_ERRO_DA_COLUNA, ROTULO_TENTAR_DE_NOVO } from "@/lib/lembretes/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/lembretes` (06.3-UI-SPEC.md §Erros) — "use client" é exigência do App
// Router. Molde `app/gestao/(app)/estoque/error.tsx`: nenhuma propriedade do erro (mensagem, pilha,
// `digest`) vai para a tela — só para o console do navegador (T-06.3-23).
export default function ErroLembretes({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, e não `reset` (revisão 06.1, WR-102): no Next 16.3.5 o `reset` só redesenha o MESMO
  // payload do servidor, que ainda tem o erro; o `retry` busca de novo o que falhou.
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErro
      titulo={FRASE_ERRO_TITULO}
      corpo={FRASE_ERRO_DA_COLUNA}
      acao={
        <Button
          type="button"
          variant="default"
          className="min-h-[44px] font-semibold"
          onClick={() => retry()}
        >
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}

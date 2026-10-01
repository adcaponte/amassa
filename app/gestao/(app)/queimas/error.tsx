"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { FRASE_ERRO_CORPO, FRASE_ERRO_TITULO } from "@/lib/queimas/textos";

// Boundary de erro do índice de Queimas — "use client" é exigência do App Router para qualquer
// error.tsx. Mesmo padrão de app/(app)/encomendas/error.tsx: nenhuma propriedade de `error`
// (mensagem, pilha, `digest`) é renderizada na tela, só sai no console via `console.error`.
export default function ErroQueimas({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // `retry`, e não `reset` (revisão 06.1, WR-102): no Next 16.3.5 o `reset` só limpa o estado do
  // boundary e redesenha o MESMO payload do servidor, que ainda tem o erro; o `retry` faz
  // `router.refresh()` + `reset()` numa transição — busca de novo o que falhou no servidor
  // (`node_modules/next/dist/client/components/error-boundary.js`, `this.retry`).
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErro
      titulo={FRASE_ERRO_TITULO}
      corpo={FRASE_ERRO_CORPO}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => retry()}>
          Tentar de novo
        </Button>
      }
    />
  );
}

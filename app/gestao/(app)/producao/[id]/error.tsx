"use client";

import { useEffect } from "react";

import {
  FRASE_ERRO_CARREGAR_ORDEM,
  ROTULO_TENTAR_DE_NOVO,
  TITULO_ERRO,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/producao/[id]` — molde de `app/gestao/(app)/estoque/error.tsx`:
// nenhuma propriedade de `error` chega à tela, só ao console. Ordem inexistente NÃO passa por aqui:
// a página chama `notFound()` (o 404 do grupo protegido).
export default function ErroOrdem({
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
      corpo={FRASE_ERRO_CARREGAR_ORDEM}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => reset()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}

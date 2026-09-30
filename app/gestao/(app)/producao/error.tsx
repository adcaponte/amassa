"use client";

import { useEffect } from "react";

import {
  FRASE_ERRO_CARREGAR_PRODUCAO,
  ROTULO_TENTAR_DE_NOVO,
  TITULO_ERRO,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro de `/gestao/producao` — "use client" é exigência do App Router. Mesmo padrão de
// `app/gestao/(app)/estoque/error.tsx`: nenhuma propriedade de `error` (mensagem, pilha, `digest`)
// é renderizada na tela, só sai no console. A frase é a da UI-SPEC para "Carregar a Produção".
export default function ErroProducao({
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
      corpo={FRASE_ERRO_CARREGAR_PRODUCAO}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => reset()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}

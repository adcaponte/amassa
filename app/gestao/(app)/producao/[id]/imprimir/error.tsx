"use client";

import { useEffect } from "react";

import { FRASE_ERRO_MONTAR_FOLHA, ROTULO_TENTAR_DE_NOVO, TITULO_ERRO } from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Boundary de erro da folha da ordem A4 — nenhuma propriedade de `error` chega à tela, só ao
// console. Ordem inexistente NÃO passa por aqui: a página chama `notFound()`.
export default function ErroFolhaDaOrdem({
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
      corpo={FRASE_ERRO_MONTAR_FOLHA}
      acao={
        <Button type="button" variant="default" className="min-h-[44px]" onClick={() => reset()}>
          {ROTULO_TENTAR_DE_NOVO}
        </Button>
      }
    />
  );
}
